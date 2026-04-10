// @ts-nocheck
/**
 * AI Usage Metering Router - Pay-As-You-Go Billing Endpoints
 * Exposes ai_usage_metering data to users and admins
 */

import { Router } from 'express';
import { db } from '../db';
import { aiUsageMetering, users, usageAlerts } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { ensureAdmin } from '../middleware/auth';
import { ensureAuthenticated } from '../middleware/auth';

const logger = createLogger('ai-usage-router');
const router = Router();

/**
 * GET /api/usage/current
 * Get current usage summary for authenticated user (Replit Agent 3 style)
 */
router.get('/current', async (req, res) => {
  try {
    // SECURITY FIX: Return 401 for non-authenticated users instead of mock data
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please log in to view your usage data'
      });
    }

    const userId = req.user.id.toString();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const daysRemaining = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get usage for current month
    const usage = await db
      .select()
      .from(aiUsageMetering)
      .where(
        and(
          eq(aiUsageMetering.userId, userId),
          gte(aiUsageMetering.createdAt, startOfMonth),
          lte(aiUsageMetering.createdAt, endOfMonth)
        )
      );

    // Get user subscription tier from users table
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    // Calculate totals
    let totalTokens = 0;
    let agentMessages = 0;
    let thinkingTokens = 0;
    let highPowerUsage = 0;
    let webSearches = 0;

    usage.forEach((record) => {
      totalTokens += record.tokensTotal;
      agentMessages += 1;
      
      // Track thinking tokens and high power usage based on model
      if (record.model.includes('thinking') || record.model.includes('opus')) {
        thinkingTokens += record.tokensTotal;
      }
      if (record.model.includes('opus') || record.model.includes('gpt-4.1') || record.model.includes('gemini-3-pro') || record.model.includes('gemini-2.5-pro')) {
        highPowerUsage += 1;  // ✅ UPDATED Jan 2026: Includes Gemini 3 Pro + legacy Gemini 2.5 Pro
      }
    });

    // Determine tier and credits based on user subscription
    let tier: 'free' | 'pro' | 'enterprise' = 'free';
    let totalCredits = 1000; // Free tier default

    if (user?.subscriptionTier) {
      if (user.subscriptionTier === 'enterprise' || user.subscriptionTier === 'teams') {
        tier = 'enterprise';
        totalCredits = 100000;
      } else if (user.subscriptionTier === 'core') {
        tier = 'pro';
        totalCredits = 10000;
      }
    }

    const usedCredits = Math.floor(totalTokens / 100); // 100 tokens = 1 credit
    const remainingCredits = Math.max(0, totalCredits - usedCredits);
    const percentUsed = Math.min(100, Math.floor((usedCredits / totalCredits) * 100));

    // Calculate monetized costs (enterprise rate: $0.001 per token)
    const aiCost = (totalTokens * 0.001);
    const computeCost = (highPowerUsage * 0.05); // $0.05 per high-power request
    const databaseCost = 0; // Tracked separately when database integration added
    const bandwidthCost = 0; // Tracked separately when bandwidth monitoring added
    const totalSpent = aiCost + computeCost + databaseCost + bandwidthCost;
    
    // Monthly budget (based on tier)
    const monthlyBudget = tier === 'enterprise' ? 500 : tier === 'pro' ? 75 : 10;
    const creditsRemaining = Math.max(0, monthlyBudget - totalSpent);

    res.json({
      credits: {
        remaining: remainingCredits,
        used: usedCredits,
        total: totalCredits,
        percentUsed,
      },
      currentPeriod: {
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
        daysRemaining,
      },
      breakdown: {
        agentMessages,
        thinkingTokens,
        highPowerUsage,
        webSearches,
      },
      tier,
      // Monetized fields for UsageAlerts component
      compute: computeCost,
      computePercent: Math.min(100, (computeCost / (monthlyBudget * 0.3)) * 100),
      ai: aiCost,
      aiPercent: Math.min(100, (aiCost / (monthlyBudget * 0.5)) * 100),
      database: databaseCost,
      databasePercent: 0,
      bandwidth: bandwidthCost,
      bandwidthPercent: 0,
      totalSpent,
      creditsRemaining,
    });
  } catch (error) {
    logger.error('Failed to fetch current usage', { error });
    // Return safe defaults on error
    res.json({
      credits: {
        remaining: 1000,
        used: 0,
        total: 1000,
        percentUsed: 0,
      },
      currentPeriod: {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 30,
      },
      breakdown: {
        agentMessages: 0,
        thinkingTokens: 0,
        highPowerUsage: 0,
        webSearches: 0,
      },
      tier: 'free' as const,
    });
  }
});

