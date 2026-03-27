import { getStripeSync } from "./stripeClient";
import { storage } from "./storage";
import { log } from "./index";

interface WebhookEvent {
  type: string;
  data: {
    object: {
      customer?: string | { id: string };
      id?: string;
      mode?: string;
      metadata?: Record<string, string>;
      line_items?: { data?: Array<{ price?: { product?: string } }> };
    };
  };
}

async function deriveOneTimePlanFromCheckout(customerId: string, checkoutPriceId: string | undefined, db: { execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }, sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown): Promise<string> {
  if (checkoutPriceId) {
    const result = await db.execute(
      sql`SELECT p.metadata->>'plan' as plan
          FROM stripe.prices pr
          JOIN stripe.products p ON p.id = pr.product
          WHERE pr.id = ${checkoutPriceId}`
    );
    if (result.rows.length > 0) {
      return (result.rows[0] as { plan: string | null }).plan || "pro";
    }
  }
  return "pro";
}

async function reconcileUserPlan(customerId: string, eventContext?: { eventType: string; checkoutMode?: string; checkoutPriceId?: string }): Promise<void> {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const custResult = await db.execute(
      sql`SELECT metadata FROM stripe.customers WHERE id = ${customerId}`
    );
    if (custResult.rows.length === 0) return;
    const customerMeta = (custResult.rows[0] as { metadata: Record<string, string> | null }).metadata;
    const userId = customerMeta?.userId || null;
    if (!userId) return;

    const user = await storage.getUser(userId);
    if (!user) return;

    const subResult = await db.execute(
      sql`SELECT s.id, s.status, p.metadata as product_metadata
          FROM stripe.subscriptions s
          JOIN stripe.subscription_items si ON si.subscription = s.id
          JOIN stripe.prices pr ON pr.id = si.price
          JOIN stripe.products p ON p.id = pr.product
          WHERE s.customer = ${customerId}
          AND s.status IN ('active', 'trialing')
          ORDER BY s.created DESC LIMIT 1`
    );

    if (subResult.rows.length > 0) {
      const sub = subResult.rows[0] as { id: string; status: string; product_metadata: Record<string, string> | null };
      const planKey = sub.product_metadata?.plan || "pro";
      await storage.updateUserPlan(userId, planKey, customerId, sub.id);
      log(`Reconciled user ${userId}: plan=${planKey}, subscription=${sub.id}`, "stripe");
    } else if (eventContext?.eventType === "checkout.session.completed" && eventContext.checkoutMode === "payment") {
      const planKey = await deriveOneTimePlanFromCheckout(customerId, eventContext.checkoutPriceId, db as any, sql);
      await storage.updateUserPlan(userId, planKey, customerId, null);
      log(`Reconciled user ${userId}: plan=${planKey} (one-time payment)`, "stripe");
    } else if (eventContext?.eventType === "customer.subscription.deleted" || eventContext?.eventType === "invoice.payment_failed") {
      await storage.updateUserPlan(userId, "free", customerId, null);
      log(`Reconciled user ${userId}: plan=free (no active subscription)`, "stripe");
    } else {
      log(`Reconciled user ${userId}: no subscription change detected for ${eventContext?.eventType}`, "stripe");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to reconcile plan for customer ${customerId}: ${message}`, "stripe");
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "This usually means express.json() parsed the body before reaching this handler. " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    const event = JSON.parse(payload.toString()) as WebhookEvent;
    const eventType = event.type;
    const obj = event.data.object;

    const reconcileEvents = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ];

    if (reconcileEvents.includes(eventType) && obj.customer) {
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer.id;
      await reconcileUserPlan(customerId, {
        eventType,
        checkoutMode: obj.mode,
        checkoutPriceId: obj.metadata?.priceId,
      });
    }
  }
}
