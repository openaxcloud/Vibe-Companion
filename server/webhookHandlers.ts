export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.warn("[webhook] Stripe not configured, ignoring webhook");
      return;
    }

    try {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(stripeKey);
      const event = stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);

      switch (event.type) {
        case "checkout.session.completed":
          console.log("[webhook] Checkout session completed:", event.data.object.id);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          console.log(`[webhook] Subscription ${event.type}:`, event.data.object.id);
          break;
        case "invoice.paid":
        case "invoice.payment_failed":
          console.log(`[webhook] Invoice ${event.type}:`, event.data.object.id);
          break;
        default:
          console.log(`[webhook] Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      console.error("[webhook] Error processing webhook:", err?.message || err);
      throw err;
    }
  }
}
