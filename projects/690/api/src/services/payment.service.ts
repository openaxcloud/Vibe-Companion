import Stripe from 'stripe';
import { Logger } from '../utils/logger';
import { PaymentRepository } from '../repositories/payment.repository';
import { Payment, PaymentStatus, Currency } from '../types/payment.types';
import { Config } from '../config';

export interface CreateCheckoutSessionInput {
  amount: number;
  currency: Currency;
  customerId?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  id: string;
  url: string | null;
}

export interface CreatePaymentIntentInput {
  amount: number;
  currency: Currency;
  customerId?: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
  captureMethod?: Stripe.PaymentIntentCreateParams.CaptureMethod;
}

export interface CreatePaymentIntentResult {
  id: string;
  clientSecret: string | null;
  status: Stripe.PaymentIntent.Status;
}

export interface HandleWebhookResult {
  ok: boolean;
}

export class PaymentService {
  private stripe: Stripe;
  private logger: Logger;
  private paymentRepository: PaymentRepository;
  private readonly webhookSecret: string | undefined;

  constructor(
    paymentRepository: PaymentRepository,
    logger: Logger = new Logger('PaymentService')
  ) {
    if (!Config.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key is not configured');
    }

    this.stripe = new Stripe(Config.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    this.logger = logger;
    this.paymentRepository = paymentRepository;
    this.webhookSecret = Config.STRIPE_WEBHOOK_SECRET;
  }

  public async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    const { amount, currency, customerId, metadata, successUrl, cancelUrl } =
      input;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const amountInMinorUnit = this.toMinorUnit(amount, currency);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: metadata?.description || 'Payment',
            },
            unit_amount: amountInMinorUnit,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    await this.paymentRepository.create(<Payment>{
      provider: 'stripe',
      providerPaymentId: session.id,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      raw: session,
      clientSecret: null,
      type: 'checkout_session',
      customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.info('Created Stripe checkout session', {
      sessionId: session.id,
      amount,
      currency,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  public async createPaymentIntent(
    input: CreatePaymentIntentInput
  ): Promise<CreatePaymentIntentResult> {
    const {
      amount,
      currency,
      customerId,
      metadata,
      paymentMethodTypes = ['card'],
      captureMethod,
    } = input;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const amountInMinorUnit = this.toMinorUnit(amount, currency);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency,
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      metadata,
      capture_method: captureMethod,
    });

    await this.paymentRepository.create(<Payment>{
      provider: 'stripe',
      providerPaymentId: paymentIntent.id,
      amount,
      currency,
      status: this.mapStripeStatusToInternal(paymentIntent.status),
      raw: paymentIntent,
      clientSecret: paymentIntent.client_secret,
      type: 'payment_intent',
      customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.info('Created Stripe payment intent', {
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      status: paymentIntent.status,
    });

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    };
  }

  public async capturePaymentIntent(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.capture(
      paymentIntentId
    );

    await this.paymentRepository.updateByProviderPaymentId(
      paymentIntent.id,
      {
        status: this.mapStripeStatusToInternal(paymentIntent.status),
        raw: paymentIntent,
        updatedAt: new Date(),
      }
    );

    this.logger.info('Captured Stripe payment intent', {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return paymentIntent;
  }

  public async cancelPaymentIntent(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.cancel(
      paymentIntentId
    );

    await this.paymentRepository.updateByProviderPaymentId(
      paymentIntent.id,
      {
        status: this.mapStripeStatusToInternal(paymentIntent.status),
        raw: paymentIntent,
        updatedAt: new Date(),
      }
    );

    this.logger.info('Cancelled Stripe payment intent', {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return paymentIntent;
  }

  public async handleWebhook(
    rawBody: Buffer | string,
    signature: string | string[] | undefined
  ): Promise<HandleWebhookResult> {
    if (!this.webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!sig) {
        throw new Error('Missing Stripe-Signature header');
      }

      event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        this.webhookSecret
      );
    } catch (err) {
      this.logger.error('Stripe webhook signature verification failed', {
        error: (err as Error).message,
      });
      throw err;
    }

    this.logger.info('Received Stripe webhook event', {
      id: event.id,
      type: event.type,
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
      case 'payment_intent.processing':
      case 'payment_intent.requires_action':
        await this.handlePaymentIntentEvent(event);
        break;

      case 'checkout.session.completed':
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
        await this.handleCheckoutSessionEvent(event);
        break;

      default:
        this.logger.debug('Unhandled Stripe event type', {
          type: event.type,
        });
    }

    return { ok: true };
  }

  private async handlePaymentIntentEvent(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    const internalStatus = this.mapStripeStatusToInternal(
      paymentIntent.status
    );

    await this.paymentRepository.updateByProviderPaymentId(
      paymentIntent.id,
      {
        status: internalStatus,
        raw: paymentIntent,
        updatedAt: new Date(),
      }
    );

    this.logger.info('Handled Stripe payment intent webhook', {
      paymentIntentId: paymentIntent.id,
      stripeStatus: paymentIntent.status,
      internalStatus,
    });
  }

  private async handleCheckoutSessionEvent(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    let status: PaymentStatus = PaymentStatus.PENDING;

    switch (event.type) {
      case 'checkout.session.completed':
        status = PaymentStatus.SUCCEEDED;
        break;
      case 'checkout.session.async_payment_succeeded':
        status = PaymentStatus.SUCCEEDED;
        break;
      case 'checkout.session.async_payment_failed':
        status = PaymentStatus.FAILED;
        break;
      case 'checkout.session.expired':
        status = PaymentStatus.CANCELED;
        break;
      default:
        status = PaymentStatus.PENDING;
    }

    await this.paymentRepository.updateByProviderPaymentId(session.id, {
      status,
      raw: session,
      updatedAt: new Date(),
    });

    this.logger.info('Handled Stripe checkout session webhook', {
      sessionId: session.id,
      eventType: event.type,
      status,
    });
  }

  private mapStripeStatusToInternal(
    stripeStatus: Stripe.PaymentIntent.Status
  ): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'processing':
        return PaymentStatus.PENDING;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return PaymentStatus.REQUIRES_ACTION;
      case 'canceled':
        return PaymentStatus.CANCELED;
      default:
        return PaymentStatus.PENDING