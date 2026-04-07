import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const router: Router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

interface CheckoutItem {
  priceId?: string;
  name?: string;
  currency?: string;
  amount?: number;
  quantity: number;
}

interface CreateCheckoutSessionBody {
  mode?: "payment" | "subscription";
  lineItems: CheckoutItem[];
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  usePaymentIntent?: boolean;
}

const DEFAULT_SUCCESS_URL = process.env.CHECKOUT_SUCCESS_URL || "http://localhost:3000/checkout/success";
const DEFAULT_CANCEL_URL = process.env.CHECKOUT_CANCEL_URL || "http://localhost:3000/checkout/cancel";

router.post(
  "/session",
  async (req: Request<unknown, unknown, CreateCheckoutSessionBody>, res: Response, next: NextFunction) => {
    try {
      const {
        mode = "payment",
        lineItems,
        customerEmail,
        successUrl,
        cancelUrl,
        metadata,
        usePaymentIntent,
      } = req.body || {};

      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: "lineItems is required and must be a non-empty array" });
      }

      if (usePaymentIntent) {
        const totalAmount = lineItems.reduce((sum, item) => {
          if (typeof item.amount !== "number" || !item.currency) {
            throw new Error("Each item must include amount (number) and currency when using PaymentIntent");
          }
          const lineTotal = item.amount * item.quantity;
          return sum + lineTotal;
        }, 0);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmount,
          currency: lineItems[0].currency as string,
          receipt_email: customerEmail,
          metadata,
          automatic_payment_methods: {
            enabled: true,
          },
        });

        return res.status(201).json({
          type: "payment_intent",
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      }

      const transformedLineItems = lineItems.map((item) => {
        if (item.priceId) {
          return {
            price: item.priceId,
            quantity: item.quantity,
          };
        }
        if (!item.name || !item.currency || typeof item.amount !== "number") {
          throw new Error("Custom items require name, currency, and amount");
        }
        return {
          price_data: {
            currency: item.currency,
            product_data: {
              name: item.name,
            },
            unit_amount: item.amount,
          },
          quantity: item.quantity,
        };
      });

      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: transformedLineItems,
        success_url: successUrl || `undefined?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || DEFAULT_CANCEL_URL,
        customer_email: customerEmail,
        metadata,
        payment_intent_data: metadata ? { metadata } : undefined,
      });

      return res.status(201).json({
        type: "checkout_session",
        sessionId: session.id,
        url: session.url,
      });
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ error: err.message });
      }
      return next(err);
    }
  }
);

router.get("/success", (req: Request, res: Response) => {
  const { session_id } = req.query;

  res.status(200).json({
    status: "success",
    message: "Payment completed successfully",
    sessionId: session_id,
  });
});

router.get("/cancel", (req: Request, res: Response) => {
  res.status(200).json({
    status: "canceled",
    message: "Payment was canceled or not completed",
  });
});

export default router;