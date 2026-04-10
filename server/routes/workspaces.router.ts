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
import { ensureAuthenticated } from '../middleware/auth';
import { db } from '../db';
import { runnerWorkspaces, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as runner from '../runnerClient';

const logger = createLogger('workspaces');
const router = Router();

router.use(ensureAuthenticated);

// ─── GET /api/workspaces/:projectId ──────────────────────────────────────
// Returns existing workspace info with a fresh token, or online: false
router.get('/:projectId', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  if (!runner.isRunnerConfigured()) {
    return res.json({ online: false, reason: 'Runner service not configured' });
  }

  const [existing] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);

  if (!existing) {
    return res.json({ online: false, reason: 'No workspace found' });
  }

  const userId = (req.user as any)?.id ?? 0;
  const token = runner.generateAccessToken(existing.workspaceId, userId);

  return res.json({
    online: true,
    workspaceId: existing.workspaceId,
    runnerUrl: existing.runnerUrl ?? (await runner.pingRunner()).baseUrl,
    token,
    terminalWsUrl: runner.buildTerminalWsUrl(existing.workspaceId),
    previewUrl: `/api/runner/preview/${existing.workspaceId}`,
  });
});

// ─── POST /api/workspaces/:projectId ─────────────────────────────────────
// Returns: { online, workspaceId, runnerUrl, token, terminalWsUrl, previewUrl }
router.post('/:projectId', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  if (!runner.isRunnerConfigured()) {
    return res.json({
      online: false,
      reason: 'Runner service not configured (RUNNER_BASE_URL / RUNNER_JWT_SECRET missing)',
    });
  }

  // Ping first — inform frontend if runner is down
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
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Return existing workspace if already active
  const [existing] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);

  const userId = (req.user as any)?.id ?? 0;

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

  // Create new workspace
  const info = await runner.createWorkspace(projectId, project.name);
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
      projectId,
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
});

// ─── DELETE /api/workspaces/:projectId ────────────────────────────────────
router.delete('/:projectId', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const [row] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);

  if (!row) return res.json({ stopped: false, reason: 'No workspace found' });

  await runner.stopWorkspace(row.workspaceId);
  await db.delete(runnerWorkspaces).where(eq(runnerWorkspaces.projectId, projectId));

  res.json({ stopped: true, workspaceId: row.workspaceId });
});

export default router;
