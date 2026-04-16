import { Router } from 'express';
import express from 'express';
import { createCheckoutSession, handleStripeWebhook } from '../controllers/stripeController';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Stripe webhook endpoint needs the raw body
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Route to create a checkout session
router.post('/create-checkout-session', createCheckoutSession);

export default router;