/**
 * Unified Checkpoints API Router
 * Replit-style checkpoint system with full CRUD operations
 * 
 * Uses autoCheckpoints table as the single source of truth
 * Combines functionality from:
 * - checkpoints.router.ts (legacy manual checkpoints)
 * - auto-checkpoints.router.ts (auto/milestone checkpoints)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import {
  autoCheckpoints,
  autoCheckpointFiles,
  checkpointRestores,
  projects,
  type AutoCheckpoint,
} from '@shared/schema';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { checkpointRestoreService } from '../services/checkpoint-restore.service';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';

const logger = createLogger('unified-checkpoints-router');
const router = Router();

/**
 * SECURITY: Verify user owns the project
 */
async function verifyProjectOwnership(projectId: number, userId: number): Promise<{ valid: boolean; error?: string }> {
  try {
    const project = await storage.getProject(String(projectId));
    if (!project) {
      return { valid: false, error: 'Project not found' };
    }
    if (project.ownerId !== userId) {
      return { valid: false, error: 'Access denied: You do not own this project' };
    }
    return { valid: true };
  } catch (error) {
    logger.error('Project ownership verification failed:', error);
    return { valid: false, error: 'Access verification failed' };
  }
}

/**
 * SECURITY: Verify user owns the checkpoint's project
 */
async function verifyCheckpointOwnership(checkpointId: number, userId: number): Promise<{ valid: boolean; projectId?: number; error?: string }> {
  try {
    const [checkpoint] = await db
      .select({ projectId: autoCheckpoints.projectId })
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.id, checkpointId))
      .limit(1);

    if (!checkpoint) {
      return { valid: false, error: 'Checkpoint not found' };
    }

    const ownership = await verifyProjectOwnership(checkpoint.projectId, userId);
    return { ...ownership, projectId: checkpoint.projectId };
  } catch (error) {
    logger.error('Checkpoint ownership verification failed:', error);
    return { valid: false, error: 'Access verification failed' };
  }
}

/**
 * Middleware to verify project access for checkpoint operations
 */
async function ensureProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId, 10);

    if (!userId || isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    const ownership = await verifyProjectOwnership(projectId, userId);
    if (!ownership.valid) {
      logger.warn(`Unauthorized checkpoint access attempt: userId=${userId}, projectId=${projectId}`);
      return res.status(403).json({ success: false, error: ownership.error });
    }

    next();
  } catch (error) {
    logger.error('Project access verification failed:', error);
    res.status(500).json({ success: false, error: 'Access verification failed' });
  }
}

// ========================================
// Validation Schemas
// ========================================

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['auto', 'manual', 'milestone', 'before_action', 'error_recovery']).optional(),
  status: z.enum(['pending', 'creating', 'complete', 'failed']).optional(),
  environment: z.enum(['development', 'production']).optional(),
});

const createCheckpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['auto', 'manual', 'milestone', 'before_action', 'error_recovery']).default('manual'),
  triggerSource: z.string().max(100).optional(),
  aiSummary: z.string().optional(),
  userPrompt: z.string().optional(),
  conversationId: z.string().optional(),
  conversationSnapshot: z.array(z.object({
    role: z.string(),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
  filesSnapshot: z.record(z.object({
    hash: z.string(),
    size: z.number(),
  })).optional(),
  changedFiles: z.array(z.string()).optional(),
  includesDatabase: z.boolean().default(false),
  databaseBranchId: z.string().optional(),
  environment: z.enum(['development', 'production']).default('development'),
  screenshotUrl: z.string().url().optional(),
  testResults: z.object({
    passed: z.boolean(),
    total: z.number(),
    failures: z.array(z.any()),
  }).optional(),
  parentCheckpointId: z.number().optional(),
  retainedUntil: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const restoreCheckpointSchema = z.object({
  createBackup: z.boolean().default(true),
  restoreFiles: z.boolean().default(true),
  restoreDatabase: z.boolean().default(false),
  restoreConversation: z.boolean().default(false),
});

const updateCheckpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['pending', 'creating', 'complete', 'failed']).optional(),
  aiSummary: z.string().optional(),
  filesSnapshot: z.record(z.object({
    hash: z.string(),
    size: z.number(),
  })).optional(),
  retainedUntil: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const addFilesSchema = z.object({
  files: z.array(z.object({
    filePath: z.string().max(500),
    fileHash: z.string().max(64).optional(),
    fileContent: z.string().optional(),
    diffFromPrevious: z.string().optional(),
  })).min(1).max(1000),
});

// ========================================
// Routes
// ========================================

/**
 * GET /projects/:projectId/checkpoints
 * List all checkpoints for a project with pagination and filtering
 */
router.get(
  '/projects/:projectId/checkpoints',
  ensureAuthenticated,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      
      const validation = paginationSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { page, limit, type, status, environment } = validation.data;
      const offset = (page - 1) * limit;

      const conditions = [eq(autoCheckpoints.projectId, projectId)];
      if (type) {
        conditions.push(eq(autoCheckpoints.type, type));
      }
      if (status) {
        conditions.push(eq(autoCheckpoints.status, status));
      }
      if (environment) {
        conditions.push(eq(autoCheckpoints.environment, environment));
      }

      const checkpoints = await db
        .select()
        .from(autoCheckpoints)
        .where(and(...conditions))
        .orderBy(desc(autoCheckpoints.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(autoCheckpoints)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      res.json({
        success: true,
        checkpoints,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to list checkpoints:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list checkpoints',
      });
    }
  }
);

/**
 * POST /projects/:projectId/checkpoints
 * Create a new checkpoint (manual or auto)
 */
router.post(
  '/projects/:projectId/checkpoints',
  ensureAuthenticated,
  csrfProtection,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const userId = req.user!.id;

      const validation = createCheckpointSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const data = validation.data;

      const [checkpoint] = await db
        .insert(autoCheckpoints)
        .values({
          projectId,
          name: data.name || `Checkpoint ${new Date().toISOString()}`,
          type: data.type,
          triggerSource: data.triggerSource || (data.type === 'manual' ? 'user_manual' : 'system'),
          filesSnapshot: data.filesSnapshot ?? {},
          changedFiles: data.changedFiles ?? [],
          includesDatabase: data.includesDatabase ?? false,
          environment: data.environment ?? 'development',
          metadata: data.metadata ?? {},
          createdBy: userId,
          status: 'pending',
          description: data.description ?? null,
          aiSummary: data.aiSummary ?? null,
          userPrompt: data.userPrompt ?? null,
          conversationId: data.conversationId ?? null,
          conversationSnapshot: data.conversationSnapshot ?? null,
          databaseBranchId: data.databaseBranchId ?? null,
          screenshotUrl: data.screenshotUrl ?? null,
          testResults: data.testResults ?? null,
          parentCheckpointId: data.parentCheckpointId ?? null,
          retainedUntil: data.retainedUntil ? new Date(data.retainedUntil) : null,
        })
        .returning();

      logger.info(`Created checkpoint ${checkpoint.id} for project ${projectId}`, {
        type: checkpoint.type,
        userId,
      });

      res.status(201).json({
        success: true,
        checkpoint,
        message: `Checkpoint "${checkpoint.name}" created successfully`,
      });
    } catch (error) {
      logger.error('Failed to create checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkpoint',
      });
    }
  }
);

/**
 * GET /projects/:projectId/checkpoints/:checkpointId
 * Get checkpoint details by ID
 */
