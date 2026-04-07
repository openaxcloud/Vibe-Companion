import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { Types } from "mongoose";
import { getConfig } from "../utils/config";
import { Order, OrderDocument, OrderItemInput } from "../models/order.model";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getUserIdFromRequest } from "../utils/auth";

// =========================
// Types
// =========================

export interface CheckoutItemInput {
  productId: string;
  name: string;
  unitPrice: number; // in smallest currency unit (e.g. cents)
  quantity: number;
}

export interface CheckoutRequestBody {
  items: CheckoutItemInput[];
  currency?: string; // ISO currency code, e.g. 'usd'
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface CheckoutResponseBody {
  clientSecret: string;
  orderId: string;
}

const config = getConfig();

if (!config.stripeSecretKey) {
  throw new Error("Stripe secret key is not configured");
}

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
});

// =========================
// Helpers
// =========================

const validateItems = (items: CheckoutItemInput[]): void => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("At least one item is required", 400);
  }

  for (const [index, item] of items.entries()) {
    if (!item.productId || typeof item.productId !== "string") {
      throw new AppError(`Item[undefined]: productId is required`, 400);
    }
    if (!item.name || typeof item.name !== "string") {
      throw new AppError(`Item[undefined]: name is required`, 400);
    }
    if (
      typeof item.unitPrice !== "number" ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice <= 0
    ) {
      throw new AppError(
        `Item[undefined]: unitPrice must be a positive number in smallest currency unit`,
        400
      );
    }
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new AppError(
        `Item[undefined]: quantity must be a positive integer`,
        400
      );
    }
  }
};

const computeTotals = (items: CheckoutItemInput[]): { subtotal: number; total: number } => {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);

  if (subtotal <= 0) {
    throw new AppError("Computed subtotal must be greater than 0", 400);
  }

  // No additional fees/taxes applied here; hook for future changes
  const total = subtotal;

  return { subtotal, total };
};

const buildOrderItems = (items: CheckoutItemInput[]): OrderItemInput[] => {
  return items.map((item) => ({
    productId: new Types.ObjectId(item.productId),
    name: item.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    total: item.unitPrice * item.quantity,
  }));
};

const buildStripeMetadata = (
  base: Record<string, unknown>
): Record<string, string> => {
  const metadata: Record<string, string> = {};
  Object.entries(base).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    metadata[key] = String(value);
  });
  return metadata;
};

// =========================
// Controller
// =========================

export const createCheckoutIntent = async (
  req: Request<unknown, unknown, CheckoutRequestBody>,
  res: Response<CheckoutResponseBody>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { items, currency, metadata: additionalMetadata } = req.body;

    validateItems(items);

    const { subtotal, total } = computeTotals(items);

    const orderItems = buildOrderItems(items);

    const order: OrderDocument = await Order.create({
      userId: new Types.ObjectId(userId),
      items: orderItems,
      currency: (currency || config.defaultCurrency || "usd").toLowerCase(),
      subtotal,
      total,
      status: "pending",
      paymentStatus: "requires_payment",
      stripePaymentIntentId: null,
      metadata: additionalMetadata || {},
    });

    const stripeMetadata = buildStripeMetadata({
      orderId: order._id.toString(),
      userId: userId.toString(),
      ...additionalMetadata,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: order.currency,
      metadata: stripeMetadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    logger.info("Created Stripe payment intent and pending order", {
      orderId: order._id.toString(),
      userId: userId.toString(),
      paymentIntentId: paymentIntent.id,
      amount: total,
      currency: order.currency,
    });

    res.status(201).json({
      clientSecret: paymentIntent.client_secret as string,
      orderId: order._id.toString(),
    });
  } catch (err) {
    next(err);
  }
};

export default {
  createCheckoutIntent,
};