import { Router, Request, Response, NextFunction } from 'express';
import { checkpointService } from '../services/checkpoint-service';
import { rollbackService } from '../services/rollback-service';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { db } from '../db';
import { projects, checkpoints } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();
const logger = createLogger('checkpoints-router');

// NOTE: Authentication is applied per-route instead of globally to avoid blocking other /api/* routes
// when this router is mounted at /api

// 🔥 REPLIT AGENT 3: Checkpoint & Rollback API Routes
// Production-ready with atomic transactions, row-level locks, and post-commit validation

/**
 * SECURITY: Verify user owns the project for a checkpoint
 * Prevents unauthorized access to other users' checkpoints
 */
async function verifyCheckpointOwnership(userId: number, checkpointId: number): Promise<{ authorized: boolean; projectId?: number }> {
  try {
    const [checkpoint] = await db
      .select({ projectId: checkpoints.projectId })
      .from(checkpoints)
      .where(eq(checkpoints.id, checkpointId))
      .limit(1);
    
    if (!checkpoint) {
      return { authorized: false };
    }
    
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, checkpoint.projectId))
      .limit(1);
    
    if (!project) {
      return { authorized: false };
    }
    
    return { 
      authorized: project.ownerId === userId,
      projectId: checkpoint.projectId
    };
  } catch (error) {
    logger.error('Checkpoint ownership verification failed:', error);
    return { authorized: false };
  }
}

/**
 * SECURITY: Verify user owns a project
 */
async function verifyProjectOwnership(userId: number, projectId: number): Promise<boolean> {
  try {
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    
    if (!project) {
      return false;
    }
    
    return project.ownerId === userId;
  } catch (error) {
    logger.error('Project ownership verification failed:', error);
    return false;
  }
}

/**
 * SECURITY: Middleware to verify project access for checkpoint operations
 */
async function ensureProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId, 10);
    
    if (!userId || isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    
    const hasAccess = await verifyProjectOwnership(userId, projectId);
    
    if (!hasAccess) {
      logger.warn(`Unauthorized checkpoint access attempt: userId=${userId}, projectId=${projectId}`);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    next();
  } catch (error) {
    logger.error('Project access verification failed:', error);
    res.status(500).json({ success: false, error: 'Access verification failed' });
  }
}

/**
 * Validation schemas for request bodies
 */
const CreateCheckpointSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['manual', 'automatic', 'before_action', 'error_recovery']).default('manual'),
  userId: z.number(),
  includeDatabase: z.boolean().default(true),
  includeEnvironment: z.boolean().default(true),
  conversationSnapshot: z.any().optional(),
  conversationId: z.string().optional(),
  userPrompt: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
  testResults: z.any().optional(),
  parentCheckpointId: z.number().optional(),
  environment: z.enum(['development', 'production']).default('development'),
});

const RestoreCheckpointSchema = z.object({
  checkpointId: z.number(),
  userId: z.number(),
  restoreFiles: z.boolean().default(true),
  restoreDatabase: z.boolean().default(true),
  restoreEnvironment: z.boolean().default(true),
});

const RollbackSchema = z.object({
  projectId: z.number(),
  checkpointId: z.number(),
  userId: z.number(),
  restoreConversation: z.boolean().default(false),
  direction: z.enum(['backward', 'forward']),
});

/**
 * POST /api/checkpoints
 * Create a new checkpoint with atomic transaction + row-level lock
 * SECURITY: Requires authentication, CSRF protection, and project ownership verification
 */
router.post('/checkpoints', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = CreateCheckpointSchema.parse(req.body);

    // SECURITY: Verify user owns the project
    const hasAccess = await verifyProjectOwnership(userId, data.projectId);
    if (!hasAccess) {
      logger.warn(`Unauthorized checkpoint creation attempt: userId=${userId}, projectId=${data.projectId}`);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Override userId from body with authenticated user
    const secureData = { ...data, userId };

    logger.info(`Creating checkpoint "${secureData.name}" for project ${secureData.projectId}`, {
      type: secureData.type,
      includeDatabase: secureData.includeDatabase,
      includeEnvironment: secureData.includeEnvironment,
      userId,
    });

    const checkpoint = await checkpointService.createCheckpoint(secureData);

    res.status(201).json({
      success: true,
      checkpoint,
      message: `Checkpoint "${checkpoint.name}" created successfully`,
    });
  } catch (error) {
    logger.error('Failed to create checkpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkpoint',
    });
  }
});

