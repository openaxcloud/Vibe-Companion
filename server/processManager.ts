import { spawn, ChildProcess, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import http from "http";
import { log } from "./index";

const PORT_RANGE_START = 9000;
const PORT_RANGE_END = 9999;
const MAX_LOG_BUFFER = 1000;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_BACKOFF_BASE_MS = 2000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CHECK_MAX_RETRIES = 15;
const HEALTH_CHECK_INITIAL_DELAY_MS = 1000;
const HEALTH_CHECK_INTERVAL_MS = 30000;

export type ProcessStatus = "starting" | "building" | "running" | "live" | "crashed" | "stopped" | "restarting";

export interface ProcessResourceLimits {
  maxMemoryMb: number;
  maxCpuPercent: number;
}

const PLAN_RESOURCE_LIMITS: Record<string, ProcessResourceLimits> = {
  free: { maxMemoryMb: 512, maxCpuPercent: 50 },
  pro: { maxMemoryMb: 2048, maxCpuPercent: 100 },
  team: { maxMemoryMb: 4096, maxCpuPercent: 200 },
};

export interface ManagedProcess {
  process: ChildProcess | null;
  projectId: string;
  deploymentId: string;
  slug: string;
  port: number;
  language: string;
  entryFile: string;
  outputDir: string;
  runCommand?: string;
  buildCommand?: string;
  status: ProcessStatus;
  restartCount: number;
  maxRestarts: number;
  lastHealthCheck?: Date;
  healthStatus: "healthy" | "unhealthy" | "unknown";
  logBuffer: string[];
  onLog?: (line: string) => void;
  onLogPersist?: (projectId: string, logs: string[]) => void;
  onStatusChange?: (projectId: string, status: ProcessStatus) => void;
  logFlushInterval?: NodeJS.Timeout;
  lastFlushedLogIndex: number;
  startedAt: number;
  pid?: number;
  resourceLimits: ProcessResourceLimits;
  ignorePorts: boolean;
  envVars: Record<string, string>;
  autoRestart: boolean;
  previousVersionDir?: string;
  restartTimeoutId?: ReturnType<typeof setTimeout>;
}

export interface ProcessInfo {
  projectId: string;
  deploymentId: string;
  slug: string;
  port: number;
  status: ProcessStatus;
  healthStatus: string;
  lastHealthCheck?: Date;
  restartCount: number;
  pid?: number;
  uptime: number;
  resourceLimits: ProcessResourceLimits;
  startedAt: number;
  resourceUsage?: { cpuPercent: number; memoryMb: number } | null;
}

const managedProcesses = new Map<string, ManagedProcess>();
const allocatedPorts = new Set<number>();
const healthCheckIntervals = new Map<string, NodeJS.Timeout>();

let globalBroadcastFn: ((projectId: string, data: any) => void) | null = null;

export function setProcessBroadcastFn(fn: (projectId: string, data: any) => void): void {
  globalBroadcastFn = fn;
}

function setStatus(managed: ManagedProcess, status: ProcessStatus): void {
  managed.status = status;
  if (managed.onStatusChange) {
    try { managed.onStatusChange(managed.projectId, status); } catch {}
  }
  if (globalBroadcastFn) {
    try { globalBroadcastFn(managed.projectId, { type: "deploy_status", status, port: managed.port }); } catch {}
  }
}
let nextPortCandidate = PORT_RANGE_START;

function allocatePort(): number {
  for (let i = 0; i < PORT_RANGE_END - PORT_RANGE_START + 1; i++) {
    const port = PORT_RANGE_START + ((nextPortCandidate - PORT_RANGE_START + i) % (PORT_RANGE_END - PORT_RANGE_START + 1));
    if (!allocatedPorts.has(port)) {
      allocatedPorts.add(port);
      nextPortCandidate = port + 1;
      return port;
    }
  }
  throw new Error("No available ports in the deployment port pool");
}

function releasePort(port: number): void {
  allocatedPorts.delete(port);
}

function getSandboxEnv(port: number, extraEnv?: Record<string, string>): Record<string, string> {
  const allowed = ["PATH", "HOME", "LANG", "TERM", "SHELL", "USER", "HOSTNAME"];
  const env: Record<string, string> = {
    PORT: String(port),
    NODE_ENV: "production",
  };
  for (const key of allowed) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  if (extraEnv) {
    Object.assign(env, extraEnv);
  }
  return env;
}

function addLog(managed: ManagedProcess, line: string): void {
  const entry = `[${new Date().toISOString()}] ${line}`;
  managed.logBuffer.push(entry);
  if (managed.logBuffer.length > MAX_LOG_BUFFER) {
    managed.logBuffer = managed.logBuffer.slice(-MAX_LOG_BUFFER);
  }
  managed.onLog?.(entry);
}

function buildResourceLimitPrefix(limits: ProcessResourceLimits): string {
  const memKb = limits.maxMemoryMb * 1024;
  return `ulimit -v ${memKb} 2>/dev/null; nice -n ${limits.maxCpuPercent >= 200 ? 0 : limits.maxCpuPercent >= 100 ? 5 : 10}`;
}

function buildDefaultRunCommand(language: string, entryFile: string, outputDir: string): string {
  if (language === "javascript" || language === "typescript") {
    const hasPackageJson = existsSync(join(outputDir, "package.json"));
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(readFileSync(join(outputDir, "package.json"), "utf-8"));
        if (pkg.scripts?.start) {
          return `npm install --production 2>&1 && npm start`;
        }
      } catch {}
      return `npm install --production 2>&1 && ${language === "typescript" ? `npx tsx ${entryFile}` : `node ${entryFile}`}`;
    }
    return language === "typescript" ? `npx tsx ${entryFile}` : `node ${entryFile}`;
  } else if (language === "python") {
    const hasRequirements = existsSync(join(outputDir, "requirements.txt"));
    if (hasRequirements) {
      return `pip install -r requirements.txt 2>&1 && python3 ${entryFile}`;
    }
    return `python3 ${entryFile}`;
  }
  return `node ${entryFile}`;
}