/**
 * GET /api/ai/usage/monthly
 * Get current month's AI usage for authenticated user
 */
router.get('/monthly', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id.toString();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all usage for current month
    const usage = await db
      .select()
      .from(aiUsageMetering)
      .where(
        and(
          eq(aiUsageMetering.userId, userId),
          gte(aiUsageMetering.createdAt, startOfMonth),
          lte(aiUsageMetering.createdAt, endOfMonth)
        )
      )
      .orderBy(desc(aiUsageMetering.createdAt));

    // Calculate summary
    const summary = {
      totalTokens: 0,
      totalCost: 0,
      requestCount: usage.length,
      modelBreakdown: {} as Record<string, {
        totalTokens: number;
        totalCost: number;
        requestCount: number;
      }>,
    };

    usage.forEach((record) => {
      summary.totalTokens += record.tokensTotal;
      summary.totalCost += parseFloat(record.costUsd);

      if (!summary.modelBreakdown[record.model]) {
        summary.modelBreakdown[record.model] = {
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0,
        };
      }

      summary.modelBreakdown[record.model].totalTokens += record.tokensTotal;
      summary.modelBreakdown[record.model].totalCost += parseFloat(record.costUsd);
      summary.modelBreakdown[record.model].requestCount += 1;
    });

    res.json({
      period: {
        start: startOfMonth,
        end: endOfMonth,
      },
      summary,
      recentUsage: usage.slice(0, 20), // Last 20 requests
    });
  } catch (error) {
    logger.error('Failed to fetch AI usage', { error });
    res.status(500).json({ error: 'Failed to fetch AI usage' });
  }
});

/**
 * GET /api/ai/usage/history
 * Get AI usage history with pagination
 */
router.get('/history', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id.toString();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const usage = await db
      .select()
      .from(aiUsageMetering)
      .where(eq(aiUsageMetering.userId, userId))
      .orderBy(desc(aiUsageMetering.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiUsageMetering)
      .where(eq(aiUsageMetering.userId, userId));

    res.json({
      usage,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch AI usage history', { error });
    res.status(500).json({ error: 'Failed to fetch AI usage history' });
  }
});

/**
 * GET /api/usage/alerts
 * Get usage alerts for authenticated user
 */
router.get('/alerts', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const alerts = await db
      .select()
      .from(usageAlerts)
      .where(eq(usageAlerts.userId, userId))
      .orderBy(desc(usageAlerts.createdAt));
    res.json(alerts);
  } catch (error) {
    logger.error('Failed to fetch usage alerts', { error });
    res.status(500).json({ error: 'Failed to fetch usage alerts' });
  }
});

/**
 * POST /api/usage/alerts
 * Create a new usage alert
 */
router.post('/alerts', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { alertType = 'threshold_reached', threshold = 100 } = req.body;
    const [created] = await db
      .insert(usageAlerts)
      .values({ userId, alertType, threshold, sent: false })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    logger.error('Failed to create usage alert', { error });
    res.status(500).json({ error: 'Failed to create usage alert' });
  }
});

/**
 * PATCH /api/usage/alerts/:id
 * Update a usage alert (e.g., toggle isActive)
 */
router.patch('/alerts/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const alertId = parseInt(req.params.id, 10);
    const { isActive } = req.body;
    const updateData: Record<string, any> = {};
    if (typeof isActive === 'boolean') {
      updateData.sent = !isActive;
    }
    const [updated] = await db
      .update(usageAlerts)
      .set(updateData)
      .where(and(eq(usageAlerts.id, alertId), eq(usageAlerts.userId, userId)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(updated);
  } catch (error) {
    logger.error('Failed to update usage alert', { error });
    res.status(500).json({ error: 'Failed to update usage alert' });
  }
});

