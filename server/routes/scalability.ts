/**
 * Scalability Routes
 * Fortune 500-grade scalability endpoints
 */

import { Request, Response, Router } from 'express';
import { scalabilityOrchestrator } from '../services/scalability-orchestrator';
import { redisCache } from '../services/redis-cache';
import { dbPool } from '../services/database-pool';
import { cdnOptimization } from '../services/cdn-optimization';
import { createLogger } from '../utils/logger';

const logger = createLogger('scalability-routes');
const router = Router();
const cdnService = cdnOptimization;

/**
 * Get cluster status and metrics
 */
router.get('/cluster/status', async (req: Request, res: Response) => {
  try {
    const clusterStatus = scalabilityOrchestrator.getClusterStatus();
    
    res.json({
      status: 'operational',
      cluster: clusterStatus,
      services: {
        redis: 'active',
        database: 'pooled',
        cdn: 'optimized'
      },
      capabilities: {
        autoScaling: true,
        loadBalancing: true,
        caching: true,
        cdnOptimization: true,
        containerOrchestration: true,
        horizontalScaling: true
      }
    });
  } catch (error) {
    logger.error('Failed to get cluster status:', error);
    res.status(500).json({ error: 'Failed to get cluster status' });
  }
});

/**
 * Create a new container for a project
 */
router.post('/cluster/containers', async (req: Request, res: Response) => {
  try {
    const { userId, projectId } = req.body;
    
    if (!userId || !projectId) {
      return res.status(400).json({ error: 'userId and projectId are required' });
    }
    
    const container = await scalabilityOrchestrator.createContainer(userId, projectId);
    
    res.json({
      success: true,
      container: {
        id: container.id,
        projectId: container.projectId,
        port: container.port,
        status: container.status,
        resources: container.resources
      }
    });
  } catch (error) {
    logger.error('Failed to create container:', error);
    res.status(500).json({ error: 'Failed to create container' });
  }
});

/**
 * Stop a container
 */
router.delete('/cluster/containers/:containerId', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.params;
    
    await scalabilityOrchestrator.stopContainer(containerId);
    
    res.json({
      success: true,
      message: `Container ${containerId} stopped successfully`
    });
  } catch (error) {
    logger.error('Failed to stop container:', error);
    res.status(500).json({ error: 'Failed to stop container' });
  }
});

/**
 * Route a request through load balancer
 */
router.post('/cluster/route', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    const container = await scalabilityOrchestrator.routeRequest(projectId);
    
    if (!container) {
      return res.status(503).json({ error: 'No containers available' });
    }
    
    res.json({
      success: true,
      container: {
        id: container.id,
        port: container.port,
        url: `http://localhost:${container.port}`
      }
    });
  } catch (error) {
    logger.error('Failed to route request:', error);
    res.status(500).json({ error: 'Failed to route request' });
  }
});

/**
 * Cache operations
 */
router.get('/cache/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = await redisCache.get(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Key not found in cache' });
    }
    
    res.json({ key, value });
  } catch (error) {
    logger.error('Failed to get cache:', error);
    res.status(500).json({ error: 'Failed to get cache' });
  }
});

router.post('/cache', async (req: Request, res: Response) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    
    await redisCache.set(key, value, ttl);
    
    res.json({ success: true, message: 'Value cached successfully' });
  } catch (error) {
    logger.error('Failed to set cache:', error);
    res.status(500).json({ error: 'Failed to set cache' });
  }
});

router.delete('/cache/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    await redisCache.del(key);
    
    res.json({ success: true, message: 'Cache key deleted' });
  } catch (error) {
    logger.error('Failed to delete cache:', error);
    res.status(500).json({ error: 'Failed to delete cache' });
  }
});

/**
 * Database pool statistics
 */
router.get('/database/pool/stats', async (req: Request, res: Response) => {
  try {
    const stats = dbPool.getPoolStatistics();
    
    res.json({
      stats,
      health: {
        status: stats.idleConnections > 0 ? 'healthy' : 'degraded',
        activeConnections: stats.activeConnections,
        waitingRequests: stats.waitingRequests
      }
    });
  } catch (error) {
    logger.error('Failed to get database pool stats:', error);
    res.status(500).json({ error: 'Failed to get database pool stats' });
  }
});

/**
 * CDN optimization status
 */
router.get('/cdn/status', async (req: Request, res: Response) => {
  try {
    const purgeStats = cdnService.getPurgeStatistics();
    
    res.json({
      enabled: process.env.NODE_ENV === 'production',
      providers: {
        cloudflare: !!process.env.CLOUDFLARE_ENABLED,
        cloudfront: !!process.env.CLOUDFRONT_ENABLED,
        fastly: !!process.env.FASTLY_ENABLED
      },
      edgeLocations: cdnService.getEdgeLocations(),
      purgeStats
    });
  } catch (error) {
    logger.error('Failed to get CDN status:', error);
    res.status(500).json({ error: 'Failed to get CDN status' });
  }
});

/**
 * Purge CDN cache
 */
router.post('/cdn/purge', async (req: Request, res: Response) => {
  try {
    const { urls, tags } = req.body;
    
    if (!urls && !tags) {
      await cdnService.purgeAll();
      return res.json({ success: true, message: 'All cache purged' });
    }
    
    if (urls) {
      await cdnService.purgeUrls(urls);
    }
    
    if (tags) {
      await cdnService.purgeTags(tags);
    }
    
    res.json({ success: true, message: 'Cache purged successfully' });
  } catch (error) {
    logger.error('Failed to purge CDN:', error);
    res.status(500).json({ error: 'Failed to purge CDN' });
  }
});

/**
 * Health check endpoint for load balancers
 */
router.get('/health/lb', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

export default router;