function spawnDeploymentProcess(managed: ManagedProcess): ChildProcess {
  const env = getSandboxEnv(managed.port, managed.envVars);
  const limitPrefix = buildResourceLimitPrefix(managed.resourceLimits);

  const userCmd = managed.runCommand || buildDefaultRunCommand(managed.language, managed.entryFile, managed.outputDir);
  const wrappedCmd = `${limitPrefix} ${userCmd}`;
  const proc = spawn("sh", ["-c", wrappedCmd], { cwd: managed.outputDir, env, stdio: ["pipe", "pipe", "pipe"] });

  return proc;
}

function getProcessResourceUsage(pid: number | undefined): { cpuPercent: number; memoryMb: number } | null {
  if (!pid) return null;
  try {
    const output = execSync(`ps -p ${pid} -o %cpu=,rss= 2>/dev/null`, { timeout: 2000 }).toString().trim();
    if (!output) return null;
    const parts = output.split(/\s+/);
    return {
      cpuPercent: parseFloat(parts[0]) || 0,
      memoryMb: Math.round((parseInt(parts[1], 10) || 0) / 1024),
    };
  } catch {
    return null;
  }
}

function attachProcessHandlers(managed: ManagedProcess): void {
  const proc = managed.process;
  if (!proc) return;

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      addLog(managed, `[stdout] ${line}`);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      addLog(managed, `[stderr] ${line}`);
    }
  });

  proc.on("exit", (code, signal) => {
    const msg = `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`;
    addLog(managed, msg);
    log(`[${managed.slug}] ${msg}`, "deploy");

    if (managed.status === "stopped" || managed.status === "restarting") {
      return;
    }

    setStatus(managed, "crashed");
    managed.healthStatus = "unhealthy";
    persistLogs(managed);

    if (managed.autoRestart && managed.restartCount < managed.maxRestarts) {
      const backoff = RESTART_BACKOFF_BASE_MS * Math.pow(2, managed.restartCount);
      setStatus(managed, "restarting");
      managed.restartCount++;
      addLog(managed, `Auto-restarting in ${backoff}ms (attempt ${managed.restartCount}/${managed.maxRestarts})...`);

      managed.restartTimeoutId = setTimeout(async () => {
        const current = managedProcesses.get(managed.projectId);
        if (!current || current !== managed || managed.status === "stopped") {
          addLog(managed, "Auto-restart cancelled (process was stopped or replaced)");
          return;
        }
        try {
          const newProc = spawnDeploymentProcess(managed);
          managed.process = newProc;
          managed.pid = newProc.pid;
          setStatus(managed, "starting");
          attachProcessHandlers(managed);

          if (!managed.ignorePorts) {
            const healthy = await waitForHealthy(managed.port, managed);
            if ((managed.status as ProcessStatus) === "stopped") return;
            if (healthy) {
              setStatus(managed, "live");
              managed.healthStatus = "healthy";
              addLog(managed, "Process restarted successfully and is healthy");
            } else if ((managed.status as ProcessStatus) !== "crashed") {
              setStatus(managed, "crashed");
              managed.healthStatus = "unhealthy";
              addLog(managed, "Process restarted but failed health check");
            }
          } else {
            setStatus(managed, "live");
            addLog(managed, "Process restarted successfully (port check skipped)");
          }
        } catch (err: any) {
          addLog(managed, `Restart failed: ${err.message}`);
          setStatus(managed, "crashed");
        }
      }, backoff);
    } else if (managed.restartCount >= managed.maxRestarts) {
      addLog(managed, `Max restart attempts (${managed.maxRestarts}) reached. Process stopped.`);
    }
  });
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

