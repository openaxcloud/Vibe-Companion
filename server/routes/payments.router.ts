import { Router, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { stripeService as paymentService } from '../payments/stripe-service';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { retryFailedQueueItems, getQueueHealthMetrics } from '../workflows/payg-queue-processor';

const router = Router();
const startupLogger = createLogger('payments-router-startup');

// Warn if Stripe webhook secret missing in production - webhooks will be disabled but server continues
if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_WEBHOOK_SECRET) {
  startupLogger.warn('⚠️  STRIPE_WEBHOOK_SECRET is not configured — Stripe webhook processing will be disabled.');
  startupLogger.warn('⚠️  Add STRIPE_WEBHOOK_SECRET to Replit Secrets to enable payment webhooks.');
}

const adminPaymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
const logger = createLogger('payments-router');

// Get available subscription plans
router.get('/plans', (_req: Request, res: Response) => {
  try {
    const plans = paymentService.getPlans();
    res.json(plans);
  } catch (error: any) {
    logger.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Create a new subscription
router.post('/create-subscription', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tier, interval, paymentMethodId } = req.body;

    if (!tier) {
      return res.status(400).json({ error: 'Tier is required' });
    }
    
    // Validate tier value
    const validTiers = ['free', 'core', 'teams', 'enterprise'];
    if (!validTiers.includes(tier.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid tier. Must be one of: ' + validTiers.join(', ') });
    }
    
    // For paid tiers, validate payment method presence
    if (tier.toLowerCase() !== 'free' && !paymentMethodId) {
      logger.warn('Subscription attempt without payment method', { userId, tier });
      return res.status(400).json({ 
        error: 'Payment method required for paid subscriptions',
        requiresPaymentMethod: true
      });
    }

    // Map tier to plan ID based on interval
    let planId = tier.toLowerCase();
    if (interval === 'year') {
      planId = `${tier.toLowerCase()}_yearly`;
    }

    const subscription = await paymentService.createSubscription(
      userId,
      planId,
      paymentMethodId
    );

    // Extract client secret from payment intent
    let clientSecret = (subscription.latest_invoice as any)?.payment_intent?.client_secret;

    // If no payment intent (no payment method attached), create a setup intent for future payments
    if (!clientSecret && !paymentMethodId) {
      const { storage } = await import('../storage');
      const user = await storage.getUser(String(userId));
      
      if (user?.stripeCustomerId) {
        const setupIntent = await paymentService.createSetupIntent(user.stripeCustomerId);
        clientSecret = setupIntent.client_secret;
      }
    }

    res.json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret || null,
      status: subscription.status
    });
  } catch (error: any) {
    logger.error('Failed to create subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await paymentService.cancelSubscription(userId);
    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error: any) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

// Update subscription
router.post('/update-subscription', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return res.status(400).json({ error: 'New plan ID is required' });
    }

    const subscription = await paymentService.updateSubscription(userId, newPlanId);
    res.json({
      subscriptionId: subscription.id,
      status: subscription.status
    });
  } catch (error: any) {
    logger.error('Failed to update subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to update subscription' });
  }
});

