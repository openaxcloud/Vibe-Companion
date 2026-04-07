/**
 * Max Autonomy Mode API Routes
 * 
 * Endpoints for 200+ minute autonomous sessions:
 * - Start/stop autonomous sessions
 * - Pause/resume execution
 * - Get session status and progress
 * - Get task list and details
 */

import { Router, Request, Response, NextFunction } from 'express';
import { maxAutonomyService } from '../services/max-autonomy-service';
import { delegationManager } from '../services/delegation-manager.service';
import { orchestratorMetrics } from '../services/orchestrator-metrics.service';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { maxAutonomySessions, autonomyMessageQueue } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import type { RiskThreshold } from '@shared/schema';

const router = Router();
const logger = createLogger('MaxAutonomyRouter');

/**
 * GET /api/autonomy/orchestrator/health
 * Public endpoint - returns provider health status and orchestrator metrics
 * ✅ No auth required - this is read-only health/metrics data
 */
router.get('/orchestrator/health', async (req: Request, res: Response) => {
  try {
    const providerHealth = delegationManager.getProviderHealth();
    const healthStatus = orchestratorMetrics.getHealthStatus();
    
    res.json({
      success: true,
      providers: providerHealth,
      tiers: {
        fast: { threshold: 3, description: 'Simple tasks (complexity < 3)' },
        balanced: { threshold: 7, description: 'Moderate tasks (complexity 3-7)' },
        quality: { threshold: 10, description: 'Complex tasks (complexity > 7)' }
      },
      globalStats: {
        totalTasks: healthStatus.totalSamples,
        successRate: healthStatus.avgAccuracy,
        uniqueTaskTypes: healthStatus.uniqueTaskTypes,
        bufferSize: healthStatus.bufferSize
      }
    });
  } catch (error: any) {
    logger.error('Error fetching orchestrator health:', error);
    res.status(500).json({ error: 'Failed to fetch orchestrator health' });
  }
});

// All other routes require authentication
router.use(ensureAuthenticated);

async function ensureSessionOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.id || req.body.sessionId;
    const userId = req.user!.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const [session] = await db
      .select()
      .from(maxAutonomySessions)
      .where(and(
        eq(maxAutonomySessions.id, sessionId),
        eq(maxAutonomySessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      logger.warn(`Session ownership check failed: sessionId=${sessionId}, userId=${userId}`);
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    (req as any).autonomySession = session;
    next();
  } catch (error: any) {
    logger.error('Error in session ownership check:', error);
    res.status(500).json({ error: 'Failed to verify session ownership' });
  }
}

/**
 * POST /api/autonomy/sessions
 * Start a new autonomous session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      projectId,
      goal,
      model,
      maxDurationMinutes,
      executionIntervalMs,
      autoCheckpoint,
      autoTest,
      autoRollback,
      riskThreshold
    } = req.body;

    if (!projectId || !goal) {
      return res.status(400).json({ error: 'projectId and goal are required' });
    }

    if (riskThreshold && !['low', 'medium', 'high', 'critical'].includes(riskThreshold)) {
      return res.status(400).json({
        error: 'Invalid risk threshold',
        validValues: ['low', 'medium', 'high', 'critical']
      });
    }

    const session = await maxAutonomyService.startSession({
      userId,
      projectId,
      goal,
      model,
      maxDurationMinutes,
      executionIntervalMs,
      autoCheckpoint,
      autoTest,
      autoRollback,
      riskThreshold: riskThreshold as RiskThreshold
    });

    logger.info(`Max Autonomy session ${session.id} started for user ${userId}`);

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        goal: session.goal,
        createdAt: session.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Error starting Max Autonomy session:', error);
    res.status(500).json({ error: error.message || 'Failed to start autonomous session' });
  }
});

/**
 * GET /api/autonomy/sessions/:id
 * Get session status
 */
router.get('/sessions/:id', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const session = (req as any).autonomySession;

    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        goal: session.goal,
        tasksTotal: session.tasksTotal,
        tasksCompleted: session.tasksCompleted,
        tasksFailed: session.tasksFailed,
        currentTaskId: session.currentTaskId,
        checkpointsCreated: session.checkpointsCreated,
        rollbacksPerformed: session.rollbacksPerformed,
        testsRun: session.testsRun,
        testsPassed: session.testsPassed,
        totalTokensUsed: session.totalTokensUsed,
        totalCostUsd: session.totalCostUsd,
        startedAt: session.startedAt,
        pausedAt: session.pausedAt,
        completedAt: session.completedAt,
        createdAt: session.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Error getting session:', error);
    res.status(500).json({ error: error.message || 'Failed to get session' });
  }
});

/**
 * POST /api/autonomy/sessions/:id/pause
 * Pause session execution
 */
router.post('/sessions/:id/pause', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = (req as any).autonomySession;

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    await maxAutonomyService.pauseSession(sessionId);

    logger.info(`Session ${sessionId} paused by user ${req.user!.id}`);

    res.json({
      success: true,
      sessionId,
      status: 'paused',
      message: 'Session paused successfully'
    });
  } catch (error: any) {
    logger.error('Error pausing session:', error);
    res.status(500).json({ error: error.message || 'Failed to pause session' });
  }
});

