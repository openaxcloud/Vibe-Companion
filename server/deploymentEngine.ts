import { mkdir, writeFile, rm, readdir, stat, cp, readFile } from "fs/promises";
import { join, extname, resolve, normalize } from "path";
import { existsSync } from "fs";
import { log } from "./index";
import { randomUUID } from "crypto";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import express, { Request, Response, NextFunction, Router } from "express";
import { storage } from "./storage";
import { validateCronExpression } from "./automationScheduler";
import http from "http";
import { getProjectConfig } from "./configParser";
import {
  startProcess,
  stopProcess as stopManagedProcessPM,
  restartProcess as restartManagedProcessPM,
  rollbackProcess,
  performHealthCheck as performHealthCheckPM,
  getProcessLogs as getProcessLogsPM,
  getProcessInfo,
  getProcessStatus as getProcessStatusPM,
  getAllManagedProcesses as getAllManagedProcessesPM,
  shutdownAllProcesses,
  cleanupProjectProcesses,
  getPortForProject,
  setProcessLogCallback,
  type ManagedProcess as PMProcess,
  type ProcessInfo,
} from "./processManager";

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
  createProductionDatabase?: boolean;
  seedProductionData?: boolean;
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

const activeDeploys = new Map<string, DeploymentBuild>();
const activeVMProcesses = new Map<string, ChildProcess>();
const scheduledDeployJobs = new Map<string, { stop: () => void }>();

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateSlug(name: string, projectId: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + String(projectId).slice(0, 8);
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

export async function stopManagedProcess(projectId: string): Promise<void> {
  return stopManagedProcessPM(projectId);
}

export async function restartManagedProcess(projectId: string): Promise<PMProcess | null> {
  return restartManagedProcessPM(projectId);
}

export { performHealthCheckPM as performHealthCheck };
export { getProcessLogsPM as getProcessLogs };

export function getProcessStatus(projectId: string): {
  status: string;
  port: number;
  healthStatus: string;
  lastHealthCheck: Date | undefined;
  restartCount: number;
  pid: number | undefined;
  uptime: number;
} | null {
  return getProcessStatusPM(projectId);
}

export async function provisionProductionDatabase(
  projectId: string,
  seedFromDev: boolean,
  addLog: (line: string) => void,
): Promise<string | null> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      addLog(`[db] No DATABASE_URL found, skipping production database provisioning`);
      return null;
    }

    const pg = await import("pg");
    const pool = new pg.default.Pool({ connectionString: dbUrl });

    // Sanitize schema names - only allow alphanumeric and underscore, max 63 chars (PostgreSQL limit)
    const sanitizeIdentifier = (id: string): string => {
      const sanitized = id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50);
      if (!sanitized || /^\d/.test(sanitized)) return `x_${sanitized}`;
      return sanitized;
    };
    const devSchema = `proj_${sanitizeIdentifier(projectId)}`;
    const prodSchema = `prod_${sanitizeIdentifier(projectId)}`;
    addLog(`[db] Creating production schema: ${prodSchema}`);

    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${prodSchema}"`);
    addLog(`[db] Production schema created`);

    const devTablesResult = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`,
      [devSchema]
    );

    const projectTables = devTablesResult.rows.map((r: any) => r.tablename);

    if (projectTables.length === 0) {
      addLog(`[db] No user-created tables found to copy`);
    }

    for (const tableName of projectTables) {
      // Validate table name to prevent SQL injection via dynamic identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) || tableName.length > 63) {
        addLog(`[db] Skipping invalid table name: ${tableName}`);
        continue;
      }
      try {
        const existsResult = await pool.query(
          `SELECT 1 FROM pg_tables WHERE schemaname = $1 AND tablename = $2`,
          [prodSchema, tableName]
        );
        if (existsResult.rows.length === 0) {
          await pool.query(`CREATE TABLE "${prodSchema}"."${tableName}" (LIKE "${devSchema}"."${tableName}" INCLUDING ALL)`);
          addLog(`[db] Copied table structure: ${tableName}`);
        } else {
          addLog(`[db] Table already exists: ${tableName}`);
        }

        if (seedFromDev) {
          await pool.query(`INSERT INTO "${prodSchema}"."${tableName}" SELECT * FROM "${devSchema}"."${tableName}"`);
          addLog(`[db] Seeded data for: ${tableName}`);
        }
      } catch (err: any) {
        addLog(`[db] Warning: Could not copy table ${tableName}: ${err.message}`);
      }
    }

    const url = new URL(dbUrl);
    const existingOptions = url.searchParams.get("options") || "";
    url.searchParams.set("options", `${existingOptions ? existingOptions + " " : ""}-csearch_path=${prodSchema}`);
    const prodDbUrl = url.toString();
    addLog(`[db] Production DATABASE_URL configured with schema: ${prodSchema}`);

    await pool.end();
    return prodDbUrl;
  } catch (err: any) {
    addLog(`[db] Production database provisioning failed: ${err.message}`);
    return null;
  }
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
    storage.createDeploymentLog({
      projectId,
      deploymentId,
      level: line.includes("[error]") || line.includes("failed") || line.includes("Failed") ? "error" : "info",
      message: line,
      source: "build",
    }).catch(() => {});
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

    if (config?.createProductionDatabase) {
      addLog(`[build] Provisioning production database...`);
      const prodDbUrl = await provisionProductionDatabase(
        projectId,
        config.seedProductionData ?? false,
        addLog,
      );
      if (prodDbUrl) {
        if (!config.deploymentSecrets) config.deploymentSecrets = {};
        config.deploymentSecrets.DATABASE_URL = prodDbUrl;
        addLog(`[build] Production DATABASE_URL injected as deployment secret`);
      }
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
        const secretKeys = Object.keys(config.deploymentSecrets || {});
        const envVars = { ...getSandboxEnv(0), ...(config.deploymentSecrets || {}) };
        const sanitizeLog = (text: string): string => {
          let sanitized = text;
          for (const key of secretKeys) {
            const val = (config?.deploymentSecrets || {})[key];
            if (val && val.length > 3) {
              sanitized = sanitized.replaceAll(val, `[REDACTED:${key}]`);
            }
          }
          return sanitized;
        };
        const { stdout, stderr } = await execAsync(config.buildCommand, {
          cwd: outputDir,
          timeout: 60000,
          env: envVars,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout) addLog(`[build:stdout] ${sanitizeLog(stdout.slice(0, 2000))}`);
        if (stderr) addLog(`[build:stderr] ${sanitizeLog(stderr.slice(0, 2000))}`);
        addLog(`[build] Build command completed successfully`);
      } catch (buildErr: unknown) {
        const err = buildErr as { code?: number; stderr?: string; stdout?: string };
        addLog(`[build] Build command failed (exit ${err.code || "unknown"})`);
        if (err.stderr) addLog(`[build:stderr] ${err.stderr.slice(0, 2000)}`);
        throw new Error(`Build command failed with exit code ${err.code || "unknown"}`);
      }
    }

    const isProcessDeploy = deploymentType === "autoscale" || deploymentType === "reserved-vm";
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

    const cfgIgnorePorts = projectConfig.deployment?.ignorePorts;
    if (cfgIgnorePorts === true) {
      addLog(`[build] All port health checks disabled via ignorePorts = true`);
    } else if (Array.isArray(cfgIgnorePorts) && cfgIgnorePorts.length > 0) {
      addLog(`[build] Ignoring ports from .replit config: ${cfgIgnorePorts.join(", ")}`);
      if (config?.portMapping && cfgIgnorePorts.includes(config.portMapping)) {
        addLog(`[build] Warning: configured portMapping ${config.portMapping} is in ignorePorts list, skipping`);
        config.portMapping = undefined;
      }
    }

    if (isProcessDeploy && entryFile) {
      addLog(`[build] ${deploymentType === "autoscale" ? "Autoscale" : "Scheduled"} deployment — spawning server process`);

      if (config?.maxMachines && deploymentType === "autoscale") {
        addLog(`[build] Max machines: ${config.maxMachines}`);
      }

      const rawIgnorePorts = projectConfig.deployment?.ignorePorts;
      const ignorePorts = rawIgnorePorts === true || (Array.isArray(rawIgnorePorts) && rawIgnorePorts.length > 0);

      let userPlan = "free";
      try {
        const quota = await storage.getUserQuota(userId);
        if (quota?.plan) {
          userPlan = quota.plan.toLowerCase();
        }
      } catch {}

      const managed = await startProcess({
        projectId,
        deploymentId,
        slug,
        language,
        entryFile: entryFile.filename,
        outputDir,
        runCommand: config?.runCommand,
        buildCommand: config?.buildCommand,
        onLog,
        onLogPersist: async (_pid, logs) => {
          try {
            const current = await storage.getDeployment(deploymentId);
            const existingLog = current?.buildLog || build.buildLog || "";
            const separator = existingLog.includes("--- Runtime Logs ---") ? "\n" : "\n--- Runtime Logs ---\n";
            const appendedLog = existingLog + separator + logs.join("\n");
            await storage.updateDeployment(deploymentId, { buildLog: appendedLog });
          } catch {}
        },
        envVars: config?.deploymentSecrets,
        ignorePorts,
        autoRestart: deploymentType === "autoscale",
        plan: userPlan,
      });

      build.processPort = managed.port;
      addLog(`[build] Process started on port ${managed.port} (PID: ${managed.pid})`);
      addLog(`[build] Health monitoring enabled with exponential backoff`);

      const versionMeta = {
        language,
        entryFile: entryFile.filename,
        runCommand: config?.runCommand,
        buildCommand: config?.buildCommand,
        deploymentType: effectiveDeploymentType,
        ignorePorts,
        autoRestart: deploymentType === "autoscale",
        plan: userPlan,
        envVarKeys: config?.deploymentSecrets ? Object.keys(config.deploymentSecrets) : [],
      };
      await writeFile(join(outputDir, ".deploy-config.json"), JSON.stringify(versionMeta, null, 2), "utf-8");
      addLog(`[build] Deployment config saved for version rollback`);

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
            try {
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
            } finally {
              await rm(tempDir, { recursive: true, force: true }).catch(() => {});
            }
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
        let executionOutput = "";
        try {
          const execResult = await captureEntryFileOutput(language, entryFile.filename, outputDir);
          executionOutput = execResult;
          addLog(`[build] Captured execution output (${executionOutput.length} chars)`);
        } catch (err: any) {
          addLog(`[build] Execution capture failed: ${err.message}`);
        }
        const outputHtml = generateOutputPage(projectName, language, entryFile.filename, executionOutput);
        await writeFile(join(outputDir, "index.html"), outputHtml, "utf-8");
        addLog(`[build] Generated deployment page with execution output`);
      }
    } else if (language === "python") {
      addLog(`[build] Python project detected`);
      addLog(`[build] Preparing for deployment...`);
      if (entryFile) {
        let executionOutput = "";
        try {
          const execResult = await captureEntryFileOutput(language, entryFile.filename, outputDir);
          executionOutput = execResult;
          addLog(`[build] Captured execution output (${executionOutput.length} chars)`);
        } catch (err: any) {
          addLog(`[build] Execution capture failed: ${err.message}`);
        }
        const outputHtml = generateOutputPage(projectName, language, entryFile.filename, executionOutput);
        await writeFile(join(outputDir, "index.html"), outputHtml, "utf-8");
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

        let jobCommand: string;
        if (config?.runCommand) {
          jobCommand = config.runCommand;
          addLog(`[build] Using configured run command: ${jobCommand}`);
        } else {
          const entryFile = files.find(f => ["index.js", "index.ts", "main.js", "main.py", "app.py"].includes(f.filename));
          if (entryFile) {
            jobCommand = language === "python" ? `python3 ${entryFile.filename}` : `node ${entryFile.filename}`;
            addLog(`[build] Using auto-detected entry file: ${entryFile.filename}`);
          } else {
            jobCommand = "echo 'No entry file or run command configured'";
            addLog(`[build] Warning: No run command or entry file found`);
          }
        }

        const cron = await import("node-cron");
        const task = cron.schedule(config.cronExpression, async () => {
          log(`[scheduled:${slug}] Executing scheduled job: ${jobCommand}`, "deploy");
          try {
            const envVars = { ...getSandboxEnv(0), ...(config?.deploymentSecrets || {}) };
            const timeoutId = setTimeout(() => {}, timeout * 1000);
            try {
              const { stdout, stderr } = await execAsync(
                jobCommand,
                { cwd: outputDir, timeout: timeout * 1000, env: envVars, maxBuffer: 10 * 1024 * 1024 },
              );
              if (stdout) log(`[scheduled:${slug}:stdout] ${stdout.slice(0, 2000)}`, "deploy");
              if (stderr) log(`[scheduled:${slug}:stderr] ${stderr.slice(0, 2000)}`, "deploy");
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

async function captureEntryFileOutput(language: string, entryFile: string, cwd: string): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  let cmd: string;
  let args: string[];

  if (language === "python") {
    cmd = "python3";
    args = [entryFile];
  } else if (language === "typescript") {
    cmd = "npx";
    args = ["tsx", entryFile];
  } else {
    cmd = "node";
    args = [entryFile];
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NODE_ENV: "production" },
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return output || "(no output)";
  } catch (err: any) {
    const output = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    return output || `Exit code: ${err.code ?? "unknown"}`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateOutputPage(projectName: string, language: string, entryFile: string, executionOutput: string): string {
  const langColors: Record<string, string> = {
    javascript: "#F7DF1E", typescript: "#3178C6", python: "#3776AB",
    go: "#00ADD8", rust: "#CE412B", java: "#ED8B00",
  };
  const safeName = escapeHtml(projectName);
  const safeLang = escapeHtml(language);
  const safeEntry = escapeHtml(entryFile);
  const color = langColors[language] || "#0079F2";
  const escapedOutput = escapeHtml(executionOutput);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName} — E-Code</title>
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
    .content { flex: 1; padding: 24px; max-width: 960px; margin: 0 auto; width: 100%; }
    .output-label { font-size: 12px; color: #9DA2B0; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .output-label .file { font-family: 'JetBrains Mono', monospace; color: ${color}; }
    .output { background: #1C2333; border: 1px solid #2B3245; border-radius: 12px; padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #C8CDD8; overflow-x: auto; min-height: 120px; }
    .footer { padding: 12px 24px; border-top: 1px solid #2B3245; text-align: center; font-size: 11px; color: #4A5068; background: #1C2333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">E</div>
    <span class="title">${safeName}</span>
    <span class="badge">${safeLang}</span>
    <span class="live-badge"><span class="live-dot"></span> Live</span>
  </div>
  <div class="content">
    <div class="output-label">Execution output from <span class="file">${safeEntry}</span></div>
    <div class="output">${escapedOutput}</div>
  </div>
  <div class="footer">&copy; ${new Date().getFullYear()} E-Code &mdash; Cloud IDE &amp; Deployment Platform</div>
</body>
</html>`;
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
  onLog?: (line: string) => void,
): Promise<{ success: boolean; message: string; processPort?: number }> {
  const versionDir = join(DEPLOYMENTS_DIR, slug, `v${targetVersion}`);
  const latestDir = join(DEPLOYMENTS_DIR, slug, "latest");

  if (!existsSync(versionDir)) {
    return { success: false, message: `Version ${targetVersion} not found` };
  }

  try {
    const configPath = join(versionDir, ".deploy-config.json");
    let savedConfig: {
      language?: string;
      entryFile?: string;
      runCommand?: string;
      buildCommand?: string;
      deploymentType?: string;
      ignorePorts?: boolean;
      autoRestart?: boolean;
      plan?: string;
      envVarKeys?: string[];
    } = {};

    if (existsSync(configPath)) {
      try {
        savedConfig = JSON.parse(await readFile(configPath, "utf-8"));
      } catch {}
    }

    if (existsSync(latestDir)) {
      await rm(latestDir, { recursive: true, force: true });
    }
    await cp(versionDir, latestDir, { recursive: true });

    let processPort: number | undefined;
    const deployType = savedConfig.deploymentType || activeDeploys.get(projectId)?.deploymentType;

    if (deployType === "autoscale" || deployType === "reserved-vm") {
      const project = await storage.getProject(projectId);
      const language = savedConfig.language || project?.language || "javascript";
      const entryFileName = savedConfig.entryFile;

      if (entryFileName) {
        let userPlan = savedConfig.plan || "free";
        if (!savedConfig.plan) {
          try {
            const quota = project?.userId ? await storage.getUserQuota(project.userId) : null;
            if (quota?.plan) userPlan = quota.plan.toLowerCase();
          } catch {}
        }

        const deployments = await storage.getProjectDeployments(projectId);
        const targetDep = deployments.find(d => d.version === targetVersion);
        const depSecrets = targetDep?.deploymentSecrets as Record<string, string> | undefined;

        const managed = await startProcess({
          projectId,
          deploymentId: targetDep?.id || activeDeploys.get(projectId)?.deploymentId || "rollback",
          slug,
          language,
          entryFile: entryFileName,
          outputDir: latestDir,
          runCommand: savedConfig.runCommand,
          onLog,
          envVars: depSecrets,
          ignorePorts: savedConfig.ignorePorts || false,
          autoRestart: savedConfig.autoRestart || false,
          plan: userPlan,
        });
        processPort = managed.port;
      }
    }

    log(`Rolled back ${slug} to v${targetVersion}`, "deploy");
    return { success: true, message: `Rolled back to v${targetVersion}`, processPort };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function teardownDeployment(slug: string, projectId?: string): Promise<void> {
  // Stop scheduled cron job if any
  const scheduledJob = scheduledDeployJobs.get(slug);
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledDeployJobs.delete(slug);
    log(`Stopped scheduled cron job for ${slug}`, "deploy");
  }
  // Stop VM process if any
  const vmProc = activeVMProcesses.get(slug);
  if (vmProc) {
    try { vmProc.kill("SIGTERM"); } catch {}
    activeVMProcesses.delete(slug);
  }
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
  projectId: string;
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
            projectId: dep.projectId,
          };
        }
      }
    }
  } catch {}
  return null;
}

