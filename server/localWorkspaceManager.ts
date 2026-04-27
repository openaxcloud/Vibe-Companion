/**
 * Local Workspace Manager
 *
 * Replaces the external runner service (runner.e-code.ai) with local process management.
 * Used when RUNNER_MODE=local (or when the external runner is unreachable).
 *
 * Responsibilities:
 *  - Materialize project files from DB to project-workspaces/{projectId}/
 *  - Auto-detect & run the dev server command (npm run dev, python3 main.py, etc.)
 *  - Track the port the dev server is listening on
 *  - Reverse proxy HTTP + WebSocket traffic to that port (routes added in routes.ts)
 *  - Auto-stop idle workspaces after IDLE_TIMEOUT_MS
 *  - Enforce a max concurrent workspace limit (MAX_CONCURRENT_WORKSPACES)
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { log } from "./index";
import { materializeProjectFiles } from "./terminal";

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT_RANGE_START = 10000;
const PORT_RANGE_END = 20000;
const MAX_CONCURRENT_WORKSPACES = parseInt(process.env.LOCAL_WS_MAX || "5", 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.LOCAL_WS_IDLE_MS || String(30 * 60 * 1000), 10);
const WORKSPACES_ROOT = path.join(process.cwd(), "project-workspaces");

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalWorkspaceStatus = "starting" | "installing" | "running" | "stopped" | "error";

export interface LocalWorkspace {
  projectId: string;
  port: number;
  status: LocalWorkspaceStatus;
  logBuffer: string[];
  startedAt: number;
  lastActivity: number;
  process: ChildProcess | null;
  pid?: number;
  errorMessage?: string;
  idleTimer?: ReturnType<typeof setTimeout>;
}

// ─── State ────────────────────────────────────────────────────────────────────

const workspaces = new Map<string, LocalWorkspace>();
const allocatedPorts = new Set<number>();
let nextPortCandidate = PORT_RANGE_START;

let broadcastFn: ((projectId: string, data: any) => void) | null = null;

export function setLocalWorkspaceBroadcastFn(fn: (projectId: string, data: any) => void): void {
  broadcastFn = fn;
}

// ─── Port allocation ──────────────────────────────────────────────────────────

function allocatePort(): number {
  for (let i = 0; i < PORT_RANGE_END - PORT_RANGE_START + 1; i++) {
    const port = PORT_RANGE_START + ((nextPortCandidate - PORT_RANGE_START + i) % (PORT_RANGE_END - PORT_RANGE_START + 1));
    if (!allocatedPorts.has(port)) {
      allocatedPorts.add(port);
      nextPortCandidate = port + 1;
      return port;
    }
  }
  throw new Error("No available ports in the local workspace port pool (10000-20000)");
}

function releasePort(port: number): void {
  allocatedPorts.delete(port);
}

// ─── Logging helpers ──────────────────────────────────────────────────────────

const MAX_LOG_BUFFER = 500;

function addLog(ws: LocalWorkspace, line: string): void {
  const entry = `[${new Date().toISOString()}] ${line}`;
  ws.logBuffer.push(entry);
  if (ws.logBuffer.length > MAX_LOG_BUFFER) {
    ws.logBuffer = ws.logBuffer.slice(-MAX_LOG_BUFFER);
  }
  if (broadcastFn) {
    try {
      broadcastFn(ws.projectId, { type: "preview_log", line: entry });
    } catch {}
  }
}

function setStatus(ws: LocalWorkspace, status: LocalWorkspaceStatus, message?: string): void {
  ws.status = status;
  if (message) ws.errorMessage = message;
  if (broadcastFn) {
    try {
      broadcastFn(ws.projectId, { type: "preview_status", status, port: ws.port, message });
    } catch {}
  }
}

// ─── Command detection ────────────────────────────────────────────────────────

interface DetectedCommand {
  command: string;
  needsInstall: boolean;
  /** if true, mark process as live immediately (don't wait for health check) */
  skipHealthCheck: boolean;
}

