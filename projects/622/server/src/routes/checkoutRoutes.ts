import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import { body, validationResult } from "express-validator";
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

const router: Router = express.Router();

// Types
interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // in smallest currency unit (e.g. cents)
  currency: string;
}

interface CreatePaymentIntentBody {
  cartItems: CartItem[];
  customerEmail?: string;
  metadata?: Record<string, string>;
}

interface ConfirmOrderBody {
  paymentIntentId: string;
}

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

// Utility to calculate total from cart items
const calculateOrderAmount = (items: CartItem[]): number => {
  return items.reduce((total, item) => {
    if (item.quantity <= 0 || item.unitPrice < 0) {
      return total;
    }
    return total + item.quantity * item.unitPrice;
  }, 0);
};

// Placeholder function to finalize order in your system
const finalizeOrderInSystem = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  // Implement your own logic here:
  // - Create Order record in DB
  // - Decrement inventory
  // - Send confirmation email
  // You can use paymentIntent.metadata and paymentIntent.charges data
  return;
};

// Middleware for handling validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "Validation error",
      details: errors.array(),
    });
    return;
  }
  next();
};

// POST /checkout/create-payment-intent
router.post(
  "/create-payment-intent",
  [
    body("cartItems").isArray({ min: 1 }).withMessage("cartItems must be a non-empty array"),
    body("cartItems.*.id").isString().withMessage("Each item must have an id"),
    body("cartItems.*.name").isString().withMessage("Each item must have a name"),
    body("cartItems.*.quantity").isInt({ min: 1 }).withMessage("Each item must have quantity >= 1"),
    body("cartItems.*.unitPrice").isInt({ min: 0 }).withMessage("Each item must have unitPrice >= 0"),
    body("cartItems.*.currency").isString().withMessage("Each item must have a currency"),
    body("customerEmail").optional().isEmail().withMessage("customerEmail must be a valid email"),
    body("metadata").optional().isObject().withMessage("metadata must be an object"),
  ],
  handleValidationErrors,
  async (req: Request<unknown, unknown, CreatePaymentIntentBody>, res: Response): Promise<void> => {
    try {
      const { cartItems, customerEmail, metadata } = req.body;

      const currency = cartItems[0].currency.toLowerCase();
      const amount = calculateOrderAmount(cartItems);

      if (amount <= 0) {
        res.status(400).json({ error: "Invalid cart amount" });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        receipt_email: customerEmail,
        metadata: {
          ...metadata,
          cart: JSON.stringify(
            cartItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          ),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.status(201).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to create payment intent",
        details: err.message,
      });
    }
  },
);

// GET /checkout/payment-intent/:id/client-secret
router.get(
  "/payment-intent/:id/client-secret",
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const paymentIntent = await stripe.paymentIntents.retrieve(id);

      if (!paymentIntent || paymentIntent.deleted) {
        res.status(404).json({ error: "PaymentIntent not found" });
        return;
      }

      if (!paymentIntent.client_secret) {
        res.status(400).json({ error: "Client secret not available for this PaymentIntent" });
        return;
      }

      res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to retrieve payment intent",
        details: err.message,
      });
    }
  },
);

// POST /checkout/confirm-order
// Optional endpoint if you want to finalize order from frontend after payment success
router.post(
  "/confirm-order",
  [body("paymentIntentId").isString().withMessage("paymentIntentId is required")],
  handleValidationErrors,
  async (req: Request<unknown, unknown, ConfirmOrderBody>, res: Response): Promise<void> => {
    try {
      const { paymentIntentId } = req.body;
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        res.status(400).json({
          error: "Payment not completed",
          status: paymentIntent.status,
        });
        return;
      }

      await finalizeOrderInSystem(paymentIntent);

      res.status(200).json({
        message: "Order finalized successfully",
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to confirm order",
        details: err.message,
      });
    }
  },
);

// POST /checkout/webhook
// Note: The main app should configure this route to receive the raw body, not parsed JSON,
// e.g. app.post('/checkout/webhook', express.raw({ type: 'application/json' }), checkoutRoutes);
router.post(
  "/webhook",
  async (req: StripeWebhookRequest, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];

    if (!sig || Array.isArray(sig)) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    let event: Stripe.Event;

    try {
      if (!req.rawBody) {
        res.status(400).send("Missing raw body for Stripe webhook");
        return;
      }

      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret);
    } catch (err: unknown) {
      const error = err as Error;
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await finalizeOrderInSystem(paymentIntent);
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Optionally update order or notify customer about failure
          // Access paymentIntent.last_payment_error for more info
          break;
        }
        case "charge.refunded": {
          // Handle refunds if needed
          break;
        }
        default:
          break;
      }

      res.json({ received: true });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to process webhook",
        details: err.message,
      });
    }
  },
);

export default router;