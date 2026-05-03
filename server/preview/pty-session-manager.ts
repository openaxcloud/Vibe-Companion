import * as pty from 'node-pty';
import { WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';

export interface PtySession {
  readonly ptyProc: pty.IPty;
  readonly projectId: string;
  cols: number;
  rows: number;
  readonly subscribers: Set<WebSocket>;
  readonly startedAt: number;
}

const sessions = new Map<string, PtySession>();

const WORKSPACE_ROOT = path.join(process.cwd(), 'project-workspaces');

function resolveProjectCwd(projectId: string): string {
  const candidate = path.join(WORKSPACE_ROOT, projectId);
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  return process.cwd();
}

function buildSafeEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const ALLOW = new Set([
    'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LANGUAGE',
    'LC_ALL', 'LC_CTYPE', 'TZ', 'TMPDIR', 'XDG_RUNTIME_DIR',
    'NODE_VERSION', 'NPM_VERSION', 'PYTHON_VERSION',
  ]);
  const env: Record<string, string> = {};
  for (const key of ALLOW) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '1',
    ...extra,
  };
}

export function spawnPtySession(
  projectId: string,
  file: string,
  args: string[],
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  },
  onData: (data: string) => void,
  onExit: (exitCode: number, signal?: number) => void
): PtySession {
  killPtySession(projectId);

  const cols = options.cols ?? 80;
  const rows = options.rows ?? 24;
  const cwd = options.cwd ?? resolveProjectCwd(projectId);
  const env = buildSafeEnv(options.env);

  const ptyProc = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: env as Record<string, string>,
  });

  const session: PtySession = {
    ptyProc,
    projectId,
    cols,
    rows,
    subscribers: new Set(),
    startedAt: Date.now(),
  };
  sessions.set(projectId, session);

  ptyProc.onData((data: string) => {
    broadcastToPtySubscribers(session, { type: 'pty:data', projectId, data });
    onData(data);
  });

  ptyProc.onExit(({ exitCode, signal }) => {
    sessions.delete(projectId);
    broadcastToPtySubscribers(session, { type: 'pty:exit', projectId, exitCode: exitCode ?? 0, signal });
    onExit(exitCode ?? 0, signal);
  });

  return session;
}

function broadcastToPtySubscribers(session: PtySession, msg: object): void {
  const payload = JSON.stringify(msg);
  for (const ws of session.subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch (_) {}
    }
  }
}

export function resizePtySession(projectId: string, cols: number, rows: number): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  try {
    session.ptyProc.resize(Math.max(1, cols), Math.max(1, rows));
    (session as any).cols = cols;
    (session as any).rows = rows;
    return true;
  } catch (_) { return false; }
}

export function writeToPtySession(projectId: string, data: string): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  try {
    session.ptyProc.write(data);
    return true;
  } catch (_) { return false; }
}

/**
 * Gracefully terminate a PTY session.
 * Sends SIGINT first (lets the process handle it), then after `gracePeriodMs`
 * sends SIGKILL to guarantee termination.  Returns immediately — the PTY
 * onExit handler removes the session from the map when the process actually dies.
 */
export function killPtySession(projectId: string, gracePeriodMs = 3000): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;

  // Remove from map immediately so no new writes/resizes are dispatched.
  sessions.delete(projectId);

  try {
    session.ptyProc.kill('SIGINT');
  } catch (_) {}

  // Escalate to SIGKILL if the process hasn't exited within the grace period.
  const killer = setTimeout(() => {
    try { session.ptyProc.kill('SIGKILL'); } catch (_) {}
  }, gracePeriodMs);

  // node-pty doesn't expose a promise-based exit, but if the process exits
  // before the timer fires the onExit listener above already cleaned up.
  // Keep the timer ref alive in the session scope — it will be GC'd naturally.
  void killer;

  return true;
}

/**
 * Send an arbitrary signal to a live PTY session without tearing it down.
 * Use this for interactive signals (SIGTERM, SIGINT) sent by the user via the
 * WS `signal` message — distinct from killPtySession() which performs a full
 * SIGINT→SIGKILL graceful stop and removes the session from the map.
 */
export function signalPtySession(projectId: string, signal: NodeJS.Signals): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  try {
    session.ptyProc.kill(signal);
    return true;
  } catch (_) { return false; }
}

export function attachSubscriber(projectId: string, ws: WebSocket): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  session.subscribers.add(ws);
  return true;
}

export function detachSubscriber(projectId: string, ws: WebSocket): void {
  const session = sessions.get(projectId);
  if (session) session.subscribers.delete(ws);
}

export function hasPtySession(projectId: string): boolean {
  return sessions.has(projectId);
}

export function getPtySession(projectId: string): PtySession | undefined {
  return sessions.get(projectId);
}

export function listPtySessions(): string[] {
  return Array.from(sessions.keys());
}
