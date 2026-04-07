import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

if (!stripeWebhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
});

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const webhookRouter: Router = express.Router();

/**
 * Middleware to capture raw body for Stripe webhook validation.
 * This middleware should be applied only to the Stripe webhook route.
 */
const rawBodyMiddleware = (
  req: StripeWebhookRequest,
  res: Response,
  buf: Buffer,
): void => {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
};

// Attach body-parser specifically configured for this router/route
webhookRouter.use(
  "/stripe",
  express.raw({
    type: "application/json",
    verify: rawBodyMiddleware,
  }),
);

webhookRouter.post(
  "/stripe",
  async (req: StripeWebhookRequest, res: Response, _next: NextFunction) => {
    const sig = req.headers["stripe-signature"];

    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing Stripe signature header");
      return;
    }

    if (!req.rawBody) {
      res.status(400).send("Missing raw body for Stripe webhook");
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
      const error = err as Error;
      console.error("⚠️  Stripe webhook signature verification failed.", error);
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          const sessionId = session.id;
          const customerId = session.customer as string | null;
          const subscriptionId = session.subscription as string | null;
          const clientReferenceId = session.client_reference_id ?? null;
          const paymentStatus = session.payment_status;
          const mode = session.mode;
          const email =
            (session.customer_details &&
              session.customer_details.email) ||
            (session.metadata && session.metadata.email) ||
            null;

          // TODO: Implement application-specific business logic here.
          // Example steps:
          // - Look up user or order by clientReferenceId or metadata
          // - Mark order as paid or activate subscription
          // - Persist Stripe IDs (customerId, subscriptionId, sessionId)
          // - Send confirmation email / notifications

          console.log("✅ checkout.session.completed", {
            sessionId,
            customerId,
            subscriptionId,
            clientReferenceId,
            paymentStatus,
            mode,
            email,
          });

          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          console.log("✅ invoice.payment_succeeded", {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            subscriptionId: invoice.subscription,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
          });

          // TODO: Implement invoice payment handling, e.g.:
          // - Update subscription status
          // - Extend user access/entitlement
          // - Persist payment records

          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`ℹ️ undefined`, {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
          });

          // TODO: Implement subscription lifecycle handling

          break;
        }

        default: {
          // For unhandled event types, log them for visibility
          console.log(`Unhandled Stripe event type: undefined`);
        }
      }

      res.json({ received: true });
    } catch (processingError) {
      console.error(
        "⚠️  Error while processing Stripe webhook event:",
        processingError,
      );
      res.status(500).send("Internal Server Error");
    }
  },
);

export default webhookRouter;