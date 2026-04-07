import { Types } from "mongoose";
import Stripe from "stripe";
import {
  createOrder,
  findOrderById,
  findOrdersByCustomerId,
  findOrdersWithFilters,
  updateOrderById,
} from "../repositories/orderRepository";
import {
  getCartById,
  clearCartById,
  CartDocument,
} from "../repositories/cartRepository";
import {
  decreaseInventoryForItems,
  restoreInventoryForItems,
} from "../repositories/inventoryRepository";
import {
  Order,
  OrderStatus,
  PaymentStatus,
  OrderItemInput,
  OrderDocument,
} from "../models/Order";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors";
import logger from "../utils/logger";
import config from "../config";

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export interface CreateOrderFromCartInput {
  cartId: string;
  customerId: string;
  currency: string;
  paymentIntentId?: string;
  shippingAddressId?: string;
  billingAddressId?: string;
  notes?: string;
  metadata?: Record<string, string>;
}

export interface OrderQueryOptions {
  customerId?: string;
  status?: OrderStatus | OrderStatus[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  email?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface OrderService {
  createOrderFromCart(input: CreateOrderFromCartInput): Promise<OrderDocument>;
  getOrderForCustomer(orderId: string, customerId: string): Promise<OrderDocument>;
  getOrderForAdmin(orderId: string): Promise<OrderDocument>;
  listOrdersForCustomer(
    customerId: string,
    options?: Omit<OrderQueryOptions, "customerId">
  ): Promise<{ orders: OrderDocument[]; total: number }>;
  listOrdersForAdmin(
    options?: OrderQueryOptions
  ): Promise<{ orders: OrderDocument[]; total: number }>;
  updateOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    context?: { isAdmin?: boolean }
  ): Promise<OrderDocument>;
  handleStripePaymentUpdate(paymentIntentId: string): Promise<OrderDocument | null>;
  cancelOrder(
    orderId: string,
    reason: string,
    context?: { isAdmin?: boolean; customerId?: string }
  ): Promise<OrderDocument>;
}

const VALID_CUSTOMER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["canceled"],
  processing: [],
  paid: [],
  fulfilled: [],
  shipped: [],
  completed: [],
  canceled: [],
  refunded: [],
};

const VALID_ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "canceled"],
  processing: ["paid", "canceled"],
  paid: ["fulfilled", "shipped", "refunded"],
  fulfilled: ["shipped", "refunded"],
  shipped: ["completed", "refunded"],
  completed: [],
  canceled: [],
  refunded: [],
};

function canTransitionStatus(
  current: OrderStatus,
  next: OrderStatus,
  isAdmin: boolean
): boolean {
  const map = isAdmin ? VALID_ADMIN_TRANSITIONS : VALID_CUSTOMER_TRANSITIONS;
  const allowed = map[current] || [];
  return allowed.includes(next);
}

async function buildOrderItemsFromCart(cart: CartDocument): Promise<OrderItemInput[]> {
  if (!cart.items || cart.items.length === 0) {
    throw new ValidationError("Cannot create order from empty cart");
  }

  return cart.items.map((item) => {
    if (!item.product || !item.product._id) {
      throw new ValidationError("Cart item missing product reference");
    }
    return {
      productId: new Types.ObjectId(item.product._id),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: cart.currency,
      totalPrice: item.unitPrice * item.quantity,
      productSnapshot: {
        name: item.product.name,
        sku: item.product.sku,
        image: item.product.image,
        description: item.product.description,
      },
    };
  });
}

async function syncStripeMetadata(
  paymentIntentId: string,
  orderId: string,
  customerId: string
): Promise<void> {
  try {
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = {
      ...(existing.metadata || {}),
      orderId,
      customerId,
    };
    await stripe.paymentIntents.update(paymentIntentId, { metadata });
  } catch (err) {
    logger.error(
      { err, paymentIntentId, orderId, customerId },
      "Failed to sync Stripe metadata for order"
    );
  }
}

async function determineInitialPaymentStatus(paymentIntentId?: string): Promise<{
  status: PaymentStatus;
  intentStatus?: string | null;
}> {
  if (!paymentIntentId) {
    return { status: "pending", intentStatus: null };
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    switch (pi.status) {
      case "succeeded":
        return { status: "paid", intentStatus: pi.status };
      case "processing":
        return { status: "processing", intentStatus: pi.status };
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return { status: "pending", intentStatus: pi.status };
      case "canceled":
        return { status: "canceled", intentStatus: pi.status };
      default:
        return { status: "pending", intentStatus: pi.status };
    }
  } catch (err) {
    logger.error({ err, paymentIntentId }, "Failed to retrieve payment intent");
    return { status: "pending", intentStatus: null };
  }
}

async function createOrderFromCart(
  input: CreateOrderFromCartInput
): Promise<OrderDocument> {
  const { cartId, customerId, currency, paymentIntentId, shippingAddressId, billingAddressId, notes, metadata } =
    input;

  const cart = await getCartById(cartId);
  if (!cart) {
    throw new NotFoundError("Cart not found");
  }

  if (cart.customerId.toString() !== customerId.toString()) {
    throw new ValidationError("Cart does not belong to customer");
  }

  const items = await buildOrderItemsFromCart(cart);

  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
  const taxAmount = cart.taxAmount ?? 0;
  const shippingAmount = cart.shippingAmount ?? 0;
  const total = subtotal + taxAmount + shippingAmount;

  const { status: initialPaymentStatus, intentStatus } =
    await determineInitialPaymentStatus(paymentIntentId);

  const initialOrderStatus: OrderStatus =
    initialPaymentStatus === "paid" ? "paid" : "pending";

  await decreaseInventoryForItems(
    items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }))
  );

  const orderData: Partial<Order> = {
    customerId: new Types.ObjectId(customerId),
    cartId: new Types.ObjectId(cartId),
    items,
    currency,
    subtotal,
    taxAmount,
    shippingAmount,
    total,
    status: initialOrderStatus,
    paymentStatus: initialPaymentStatus,
    payment: paymentIntentId
      ? {
          paymentIntentId,
          provider: "stripe",
          status: initialPaymentStatus,
          providerStatus: intentStatus ?? undefined,
        }
      : undefined,
    shippingAddressId: shippingAddressId
      ? new Types.ObjectId(shippingAddressId)
      : undefined,
    billingAddressId: billingAddressId
      ? new Types.ObjectId(billingAddressId)
      : undefined,
    notes,
    metadata,
  };

  const order = await createOrder(orderData as Order);

  if (paymentIntentId) {
    void syncStripeMetadata(paymentIntentId, order._id.toString(), customerId);
  }

  try {
    await clearCartById(cartId);
  } catch (err) {
    logger.warn({ err, cartId }, "Failed to clear cart after order creation");
  }

  return order;
}

async function getOrderForCustomer(
  orderId: string,
  customerId: string
): Promise<OrderDocument> {
  const order = await findOrderById(orderId);
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  if (order.customerId.toString() !== customerId.toString()) {
    throw new NotFoundError("Order not found");
  }
  return order;
}

async function getOrderForAdmin(orderId: string): Promise<OrderDocument> {
  const order = await findOrderById(orderId);
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  return order;
}

async function listOrdersForCustomer(
  customerId: string,
  options: Omit<OrderQueryOptions, "customerId"> = {}
): Promise<{ orders: OrderDocument[]; total: number }> {
  const query: OrderQueryOptions = {
    ...options,
    customerId,
  };
  return findOrdersByCustomerId(customerId, query);
}

async function listOrdersFor