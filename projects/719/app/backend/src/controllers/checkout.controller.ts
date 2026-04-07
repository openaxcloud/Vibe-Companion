import { Request, Response } from "express";
import Stripe from "stripe";
import { Types } from "mongoose";
import { OrderModel } from "../models/order.model";
import { ProductModel } from "../models/product.model";
import { CartModel } from "../models/cart.model";
import { UserModel } from "../models/user.model";
import { sendOrderConfirmationEmail } from "../services/email.service";
import { calculateCartTotals } from "../services/pricing.service";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2025-01-27.acacia" as any,
});

interface CheckoutRequestBody {
  cartId?: string;
  items?: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethodId?: string;
  paymentIntentId?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  email?: string;
  currency?: string;
  savePaymentMethod?: boolean;
}

type CheckoutCreateRequest = Request<unknown, unknown, CheckoutRequestBody>;
type CheckoutConfirmRequest = Request<unknown, unknown, CheckoutRequestBody>;

const validateObjectId = (id: string, fieldName: string): void => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid undefined`);
  }
};

const getUserFromRequest = async (req: Request) => {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) return null;
  if (!Types.ObjectId.isValid(userId)) return null;
  return UserModel.findById(userId);
};

const loadCartItems = async (
  cartId?: string,
  items?: CheckoutRequestBody["items"]
) => {
  if (!cartId && (!items || items.length === 0)) {
    throw new ApiError(400, "No cart or items provided");
  }

  if (cartId) {
    validateObjectId(cartId, "cartId");
    const cart = await CartModel.findById(cartId).populate("items.product");
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }
    return cart.items.map((i: any) => ({
      productId: i.product._id.toString(),
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      sku: i.product.sku,
    }));
  }

  const productIds = (items || []).map((i) => i.productId);
  productIds.forEach((id) => validateObjectId(id, "productId"));

  const products = await ProductModel.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const productMap = new Map(
    products.map((p) => [p._id.toString(), p])
  );

  return (items || []).map((i) => {
    const product = productMap.get(i.productId);
    if (!product) {
      throw new ApiError(404, `Product not found: undefined`);
    }
    return {
      productId: product._id.toString(),
      name: product.name,
      price: product.price,
      quantity: i.quantity,
      sku: product.sku,
    };
  });
};

const ensureInventoryAvailable = async (
  lineItems: Array<{ productId: string; quantity: number }>
) => {
  const productIds = lineItems.map((i) => i.productId);
  const products = await ProductModel.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  for (const item of lineItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new ApiError(404, `Product not found: undefined`);
    }
    if (product.inventory < item.quantity) {
      throw new ApiError(
        409,
        `Insufficient inventory for product undefined`
      );
    }
  }
};

const decrementInventory = async (
  orderItems: Array<{ productId: string; quantity: number }>
) => {
  const bulkOps = orderItems.map((item) => ({
    updateOne: {
      filter: {
        _id: new Types.ObjectId(item.productId),
        inventory: { $gte: item.quantity },
      },
      update: {
        $inc: { inventory: -item.quantity },
      },
    },
  }));

  const result = await ProductModel.bulkWrite(bulkOps, { ordered: false });

  if (result.modifiedCount !== orderItems.length) {
    throw new ApiError(
      409,
      "Inventory changed during checkout. Please try again."
    );
  }
};

const createOrderRecord = async (params: {
  userId?: string | null;
  email: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    sku?: string;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    currency: string;
  };
  shippingAddress?: CheckoutRequestBody["shippingAddress"];
  billingAddress?: CheckoutRequestBody["billingAddress"];
  paymentIntentId: string;
  paymentMethodId?: string;
  status?: string;
}) => {
  const order = await OrderModel.create({
    user: params.userId ? new Types.ObjectId(params.userId) : undefined,
    email: params.email,
    items: params.items.map((i) => ({
      product: new Types.ObjectId(i.productId),
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      sku: i.sku,
    })),
    subtotal: params.totals.subtotal,
    tax: params.totals.tax,
    shipping: params.totals.shipping,
    discount: params.totals.discount,
    total: params.totals.total,
    currency: params.totals.currency,
    shippingAddress: params.shippingAddress,
    billingAddress: params.billingAddress,
    payment: {
      provider: "stripe",
      paymentIntentId: params.paymentIntentId,
      paymentMethodId: params.paymentMethodId,
      status: params.status || "processing",
    },
    status: "processing",
  });
  return order;
};

export const createCheckout = async (req: CheckoutCreateRequest, res: Response) => {
  try {
    const {
      cartId,
      items,
      paymentMethodId,
      shippingAddress,
      billingAddress,
      email,
      currency = "usd",
      savePaymentMethod,
    } = req.body;

    const user = await getUserFromRequest(req);

    const lineItems = await loadCartItems(cartId, items);

    await ensureInventoryAvailable(
      lineItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }))
    );

    const totals = await calculateCartTotals(lineItems, { currency });

    const customerEmail = email || user?.email;
    if (!customerEmail) {
      throw new ApiError(400, "Email is required for checkout");
    }

    const stripeCustomerId = user?.stripeCustomerId
      ? user.stripeCustomerId
      : undefined;

    let customerId = stripeCustomerId;
    if (!customerId && customerEmail) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          userId: user?._id?.toString() || "",
        },
      });
      customerId = customer.id;
      if (user) {
        user.stripeCustomerId = customer.id;
        await user.save();
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totals.total * 100),
      currency: totals.currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: "automatic",
      confirm: !!paymentMethodId,
      setup_future_usage: savePaymentMethod ? "off_session" : undefined,
      receipt_email: customerEmail,
      metadata: {
        cartId: cartId || "",
        userId: user?._id?.toString() || "",
        email: customerEmail,
      },
      shipping: shippingAddress
        ? {
            name: user?.name || customerEmail,
            address: {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2 || undefined,
              city: shippingAddress.city,
              state: shippingAddress.state || undefined,
              postal_code: shippingAddress.postalCode,
              country: shippingAddress.country,
            },
          }
        : undefined,
    });

    const requiresAction =
      paymentIntent.status === "requires_action" ||
      paymentIntent.status === "requires_source_action";

    res.status(200).json({
      clientSecret: paymentIntent.client_secret