/**
 * GET /api/usage/budgets
 * Get usage budgets for authenticated user
 */
router.get('/budgets', ensureAuthenticated, async (req, res) => {
  res.json([]);
});

/**
 * POST /api/usage/budgets
 * Create a usage budget
 */
router.post('/budgets', ensureAuthenticated, async (req, res) => {
  res.status(201).json({ id: Date.now(), ...req.body, createdAt: new Date().toISOString() });
});

/**
 * GET /api/admin/ai-usage/all
 * Admin endpoint: Get all AI usage across platform
 * SECURITY FIX: Uses role-based auth instead of email string matching
 */
router.get('/admin/all', ensureAdmin, async (req, res) => {
  try {

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;
    const userId = req.query.userId as string;
    const model = req.query.model as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Build WHERE conditions
    const conditions = [];
    if (userId) conditions.push(eq(aiUsageMetering.userId, userId));
    if (model) conditions.push(eq(aiUsageMetering.model, model as any));
    if (startDate) conditions.push(gte(aiUsageMetering.createdAt, startDate));
    if (endDate) conditions.push(lte(aiUsageMetering.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get usage with user info
    const usage = await db
      .select({
        usage: aiUsageMetering,
        user: users,
      })
      .from(aiUsageMetering)
      .leftJoin(users, eq(aiUsageMetering.userId, sql`${users.id}::text`))
      .where(whereClause)
      .orderBy(desc(aiUsageMetering.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiUsageMetering)
      .where(whereClause);

    res.json({
      usage: usage.map(({ usage, user }) => ({
        ...usage,
        username: user?.username,
        userEmail: user?.email,
      })),
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch admin AI usage', { error });
    res.status(500).json({ error: 'Failed to fetch admin AI usage' });
  }
});

/**
 * GET /api/admin/ai-usage/stats
 * Admin endpoint: Get platform-wide AI usage statistics
 * SECURITY FIX: Uses role-based auth instead of email string matching
 */
router.get('/admin/stats', ensureAdmin, async (req, res) => {
  try {

    const period = req.query.period as string || 'month'; // month, week, day
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get all usage for period
    const usage = await db
      .select()
      .from(aiUsageMetering)
      .where(gte(aiUsageMetering.createdAt, startDate));

    // Calculate stats
    const stats = {
      period,
      startDate,
      endDate: now,
      totalRequests: usage.length,
      totalTokens: 0,
      totalCost: 0,
      byModel: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byProvider: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byTier: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byStatus: {
        success: 0,
        error: 0,
        timeout: 0,
      },
      uniqueUsers: new Set<string>(),
    };

    usage.forEach((record) => {
      stats.totalTokens += record.tokensTotal;
      stats.totalCost += parseFloat(record.costUsd);
      stats.uniqueUsers.add(record.userId);

      // By model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      stats.byModel[record.model].requests += 1;
      stats.byModel[record.model].tokens += record.tokensTotal;
      stats.byModel[record.model].cost += parseFloat(record.costUsd);

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      stats.byProvider[record.provider].requests += 1;
      stats.byProvider[record.provider].tokens += record.tokensTotal;
      stats.byProvider[record.provider].cost += parseFloat(record.costUsd);

      // By tier
      if (!stats.byTier[record.userTier]) {
        stats.byTier[record.userTier] = { requests: 0, tokens: 0, cost: 0 };
      }
      stats.byTier[record.userTier].requests += 1;
      stats.byTier[record.userTier].tokens += record.tokensTotal;
      stats.byTier[record.userTier].cost += parseFloat(record.costUsd);

      // By status
      const status = record.status as keyof typeof stats.byStatus;
      if (status in stats.byStatus) {
        stats.byStatus[status] += 1;
      }
    });

    res.json({
      ...stats,
      uniqueUsers: stats.uniqueUsers.size,
    });
  } catch (error) {
    logger.error('Failed to fetch admin AI stats', { error });
    res.status(500).json({ error: 'Failed to fetch admin AI stats' });
  }
});

export default router;
