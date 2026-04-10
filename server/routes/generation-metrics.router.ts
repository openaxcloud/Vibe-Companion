/**
 * Generation Metrics Router
 * 
 * API endpoints for monitoring app generation performance.
 * Exposes per-phase timing, provider racing metrics, and aggregate statistics.
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { Router, Request, Response } from 'express';
import { generationMetrics } from '../services/generation-metrics.service';
import { providerRacing } from '../ai/provider-racing';
import { createLogger } from '../utils/logger';

const logger = createLogger('generation-metrics-router');
const router = Router();

/**
 * GET /api/metrics/generation
 * 
 * Get aggregate generation metrics including:
 * - Total/successful/failed generation counts
 * - Success rate
 * - Average duration (p50, p95)
 * - Per-phase timing breakdown
 * - Provider racing statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = generationMetrics.getAggregateMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    logger.error('[Metrics] Failed to get aggregate metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/generation/racing
 * 
 * Get provider racing specific metrics:
 * - Wins by provider
 * - Average latency per provider
 * - Cancellation rate
 * - Fallback frequency
 */
router.get('/racing', async (req: Request, res: Response) => {
  try {
    const racingMetrics = providerRacing.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...racingMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Metrics] Failed to get racing metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/generation/recent
 * 
 * Get recent generation session history
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const sessions = generationMetrics.getRecentSessions(limit);
    
    res.json({
      success: true,
      data: {
        sessions,
        activeCount: generationMetrics.getActiveSessionCount()
      }
    });
  } catch (error: any) {
    logger.error('[Metrics] Failed to get recent sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/generation/:sessionId
 * 
 * Get details for a specific generation session
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = generationMetrics.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Convert Map to object for JSON serialization
    const phases: Record<string, any> = {};
    for (const [name, phase] of session.phases) {
      phases[name] = {
        ...phase,
        durationMs: phase.durationMs || (phase.endTime ? phase.endTime - phase.startTime : null)
      };
    }
    
    res.json({
      success: true,
      data: {
        ...session,
        phases
      }
    });
  } catch (error: any) {
    logger.error('[Metrics] Failed to get session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
