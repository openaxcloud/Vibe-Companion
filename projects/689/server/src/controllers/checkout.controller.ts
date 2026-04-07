import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const clientBaseUrl = process.env.CLIENT_BASE_URL || "http://localhost:3000";

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia",
});

interface StartCheckoutRequestBody {
  priceId: string;
  quantity?: number;
  metadata?: Record<string, string>;
  mode?: "payment" | "subscription";
  successPath?: string;
  cancelPath?: string;
  customerEmail?: string;
}

export const startCheckout = async (
  req: Request<unknown, unknown, StartCheckoutRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      priceId,
      quantity = 1,
      metadata = {},
      mode = "payment",
      successPath = "/checkout/success",
      cancelPath = "/checkout/cancel",
      customerEmail,
    } = req.body || {};

    if (!priceId || typeof priceId !== "string") {
      res.status(400).json({ error: "Missing or invalid 'priceId'." });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: "Quantity must be a positive integer." });
      return;
    }

    const successUrl = new URL(successPath, clientBaseUrl).toString();
    const cancelUrl = new URL(cancelPath, clientBaseUrl).toString();

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      metadata,
      success_url: successUrl + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      automatic_tax: { enabled: true },
    });

    res.status(201).json({
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error creating checkout session:", error);
    next(error);
  }
};

export const getCheckoutSuccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Missing or invalid 'session_id' query parameter." });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "subscription"],
    });

    res.status(200).json({
      status: "success",
      session,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching checkout success session:", error);
    next(error);
  }
};

export const getCheckoutCancel = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({
    status: "canceled",
    message: "Checkout was canceled by the user.",
  });
};

export default {
  startCheckout,
  getCheckoutSuccess,
  getCheckoutCancel,
};