function injectWidgets(html: string, settings: { showBadge: boolean; enableFeedback: boolean; projectId: string }): string {
  const widgets: string[] = [];
  if (settings.showBadge) {
    widgets.push(`<div style="position:fixed;bottom:8px;right:8px;background:#0E1525;color:#F5F9FC;padding:4px 10px;border-radius:6px;font-size:11px;font-family:sans-serif;opacity:0.8;z-index:99999;pointer-events:none">Deployed with E-Code</div>`);
  }
  if (settings.enableFeedback) {
    widgets.push(`<div id="ecode-feedback" style="position:fixed;bottom:8px;left:8px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<button id="ecode-fb-toggle" style="background:#0079F2;color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center" aria-label="Send feedback">💬</button>
<div id="ecode-fb-form" style="display:none;position:absolute;bottom:54px;left:0;background:#1A2035;border:1px solid #2D3548;border-radius:10px;padding:16px;width:300px;box-shadow:0 4px 20px rgba(0,0,0,0.4)">
<div style="font-size:14px;font-weight:600;color:#F5F9FC;margin-bottom:10px">Send Feedback</div>
<input id="ecode-fb-name" placeholder="Name (optional)" style="width:100%;box-sizing:border-box;height:32px;background:#0E1525;color:#F5F9FC;border:1px solid #2D3548;border-radius:6px;padding:0 8px;font-size:13px;margin-bottom:6px" />
<input id="ecode-fb-email" placeholder="Email (optional)" type="email" style="width:100%;box-sizing:border-box;height:32px;background:#0E1525;color:#F5F9FC;border:1px solid #2D3548;border-radius:6px;padding:0 8px;font-size:13px;margin-bottom:6px" />
<textarea id="ecode-fb-text" placeholder="Describe the issue or share your thoughts..." style="width:100%;box-sizing:border-box;height:80px;background:#0E1525;color:#F5F9FC;border:1px solid #2D3548;border-radius:6px;padding:8px;resize:none;font-size:13px;margin-bottom:6px"></textarea>
<div style="margin-bottom:8px"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:#8B949E;font-size:12px"><input id="ecode-fb-file" type="file" multiple accept="image/*,.pdf,.txt" style="display:none" /><span id="ecode-fb-file-label" style="background:#0E1525;border:1px solid #2D3548;border-radius:4px;padding:3px 8px">📎 Attach files</span></label></div>
<div style="display:flex;gap:8px;justify-content:flex-end">
<button id="ecode-fb-cancel" style="background:transparent;color:#8B949E;border:1px solid #2D3548;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Cancel</button>
<button id="ecode-fb-submit" style="background:#0079F2;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-weight:500">Send</button>
</div>
<div id="ecode-fb-status" style="display:none;margin-top:8px;font-size:12px;text-align:center"></div>
</div>
</div>
<script>
(function(){
  var pid="${settings.projectId}";
  var toggle=document.getElementById("ecode-fb-toggle");
  var form=document.getElementById("ecode-fb-form");
  var cancel=document.getElementById("ecode-fb-cancel");
  var submit=document.getElementById("ecode-fb-submit");
  var fileInput=document.getElementById("ecode-fb-file");
  var fileLabel=document.getElementById("ecode-fb-file-label");
  var status=document.getElementById("ecode-fb-status");
  toggle.onclick=function(){form.style.display=form.style.display==="none"?"block":"none"};
  cancel.onclick=function(){form.style.display="none"};
  fileInput.onchange=function(){
    fileLabel.textContent=fileInput.files.length>0?"📎 "+fileInput.files.length+" file(s)":"📎 Attach files";
  };
  submit.onclick=function(){
    var text=document.getElementById("ecode-fb-text").value.trim();
    if(!text){status.style.display="block";status.style.color="#E54D4D";status.textContent="Please enter feedback text";return}
    submit.disabled=true;submit.textContent="Sending...";
    var fd=new FormData();
    fd.append("content",text);
    var n=document.getElementById("ecode-fb-name").value.trim();
    var e=document.getElementById("ecode-fb-email").value.trim();
    if(n)fd.append("visitorName",n);
    if(e)fd.append("visitorEmail",e);
    fd.append("pageUrl",window.location.href);
    if(fileInput.files){for(var i=0;i<fileInput.files.length;i++)fd.append("files",fileInput.files[i])}
    fetch("/api/feedback/"+pid,{method:"POST",body:fd})
    .then(function(r){
      if(r.ok){
        status.style.display="block";status.style.color="#0CCE6B";status.textContent="Thank you for your feedback!";
        document.getElementById("ecode-fb-text").value="";
        document.getElementById("ecode-fb-name").value="";
        document.getElementById("ecode-fb-email").value="";
        fileInput.value="";fileLabel.textContent="📎 Attach files";
        setTimeout(function(){form.style.display="none";status.style.display="none"},2000);
      } else {
        r.json().then(function(d){status.style.display="block";status.style.color="#E54D4D";status.textContent=d.message||"Failed to send"});
      }
      submit.disabled=false;submit.textContent="Send";
    })
    .catch(function(){status.style.display="block";status.style.color="#E54D4D";status.textContent="Network error";submit.disabled=false;submit.textContent="Send"});
  };
})();
</script>`);
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

export function parseUaBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "Other";
}

export function parseUaDevice(ua: string): string {
  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) return "Mobile";
  if (/Tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return "Tablet";
  if (/bot|crawl|spider|slurp/i.test(ua)) return "Bot";
  return "Desktop";
}

export function parseUaOs(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  return "Other";
}

const slugToProjectCache = new Map<string, { projectId: string; deploymentId: string; expiresAt: number }>();

async function resolveSlugToProject(slug: string): Promise<{ projectId: string; deploymentId: string } | null> {
  const cached = slugToProjectCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return { projectId: cached.projectId, deploymentId: cached.deploymentId };
  }

  try {
    const { db } = await import("./db");
    const { deployments: deploymentsTable, projects: projectsTable } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const results = await db.select({
      projectId: projectsTable.id,
      projectName: projectsTable.name,
      publishedSlug: projectsTable.publishedSlug,
      deploymentId: deploymentsTable.id,
    }).from(deploymentsTable)
      .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
      .where(eq(deploymentsTable.status, "live"))
      .limit(200);

    for (const row of results) {
      const computedSlug = row.publishedSlug || row.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + String(row.projectId).slice(0, 8);
      slugToProjectCache.set(computedSlug, { projectId: row.projectId, deploymentId: row.deploymentId, expiresAt: Date.now() + 60000 });
      if (computedSlug === slug) {
        return { projectId: row.projectId, deploymentId: row.deploymentId };
      }
    }
  } catch {}
  return null;
}

