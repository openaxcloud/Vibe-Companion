import { Router } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16',
});

router.post('/create-payment-intent', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { amount } = req.body; // amount should be in cents

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount provided' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: { userId: req.user?.id, integration_check: 'accept_a_payment' },
    });

    res.status(201).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: error.message || 'Failed to create payment intent' });
  }
});

export default router;