async function waitForHealthy(port: number, managed: ManagedProcess): Promise<boolean> {
  let delay = HEALTH_CHECK_INITIAL_DELAY_MS;
  for (let i = 0; i < HEALTH_CHECK_MAX_RETRIES; i++) {
    await new Promise(r => setTimeout(r, delay));
    if (managed.status === "stopped") return false;

    const healthy = await checkHealth(port);
    if (healthy) {
      managed.lastHealthCheck = new Date();
      managed.healthStatus = "healthy";
      return true;
    }
    delay = Math.min(delay * 1.5, 5000);
    addLog(managed, `Health check attempt ${i + 1}/${HEALTH_CHECK_MAX_RETRIES} - waiting...`);
  }
  return false;
}

function startPeriodicHealthChecks(projectId: string): void {
  stopPeriodicHealthChecks(projectId);
  const managed = managedProcesses.get(projectId);
  if (!managed || managed.ignorePorts) return;

  const interval = setInterval(async () => {
    const m = managedProcesses.get(projectId);
    if (!m || m.status === "stopped" || m.status === "crashed") {
      clearInterval(interval);
      return;
    }

    try {
      const healthy = await checkHealth(m.port);
      m.lastHealthCheck = new Date();
      m.healthStatus = healthy ? "healthy" : "unhealthy";
    } catch {
      m.healthStatus = "unhealthy";
      m.lastHealthCheck = new Date();
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  healthCheckIntervals.set(projectId, interval);
}

function stopPeriodicHealthChecks(projectId: string): void {
  const interval = healthCheckIntervals.get(projectId);
  if (interval) {
    clearInterval(interval);
    healthCheckIntervals.delete(projectId);
  }
}

export function getResourceLimits(plan: string): ProcessResourceLimits {
  return PLAN_RESOURCE_LIMITS[plan] || PLAN_RESOURCE_LIMITS.free;
}

function persistLogs(managed: ManagedProcess): void {
  if (managed.onLogPersist && managed.logBuffer.length > managed.lastFlushedLogIndex) {
    try {
      const newLogs = managed.logBuffer.slice(managed.lastFlushedLogIndex);
      managed.onLogPersist(managed.projectId, newLogs);
      managed.lastFlushedLogIndex = managed.logBuffer.length;
    } catch (err: any) {
      log(`Failed to persist logs for ${managed.projectId}: ${err.message}`, "deploy");
    }
  }
}

const LOG_FLUSH_INTERVAL_MS = 30000;

function startLogFlushTimer(managed: ManagedProcess): void {
  if (managed.logFlushInterval) clearInterval(managed.logFlushInterval);
  managed.logFlushInterval = setInterval(() => {
    persistLogs(managed);
  }, LOG_FLUSH_INTERVAL_MS);
}

function stopLogFlushTimer(managed: ManagedProcess): void {
  if (managed.logFlushInterval) {
    clearInterval(managed.logFlushInterval);
    managed.logFlushInterval = undefined;
  }
}

export async function startProcess(opts: {
  projectId: string;
  deploymentId: string;
  slug: string;
  language: string;
  entryFile: string;
  outputDir: string;
  runCommand?: string;
  buildCommand?: string;
  onLog?: (line: string) => void;
  onLogPersist?: (projectId: string, logs: string[]) => void;
  envVars?: Record<string, string>;
  plan?: string;
  ignorePorts?: boolean;
  autoRestart?: boolean;
  previousVersionDir?: string;
  onStatusChange?: (projectId: string, status: ProcessStatus) => void;
}): Promise<ManagedProcess> {
  const oldManaged = managedProcesses.get(opts.projectId);
  const port = allocatePort();
  const resourceLimits = getResourceLimits(opts.plan || "free");

  const managed: ManagedProcess = {
    process: null,
    projectId: opts.projectId,
    deploymentId: opts.deploymentId,
    slug: opts.slug,
    port,
    language: opts.language,
    entryFile: opts.entryFile,
    outputDir: opts.outputDir,
    runCommand: opts.runCommand,
    buildCommand: opts.buildCommand,
    status: "starting",
    restartCount: 0,
    maxRestarts: MAX_RESTART_ATTEMPTS,
    healthStatus: "unknown",
    logBuffer: [],
    onLog: opts.onLog,
    onLogPersist: opts.onLogPersist,
    onStatusChange: opts.onStatusChange,
    lastFlushedLogIndex: 0,
    startedAt: Date.now(),
    resourceLimits,
    ignorePorts: opts.ignorePorts || false,
    envVars: opts.envVars || {},
    autoRestart: opts.autoRestart !== false,
    previousVersionDir: opts.previousVersionDir,
  };

  addLog(managed, `Starting process on port ${port}...`);
  addLog(managed, `Resource limits: ${resourceLimits.maxMemoryMb}MB RAM (enforced via ulimit), ${resourceLimits.maxCpuPercent}% CPU (enforced via nice)`);

  let portReleased = false;
  try {
    const proc = spawnDeploymentProcess(managed);
    managed.process = proc;
    managed.pid = proc.pid;
    attachProcessHandlers(managed);

    if (!opts.ignorePorts) {
      addLog(managed, "Waiting for process to become healthy...");
      const healthy = await waitForHealthy(port, managed);

      if (managed.status === "crashed") {
        addLog(managed, `Process exited during health check`);
        releasePort(port);
        portReleased = true;
        throw new Error("Process crashed during startup health check");
      } else if (healthy) {
        setStatus(managed, "live");
        managed.healthStatus = "healthy";
        addLog(managed, `Process is live on port ${port}`);
      } else {
        if ((managed.status as ProcessStatus) !== "crashed") {
          setStatus(managed, "crashed");
          managed.healthStatus = "unhealthy";
          addLog(managed, `Process failed health check after ${HEALTH_CHECK_MAX_RETRIES} retries`);
          try { managed.process?.kill("SIGTERM"); } catch {}
          releasePort(port);
          portReleased = true;
          throw new Error("Process failed health check — deployment marked as failed");
        }
      }
    } else {
      setStatus(managed, "live");
      addLog(managed, `Process started (port health check skipped, ignorePorts=true)`);
    }
  } catch (err: any) {
    if (managed.status !== "crashed") {
      setStatus(managed, "crashed");
    }
    if (!portReleased) releasePort(port);
    addLog(managed, `Failed to start process: ${err.message}`);
    persistLogs(managed);
    if (oldManaged) {
      managedProcesses.set(opts.projectId, oldManaged);
      addLog(oldManaged, `Rolling deployment failed, keeping previous version running`);
    }
    throw err;
  }

  if (oldManaged) {
    addLog(managed, `New version healthy — terminating old process (PID: ${oldManaged.pid})`);
    oldManaged.status = "stopped";
    stopPeriodicHealthChecks(opts.projectId);
    if (oldManaged.process) {
      try {
        oldManaged.process.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            try { oldManaged.process?.kill("SIGKILL"); } catch {}
            resolve();
          }, 5000);
          oldManaged.process?.on("exit", () => { clearTimeout(timeout); resolve(); });
        });
      } catch {}
    }
    releasePort(oldManaged.port);
    addLog(managed, `Old process terminated — rolling deployment complete`);
  }

  managedProcesses.set(opts.projectId, managed);
  startPeriodicHealthChecks(opts.projectId);
  startLogFlushTimer(managed);

  return managed;
}

