const RUNNER_BASE_URL = process.env.RUNNER_URL || "http://localhost:9090";

export async function ping(): Promise<boolean> {
  return false;
}

export function getBaseUrl(): string {
  return RUNNER_BASE_URL;
}

export async function startProject(projectId: string, command?: string): Promise<{ success: boolean; pid?: number }> {
  return { success: true };
}

export async function stopProject(projectId: string): Promise<{ success: boolean }> {
  return { success: true };
}

export async function getProjectStatus(projectId: string): Promise<{ running: boolean; pid?: number }> {
  return { running: false };
}

export async function installPackage(projectId: string, packageName: string): Promise<{ success: boolean; output: string }> {
  return { success: true, output: `Package ${packageName} installed` };
}

export async function uninstallPackage(projectId: string, packageName: string): Promise<{ success: boolean; output: string }> {
  return { success: true, output: `Package ${packageName} removed` };
}

export async function createWorkspace(workspaceId: string, language: string): Promise<void> {
}

export function generateToken(workspaceId: string, userId: string): string | null {
  return null;
}

export async function startWorkspace(workspaceId: string): Promise<void> {
}

export async function stopWorkspace(workspaceId: string): Promise<void> {
}

export async function configureWorkspaceEnv(workspaceId: string, env: Record<string, string>): Promise<void> {
}

export async function getWorkspaceStatus(workspaceId: string): Promise<{ running: boolean; status: string }> {
  return { running: false, status: "stopped" };
}

export async function execInWorkspace(workspaceId: string, command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return { stdout: "", stderr: "Runner not available", exitCode: 1 };
}

export async function execLocal(dir: string, command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { execSync } = await import("child_process");
  try {
    const result = execSync(`${command} ${(args || []).join(" ")}`, { cwd: dir, timeout: 30000, encoding: "utf-8" });
    return { stdout: result, stderr: "", exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout || "", stderr: e.stderr || e.message, exitCode: e.status || 1 };
  }
}

export async function fsList(workspaceId: string, path: string): Promise<{ name: string; type: string }[]> {
  return [];
}

export async function fsRead(workspaceId: string, path: string): Promise<string> {
  return "";
}

export async function fsWrite(workspaceId: string, path: string, content: string): Promise<void> {
}

export async function fsMkdir(workspaceId: string, path: string): Promise<void> {
}

export async function fsRm(workspaceId: string, path: string): Promise<void> {
}

export async function fsRename(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
}

export function previewUrl(workspaceId: string, port?: number): string {
  return `${RUNNER_BASE_URL}/workspace/${workspaceId}/preview${port ? `?port=${port}` : ""}`;
}

export async function fetchPreviewContent(workspaceId: string, port: number, subpath?: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return { status: 503, headers: { "content-type": "text/html" }, body: "<h1>Preview not available</h1><p>Runner is offline.</p>" };
}
