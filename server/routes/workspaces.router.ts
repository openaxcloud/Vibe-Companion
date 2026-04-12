/**
 * Workspaces Router  (/api/workspaces/*)
 * ─────────────────────────────────────────────────────────────────
 * Simplified "one-call" endpoint for the IDE frontend.
 *
 * POST /api/workspaces/:projectId
 *   Creates (or returns existing) workspace and returns everything the IDE needs:
 *   workspaceId, runnerUrl, access token, terminal WS URL, preview URL.
 *
 *   If the Runner is offline, returns online=false instead of throwing.
 *   The IDE uses this to show a "Runner unavailable" badge rather than crashing.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { runnerWorkspaces, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as runner from '../runnerClient';

const logger = createLogger('workspaces');
const router = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  const userId = (req as any).session?.userId
    || ((typeof req.isAuthenticated === 'function' && req.isAuthenticated()) ? (req.user as any)?.id : undefined);
  if (userId) {
    (req as any)._userId = userId;
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

router.use(requireAuth);

router.get('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

  const runnerMode = process.env.RUNNER_MODE || "local";
  if (runnerMode === "local" || !runner.isRunnerConfigured()) {
    return res.json({
      online: true,
      workspaceId: `local-${projectId}`,
      runnerUrl: `http://localhost:${process.env.PORT || 5000}`,
      localMode: true,
    });
  }

  try {
    const numericId = parseInt(projectId, 10);
    if (isNaN(numericId)) {
      return res.json({ online: false, reason: 'Runner requires numeric project IDs' });
    }

    const [existing] = await db
      .select()
      .from(runnerWorkspaces)
      .where(eq(runnerWorkspaces.projectId, numericId))
      .limit(1);

    if (!existing) {
      return res.json({ online: false, reason: 'No workspace found' });
    }

    const userId = (req as any)._userId ?? 0;
    const token = runner.generateAccessToken(existing.workspaceId, userId);

    return res.json({
      online: true,
      workspaceId: existing.workspaceId,
      runnerUrl: existing.runnerUrl ?? (await runner.pingRunner()).baseUrl,
      token,
      terminalWsUrl: runner.buildTerminalWsUrl(existing.workspaceId),
      previewUrl: `/api/runner/preview/${existing.workspaceId}`,
    });
  } catch (err: any) {
    logger.warn(`Workspace GET error: ${err.message}`);
    return res.json({ online: false, reason: 'Workspace lookup failed' });
  }
});

router.post('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

  const runnerMode = process.env.RUNNER_MODE || "local";

  if (runnerMode === "local" || !runner.isRunnerConfigured()) {
    return res.json({
      online: true,
      workspaceId: `local-${projectId}`,
      runnerUrl: `http://localhost:${process.env.PORT || 5000}`,
      localMode: true,
    });
  }

  try {
    const numericId = parseInt(projectId, 10);
    if (isNaN(numericId)) {
      return res.json({ online: false, reason: 'Runner requires numeric project IDs' });
    }

    const health = await runner.pingRunner();
    if (!health.online) {
      logger.warn(`Runner offline when creating workspace for project ${projectId}`);
      return res.json({
        online: false,
        baseUrl: health.baseUrl,
        reason: 'Runner service is unreachable',
      });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, numericId))
      .limit(1);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [existing] = await db
      .select()
      .from(runnerWorkspaces)
      .where(eq(runnerWorkspaces.projectId, numericId))
      .limit(1);

    const userId = (req as any)._userId ?? 0;

    if (existing) {
      const token = runner.generateAccessToken(existing.workspaceId, userId);
      return res.json({
        online: true,
        workspaceId: existing.workspaceId,
        runnerUrl: existing.runnerUrl ?? health.baseUrl,
        token,
        terminalWsUrl: runner.buildTerminalWsUrl(existing.workspaceId),
        previewUrl: `/api/runner/preview/${existing.workspaceId}`,
      });
    }

    const info = await runner.createWorkspace(numericId, project.name);
    if (!info) {
      return res.json({
        online: false,
        baseUrl: health.baseUrl,
        reason: 'Runner failed to create workspace',
      });
    }

    const [saved] = await db
      .insert(runnerWorkspaces)
      .values({
        projectId: numericId,
        workspaceId: info.workspaceId,
        status: info.status ?? 'starting',
        previewUrl: info.previewUrl ?? runner.buildPreviewUrl(info.workspaceId),
        runnerUrl: process.env.RUNNER_BASE_URL ?? null,
      })
      .returning();

    const token = runner.generateAccessToken(saved.workspaceId, userId);

    logger.info(`Workspace ${saved.workspaceId} created for project ${projectId}`);

    res.status(201).json({
      online: true,
      workspaceId: saved.workspaceId,
      runnerUrl: saved.runnerUrl ?? health.baseUrl,
      token,
      terminalWsUrl: runner.buildTerminalWsUrl(saved.workspaceId),
      previewUrl: saved.previewUrl ?? `/api/runner/preview/${saved.workspaceId}`,
    });
  } catch (err: any) {
    logger.warn(`Workspace POST error: ${err.message}`);
    return res.json({ online: false, reason: 'Workspace creation failed' });
  }
});

router.delete('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

  try {
    const numericId = parseInt(projectId, 10);
    if (isNaN(numericId)) return res.json({ stopped: false, reason: 'Invalid project ID format' });

    const [row] = await db
      .select()
      .from(runnerWorkspaces)
      .where(eq(runnerWorkspaces.projectId, numericId))
      .limit(1);

    if (!row) return res.json({ stopped: false, reason: 'No workspace found' });

    await runner.stopWorkspace(row.workspaceId);
    await db.delete(runnerWorkspaces).where(eq(runnerWorkspaces.projectId, numericId));

    res.json({ stopped: true, workspaceId: row.workspaceId });
  } catch (err: any) {
    logger.warn(`Workspace DELETE error: ${err.message}`);
    return res.json({ stopped: false, reason: 'Workspace deletion failed' });
  }
});

export default router;
