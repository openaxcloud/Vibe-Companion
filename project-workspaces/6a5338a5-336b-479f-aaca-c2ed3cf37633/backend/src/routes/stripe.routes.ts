import { Router } from 'express';
import { createPaymentIntent, handleStripeWebhook } from '../controllers/stripe.controller';
import express from 'express';

const router = Router();

// Route to create a payment intent (called from frontend checkout)
router.post('/create-payment-intent', createPaymentIntent);

// Stripe webhook endpoint
// It's crucial to use the raw body for webhook verification
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
