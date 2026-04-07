import { execSync, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { Router } from "express";

export type DeploymentType = "static" | "node" | "fullstack";

interface DeploymentResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  error?: string;
  type?: DeploymentType;
}

const managedProcesses = new Map<string, { pid?: number; status: string; startedAt: Date; logs: string[]; process?: ChildProcess }>();
const deployments = new Map<string, any>();
let processLogCallback: ((projectId: string, log: string) => void) | null = null;

export function setProcessLogCallback(cb: (projectId: string, log: string) => void): void {
  processLogCallback = cb;
}

export function getAllManagedProcesses() {
  return managedProcesses;
}

export async function buildAndDeploy(
  projectId: string,
  projectDir: string,
  options?: { type?: DeploymentType; port?: number; env?: Record<string, string> }
): Promise<DeploymentResult> {
  const type = options?.type || detectProjectType(projectDir);
  const deploymentId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    deployments.set(projectId, { id: deploymentId, projectId, type, status: "deployed", deployedAt: new Date() });
    return { success: true, url: `/api/preview/render/${projectId}`, deploymentId, type };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function buildAndDeployMultiArtifact(
  projectId: string,
  projectDir: string,
  artifacts: Array<{ name: string; path: string; type: DeploymentType }>
): Promise<DeploymentResult> {
  return buildAndDeploy(projectId, projectDir);
}

export function createDeploymentRouter() {
  return Router();
}

export async function rollbackDeployment(projectId: string, versionId: string): Promise<DeploymentResult> {
  return { success: true, deploymentId: versionId };
}

export function listDeploymentVersions(projectId: string): any[] {
  const dep = deployments.get(projectId);
  return dep ? [dep] : [];
}

export async function teardownDeployment(projectId: string): Promise<{ success: boolean }> {
  const p = managedProcesses.get(projectId);
  if (p?.process) p.process.kill();
  managedProcesses.delete(projectId);
  deployments.delete(projectId);
  return { success: true };
}

export async function performHealthCheck(projectId: string): Promise<{ healthy: boolean; status: string }> {
  const proc = managedProcesses.get(projectId);
  if (!proc) return { healthy: false, status: "not_running" };
  return { healthy: true, status: proc.status };
}

export function getProcessLogs(projectId: string): string[] {
  return managedProcesses.get(projectId)?.logs || [];
}

export function getProcessStatus(projectId: string): { running: boolean; pid?: number; uptime?: number } {
  const p = managedProcesses.get(projectId);
  if (!p) return { running: false };
  return { running: true, pid: p.pid, uptime: Date.now() - p.startedAt.getTime() };
}

export function stopManagedProcess(projectId: string): boolean {
  const p = managedProcesses.get(projectId);
  if (!p) return false;
  if (p.process) p.process.kill();
  managedProcesses.delete(projectId);
  return true;
}

export function restartManagedProcess(projectId: string): boolean {
  return stopManagedProcess(projectId);
}

export async function shutdownAllProcesses(): Promise<void> {
  for (const [projectId, proc] of managedProcesses.entries()) {
    try {
      if (proc.process) proc.process.kill();
      else if (proc.pid) process.kill(proc.pid, "SIGTERM");
      managedProcesses.delete(projectId);
    } catch {}
  }
}

export function cleanupProjectProcesses(projectId: string): void {
  stopManagedProcess(projectId);
}

function detectProjectType(projectDir: string): DeploymentType {
  try {
    if (fs.existsSync(path.join(projectDir, "package.json"))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
      if (pkg.scripts?.start || pkg.scripts?.dev) return "node";
    }
  } catch {}
  return "static";
}
