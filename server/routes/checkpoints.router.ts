import { Router, Request, Response } from 'express';
import { db } from '../db';
import { checkpoints, checkpointPositions } from '@shared/schema';
import type { CheckpointStateSnapshot } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createCheckpoint as coreCreateCheckpoint, restoreCheckpoint as coreRestoreCheckpoint, getCheckpointDiff as coreGetCheckpointDiff } from '../checkpointService';
import { storage } from '../storage';

const router = Router();

async function verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
  try {
    const project = await storage.getProject(projectId);
    return String(project?.userId) === String(userId);
  } catch {
    return false;
  }
}

router.get('/projects/:projectId/checkpoints', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.json({ checkpoints: [], currentCheckpointId: null, divergedFromId: null });

    const cpList = await storage.getCheckpoints(projectId);
    const position = await storage.getCheckpointPosition(projectId);

    const mapped = cpList.map(cp => {
      const snap = cp.stateSnapshot as CheckpointStateSnapshot | null;
      return {
        id: cp.id,
        projectId: cp.projectId,
        userId: cp.userId,
        description: cp.description || cp.aiDescription || 'Checkpoint',
        type: cp.type || 'manual',
        trigger: cp.trigger || cp.triggerType || 'manual',
        fileCount: snap?.files?.length || 0,
        packageCount: snap?.packages?.length || 0,
        sizeBytes: cp.sizeBytes || 0,
        creditsCost: cp.creditsCost || 0,
        gitCommitHash: cp.gitCommitHash || null,
        createdAt: cp.createdAt?.toISOString() || new Date().toISOString(),
      };
    });

    res.json({
      checkpoints: mapped,
      currentCheckpointId: position?.currentCheckpointId || null,
      divergedFromId: position?.divergedFromId || null,
    });
  } catch (error) {
    console.error('[checkpoints] list error:', error);
    res.json({ checkpoints: [], currentCheckpointId: null, divergedFromId: null });
  }
});

router.post('/projects/:projectId/checkpoints', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: 'Access denied' });

    const { description, trigger } = req.body || {};
    const triggerType = trigger || 'manual';

    const cp = await coreCreateCheckpoint(projectId, userId, triggerType, description || undefined);
    const snap = cp.stateSnapshot as CheckpointStateSnapshot | null;

    res.status(201).json({
      success: true,
      checkpoint: {
        id: cp.id,
        projectId: cp.projectId,
        userId: cp.userId,
        description: cp.description,
        type: cp.type,
        trigger: cp.trigger,
        fileCount: snap?.files?.length || 0,
        sizeBytes: cp.sizeBytes || 0,
        creditsCost: cp.creditsCost || 0,
        gitCommitHash: cp.gitCommitHash || null,
        createdAt: cp.createdAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[checkpoints] create error:', error?.message || error, error?.stack?.slice(0, 500));
    res.status(500).json({ success: false, error: error?.message || 'Failed to create checkpoint' });
  }
});

router.get('/projects/:projectId/checkpoints/:cpId/diff', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, cpId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.status(403).json({ added: [], removed: [], modified: [] });

    const cp = await storage.getCheckpoint(cpId);
    if (!cp || cp.projectId !== projectId) return res.status(404).json({ added: [], removed: [], modified: [] });

    const diff = await coreGetCheckpointDiff(cpId);
    if (!diff) return res.status(404).json({ added: [], removed: [], modified: [] });

    res.json(diff);
  } catch (error) {
    console.error('[checkpoints] diff error:', error);
    res.status(500).json({ added: [], removed: [], modified: [] });
  }
});

router.post('/projects/:projectId/checkpoints/:cpId/restore', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, cpId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: 'Access denied' });

    const cp = await storage.getCheckpoint(cpId);
    if (!cp || cp.projectId !== projectId) return res.status(404).json({ success: false, error: 'Checkpoint not found' });

    await coreCreateCheckpoint(projectId, userId, 'pre_risky_op', 'Before restore');

    const { includeDatabase } = req.body || {};
    const result = await coreRestoreCheckpoint(cpId, { includeDatabase: !!includeDatabase });

    res.json(result);
  } catch (error) {
    console.error('[checkpoints] restore error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore checkpoint' });
  }
});

router.delete('/projects/:projectId/checkpoints/:cpId', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, cpId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: 'Access denied' });

    const cp = await storage.getCheckpoint(cpId);
    if (!cp || cp.projectId !== projectId) return res.status(404).json({ success: false, error: 'Checkpoint not found' });

    const success = await storage.deleteCheckpoint(cpId);
    if (!success) return res.status(404).json({ success: false, error: 'Checkpoint not found' });

    const position = await storage.getCheckpointPosition(projectId);
    if (position?.currentCheckpointId === cpId) {
      const remaining = await storage.getCheckpoints(projectId);
      await storage.setCheckpointPosition(projectId, remaining[0]?.id || null, null);
    }

    res.json({ success: true, message: 'Checkpoint deleted' });
  } catch (error) {
    console.error('[checkpoints] delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete checkpoint' });
  }
});

router.get('/projects/:projectId/checkpoints/navigation', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.json({ success: true, navigation: { canRollback: false, canRollforward: false, currentCheckpoint: null, previousCheckpoint: null, nextCheckpoint: null, history: [] } });

    const cpList = await storage.getCheckpoints(projectId);
    const position = await storage.getCheckpointPosition(projectId);

    const currentIdx = position?.currentCheckpointId ? cpList.findIndex(c => c.id === position.currentCheckpointId) : 0;
    const canRollback = currentIdx < cpList.length - 1;
    const canRollforward = currentIdx > 0;

    res.json({
      success: true,
      navigation: {
        canRollback,
        canRollforward,
        currentCheckpoint: cpList[currentIdx] || null,
        previousCheckpoint: canRollback ? cpList[currentIdx + 1] : null,
        nextCheckpoint: canRollforward ? cpList[currentIdx - 1] : null,
        history: cpList,
      },
    });
  } catch (error) {
    console.error('[checkpoints] navigation error:', error);
    res.json({ success: true, navigation: { canRollback: false, canRollforward: false, currentCheckpoint: null, previousCheckpoint: null, nextCheckpoint: null, history: [] } });
  }
});

router.get('/projects/:projectId/checkpoints/tree', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) return res.json({ success: true, tree: [], count: 0 });

    const cpList = await storage.getCheckpoints(projectId);
    res.json({ success: true, tree: cpList, count: cpList.length });
  } catch (error) {
    console.error('[checkpoints] tree error:', error);
    res.json({ success: true, tree: [], count: 0 });
  }
});

export { coreCreateCheckpoint as createAutoCheckpoint };

export default router;
