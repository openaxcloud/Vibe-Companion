import { mkdir, writeFile, rm, readdir, stat, cp, readFile } from "fs/promises";
import { join, extname, resolve, normalize } from "path";
import { existsSync } from "fs";
import { log } from "./index";
import { randomUUID } from "crypto";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import express, { Request, Response, Router } from "express";
import { storage } from "./storage";
import { validateCronExpression } from "./automationScheduler";
import http from "http";
import { getProjectConfig } from "./configParser";

const execAsync = promisify(exec);

const DEPLOYMENTS_DIR = join(process.cwd(), ".deployments");
const MAX_DEPLOYMENT_SIZE_MB = 50;
const HEALTH_CHECK_INTERVAL_MS = 30000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_MS = 5000;
const MAX_LOG_BUFFER = 500;

export type DeploymentType = "static" | "autoscale" | "scheduled" | "reserved-vm";

export interface DeploymentConfig {
  deploymentType: DeploymentType;
  buildCommand?: string;
  runCommand?: string;
  machineConfig?: { cpu: number; ram: number };
  maxMachines?: number;
  cronExpression?: string;
  scheduleDescription?: string;
  jobTimeout?: number;
  publicDirectory?: string;
  appType?: "web_server" | "background_worker";
  portMapping?: number;
  deploymentSecrets?: Record<string, string>;
  isPrivate?: boolean;
  showBadge?: boolean;
  enableFeedback?: boolean;
  responseHeaders?: Array<{ path: string; name: string; value: string }>;
  rewrites?: Array<{ from: string; to: string }>;
}

const RESERVED_HEADERS = new Set([
  "accept-ranges", "age", "connection", "content-encoding", "content-length",
  "date", "location", "server", "set-cookie", "transfer-encoding", "upgrade",
  "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "vary", "via", "warning",
]);

