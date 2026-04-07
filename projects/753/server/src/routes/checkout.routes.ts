import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables.");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not defined in environment variables.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

const router: Router = express.Router();

interface CreateCheckoutSessionBody {
  mode?: "payment" | "setup" | "subscription";
  amount?: number;
  currency?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  lineItems?: Array<{
    price?: string;
    quantity?: number;
    adjustable_quantity?: {
      enabled: boolean;
      maximum?: number;
      minimum?: number;
    };
  }>;
  paymentMethodTypes?: string[];
  automaticTax?: boolean;
  clientReferenceId?: string;
}

interface CreatePaymentIntentBody {
  amount: number;
  currency?: string;
  customerId?: string;
  receiptEmail?: string;
  description?: string;
  metadata?: Record<string, string>;
  automaticPaymentMethods?: boolean;
}

type CheckoutSessionMode = "session" | "payment_intent";

interface CheckoutRouteBody extends CreateCheckoutSessionBody, CreatePaymentIntentBody {
  type?: CheckoutSessionMode;
}

const jsonParser = express.json();
const rawBodyParser = bodyParser.raw({ type: "application/json" });

router.post(
  "/checkout/session",
  jsonParser,
  async (req: Request<unknown, unknown, CheckoutRouteBody>, res: Response, next: NextFunction) => {
    try {
      const {
        type = "session",
        amount,
        currency = "usd",
        successUrl,
        cancelUrl,
        customerEmail,
        metadata,
        lineItems,
        paymentMethodTypes,
        automaticTax,
        clientReferenceId,
        customerId,
        receiptEmail,
        description,
        automaticPaymentMethods,
      } = req.body;

      if (type === "payment_intent") {
        if (!amount || amount <= 0) {
          return res.status(400).json({ error: "A positive 'amount' (in the smallest currency unit) is required." });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          receipt_email: receiptEmail,
          description,
          metadata,
          automatic_payment_methods: automaticPaymentMethods
            ? { enabled: true }
            : undefined,
        });

        return res.status(200).json({
          type: "payment_intent",
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      }

      const resolvedSuccessUrl =
        successUrl || process.env.STRIPE_CHECKOUT_SUCCESS_URL || "https://example.com/success";
      const resolvedCancelUrl =
        cancelUrl || process.env.STRIPE_CHECKOUT_CANCEL_URL || "https://example.com/cancel";

      const lineItemsPayload =
        lineItems && lineItems.length > 0
          ? lineItems
          : amount
          ? [
              {
                price_data: {
                  currency,
                  product_data: {
                    name: "Order",
                  },
                  unit_amount: amount,
                },
                quantity: 1,
              },
            ]
          : undefined;

      if (!lineItemsPayload) {
        return res.status(400).json({
          error: "Either 'lineItems' or 'amount' must be provided.",
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: paymentMethodTypes || ["card"],
        line_items: lineItemsPayload as any,
        success_url: resolvedSuccessUrl,
        cancel_url: resolvedCancelUrl,
        customer_email: customerEmail,
        metadata,
        automatic_tax: automaticTax ? { enabled: true } : { enabled: false },
        client_reference_id: clientReferenceId,
      });

      return res.status(200).json({
        type: "session",
        id: session.id,
        url: session.url,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error creating checkout session or payment intent:", error);
      return next(error);
    }
  }
);

router.post(
  "/webhook",
  rawBodyParser,
  async (req: Request, res: Response, next: NextFunction) => {
    const sig = req.headers["stripe-signature"] as string | undefined;

    if (!sig) {
      return res.status(400).send("Missing Stripe signature header.");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret as string
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Stripe webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: undefined`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          // Implement your business logic here, such as:
          // - Fulfilling an order
          // - Updating user subscription state
          // - Saving payment status
          // eslint-disable-next-line no-console
          console.log("Checkout session completed:", session.id);
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // eslint-disable-next-line no-console
          console.log("PaymentIntent succeeded:", paymentIntent.id);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // eslint-disable-next-line no-console
          console.warn("PaymentIntent failed:", paymentIntent.id);
          break;
        }

        case "charge.succeeded": {
          const charge = event.data.object as Stripe.Charge;
          // eslint-disable-next-line no-console
          console.log("Charge succeeded:", charge.id);
          break;
        }

        default:
          // eslint-disable-next-line no-console
          console.log(`Unhandled Stripe event type: undefined`);
      }

      res.json({ received: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error handling Stripe webhook event:", err);
      next(err);
    }
  }
);

export default router;