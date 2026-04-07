import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { StockReservationRepository } from '../repositories/stockReservation.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { DatabaseTransactionManager, Transaction } from '../utils/transactionManager';
import { AppError } from '../utils/errors';
import { Config } from '../config';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutSessionInput {
  userId: string;
  items: CheckoutItemInput[];
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  paymentIntentId: string;
  orderId: string;
  clientSecret?: string | null;
}

export interface FinalizePaymentInput {
  paymentIntentId: string;
}

export interface PriceCalculation {
  subtotal: number;
  currency: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
  }>;
}

export class CheckoutService {
  private stripe: Stripe;
  private logger: Logger;
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;
  private stockReservationRepository: StockReservationRepository;
  private paymentRepository: PaymentRepository;
  private txManager: DatabaseTransactionManager;

  constructor(
    config: Config,
    logger: Logger,
    orderRepository: OrderRepository,
    productRepository: ProductRepository,
    stockReservationRepository: StockReservationRepository,
    paymentRepository: PaymentRepository,
    txManager: DatabaseTransactionManager
  ) {
    this.logger = logger.child({ service: 'CheckoutService' });
    this.orderRepository = orderRepository;
    this.productRepository = productRepository;
    this.stockReservationRepository = stockReservationRepository;
    this.paymentRepository = paymentRepository;
    this.txManager = txManager;

    if (!config.stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }

  public async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.validateCheckoutInput(input);

    const correlationId = uuidv4();
    this.logger.info('Creating checkout session', {
      correlationId,
      userId: input.userId,
      itemsCount: input.items.length,
    });

    return this.txManager.withTransaction(async (tx) => {
      const priceCalculation = await this.calculatePrices(input.items, input.currency, tx);

      const order = await this.orderRepository.createOrder(
        {
          userId: input.userId,
          status: 'pending',
          currency: priceCalculation.currency,
          subtotal: priceCalculation.subtotal,
          total: priceCalculation.subtotal,
          items: priceCalculation.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            totalAmount: item.totalAmount,
          })),
          metadata: input.metadata ?? {},
          correlationId,
        },
        tx
      );

      const reservations = await this.reserveStock(input.items, order.id, tx);

      try {
        const paymentIntent = await this.createStripePaymentIntent({
          amount: priceCalculation.subtotal,
          currency: priceCalculation.currency,
          userId: input.userId,
          orderId: order.id,
          metadata: {
            orderId: order.id,
            correlationId,
            ...(input.metadata ?? {}),
          },
        });

        await this.paymentRepository.createPayment(
          {
            orderId: order.id,
            userId: input.userId,
            provider: 'stripe',
            providerPaymentIntentId: paymentIntent.id,
            amount: priceCalculation.subtotal,
            currency: priceCalculation.currency,
            status: this.mapStripeStatus(paymentIntent.status),
            rawResponse: paymentIntent,
          },
          tx
        );

        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          payment_intent: paymentIntent.id,
          customer_email: undefined,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: {
            orderId: order.id,
            correlationId,
            ...(input.metadata ?? {}),
          },
          line_items: await this.buildStripeLineItems(priceCalculation),
        });

        this.logger.info('Checkout session created', {
          correlationId,
          userId: input.userId,
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
          sessionId: session.id,
        });

        return {
          sessionId: session.id,
          paymentIntentId: paymentIntent.id,
          orderId: order.id,
          clientSecret: paymentIntent.client_secret ?? null,
        };
      } catch (err) {
        this.logger.error('Error creating Stripe resources, rolling back stock reservations', {
          correlationId,
          error: (err as Error).message,
        });

        await this.rollbackStockReservations(reservations.map((r) => r.id), tx);
        throw this.wrapStripeError(err);
      }
    });
  }

  public async finalizePayment(input: FinalizePaymentInput): Promise<void> {
    const { paymentIntentId } = input;
    const correlationId = uuidv4();

    this.logger.info('Finalizing payment', { correlationId, paymentIntentId });

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges'],
      });
    } catch (err) {
      throw this.wrapStripeError(err);
    }

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError('PAYMENT_NOT_SUCCEEDED', 'Payment is not in succeeded state', 400, {
        paymentIntentId,
        status: paymentIntent.status,
      });
    }

    const orderId = (paymentIntent.metadata as Record<string, string> | null)?.orderId;
    if (!orderId) {
      throw new AppError('ORDER_ID_MISSING', 'Order ID is missing from payment metadata', 500, {
        paymentIntentId,
      });
    }

    await this.txManager.withTransaction(async (tx) => {
      const order = await this.orderRepository.getOrderById(orderId, tx);
      if (!order) {
        throw new AppError('ORDER_NOT_FOUND', 'Order not found for payment', 404, {
          orderId,
        });
      }

      if (order.status === 'paid') {
        this.logger.info('Order already marked as paid. Skipping.', {
          correlationId,
          orderId,
        });
        return;
      }

      const payment = await this.paymentRepository.getPaymentByProviderIntentId(
        'stripe',
        paymentIntentId,
        tx
      );

      if (!payment) {
        await this.paymentRepository.createPayment(
          {
            orderId,
            userId: order.userId,
            provider: 'stripe',
            providerPaymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: this.mapStripeStatus(paymentIntent.status),
            rawResponse: paymentIntent,
          },
          tx
        );
      } else {
        await this.paymentRepository.updatePaymentStatus(
          payment.id,
          this.mapStripeStatus(paymentIntent.status),
          paymentIntent,
          tx
        );
      }

      await this.orderRepository.updateOrderStatus(orderId, 'paid', tx);
      await this.stockReservationRepository.confirmReservationsForOrder(orderId, tx);

      this.logger.info('Payment finalized and order marked as paid', {
        correlationId,
        orderId,
        paymentIntentId,
      });
    });
  }

  public async handlePaymentFailed(paymentIntentId: string): Promise<void> {
    const correlationId = uuidv4();
    this.logger.info('Handling failed payment', { correlationId, paymentIntentId });

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      throw this.wrapStripeError(err);
    }

    const orderId = (paymentIntent.metadata as Record<string, string> | null)?.orderId;
    if (!orderId) {
      this.logger.warn('No orderId on payment intent for failed payment', {
        correlationId,
        paymentIntentId,
      });
      return;
    }

    await this.txManager.withTransaction(async (tx) => {
      const order = await this.orderRepository.getOrderById(orderId, tx);
      if (!order) {
        this.logger.warn('Order not found when handling failed payment', {
          correlationId,
          orderId,
        });
        return;
      }

      if (order.status === 'paid') {
        this.logger.info('Order already paid. Not marking as failed.', {
          correlationId,
          orderId,
        });
        return;
      }

      const payment = await this.paymentRepository.getPaymentByProviderIntentId(
        'stripe',
        paymentIntentId,
        tx
      );

      if (payment) {
        await this.paymentRepository.updatePaymentStatus(
          payment.id,
          this.mapStripeStatus(paymentIntent.status),
          paymentIntent,
          tx
        );
      }

      await this.orderRepository.updateOrderStatus(orderId, 'failed', tx);