function detectStartCommand(workspaceDir: string, project: { language?: string }): DetectedCommand | null {
  // ── Node / TypeScript projects ──────────────────────────────────────────────
  const pkgPath = path.join(workspaceDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts: Record<string, string> = pkg.scripts || {};
      const nodeModulesExists = fs.existsSync(path.join(workspaceDir, "node_modules"));
      const installPrefix = nodeModulesExists ? "" : "npm install && ";

      // Prefer 'dev' for HMR-capable servers (Vite, Next, etc.)
      if (scripts.dev) {
        return { command: `${installPrefix}npm run dev`, needsInstall: !nodeModulesExists, skipHealthCheck: true };
      }
      if (scripts.start) {
        return { command: `${installPrefix}npm start`, needsInstall: !nodeModulesExists, skipHealthCheck: true };
      }
      if (scripts.serve) {
        return { command: `${installPrefix}npm run serve`, needsInstall: !nodeModulesExists, skipHealthCheck: true };
      }
    } catch {}
  }

  // ── Python projects ─────────────────────────────────────────────────────────
  const pythonEntries = ["main.py", "app.py", "server.py", "run.py", "index.py"];
  for (const entry of pythonEntries) {
    if (fs.existsSync(path.join(workspaceDir, entry))) {
      const hasReqs = fs.existsSync(path.join(workspaceDir, "requirements.txt"));
      const installCmd = hasReqs ? "pip install -r requirements.txt && " : "";
      return { command: `${installCmd}python3 ${entry}`, needsInstall: hasReqs, skipHealthCheck: true };
    }
  }

  // ── Fallback: if we see a pyproject.toml ───────────────────────────────────
  if (fs.existsSync(path.join(workspaceDir, "pyproject.toml"))) {
    return { command: "python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload", needsInstall: false, skipHealthCheck: true };
  }

  // ── Plain JS entry points ──────────────────────────────────────────────────
  const jsEntries = ["index.js", "server.js", "app.js", "main.js"];
  for (const entry of jsEntries) {
    if (fs.existsSync(path.join(workspaceDir, entry))) {
      return { command: `node ${entry}`, needsInstall: false, skipHealthCheck: true };
    }
  }

  // ── TypeScript entry points ────────────────────────────────────────────────
  const tsEntries = ["index.ts", "server.ts", "app.ts", "main.ts"];
  for (const entry of tsEntries) {
    if (fs.existsSync(path.join(workspaceDir, entry))) {
      return { command: `npx tsx ${entry}`, needsInstall: false, skipHealthCheck: true };
    }
  }

  // ── Static HTML fallback ─────────────────────────────────────────────────
  if (fs.existsSync(path.join(workspaceDir, "index.html"))) {
    return { command: `npx serve -l $PORT -s .`, needsInstall: false, skipHealthCheck: true };
  }

  return null;
}

// ─── Idle timer ───────────────────────────────────────────────────────────────

function resetIdleTimer(ws: LocalWorkspace): void {
  if (ws.idleTimer) clearTimeout(ws.idleTimer);
  ws.lastActivity = Date.now();
  ws.idleTimer = setTimeout(async () => {
    log(`[localWS] Auto-stopping idle workspace for project ${ws.projectId}`, "preview");
    await stopLocalWorkspace(ws.projectId);
  }, IDLE_TIMEOUT_MS);
}

