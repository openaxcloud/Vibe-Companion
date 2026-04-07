import express, { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import { env } from '../config/env';
import { getCartTotal } from '../services/cartService';
import { createOrder, markOrderPaid } from '../services/orderService';
import { adjustInventoryForOrder } from '../services/inventoryService';
import { logger } from '../utils/logger';

const router = express.Router();

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

interface CreatePaymentIntentBody {
  cartId: string;
  currency?: string;
  // Optional: allow client to pass metadata such as userId, coupon etc.
  metadata?: Record<string, string>;
}

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

/**
 * POST /checkout/create-payment-intent
 * Body: { cartId: string, currency?: string, metadata?: Record<string,string> }
 * Response: { clientSecret: string, orderId: string }
 */
router.post(
  '/create-payment-intent',
  asyncHandler(async (req: Request<unknown, unknown, CreatePaymentIntentBody>, res: Response) => {
    const { cartId, currency = 'usd', metadata = {} } = req.body;

    if (!cartId) {
      res.status(400).json({ error: 'cartId is required' });
      return;
    }

    const cartTotal = await getCartTotal(cartId);
    if (cartTotal <= 0) {
      res.status(400).json({ error: 'Cart total must be greater than zero' });
      return;
    }

    const order = await createOrder({
      cartId,
      amount: cartTotal,
      currency,
      status: 'pending',
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cartTotal,
      currency,
      metadata: {
        orderId: order.id,
        cartId,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
    });
  }),
);

/**
 * Stripe webhook handler
 * This route MUST receive the raw request body, not parsed JSON.
 * Ensure in your main server that for this path you use bodyParser.raw({type: 'application/json'})
 */
router.post(
  '/webhook',
  // Raw body parser for Stripe signature verification. This should be wired in the main app,
  // but included here for module completeness if mounted directly.
  bodyParser.raw({ type: 'application/json' }),
  asyncHandler(async (req: StripeWebhookRequest, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).send('Missing Stripe signature');
      return;
    }

    if (!req.rawBody && !(req as any).body) {
      res.status(400).send('Missing raw body for Stripe webhook');
      return;
    }

    const rawBody: Buffer =
      req.rawBody ?? (Buffer.isBuffer((req as any).body) ? (req as any).body : Buffer.from((req as any).body));

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig as string, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', { error: err });
      res.status(400).send(`Webhook Error: undefined`);
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const orderId = paymentIntent.metadata?.orderId;

          if (!orderId) {
            logger.warn('payment_intent.succeeded without orderId metadata', { paymentIntentId: paymentIntent.id });
            break;
          }

          await markOrderPaid(orderId, paymentIntent.id);
          await adjustInventoryForOrder(orderId);

          logger.info('Order marked as paid and inventory adjusted', {
            orderId,
            paymentIntentId: paymentIntent.id,
          });

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const orderId = paymentIntent.metadata?.orderId;
          logger.warn('Payment failed for order', {
            orderId,
            paymentIntentId: paymentIntent.id,
            lastPaymentError: paymentIntent.last_payment_error,
          });
          // Optionally update order status to failed here
          break;
        }

        default: {
          logger.debug('Unhandled Stripe event type', { type: event.type });
        }
      }

      res.json({ received: true });
    } catch (err) {
      logger.error('Error processing Stripe webhook', { error: err, eventId: event.id, type: event.type });
      res.status(500).send('Webhook handler failed');
    }
  }),
);

export default router;