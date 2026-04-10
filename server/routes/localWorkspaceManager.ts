import { getProjectWorkspaceDir } from "../terminal";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface LocalWorkspace {
  projectId: string;
  process: ChildProcess | null;
  port: number | null;
  status: "starting" | "running" | "stopped" | "error";
  logs: string[];
  lastActivity: number;
}

const workspaces = new Map<string, LocalWorkspace>();
const MAX_LOGS = 500;

export function getLocalWorkspace(projectId: string): LocalWorkspace | undefined {
  return workspaces.get(projectId);
}

export function getLocalWorkspacePort(projectId: string): number | null {
  const ws = workspaces.get(projectId);
  return ws?.port ?? null;
}

export function getLocalWorkspaceStatus(projectId: string): string {
  const ws = workspaces.get(projectId);
  return ws?.status ?? "stopped";
}

export function touchLocalWorkspace(projectId: string): void {
  const ws = workspaces.get(projectId);
  if (ws) ws.lastActivity = Date.now();
}

export function getLocalWorkspaceLogs(projectId: string): string[] {
  const ws = workspaces.get(projectId);
  return ws?.logs ?? [];
}

export function getWorkspaceDir(projectId: string): string {
  return getProjectWorkspaceDir(projectId);
}

export function hasRunnableFiles(dir: string): boolean {
  try {
    if (fs.existsSync(path.join(dir, "package.json"))) return true;
    if (fs.existsSync(path.join(dir, "main.py"))) return true;
    if (fs.existsSync(path.join(dir, "app.py"))) return true;
    if (fs.existsSync(path.join(dir, "index.html"))) return true;
    return false;
  } catch {
    return false;
  }
}

function findFreePort(): number {
  return 3000 + Math.floor(Math.random() * 5000);
}

export async function startLocalWorkspace(
  projectId: string,
  getFiles?: () => Promise<any[]>,
  options?: { command?: string }
): Promise<LocalWorkspace> {
  const existing = workspaces.get(projectId);
  if (existing && existing.status === "running" && existing.process) {
    return existing;
  }

  const wsDir = getProjectWorkspaceDir(projectId);
  const port = findFreePort();

  const ws: LocalWorkspace = {
    projectId,
    process: null,
    port,
    status: "starting",
    logs: [],
    lastActivity: Date.now(),
  };

  workspaces.set(projectId, ws);

  try {
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }

    if (getFiles) {
      const files = await getFiles();
      for (const f of files) {
        const filePath = path.join(wsDir, f.filename);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, f.content || "");
      }
    }

    let cmd = options?.command || "npm start";
    if (fs.existsSync(path.join(wsDir, "package.json"))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(wsDir, "package.json"), "utf-8"));
      if (pkg.scripts?.dev) cmd = "npm run dev";
      else if (pkg.scripts?.start) cmd = "npm start";
    } else if (fs.existsSync(path.join(wsDir, "main.py"))) {
      cmd = "python3 main.py";
    }

    const child = spawn("sh", ["-c", cmd], {
      cwd: wsDir,
      env: { ...process.env, PORT: String(port) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    ws.process = child;

    child.stdout?.on("data", (data: Buffer) => {
      const line = data.toString();
      ws.logs.push(line);
      if (ws.logs.length > MAX_LOGS) ws.logs.shift();
    });

    child.stderr?.on("data", (data: Buffer) => {
      const line = data.toString();
      ws.logs.push(line);
      if (ws.logs.length > MAX_LOGS) ws.logs.shift();
    });

    child.on("exit", () => {
      ws.status = "stopped";
      ws.process = null;
    });

    ws.status = "running";
  } catch (err: any) {
    ws.status = "error";
    ws.logs.push(`Error: ${err.message}`);
  }

  return ws;
}

export async function stopLocalWorkspace(projectId: string): Promise<void> {
  const ws = workspaces.get(projectId);
  if (ws?.process) {
    ws.process.kill("SIGTERM");
    ws.process = null;
    ws.status = "stopped";
  }
}
