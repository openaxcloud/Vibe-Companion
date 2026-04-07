import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import crypto from "crypto";
import { getCartById, calculateCartTotal } from "../services/cart.service";
import { getUserById } from "../services/user.service";
import {
  createOrderFromCart,
  updateOrderPaymentStatusByPaymentIntentId,
} from "../services/order.service";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errors";
import { env } from "../config/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { cartId, currency = "usd" } = req.body as {
      cartId: string;
      currency?: string;
    };

    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    if (!cartId) {
      throw new AppError("cartId is required", 400);
    }

    const [user, cart] = await Promise.all([
      getUserById(userId),
      getCartById(cartId, userId),
    ]);

    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart not found or empty", 400);
    }

    const total = calculateCartTotal(cart);
    if (total <= 0) {
      throw new AppError("Invalid cart total", 400);
    }

    const amountInMinorUnit = Math.round(total * 100);

    const order = await createOrderFromCart({
      cart,
      user,
      amount: total,
      currency,
      status: "pending",
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency,
      metadata: {
        userId,
        cartId,
        orderId: order.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId: order.id,
    });
  } catch (error) {
    next(error);
  }
};

export const stripeWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig || Array.isArray(sig)) {
    next(new AppError("Missing Stripe signature", 400));
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody =
      (req as any).rawBody && Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body));

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", { err });
    next(new AppError("Webhook signature verification failed", 400));
    return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;

        await updateOrderPaymentStatusByPaymentIntentId(paymentIntentId, {
          paymentStatus: "succeeded",
          paymentDetails: {
            id: paymentIntent.id,
            amount_received: paymentIntent.amount_received,
            currency: paymentIntent.currency,
            charges: paymentIntent.charges.data.map((c) => ({
              id: c.id,
              receipt_url: c.receipt_url,
              paid: c.paid,
              status: c.status,
            })),
          },
        });

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;

        await updateOrderPaymentStatusByPaymentIntentId(paymentIntentId, {
          paymentStatus: "failed",
          paymentDetails: {
            id: paymentIntent.id,
            last_payment_error: paymentIntent.last_payment_error
              ? {
                  code: paymentIntent.last_payment_error.code,
                  message: paymentIntent.last_payment_error.message,
                  type: paymentIntent.last_payment_error.type,
                }
              : null,
          },
        });

        break;
      }

      default: {
        logger.debug("Unhandled Stripe event type", { type: event.type });
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Error handling Stripe webhook", {
      type: event.type,
      error,
    });
    next(new AppError("Webhook processing failed", 500));
  }
};

export const generateStripeWebhookSignature = (
  payload: string | Buffer
): string => {
  // Utility only for internal/testing usage; not exposed as a route
  const timestamp = Math.floor(Date.now() / 1000);
  const body =
    typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  const signedPayload = `undefined.undefined`;

  const signature = crypto
    .createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, "utf8")
    .digest("hex");

  return `t=undefined,v1=undefined`;
};