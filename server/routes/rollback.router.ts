// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { deploymentRollbackService } from '../services/deployment-rollback';
import { deploymentWebSocketService } from '../services/deployment-websocket-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('rollback-router');
const router = Router();

const rollbackOptionsSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  skipDatabase: z.boolean().optional().default(false),
  skipFiles: z.boolean().optional().default(false),
  skipConfig: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
  reason: z.string().optional(),
  force: z.boolean().optional().default(false),
});

const createSnapshotSchema = z.object({
  version: z.string().optional(),
  reason: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

router.get('/deployments/:deploymentId/snapshots', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { environment, status, limit } = req.query;
    
    logger.info('Fetching deployment snapshots', { deploymentId, environment, status });
    
    const options: { environment?: string; status?: string; limit?: number } = {};
    if (environment) options.environment = environment as string;
    if (status) options.status = status as string;
    if (limit) options.limit = parseInt(limit as string, 10);
    
    const snapshots = await deploymentRollbackService.listSnapshots(deploymentId, options);
    
    res.json({
      success: true,
      snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    logger.error('Failed to fetch snapshots', { deploymentId: req.params.deploymentId, error });
    res.status(500).json({
      success: false,
      error: 'FETCH_SNAPSHOTS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch deployment snapshots',
    });
  }
});

router.get('/deployments/:deploymentId/snapshots/:snapshotId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deploymentId, snapshotId } = req.params;
    
    logger.info('Fetching snapshot details', { deploymentId, snapshotId });
    
    const snapshot = await deploymentRollbackService.findSnapshotInDeployment(deploymentId, snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'SNAPSHOT_NOT_FOUND',
        message: `Snapshot ${snapshotId} not found for deployment ${deploymentId}`,
      });
    }
    
    res.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    logger.error('Failed to fetch snapshot', { deploymentId: req.params.deploymentId, snapshotId: req.params.snapshotId, error });
    res.status(500).json({
      success: false,
      error: 'FETCH_SNAPSHOT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch snapshot details',
    });
  }
});

router.post('/deployments/:deploymentId/rollback', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.id;
    
    logger.info('Initiating rollback', { deploymentId, userId, body: req.body });
    
    const validatedData = rollbackOptionsSchema.parse(req.body);
    
    deploymentWebSocketService.broadcastDeployLog(
      deploymentId,
      `[Rollback] Admin ${userId} initiated rollback to version ${validatedData.version}`
    );
    
    const result = await deploymentRollbackService.performRollback(
      deploymentId,
      validatedData.version,
      {
        skipDatabase: validatedData.skipDatabase,
        skipFiles: validatedData.skipFiles,
        skipConfig: validatedData.skipConfig,
        dryRun: validatedData.dryRun,
        reason: validatedData.reason,
        force: validatedData.force,
      }
    );
    
    if (result.success) {
      logger.info('Rollback completed successfully', { deploymentId, rollbackId: result.rollbackId, restoredVersion: result.restoredVersion });
      
      res.json({
        success: true,
        rollbackId: result.rollbackId,
        restoredVersion: result.restoredVersion,
        details: result.details,
        message: `Successfully rolled back to version ${result.restoredVersion}`,
      });
    } else {
      logger.warn('Rollback failed', { deploymentId, rollbackId: result.rollbackId, error: result.details.error });
      
      res.status(400).json({
        success: false,
        error: 'ROLLBACK_FAILED',
        rollbackId: result.rollbackId,
        details: result.details,
        message: result.details.error || 'Rollback operation failed',
      });
    }
  } catch (error) {
    logger.error('Rollback error', { deploymentId: req.params.deploymentId, error });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid rollback options',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'ROLLBACK_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred during rollback',
    });
  }
});

