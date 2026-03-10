import * as pty from "node-pty";
import { log } from "./index";

interface TerminalSession {
  pty: pty.IPty;
  projectId: string;
  userId: string;
  lastActivity: number;
}

const sessions = new Map<string, TerminalSession>();
const MAX_SESSIONS = 20;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const SAFE_ENV_KEYS = new Set([
  "PATH", "HOME", "SHELL", "LANG", "LC_ALL", "TMPDIR", "USER",
  "GOROOT", "GOPATH", "GOCACHE", "JAVA_HOME", "PYTHONPATH",
  "NODE_PATH", "RUSTUP_HOME", "CARGO_HOME", "GEM_HOME", "GEM_PATH",
]);

function buildSafeEnv(projectId: string, projectEnvVars?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    PROJECT_ID: projectId,
    HOME: process.env.HOME || "/home/runner",
    TMPDIR: "/tmp",
    LANG: "en_US.UTF-8",
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  };

  for (const key of SAFE_ENV_KEYS) {
    if (key !== "HOME" && key !== "TMPDIR" && key !== "LANG" && key !== "PATH" && process.env[key]) {
      env[key] = process.env[key]!;
    }
  }

  if (projectEnvVars) {
    for (const [k, v] of Object.entries(projectEnvVars)) {
      env[k] = v;
    }
  }

  return env;
}

function sessionKey(projectId: string, userId: string): string {
  return `${projectId}:${userId}`;
}

export function getOrCreateTerminal(
  projectId: string,
  userId: string,
  projectEnvVars?: Record<string, string>,
): pty.IPty {
  const key = sessionKey(projectId, userId);
  const existing = sessions.get(key);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing.pty;
  }

  if (sessions.size >= MAX_SESSIONS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, s] of sessions) {
      if (s.lastActivity < oldestTime) {
        oldestTime = s.lastActivity;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      destroyTerminal(oldestKey);
    }
  }

  const shell = "/bin/bash";
  const safeEnv = buildSafeEnv(projectId, projectEnvVars);

  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: safeEnv.HOME,
    env: safeEnv,
  });

  sessions.set(key, {
    pty: term,
    projectId,
    userId,
    lastActivity: Date.now(),
  });

  log(`Terminal session created for project ${projectId} (${sessions.size} active)`, "terminal");

  term.onExit(() => {
    sessions.delete(key);
    log(`Terminal session exited for project ${projectId}`, "terminal");
  });

  return term;
}

export function resizeTerminal(projectId: string, userId: string, cols: number, rows: number): void {
  const key = sessionKey(projectId, userId);
  const session = sessions.get(key);
  if (session) {
    try {
      session.pty.resize(Math.max(1, cols), Math.max(1, rows));
      session.lastActivity = Date.now();
    } catch {}
  }
}

export function destroyTerminal(key: string): void {
  const session = sessions.get(key);
  if (session) {
    try {
      session.pty.kill();
    } catch {}
    sessions.delete(key);
    log(`Terminal session destroyed: ${key}`, "terminal");
  }
}

export function destroyProjectTerminals(projectId: string): void {
  for (const [key, session] of sessions) {
    if (session.projectId === projectId) {
      destroyTerminal(key);
    }
  }
}

export function getActiveSessionCount(): number {
  return sessions.size;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      log(`Terminal session timed out: ${key}`, "terminal");
      destroyTerminal(key);
    }
  }
}, 60000);
