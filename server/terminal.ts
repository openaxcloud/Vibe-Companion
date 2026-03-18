import * as pty from "node-pty";
import * as fs from "fs";
import { log } from "./index";

interface TerminalSession {
  pty: pty.IPty;
  projectId: string;
  userId: string;
  sessionId: string;
  lastActivity: number;
  lastCommand: string;
  selected: boolean;
}

const sessions = new Map<string, TerminalSession>();
const MAX_SESSIONS = 50;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CHECK_MS = 60000;

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

function sessionKey(projectId: string, userId: string, sessionId: string): string {
  return `${projectId}:${userId}:${sessionId}`;
}

export function createTerminalSession(
  projectId: string,
  userId: string,
  sessionId: string,
  projectEnvVars?: Record<string, string>,
): pty.IPty {
  const key = sessionKey(projectId, userId, sessionId);
  const existing = sessions.get(key);
  if (existing) {
    existing.lastActivity = Date.now();
    setSessionSelected(projectId, userId, sessionId);
    return existing.pty;
  }

  const MAX_SESSIONS_PER_USER = 10;
  const prefix = `${projectId}:${userId}:`;
  let userSessionCount = 0;
  for (const [k] of sessions) {
    if (k.startsWith(prefix)) userSessionCount++;
  }
  if (userSessionCount >= MAX_SESSIONS_PER_USER) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, s] of sessions) {
      if (k.startsWith(prefix) && s.lastActivity < oldestTime) {
        oldestTime = s.lastActivity;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      destroyTerminal(oldestKey);
    }
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

  const session: TerminalSession = {
    pty: term,
    projectId,
    userId,
    sessionId,
    lastActivity: Date.now(),
    lastCommand: "",
    selected: true,
  };

  sessions.set(key, session);
  setSessionSelected(projectId, userId, sessionId);

  log(`Terminal session created: ${key} (${sessions.size} active)`, "terminal");

  term.onExit(() => {
    sessions.delete(key);
    log(`Terminal session exited: ${key}`, "terminal");
  });

  return term;
}

export function getOrCreateTerminal(
  projectId: string,
  userId: string,
  projectEnvVars?: Record<string, string>,
): pty.IPty {
  return createTerminalSession(projectId, userId, "default", projectEnvVars);
}

export function getTerminalSession(projectId: string, userId: string, sessionId: string): TerminalSession | undefined {
  const key = sessionKey(projectId, userId, sessionId);
  return sessions.get(key);
}

export function listTerminalSessions(projectId: string, userId: string): Array<{ sessionId: string; lastCommand: string; lastActivity: number; selected: boolean }> {
  const result: Array<{ sessionId: string; lastCommand: string; lastActivity: number; selected: boolean }> = [];
  const prefix = `${projectId}:${userId}:`;
  for (const [key, session] of sessions) {
    if (key.startsWith(prefix)) {
      result.push({
        sessionId: session.sessionId,
        lastCommand: session.lastCommand,
        lastActivity: session.lastActivity,
        selected: session.selected,
      });
    }
  }
  return result;
}

export function setSessionSelected(projectId: string, userId: string, sessionId: string): boolean {
  const targetKey = sessionKey(projectId, userId, sessionId);
  if (!sessions.has(targetKey)) {
    return false;
  }
  const prefix = `${projectId}:${userId}:`;
  for (const [key, session] of sessions) {
    if (key.startsWith(prefix)) {
      session.selected = (session.sessionId === sessionId);
    }
  }
  return true;
}

export function updateLastCommand(projectId: string, userId: string, sessionId: string, command: string): void {
  const key = sessionKey(projectId, userId, sessionId);
  const session = sessions.get(key);
  if (session) {
    session.lastCommand = command;
    session.lastActivity = Date.now();
  }
}

export function updateLastActivity(projectId: string, userId: string, sessionId: string): void {
  const key = sessionKey(projectId, userId, sessionId);
  const session = sessions.get(key);
  if (session) {
    session.lastActivity = Date.now();
  }
}

export function resizeTerminal(projectId: string, userId: string, cols: number, rows: number, sessionId: string = "default"): void {
  const key = sessionKey(projectId, userId, sessionId);
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

export function destroyTerminalSession(projectId: string, userId: string, sessionId: string): void {
  const key = sessionKey(projectId, userId, sessionId);
  const session = sessions.get(key);
  const wasSelected = session?.selected ?? false;
  destroyTerminal(key);
  if (wasSelected) {
    const prefix = `${projectId}:${userId}:`;
    for (const [k, s] of sessions) {
      if (k.startsWith(prefix)) {
        s.selected = true;
        break;
      }
    }
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

function hasChildProcesses(pid: number): boolean {
  try {
    const children = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8").trim();
    return children.length > 0;
  } catch {
    return false;
  }
}

const IDLE_UNSELECTED_TIMEOUT_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  // Collect keys to destroy first to avoid modifying map while iterating
  const toDestroy: string[] = [];
  for (const [key, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      log(`Terminal session timed out: ${key}`, "terminal");
      toDestroy.push(key);
      continue;
    }

    if (!session.selected && now - session.lastActivity > IDLE_UNSELECTED_TIMEOUT_MS) {
      const running = hasChildProcesses(session.pty.pid);
      if (!running) {
        log(`Idle unselected terminal auto-closed: ${key}`, "terminal");
        toDestroy.push(key);
      }
    }
  }
  for (const key of toDestroy) {
    destroyTerminal(key);
  }
}, IDLE_CHECK_MS);