function clearIdleTimer(ws: LocalWorkspace): void {
  if (ws.idleTimer) {
    clearTimeout(ws.idleTimer);
    ws.idleTimer = undefined;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Materialize files and start the dev server for a project.
 * Non-blocking: returns immediately, streams progress via WebSocket broadcast.
 */
export async function startLocalWorkspace(
  projectId: string,
  getFiles: () => Promise<Array<{ filename: string; content: string | null; isBinary?: boolean }>>,
  options?: {
    runCommand?: string;
    language?: string;
    envVars?: Record<string, string>;
  }
): Promise<LocalWorkspace> {
  // Stop existing workspace if any
  const existing = workspaces.get(projectId);
  if (existing && existing.status !== "stopped" && existing.status !== "error") {
    return existing; // already running
  }

  // Enforce max concurrent workspaces
  const running = [...workspaces.values()].filter(w => w.status === "running" || w.status === "starting" || w.status === "installing");
  if (running.length >= MAX_CONCURRENT_WORKSPACES) {
    // Stop the oldest idle workspace to make room
    const oldest = running.sort((a, b) => a.lastActivity - b.lastActivity)[0];
    if (oldest) {
      log(`[localWS] Evicting workspace ${oldest.projectId} to make room`, "preview");
      await stopLocalWorkspace(oldest.projectId);
    } else {
      throw new Error(`Maximum concurrent workspaces (${MAX_CONCURRENT_WORKSPACES}) reached`);
    }
  }

  const port = allocatePort();

  const ws: LocalWorkspace = {
    projectId,
    port,
    status: "starting",
    logBuffer: [],
    startedAt: Date.now(),
    lastActivity: Date.now(),
    process: null,
  };

  workspaces.set(projectId, ws);
  resetIdleTimer(ws);

  // Non-blocking startup sequence
  _runStartupSequence(ws, getFiles, options).catch((err) => {
    addLog(ws, `Startup failed: ${err.message}`);
    setStatus(ws, "error", err.message);
    releasePort(port);
    clearIdleTimer(ws);
  });

  return ws;
}

async function _runStartupSequence(
  ws: LocalWorkspace,
  getFiles: () => Promise<Array<{ filename: string; content: string | null; isBinary?: boolean }>>,
  options?: { runCommand?: string; language?: string; envVars?: Record<string, string> }
): Promise<void> {
  const { projectId, port } = ws;

  // 1. Materialize files
  addLog(ws, "Materializing project files...");
  const workspaceDir = await materializeProjectFiles(projectId, getFiles);
  addLog(ws, `Files ready at ${workspaceDir}`);

  // 2. Detect run command
  let cmd = options?.runCommand;
  let skipHealthCheck = true;

  if (!cmd) {
    const detected = detectStartCommand(workspaceDir, { language: options?.language });
    if (!detected) {
      setStatus(ws, "error", "No runnable files detected");
      addLog(ws, "No runnable entry point found (no package.json scripts, no Python files, no JS/TS entry)");
      releasePort(ws.port);
      clearIdleTimer(ws);
      return;
    }
    cmd = detected.command;
    skipHealthCheck = detected.skipHealthCheck;
    if (detected.needsInstall) {
      setStatus(ws, "installing");
      addLog(ws, "Installing dependencies...");
    }
  }

  addLog(ws, `Starting dev server: ${cmd}`);
  setStatus(ws, "starting");

  // 3. Spawn the dev server
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(port),
    NODE_ENV: "development",
    HOME: workspaceDir,
    ...(options?.envVars || {}),
  };

  const proc = spawn("sh", ["-c", cmd], {
    cwd: workspaceDir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  ws.process = proc;
  ws.pid = proc.pid;

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      addLog(ws, `[stdout] ${line}`);
    }
    // If we see a port-related message, transition to running
    if (ws.status === "starting" || ws.status === "installing") {
      const portPatterns = [
        /localhost:\d+/i,
        /listening on.*\d+/i,
        /running on.*port\s+\d+/i,
        /server started/i,
        /ready in/i,
        /VITE.*ready/i,
        /compiled successfully/i,
        /webpack compiled/i,
        /started server on/i,
        /Accepting connections/i,
      ];
      const text = lines.join(" ");
      if (portPatterns.some(p => p.test(text))) {
        setStatus(ws, "running");
        addLog(ws, `Dev server is ready on port ${port}`);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      // Many dev servers write startup info to stderr — don't treat as error
      addLog(ws, `[stderr] ${line}`);
    }
    // Also check stderr for ready signals
    if (ws.status === "starting" || ws.status === "installing") {
      const text = lines.join(" ");
      const portPatterns = [
        /localhost:\d+/i,
        /listening on.*\d+/i,
        /running on.*port\s+\d+/i,
        /ready in/i,
        /VITE.*ready/i,
        /compiled successfully/i,
        /webpack compiled/i,
        /started server on/i,
        /Application is running/i,
        /Listening at/i,
        /Accepting connections/i,
      ];
      if (portPatterns.some(p => p.test(text))) {
        setStatus(ws, "running");
        addLog(ws, `Dev server is ready on port ${port}`);
      }
    }
  });

  proc.on("exit", (code, signal) => {
    const msg = `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`;
    addLog(ws, msg);
    if (ws.status !== "stopped") {
      setStatus(ws, "error", msg);
    }
    releasePort(port);
    clearIdleTimer(ws);
    ws.process = null;
    log(`[localWS] Dev server for ${projectId} exited`, "preview");
  });

  // If skipHealthCheck, mark as running after a short delay to give the server time to start
  if (skipHealthCheck) {
    setTimeout(() => {
      if (ws.status === "starting" || ws.status === "installing") {
        setStatus(ws, "running");
        addLog(ws, `Dev server assumed running on port ${port} (startup grace period elapsed)`);
      }
    }, 8000); // 8 second grace period for dev servers to start
  }

  log(`[localWS] Started dev server for ${projectId} on port ${port} (PID: ${proc.pid})`, "preview");
}

export async function stopLocalWorkspace(projectId: string): Promise<void> {
  const ws = workspaces.get(projectId);
  if (!ws) return;

  clearIdleTimer(ws);
  setStatus(ws, "stopped");

  if (ws.process) {
    try {
      ws.process.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try { ws.process?.kill("SIGKILL"); } catch {}
          resolve();
        }, 5000);
        ws.process?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch {}
    ws.process = null;
  }

  releasePort(ws.port);
  workspaces.delete(projectId);
  log(`[localWS] Stopped workspace for ${projectId}`, "preview");
}