export async function stopProcess(projectId: string): Promise<void> {
  const managed = managedProcesses.get(projectId);
  if (!managed) return;

  setStatus(managed, "stopped");
  if (managed.restartTimeoutId) {
    clearTimeout(managed.restartTimeoutId);
    managed.restartTimeoutId = undefined;
  }
  stopPeriodicHealthChecks(projectId);
  stopLogFlushTimer(managed);

  if (managed.process) {
    try {
      managed.process.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try { managed.process?.kill("SIGKILL"); } catch {}
          resolve();
        }, 5000);
        managed.process?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch {}
  }

  releasePort(managed.port);
  managedProcesses.delete(projectId);
  addLog(managed, "Process stopped");
  persistLogs(managed);
  log(`Stopped managed process for ${projectId}`, "deploy");
}

export async function restartProcess(projectId: string): Promise<ManagedProcess | null> {
  const managed = managedProcesses.get(projectId);
  if (!managed) return null;

  const opts = {
    projectId: managed.projectId,
    deploymentId: managed.deploymentId,
    slug: managed.slug,
    language: managed.language,
    entryFile: managed.entryFile,
    outputDir: managed.outputDir,
    runCommand: managed.runCommand,
    buildCommand: managed.buildCommand,
    onLog: managed.onLog,
    envVars: managed.envVars,
    ignorePorts: managed.ignorePorts,
    autoRestart: managed.autoRestart,
  };

  await stopProcess(projectId);
  return startProcess(opts);
}

