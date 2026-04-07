import { Request, Response } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

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

export const stripeWebhookController = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig || typeof sig !== "string") {
    res.status(400).send("Missing Stripe signature");
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed:", err?.message || err);
    res.status(400).send(`Webhook Error: undefined`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(event.type, subscription);
        break;
      }
      default: {
        console.log(`Unhandled Stripe event type: undefined`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    res.status(500).send("Error processing webhook");
  }
};

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const customerId = session.customer as string | null;
    const subscriptionId = session.subscription as string | null;
    const clientReferenceId = session.client_reference_id ?? null;
    const metadata = session.metadata ?? {};

    console.log("Checkout session completed:", {
      id: session.id,
      customerId,
      subscriptionId,
      clientReferenceId,
      metadata,
      paymentStatus: session.payment_status,
      mode: session.mode,
    });

    // TODO: Implement application-specific logic here
    // Example:
    // - Mark order as paid
    // - Activate subscription in your DB
    // - Send confirmation email

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log("Retrieved subscription for session:", subscription.id);
      // TODO: Sync subscription details to your database
    }
  } catch (error) {
    console.error("Error handling checkout.session.completed:", error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  try {
    const customerId = invoice.customer as string | null;
    const subscriptionId = invoice.subscription as string | null;

    console.log("Invoice payment succeeded:", {
      id: invoice.id,
      customerId,
      subscriptionId,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    });

    // TODO: Implement application-specific logic here
    // Example:
    // - Extend subscription access
    // - Record successful payment in your DB
  } catch (error) {
    console.error("Error handling invoice.payment_succeeded:", error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    const customerId = invoice.customer as string | null;
    const subscriptionId = invoice.subscription as string | null;

    console.log("Invoice payment failed:", {
      id: invoice.id,
      customerId,
      subscriptionId,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
    });

    // TODO: Implement application-specific logic here
    // Example:
    // - Notify user of failed payment
    // - Schedule retry logic
    // - Flag account for review
  } catch (error) {
    console.error("Error handling invoice.payment_failed:", error);
    throw error;
  }
}

async function handleSubscriptionEvent(
  eventType: string,
  subscription: Stripe.Subscription
): Promise<void> {
  try {
    const customerId = subscription.customer as string | Stripe.Customer | null;

    console.log(`Subscription event (undefined):`, {
      id: subscription.id,
      status: subscription.status,
      customerId: typeof customerId === "string" ? customerId : (customerId as Stripe.Customer | null)?.id,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // TODO: Implement application-specific logic here
    // Example:
    // - Update subscription status in your DB
    // - Adjust access based on status (active, canceled, etc.)
  } catch (error) {
    console.error(`Error handling subscription event (undefined):`, error);
    throw error;
  }
}

export default {
  stripeWebhookController,
};