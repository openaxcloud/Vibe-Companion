import Stripe from 'stripe';
import { Logger } from '../utils/logger';

export type Currency = 'usd' | 'eur' | 'gbp';

export interface PaymentMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: Currency;
  customerId?: string;
  description?: string;
  receiptEmail?: string;
  metadata?: PaymentMetadata;
  paymentMethodId?: string;
  captureMethod?: 'automatic' | 'manual';
}

export interface ConfirmPaymentParams {
  paymentIntentId: string;
  paymentMethodId?: string;
  receiptEmail?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  status: Stripe.PaymentIntent.Status;
  amount: number;
  currency: string;
  requiresAction: boolean;
  nextAction?: Stripe.PaymentIntent.NextAction | null;
  raw: Stripe.PaymentIntent;
}

export interface PaymentServiceConfig {
  apiKey: string;
  apiVersion?: Stripe.LatestApiVersion;
}

export interface PaymentService {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntentResult>;
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>;
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>;
}

class StripePaymentService implements PaymentService {
  private stripe: Stripe;
  private logger: Logger;

  constructor(config: PaymentServiceConfig, logger?: Logger) {
    if (!config.apiKey) {
      throw new Error('Stripe API key is required for payment service initialization');
    }

    this.stripe = new Stripe(config.apiKey, {
      apiVersion: config.apiVersion ?? '2024-06-20',
    });

    this.logger = logger ?? new Logger('StripePaymentService');
  }

  public async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    try {
      const {
        amount,
        currency,
        customerId,
        description,
        receiptEmail,
        metadata,
        paymentMethodId,
        captureMethod = 'automatic',
      } = params;

      const normalizedMetadata = this.normalizeMetadata(metadata);

      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        description,
        receipt_email: receiptEmail,
        capture_method: captureMethod,
        metadata: normalizedMetadata,
        automatic_payment_methods: !paymentMethodId
          ? { enabled: true, allow_redirects: 'always' }
          : undefined,
      });

      return this.mapPaymentIntent(intent);
    } catch (error) {
      this.handleStripeError(error, 'createPaymentIntent');
    }
  }

  public async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntentResult> {
    try {
      const { paymentIntentId, paymentMethodId, receiptEmail, metadata } = params;

      const normalizedMetadata = this.normalizeMetadata(metadata);

      const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
        receipt_email: receiptEmail,
        metadata: normalizedMetadata,
      });

      return this.mapPaymentIntent(intent);
    } catch (error) {
      this.handleStripeError(error, 'confirmPayment');
    }
  }

  public async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return this.mapPaymentIntent(intent);
    } catch (error) {
      this.handleStripeError(error, 'retrievePaymentIntent');
    }
  }

  public async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    try {
      const intent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      return this.mapPaymentIntent(intent);
    } catch (error) {
      this.handleStripeError(error, 'cancelPaymentIntent');
    }
  }

  private mapPaymentIntent(intent: Stripe.PaymentIntent): PaymentIntentResult {
    return {
      id: intent.id,
      clientSecret: intent.client_secret ?? null,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      requiresAction:
        intent.status === 'requires_action' ||
        intent.status === 'requires_source_action' ||
        intent.next_action != null,
      nextAction: intent.next_action,
      raw: intent,
    };
  }

  private normalizeMetadata(metadata?: PaymentMetadata): Record<string, string> | undefined {
    if (!metadata) return undefined;

    const normalized: Record<string, string> = {};

    Object.entries(metadata).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      normalized[key] = String(value);
    });

    return normalized;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleStripeError(error: any, operation: string): never {
    this.logger.error(`Stripe error during undefined`, {
      error,
      type: error?.type,
      code: error?.code,
      message: error?.message,
    });

    if (error && typeof error === 'object' && 'raw' in error && error.raw) {
      const raw = (error as Stripe.errors.StripeError).raw;
      const err: Error & { statusCode?: number; code?: string } = new Error(raw.message || 'Payment processing failed');
      err.code = raw.code;
      err.statusCode = raw.statusCode;
      throw err;
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unknown payment processing error');
  }
}

let defaultPaymentService: PaymentService | null = null;

export function initPaymentService(config: PaymentServiceConfig, logger?: Logger): PaymentService {
  defaultPaymentService = new StripePaymentService(config, logger);
  return defaultPaymentService;
}

export function getPaymentService(): PaymentService {
  if (!defaultPaymentService) {
    throw new Error('PaymentService has not been initialized. Call initPaymentService first.');
  }
  return defaultPaymentService;
}

export { StripePaymentService };