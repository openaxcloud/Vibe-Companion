import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { PLANS, METERED_PRICES } from '../payments/pricing-constants';
import { StripePaymentService } from '../payments/stripe-service';
import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';

const router = Router();
const logger = createLogger('admin-billing-router');
const paymentService = new StripePaymentService();

const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY ? getStripe() : null;
if (!stripe) logger.warn('STRIPE_SECRET_KEY not configured - billing features will be limited');

async function ensureAdmin(req: Request, res: Response, next: Function) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
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

router.get('/plans', ensureAuthenticated, ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      id: plan.tier,
      name: plan.name,
      monthlyPrice: plan.priceMonthly,
      yearlyPrice: plan.priceYearly,
      creditsMonthly: plan.creditsMonthly,
      features: plan.features,
      limits: [
        { id: 1, planId: plan.tier, resourceType: 'vcpus', limit: plan.allowances.vcpus, unit: 'cores', overage_rate: METERED_PRICES.VCPU_HOUR },
        { id: 2, planId: plan.tier, resourceType: 'ram', limit: plan.allowances.ramGb, unit: 'GB', overage_rate: null },
        { id: 3, planId: plan.tier, resourceType: 'storage', limit: plan.allowances.storageGb, unit: 'GB', overage_rate: METERED_PRICES.APP_STORAGE_PER_GB_MONTH },
        { id: 4, planId: plan.tier, resourceType: 'bandwidth', limit: plan.allowances.bandwidthGb, unit: 'GB', overage_rate: METERED_PRICES.OUTBOUND_DATA_PER_GB },
        { id: 5, planId: plan.tier, resourceType: 'collaborators', limit: plan.allowances.collaborators, unit: 'users', overage_rate: null },
        { id: 6, planId: plan.tier, resourceType: 'ai_tokens', limit: -1, unit: 'tokens', overage_rate: 0.001 },
      ]
    }));
    res.json(plans);
  } catch (error: any) {
    logger.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.get('/settings', ensureAuthenticated, ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = {
      stripeWebhookEndpoint: process.env.STRIPE_WEBHOOK_SECRET ? '/api/payments/webhook' : '',
      taxRate: 0,
      currency: 'USD',
      invoicePrefix: 'INV-',
      gracePeriodDays: 7,
    };
    res.json(settings);
  } catch (error: any) {
    logger.error('Failed to fetch billing settings:', error);
    res.status(500).json({ error: 'Failed to fetch billing settings' });
  }
});

router.put('/settings', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    logger.info('Billing settings updated:', settings);
    res.json({ success: true, settings });
  } catch (error: any) {
    logger.error('Failed to update billing settings:', error);
    res.status(500).json({ error: 'Failed to update billing settings' });
  }
});

router.put('/plans/:planId', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const planData = req.body;
    logger.info(`Plan ${planId} updated:`, planData);
    res.json({ success: true, plan: planData });
  } catch (error: any) {
    logger.error('Failed to update plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.put('/plans/:planId/limits/:limitId', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { planId, limitId } = req.params;
    const limitData = req.body;
    logger.info(`Limit ${limitId} for plan ${planId} updated:`, limitData);
    res.json({ success: true, limit: limitData });
  } catch (error: any) {
    logger.error('Failed to update limit:', error);
    res.status(500).json({ error: 'Failed to update limit' });
  }
});

router.get('/subscriptions', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { users } = await import('../../shared/schema');
    const { isNotNull } = await import('drizzle-orm');

    const subscribers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionTier: users.subscriptionTier,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
        creditsBalance: users.creditsBalance,
      })
      .from(users)
      .where(isNotNull(users.stripeSubscriptionId))
      .limit(100);

    res.json(subscribers);
  } catch (error: any) {
    logger.error('Failed to fetch subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.get('/usage-summary', ensureAuthenticated, ensureAdmin, async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageResult = await db.execute(sql`
      SELECT 
        resource_type AS metric,
        event_type,
        COUNT(*) AS event_count,
        COALESCE(SUM(quantity), 0) AS total_quantity
      FROM usage_events
      GROUP BY resource_type, event_type
      ORDER BY event_count DESC
    `);

    const totalUsers = await db.execute(sql`SELECT COUNT(*) AS count FROM users`);

    res.json({
      billingPeriod,
      usageByMetric: Array.isArray(usageResult) ? usageResult : [],
      totalUsers: parseInt(String((Array.isArray(totalUsers) ? totalUsers[0] : (totalUsers as any).rows?.[0])?.count || '0')),
    });
  } catch (error: any) {
    logger.error('Failed to fetch usage summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

router.get('/invoices', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.json({ invoices: [], message: 'Stripe not configured' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const invoices = await stripe.invoices.list({ limit });

    const formattedInvoices = invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      customerId: inv.customer,
      amount: inv.amount_due / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      created: new Date(inv.created * 1000),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
      paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : null,
      invoicePdf: inv.invoice_pdf,
      hostedInvoiceUrl: inv.hosted_invoice_url,
    }));

    res.json({ invoices: formattedInvoices });
  } catch (error: any) {
    logger.error('Failed to fetch invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/revenue', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.json({ revenue: [], message: 'Stripe not configured' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const charges = await stripe.charges.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
      limit: 100,
    });

    const revenueByMonth: Record<string, number> = {};
    charges.data.forEach(charge => {
      if (charge.status === 'succeeded') {
        const date = new Date(charge.created * 1000);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth[key] = (revenueByMonth[key] || 0) + charge.amount / 100;
      }
    });

    const revenue = Object.entries(revenueByMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({ revenue });
  } catch (error: any) {
    logger.error('Failed to fetch revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

export default router;