function trackAnalyticsOnFinish(slug: string, req: Request, res: Response, startTime: number): void {
  res.on("finish", () => {
    (async () => {
      try {
        const resolved = await resolveSlugToProject(slug);
        if (!resolved) return;

        const crypto = await import("crypto");
        const ip = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
        const ipHash = crypto.createHash("sha256").update(ip + resolved.projectId).digest("hex").slice(0, 16);
        const userAgentStr = ((req.headers["user-agent"] || "") as string).slice(0, 1024);
        const visitorId = crypto.createHash("sha256").update(ip + userAgentStr).digest("hex").slice(0, 16);
        let browser = "Unknown", device = "Desktop", osName = "Unknown";
        try {
          browser = parseUaBrowser(userAgentStr);
          device = parseUaDevice(userAgentStr);
          osName = parseUaOs(userAgentStr);
        } catch {}
        const durationMs = Date.now() - startTime;

        let country: string | null = null;
        try {
          // @ts-ignore
          const geoip = await import("geoip-lite");
          const geo = geoip.lookup(ip);
          if (geo?.country) {
            country = geo.country;
          }
        } catch {}
        if (!country) {
          const acceptLang = (req.headers["accept-language"] || "") as string;
          country = acceptLang.split(",")[0]?.split("-")[1]?.toUpperCase() || null;
        }

        await storage.createDeploymentAnalytic({
          projectId: resolved.projectId,
          deploymentId: resolved.deploymentId,
          path: req.path,
          statusCode: res.statusCode,
          durationMs,
          referrer: ((req.headers.referer || req.headers.referrer || "") as string).slice(0, 2048) || null,
          userAgent: userAgentStr,
          browser,
          device,
          os: osName,
          country,
          visitorId,
          ipHash,
        });
      } catch {}
    })();
  });
}

