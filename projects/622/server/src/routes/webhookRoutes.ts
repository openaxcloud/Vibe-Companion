import express, { Router, Request, Response } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { Order, OrderStatus } from "../models/Order";
import { sendPaymentSuccessEmail } from "../services/emailService";
import { logger } from "../utils/logger";

dotenv.config();

const router: Router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not defined in environment variables");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

type StripeWebhookRequest = Request & {
  rawBody?: Buffer;
};

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: StripeWebhookRequest, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string | undefined;

    if (!sig) {
      logger.warn("Stripe webhook received without signature header");
      res.status(400).send("Webhook Error: Missing Stripe signature");
      return;
    }

    let event: Stripe.Event;

    try {
      const payload = req.rawBody ?? (req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body)));
      event = stripe.webhooks.constructEvent(payload, sig, stripeWebhookSecret);
    } catch (err: any) {
      logger.error("Stripe webhook signature verification failed", { error: err?.message || err });
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntentSucceeded(paymentIntent);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntentFailed(paymentIntent);
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          await handleChargeRefunded(charge);
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object as Stripe.Dispute;
          await handleDisputeCreated(dispute);
          break;
        }

        default: {
          logger.info("Unhandled Stripe event type", { type: event.type, id: event.id });
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      logger.error("Error processing Stripe webhook event", {
        error: err?.message || err,
        type: event.type,
        id: event.id,
      });
      res.status(500).send("Webhook handler failed");
    }
  }
);

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = (paymentIntent.metadata && paymentIntent.metadata.orderId) || null;

  if (!orderId) {
    logger.warn("payment_intent.succeeded received without orderId in metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const order = await Order.findById(orderId);

  if (!order) {
    logger.error("Order not found for payment_intent.succeeded", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  if (order.status === OrderStatus.PAID) {
    logger.info("Order already marked as PAID, skipping update", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  order.status = OrderStatus.PAID;
  order.payment = {
    ...(order.payment || {}),
    stripePaymentIntentId: paymentIntent.id,
    amountReceived: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    status: "succeeded",
    updatedAt: new Date(),
  };

  await order.save();

  try {
    if (order.customer && order.customer.email) {
      await sendPaymentSuccessEmail({
        to: order.customer.email,
        orderId: order.id,
        amount: paymentIntent.amount_received,
        currency: paymentIntent.currency,
      });
    }
  } catch (emailError: any) {
    logger.error("Failed to send payment success email", {
      orderId: order.id,
      error: emailError?.message || emailError,
    });
  }

  logger.info("Order updated to PAID from payment_intent.succeeded", {
    orderId: order.id,
    paymentIntentId: paymentIntent.id,
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = (paymentIntent.metadata && paymentIntent.metadata.orderId) || null;

  if (!orderId) {
    logger.warn("payment_intent.payment_failed received without orderId in metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const order = await Order.findById(orderId);

  if (!order) {
    logger.error("Order not found for payment_intent.payment_failed", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  order.status = OrderStatus.PAYMENT_FAILED;
  order.payment = {
    ...(order.payment || {}),
    stripePaymentIntentId: paymentIntent.id,
    amountReceived: paymentIntent.amount_received || 0,
    currency: paymentIntent.currency,
    status: "failed",
    failureCode: paymentIntent.last_payment_error?.code,
    failureMessage: paymentIntent.last_payment_error?.message,
    updatedAt: new Date(),
  };

  await order.save();

  logger.info("Order updated to PAYMENT_FAILED from payment_intent.payment_failed", {
    orderId: order.id,
    paymentIntentId: paymentIntent.id,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;

  if (!paymentIntentId) {
    logger.warn("charge.refunded without associated payment_intent", {
      chargeId: charge.id,
    });
    return;
  }

  const order = await Order.findOne({ "payment.stripePaymentIntentId": paymentIntentId });

  if (!order) {
    logger.warn("Order not found for charge.refunded", {
      chargeId: charge.id,
      paymentIntentId,
    });
    return;
  }

  order.status = OrderStatus.REFUNDED;
  order.payment = {
    ...(order.payment || {}),
    stripeChargeId: charge.id,
    refunded: true,
    refundAmount: charge.amount_refunded,
    refundCurrency: charge.currency,
    status: "refunded",
    updatedAt: new Date(),
  };

  await order.save();

  logger.info("Order updated to REFUNDED from charge.refunded", {
    orderId: order.id,
    chargeId: charge.id,
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  if (!chargeId) {
    logger.warn("charge.dispute.created without associated charge", {
      disputeId: dispute.id,
    });
    return;
  }

  const order = await Order.findOne({ "payment.stripeChargeId": chargeId });

  if (!order) {
    logger.warn("Order not found for charge.dispute.created", {
      disputeId: dispute.id,
      chargeId,
    });
    return;
  }

  order.payment = {
    ...(order.payment || {}),
    disputeId: dispute.id,
    disputeStatus: dispute.status,
    updatedAt: new Date(),
  };

  await order.save();

  logger.info("Order payment updated with dispute information from charge.dispute.created", {
    orderId: order.id,
    disputeId: dispute.id,
  });
}

export default router;