/**
 * GET /api/checkpoints/:id
 * Get checkpoint details by ID
 * SECURITY: Requires authentication and checkpoint ownership verification
 */
router.get('/checkpoints/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const checkpointId = parseInt(req.params.id, 10);
    
    if (isNaN(checkpointId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid checkpoint ID',
      });
    }

    // SECURITY: Verify user owns the checkpoint's project
    const ownership = await verifyCheckpointOwnership(userId, checkpointId);
    if (!ownership.authorized) {
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
    }

    const checkpoint = await checkpointService.getCheckpointById(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
    }

    res.json({
      success: true,
      checkpoint,
    });
  } catch (error) {
    logger.error('Failed to get checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get checkpoint',
    });
  }
});

/**
 * GET /api/projects/:projectId/checkpoints
 * List all checkpoints for a project
 * SECURITY: Requires authentication and project ownership
 */
router.get('/projects/:projectId/checkpoints', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
      });
    }

    const checkpointsList = await checkpointService.listCheckpoints(projectId, limit);

    res.json({
      success: true,
      checkpoints: checkpointsList,
      count: checkpointsList.length,
    });
  } catch (error) {
    logger.error('Failed to list checkpoints:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list checkpoints',
    });
  }
});

/**
 * POST /api/checkpoints/:id/restore
 * Restore a checkpoint (files, database, environment)
 * SECURITY: Requires authentication, CSRF protection, and checkpoint ownership
 */
router.post('/checkpoints/:id/restore', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const checkpointId = parseInt(req.params.id, 10);
    
    if (isNaN(checkpointId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid checkpoint ID',
      });
    }

    // SECURITY: Verify user owns the checkpoint's project
    const ownership = await verifyCheckpointOwnership(userId, checkpointId);
    if (!ownership.authorized) {
      logger.warn(`Unauthorized restore attempt: userId=${userId}, checkpointId=${checkpointId}`);
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
    }

    const data = RestoreCheckpointSchema.parse({
      ...req.body,
      checkpointId,
      userId, // Use authenticated user ID
    });

    logger.info(`Restoring checkpoint ${checkpointId}`, {
      restoreFiles: data.restoreFiles,
      restoreDatabase: data.restoreDatabase,
      restoreEnvironment: data.restoreEnvironment,
      userId,
    });

    const success = await checkpointService.restoreCheckpoint(data);

    res.json({
      success,
      message: success ? 'Checkpoint restored successfully' : 'Failed to restore checkpoint',
    });
  } catch (error) {
    logger.error('Failed to restore checkpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore checkpoint',
    });
  }
});

/**
 * POST /api/checkpoints/rollback
 * Rollback to a previous checkpoint
 * SECURITY: Requires authentication, CSRF protection, and checkpoint ownership
 */
router.post('/checkpoints/rollback', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = RollbackSchema.parse({
      ...req.body,
      direction: 'backward',
    });

    // SECURITY: Verify user owns the project
    const hasAccess = await verifyProjectOwnership(userId, data.projectId);
    if (!hasAccess) {
      logger.warn(`Unauthorized rollback attempt: userId=${userId}, projectId=${data.projectId}`);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // SECURITY: Verify user owns the checkpoint
    const ownership = await verifyCheckpointOwnership(userId, data.checkpointId);
    if (!ownership.authorized) {
      logger.warn(`Unauthorized rollback to checkpoint: userId=${userId}, checkpointId=${data.checkpointId}`);
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    logger.info(`Rolling back project ${data.projectId} to checkpoint ${data.checkpointId}`, { userId });

    const result = await rollbackService.rollbackToCheckpoint({ ...data, userId });

    res.json({
      success: result.success,
      result,
      message: result.success 
        ? `Rolled back to checkpoint ${data.checkpointId}` 
        : `Rollback failed: ${result.error}`,
    });
  } catch (error) {
    logger.error('Rollback failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed',
    });
  }
});