function findProcessForSlug(slug: string): PMProcess | undefined {
  const allProcesses = getAllManagedProcessesPM();
  let found: PMProcess | undefined;
  allProcesses.forEach((proc) => {
    if (!found && proc.slug === slug && (proc.status === "live" || proc.status === "running" || proc.status === "starting")) {
      found = proc;
    }
  });
  return found;
}

const STRIPPED_PROXY_HEADERS = new Set([
  "cookie",
  "authorization",
  "x-session-id",
  "x-csrf-token",
  "x-forwarded-for",
  "x-real-ip",
  "set-cookie",
]);

function proxyToProcess(port: number, req: Request, res: Response): void {
  const target = `http://localhost:${port}`;
  const safeHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!STRIPPED_PROXY_HEADERS.has(key.toLowerCase())) {
      safeHeaders[key] = value;
    }
  }
  safeHeaders["host"] = `localhost:${port}`;

  const proxyReq = http.request(
    `${target}${req.url?.replace(/^\/deployed\/[^/]+/, "") || "/"}`,
    {
      method: req.method,
      headers: safeHeaders,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    res.status(502).json({ error: "Deployment process is not responding" });
  });
  req.pipe(proxyReq);
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

  router.use("/deployed/:slug", (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const slug = String(req.params.slug || "");
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      trackAnalyticsOnFinish(slug, req, res, startTime);
    }
    next();
  });

  router.all("/deployed/:slug/{*filePath}", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
      return res.status(400).json({ error: "Invalid slug" });
    }

    const settings = await getDeploymentSettings(slug);

    if (!await handlePrivateCheck(slug, req, res, settings)) return;

    const managedProc = findProcessForSlug(slug);
    if (managedProc) {
      return proxyToProcess(managedProc.port, req, res);
    }

    const rawPath = String((req.params as Record<string, string>).filePath || "index.html");
    const baseDir = resolve(DEPLOYMENTS_DIR, slug, "latest");

    return resolveAndServe(rawPath, slug, baseDir, settings, req, res);
  });

  router.all("/deployed/:slug/", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");

    const settings = await getDeploymentSettings(slug);

    if (!await handlePrivateCheck(slug, req, res, settings)) return;

    const managedProc = findProcessForSlug(slug);
    if (managedProc) {
      return proxyToProcess(managedProc.port, req, res);
    }

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

export function getAllManagedProcesses() {
  return getAllManagedProcessesPM();
}

export { shutdownAllProcesses, cleanupProjectProcesses, getPortForProject, setProcessLogCallback, setProcessBroadcastFn } from "./processManager";
export type { ProcessInfo } from "./processManager";
