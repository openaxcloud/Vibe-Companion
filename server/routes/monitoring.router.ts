/**
 * Monitoring API Routes
 * Provides real-time metrics dashboard endpoints
 * 
 * ✅ 40-YEAR SENIOR SECURITY FIX (Fortune 500 Zero-Trust):
 * - Health endpoints: PUBLIC (K8s probes) - minimal data only
 * - Metrics/Cache endpoints: ADMIN ONLY - prevents reconnaissance attacks
 * - Cache flush: ADMIN ONLY with audit logging
 */

import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { redisCache } from '../services/redis-cache.service';
import { ensureAdmin } from '../middleware/admin-auth';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { cacheFlushRateLimiter } from '../middleware/custom-rate-limiter';

const router = Router();
const logger = createLogger('monitoring-routes');

/**
 * Get all metrics for dashboard
 * SECURITY: Admin only - metrics expose infrastructure KPIs (load, latency, throughput)
 */
router.get('/monitoring/metrics', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('Metrics accessed by admin', { userId: req.user?.id, ip: req.ip });
    const metrics = monitoringService.getAllMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching monitoring metrics:', error);
    res.status(500).json({ message: 'Failed to fetch metrics' });
  }
});

/**
 * Get specific metric history
 * SECURITY: Admin only - prevents reconnaissance of system performance patterns
 */
router.get('/monitoring/metrics/:name/history', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    logger.info('Metric history accessed', { metric: name, userId: req.user?.id });
    const history = monitoringService.getMetricHistory(name, limit);
    res.json({ name, history });
  } catch (error) {
    console.error('Error fetching metric history:', error);
    res.status(500).json({ message: 'Failed to fetch metric history' });
  }
});

/**
 * Get system health check
 * Returns 503 if unhealthy (for K8s readiness probes)
 */
router.get('/monitoring/health', async (req: Request, res: Response) => {
  try {
    const health = monitoringService.getHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed' 
    });
  }
});

/**
 * Get system health summary
 * ALWAYS returns 200 with status field for frontend consumption
 * Frontend can display degraded state without throwing errors
 */
router.get('/monitoring/health/summary', async (req: Request, res: Response) => {
  try {
    const health = monitoringService.getHealthCheck();
    
    // Always return 200, include status in response body
    res.status(200).json({
      ...health,
      ok: health.status === 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    // Even on error, return 200 with degraded status
    res.status(200).json({ 
      status: 'degraded',
      ok: false,
      message: 'Health check partially failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Redis cache statistics
 * SECURITY: Admin only - cache stats reveal infrastructure capacity and hit rates
 */
router.get('/monitoring/cache/stats', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('Cache stats accessed', { userId: req.user?.id, ip: req.ip });
    const stats = await redisCache.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ message: 'Failed to fetch cache stats' });
  }
});

/**
 * Flush Redis cache (admin only)
 * SECURITY: Critical destructive operation - requires admin authentication + audit trail
 * Rate limit: 5 req/hour per user
 */
router.post('/monitoring/cache/flush', ensureAuthenticated, cacheFlushRateLimiter, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const success = await redisCache.flushAll();
    
    // Audit trail for critical operation
    logger.warn('SECURITY: Cache flush executed', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip,
      success,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success,
      message: success ? 'Cache flushed successfully' : 'Failed to flush cache'
    });
  } catch (error) {
    console.error('Error flushing cache:', error);
    res.status(500).json({ message: 'Failed to flush cache' });
  }
});

export default router;
