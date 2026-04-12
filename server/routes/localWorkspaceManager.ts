import { getProjectWorkspaceDir } from "../terminal";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface LocalWorkspace {
  projectId: string;
  process: ChildProcess | null;
  port: number | null;
  status: "starting" | "running" | "stopped" | "error" | "installing";
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
  return ws?.status ?? "none";
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
  options?: { command?: string; language?: string; envVars?: Record<string, string> }
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
      if (!files || files.length === 0) {
        ws.status = "error";
        ws.logs.push("No files found in project. Create some files first.");
        return ws;
      }
      for (const f of files) {
        const fname = f.filename || f.name || "";
        if (!fname) continue;
        const filePath = path.join(wsDir, fname);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, f.content || "");
      }
    }

    let cmd = options?.command || "";

    if (!cmd) {
      if (fs.existsSync(path.join(wsDir, "package.json"))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(wsDir, "package.json"), "utf-8"));
          if (pkg.scripts?.dev) cmd = "npm run dev";
          else if (pkg.scripts?.start) cmd = "npm start";
          else cmd = "npm start";
        } catch {
          cmd = "npm start";
        }
      } else if (fs.existsSync(path.join(wsDir, "index.html"))) {
        cmd = `npx serve -s -l ${port} .`;
      } else if (fs.existsSync(path.join(wsDir, "main.py")) || fs.existsSync(path.join(wsDir, "app.py"))) {
        const pyFile = fs.existsSync(path.join(wsDir, "app.py")) ? "app.py" : "main.py";
        cmd = `python3 ${pyFile}`;
      } else if (fs.existsSync(path.join(wsDir, "index.ts")) || fs.existsSync(path.join(wsDir, "index.js"))) {
        const entryFile = fs.existsSync(path.join(wsDir, "index.ts")) ? "index.ts" : "index.js";
        cmd = entryFile.endsWith(".ts") ? `npx tsx ${entryFile}` : `node ${entryFile}`;
      } else if (fs.existsSync(path.join(wsDir, "main.ts")) || fs.existsSync(path.join(wsDir, "main.js"))) {
        const entryFile = fs.existsSync(path.join(wsDir, "main.ts")) ? "main.ts" : "main.js";
        cmd = entryFile.endsWith(".ts") ? `npx tsx ${entryFile}` : `node ${entryFile}`;
      } else {
        ws.status = "error";
        ws.logs.push("No recognizable entry point found (package.json, index.html, main.py, index.ts, etc.).");
        return ws;
      }
    }

    const installNeeded = fs.existsSync(path.join(wsDir, "package.json")) && !fs.existsSync(path.join(wsDir, "node_modules"));
    if (installNeeded) {
      ws.status = "installing";
      ws.logs.push("[workspace] Installing dependencies...");
      const install = spawn("sh", ["-c", "npm install --legacy-peer-deps 2>&1"], { cwd: wsDir, env: { ...process.env } });
      await new Promise<void>((resolve) => {
        install.stdout?.on("data", (d: Buffer) => { ws.logs.push(d.toString()); if (ws.logs.length > MAX_LOGS) ws.logs.shift(); });
        install.stderr?.on("data", (d: Buffer) => { ws.logs.push(d.toString()); if (ws.logs.length > MAX_LOGS) ws.logs.shift(); });
        install.on("exit", () => resolve());
      });
    }

    ws.logs.push(`[workspace] Starting: ${cmd}`);

    const envOverrides: Record<string, string> = { PORT: String(port), HOST: "0.0.0.0" };
    if (options?.envVars) Object.assign(envOverrides, options.envVars);

    const child = spawn("sh", ["-c", cmd], {
      cwd: wsDir,
      env: { ...process.env, ...envOverrides },
      stdio: ["pipe", "pipe", "pipe"],
    });

    ws.process = child;

    child.stdout?.on("data", (data: Buffer) => {
      const line = data.toString();
      ws.logs.push(line);
      if (ws.logs.length > MAX_LOGS) ws.logs.shift();
      if (ws.status === "starting" && (line.includes("listening") || line.includes("started") || line.includes("ready") || line.includes("http://") || line.includes("port"))) {
        ws.status = "running";
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const line = data.toString();
      ws.logs.push(line);
      if (ws.logs.length > MAX_LOGS) ws.logs.shift();
    });

    child.on("exit", (code) => {
      ws.status = "stopped";
      ws.process = null;
      ws.logs.push(`[workspace] Process exited with code ${code}`);
    });

    setTimeout(() => {
      if (ws.status === "starting") ws.status = "running";
    }, 5000);
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
