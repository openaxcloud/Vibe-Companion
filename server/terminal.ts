let pty: any = null;
try { pty = require("node-pty"); } catch { /* node-pty not available, using child_process fallback */ }
import * as fs from "fs";
import * as path from "path";
import { log } from "./index";

interface TerminalSession {
  pty: pty.IPty;
  projectId: string;
  userId: string;
  sessionId: string;
  lastActivity: number;
  lastCommand: string;
  selected: boolean;
  workspaceDir: string;
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

const WORKSPACES_ROOT = path.join(process.cwd(), "project-workspaces");

const materializedProjects = new Set<string>();

export function getProjectWorkspaceDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(WORKSPACES_ROOT, safeId);
}

function isInsideDir(base: string, target: string): boolean {
  const resolved = path.resolve(target);
  const resolvedBase = path.resolve(base);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

export async function materializeProjectFiles(
  projectId: string,
  getFiles: () => Promise<Array<{ filename: string; content: string | null; isBinary?: boolean }>>,
  force = false,
): Promise<string> {
  const dir = getProjectWorkspaceDir(projectId);

  if (!force && materializedProjects.has(projectId) && fs.existsSync(dir)) {
    return dir;
  }

  fs.mkdirSync(dir, { recursive: true });

  const files = await getFiles();
  let count = 0;
  for (const file of files) {
    if (file.isBinary) continue;
    const filePath = path.join(dir, file.filename);
    if (!isInsideDir(dir, filePath)) continue;
    const fileDir = path.dirname(filePath);
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, file.content || "", "utf-8");
    count++;
  }

  materializedProjects.add(projectId);
  log(`Materialized ${count} files for project ${projectId} to ${dir}`, "terminal");
  return dir;
}

export function isProjectMaterialized(projectId: string): boolean {
  return materializedProjects.has(projectId) && fs.existsSync(getProjectWorkspaceDir(projectId));
}

export function invalidateProjectWorkspace(projectId: string): void {
  materializedProjects.delete(projectId);
}

function buildSafeEnv(projectId: string, workspaceDir: string, projectEnvVars?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    PROJECT_ID: projectId,
    HOME: workspaceDir,
    TMPDIR: "/tmp",
    LANG: "en_US.UTF-8",
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    WORKSPACE_DIR: workspaceDir,
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
  workspaceDir: string,
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

  fs.mkdirSync(workspaceDir, { recursive: true });

  const shell = "/bin/bash";
  const safeEnv = buildSafeEnv(projectId, workspaceDir, projectEnvVars);

  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: workspaceDir,
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
    workspaceDir,
  };

  sessions.set(key, session);
  setSessionSelected(projectId, userId, sessionId);

  log(`Terminal session created: ${key} -> ${workspaceDir} (${sessions.size} active)`, "terminal");

  term.onExit(() => {
    sessions.delete(key);
    log(`Terminal session exited: ${key}`, "terminal");
  });

  return term;
}

export function getOrCreateTerminal(
  projectId: string,
  userId: string,
  workspaceDir: string,
  projectEnvVars?: Record<string, string>,
): pty.IPty {
  return createTerminalSession(projectId, userId, "default", workspaceDir, projectEnvVars);
}

export function getTerminalSession(projectId: string, userId: string, sessionId: string): TerminalSession | undefined {
  const key = sessionKey(projectId, userId, sessionId);
  return sessions.get(key);
}

export function getTerminalWorkspaceDir(projectId: string, userId: string, sessionId: string = "default"): string | undefined {
  const key = sessionKey(projectId, userId, sessionId);
  const session = sessions.get(key);
  return session?.workspaceDir;
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

export function syncFileToWorkspace(projectId: string, filename: string, content: string): void {
  if (!materializedProjects.has(projectId)) return;
  const dir = getProjectWorkspaceDir(projectId);
  if (!fs.existsSync(dir)) return;
  const filePath = path.join(dir, filename);
  if (!isInsideDir(dir, filePath)) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
  } catch {}
}

export function deleteFileFromWorkspace(projectId: string, filename: string): void {
  if (!materializedProjects.has(projectId)) return;
  const dir = getProjectWorkspaceDir(projectId);
  if (!fs.existsSync(dir)) return;
  const filePath = path.join(dir, filename);
  if (!isInsideDir(dir, filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {}
}

export function renameFileInWorkspace(projectId: string, oldFilename: string, newFilename: string): void {
  if (!materializedProjects.has(projectId)) return;
  const dir = getProjectWorkspaceDir(projectId);
  if (!fs.existsSync(dir)) return;
  const oldPath = path.join(dir, oldFilename);
  const newPath = path.join(dir, newFilename);
  if (!isInsideDir(dir, oldPath) || !isInsideDir(dir, newPath)) return;
  try {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.renameSync(oldPath, newPath);
  } catch {}
}

export function readFileFromWorkspace(projectId: string, filename: string): string | null {
  const dir = getProjectWorkspaceDir(projectId);
  const filePath = path.join(dir, filename);
  if (!isInsideDir(dir, filePath)) return null;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function listWorkspaceFiles(projectId: string): Array<{ filename: string; content: string }> {
  const dir = getProjectWorkspaceDir(projectId);
  if (!fs.existsSync(dir)) return [];
  const results: Array<{ filename: string; content: string }> = [];
  function walk(currentDir: string, prefix: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          results.push({ filename: relativePath, content });
        } catch {}
      }
    }
  }
  walk(dir, "");
  return results;
}

const IDLE_UNSELECTED_TIMEOUT_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
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