router.get(
  '/projects/:projectId/checkpoints/:checkpointId',
  ensureAuthenticated,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const [checkpoint] = await db
        .select()
        .from(autoCheckpoints)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .limit(1);

      if (!checkpoint) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      const fileCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(autoCheckpointFiles)
        .where(eq(autoCheckpointFiles.checkpointId, checkpointId));

      const fileCount = fileCountResult[0]?.count ?? 0;

      const restores = await db
        .select()
        .from(checkpointRestores)
        .where(eq(checkpointRestores.checkpointId, checkpointId))
        .orderBy(desc(checkpointRestores.restoredAt))
        .limit(10);

      res.json({
        success: true,
        checkpoint,
        fileCount,
        restoreHistory: restores,
      });
    } catch (error) {
      logger.error('Failed to get checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get checkpoint',
      });
    }
  }
);

/**
 * POST /projects/:projectId/checkpoints/:checkpointId/restore
 * Restore to a checkpoint
 */
router.post(
  '/projects/:projectId/checkpoints/:checkpointId/restore',
  ensureAuthenticated,
  csrfProtection,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);
      const userId = req.user!.id;

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const validation = restoreCheckpointSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const [checkpoint] = await db
        .select()
        .from(autoCheckpoints)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .limit(1);

      if (!checkpoint) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      if (checkpoint.status !== 'complete') {
        return res.status(400).json({
          success: false,
          error: 'Cannot restore checkpoint',
          reason: `Checkpoint status is "${checkpoint.status}", must be "complete"`,
        });
      }

      const { createBackup, restoreFiles, restoreDatabase, restoreConversation } = validation.data;

      logger.info(`Restoring checkpoint ${checkpointId} for project ${projectId}`, {
        createBackup,
        restoreFiles,
        restoreDatabase,
        restoreConversation,
        userId,
      });

      const restoreResult = await checkpointRestoreService.restoreToCheckpoint(
        checkpointId,
        {
          restoreFiles,
          restoreDatabase,
          restoreConversation,
          createBackupCheckpoint: createBackup,
          userId,
        }
      );

      if (!restoreResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Checkpoint restore failed',
          errors: restoreResult.errors,
          duration: restoreResult.duration,
        });
      }

      await db
        .update(autoCheckpoints)
        .set({ rollbackCount: sql`${autoCheckpoints.rollbackCount} + 1` })
        .where(eq(autoCheckpoints.id, checkpointId));

      res.json({
        success: true,
        message: 'Checkpoint restored successfully',
        restore: {
          checkpointId,
          projectId: restoreResult.projectId,
          status: 'completed',
          restoredFiles: restoreResult.restoredFiles,
          restoredDatabase: restoreResult.restoredDatabase,
          restoredConversation: restoreResult.restoredConversation,
          duration: restoreResult.duration,
          backupCheckpointId: (restoreResult as { backupCheckpointId?: number }).backupCheckpointId,
        },
        errors: restoreResult.errors.length > 0 ? restoreResult.errors : undefined,
      });
    } catch (error) {
      logger.error('Failed to restore checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore checkpoint',
      });
    }
  }
);

/**
 * GET /projects/:projectId/checkpoints/:checkpointId/files
 * Get files for a checkpoint with pagination
 */
router.get(
  '/projects/:projectId/checkpoints/:checkpointId/files',
  ensureAuthenticated,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const validation = paginationSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { page, limit } = validation.data;
      const offset = (page - 1) * limit;

      const [checkpoint] = await db
        .select({ id: autoCheckpoints.id })
        .from(autoCheckpoints)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .limit(1);

      if (!checkpoint) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      const files = await db
        .select()
        .from(autoCheckpointFiles)
        .where(eq(autoCheckpointFiles.checkpointId, checkpointId))
        .orderBy(autoCheckpointFiles.filePath)
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(autoCheckpointFiles)
        .where(eq(autoCheckpointFiles.checkpointId, checkpointId));

      const total = countResult[0]?.count ?? 0;

      res.json({
        success: true,
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to get checkpoint files:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get checkpoint files',
      });
    }
  }
);

/**
 * DELETE /api/projects/:projectId/checkpoints/:checkpointId
 * Delete a checkpoint (hard delete - files cascade automatically)
 */
