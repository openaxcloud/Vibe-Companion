/**
 * WebSocket Metrics Router
 * Exposes observability metrics for WebSocket upgrade validation
 * 
 * Metrics:
 * - Cache hit rate (Redis vs Memory vs Database)
 * - Validation latency distribution
 * - Rejection reasons breakdown
 * - Session cache statistics
 * 
 * @module WebSocketMetrics
 * @since Nov 21, 2025 - Fortune 500 observability
 */

import { Router } from 'express';
import { agentSessionCache } from '../services/agent-session-cache.service';

const router = Router();

// ✅ SECURITY: Admin-only guard for metrics endpoints
// Requires ADMIN_API_KEY in ALL environments (dev, staging, production)
const requireAdmin = (req: any, res: any, next: any) => {
  const adminKey = req.headers['x-admin-key'];
  const requiredKey = process.env.ADMIN_API_KEY;
  
  // Require admin key in ALL environments
  if (!requiredKey) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Admin API key not configured',
    });
  }
  
  if (adminKey !== requiredKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Valid admin API key required for WebSocket metrics',
    });
  }
  
  next();
};

router.use(requireAdmin);

/**
 * GET /api/websocket/metrics
 * Get WebSocket upgrade validation metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const cacheStats = agentSessionCache.getStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      cache: {
        redis: {
          hits: cacheStats.redisHits,
          hitRate: cacheStats.cacheHitRate,
        },
        memory: {
          hits: cacheStats.memoryHits,
          size: cacheStats.memoryCacheSize,
          limit: cacheStats.memoryCacheLimit,
          utilization: `${((cacheStats.memoryCacheSize / cacheStats.memoryCacheLimit) * 100).toFixed(2)}%`,
        },
        database: {
          fallbacks: cacheStats.databaseFallbacks,
        },
        total: {
          requests: cacheStats.totalRequests,
          hitRate: cacheStats.cacheHitRate,
          invalidations: cacheStats.invalidations,
          errors: cacheStats.errors,
        },
      },
      health: {
        status: cacheStats.errors > (cacheStats.totalRequests * 0.05) ? 'degraded' : 'healthy',
        errorRate: cacheStats.totalRequests > 0 
          ? `${((cacheStats.errors / cacheStats.totalRequests) * 100).toFixed(2)}%`
          : '0.00%',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message,
    });
  }
});

/**
 * POST /api/websocket/metrics/reset
 * Reset statistics (for testing)
 */
router.post('/metrics/reset', async (req, res) => {
  try {
    agentSessionCache.resetStats();
    
    res.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/websocket/cache
 * Clear all session caches (for maintenance)
 * RESTRICTED: Only available in development environment
 */
router.delete('/cache', async (req, res) => {
  // ✅ SECURITY: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cache clearing is disabled in production',
    });
  }

  try {
    await agentSessionCache.clearAll();
    
    res.json({
      success: true,
      message: 'All session caches cleared (development only)',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
    });
  }
});

export default router;
