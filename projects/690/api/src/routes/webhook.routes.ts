import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { Config } from '../config/config';
import { logger } from '../utils/logger';

const router = Router();

const stripe = new Stripe(Config.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const endpointSecret = Config.STRIPE_WEBHOOK_SECRET;

interface StripeRequest extends Request {
  rawBody?: Buffer;
}

router.post(
  '/stripe',
  async (req: StripeRequest, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];

    if (!sig || typeof sig !== 'string') {
      logger.warn('Stripe webhook called without signature header');
      res.status(400).send('Webhook Error: Missing Stripe signature');
      return;
    }

    if (!endpointSecret) {
      logger.error('Stripe webhook secret is not configured');
      res.status(500).send('Webhook configuration error');
      return;
    }

    let event: Stripe.Event;

    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        logger.error('Raw body not available on request for Stripe webhook');
        res.status(400).send('Webhook Error: Raw body not available');
        return;
      }

      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown webhook error';
      logger.warn(`Stripe webhook signature verification failed: undefined`);
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          logger.info('PaymentIntent succeeded', {
            id: paymentIntent.id,
            amount_received: paymentIntent.amount_received,
            currency: paymentIntent.currency,
            customer: paymentIntent.customer,
            metadata: paymentIntent.metadata,
          });

          // TODO: Update your database with payment success
          // Example:
          // await paymentService.handlePaymentSucceeded(paymentIntent);

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const lastPaymentError = paymentIntent.last_payment_error;

          logger.warn('PaymentIntent failed', {
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            customer: paymentIntent.customer,
            metadata: paymentIntent.metadata,
            error_message: lastPaymentError?.message,
            error_code: lastPaymentError?.code,
          });

          // TODO: Update your database with payment failure
          // Example:
          // await paymentService.handlePaymentFailed(paymentIntent);

          break;
        }

        case 'charge.succeeded': {
          const charge = event.data.object as Stripe.Charge;

          logger.info('Charge succeeded', {
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            customer: charge.customer,
            metadata: charge.metadata,
          });

          // Optional: handle charge.succeeded if needed

          break;
        }

        case 'charge.failed': {
          const charge = event.data.object as Stripe.Charge;

          logger.warn('Charge failed', {
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            customer: charge.customer,
            metadata: charge.metadata,
            failure_code: charge.failure_code,
            failure_message: charge.failure_message,
          });

          // Optional: handle charge.failed if needed

          break;
        }

        default: {
          logger.debug('Unhandled Stripe event type', { type: event.type });
        }
      }

      res.json({ received: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown processing error';
      logger.error('Error processing Stripe webhook event', {
        type: event.type,
        error: message,
      });
      res.status(500).send('Internal Server Error');
    }
  }
);

export default router;