export async function rollbackProcess(
  projectId: string,
  previousDeployment: {
    deploymentId: string;
    slug: string;
    language: string;
    entryFile: string;
    outputDir: string;
    runCommand?: string;
    envVars?: Record<string, string>;
    ignorePorts?: boolean;
    autoRestart?: boolean;
    onLog?: (line: string) => void;
  },
): Promise<ManagedProcess> {
  await stopProcess(projectId);

  return startProcess({
    projectId,
    deploymentId: previousDeployment.deploymentId,
    slug: previousDeployment.slug,
    language: previousDeployment.language,
    entryFile: previousDeployment.entryFile,
    outputDir: previousDeployment.outputDir,
    runCommand: previousDeployment.runCommand,
    onLog: previousDeployment.onLog,
    envVars: previousDeployment.envVars,
    ignorePorts: previousDeployment.ignorePorts,
    autoRestart: previousDeployment.autoRestart,
  });
}

export async function performHealthCheck(projectId: string): Promise<{
  status: string;
  healthy: boolean;
  lastCheck: Date | null;
  port: number | null;
  processStatus: string | null;
  restartCount: number;
  uptime: number;
  pid: number | undefined;
}> {
  const managed = managedProcesses.get(projectId);
  if (!managed) {
    return { status: "no_process", healthy: false, lastCheck: null, port: null, processStatus: null, restartCount: 0, uptime: 0, pid: undefined };
  }

  if (managed.ignorePorts) {
    managed.lastHealthCheck = new Date();
    return {
      status: "healthy",
      healthy: true,
      lastCheck: managed.lastHealthCheck,
      port: managed.port,
      processStatus: managed.status,
      restartCount: managed.restartCount,
      uptime: Date.now() - managed.startedAt,
      pid: managed.pid,
    };
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
    uptime: Date.now() - managed.startedAt,
    pid: managed.pid,
  };
}

export function getProcessLogs(projectId: string): string[] {
  const managed = managedProcesses.get(projectId);
  return managed?.logBuffer || [];
}

export function getProcessInfo(projectId: string): ProcessInfo | null {
  const managed = managedProcesses.get(projectId);
  if (!managed) return null;
  return {
    projectId: managed.projectId,
    deploymentId: managed.deploymentId,
    slug: managed.slug,
    port: managed.port,
    status: managed.status,
    healthStatus: managed.healthStatus,
    lastHealthCheck: managed.lastHealthCheck,
    restartCount: managed.restartCount,
    pid: managed.pid,
    uptime: Date.now() - managed.startedAt,
    resourceLimits: managed.resourceLimits,
    startedAt: managed.startedAt,
    resourceUsage: getProcessResourceUsage(managed.pid),
  };
}

export function getProcessStatus(projectId: string): {
  status: string;
  port: number;
  healthStatus: string;
  lastHealthCheck: Date | undefined;
  restartCount: number;
  pid: number | undefined;
  uptime: number;
  resourceLimits: ProcessResourceLimits;
} | null {
  const managed = managedProcesses.get(projectId);
  if (!managed) return null;
  return {
    status: managed.status,
    port: managed.port,
    healthStatus: managed.healthStatus,
    lastHealthCheck: managed.lastHealthCheck,
    restartCount: managed.restartCount,
    pid: managed.pid,
    uptime: Date.now() - managed.startedAt,
    resourceLimits: managed.resourceLimits,
  };
}

export function getManagedProcess(projectId: string): ManagedProcess | undefined {
  return managedProcesses.get(projectId);
}

export function getAllManagedProcesses(): Map<string, ManagedProcess> {
  return managedProcesses;
}

export function setProcessLogCallback(projectId: string, onLog: (line: string) => void): void {
  const managed = managedProcesses.get(projectId);
  if (managed) {
    managed.onLog = onLog;
  }
}

export async function shutdownAllProcesses(): Promise<void> {
  log(`Shutting down ${managedProcesses.size} managed deployment processes...`, "deploy");
  const promises: Promise<void>[] = [];
  managedProcesses.forEach((_, projectId) => {
    promises.push(stopProcess(projectId));
  });
  await Promise.allSettled(promises);
  log("All managed deployment processes shut down", "deploy");
}

export async function cleanupProjectProcesses(projectId: string): Promise<void> {
  await stopProcess(projectId);
}

export function getPortForProject(projectId: string): number | null {
  const managed = managedProcesses.get(projectId);
  return managed?.port || null;
}