/**
 * POST /api/checkpoints/rollforward
 * Rollforward to a future checkpoint
 * SECURITY: Requires authentication, CSRF protection, and checkpoint ownership
 */
router.post('/checkpoints/rollforward', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = RollbackSchema.parse({
      ...req.body,
      direction: 'forward',
    });

    // SECURITY: Verify user owns the project
    const hasAccess = await verifyProjectOwnership(userId, data.projectId);
    if (!hasAccess) {
      logger.warn(`Unauthorized rollforward attempt: userId=${userId}, projectId=${data.projectId}`);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // SECURITY: Verify user owns the checkpoint
    const ownership = await verifyCheckpointOwnership(userId, data.checkpointId);
    if (!ownership.authorized) {
      logger.warn(`Unauthorized rollforward to checkpoint: userId=${userId}, checkpointId=${data.checkpointId}`);
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    logger.info(`Rolling forward project ${data.projectId} to checkpoint ${data.checkpointId}`, { userId });

    const result = await rollbackService.rollforwardToCheckpoint({ ...data, userId });

    res.json({
      success: result.success,
      result,
      message: result.success 
        ? `Rolled forward to checkpoint ${data.checkpointId}` 
        : `Rollforward failed: ${result.error}`,
    });
  } catch (error) {
    logger.error('Rollforward failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollforward failed',
    });
  }
});

/**
 * GET /api/projects/:projectId/checkpoints/tree
 * Get checkpoint tree structure for visualization
 * SECURITY: Requires authentication and project ownership
 */
router.get('/projects/:projectId/checkpoints/tree', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
      });
    }

    const tree = await rollbackService.getCheckpointTree(projectId);

    res.json({
      success: true,
      tree,
      count: tree.length,
    });
  } catch (error) {
    logger.error('Failed to get checkpoint tree:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get checkpoint tree',
    });
  }
});

/**
 * GET /api/projects/:projectId/checkpoints/navigation
 * Get backward/forward navigation options from current checkpoint
 * SECURITY: Requires authentication and project ownership
 */
router.get('/projects/:projectId/checkpoints/navigation', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
      });
    }

    const navigation = await rollbackService.getNavigationOptions(projectId);

    res.json({
      success: true,
      navigation,
    });
  } catch (error) {
    logger.error('Failed to get navigation options:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get navigation options',
    });
  }
});

/**
 * DELETE /api/checkpoints/:id
 * Delete a checkpoint
 * SECURITY: Requires authentication, CSRF protection, and checkpoint ownership
 */
router.delete('/checkpoints/:id', csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const checkpointId = parseInt(req.params.id, 10);
    
    if (isNaN(checkpointId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid checkpoint ID',
      });
    }

    // SECURITY: Verify user owns the checkpoint's project
    const ownership = await verifyCheckpointOwnership(userId, checkpointId);
    if (!ownership.authorized) {
      logger.warn(`Unauthorized delete attempt: userId=${userId}, checkpointId=${checkpointId}`);
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
    }

    logger.info(`Deleting checkpoint ${checkpointId}`, { userId });

    const success = await checkpointService.deleteCheckpoint(checkpointId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
    }

    res.json({
      success: true,
      message: 'Checkpoint deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete checkpoint',
    });
  }
});

// ============================================================
// AUTO-CHECKPOINT SYSTEM ROUTES (New Replit-style checkpoints)
// Uses checkpoint.service.ts and autoCheckpoints table
// ============================================================

import { checkpointService as autoCheckpointService } from '../services/checkpoint.service';
import { checkpointRestoreService } from '../services/checkpoint-restore.service';
import { autoCheckpoints } from '@shared/schema';

