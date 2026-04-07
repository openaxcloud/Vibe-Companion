import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2024-06-20";

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY in environment variables.");
}

if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET in environment variables.");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
});

export type Currency = "usd" | "eur" | "gbp" | "cad" | "aud";

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: Currency;
  customerId?: string;
  description?: string;
  metadata?: Stripe.MetadataParam;
  paymentMethodTypes?: string[];
  receiptEmail?: string;
}

export interface CreatePaymentIntentResult {
  clientSecret: string | null;
  paymentIntentId: string;
}

export interface StripeErrorPayload {
  type: string;
  message: string;
  code?: string;
  param?: string | string[];
  declineCode?: string;
  docUrl?: string;
  requestId?: string;
  statusCode?: number;
  rawType?: string;
}

export type WebhookEvent = Stripe.Event;

export const DEFAULT_CURRENCY: Currency = "usd";

export function mapStripeError(error: unknown): StripeErrorPayload {
  if (error instanceof Stripe.errors.StripeError) {
    return {
      type: error.type,
      message: error.message,
      code: error.code,
      param: error.param as string | string[] | undefined,
      declineCode: (error as Stripe.errors.StripeCardError).decline_code,
      docUrl: error.doc_url,
      requestId: error.requestId,
      statusCode: error.statusCode,
      rawType: (error.raw as Stripe.StripeRawError | undefined)?.type,
    };
  }

  if (error instanceof Error) {
    return {
      type: "internal_error",
      message: error.message,
    };
  }

  return {
    type: "unknown_error",
    message: "An unknown error occurred while communicating with Stripe.",
  };
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  const {
    amount,
    currency = DEFAULT_CURRENCY,
    customerId,
    description,
    metadata,
    paymentMethodTypes,
    receiptEmail,
  } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer representing the smallest currency unit (e.g., cents).");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      description,
      metadata,
      payment_method_types: paymentMethodTypes,
      receipt_email: receiptEmail,
      automatic_payment_methods: paymentMethodTypes
        ? undefined
        : { enabled: true },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (err) {
    throw mapStripeError(err);
  }
}

export function constructWebhookEvent(
  payload: Buffer | string,
  signatureHeader: string | string[] | undefined
): WebhookEvent {
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header.");
  }

  const sig = Array.isArray(signatureHeader)
    ? signatureHeader.join(",")
    : signatureHeader;

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      sig,
      STRIPE_WEBHOOK_SECRET
    );

    return event as WebhookEvent;
  } catch (err) {
    throw mapStripeError(err);
  }
}

export function parseWebhookEvent<T extends Stripe.Event["type"]>(
  event: Stripe.Event & { type: T }
): Stripe.Event & { type: T } {
  return event;
}

export function isPaymentIntentSucceededEvent(
  event: WebhookEvent
): event is Stripe.Event & { type: "payment_intent.succeeded" } {
  return event.type === "payment_intent.succeeded";
}

export function isPaymentIntentFailedEvent(
  event: WebhookEvent
): event is Stripe.Event & { type: "payment_intent.payment_failed" } {
  return event.type === "payment_intent.payment_failed";
}

export function getPaymentIntentFromEvent(
  event: WebhookEvent
): Stripe.PaymentIntent | null {
  if (!event.data || !event.data.object) {
    return null;
  }

  const dataObject = event.data.object as Stripe.PaymentIntent;
  if (dataObject.object === "payment_intent") {
    return dataObject;
  }

  return null;
}

export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    throw mapStripeError(err);
  }
}

export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (err) {
    throw mapStripeError(err);
  }
}

export async function refundPaymentIntent(
  paymentIntentId: string,
  amount?: number,
  metadata?: Stripe.MetadataParam
): Promise<Stripe.Refund> {
  try {
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      metadata,
    };

    if (typeof amount === "number") {
      params.amount = amount;
    }

    return await stripe.refunds.create(params);
  } catch (err) {
    throw mapStripeError(err);
  }
}

export function isStripeError(
  error: unknown
): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

export function getPublicStripeConfig() {
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  };
}