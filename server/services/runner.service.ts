/**
 * Runner Service
 *
 * HTTP client for an optional external Runner microservice.
 * When RUNNER_BASE_URL is not set, all methods return null and the IDE
 * falls back to the built-in terminal/preview/execution system.
 *
 * When RUNNER_BASE_URL is set, this service manages isolated workspace
 * containers on the Runner, proxying terminal/preview/file access through them.
 */

import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger('runner-service');

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL?.replace(/\/$/, '') ?? null;
const RUNNER_JWT_SECRET = process.env.RUNNER_JWT_SECRET ?? null;

export function isRunnerEnabled(): boolean {
  return !!RUNNER_BASE_URL && !!RUNNER_JWT_SECRET;
}

export interface RunnerWorkspaceInfo {
  workspaceId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  wsTerminalUrl?: string;
}

async function runnerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!RUNNER_BASE_URL || !RUNNER_JWT_SECRET) {
    throw new Error('Runner service is not configured (RUNNER_BASE_URL / RUNNER_JWT_SECRET missing)');
  }

  const token = jwt.sign(
    { iss: 'e-code-platform', iat: Math.floor(Date.now() / 1000) },
    RUNNER_JWT_SECRET,
    { expiresIn: '5m' }
  );

  const url = `${RUNNER_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  return response;
}

/**
 * Create a new workspace on the Runner for a given project.
 * Returns workspace info including the assigned workspaceId and URLs.
 */
export async function createRunnerWorkspace(
  projectId: number,
  projectName: string
): Promise<RunnerWorkspaceInfo> {
  logger.info(`[Runner] Creating workspace for project ${projectId}`);
  const res = await runnerFetch('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ projectId: String(projectId), projectName }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Runner returned ${res.status}: ${err}`);
  }

  const data = (await res.json()) as RunnerWorkspaceInfo;
  logger.info(`[Runner] Workspace created: ${data.workspaceId}`);
  return data;
}

/**
 * Get the current status of an existing workspace.
 */
export async function getRunnerWorkspace(workspaceId: string): Promise<RunnerWorkspaceInfo> {
  const res = await runnerFetch(`/workspaces/${workspaceId}`);
  if (!res.ok) {
    throw new Error(`Runner GET workspace returned ${res.status}`);
  }
  return res.json() as Promise<RunnerWorkspaceInfo>;
}

/**
 * Stop and destroy a workspace on the Runner.
 */
export async function stopRunnerWorkspace(workspaceId: string): Promise<void> {
  logger.info(`[Runner] Stopping workspace ${workspaceId}`);
  const res = await runnerFetch(`/workspaces/${workspaceId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Runner DELETE workspace returned ${res.status}`);
  }
}

/**
 * Generate a short-lived JWT that the browser can use to talk directly
 * to the Runner (WebSocket terminal, file API).
 */
export function generateRunnerToken(workspaceId: string, userId: number): string {
  if (!RUNNER_JWT_SECRET) throw new Error('RUNNER_JWT_SECRET not set');
  return jwt.sign(
    { workspaceId, userId, type: 'runner-access' },
    RUNNER_JWT_SECRET,
    { expiresIn: '1h' }
  );
}