// Create a Stripe hosted Checkout Session (simplest path for new subscribers)
// Returns a redirect URL to Stripe's hosted checkout page — no card UI needed on our side.
router.post('/create-checkout-session', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tier, interval } = req.body;

    if (!tier || tier.toLowerCase() === 'free') {
      return res.status(400).json({ error: 'A paid tier is required' });
    }
    const validTiers = ['core', 'teams', 'enterprise'];
    if (!validTiers.includes(tier.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid tier. Must be one of: ' + validTiers.join(', ') });
    }

    const planId = interval === 'year' ? `${tier.toLowerCase()}_yearly` : tier.toLowerCase();

    const appUrl = process.env.APP_URL ||
      (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');

    const { url, sessionId } = await paymentService.createCheckoutSession(
      userId,
      planId,
      `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      `${appUrl}/billing?checkout=cancelled`
    );

    res.json({ url, sessionId });
  } catch (error: any) {
    logger.error('Failed to create checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Create payment intent for one-time payments
router.post('/create-payment-intent', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, currency, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const paymentIntent = await paymentService.createPaymentIntent(
      userId,
      amount,
      currency || 'usd',
      description
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error: any) {
    logger.error('Failed to create payment intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
});

// Stripe webhook handler with signature validation
// Uses express.raw() for raw body buffer required by Stripe signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    logger.warn('Webhook request missing signature or secret', { 
      hasSignature: !!sig, 
      hasEndpointSecret: !!endpointSecret 
    });
    return res.status(400).send('Missing signature or secret');
  }

  try {
    await paymentService.handleWebhook(req.body, sig as string);
    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    if (error.message?.includes('signature verification failed')) {
      console.error('Webhook signature verification failed');
      return res.status(400).send('Webhook Error: Invalid signature');
    }
    // SECURITY: Return 500 on handler errors, not 200
    // Returning 200 on errors can cause Stripe to not retry
    return res.status(500).json({ error: 'Webhook handler encountered an error' });
  }
});

// Get current subscription status
router.get('/subscription-status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { storage } = await import('../storage');
    const user = await storage.getUser(String(userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      hasSubscription: !!user.stripeSubscriptionId,
      subscriptionId: user.stripeSubscriptionId,
      subscriptionStatus: user.subscriptionStatus,
      stripePriceId: user.stripePriceId,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd
    });
  } catch (error: any) {
    logger.error('Failed to fetch subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// Get credits status (balance, allowance, usage)
router.get('/credits-status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { creditsService } = await import('../services/credits-service');
    
    const status = await creditsService.getCreditsStatus(String(userId));
    res.json(status);
  } catch (error: any) {
    logger.error('Failed to fetch credits status:', error);
    res.status(500).json({ error: 'Failed to fetch credits status' });
  }
});

// Get billing history
router.get('/billing-history', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { storage } = await import('../storage');
    const user = await storage.getUser(String(userId));

    if (!user?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    // Fetch invoices from Stripe
    const invoices = await paymentService.getBillingHistory(user.stripeCustomerId);
    res.json({ invoices });
  } catch (error: any) {
    logger.error('Failed to fetch billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Record usage for metered billing
router.post('/record-usage', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { metric, quantity } = req.body;

    if (!metric || !quantity) {
      return res.status(400).json({ error: 'Metric and quantity are required' });
    }

    const result = await paymentService.recordUsage(userId, metric, quantity);
    res.json({ 
      success: true,
      reportedToStripe: result,
      message: result 
        ? 'Usage recorded successfully (local storage + Stripe)'
        : 'Usage recorded locally (Stripe reporting unavailable - configure metered items)'
    });
  } catch (error: any) {
    logger.error('Failed to record usage:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

// ============================================================================
// EDGE CASE FIX #3: Queue Management & Recovery Endpoints (Admin/SRE)
// ============================================================================

/**
 * Middleware: Ensure admin role
 * Loads full user from storage to validate role
 */
async function ensureAdmin(req: Request, res: Response, next: Function) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Load full user from storage to get role
    const { storage } = await import('../storage');
    const user = await storage.getUser(String(req.user.id));
    
    if (!user || user.role !== 'admin') {
      logger.warn(`Unauthorized admin access attempt by user ${req.user.id}`);
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    next();
  } catch (error: any) {
    logger.error('Admin check failed:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Get pay-as-you-go queue health metrics
 * Returns counts and oldest items for monitoring
 * ADMIN ONLY - Privileged operation
 */
router.get('/queue-health', ensureAuthenticated, ensureAdmin, adminPaymentRateLimiter, async (req: Request, res: Response) => {
  try {
    const metrics = await getQueueHealthMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch queue health:', error);
    res.status(500).json({ error: 'Failed to fetch queue health metrics' });
  }
});

/**
 * Retry all failed queue items
 * Resets failed items to pending status for reprocessing
 * Safe to call multiple times - idempotency keys prevent double-charging
 * ADMIN ONLY - Privileged operation
 */
router.post('/queue-retry', ensureAuthenticated, ensureAdmin, adminPaymentRateLimiter, async (req: Request, res: Response) => {
  try {
    logger.info(`Queue retry initiated by admin user ${req.user!.id}`);
    
    const result = await retryFailedQueueItems();
    
    res.json({
      success: true,
      retried: result.retried,
      errors: result.errors,
      message: `${result.retried} failed items reset to pending for retry`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to retry queue items:', error);
    res.status(500).json({ error: 'Failed to retry failed queue items' });
  }
});

// Alias routes so /api/billing/* works in addition to /api/payments/*
router.post('/subscribe', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planId, tier, interval, paymentMethodId } = req.body;
    const resolvedTier = tier || planId || 'core';
    const subscription = await paymentService.createSubscription(userId, resolvedTier, paymentMethodId);
    const clientSecret = (subscription.latest_invoice as any)?.payment_intent?.client_secret;
    res.json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret || null,
      status: subscription.status,
      checkoutUrl: null
    });
  } catch (error: any) {
    logger.error('Failed to create subscription (alias):', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

router.post('/cancel', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await paymentService.cancelSubscription(userId);
    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error: any) {
    logger.error('Failed to cancel subscription (alias):', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

router.get('/subscription', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { storage } = await import('../storage');
    const user = await storage.getUser(String(userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const tier = user.subscriptionTier || 'free';
    res.json({
      id: user.id,
      plan: tier,
      status: user.subscriptionStatus || (tier === 'free' ? 'active' : 'inactive'),
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null
    });
  } catch (error: any) {
    logger.error('Failed to get subscription (alias):', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
});

export default router;
