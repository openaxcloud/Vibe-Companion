import { Router } from 'express';
import { createPaymentIntent, stripeWebhook } from '../controllers/stripeController';
import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Route for creating a payment intent (protected by authentication)
router.post('/create-payment-intent', authenticateToken, createPaymentIntent);

// Route for Stripe webhooks (public, but verify signature)
// It's crucial to use `express.raw({type: 'application/json'})` for webhook endpoints
// because Stripe sends raw JSON, not parsed JSON, and the signature verification depends on it.
router.post('/webhook', express.raw({type: 'application/json'}), stripeWebhook);

export default router;