router.get('/deployments/:deploymentId/rollback/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { rollbackId } = req.query;
    
    logger.info('Fetching rollback status', { deploymentId, rollbackId });
    
    let status;
    if (rollbackId) {
      status = await deploymentRollbackService.getRollbackStatus(rollbackId as string);
    } else {
      status = await deploymentRollbackService.getActiveRollback(deploymentId);
    }
    
    if (!status) {
      return res.json({
        success: true,
        status: null,
        message: 'No active rollback found for this deployment',
      });
    }
    
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    logger.error('Failed to fetch rollback status', { deploymentId: req.params.deploymentId, error });
    res.status(500).json({
      success: false,
      error: 'FETCH_STATUS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch rollback status',
    });
  }
});

router.post('/deployments/:deploymentId/snapshot', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.id;
    
    logger.info('Creating manual snapshot', { deploymentId, userId, body: req.body });
    
    const validatedData = createSnapshotSchema.parse(req.body);
    
    const version = validatedData.version || `manual-${Date.now()}`;
    const deploymentPath = `/tmp/deployments/${deploymentId}`;
    
    deploymentWebSocketService.broadcastDeployLog(
      deploymentId,
      `[Snapshot] Admin ${userId} creating manual snapshot: ${version}`
    );
    
    const snapshot = await deploymentRollbackService.createSnapshot(
      deploymentId,
      version,
      deploymentPath,
      {
        environmentVars: {},
        dependencies: {},
      },
      {
        deployedBy: String(userId),
        reason: validatedData.reason || 'Manual snapshot',
        tags: validatedData.tags,
      }
    );
    
    logger.info('Snapshot created successfully', { deploymentId, snapshotId: snapshot.id, version: snapshot.version });
    
    res.status(201).json({
      success: true,
      snapshot,
      message: `Snapshot ${snapshot.version} created successfully`,
    });
  } catch (error) {
    logger.error('Failed to create snapshot', { deploymentId: req.params.deploymentId, error });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid snapshot configuration',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'SNAPSHOT_ERROR',
      message: error instanceof Error ? error.message : 'Failed to create snapshot',
    });
  }
});

router.post('/deployments/:deploymentId/rollback/cancel', ensureAuthenticated, ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { rollbackId } = req.body;
    const userId = req.user!.id;
    
    logger.info('Cancelling rollback', { deploymentId, rollbackId, userId });
    
    if (!rollbackId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Rollback ID is required',
      });
    }
    
    const result = await deploymentRollbackService.cancelRollback(rollbackId);
    
    deploymentWebSocketService.broadcastDeployLog(
      deploymentId,
      `[Rollback] Admin ${userId} cancelled rollback ${rollbackId}`
    );
    
    res.json({
      success: true,
      message: 'Rollback cancelled successfully',
      result,
    });
  } catch (error) {
    logger.error('Failed to cancel rollback', { deploymentId: req.params.deploymentId, error });
    res.status(500).json({
      success: false,
      error: 'CANCEL_FAILED',
      message: error instanceof Error ? error.message : 'Failed to cancel rollback',
    });
  }
});

router.get('/deployments/:deploymentId/diff', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { v1, v2 } = req.query;
    
    if (!v1 || !v2) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Both v1 and v2 query parameters are required',
      });
    }
    
    logger.info('Computing version diff', { deploymentId, v1, v2 });
    
    const diff = await deploymentRollbackService.compareVersions(
      deploymentId,
      v1 as string,
      v2 as string
    );
    
    res.json({
      success: true,
      diff,
    });
  } catch (error) {
    logger.error('Failed to compute diff', { deploymentId: req.params.deploymentId, error });
    res.status(500).json({
      success: false,
      error: 'DIFF_FAILED',
      message: error instanceof Error ? error.message : 'Failed to compute version diff',
    });
  }
});

router.get('/deployments/:deploymentId/rollback/history', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { limit = '10', offset = '0' } = req.query;
    
    logger.info('Fetching rollback history', { deploymentId, limit, offset });
    
    const history = await deploymentRollbackService.getRollbackHistory(
      deploymentId,
      {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      }
    );
    
    res.json({
      success: true,
      history,
    });
  } catch (error) {
    logger.error('Failed to fetch rollback history', { deploymentId: req.params.deploymentId, error });
    res.status(500).json({
      success: false,
      error: 'FETCH_HISTORY_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch rollback history',
    });
  }
});

export default router;
