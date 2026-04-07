import Stripe from 'stripe';
import { Request } from 'express';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export interface CreatePaymentIntentParams {
  amount: number; // amount in smallest currency unit (e.g., cents)
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Stripe.MetadataParam;
  paymentMethodTypes?: string[];
  receiptEmail?: string;
}

export interface CreatePaymentIntentResult {
  clientSecret: string | null;
  paymentIntent: Stripe.PaymentIntent;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  const {
    amount,
    currency,
    customerId,
    description,
    metadata,
    paymentMethodTypes,
    receiptEmail,
  } = params;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount provided for payment intent');
  }

  if (!currency) {
    throw new Error('Currency is required for payment intent');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount),
    currency,
    customer: customerId,
    description,
    metadata,
    payment_method_types: paymentMethodTypes ?? ['card'],
    receipt_email: receiptEmail,
    automatic_payment_methods: paymentMethodTypes
      ? undefined
      : {
          enabled: true,
        },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntent,
  };
}

export interface ValidateWebhookOptions {
  req: Request;
  rawBody: Buffer;
}

export function validateStripeWebhookEvent(
  options: ValidateWebhookOptions
): Stripe.Event {
  const { req, rawBody } = options;
  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    throw new Error('Missing Stripe signature header');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET as string
    );
    return event;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Stripe webhook signature verification failed: undefined`);
    }
    throw new Error('Stripe webhook signature verification failed');
  }
}