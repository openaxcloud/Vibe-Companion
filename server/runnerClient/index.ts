/**
 * server/runnerClient
 * ──────────────────────────────────────────────────────────────────
 * Client module for the E-Code Runner microservice.
 *
 * Feature flag: only active when RUNNER_BASE_URL + RUNNER_JWT_SECRET are set.
 * Every method handles "runner offline" gracefully — callers receive
 * { online: false } instead of thrown errors.
 *
 * Env vars consumed:
 *   RUNNER_BASE_URL          Base URL of the Runner (e.g. https://runner.e-code.ai)
 *   RUNNER_JWT_SECRET        Shared secret for signing platform → runner JWTs
 *   WORKSPACE_TOKEN_TTL_MIN  Token TTL in minutes for browser → runner access (default: 15)
 */

import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger('runnerClient');

// ─── Config ────────────────────────────────────────────────────────────────
function getBaseUrl(): string | null {
  const url = process.env.RUNNER_BASE_URL || process.env.RUNNER_URL;
  return url?.replace(/\/$/, '') ?? null;
}

function getSecret(): string | null {
  return process.env.RUNNER_JWT_SECRET ?? null;
}

function getTokenTtlMin(): number {
  return parseInt(process.env.WORKSPACE_TOKEN_TTL_MIN ?? '15', 10);
}

// ─── Feature flag ─────────────────────────────────────────────────────────
export function isRunnerConfigured(): boolean {
  return !!getBaseUrl() && !!getSecret();
}

// ─── Types ─────────────────────────────────────────────────────────────────
export interface RunnerHealth {
  online: boolean;
  baseUrl: string | null;
  workspaces?: number;
  latencyMs?: number;
}

export interface WorkspaceInfo {
  workspaceId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  previewUrl?: string | null;
  wsTerminalUrl?: string | null;
}

export interface FsEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FsReadResult {
  type: 'file' | 'directory';
  content?: string;
  entries?: FsEntry[];
}

// ─── Internal HTTP helper ─────────────────────────────────────────────────
function makePlatformToken(): string {
  const secret = getSecret();
  if (!secret) throw new Error('RUNNER_JWT_SECRET not set');
  return jwt.sign(
    { iss: 'e-code-platform', iat: Math.floor(Date.now() / 1000) },
    secret,
    { expiresIn: '5m' }
  );
}

async function runnerFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8_000
): Promise<Response> {
  const base = getBaseUrl();
  const secret = getSecret();
  if (!base || !secret) {
    throw new Error('Runner not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${makePlatformToken()}`,
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── 1. Health / status ──────────────────────────────────────────────────
/**
 * Ping the Runner's /health endpoint.
 * Never throws — returns { online: false } when runner is unreachable.
 */
export async function pingRunner(): Promise<RunnerHealth> {
  const baseUrl = getBaseUrl();
  if (!isRunnerConfigured()) {
    return { online: false, baseUrl };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { online: false, baseUrl };
    const body = (await res.json()) as { workspaces?: number };
    return {
      online: true,
      baseUrl,
      workspaces: body.workspaces,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    logger.warn(`Runner health check failed: ${err}`);
    return { online: false, baseUrl };
  }
}

// ─── 2. Workspace lifecycle ──────────────────────────────────────────────
/**
 * Create a new workspace. Returns null when runner is offline.
 */
export async function createWorkspace(
  projectId: string | number,
  projectName: string
): Promise<WorkspaceInfo | null> {
  try {
    const res = await runnerFetch('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ projectId: String(projectId), projectName }),
    });
    if (!res.ok) {
      logger.error(`Runner createWorkspace ${res.status}: ${await res.text()}`);
      return null;
    }
    return res.json() as Promise<WorkspaceInfo>;
  } catch (err) {
    logger.warn(`Runner createWorkspace failed: ${err}`);
    return null;
  }
}

/**
 * Get workspace status. Returns null when runner is offline.
 */
export async function getWorkspaceStatus(
  workspaceId: string
): Promise<WorkspaceInfo | null> {
  try {
    const res = await runnerFetch(`/workspaces/${workspaceId}`);
    if (!res.ok) return null;
    return res.json() as Promise<WorkspaceInfo>;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return null;
  }
}

/**
 * Stop a workspace. Swallows errors if runner is offline.
 */
export async function stopWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const res = await runnerFetch(`/workspaces/${workspaceId}`, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

// ─── 3. File system operations ───────────────────────────────────────────
/** List directory or read file. Returns null on error. */
export async function fsRead(
  workspaceId: string,
  path: string
): Promise<FsReadResult | null> {
  try {
    const res = await runnerFetch(`/workspaces/${workspaceId}/files/${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return res.json() as Promise<FsReadResult>;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return null;
  }
}

/** Write a file. Returns true on success. */
export async function fsWrite(
  workspaceId: string,
  path: string,
  content: string
): Promise<boolean> {
  try {
    const res = await runnerFetch(
      `/workspaces/${workspaceId}/files/${encodeURIComponent(path)}`,
      { method: 'PUT', body: JSON.stringify({ content }) }
    );
    return res.ok;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

/** Delete a file or directory. Returns true on success. */
export async function fsDelete(workspaceId: string, path: string): Promise<boolean> {
  try {
    const res = await runnerFetch(
      `/workspaces/${workspaceId}/files/${encodeURIComponent(path)}`,
      { method: 'DELETE' }
    );
    return res.ok || res.status === 404;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

/** Create a directory (writes an empty .gitkeep inside it). */
export async function fsMkdir(workspaceId: string, path: string): Promise<boolean> {
  return fsWrite(workspaceId, `${path.replace(/\/+$/, '')}/.gitkeep`, '');
}

/** Rename/move a file by reading + writing + deleting. */
export async function fsRename(
  workspaceId: string,
  fromPath: string,
  toPath: string
): Promise<boolean> {
  try {
    const read = await fsRead(workspaceId, fromPath);
    if (!read || read.type !== 'file' || !read.content) return false;
    const wrote = await fsWrite(workspaceId, toPath, read.content);
    if (!wrote) return false;
    return fsDelete(workspaceId, fromPath);
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

// ─── 4. URL builders ─────────────────────────────────────────────────────
/**
 * Build the WebSocket terminal URL for direct browser → runner connection.
 * The caller must append ?token=<access_token> before using it.
 */
export function buildTerminalWsUrl(workspaceId: string): string | null {
  const base = getBaseUrl();
  if (!base) return null;
  return `${base.replace(/^http/, 'ws')}/workspaces/${workspaceId}/terminal`;
}

/**
 * Build the preview HTTP URL for the workspace's running app.
 */
export function buildPreviewUrl(workspaceId: string): string | null {
  const base = getBaseUrl();
  if (!base) return null;
  return `${base}/workspaces/${workspaceId}/preview/`;
}

// ─── 5. Browser access token ─────────────────────────────────────────────
/**
 * Generate a short-lived JWT for direct browser → runner access
 * (terminal WebSocket, file API, preview).
 * TTL controlled by WORKSPACE_TOKEN_TTL_MIN (default: 15 minutes).
 */
export function generateAccessToken(workspaceId: string, userId: number): string {
  const secret = getSecret();
  if (!secret) throw new Error('RUNNER_JWT_SECRET not set');
  const ttl = getTokenTtlMin();
  return jwt.sign(
    { workspaceId, userId, type: 'runner-access' },
    secret,
    { expiresIn: `${ttl}m` }
  );
}
