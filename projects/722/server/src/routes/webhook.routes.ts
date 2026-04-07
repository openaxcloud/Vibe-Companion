import express, { Request, Response, Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";

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

interface Order {
  id: string;
  status: "pending" | "paid" | "failed";
  paymentIntentId?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

interface InventoryService {
  decrementStock: (items: Order["items"]) => Promise<void>;
  restoreStock: (items: Order["items"]) => Promise<void>;
}

// Placeholder interfaces for dependency functions/services; replace with actual implementations.
interface OrderService {
  getOrderByPaymentIntentId: (paymentIntentId: string) => Promise<Order | null>;
  setOrderStatus: (
    orderId: string,
    status: Order["status"],
    extra?: Partial<Order>
  ) => Promise<void>;
}

const orderService: OrderService = {
  async getOrderByPaymentIntentId(paymentIntentId: string): Promise<Order | null> {
    // TODO: Implement actual DB lookup
    // Example:
    // return prisma.order.findFirst({ where: { paymentIntentId } });
    return null;
  },
  async setOrderStatus(
    orderId: string,
    status: Order["status"],
    extra?: Partial<Order>
  ): Promise<void> {
    // TODO: Implement actual DB update
    // Example:
    // await prisma.order.update({ where: { id: orderId }, data: { status, ...extra } });
    void orderId;
    void status;
    void extra;
  },
};

const inventoryService: InventoryService = {
  async decrementStock(items: Order["items"]): Promise<void> {
    // TODO: Implement actual inventory decrement logic
    void items;
  },
  async restoreStock(items: Order["items"]): Promise<void> {
    // TODO: Implement actual inventory restore logic
    void items;
  },
};

const router: Router = express.Router();

// Stripe webhook must use raw body to validate signatures
router.post(
  "/stripe",
  bodyParser.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];

    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing Stripe signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Stripe webhook signature verification failed:", error.message);
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const paymentIntentId = paymentIntent.id;

          const order = await orderService.getOrderByPaymentIntentId(paymentIntentId);
          if (!order) {
            console.warn("Order not found for payment_intent.succeeded:", paymentIntentId);
            break;
          }

          if (order.status !== "paid") {
            await orderService.setOrderStatus(order.id, "paid");
            await inventoryService.decrementStock(order.items);
          }
          break;
        }
        case "payment_intent.payment_failed":
        case "payment_intent.canceled": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const paymentIntentId = paymentIntent.id;

          const order = await orderService.getOrderByPaymentIntentId(paymentIntentId);
          if (!order) {
            console.warn(
              "Order not found for payment_intent.failed/canceled:",
              paymentIntentId
            );
            break;
          }

          if (order.status !== "failed") {
            await orderService.setOrderStatus(order.id, "failed");
            await inventoryService.restoreStock(order.items);
          }
          break;
        }
        default: {
          console.log(`Unhandled Stripe event type: undefined`);
        }
      }

      res.json({ received: true });
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error handling Stripe webhook:", error.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

export default router;