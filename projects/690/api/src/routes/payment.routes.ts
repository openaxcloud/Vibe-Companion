import { Router, Request, Response, NextFunction } from "express";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const router = Router();

interface CreatePaymentIntentBody {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
  automatic_payment_methods?: {
    enabled: boolean;
  };
}

interface CreateCheckoutSessionBody {
  lineItems: {
    price?: string;
    quantity?: number;
    amount?: number;
    currency?: string;
    name?: string;
    description?: string;
  }[];
  mode?: Stripe.Checkout.SessionCreateParams.Mode;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };

router.post(
  "/payment-intent",
  asyncHandler(async (req: Request<unknown, unknown, CreatePaymentIntentBody>, res: Response) => {
    const { amount, currency = "usd", metadata, automatic_payment_methods } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "Invalid or missing amount" });
      return;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: automatic_payment_methods?.enabled ?? true,
        },
      });

      res.status(201).json({
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  })
);

router.post(
  "/checkout-session",
  asyncHandler(
    async (req: Request<unknown, unknown, CreateCheckoutSessionBody>, res: Response) => {
      const {
        lineItems,
        mode = "payment",
        successUrl,
        cancelUrl,
        customerEmail,
        metadata,
      } = req.body;

      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(400).json({ error: "lineItems must be a non-empty array" });
        return;
      }

      if (!successUrl || !cancelUrl) {
        res.status(400).json({ error: "successUrl and cancelUrl are required" });
        return;
      }

      try {
        const sessionLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
          lineItems.map((item) => {
            if (item.price) {
              return {
                price: item.price,
                quantity: item.quantity ?? 1,
              };
            }

            if (!item.amount || !item.currency || !item.name) {
              throw new Error(
                "Each line item must have either a price ID or amount, currency, and name"
              );
            }

            return {
              price_data: {
                currency: item.currency,
                unit_amount: Math.round(item.amount),
                product_data: {
                  name: item.name,
                  description: item.description,
                },
              },
              quantity: item.quantity ?? 1,
            };
          });

        const session = await stripe.checkout.sessions.create({
          mode,
          line_items: sessionLineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: customerEmail,
          metadata,
        });

        res.status(201).json({
          id: session.id,
          url: session.url,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating checkout session:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
      }
    }
  )
);

export default router;