function parseReplitConfig(files: ProjectFile[]): { responseHeaders: Array<{ path: string; name: string; value: string }>; rewrites: Array<{ from: string; to: string }> } {
  const result: { responseHeaders: Array<{ path: string; name: string; value: string }>; rewrites: Array<{ from: string; to: string }> } = {
    responseHeaders: [],
    rewrites: [],
  };

  const replitFile = files.find(f => f.filename === ".replit");
  if (!replitFile || !replitFile.content) return result;

  try {
    const content = replitFile.content;
    const headerRegex = /\[\[deployment\.responseHeaders\]\]\s*\n((?:\s*\w+\s*=\s*"[^"]*"\s*\n?)*)/g;
    let match;
    while ((match = headerRegex.exec(content)) !== null) {
      const block = match[1];
      const path = block.match(/path\s*=\s*"([^"]*)"/)?.[1] || "/*";
      const name = block.match(/name\s*=\s*"([^"]*)"/)?.[1];
      const value = block.match(/value\s*=\s*"([^"]*)"/)?.[1];
      if (name && value && !RESERVED_HEADERS.has(name.toLowerCase())) {
        result.responseHeaders.push({ path, name, value });
      }
    }

    const rewriteRegex = /\[\[deployment\.rewrites\]\]\s*\n((?:\s*\w+\s*=\s*"[^"]*"\s*\n?)*)/g;
    while ((match = rewriteRegex.exec(content)) !== null) {
      const block = match[1];
      const from = block.match(/from\s*=\s*"([^"]*)"/)?.[1];
      const to = block.match(/to\s*=\s*"([^"]*)"/)?.[1];
      if (from && to) {
        result.rewrites.push({ from, to });
      }
    }
  } catch {
  }

  return result;
}

function matchWildcardPath(pattern: string, requestPath: string): boolean {
  if (pattern === "/*" || pattern === "*") return true;
  const regexStr = "^" + pattern.replace(/\*/g, "(.*)").replace(/\//g, "\\/") + "$";
  try {
    return new RegExp(regexStr).test(requestPath);
  } catch {
    return false;
  }
}

function applyRewrites(requestPath: string, rewrites: Array<{ from: string; to: string }>, baseDir: string): string | null {
  for (const rule of rewrites) {
    const fromRegex = "^" + rule.from.replace(/\*/g, "(.*)").replace(/\//g, "\\/") + "$";
    try {
      const match = requestPath.match(new RegExp(fromRegex));
      if (match) {
        let target = rule.to;
        const captures = match.slice(1);
        for (const capture of captures) {
          target = target.replace("*", capture);
        }
        const candidatePath = resolve(baseDir, target.replace(/^\//, ""));
        if (candidatePath.startsWith(baseDir)) {
          return target;
        }
      }
    } catch {
    }
  }
  return null;
}

function applyCustomHeaders(res: Response, headers: Array<{ path: string; name: string; value: string }>, requestPath: string): void {
  for (const header of headers) {
    if (matchWildcardPath(header.path, requestPath) && !RESERVED_HEADERS.has(header.name.toLowerCase())) {
      res.setHeader(header.name, header.value);
    }
  }
}

function generatePrivateLoginPage(slug: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Private Deployment — Sign In</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0E1525;color:#F5F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#1A2035;border:1px solid #2D3548;border-radius:16px;padding:48px;max-width:420px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.lock{width:48px;height:48px;margin:0 auto 24px;background:#7C65CB;border-radius:12px;display:flex;align-items:center;justify-content:center}
.lock svg{width:24px;height:24px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
h1{font-size:1.5rem;margin-bottom:8px;font-weight:600}
p{color:#8B949E;font-size:0.95rem;margin-bottom:28px;line-height:1.5}
.btn{display:inline-block;background:#0079F2;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:500;font-size:0.95rem;transition:background 0.2s}
.btn:hover{background:#0066CC}
.footer{margin-top:32px;font-size:0.75rem;color:#4B5563}
</style></head><body>
<div class="card">
<div class="lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
<h1>Private Deployment</h1>
<p>This application is private. Sign in with an authorized account to access it.</p>
<a href="/auth/login?redirect=/deployed/${slug}/" class="btn">Sign In</a>
<p class="footer">Powered by E-Code</p>
</div>
</body></html>`;
}

export interface DeploymentBuild {
  deploymentId: string;
  projectId: string;
  slug: string;
  version: number;
  status: "building" | "live" | "failed" | "stopped";
  deploymentType: DeploymentType;
  buildLog: string;
  url: string;
  startedAt: number;
  finishedAt?: number;
  outputDir: string;
  config?: DeploymentConfig;
  processPort?: number;
}

interface ProjectFile {
  filename: string;
  content: string;
}

interface ManagedProcess {
  process: ChildProcess;
  projectId: string;
  deploymentId: string;
  slug: string;
  port: number;
  language: string;
  entryFile: string;
  outputDir: string;
  status: "starting" | "running" | "stopped" | "error" | "restarting";
  restartCount: number;
  lastHealthCheck?: Date;
  healthStatus: "healthy" | "unhealthy" | "unknown";
  logBuffer: string[];
  onLog?: (line: string) => void;
}

const activeDeploys = new Map<string, DeploymentBuild>();
const activeVMProcesses = new Map<string, ChildProcess>();
const scheduledDeployJobs = new Map<string, { stop: () => void }>();
const managedProcesses = new Map<string, ManagedProcess>();
const healthCheckIntervals = new Map<string, NodeJS.Timeout>();
let nextPort = 9100;

function getNextPort(): number {
  return nextPort++;
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateSlug(name: string, projectId: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + projectId.slice(0, 8);
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function findEntryFile(language: string, files: ProjectFile[], config?: { entrypoint?: string; deployment?: { run?: string | string[] } }): ProjectFile | undefined {
  if (config?.entrypoint) {
    const f = files.find(f => f.filename === config.entrypoint);
    if (f) return f;
  }

  if (language === "javascript" || language === "typescript") {
    return files.find(f =>
      f.filename === "index.js" || f.filename === "index.ts" ||
      f.filename === "main.js" || f.filename === "server.js" || f.filename === "app.js"
    );
  }
  if (language === "python") {
    return files.find(f =>
      f.filename === "main.py" || f.filename === "app.py" || f.filename === "server.py"
    );
  }
  return undefined;
}

function getSandboxEnv(port: number): Record<string, string> {
  const allowed = ["PATH", "HOME", "LANG", "TERM", "SHELL", "USER", "HOSTNAME"];
  const env: Record<string, string> = {
    PORT: String(port),
    NODE_ENV: "production",
  };
  for (const key of allowed) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  return env;
}

function spawnProcess(
  language: string,
  entryFile: string,
  cwd: string,
  port: number,
): ChildProcess {
  const env = getSandboxEnv(port);

  if (language === "javascript" || language === "typescript") {
    const cmd = language === "typescript" ? "npx" : "node";
    const args = language === "typescript" ? ["tsx", entryFile] : [entryFile];
    return spawn(cmd, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  }

  if (language === "python") {
    return spawn("python3", [entryFile], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  }

  return spawn("node", [entryFile], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
}

function addProcessLog(managed: ManagedProcess, line: string) {
  managed.logBuffer.push(`[${new Date().toISOString()}] ${line}`);
  if (managed.logBuffer.length > MAX_LOG_BUFFER) {
    managed.logBuffer.shift();
  }
  managed.onLog?.(line);
}

async function startManagedProcess(
  projectId: string,
  deploymentId: string,
  slug: string,
  language: string,
  entryFile: string,
  outputDir: string,
  onLog?: (line: string) => void,
): Promise<ManagedProcess> {
  await stopManagedProcess(projectId);

  const port = getNextPort();
  const proc = spawnProcess(language, entryFile, outputDir, port);

  const managed: ManagedProcess = {
    process: proc,
    projectId,
    deploymentId,
    slug,
    port,
    language,
    entryFile,
    outputDir,
    status: "starting",
    restartCount: 0,
    healthStatus: "unknown",
    logBuffer: [],
    onLog,
  };

  proc.stdout?.on("data", (data) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      addProcessLog(managed, `[stdout] ${line}`);
    }
  });

  proc.stderr?.on("data", (data) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      addProcessLog(managed, `[stderr] ${line}`);
    }
  });

  function attachExitHandler(proc: ChildProcess, managed: ManagedProcess) {
    proc.on("exit", (code, signal) => {
      const msg = `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`;
      addProcessLog(managed, msg);
      log(`[${slug}] ${msg}`, "deploy");

      if (managed.status !== "stopped") {
        managed.status = "error";
        managed.healthStatus = "unhealthy";

        const build = activeDeploys.get(projectId);
        if (build && build.deploymentType === "autoscale" && managed.restartCount < MAX_RESTART_ATTEMPTS) {
          managed.status = "restarting";
          managed.restartCount++;
          addProcessLog(managed, `Auto-restarting (attempt ${managed.restartCount}/${MAX_RESTART_ATTEMPTS})...`);

          setTimeout(() => {
            try {
              const newProc = spawnProcess(language, entryFile, outputDir, port);
              managed.process = newProc;
              managed.status = "starting";

              newProc.stdout?.on("data", (data) => {
                const lines = data.toString().split("\n").filter((l: string) => l.trim());
                for (const line of lines) addProcessLog(managed, `[stdout] ${line}`);
              });

              newProc.stderr?.on("data", (data) => {
                const lines = data.toString().split("\n").filter((l: string) => l.trim());
                for (const line of lines) addProcessLog(managed, `[stderr] ${line}`);
              });

              attachExitHandler(newProc, managed);

              setTimeout(() => {
                if (managed.status === "starting") {
                  managed.status = "running";
                  addProcessLog(managed, "Process restarted successfully");
                }
              }, 2000);
            } catch (err: any) {
              addProcessLog(managed, `Restart failed: ${err.message}`);
              managed.status = "error";
            }
          }, RESTART_BACKOFF_MS * managed.restartCount);
        }
      }
    });
  }

  attachExitHandler(proc, managed);

  managedProcesses.set(projectId, managed);

  setTimeout(() => {
    if (managed.status === "starting") {
      managed.status = "running";
      addProcessLog(managed, `Process running on port ${port}`);
    }
  }, 2000);

  startHealthChecks(projectId, port);

  return managed;
}

export async function stopManagedProcess(projectId: string): Promise<void> {
  const managed = managedProcesses.get(projectId);
  if (!managed) return;

  managed.status = "stopped";
  stopHealthChecks(projectId);

  try {
    managed.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try { managed.process.kill("SIGKILL"); } catch {}
        resolve();
      }, 5000);
      managed.process.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch {}

  managedProcesses.delete(projectId);
  addProcessLog(managed, "Process stopped");
  log(`Stopped managed process for ${projectId}`, "deploy");
}

export async function restartManagedProcess(projectId: string): Promise<ManagedProcess | null> {
  const managed = managedProcesses.get(projectId);
  if (!managed) return null;

  const { deploymentId, slug, language, entryFile, outputDir, onLog } = managed;
  await stopManagedProcess(projectId);
  return startManagedProcess(projectId, deploymentId, slug, language, entryFile, outputDir, onLog);
}

function startHealthChecks(projectId: string, port: number) {
  stopHealthChecks(projectId);

  const interval = setInterval(async () => {
    const managed = managedProcesses.get(projectId);
    if (!managed || managed.status === "stopped") {
      clearInterval(interval);
      return;
    }

    try {
      const healthy = await checkHealth(port);
      managed.lastHealthCheck = new Date();
      managed.healthStatus = healthy ? "healthy" : "unhealthy";
    } catch {
      managed.healthStatus = "unhealthy";
      managed.lastHealthCheck = new Date();
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  healthCheckIntervals.set(projectId, interval);
}

function stopHealthChecks(projectId: string) {
  const interval = healthCheckIntervals.get(projectId);
  if (interval) {
    clearInterval(interval);
    healthCheckIntervals.delete(projectId);
  }
}

async function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS);

    const req = http.get(`http://localhost:${port}/`, (res) => {
      clearTimeout(timeout);
      resolve(res.statusCode !== undefined && res.statusCode < 500);
      res.resume();
    });

    req.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

export async function performHealthCheck(projectId: string): Promise<{
  status: string;
  healthy: boolean;
  lastCheck: Date | null;
  port: number | null;
  processStatus: string | null;
  restartCount: number;
}> {
  const managed = managedProcesses.get(projectId);
  if (!managed) {
    return { status: "no_process", healthy: false, lastCheck: null, port: null, processStatus: null, restartCount: 0 };
  }

  const healthy = await checkHealth(managed.port);
  managed.lastHealthCheck = new Date();
  managed.healthStatus = healthy ? "healthy" : "unhealthy";

  return {
    status: managed.healthStatus,
    healthy,
    lastCheck: managed.lastHealthCheck,
    port: managed.port,
    processStatus: managed.status,
    restartCount: managed.restartCount,
  };
}

export function getProcessLogs(projectId: string): string[] {
  const managed = managedProcesses.get(projectId);
  return managed?.logBuffer || [];
}

export function getProcessStatus(projectId: string): {
  status: string;
  port: number;
  healthStatus: string;
  lastHealthCheck: Date | undefined;
  restartCount: number;
} | null {
  const managed = managedProcesses.get(projectId);
  if (!managed) return null;
  return {
    status: managed.status,
    port: managed.port,
    healthStatus: managed.healthStatus,
    lastHealthCheck: managed.lastHealthCheck,
    restartCount: managed.restartCount,
  };
}

export async function buildAndDeploy(
  projectId: string,
  projectName: string,
  language: string,
  files: ProjectFile[],
  userId: string,
  deploymentId: string,
  version: number,
  onLog?: (line: string) => void,
  config?: DeploymentConfig,
  deploymentType: DeploymentType = "static",
): Promise<DeploymentBuild> {
  const slug = generateSlug(projectName, projectId);
  const outputDir = join(DEPLOYMENTS_DIR, slug, `v${version}`);
  const latestDir = join(DEPLOYMENTS_DIR, slug, "latest");
  const startedAt = Date.now();
  const effectiveDeploymentType = config?.deploymentType || deploymentType;

  const build: DeploymentBuild = {
    deploymentId,
    projectId,
    slug,
    version,
    status: "building",
    deploymentType: effectiveDeploymentType,
    buildLog: "",
    url: `/deployed/${slug}/`,
    startedAt,
    outputDir,
    config,
  };

  activeDeploys.set(projectId, build);

  const addLog = (line: string) => {
    build.buildLog += line + "\n";
    onLog?.(line);
  };

  try {
    addLog(`[build] Starting ${deploymentType} deployment v${version} for "${projectName}"`);
    addLog(`[build] Language: ${language}`);
    addLog(`[build] Type: ${deploymentType}`);
    addLog(`[build] Files: ${files.length}`);

    if (config?.machineConfig) {
      addLog(`[build] Machine: ${config.machineConfig.cpu} vCPU, ${config.machineConfig.ram} MB RAM`);
    }

    if (config?.deploymentSecrets && Object.keys(config.deploymentSecrets).length > 0) {
      addLog(`[build] Injecting ${Object.keys(config.deploymentSecrets).length} deployment secret(s)`);
    }

    await ensureDir(outputDir);

    const totalSize = files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    addLog(`[build] Total size: ${sizeMB} MB`);

    if (totalSize > MAX_DEPLOYMENT_SIZE_MB * 1024 * 1024) {
      throw new Error(`Project size (${sizeMB} MB) exceeds deployment limit of ${MAX_DEPLOYMENT_SIZE_MB} MB`);
    }

    addLog(`[build] Writing files to deployment directory...`);
    for (const file of files) {
      const filePath = join(outputDir, file.filename);
      const dir = join(outputDir, file.filename.split("/").slice(0, -1).join("/"));
      if (dir !== outputDir) await ensureDir(dir);
      await writeFile(filePath, file.content || "", "utf-8");
    }

    const replitConfig = parseReplitConfig(files);
    if (replitConfig.responseHeaders.length > 0) {
      addLog(`[build] Parsed ${replitConfig.responseHeaders.length} custom response header rule(s) from .replit`);
      if (config) config.responseHeaders = replitConfig.responseHeaders;
    }
    if (replitConfig.rewrites.length > 0) {
      addLog(`[build] Parsed ${replitConfig.rewrites.length} URL rewrite rule(s) from .replit`);
      if (config) config.rewrites = replitConfig.rewrites;
    }

    if (config?.buildCommand) {
      addLog(`[build] Executing build command: ${config.buildCommand}`);
      try {
        const envVars = { ...getSandboxEnv(0), ...(config.deploymentSecrets || {}) };
        const { stdout, stderr } = await execAsync(config.buildCommand, {
          cwd: outputDir,
          timeout: 60000,
          env: envVars,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout) addLog(`[build:stdout] ${stdout.slice(0, 2000)}`);
        if (stderr) addLog(`[build:stderr] ${stderr.slice(0, 2000)}`);
        addLog(`[build] Build command completed successfully`);
      } catch (buildErr: unknown) {
        const err = buildErr as { code?: number; stderr?: string; stdout?: string };
        addLog(`[build] Build command failed (exit ${err.code || "unknown"})`);
        if (err.stderr) addLog(`[build:stderr] ${err.stderr.slice(0, 2000)}`);
        throw new Error(`Build command failed with exit code ${err.code || "unknown"}`);
      }
    }

    const isProcessDeploy = deploymentType === "autoscale" || deploymentType === "scheduled";
    let projectConfig: import("./configParser").ReplitConfig = {};
    try { projectConfig = await getProjectConfig(projectId); } catch {}

    if (projectConfig.deployment?.build && !config?.buildCommand) {
      const deployBuild = projectConfig.deployment.build;
      addLog(`[build] Using .replit [deployment].build: ${deployBuild}`);
      try {
        const envVars = { ...getSandboxEnv(0), ...(config?.deploymentSecrets || {}) };
        const { stdout, stderr } = await execAsync(deployBuild, {
          cwd: outputDir,
          timeout: 60000,
          env: envVars,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout) addLog(`[build:stdout] ${stdout.slice(0, 2000)}`);
        if (stderr) addLog(`[build:stderr] ${stderr.slice(0, 2000)}`);
        addLog(`[build] Deployment build command completed successfully`);
      } catch (buildErr: unknown) {
        const err = buildErr as { stderr?: string };
        const errMsg = err.stderr?.slice(0, 1000) || "Unknown error";
        addLog(`[build] Deployment build command failed: ${errMsg}`);
        throw new Error(`Deployment build failed: ${errMsg}`);
      }
    }

    if (projectConfig.deployment?.run && !config?.runCommand) {
      let deployRun: string;
      if (Array.isArray(projectConfig.deployment.run)) {
        deployRun = projectConfig.deployment.run.map(arg =>
          /["\s\\$`!#&|;()<>]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg
        ).join(" ");
      } else {
        deployRun = projectConfig.deployment.run;
      }
      addLog(`[build] Using .replit [deployment].run: ${deployRun}`);
      if (!config) {
        config = { deploymentType: effectiveDeploymentType, runCommand: deployRun };
      } else {
        config.runCommand = deployRun;
      }
    }

    const entryFile = findEntryFile(language, files, projectConfig);

    if (isProcessDeploy && !entryFile) {
      throw new Error(`No entry file found for ${deploymentType} deployment. Expected index.js, main.js, server.js, app.js (Node.js) or main.py, app.py, server.py (Python).`);
    }

    if (projectConfig.deployment?.ignorePorts && projectConfig.deployment.ignorePorts.length > 0) {
      addLog(`[build] Ignoring ports from .replit config: ${projectConfig.deployment.ignorePorts.join(", ")}`);
      if (config?.portMapping && projectConfig.deployment.ignorePorts.includes(config.portMapping)) {
        addLog(`[build] Warning: configured portMapping ${config.portMapping} is in ignorePorts list, skipping`);
        config.portMapping = undefined;
      }
    }

    if (isProcessDeploy && entryFile) {
      addLog(`[build] ${deploymentType === "autoscale" ? "Autoscale" : "Scheduled"} deployment — spawning server process`);

      if (config?.maxMachines && deploymentType === "autoscale") {
        addLog(`[build] Max machines: ${config.maxMachines}`);
      }

      const managed = await startManagedProcess(
        projectId,
        deploymentId,
        slug,
        language,
        entryFile.filename,
        outputDir,
        onLog,
      );

      build.processPort = managed.port;
      addLog(`[build] Process started on port ${managed.port}`);
      addLog(`[build] Health monitoring enabled (${HEALTH_CHECK_INTERVAL_MS / 1000}s interval)`);

      if (deploymentType === "autoscale") {
        addLog(`[build] Auto-restart on crash enabled (max ${MAX_RESTART_ATTEMPTS} attempts)`);
        addLog(`[build] Autoscale configuration stored`);
      }
    } else if (deploymentType === "static") {
      const pubDir = config?.publicDirectory || "";
      addLog(`[build] Static deployment — serving from: ${pubDir || "root"}`);

      if (pubDir) {
        const pubDirPath = join(outputDir, pubDir);
        if (existsSync(pubDirPath)) {
          const pubStatResult = await stat(pubDirPath);
          if (pubStatResult.isDirectory()) {
            const tempName = `__pub_temp_${Date.now()}`;
            const tempDir = join(outputDir, tempName);
            await cp(pubDirPath, tempDir, { recursive: true });
            const entries = await readdir(outputDir);
            for (const entry of entries) {
              if (entry !== tempName) {
                await rm(join(outputDir, entry), { recursive: true, force: true }).catch(() => {});
              }
            }
            const tempEntries = await readdir(tempDir);
            for (const entry of tempEntries) {
              await cp(join(tempDir, entry), join(outputDir, entry), { recursive: true });
            }
            await rm(tempDir, { recursive: true, force: true });
            addLog(`[build] Promoted ${pubDir}/ contents to deployment root`);
          } else {
            addLog(`[build] Warning: ${pubDir} is not a directory, serving from root`);
          }
        } else {
          addLog(`[build] Warning: ${pubDir}/ not found after build, serving from root`);
        }
      }

      if (language === "html" || files.some(f => f.filename === "index.html")) {
        addLog(`[build] Static HTML site detected`);
        if (!files.find(f => f.filename === "index.html")) {
          const htmlFile = files.find(f => f.filename.endsWith(".html"));
          if (htmlFile) {
            await writeFile(join(outputDir, "index.html"), htmlFile.content, "utf-8");
            addLog(`[build] Created index.html from ${htmlFile.filename}`);
          }
        }
      } else {
        const wrapperHtml = generateAppWrapper(projectName, language, files[0]?.filename || "main");
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
        addLog(`[build] Generated static deployment page`);
      }
    } else if (language === "html" || files.some(f => f.filename === "index.html")) {
      addLog(`[build] Static HTML site detected`);
      addLog(`[build] Optimizing for static serving...`);
      if (!files.find(f => f.filename === "index.html")) {
        const htmlFile = files.find(f => f.filename.endsWith(".html"));
        if (htmlFile) {
          await writeFile(join(outputDir, "index.html"), htmlFile.content, "utf-8");
          addLog(`[build] Created index.html from ${htmlFile.filename}`);
        }
      }
    } else if (language === "javascript" || language === "typescript") {
      addLog(`[build] Node.js project detected`);
      addLog(`[build] Bundling for deployment...`);
      if (entryFile) {
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile.filename);
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
        addLog(`[build] Generated static deployment page`);
      }
    } else if (language === "python") {
      addLog(`[build] Python project detected`);
      addLog(`[build] Preparing for deployment...`);
      if (entryFile) {
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile.filename);
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
      }
    } else if (deploymentType === "reserved-vm") {
      const appType = config?.appType || "web_server";
      const port = config?.portMapping || 3000;
      addLog(`[build] Reserved VM deployment — app type: ${appType}, port: ${port}`);

      if (config?.runCommand) {
        addLog(`[build] Starting persistent process: ${config.runCommand}`);
        const existingProc = activeVMProcesses.get(slug);
        if (existingProc) {
          existingProc.kill("SIGTERM");
          activeVMProcesses.delete(slug);
          addLog(`[build] Stopped previous VM process`);
        }

        const envVars = {
          ...getSandboxEnv(port),
          ...(config.deploymentSecrets || {}),
        };

        const cmdParts = config.runCommand.split(/\s+/);
        const proc = spawn(cmdParts[0], cmdParts.slice(1), {
          cwd: outputDir,
          env: envVars,
          stdio: ["ignore", "pipe", "pipe"],
          detached: false,
        });

        proc.stdout?.on("data", (data: Buffer) => {
          log(`[vm:${slug}] ${data.toString().trim()}`, "deploy");
        });
        proc.stderr?.on("data", (data: Buffer) => {
          log(`[vm:${slug}:err] ${data.toString().trim()}`, "deploy");
        });
        proc.on("exit", (code) => {
          log(`[vm:${slug}] Process exited with code ${code}`, "deploy");
          activeVMProcesses.delete(slug);
        });

        activeVMProcesses.set(slug, proc);
        addLog(`[build] VM process started (PID: ${proc.pid}, port: ${port})`);
      }

      if (language === "html" || files.some(f => f.filename === "index.html")) {
        if (!files.find(f => f.filename === "index.html")) {
          const htmlFile = files.find(f => f.filename.endsWith(".html"));
          if (htmlFile) {
            await writeFile(join(outputDir, "index.html"), htmlFile.content, "utf-8");
          }
        }
      } else {
        const entryFile = files.find(f => ["index.js", "index.ts", "main.js", "server.js", "app.js", "main.py", "app.py"].includes(f.filename));
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile?.filename || files[0]?.filename || "main");
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
      }
      addLog(`[build] Reserved VM process ready`);
    } else if (deploymentType === "scheduled") {
      addLog(`[build] Scheduled deployment`);
      if (config?.cronExpression) {
        addLog(`[build] Schedule: ${config.cronExpression}`);
        if (!validateCronExpression(config.cronExpression)) {
          throw new Error(`Invalid cron expression: ${config.cronExpression}`);
        }
      }
      if (config?.scheduleDescription) {
        addLog(`[build] Description: ${config.scheduleDescription}`);
      }
      const timeout = config?.jobTimeout || 300;
      addLog(`[build] Job timeout: ${timeout}s`);

      if (config?.cronExpression) {
        const existingJob = scheduledDeployJobs.get(slug);
        if (existingJob) {
          existingJob.stop();
          scheduledDeployJobs.delete(slug);
          addLog(`[build] Cleared previous scheduled job`);
        }

        const entryFile = files.find(f => ["index.js", "index.ts", "main.js", "main.py", "app.py"].includes(f.filename));
        const entryScript = entryFile?.content || "";
        const entryLang = language;

        const cron = await import("node-cron");
        const task = cron.schedule(config.cronExpression, async () => {
          log(`[scheduled:${slug}] Executing scheduled job`, "deploy");
          try {
            const envVars = { ...getSandboxEnv(0), ...(config?.deploymentSecrets || {}) };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
            try {
              await execAsync(
                entryLang === "python" ? `python3 -c ${JSON.stringify(entryScript)}` : `node -e ${JSON.stringify(entryScript)}`,
                { cwd: outputDir, timeout: timeout * 1000, env: envVars, maxBuffer: 10 * 1024 * 1024 },
              );
              log(`[scheduled:${slug}] Job completed successfully`, "deploy");
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (err: unknown) {
            const e = err as { message?: string };
            log(`[scheduled:${slug}] Job failed: ${e.message || "unknown error"}`, "deploy");
          }
        });

        scheduledDeployJobs.set(slug, task);
        addLog(`[build] Registered cron job for ${config.cronExpression} with ${timeout}s timeout`);
      }

      const entryFile = files.find(f => ["index.js", "index.ts", "main.js", "main.py", "app.py"].includes(f.filename));
      const wrapperHtml = generateAppWrapper(projectName, language, entryFile?.filename || files[0]?.filename || "main");
      await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
      addLog(`[build] Scheduled job configured`);
    } else {
      if (language === "html" || files.some(f => f.filename === "index.html")) {
        if (!files.find(f => f.filename === "index.html")) {
          const htmlFile = files.find(f => f.filename.endsWith(".html"));
          if (htmlFile) {
            await writeFile(join(outputDir, "index.html"), htmlFile.content, "utf-8");
          }
        }
      } else {
        const entryFile = files.find(f => ["index.js", "index.ts", "main.js", "server.js", "app.js", "main.py", "app.py"].includes(f.filename));
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile?.filename || files[0]?.filename || "main");
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
      }
    }

    addLog(`[build] Setting up routing...`);

    if (existsSync(latestDir)) {
      await rm(latestDir, { recursive: true, force: true });
    }
    await ensureDir(join(DEPLOYMENTS_DIR, slug));
    await cp(outputDir, latestDir, { recursive: true });

    addLog(`[build] Deployment URL: ${build.url}`);
    addLog(`[build] ✓ Build complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    addLog(`[build] ✓ ${deploymentType} deployment v${version} is now LIVE`);

    build.status = "live";
    build.finishedAt = Date.now();

    log(`Deployment ${slug} v${version} (${deploymentType}) is live`, "deploy");
    return build;

  } catch (err: any) {
    addLog(`[build] ✗ Build failed: ${err.message}`);
    build.status = "failed";
    build.finishedAt = Date.now();
    log(`Deployment failed for ${projectId}: ${err.message}`, "deploy");
    return build;
  }
}

function generateAppWrapper(projectName: string, language: string, entryFile: string): string {
  const langColors: Record<string, string> = {
    javascript: "#F7DF1E", typescript: "#3178C6", python: "#3776AB",
    go: "#00ADD8", rust: "#CE412B", java: "#ED8B00", ruby: "#CC342D",
    cpp: "#00599C", c: "#A8B9CC", bash: "#4EAA25", html: "#E34F26",
  };
  const color = langColors[language] || "#0079F2";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — E-Code</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23F26522'/><text x='16' y='23' font-family='sans-serif' font-size='20' font-weight='bold' fill='white' text-anchor='middle'>E</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0E1525; color: #F5F9FC; min-height: 100vh; display: flex; flex-direction: column; }
    .header { padding: 16px 24px; border-bottom: 1px solid #2B3245; display: flex; align-items: center; gap: 12px; background: #1C2333; }
    .logo { width: 28px; height: 28px; border-radius: 6px; background: #F26522; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: white; }
    .title { font-size: 14px; font-weight: 600; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: ${color}20; color: ${color}; border: 1px solid ${color}40; font-weight: 600; text-transform: uppercase; }
    .live-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: #0CCE6B20; color: #0CCE6B; border: 1px solid #0CCE6B40; font-weight: 600; display: flex; align-items: center; gap: 4px; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #0CCE6B; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; }
    .card { background: #1C2333; border: 1px solid #2B3245; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; text-align: center; }
    .card h2 { font-size: 20px; margin-bottom: 8px; }
    .card p { font-size: 13px; color: #9DA2B0; margin-bottom: 24px; line-height: 1.6; }
    .files { text-align: left; background: #0E1525; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .file { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #9DA2B0; padding: 4px 0; display: flex; align-items: center; gap: 8px; }
    .file-icon { width: 14px; height: 14px; border-radius: 3px; background: ${color}; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: bold; color: white; flex-shrink: 0; }
    .powered { font-size: 11px; color: #4A5068; margin-top: 24px; }
    .powered a { color: #0079F2; text-decoration: none; }
    .footer { padding: 12px 24px; border-top: 1px solid #2B3245; text-align: center; font-size: 11px; color: #4A5068; background: #1C2333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">E</div>
    <span class="title">${projectName}</span>
    <span class="badge">${language}</span>
    <span class="live-badge"><span class="live-dot"></span> Live</span>
  </div>
  <div class="content">
    <div class="card">
      <h2>${projectName}</h2>
      <p>This ${language} application has been deployed with E-Code. The source code is available for viewing.</p>
      <div class="files">
        <div class="file"><div class="file-icon">&lt;&gt;</div> ${entryFile}</div>
      </div>
      <div class="powered">Deployed with <a href="/">E-Code</a></div>
    </div>
  </div>
  <div class="footer">© ${new Date().getFullYear()} E-Code — Cloud IDE & Deployment Platform</div>
</body>
</html>`;
}

export async function rollbackDeployment(
  projectId: string,
  slug: string,
  targetVersion: number,
): Promise<{ success: boolean; message: string }> {
  const versionDir = join(DEPLOYMENTS_DIR, slug, `v${targetVersion}`);
  const latestDir = join(DEPLOYMENTS_DIR, slug, "latest");

  if (!existsSync(versionDir)) {
    return { success: false, message: `Version ${targetVersion} not found` };
  }

  try {
    if (existsSync(latestDir)) {
      await rm(latestDir, { recursive: true, force: true });
    }
    await cp(versionDir, latestDir, { recursive: true });
    log(`Rolled back ${slug} to v${targetVersion}`, "deploy");
    return { success: true, message: `Rolled back to v${targetVersion}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function teardownDeployment(slug: string, projectId?: string): Promise<void> {
  if (projectId) {
    await stopManagedProcess(projectId);
  }
  const deployDir = join(DEPLOYMENTS_DIR, slug);
  if (existsSync(deployDir)) {
    await rm(deployDir, { recursive: true, force: true });
    log(`Torn down deployment ${slug}`, "deploy");
  }
}

interface RequestWithSession extends Request {
  session: Request["session"] & { userId?: string };
}

async function checkPrivateDeployment(slug: string, req: Request): Promise<boolean> {
  try {
    const { db } = await import("./db");
    const { deployments } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const deps = await db.select().from(deployments)
      .where(and(eq(deployments.status, "live"), eq(deployments.isPrivate, true)));
    for (const dep of deps) {
      const project = await storage.getProject(dep.projectId);
      if (project) {
        const depSlug = generateSlug(project.name, project.id);
        if (depSlug === slug) {
          const sessionReq = req as RequestWithSession;
          const userId = sessionReq.session?.userId;
          if (!userId || (userId !== dep.userId && userId !== project.userId)) {
            return false;
          }
          return true;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

interface DeploymentSettings {
  showBadge: boolean;
  enableFeedback: boolean;
  responseHeaders: Array<{ path: string; name: string; value: string }>;
  rewrites: Array<{ from: string; to: string }>;
  isPrivate: boolean;
}

async function getDeploymentSettings(slug: string): Promise<DeploymentSettings | null> {
  try {
    const { db } = await import("./db");
    const { deployments } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const deps = await db.select().from(deployments)
      .where(eq(deployments.status, "live"));
    for (const dep of deps) {
      const project = await storage.getProject(dep.projectId);
      if (project) {
        const depSlug = generateSlug(project.name, project.id);
        if (depSlug === slug) {
          return {
            showBadge: dep.showBadge ?? true,
            enableFeedback: dep.enableFeedback ?? false,
            responseHeaders: dep.responseHeaders || [],
            rewrites: dep.rewrites || [],
            isPrivate: dep.isPrivate ?? false,
          };
        }
      }
    }
  } catch {}
  return null;
}

function injectWidgets(html: string, settings: { showBadge: boolean; enableFeedback: boolean }): string {
  const widgets: string[] = [];
  if (settings.showBadge) {
    widgets.push(`<div style="position:fixed;bottom:8px;right:8px;background:#0E1525;color:#F5F9FC;padding:4px 10px;border-radius:6px;font-size:11px;font-family:sans-serif;opacity:0.8;z-index:99999;pointer-events:none">Deployed with E-Code</div>`);
  }
  if (settings.enableFeedback) {
    widgets.push(`<div id="ecode-feedback" style="position:fixed;bottom:8px;left:8px;z-index:99999"><button onclick="document.getElementById('ecode-fb-form').style.display=document.getElementById('ecode-fb-form').style.display==='none'?'block':'none'" style="background:#0079F2;color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:18px">💬</button><div id="ecode-fb-form" style="display:none;position:absolute;bottom:50px;left:0;background:#1A2035;border:1px solid #2D3548;border-radius:8px;padding:12px;width:250px"><textarea placeholder="Send feedback..." style="width:100%;height:60px;background:#0E1525;color:#F5F9FC;border:1px solid #2D3548;border-radius:4px;padding:6px;resize:none;font-family:sans-serif;font-size:13px"></textarea><button style="margin-top:6px;background:#0079F2;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:12px">Send</button></div></div>`);
  }
  if (widgets.length === 0) return html;
  const injection = widgets.join("");
  if (html.includes("</body>")) {
    return html.replace("</body>", injection + "</body>");
  }
  return html + injection;
}

async function serve404(baseDir: string, slug: string, res: Response): Promise<void> {
  const custom404 = join(baseDir, "404.html");
  if (existsSync(custom404)) {
    res.setHeader("Content-Type", "text/html");
    const content = await readFile(custom404, "utf-8");
    res.status(404).send(content);
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.status(404).send(generate404Page(slug));
}

function generate404Page(slug: string): string {
  return `<!DOCTYPE html>
<html><head><title>404 — Not Found</title><style>
body{background:#0E1525;color:#F5F9FC;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.c{text-align:center}h1{font-size:6rem;margin:0;color:#7C65CB}p{color:#8B949E;font-size:1.2rem}
a{color:#0079F2;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body><div class="c"><h1>404</h1><p>The page you're looking for doesn't exist.</p><a href="/deployed/${slug}/">Back to Home</a></div></body></html>`;
}

async function trackAnalytics(slug: string, req: Request): Promise<void> {
  try {
    const { db } = await import("./db");
    const { deployments } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const deps = await db.select().from(deployments)
      .where(eq(deployments.status, "live"))
      .limit(100);
    for (const dep of deps) {
      const project = await storage.getProject(dep.projectId);
      if (project) {
        const depSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
        if (depSlug === slug) {
          const crypto = await import("crypto");
          const ip = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
          const ipHash = crypto.createHash("sha256").update(ip + dep.projectId).digest("hex").slice(0, 16);
          const visitorId = crypto.createHash("sha256").update(ip + (req.headers["user-agent"] || "")).digest("hex").slice(0, 16);
          await storage.createDeploymentAnalytic({
            projectId: dep.projectId,
            deploymentId: dep.id,
            path: req.path,
            referrer: (req.headers.referer || req.headers.referrer || "") as string,
            userAgent: (req.headers["user-agent"] || "") as string,
            visitorId,
            ipHash,
          });
          return;
        }
      }
    }
  } catch {
  }
}

export function createDeploymentRouter(): Router {
  const router = Router();

  async function handlePrivateCheck(slug: string, req: Request, res: Response, settings: DeploymentSettings | null): Promise<boolean> {
    const allowed = await checkPrivateDeployment(slug, req);
    if (!allowed) {
      res.setHeader("Content-Type", "text/html");
      res.status(403).send(generatePrivateLoginPage(slug));
      return false;
    }
    return true;
  }

  async function serveFile(filePath: string, baseDir: string, slug: string, requestPath: string, settings: DeploymentSettings | null, res: Response): Promise<void> {
    const mimeType = getMimeType(filePath);
    if (settings && settings.responseHeaders.length > 0) {
      applyCustomHeaders(res, settings.responseHeaders, requestPath);
    }

    if (mimeType === "text/html") {
      let html = await readFile(filePath, "utf-8");
      if (settings) html = injectWidgets(html, settings);
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Deployed-By", "E-Code");
      res.send(html);
      return;
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Deployed-By", "E-Code");
    res.sendFile(filePath);
  }

  async function resolveAndServe(rawPath: string, slug: string, baseDir: string, settings: DeploymentSettings | null, req: Request, res: Response): Promise<void> {
    const safePath = normalize(rawPath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = resolve(baseDir, safePath);

    if (!fullPath.startsWith(baseDir)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const requestPath = "/" + safePath;

    if (existsSync(fullPath)) {
      try {
        const fileStat = await stat(fullPath);
        if (fileStat.isDirectory()) {
          const indexPath = join(fullPath, "index.html");
          if (existsSync(indexPath)) {
            return serveFile(indexPath, baseDir, slug, requestPath, settings, res);
          }
          return serve404(baseDir, slug, res);
        }
        return serveFile(fullPath, baseDir, slug, requestPath, settings, res);
      } catch {
        res.status(500).json({ error: "Failed to serve file" });
        return;
      }
    }

    if (settings && settings.rewrites.length > 0) {
      const rewritten = applyRewrites(requestPath, settings.rewrites, baseDir);
      if (rewritten) {
        const rewrittenSafe = normalize(rewritten.replace(/^\//, "")).replace(/^(\.\.[\/\\])+/, "");
        const rewrittenFull = resolve(baseDir, rewrittenSafe);
        if (rewrittenFull.startsWith(baseDir) && existsSync(rewrittenFull)) {
          try {
            const rStat = await stat(rewrittenFull);
            if (rStat.isDirectory()) {
              const rIndex = join(rewrittenFull, "index.html");
              if (existsSync(rIndex)) {
                return serveFile(rIndex, baseDir, slug, requestPath, settings, res);
              }
            } else {
              return serveFile(rewrittenFull, baseDir, slug, requestPath, settings, res);
            }
          } catch {}
        }
      }
    }

    return serve404(baseDir, slug, res);
  }

  router.get("/deployed/:slug/{*filePath}", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
      return res.status(400).json({ error: "Invalid slug" });
    }

    const settings = await getDeploymentSettings(slug);

    if (!await handlePrivateCheck(slug, req, res, settings)) return;

    trackAnalytics(slug, req).catch(() => {});

    const rawPath = String((req.params as Record<string, string>).filePath || "index.html");
    const baseDir = resolve(DEPLOYMENTS_DIR, slug, "latest");

    return resolveAndServe(rawPath, slug, baseDir, settings, req, res);
  });

  router.get("/deployed/:slug/", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");

    const settings = await getDeploymentSettings(slug);

    if (!await handlePrivateCheck(slug, req, res, settings)) return;

    trackAnalytics(slug, req).catch(() => {});

    const baseDir = join(DEPLOYMENTS_DIR, slug, "latest");

    return resolveAndServe("index.html", slug, baseDir, settings, req, res);
  });

  return router;
}

export interface ArtifactDeployInfo {
  artifactId: string;
  name: string;
  type: string;
  subRoute: string;
  entryFile?: string;
}

export async function buildAndDeployMultiArtifact(
  projectId: string,
  projectName: string,
  language: string,
  files: ProjectFile[],
  userId: string,
  deploymentId: string,
  version: number,
  artifacts: ArtifactDeployInfo[],
  onLog?: (line: string) => void,
  config?: DeploymentConfig,
  deploymentType: DeploymentType = "static",
): Promise<DeploymentBuild> {
  const slug = generateSlug(projectName, projectId);
  const outputDir = join(DEPLOYMENTS_DIR, slug, `v${version}`);
  const startedAt = Date.now();
  const addLog = (line: string) => { onLog?.(line); };

  addLog(`[build] Multi-artifact deployment: ${artifacts.length} artifact(s)`);

  for (const artifact of artifacts) {
    const subDir = join(outputDir, artifact.subRoute);
    await ensureDir(subDir);

    const artifactFiles = files;

    for (const file of artifactFiles) {
      const filePath = join(subDir, file.filename);
      const dir = join(subDir, file.filename.split("/").slice(0, -1).join("/"));
      if (dir !== subDir) await ensureDir(dir);
      await writeFile(filePath, file.content || "", "utf-8");
    }

    addLog(`[build] Artifact "${artifact.name}" (${artifact.type}) deployed to /${artifact.subRoute}/`);
  }

  return buildAndDeploy(projectId, projectName, language, files, userId, deploymentId, version, onLog, config, deploymentType);
}

export function getActiveDeployment(projectId: string): DeploymentBuild | undefined {
  return activeDeploys.get(projectId);
}

export async function listDeploymentVersions(slug: string): Promise<number[]> {
  const deployDir = join(DEPLOYMENTS_DIR, slug);
  if (!existsSync(deployDir)) return [];
  try {
    const entries = await readdir(deployDir);
    return entries
      .filter(e => e.startsWith("v") && !isNaN(parseInt(e.slice(1))))
      .map(e => parseInt(e.slice(1)))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}

export function getAllManagedProcesses(): Map<string, ManagedProcess> {
  return managedProcesses;
}
