import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

export interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const rawBodySaver = (
  req: StripeWebhookRequest,
  res: Response,
  buf: Buffer,
): void => {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
};

const webhookRouter: Router = express.Router();

webhookRouter.post(
  "/stripe",
  bodyParser.raw({ type: "application/json", verify: rawBodySaver }),
  async (req: StripeWebhookRequest, res: Response, next: NextFunction) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    if (!req.rawBody) {
      res.status(400).send("Missing raw body for webhook verification");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret as string,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown webhook error";
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // TODO: Implement business logic for successful payments
          // Example: mark order as paid, provision service, send email, etc.
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const lastPaymentError = paymentIntent.last_payment_error;
          // TODO: Implement business logic for failed payments
          // Example: notify customer, release reservation, etc.
          void lastPaymentError;
          break;
        }
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          // TODO: Implement business logic for completed checkout
          // Example: retrieve line items, fulfill order, etc.
          void session;
          break;
        }
        default: {
          // Optionally log unhandled events
          break;
        }
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);

export default webhookRouter;