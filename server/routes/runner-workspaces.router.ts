/**
 * Runner Workspaces Router  (/api/runner/*)
 * ─────────────────────────────────────────────────────────────────
 * Internal API for managing Runner workspace sessions.
 * Uses the server/runnerClient module for all Runner communication.
 *
 * Routes:
 *   GET    /api/runner/status                    → { online, baseUrl }
 *   GET    /api/runner/workspaces/:projectId      → workspace record or { exists: false }
 *   POST   /api/runner/workspaces/:projectId      → create workspace
 *   DELETE /api/runner/workspaces/:projectId      → stop workspace
 *   GET    /api/runner/workspaces/:projectId/token → access token for browser
 */

import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { db } from '../db';
import { runnerWorkspaces, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as runner from '../runnerClient';
import { createProxyMiddleware } from 'http-proxy-middleware';

const logger = createLogger('runner-workspaces');
const router = Router();

// ─── GET /api/runner/status ───────────────────────────────────────────────
// Pings the Runner's /health endpoint.
// Returns { online: boolean, baseUrl: string|null } — never throws.
// NOTE: No auth required for health check (Fortune 500 requirement)
router.get('/status', async (_req, res) => {
  const health = await runner.pingRunner();
  res.json(health);
});

router.use(ensureAuthenticated);

// ─── GET /api/runner/workspaces/:projectId ────────────────────────────────
router.get('/workspaces/:projectId', async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const [row] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);

  if (!row) return res.json({ exists: false });

  if (runner.isRunnerConfigured()) {
    const live = await runner.getWorkspaceStatus(row.workspaceId);
    if (live) {
      await db
        .update(runnerWorkspaces)
        .set({ status: live.status, updatedAt: new Date() })
        .where(eq(runnerWorkspaces.projectId, projectId));
      return res.json({ exists: true, ...row, status: live.status });
    }
  }

  res.json({ exists: true, ...row });
});

// ─── POST /api/runner/workspaces/:projectId ───────────────────────────────
router.post('/workspaces/:projectId', async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  if (!runner.isRunnerConfigured()) {
    return res.status(503).json({
      error: 'Runner service not configured',
      hint: 'Set RUNNER_BASE_URL and RUNNER_JWT_SECRET environment variables.',
    });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const [existing] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);
  if (existing) return res.json(existing);

  const info = await runner.createWorkspace(projectId, project.name);
  if (!info) {
    return res.status(502).json({ error: 'Runner is offline or returned an error' });
  }

  const [created] = await db
    .insert(runnerWorkspaces)
    .values({
      projectId,
      workspaceId: info.workspaceId,
      status: info.status ?? 'starting',
      previewUrl: info.previewUrl ?? null,
      runnerUrl: process.env.RUNNER_BASE_URL ?? null,
    })
    .returning();

  res.status(201).json(created);
});

// ─── DELETE /api/runner/workspaces/:projectId ─────────────────────────────
router.delete('/workspaces/:projectId', async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  const [row] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);
  if (!row) return res.status(404).json({ error: 'No workspace found' });

  await runner.stopWorkspace(row.workspaceId);
  await db.delete(runnerWorkspaces).where(eq(runnerWorkspaces.projectId, projectId));

  res.json({ stopped: true });
});

// ─── GET /api/runner/workspaces/:projectId/token ──────────────────────────
router.get('/workspaces/:projectId/token', async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

  if (!runner.isRunnerConfigured()) {
    return res.status(503).json({ error: 'Runner service not configured' });
  }

  const [row] = await db
    .select()
    .from(runnerWorkspaces)
    .where(eq(runnerWorkspaces.projectId, projectId))
    .limit(1);
  if (!row) return res.status(404).json({ error: 'No workspace — start one first' });

  const userId = (req.user as any)?.id ?? 0;
  const token = runner.generateAccessToken(row.workspaceId, userId);

  res.json({
    token,
    workspaceId: row.workspaceId,
    runnerUrl: row.runnerUrl,
    previewUrl: row.previewUrl,
    terminalWsUrl: runner.buildTerminalWsUrl(row.workspaceId),
  });
});

// ─── HTTP PROXY FOR PREVIEW ───────────────────────────────────────────────
// Fixes "MISSING_TOKEN" and hides the runner URL by proxying preview traffic.
router.use('/preview/:workspaceId', createProxyMiddleware({
  target: process.env.RUNNER_BASE_URL || 'http://localhost:8081',
  router: async (req: any) => {
    try {
      const workspaceId = req.params.workspaceId;
      const [row] = await db
        .select()
        .from(runnerWorkspaces)
        .where(eq(runnerWorkspaces.workspaceId, workspaceId))
        .limit(1);
      if (row && row.runnerUrl) {
        return row.runnerUrl;
      }
    } catch (err) {
      logger.error('Error in proxy router function', err);
    }
    return process.env.RUNNER_BASE_URL || 'http://localhost:8081';
  },
  changeOrigin: true,
  ws: true,
  pathRewrite: (path, req) => {
    const workspaceId = req.params.workspaceId;
    return path.replace(`/api/runner/preview/${workspaceId}`, `/workspaces/${workspaceId}/preview`);
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      const workspaceId = req.params.workspaceId;
      const userId = (req.user as any)?.id ?? 0;
      const token = runner.generateAccessToken(workspaceId, userId);
      proxyReq.setHeader('Authorization', `Bearer ${token}`);
    }
  }
}));

export default router;
