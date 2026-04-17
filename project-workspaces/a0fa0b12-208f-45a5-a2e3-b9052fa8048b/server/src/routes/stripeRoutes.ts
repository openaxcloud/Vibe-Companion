import { Router } from 'express';
import express from 'express';
import { stripeWebhook, handleStripeSuccess } from '../controllers/stripeController';

const router = Router();

// Stripe webhook endpoint, needs raw body
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Frontend success/cancel redirects
router.get('/checkout-success', handleStripeSuccess);
// router.get('/checkout-cancel', handleStripeCancel); // Optional: if you want a specific cancel handling

export default router;