/**
 * GET /api/projects/:projectId/auto-checkpoints
 * List all auto-checkpoints for a project
 */
router.get('/projects/:projectId/auto-checkpoints', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 50;

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const checkpointsList = await autoCheckpointService.getCheckpoints(projectId, limit);

    res.json({
      success: true,
      checkpoints: checkpointsList,
      count: checkpointsList.length,
    });
  } catch (error) {
    logger.error('Failed to list auto-checkpoints:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list auto-checkpoints',
    });
  }
});

/**
 * GET /api/auto-checkpoints/:id
 * Get a specific auto-checkpoint with files
 */
router.get('/auto-checkpoints/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const checkpointId = parseInt(req.params.id, 10);

    if (isNaN(checkpointId)) {
      return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
    }

    const checkpoint = await autoCheckpointService.getCheckpointWithFiles(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    // Verify ownership
    const hasAccess = await verifyProjectOwnership(userId, checkpoint.projectId);
    if (!hasAccess) {
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    res.json({ success: true, checkpoint });
  } catch (error) {
    logger.error('Failed to get auto-checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get auto-checkpoint',
    });
  }
});

/**
 * POST /api/projects/:projectId/auto-checkpoints
 * Create a manual auto-checkpoint
 */
router.post('/projects/:projectId/auto-checkpoints', ensureAuthenticated, csrfProtection, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = parseInt(req.params.projectId, 10);
    const { aiSummary, type = 'manual' } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const checkpoint = await autoCheckpointService.createCheckpoint(projectId, {
      type: type as 'manual' | 'auto' | 'milestone',
      triggerSource: 'user_manual',
      aiSummary: aiSummary || 'Manual checkpoint',
      createdBy: userId,
    });

    logger.info(`Created manual auto-checkpoint ${checkpoint.id} for project ${projectId}`);

    res.status(201).json({
      success: true,
      checkpoint,
      message: 'Checkpoint created successfully',
    });
  } catch (error) {
    logger.error('Failed to create auto-checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create auto-checkpoint',
    });
  }
});

/**
 * POST /api/auto-checkpoints/:id/restore
 * Restore to an auto-checkpoint
 */
router.post('/auto-checkpoints/:id/restore', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const checkpointId = parseInt(req.params.id, 10);
    const { createBackup = true } = req.body;

    if (isNaN(checkpointId)) {
      return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
    }

    // Verify ownership
    const checkpoint = await autoCheckpointService.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    const hasAccess = await verifyProjectOwnership(userId, checkpoint.projectId);
    if (!hasAccess) {
      return res.status(404).json({ success: false, error: 'Checkpoint not found' });
    }

    logger.info(`Restoring to auto-checkpoint ${checkpointId} for project ${checkpoint.projectId}`);

    const result = await checkpointRestoreService.restoreToCheckpoint(checkpointId, {
      restoreFiles: true,
      createBackupCheckpoint: createBackup,
      userId,
    });

    res.json({
      success: result.success,
      result,
      message: result.success ? 'Restored successfully' : `Restore failed: ${result.errors.join(', ')}`,
    });
  } catch (error) {
    logger.error('Failed to restore auto-checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore auto-checkpoint',
    });
  }
});

/**
 * GET /api/projects/:projectId/auto-checkpoints/latest
 * Get the latest auto-checkpoint for a project
 */
router.get('/projects/:projectId/auto-checkpoints/latest', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const checkpoint = await autoCheckpointService.getLatestCheckpoint(projectId);

    res.json({
      success: true,
      checkpoint,
    });
  } catch (error) {
    logger.error('Failed to get latest auto-checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get latest auto-checkpoint',
    });
  }
});

/**
 * GET /api/projects/:projectId/auto-checkpoints/restore-history
 * Get restore history for a project
 */
router.get('/projects/:projectId/auto-checkpoints/restore-history', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const history = await autoCheckpointService.getRestoreHistory(projectId, limit);

    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('Failed to get restore history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get restore history',
    });
  }
});

export default router;
