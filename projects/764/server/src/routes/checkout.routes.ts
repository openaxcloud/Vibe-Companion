import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import { StatusCodes } from "http-status-codes";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

interface CartItem {
  id: string;
  name: string;
  price: number; // in minor units (e.g. cents)
  quantity: number;
}

interface CreateIntentRequestBody {
  cartItems: CartItem[];
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

interface ConfirmIntentRequestBody {
  paymentIntentId: string;
}

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router: Router = express.Router();

function calculateCartTotal(cartItems: CartItem[]): number {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return 0;
  }

  return cartItems.reduce((total, item) => {
    const price = Number.isFinite(item.price) ? item.price : 0;
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
    return total + price * quantity;
  }, 0);
}

// Middleware to handle raw body only for webhook route
// The main server should NOT use bodyParser.json() on this route before this router,
// or it should conditionally skip JSON parsing for /checkout/webhook.
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req: StripeWebhookRequest, res: Response): Promise<void> => {
    if (!stripeWebhookSecret) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Stripe webhook secret is not configured",
      });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || Array.isArray(sig)) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing Stripe signature" });
      return;
    }

    const rawBody = (req as any).body as Buffer;
    try {
      const event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);

      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // TODO: Create order in database, mark as paid, send confirmation email, etc.
          // Example access:
          // paymentIntent.id
          // paymentIntent.amount
          // paymentIntent.metadata
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // TODO: Handle failed payment: notify user, log failure, release reservations, etc.
          void paymentIntent;
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          // TODO: Handle refunds if applicable (update order status, inventory, etc.)
          void charge;
          break;
        }
        default:
          // For other events, you may want to log or handle selectively.
          break;
      }

      res.status(StatusCodes.OK).json({ received: true });
    } catch (err) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Webhook signature verification failed",
      });
    }
  }
);

router.post(
  "/create-intent",
  express.json(),
  async (req: Request<unknown, unknown, CreateIntentRequestBody>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cartItems, currency = "usd", customerId, metadata } = req.body;

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "cartItems must be a non-empty array",
        });
        return;
      }

      const amount = calculateCartTotal(cartItems);

      if (amount <= 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "Cart total must be greater than zero",
        });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          ...(metadata || {}),
          cartItems: JSON.stringify(
            cartItems.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            }))
          ),
        },
      });

      res.status(StatusCodes.OK).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/confirm",
  express.json(),
  async (req: Request<unknown, unknown, ConfirmIntentRequestBody>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "paymentIntentId is required",
        });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

      // Optionally, if you want to ensure order creation here as a backup in case webhook fails:
      if (paymentIntent.status === "succeeded") {
        // TODO: Idempotently create order if not already created by webhook.
        // Example: use paymentIntent.id as idempotency reference.
      }

      res.status(StatusCodes.OK).json({
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;