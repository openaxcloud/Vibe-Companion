/**
 * Terminal Metrics Router - Fortune 500 Monitoring
 * Exposes real-time terminal scalability metrics
 */

import { Router } from 'express';
import { terminalScalabilityManager } from '../terminal/scalability-manager';
import { createLogger } from '../utils/logger';
import { z } from 'zod';

const logger = createLogger('terminal-metrics');
const router = Router();

// Validation schemas
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100)
});

/**
 * GET /api/terminal/metrics
 * Get real-time terminal scalability metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const parseResult = paginationQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.issues
      });
    }

    const { page, limit } = parseResult.data;
    const metrics = terminalScalabilityManager.getMetrics();
    
    // Map sessions
    const allSessions = metrics.sessions.map(session => ({
      sessionId: session.sessionId,
      commandsExecuted: session.commandsExecuted,
      commandsQueued: session.commandsQueued,
      commandsFailed: session.commandsFailed,
      ageSeconds: Math.floor(session.age / 1000),
      successRate: session.commandsExecuted > 0
        ? ((session.commandsExecuted / (session.commandsExecuted + session.commandsFailed)) * 100).toFixed(2) + '%'
        : 'N/A'
    }));

    const total = allSessions.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Validate page number
    if (page > totalPages && total > 0) {
      return res.status(400).json({
        success: false,
        error: 'Page number exceeds total pages'
      });
    }

    const sessions = allSessions.slice(offset, offset + limit);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        capacity: {
          current: metrics.totalSessions,
          maximum: metrics.maxSessions,
          utilizationPercent: metrics.utilizationPercent,
          available: metrics.maxSessions - metrics.totalSessions
        },
        health: {
          status: metrics.underBackpressure ? 'warning' : 'healthy',
          underBackpressure: metrics.underBackpressure,
          message: metrics.underBackpressure
            ? `System under backpressure (${metrics.utilizationPercent.toFixed(1)}% capacity)`
            : 'Operating normally'
        },
        sessions,
        sessionsPagination: {
          page,
          limit,
          total,
          totalPages
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to retrieve terminal metrics: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve terminal metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/terminal/health
 * Terminal service liveness probe (K8s compatible)
 */
router.get('/health', (_req, res) => {
  try {
    const metrics = terminalScalabilityManager.getMetrics();
    
    const isHealthy = !metrics.underBackpressure;
    const status = isHealthy ? 'healthy' : 'degraded';
    
    res.status(isHealthy ? 200 : 503).json({
      status,
      service: 'terminal',
      timestamp: new Date().toISOString(),
      metrics: {
        activeSessions: metrics.totalSessions,
        maxSessions: metrics.maxSessions,
        utilizationPercent: metrics.utilizationPercent
      }
    });
  } catch (error) {
    logger.error(`Terminal health check failed: ${error}`);
    res.status(503).json({
      status: 'unhealthy',
      service: 'terminal',
      error: error.message
    });
  }
});

export default router;