/**
 * POST /api/autonomy/sessions/:id/resume
 * Resume session execution
 */
router.post('/sessions/:id/resume', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = (req as any).autonomySession;

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    await maxAutonomyService.resumeSession(sessionId);

    logger.info(`Session ${sessionId} resumed by user ${req.user!.id}`);

    res.json({
      success: true,
      sessionId,
      status: 'active',
      message: 'Session resumed successfully'
    });
  } catch (error: any) {
    logger.error('Error resuming session:', error);
    res.status(500).json({ error: error.message || 'Failed to resume session' });
  }
});

/**
 * POST /api/autonomy/sessions/:id/stop
 * Stop session execution
 */
router.post('/sessions/:id/stop', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = (req as any).autonomySession;

    if (['completed', 'cancelled', 'failed'].includes(session.status)) {
      return res.status(400).json({ error: 'Session is already terminated' });
    }

    await maxAutonomyService.stopSession(sessionId);

    logger.info(`Session ${sessionId} stopped by user ${req.user!.id}`);

    res.json({
      success: true,
      sessionId,
      status: 'cancelled',
      message: 'Session stopped successfully'
    });
  } catch (error: any) {
    logger.error('Error stopping session:', error);
    res.status(500).json({ error: error.message || 'Failed to stop session' });
  }
});

/**
 * GET /api/autonomy/sessions/:id/tasks
 * Get task list for a session
 */
router.get('/sessions/:id/tasks', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;

    const tasks = await maxAutonomyService.getTasks(sessionId);

    res.json({
      success: true,
      sessionId,
      count: tasks.length,
      tasks
    });
  } catch (error: any) {
    logger.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message || 'Failed to get tasks' });
  }
});

/**
 * GET /api/autonomy/sessions/:id/progress
 * Get progress metrics for a session
 */
router.get('/sessions/:id/progress', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;

    const progress = await maxAutonomyService.getProgress(sessionId);

    if (!progress) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      progress
    });
  } catch (error: any) {
    logger.error('Error getting progress:', error);
    res.status(500).json({ error: error.message || 'Failed to get progress' });
  }
});

/**
 * GET /api/autonomy/sessions
 * Get user's autonomy sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const sessions = await maxAutonomyService.getUserSessions(userId, limit);

    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        goal: s.goal,
        tasksTotal: s.tasksTotal,
        tasksCompleted: s.tasksCompleted,
        tasksFailed: s.tasksFailed,
        createdAt: s.createdAt,
        completedAt: s.completedAt
      }))
    });
  } catch (error: any) {
    logger.error('Error getting user sessions:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

/**
 * GET /api/autonomy/health
 * Health check for max autonomy service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'max-autonomy',
    timestamp: new Date().toISOString(),
    features: {
      sessionManagement: true,
      taskQueue: true,
      autoCheckpoint: true,
      autoTest: true,
      autoRollback: true
    }
  });
});

// GET /api/autonomy/sessions/:id/messages - Get queued messages
router.get('/sessions/:id/messages', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const messages = await db.select()
      .from(autonomyMessageQueue)
      .where(eq(autonomyMessageQueue.sessionId, sessionId))
      .orderBy(desc(autonomyMessageQueue.priority), asc(autonomyMessageQueue.createdAt));
    
    res.json({ success: true, messages });
  } catch (error: any) {
    logger.error('Error getting queued messages:', error);
    res.status(500).json({ error: 'Failed to get queued messages' });
  }
});

// POST /api/autonomy/sessions/:id/messages - Queue a new message
router.post('/sessions/:id/messages', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;
    const { content, priority = 0 } = req.body;
    
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const [message] = await db.insert(autonomyMessageQueue).values({
      sessionId,
      userId,
      content: content.trim(),
      priority,
      status: 'pending',
    }).returning();
    
    logger.info(`Message queued for session ${sessionId}: ${message.id}`);
    res.status(201).json({ success: true, message });
  } catch (error: any) {
    logger.error('Error queuing message:', error);
    res.status(500).json({ error: 'Failed to queue message' });
  }
});

// DELETE /api/autonomy/sessions/:id/messages/:messageId - Cancel a queued message
router.delete('/sessions/:id/messages/:messageId', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    
    await db.update(autonomyMessageQueue)
      .set({ status: 'cancelled' })
      .where(eq(autonomyMessageQueue.id, messageId));
    
    res.json({ success: true, message: 'Message cancelled' });
  } catch (error: any) {
    logger.error('Error cancelling message:', error);
    res.status(500).json({ error: 'Failed to cancel message' });
  }
});

// PATCH /api/autonomy/sessions/:id/messages/:messageId/priority - Update message priority
router.patch('/sessions/:id/messages/:messageId/priority', ensureSessionOwnership, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { priority } = req.body;
    
    if (typeof priority !== 'number') {
      return res.status(400).json({ error: 'Priority must be a number' });
    }
    
    const [updated] = await db.update(autonomyMessageQueue)
      .set({ priority })
      .where(eq(autonomyMessageQueue.id, messageId))
      .returning();
    
    res.json({ success: true, message: updated });
  } catch (error: any) {
    logger.error('Error updating message priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

export default router;