export function getLocalWorkspace(projectId: string): LocalWorkspace | undefined {
  return workspaces.get(projectId);
}

export function getLocalWorkspacePort(projectId: string): number | null {
  const ws = workspaces.get(projectId);
  return ws ? ws.port : null;
}

export function getLocalWorkspaceStatus(projectId: string): LocalWorkspaceStatus | "none" {
  const ws = workspaces.get(projectId);
  return ws ? ws.status : "none";
}

export function getLocalWorkspaceLogs(projectId: string): string[] {
  return workspaces.get(projectId)?.logBuffer || [];
}

/** Touch a workspace to prevent idle eviction */
export function touchLocalWorkspace(projectId: string): void {
  const ws = workspaces.get(projectId);
  if (ws) resetIdleTimer(ws);
}

export function getAllLocalWorkspaces(): Map<string, LocalWorkspace> {
  return workspaces;
}

export async function shutdownAllLocalWorkspaces(): Promise<void> {
  const ids = [...workspaces.keys()];
  await Promise.allSettled(ids.map(id => stopLocalWorkspace(id)));
}

/**
 * Detect if a project has runnable server-side files (i.e. not just static HTML).
 * Used by the preview status endpoint to return 'no_runnable_files' vs 'stopped'.
 */
export function hasRunnableFiles(workspaceDir: string): boolean {
  if (!fs.existsSync(workspaceDir)) return false;

  const pkgPath = path.join(workspaceDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      if (scripts.dev || scripts.start || scripts.serve) return true;
    } catch {}
  }

  const runnableFiles = [
    "main.py", "app.py", "server.py", "run.py", "index.py",
    "index.js", "server.js", "app.js", "main.js",
    "index.ts", "server.ts", "app.ts", "main.ts",
    "pyproject.toml",
  ];
  return runnableFiles.some(f => fs.existsSync(path.join(workspaceDir, f)));
}

/** Return the workspace directory path for a project */
export function getWorkspaceDir(projectId: string): string {
  const safeId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(WORKSPACES_ROOT, safeId);
}
