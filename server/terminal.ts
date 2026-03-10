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

function sessionKey(projectId: string, userId: string): string {
  return `${projectId}:${userId}`;
}

export function getOrCreateTerminal(projectId: string, userId: string): pty.IPty {
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

  const shell = process.env.SHELL || "/bin/bash";
  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      PROJECT_ID: projectId,
    } as Record<string, string>,
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