router.delete(
  '/projects/:projectId/checkpoints/:checkpointId',
  ensureAuthenticated,
  csrfProtection,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);
      const userId = req.user!.id;

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const soft = req.query.soft === 'true';

      const [checkpoint] = await db
        .select()
        .from(autoCheckpoints)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .limit(1);

      if (!checkpoint) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      logger.info(`Deleting checkpoint ${checkpointId} for project ${projectId}`, {
        soft,
        userId,
      });

      if (soft) {
        await db
          .update(autoCheckpoints)
          .set({
            status: 'failed',
            metadata: sql`${autoCheckpoints.metadata} || '{"deleted": true, "deletedAt": "${new Date().toISOString()}", "deletedBy": ${userId}}'::jsonb`,
          })
          .where(eq(autoCheckpoints.id, checkpointId));

        res.json({
          success: true,
          message: 'Checkpoint soft deleted successfully',
          checkpointId,
        });
      } else {
        const [deleted] = await db
          .delete(autoCheckpoints)
          .where(eq(autoCheckpoints.id, checkpointId))
          .returning();

        res.json({
          success: true,
          message: 'Checkpoint deleted successfully',
          deletedCheckpoint: deleted,
        });
      }
    } catch (error) {
      logger.error('Failed to delete checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete checkpoint',
      });
    }
  }
);

/**
 * PATCH /api/projects/:projectId/checkpoints/:checkpointId
 * Update checkpoint metadata
 */
router.patch(
  '/projects/:projectId/checkpoints/:checkpointId',
  ensureAuthenticated,
  csrfProtection,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const validation = updateCheckpointSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const updateData: Record<string, any> = {};
      const data = validation.data;

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.aiSummary !== undefined) updateData.aiSummary = data.aiSummary;
      if (data.filesSnapshot !== undefined) updateData.filesSnapshot = data.filesSnapshot;
      if (data.retainedUntil !== undefined) updateData.retainedUntil = new Date(data.retainedUntil);
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid update fields provided' });
      }

      const [updated] = await db
        .update(autoCheckpoints)
        .set(updateData)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      res.json({
        success: true,
        message: 'Checkpoint updated successfully',
        checkpoint: updated,
      });
    } catch (error) {
      logger.error('Failed to update checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update checkpoint',
      });
    }
  }
);

/**
 * POST /api/projects/:projectId/checkpoints/:checkpointId/files
 * Add files to a checkpoint
 */
router.post(
  '/projects/:projectId/checkpoints/:checkpointId/files',
  ensureAuthenticated,
  csrfProtection,
  ensureProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const checkpointId = parseInt(req.params.checkpointId, 10);

      if (isNaN(checkpointId)) {
        return res.status(400).json({ success: false, error: 'Invalid checkpoint ID' });
      }

      const validation = addFilesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const [checkpoint] = await db
        .select({ id: autoCheckpoints.id })
        .from(autoCheckpoints)
        .where(and(
          eq(autoCheckpoints.id, checkpointId),
          eq(autoCheckpoints.projectId, projectId)
        ))
        .limit(1);

      if (!checkpoint) {
        return res.status(404).json({ success: false, error: 'Checkpoint not found' });
      }

      const filesToInsert = validation.data.files.map(file => ({
        checkpointId,
        filePath: file.filePath,
        fileHash: file.fileHash,
        fileContent: file.fileContent,
        diffFromPrevious: file.diffFromPrevious,
      }));

      const insertedFiles = await db
        .insert(autoCheckpointFiles)
        .values(filesToInsert)
        .returning();

      res.status(201).json({
        success: true,
        message: `${insertedFiles.length} files added to checkpoint`,
        files: insertedFiles,
      });
    } catch (error) {
      logger.error('Failed to add files to checkpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add files to checkpoint',
      });
    }
  }
);

export default router;
