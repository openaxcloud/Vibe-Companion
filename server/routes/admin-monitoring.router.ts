// @ts-nocheck
/**
 * Admin Monitoring Router (Fortune 500)
 * Dashboard for monitoring rate limit violations, system health, and errors
 */

import { Router } from 'express';
import { db } from '../db';
import { rateLimitViolations, users } from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';

const router = Router();

// All routes require admin access
router.use(ensureAuthenticated);
router.use(ensureAdmin);

/**
 * GET /api/admin/monitoring/rate-limit-violations
 * Get recent rate limit violations with pagination and filtering
 */
router.get('/rate-limit-violations', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      tier,
      limitType,
      userId,
      since,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build filter conditions
    const conditions = [];
    if (tier) conditions.push(eq(rateLimitViolations.userTier, tier as any));
    if (limitType) conditions.push(eq(rateLimitViolations.limitType, limitType as string));
    if (userId) conditions.push(eq(rateLimitViolations.userId, userId as string));
    if (since) {
      const sinceDate = new Date(since as string);
      conditions.push(gte(rateLimitViolations.blockedAt, sinceDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get violations with user info
    const violations = await db
      .select({
        id: rateLimitViolations.id,
        userId: rateLimitViolations.userId,
        ip: rateLimitViolations.ip,
        endpoint: rateLimitViolations.endpoint,
        method: rateLimitViolations.method,
        userTier: rateLimitViolations.userTier,
        limitType: rateLimitViolations.limitType,
        attemptedRequests: rateLimitViolations.attemptedRequests,
        allowedLimit: rateLimitViolations.allowedLimit,
        blockedAt: rateLimitViolations.blockedAt,
        userAgent: rateLimitViolations.userAgent,
        metadata: rateLimitViolations.metadata,
        username: users.username,
        userEmail: users.email,
      })
      .from(rateLimitViolations)
      .leftJoin(users, eq(rateLimitViolations.userId, users.id))
      .where(whereClause)
      .orderBy(desc(rateLimitViolations.blockedAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rateLimitViolations)
      .where(whereClause);

    res.json({
      violations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error('Failed to fetch rate limit violations:', error);
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

/**
 * GET /api/admin/monitoring/rate-limit-stats
 * Get aggregated statistics for rate limit violations
 */
router.get('/rate-limit-stats', async (req, res) => {
  try {
    const { since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } = req.query;
    const sinceDate = new Date(since as string);

    // Stats by tier
    const tierStats = await db
      .select({
        tier: rateLimitViolations.userTier,
        count: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${rateLimitViolations.userId})::int`,
        uniqueIps: sql<number>`count(distinct ${rateLimitViolations.ip})::int`,
      })
      .from(rateLimitViolations)
      .where(gte(rateLimitViolations.blockedAt, sinceDate))
      .groupBy(rateLimitViolations.userTier);

    // Stats by limit type
    const limitTypeStats = await db
      .select({
        limitType: rateLimitViolations.limitType,
        count: sql<number>`count(*)::int`,
      })
      .from(rateLimitViolations)
      .where(gte(rateLimitViolations.blockedAt, sinceDate))
      .groupBy(rateLimitViolations.limitType);

    // Top violated endpoints
    const topEndpoints = await db
      .select({
        endpoint: rateLimitViolations.endpoint,
        count: sql<number>`count(*)::int`,
      })
      .from(rateLimitViolations)
      .where(gte(rateLimitViolations.blockedAt, sinceDate))
      .groupBy(rateLimitViolations.endpoint)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Top violators (by user)
    const topUsers = await db
      .select({
        userId: rateLimitViolations.userId,
        username: users.username,
        email: users.email,
        tier: rateLimitViolations.userTier,
        count: sql<number>`count(*)::int`,
      })
      .from(rateLimitViolations)
      .leftJoin(users, eq(rateLimitViolations.userId, users.id))
      .where(and(
        gte(rateLimitViolations.blockedAt, sinceDate),
        sql`${rateLimitViolations.userId} is not null`
      ))
      .groupBy(rateLimitViolations.userId, users.username, users.email, rateLimitViolations.userTier)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Hourly trend (last 24 hours)
    const hourlyTrend = await db
      .select({
        hour: sql<string>`date_trunc('hour', ${rateLimitViolations.blockedAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(rateLimitViolations)
      .where(gte(rateLimitViolations.blockedAt, sinceDate))
      .groupBy(sql`date_trunc('hour', ${rateLimitViolations.blockedAt})`)
      .orderBy(sql`date_trunc('hour', ${rateLimitViolations.blockedAt})`);

    res.json({
      period: {
        since: sinceDate,
        until: new Date(),
      },
      tierStats,
      limitTypeStats,
      topEndpoints,
      topUsers,
      hourlyTrend,
    });
  } catch (error) {
    console.error('Failed to fetch rate limit stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/monitoring/system-health
 * Get overall system health metrics
 */
router.get('/system-health', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Recent violations count
    const [{ recentViolations }] = await db
      .select({ recentViolations: sql<number>`count(*)::int` })
      .from(rateLimitViolations)
      .where(gte(rateLimitViolations.blockedAt, oneHourAgo));

    // Terminal health metrics (direct import from service)
    let terminalHealth = null;
    try {
      const { getTerminalHealthMetrics } = await import('../terminal/scalability-manager');
      const metrics = getTerminalHealthMetrics();
      terminalHealth = {
        status: metrics.health.status,
        activeSessions: metrics.capacity.current,
        maxSessions: metrics.capacity.max,
        utilizationPercent: metrics.capacity.utilizationPercent,
        underBackpressure: metrics.health.underBackpressure,
      };
    } catch (error) {
      console.error('Failed to get terminal health:', error);
    }

    res.json({
      status: 'healthy',
      timestamp: now,
      metrics: {
        rateLimiting: {
          recentViolations,
          status: recentViolations > 100 ? 'warning' : 'healthy',
        },
        terminal: terminalHealth,
      },
    });
  } catch (error) {
    console.error('Failed to fetch system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

/**
 * DELETE /api/admin/monitoring/rate-limit-violations/:id
 * Delete a specific violation record (cleanup)
 */
router.delete('/rate-limit-violations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(rateLimitViolations)
      .where(eq(rateLimitViolations.id, parseInt(id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete violation:', error);
    res.status(500).json({ error: 'Failed to delete violation' });
  }
});

/**
 * POST /api/admin/monitoring/rate-limit-violations/cleanup
 * Clean up old violation records
 */
router.post('/rate-limit-violations/cleanup', async (req, res) => {
  try {
    const { olderThan = 30 } = req.body; // days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThan);

    const result = await db
      .delete(rateLimitViolations)
      .where(sql`${rateLimitViolations.blockedAt} < ${cutoffDate}`);

    res.json({
      success: true,
      deletedCount: result.rowCount || 0,
      cutoffDate,
    });
  } catch (error) {
    console.error('Failed to cleanup violations:', error);
    res.status(500).json({ error: 'Failed to cleanup violations' });
  }
});

export default router;
