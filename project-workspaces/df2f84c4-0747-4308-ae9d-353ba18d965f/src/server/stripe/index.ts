import { Router } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { CartItem } from '../../types';
import { query } from '../db';
import { authenticateToken } from '../middleware/auth';

dotenv.config();

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

interface AuthRequest extends Request {
  userId?: string;
}

router.post('/create-checkout-session', authenticateToken, async (req: AuthRequest, res) => {
  const { items, shippingAddress } = req.body;
  const userId = req.userId;

  if (!userId || !items || items.length === 0 || !shippingAddress) {
    return res.status(400).json({ success: false, message: 'Missing required checkout information.' });
  }

  try {
    const line_items = items.map((item: CartItem) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: [item.imageUrl],
        },
        unit_amount: Math.round(item.price * 100), // Price in cents
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout/cancel`,
      metadata: { userId: userId, shippingAddress: JSON.stringify(shippingAddress), items: JSON.stringify(items) },
    });

    res.status(200).json({ success: true, data: { sessionId: session.id } });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    res.status(500).json({ success: false, message: 'Failed to create checkout session.' });
  }
});

// Stripe Webhook Endpoint (simplified for demonstration)
// In a real application, you would verify the webhook signature
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body;
  const sig = req.headers['stripe-signature'] as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      // Fulfill the purchase...
      console.log('Checkout Session Completed:', session.id);
      const { userId, shippingAddress, items } = session.metadata || {};
      const totalAmount = session.amount_total ? session.amount_total / 100 : 0;

      if (userId && shippingAddress && items && totalAmount) {
        try {
          const parsedItems = JSON.parse(items);
          const parsedShippingAddress = JSON.parse(shippingAddress);

          // Create the order in your database
          // Deduct stock (already done in /orders post endpoint if called directly, but good to double check or handle here)

          const orderResult = await query(
            'INSERT INTO orders (userId, items, totalAmount, shippingAddress, status, "stripeSessionId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING * ',
            [userId, JSON.stringify(parsedItems), totalAmount, JSON.stringify(parsedShippingAddress), 'completed', session.id]
          );
          const newOrder = orderResult.rows[0];

          // Send order confirmation email
          const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
          if (userResult.rows.length > 0) {
            const userEmail = userResult.rows[0].email;
            // Assuming `sendOrderConfirmationEmail` from `./email` is available
            // await sendOrderConfirmationEmail(userEmail, newOrder);
             console.log(`Order confirmation email simulated for ${userEmail}`);
          }

        } catch (dbError) {
          console.error('Error saving order after Stripe checkout:', dbError);
        }
      }
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

export default router;