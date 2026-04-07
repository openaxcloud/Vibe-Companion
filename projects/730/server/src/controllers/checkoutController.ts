import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { PrismaClient, CartItem, Product, Order, OrderItem, User } from "@prisma/client";

const prisma = new PrismaClient();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia" as any,
});

type CheckoutCartItem = {
  productId: string;
  quantity: number;
};

type CheckoutRequestBody = {
  cartId?: string;
  items?: CheckoutCartItem[];
  currency?: string;
  paymentMethodId?: string;
  paymentIntentId?: string;
  savePaymentMethod?: boolean;
};

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string | null;
  };
};

const DEFAULT_CURRENCY = "usd";

function buildCartNotFoundError() {
  const error: any = new Error("Cart not found");
  error.status = 404;
  return error;
}

function buildValidationError(message: string) {
  const error: any = new Error(message);
  error.status = 400;
  return error;
}

async function loadCartItemsFromCartId(cartId: string): Promise<CartItem[]> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true },
  });

  if (!cart) {
    throw buildCartNotFoundError();
  }

  return cart.items;
}

async function loadCartItemsFromPayload(items: CheckoutCartItem[]): Promise<CartItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw buildValidationError("Cart items are required");
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });

  if (products.length !== productIds.length) {
    throw buildValidationError("One or more products are invalid or inactive");
  }

  const productsById: Record<string, Product> = {};
  for (const product of products) {
    productsById[product.id] = product;
  }

  const now = new Date();
  const cartItems: CartItem[] = items.map((item, index) => {
    const product = productsById[item.productId];
    if (!product) {
      throw buildValidationError(`Invalid product in cart: undefined`);
    }
    if (item.quantity <= 0) {
      throw buildValidationError("Cart item quantity must be greater than 0");
    }

    return {
      id: `virtual-undefined-undefined`,
      cartId: "virtual-cart",
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
      createdAt: now,
      updatedAt: now,
    };
  });

  return cartItems;
}

async function validateCartAndCalculateTotal(cartItems: CartItem[]): Promise<{
  amountTotal: number;
  currency: string;
  productsById: Record<string, Product>;
}> {
  if (!cartItems || cartItems.length === 0) {
    throw buildValidationError("Cart is empty");
  }

  const productIds = Array.from(new Set(cartItems.map((ci) => ci.productId)));

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });

  if (products.length !== productIds.length) {
    throw buildValidationError("One or more products in the cart are unavailable");
  }

  const productsById: Record<string, Product> = {};
  for (const product of products) {
    productsById[product.id] = product;
  }

  let amountTotal = 0;

  for (const item of cartItems) {
    const product = productsById[item.productId];
    if (!product) {
      throw buildValidationError(`Product not found: undefined`);
    }
    if (item.quantity <= 0) {
      throw buildValidationError("Cart item quantity must be greater than 0");
    }
    const unitPrice = product.price;
    amountTotal += unitPrice * item.quantity;
  }

  if (amountTotal <= 0) {
    throw buildValidationError("Cart total must be greater than 0");
  }

  const currency = DEFAULT_CURRENCY;

  return {
    amountTotal,
    currency,
    productsById,
  };
}

async function findOrCreateStripeCustomerForUser(user: User): Promise<string | undefined> {
  if (!user.email) {
    return undefined;
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

async function createOrUpdatePaymentIntent(params: {
  amount: number;
  currency: string;
  paymentMethodId?: string;
  paymentIntentId?: string;
  customerId?: string;
  savePaymentMethod?: boolean;
  metadata?: Record<string, string>;
}) {
  const {
    amount,
    currency,
    paymentMethodId,
    paymentIntentId,
    customerId,
    savePaymentMethod,
    metadata,
  } = params;

  if (paymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!existing) {
      throw buildValidationError("PaymentIntent not found");
    }

    const updated = await stripe.paymentIntents.update(paymentIntentId, {
      amount,
      currency,
      payment_method: paymentMethodId ?? existing.payment_method ?? undefined,
      metadata: {
        ...(existing.metadata || {}),
        ...(metadata || {}),
      },
    });

    return updated;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method: paymentMethodId,
    setup_future_usage: savePaymentMethod ? "off_session" : undefined,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata,
  });

  return paymentIntent;
}

async function confirmStripePaymentIntent(paymentIntentId: string, paymentMethodId?: string) {
  const intent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
  return intent;
}

async function createOrderFromPayment(params: {
  userId: string | null;
  cartItems: CartItem[];
  productsById: Record<string, Product>;
  amountTotal: number;
  currency: string;
  paymentIntent: Stripe.PaymentIntent;
}): Promise<Order> {
  const { userId, cartItems, productsById, amountTotal, currency, paymentIntent } = params;

  const order = await prisma.$transaction(async (tx) => {
    const orderRecord = await tx.order.create({
      data: {
        userId: userId ?? undefined,
        status: "PAID",
        totalAmount: amountTotal,
        currency,
        paymentProvider: "STRIPE",
        paymentIntentId: paymentIntent.id,
        paymentStatus: paymentIntent.status,
      },
    });

    const orderItemsData: Omit<OrderItem, "id" | "createdAt" | "updatedAt">[] = cartItems.map(
      (item) => {
        const product = productsById[item.productId];
        return {
          orderId: orderRecord.id,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
          currency,
        };
      }
    );

    await tx.orderItem.createMany({
      data: orderItemsData,
    });

    return orderRecord;
  });

  return order;
}

function mapStripeCardBrand(brand?: Stripe.PaymentMethod.Card.Brand | null): string | null {
  if (!brand) return null;
  return brand;
}

function mapStripePaymentMethodDetails(
  paymentIntent: Stripe.PaymentIntent
): {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} | null {
  const paymentMethod = paymentIntent.charges?.data?.[0]?.payment_method_details;
  if (!paymentMethod) {
    return null;
  }

  if (paymentMethod.card) {
    return {
      brand: mapStripeCardBrand(paymentMethod.card.brand),
      last4: paymentMethod.card.last4 ?? null,
      expMonth: paymentMethod.card.exp_month ?? null,
      expYear: paymentMethod.card.exp_year ?? null,
    };
  }

  return null;
}

async function attachPaymentMethodToCustomer(paymentMethodId: string, customerId: string) {
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  } catch (err) {
    return;
  }
}

export async function initiateCheckout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction