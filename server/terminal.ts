import * as fs from "fs";
import * as path from "path";
import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { log } from "./index";

const MAX_RETRY = 3;
const CRASH_WINDOW_MS = 2000;

interface IPtyLike {
  pid: number;
  onData: (cb: (data: string) => void) => { dispose: () => void };
  onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

class ChildProcessPty extends EventEmitter implements IPtyLike {
  private proc: ChildProcess | null = null;
  private _killed = false;
  private _stopped = false;
  private retryCount = 0;
  private spawnTime = 0;
  pid: number = 0;
  private shell: string;
  private args: string[];
  private opts: { cwd: string; env: Record<string, string>; cols: number; rows: number };

  constructor(shell: string, args: string[], opts: { cwd: string; env: Record<string, string>; cols?: number; rows?: number }) {
    super();
    this.shell = shell;
    this.args = args;
    this.opts = {
      cwd: opts.cwd,
      env: opts.env,
      cols: opts.cols || 80,
      rows: opts.rows || 24,
    };
    this.spawnChild();
  }

  private spawnChild() {
    if (this._killed || this._stopped) return;

    this.spawnTime = Date.now();

    try {
      if (!fs.existsSync(this.opts.cwd)) {
        fs.mkdirSync(this.opts.cwd, { recursive: true });
        log(`[terminal] created missing cwd: ${this.opts.cwd}`, "terminal");
      }
    } catch (mkdirErr: any) {
      log(`[terminal] failed to create cwd ${this.opts.cwd}: ${mkdirErr.message}`, "terminal");
    }

    try {
      this.proc = spawn(this.shell, this.args, {
        cwd: this.opts.cwd,
        env: { ...this.opts.env, COLUMNS: String(this.opts.cols), LINES: String(this.opts.rows) },
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (err: any) {
      log(`[terminal] spawn failed: ${err.message} (shell=${this.shell}, args=${JSON.stringify(this.args)}, cwd=${this.opts.cwd})`, "terminal");
      this.emit("data", `\r\n\x1b[31mShell spawn failed: ${err.message}\x1b[0m\r\n`);
      this._stopped = true;
      this.emit("exit", { exitCode: 1 });
      return;
    }

    this.pid = this.proc.pid || 0;
    log(`[terminal] shell spawned pid=${this.pid} shell=${this.shell} args=${JSON.stringify(this.args)} cwd=${this.opts.cwd} retry=${this.retryCount}`, "terminal");

    this.proc.stdout?.setEncoding("utf-8");
    this.proc.stderr?.setEncoding("utf-8");
    this.proc.stdout?.on("data", (data: string) => this.emit("data", data));
    this.proc.stderr?.on("data", (data: string) => this.emit("data", data));

    this.proc.on("exit", (code, signal) => {
      if (this._killed) {
        this.emit("exit", { exitCode: code ?? 0, signal: signal ? 1 : undefined });
        return;
      }

      const uptime = Date.now() - this.spawnTime;
      const isCrash = uptime < CRASH_WINDOW_MS;

      if (isCrash && this.retryCount < MAX_RETRY) {
        this.retryCount++;
        const delay = this.retryCount * 500;
        log(`[terminal] bash exited after ${uptime}ms (crash), retry ${this.retryCount}/${MAX_RETRY} in ${delay}ms`, "terminal");
        this.emit("data", `\r\n\x1b[33m[terminal] Shell restarting (${this.retryCount}/${MAX_RETRY})...\x1b[0m\r\n`);
        setTimeout(() => this.spawnChild(), delay);
      } else if (isCrash) {
        log(`[terminal] bash crashed ${MAX_RETRY} times, stopped`, "terminal");
        this.emit("data", `\r\n\x1b[31m[terminal] Shell crashed ${MAX_RETRY} times. Session stopped.\x1b[0m\r\n`);
        this._stopped = true;
        this.emit("exit", { exitCode: code ?? 1 });
      } else {
        this.retryCount = 0;
        this.emit("exit", { exitCode: code ?? 0, signal: signal ? 1 : undefined });
      }
    });

    this.proc.on("error", (err) => {
      log(`[terminal] process error: ${err.message}`, "terminal");
      this.emit("data", `\r\n\x1b[31mShell error: ${err.message}\x1b[0m\r\n`);
    });
  }

  onData(cb: (data: string) => void) {
    this.on("data", cb);
    return { dispose: () => this.removeListener("data", cb) };
  }

  onExit(cb: (e: { exitCode: number; signal?: number }) => void) {
    this.on("exit", cb);
    return { dispose: () => this.removeListener("exit", cb) };
  }

  write(data: string) {
    try {
      if (this.proc && !this._killed && !this._stopped && this.proc.stdin?.writable) {
        this.proc.stdin.write(data);
      }
    } catch {}
  }

  resize(cols: number, rows: number) {
    this.opts.cols = cols;
    this.opts.rows = rows;
  }

  kill(signal?: string) {
    this._killed = true;
    this._stopped = true;
    try {
      this.proc?.kill(signal as NodeJS.Signals || "SIGTERM");
    } catch {}
  }
}

interface TerminalSession {
  pty: IPtyLike;
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

function spawnTerminal(shell: string, workspaceDir: string, safeEnv: Record<string, string>): IPtyLike {
  return new ChildProcessPty(shell, ["-i"], {
    cwd: workspaceDir,
    env: {
      ...safeEnv,
      PS1: "\\[\\033[01;32m\\]\\u@ecode\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ",
      BASH_SILENCE_DEPRECATION_WARNING: "1",
    },
    cols: 80,
    rows: 24,
  });
}

export function createTerminalSession(
  projectId: string,
  userId: string,
  sessionId: string,
  workspaceDir: string,
  projectEnvVars?: Record<string, string>,
): IPtyLike {
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

  const term = spawnTerminal(shell, workspaceDir, safeEnv);

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
): IPtyLike {
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
