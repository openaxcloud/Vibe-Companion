import Stripe from 'stripe';
import { Request } from 'express';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-01-27.acacia';

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Stripe.MetadataParam;
  customerId?: string;
  receiptEmail?: string;
  description?: string;
  paymentMethodTypes?: string[];
}

export interface StripeWebhookVerificationResult {
  event: Stripe.Event;
  signatureVerified: boolean;
}

class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    this.stripe = new Stripe(STRIPE_SECRET_KEY as string, {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public async createPaymentIntent(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
    const {
      amount,
      currency,
      metadata,
      customerId,
      receiptEmail,
      description,
      paymentMethodTypes,
    } = params;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Payment intent amount must be a positive integer representing the smallest currency unit');
    }

    if (!currency) {
      throw new Error('Payment intent currency is required');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      customer: customerId,
      receipt_email: receiptEmail,
      description,
      payment_method_types: paymentMethodTypes ?? ['card'],
      automatic_payment_methods: paymentMethodTypes ? undefined : { enabled: true },
    });

    return paymentIntent;
  }

  public async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!paymentIntentId) {
      throw new Error('Payment intent ID is required');
    }

    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  public verifyWebhookSignature(rawBody: Buffer | string, signature: string): StripeWebhookVerificationResult {
    if (!signature) {
      throw new Error('Stripe-Signature header is missing');
    }

    const bodyAsBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;

    try {
      const event = this.stripe.webhooks.constructEvent(
        bodyAsBuffer,
        signature,
        STRIPE_WEBHOOK_SECRET as string
      );

      return {
        event,
        signatureVerified: true,
      };
    } catch (error) {
      throw new Error(`Invalid Stripe webhook signature: undefined`);
    }
  }

  public extractRawBodyFromRequest(req: Request): Buffer {
    const anyReq = req as Request & { rawBody?: Buffer };
    if (anyReq.rawBody && Buffer.isBuffer(anyReq.rawBody)) {
      return anyReq.rawBody;
    }

    if (req.body && typeof req.body === 'string') {
      return Buffer.from(req.body, 'utf8');
    }

    if (req.body && Buffer.isBuffer(req.body)) {
      return req.body;
    }

    throw new Error('Raw body not available on request for Stripe webhook verification');
  }

  public getClient(): Stripe {
    return this.stripe;
  }
}

export const stripeService = StripeService.getInstance();
export default stripeService;