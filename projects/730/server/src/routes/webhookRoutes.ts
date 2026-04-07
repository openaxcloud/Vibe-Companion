import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import { buffer } from "micro";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables.");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not defined in environment variables.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const rawBodyMiddleware = (
  req: RawBodyRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.headers["stripe-signature"]) {
    buffer(req)
      .then((buf) => {
        req.rawBody = buf;
        next();
      })
      .catch((err) => {
        next(err);
      });
  } else {
    express.json()(req, res, next);
  }
};

const router: Router = express.Router();

/**
 * Stub for handling order finalization logic when a payment succeeds.
 * Replace with actual implementation to:
 * - Mark order as paid
 * - Trigger fulfillment processes
 * - Send notifications, etc.
 */
async function finalizeOrderFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = typeof paymentIntent.metadata?.orderId === "string"
    ? paymentIntent.metadata.orderId
    : undefined;

  if (!orderId) {
    console.warn("PaymentIntent missing orderId metadata; cannot finalize order.", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  // TODO: Implement your business logic to finalize the order
  // Example:
  // await OrderService.markOrderAsPaid(orderId, {
  //   paymentIntentId: paymentIntent.id,
  //   amountReceived: paymentIntent.amount_received,
  //   currency: paymentIntent.currency,
  // });
}

/**
 * Stub for handling order failure logic when a payment fails.
 * Replace with actual implementation to:
 * - Mark order as failed/errored
 * - Optionally notify the customer
 * - Log for operational visibility
 */
async function handleFailedPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = typeof paymentIntent.metadata?.orderId === "string"
    ? paymentIntent.metadata.orderId
    : undefined;

  // TODO: Implement your business logic to handle failed payment
  // Example:
  // await OrderService.markOrderAsPaymentFailed(orderId, {
  //   paymentIntentId: paymentIntent.id,
  //   lastPaymentError: paymentIntent.last_payment_error,
  // });
  console.warn("Handling failed payment intent", {
    orderId,
    paymentIntentId: paymentIntent.id,
  });
}

/**
 * Stripe Webhook endpoint
 * This endpoint must:
 * - Use the raw body for signature verification
 * - Return quickly (acknowledge receipt) while delegating heavy work
 */
router.post(
  "/stripe",
  rawBodyMiddleware,
  async (req: RawBodyRequest, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];

    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing Stripe-Signature header");
      return;
    }

    if (!req.rawBody) {
      res.status(400).send("Raw body is required for Stripe webhook");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret as string
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Stripe webhook signature verification failed:", errorMessage);
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Handle successful payment here
          await finalizeOrderFromPaymentIntent(paymentIntent);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Handle failed payment here
          await handleFailedPaymentIntent(paymentIntent);
          break;
        }

        default:
          // For unsupported events, just acknowledge.
          console.log(`Unhandled Stripe event type: undefined`);
      }

      // Respond with 200 to acknowledge receipt
      res.json({ received: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error processing Stripe webhook:", errorMessage);
      // Return 500 so you can catch operational issues in logs/monitoring
      res.status(500).send("Internal Server Error while processing webhook");
    }
  }
);

export default router;