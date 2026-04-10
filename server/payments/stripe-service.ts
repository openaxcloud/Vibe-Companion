// @ts-nocheck
import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';
import crypto from 'crypto';
import { storage } from '../storage';
import { getSubscriptionPeriodBoundary } from '../services/stripe-utils';
import { PLANS, getPlanByTier } from './pricing-constants';
import { creditsService } from '../services/credits-service';
import { createLogger } from '../utils/logger';
import { notifyPaymentFailed } from '../services/notification-events';

function generateIdempotencyKey(prefix: string, ...parts: (string | number)[]): string {
  const timestamp = Date.now();
  const uniqueId = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${parts.join('_')}_${timestamp}_${uniqueId}`;
}

const logger = createLogger('stripe-service');

const stripe = getStripe();

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'core' | 'teams' | 'enterprise';
  price: number;
  interval: 'month' | 'year';
  creditsMonthly: number;        // Monthly credits included
  features: string[];
  limits: {
    projects: number;
    collaborators: number;
    storage: number; // GB
    cpuHours: number;
    deployments: number;
  };
  allowances: {
    vcpus: number;
    ramGb: number;
    storageGb: number;
    bandwidthGb: number;
    developmentMinutes: number;
    publicApps: number;
    privateApps: number;
    collaborators: number;
  };
}

export interface UsageRecord {
  userId: number;
  metric: 'cpu_hours' | 'storage' | 'bandwidth' | 'deployments' | 'ai_tokens';
  quantity: number;
  timestamp: Date;
}

export class StripePaymentService {
  private plans: Map<string, SubscriptionPlan> = new Map();

  constructor() {
    this.initializePlans();
  }

  private initializePlans() {
    const starterPlan = PLANS.STARTER;
    const corePlan = PLANS.CORE;
    const teamsPlan = PLANS.TEAMS;
    const enterprisePlan = PLANS.ENTERPRISE;

    // Starter (Free) Plan
    this.plans.set('free', {
      id: 'free', // No Stripe price ID for free plan
      name: starterPlan.name,
      tier: 'free',
      price: 0,
      interval: 'month',
      creditsMonthly: starterPlan.creditsMonthly,
      features: starterPlan.features,
      limits: {
        projects: -1,
        collaborators: starterPlan.allowances.collaborators,
        storage: starterPlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: starterPlan.allowances,
    });

    // Core Plan - Monthly
    this.plans.set('core', {
      id: process.env.STRIPE_PRICE_ID_CORE_MONTHLY || 'price_core_monthly',
      name: corePlan.name,
      tier: 'core',
      price: corePlan.priceMonthly,
      interval: 'month',
      creditsMonthly: corePlan.creditsMonthly,
      features: corePlan.features,
      limits: {
        projects: -1,
        collaborators: corePlan.allowances.collaborators,
        storage: corePlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: corePlan.allowances,
    });

    // Core Plan - Yearly
    this.plans.set('core_yearly', {
      id: process.env.STRIPE_PRICE_ID_CORE_YEARLY || 'price_core_yearly',
      name: corePlan.name,
      tier: 'core',
      price: corePlan.priceYearly,
      interval: 'year',
      creditsMonthly: corePlan.creditsMonthly,
      features: corePlan.features,
      limits: {
        projects: -1,
        collaborators: corePlan.allowances.collaborators,
        storage: corePlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: corePlan.allowances,
    });

    // Teams Plan - Monthly
    this.plans.set('teams', {
      id: process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY || 'price_teams_monthly',
      name: teamsPlan.name,
      tier: 'teams',
      price: teamsPlan.priceMonthly,
      interval: 'month',
      creditsMonthly: teamsPlan.creditsMonthly,
      features: teamsPlan.features,
      limits: {
        projects: -1, // Unlimited
        collaborators: -1,
        storage: teamsPlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: teamsPlan.allowances,
    });

    // Teams Plan - Yearly
    this.plans.set('teams_yearly', {
      id: process.env.STRIPE_PRICE_ID_TEAMS_YEARLY || 'price_teams_yearly',
      name: teamsPlan.name,
      tier: 'teams',
      price: teamsPlan.priceYearly,
      interval: 'year',
      creditsMonthly: teamsPlan.creditsMonthly,
      features: teamsPlan.features,
      limits: {
        projects: -1, // Unlimited
        collaborators: -1,
        storage: teamsPlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: teamsPlan.allowances,
    });

    // Enterprise Plan - Monthly
    this.plans.set('enterprise', {
      id: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
      name: enterprisePlan.name,
      tier: 'enterprise',
      price: enterprisePlan.priceMonthly,
      interval: 'month',
      creditsMonthly: enterprisePlan.creditsMonthly,
      features: enterprisePlan.features,
      limits: {
        projects: -1,
        collaborators: -1,
        storage: enterprisePlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: enterprisePlan.allowances,
    });

    // Enterprise Plan - Yearly
    this.plans.set('enterprise_yearly', {
      id: process.env.STRIPE_PRICE_ID_ENTERPRISE_YEARLY || 'price_enterprise_yearly',
      name: enterprisePlan.name,
      tier: 'enterprise',
      price: enterprisePlan.priceYearly,
      interval: 'year',
      creditsMonthly: enterprisePlan.creditsMonthly,
      features: enterprisePlan.features,
      limits: {
        projects: -1,
        collaborators: -1,
        storage: enterprisePlan.allowances.storageGb,
        cpuHours: -1,
        deployments: -1,
      },
      allowances: enterprisePlan.allowances,
    });
  }

  async createCustomer(userId: number, email: string, name?: string): Promise<string> {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId: String(userId),
      },
    }, {
      idempotencyKey: generateIdempotencyKey('cust', userId),
    });

    // Save customer ID to user record
    await storage.updateUser(String(userId), { stripeCustomerId: customer.id });

    return customer.id;
  }

  async createSubscription(
    userId: number, 
    planId: string,
    paymentMethodId?: string
  ): Promise<Stripe.Subscription> {
    const user = await storage.getUser(String(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Create customer if doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.createCustomer(
        userId,
        user.email ?? '',
        user.username ?? undefined
      );
    }

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      }, {
        idempotencyKey: generateIdempotencyKey('pm_attach', userId, paymentMethodId),
      });

      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      }, {
        idempotencyKey: generateIdempotencyKey('cust_update', userId, paymentMethodId),
      });
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error('Invalid plan');
    }

    // Get usage-based price IDs for metered billing
    const usagePriceIds = [
      process.env.STRIPE_PRICE_ID_COMPUTE,
      process.env.STRIPE_PRICE_ID_STORAGE,
      process.env.STRIPE_PRICE_ID_BANDWIDTH,
      process.env.STRIPE_PRICE_ID_DEPLOYMENT,
      process.env.STRIPE_PRICE_ID_DATABASE,
      process.env.STRIPE_PRICE_ID_AGENT_USAGE,
    ].filter(Boolean) as string[];

    // Try creating subscription with all items (base + usage-based)
    // If this fails due to interval mismatch, fall back to base plan only
    let subscription: Stripe.Subscription;
    const subscriptionIdempotencyKey = generateIdempotencyKey('sub', userId, planId);
    try {
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          { price: plan.id }, // Base subscription
          ...usagePriceIds.map(priceId => ({ price: priceId }))
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        automatic_tax: { enabled: true },
        metadata: {
          userId: String(userId),
          planId,
        },
      }, {
        idempotencyKey: subscriptionIdempotencyKey,
      });
      logger.info(`[Stripe] ✅ Created subscription with ${usagePriceIds.length} usage-based items`);
    } catch (error: any) {
      // If interval mismatch error, create with base plan only
      if (error.code === 'parameter_invalid_empty' || 
          error.message?.includes('recurring.interval')) {
        logger.warn(
          `[Stripe] ⚠️  Could not add usage-based items to subscription (interval mismatch). ` +
          `Creating with base plan only. Configure usage prices with same interval in Stripe Dashboard.`
        );
        subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: plan.id }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          automatic_tax: { enabled: true },
          metadata: {
            userId: String(userId),
            planId,
          },
        }, {
          idempotencyKey: `${subscriptionIdempotencyKey}_fallback`,
        });
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Update user subscription info
    const periodEnd = getSubscriptionPeriodBoundary(subscription, 'current_period_end');

    await storage.updateUser(String(userId), {
      stripeSubscriptionId: subscription.id,
      stripePriceId: plan.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: periodEnd ?? undefined,
    });

    // Update plan allowances and credits in database
    await creditsService.updatePlanAllowances(String(userId), plan.tier);

    return subscription;
  }

  async createCheckoutSession(
    userId: number,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string; sessionId: string }> {
    const user = await storage.getUser(String(userId));
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.createCustomer(userId, user.email ?? '', user.username ?? undefined);
    }

    const plan = this.plans.get(planId);
    if (!plan || plan.tier === 'free') throw new Error('Invalid paid plan');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      automatic_tax: { enabled: true },
      metadata: { userId: String(userId), planId },
      subscription_data: {
        metadata: { userId: String(userId), planId },
      },
    }, {
      idempotencyKey: generateIdempotencyKey('checkout', userId, planId),
    });

    if (!session.url) throw new Error('Failed to create Stripe Checkout Session');
    logger.info(`[Stripe] ✅ Checkout session created for user ${userId}, plan ${planId}`);
    return { url: session.url, sessionId: session.id };
  }

  async cancelSubscription(userId: number): Promise<void> {
    const user = await storage.getUser(String(userId));
    if (!user || !user.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true },
      {
        idempotencyKey: generateIdempotencyKey('sub_cancel', userId, user.stripeSubscriptionId),
      }
    );

    await storage.updateUser(String(userId), {
      subscriptionStatus: 'canceled',
    });
  }

  async updateSubscription(userId: number, newPlanId: string): Promise<Stripe.Subscription> {
    const user = await storage.getUser(String(userId));
    if (!user || !user.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const plan = this.plans.get(newPlanId);
    if (!plan) {
      throw new Error('Invalid plan');
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items']
    });

    const primaryItem = subscription.items.data[0];
    if (!primaryItem?.id) {
      throw new Error('Unable to determine subscription item for update');
    }

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        items: [{
          id: primaryItem.id,
          price: plan.id,
        }],
        proration_behavior: 'create_prorations',
      },
      {
        idempotencyKey: generateIdempotencyKey('sub_update', userId, newPlanId),
      }
    );

    // Update user info
    await storage.updateUser(String(userId), {
      stripePriceId: plan.id,
      subscriptionStatus: updatedSubscription.status,
    });

    // Update plan allowances and credits in database
    await creditsService.updatePlanAllowances(String(userId), plan.tier);

    return updatedSubscription;
  }

  async createPaymentIntent(
    userId: number,
    amount: number,
    currency: string = 'usd',
    description?: string
  ): Promise<Stripe.PaymentIntent> {
    const amountInCents = Math.round(amount * 100);
    
    if (amountInCents < 50) {
      throw new Error('Amount must be at least $0.50 (50 cents)');
    }
    if (amountInCents > 99999999) {
      throw new Error('Amount exceeds maximum allowed ($999,999.99)');
    }

    const user = await storage.getUser(String(userId));
    if (!user) {
      throw new Error('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.createCustomer(
        userId,
        user.email ?? '',
        user.username ?? undefined
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customerId,
      description,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
      },
    }, {
      idempotencyKey: generateIdempotencyKey('pi', userId, amountInCents),
    });

    return paymentIntent;
  }

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    }, {
      idempotencyKey: generateIdempotencyKey('seti', customerId),
    });

    return setupIntent;
  }

  async recordUsage(userId: number, metric: string, quantity: number): Promise<boolean> {
    const user = await storage.getUser(String(userId));
    if (!user || !user.stripeSubscriptionId) {
      return false; // Free tier user - no Stripe reporting
    }

    // Get usage-based price IDs from environment
    const usagePriceIds: Record<string, string> = {
      cpu_hours: process.env.STRIPE_PRICE_ID_COMPUTE || '',
      storage: process.env.STRIPE_PRICE_ID_STORAGE || '',
      bandwidth: process.env.STRIPE_PRICE_ID_BANDWIDTH || '',
      deployments: process.env.STRIPE_PRICE_ID_DEPLOYMENT || '',
      ai_tokens: process.env.STRIPE_PRICE_ID_AGENT_USAGE || '',
      database: process.env.STRIPE_PRICE_ID_DATABASE || '',
    };

    const priceId = usagePriceIds[metric];
    if (!priceId) {
      logger.warn(`[Stripe] No price ID configured for metric: ${metric}`);
      return false;
    }

    // Always store usage record locally
    const usageRecord: UsageRecord = {
      userId,
      metric: metric as any,
      quantity,
      timestamp: new Date(),
    };
    await this.saveUsageRecord(usageRecord);

    try {
      if (!user.stripeCustomerId) {
        logger.warn(`[Stripe] User ${userId} has no Stripe customer ID`);
        return false;
      }

      const meterEvent = await stripe.billing.meterEvents.create({
        event_name: metric,
        payload: {
          stripe_customer_id: user.stripeCustomerId,
          value: String(Math.ceil(quantity)),
        },
        timestamp: Math.floor(Date.now() / 1000),
      });

      logger.info(`[Stripe] ✅ Recorded ${quantity} ${metric} for user ${userId}, meterEventId=${meterEvent.identifier}`);
      return true;
    } catch (error) {
      logger.error(`[Stripe] Failed to record usage for ${metric}:`, error);
      return false;
    }
  }

  async getUsageReport(userId: number, startDate: Date, endDate: Date): Promise<Record<string, number>> {
    // Get usage records from storage
    const records = await this.getUsageRecords(userId, startDate, endDate);
    
    const usage: Record<string, number> = {
      cpu_hours: 0,
      storage: 0,
      bandwidth: 0,
      deployments: 0,
      ai_tokens: 0,
    };

    for (const record of records) {
      usage[record.metric] += record.quantity;
    }

    return usage;
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }

    // Atomic idempotency: INSERT ON CONFLICT DO NOTHING to claim the event
    const { db } = await import('../db');
    const { stripeWebhookEvents } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    const claimed = await db
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
      .returning({ id: stripeWebhookEvents.id });

    if (claimed.length === 0) {
      logger.info(`[Stripe] Duplicate webhook event detected, skipping: ${event.id}`);
      return;
    }

    // Process event — on failure, remove idempotency record so Stripe can retry
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;
          
        default:
          break;
      }

      logger.info(`[Stripe] Webhook event processed: ${event.id} (${event.type})`);
    } catch (handlerError) {
      // Remove idempotency record so Stripe can retry this event
      await db
        .delete(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.stripeEventId, event.id));
      logger.error(`[Stripe] Handler failed for event ${event.id} (${event.type}), removed idempotency record for retry:`, handlerError);
      throw handlerError;
    }
  }

  private resolveTierFromPriceId(priceId: string | null | undefined): 'free' | 'core' | 'teams' | 'enterprise' {
    if (!priceId) return 'free';
    for (const plan of this.plans.values()) {
      if (plan.id === priceId) return plan.tier;
    }
    return 'free';
  }

  private resolveTierFromSubscription(subscription: Stripe.Subscription): { tier: 'free' | 'core' | 'teams' | 'enterprise'; priceId: string | null } {
    const knownPriceIds = new Map<string, 'free' | 'core' | 'teams' | 'enterprise'>();
    for (const plan of this.plans.values()) {
      if (plan.id && plan.id !== 'free') {
        knownPriceIds.set(plan.id, plan.tier);
      }
    }

    for (const item of subscription.items?.data ?? []) {
      const itemPriceId = item.price?.id;
      if (itemPriceId && knownPriceIds.has(itemPriceId)) {
        return { tier: knownPriceIds.get(itemPriceId)!, priceId: itemPriceId };
      }
    }

    const fallbackPriceId = subscription.items?.data?.[0]?.price?.id ?? null;
    if (fallbackPriceId) {
      logger.warn(`[Stripe] Unknown price ID ${fallbackPriceId} in subscription ${subscription.id}, preserving current tier`);
    }
    return { tier: 'free', priceId: fallbackPriceId };
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userId = parseInt(subscription.metadata.userId);
    if (!userId) return;

    const { tier, priceId } = this.resolveTierFromSubscription(subscription);

    const updateData: Record<string, any> = {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: getSubscriptionPeriodBoundary(
        subscription,
        'current_period_end'
      ) ?? undefined,
    };

    if (tier !== 'free' || subscription.status === 'canceled') {
      updateData.subscriptionTier = tier;
    }

    await storage.updateUser(String(userId), updateData);

    if (tier !== 'free') {
      await creditsService.updatePlanAllowances(String(userId), tier);
    }

    logger.info(`[Stripe] Subscription updated for user ${userId}: tier=${tier}, status=${subscription.status}`);
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const userId = parseInt(subscription.metadata.userId);
    if (!userId) return;

    await storage.updateUser(String(userId), {
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
      stripeSubscriptionId: null,
      stripePriceId: null,
    });

    await creditsService.updatePlanAllowances(String(userId), 'free');

    logger.info(`[Stripe] Subscription canceled for user ${userId}, downgraded to free tier`);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    
    const userId = (customer as Stripe.Customer).metadata?.userId;
    if (!userId) return;

    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const { tier, priceId } = this.resolveTierFromSubscription(subscription);

      const updateData: Record<string, any> = {
        subscriptionStatus: 'active',
        stripePriceId: priceId,
        subscriptionCurrentPeriodEnd: getSubscriptionPeriodBoundary(
          subscription,
          'current_period_end'
        ) ?? undefined,
      };

      if (tier !== 'free') {
        updateData.subscriptionTier = tier;
      }

      await storage.updateUser(userId, updateData);

      if (tier !== 'free') {
        await creditsService.updatePlanAllowances(userId, tier);
      }
    }

    logger.info(`[Stripe] Payment succeeded for user ${userId}, invoice ${invoice.id}`);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const customerId = typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id;
    if (!customerId) return;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;

    const userId = (customer as Stripe.Customer).metadata?.userId;
    if (!userId) return;

    await storage.updateUser(userId, {
      subscriptionStatus: 'past_due',
    });

    const user = await storage.getUser(userId);
    if (user?.email) {
      try {
        const { sendPaymentFailedEmail } = await import('../utils/sendgrid-email-service');
        const amountDue = (paymentIntent.amount ?? 0) / 100;
        await sendPaymentFailedEmail(
          userId,
          user.email,
          user.displayName || user.username,
          amountDue,
          paymentIntent.id
        );
      } catch (emailError) {
        logger.error(`[Stripe] Failed to send payment failure email for payment_intent.payment_failed (pi: ${paymentIntent.id}, user: ${userId}):`, emailError);
      }
    }

    notifyPaymentFailed(
      typeof userId === 'string' ? parseInt(userId, 10) : userId,
      `Payment of $${((paymentIntent.amount ?? 0) / 100).toFixed(2)} could not be processed.`
    ).catch(err => logger.warn('[Stripe] Failed to send payment failure push notification:', err));

    logger.warn(`[Stripe] PaymentIntent failed for user ${userId}, pi ${paymentIntent.id}, status set to past_due`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    
    const userId = (customer as Stripe.Customer).metadata?.userId;
    if (!userId) return;

    await storage.updateUser(userId, {
      subscriptionStatus: 'past_due',
    });

    const user = await storage.getUser(userId);
    if (user?.email) {
      try {
        const { sendPaymentFailedEmail } = await import('../utils/sendgrid-email-service');
        const amountDue = (invoice.amount_due ?? 0) / 100;
        await sendPaymentFailedEmail(
          userId,
          user.email,
          user.displayName || user.username,
          amountDue,
          invoice.id
        );
      } catch (emailError) {
        logger.error(`[Stripe] Failed to send payment failure email for invoice.payment_failed (invoice: ${invoice.id}, user: ${userId}):`, emailError);
      }
    }

    notifyPaymentFailed(
      typeof userId === 'string' ? parseInt(userId, 10) : userId,
      `Invoice payment of $${((invoice.amount_due ?? 0) / 100).toFixed(2)} failed.`
    ).catch(err => logger.warn('[Stripe] Failed to send invoice failure push notification:', err));

    logger.warn(`[Stripe] Payment failed for user ${userId}, invoice ${invoice.id}, status set to past_due`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    if (!customerId) return;

    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) return;
      
      const userId = (customer as Stripe.Customer).metadata?.userId;
      if (!userId) return;

      const refundedAmount = charge.amount_refunded / 100;
      
      // #134 FIXED: Add credits back to user's balance on refund
      if (refundedAmount > 0) {
        await creditsService.addCredits(userId, refundedAmount, `Stripe refund: Charge ${charge.id}`);
        logger.info(`[Stripe] Added ${refundedAmount} credits to user ${userId} for refund`);
      }
      
      logger.info(`[Stripe] Charge refunded for user ${userId}: $${refundedAmount}`);
    } catch (error) {
      logger.error('[Stripe] Error handling charge refund:', error);
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute) {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return;

    try {
      const charge = await stripe.charges.retrieve(chargeId);
      const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
      if (!customerId) return;

      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) return;
      
      const userId = (customer as Stripe.Customer).metadata?.userId;
      logger.warn(`[Stripe] DISPUTE CREATED for user ${userId}: $${dispute.amount / 100} - Reason: ${dispute.reason}`);
      
      // #135 FIXED: Create support ticket for dispute
      if (userId) {
        const { db } = await import('../db');
        const { supportTickets } = await import('../../shared/admin-schema');
        
        const ticketNumber = `DSP-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        
        await db.insert(supportTickets).values({
          userId: parseInt(userId),
          ticketNumber,
          subject: `Payment Dispute: $${(dispute.amount / 100).toFixed(2)}`,
          description: `A payment dispute has been filed for charge ${chargeId}.\n\nAmount: $${(dispute.amount / 100).toFixed(2)}\nReason: ${dispute.reason || 'Not specified'}\nDispute ID: ${dispute.id}\n\nPlease review and respond within the deadline.`,
          category: 'billing',
          priority: 'urgent',
          status: 'open',
          tags: ['dispute', 'billing', 'auto-generated'],
        });
        
        logger.info(`[Stripe] Created support ticket ${ticketNumber} for dispute ${dispute.id}`);
      }
    } catch (error) {
      logger.error('[Stripe] Error handling dispute:', error);
    }
  }

  private async saveUsageRecord(record: UsageRecord): Promise<void> {
    try {
      // Import db and schema
      const { db } = await import('../db');
      const { usageTracking } = await import('../../shared/schema');
      
      // Calculate billing period (first and last day of current month)
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // Map metric names to database values
      const metricMap: Record<string, { type: string; unit: string }> = {
        cpu_hours: { type: 'compute', unit: 'hours' },
        storage: { type: 'storage', unit: 'GB' },
        bandwidth: { type: 'bandwidth', unit: 'GB' },
        deployments: { type: 'deployment', unit: 'count' },
        ai_tokens: { type: 'ai_usage', unit: 'tokens' },
        database: { type: 'database', unit: 'GB' },
      };
      
      const metricInfo = metricMap[record.metric] || { type: record.metric, unit: 'units' };
      
      // Insert usage record into database
      await db.insert(usageTracking).values({
        userId: record.userId,
        metricType: metricInfo.type,
        value: String(record.quantity),
        unit: metricInfo.unit,
        timestamp: record.timestamp,
        billingPeriodStart,
        billingPeriodEnd,
      });
      
      logger.info(`[Usage] Saved ${record.quantity} ${metricInfo.type} for user ${record.userId}`);
    } catch (error) {
      logger.error('[Usage] Failed to save usage record:', error);
      // Don't throw - we don't want to break the main flow if DB save fails
    }
  }

  private async getUsageRecords(
    userId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<UsageRecord[]> {
    try {
      const { db } = await import('../db');
      const { usageTracking } = await import('../../shared/schema');
      const { and, eq, gte, lte } = await import('drizzle-orm');
      
      const records = await db
        .select()
        .from(usageTracking)
        .where(
          and(
            eq(usageTracking.userId, userId),
            gte(usageTracking.timestamp, startDate),
            lte(usageTracking.timestamp, endDate)
          )
        );
      
      // Map database records to UsageRecord type
      return records.map(r => ({
        userId: r.userId,
        metric: r.metricType as any,
        quantity: parseFloat(r.value.toString()),
        timestamp: r.timestamp || new Date(),
      }));
    } catch (error) {
      logger.error('[Usage] Failed to fetch usage records:', error);
      return [];
    }
  }

  getPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values());
  }

  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.get(planId);
  }

  async getBillingHistory(customerId: string): Promise<any[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12, // Last 12 invoices
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.total / 100, // Convert from cents
      currency: invoice.currency,
      status: invoice.status,
      date: new Date(invoice.created * 1000),
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
    }));
  }
}

export const stripeService = new StripePaymentService();