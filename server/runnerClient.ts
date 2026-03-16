import jwt from "jsonwebtoken";

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || "https://runner.e-code.ai";
const RUNNER_JWT_SECRET = process.env.RUNNER_JWT_SECRET || "";
const TOKEN_TTL_MIN = parseInt(process.env.WORKSPACE_TOKEN_TTL_MIN || "15", 10);

function signToken(payload: { workspaceId: string; userId: string }): string {
  if (!RUNNER_JWT_SECRET) {
    throw new Error("RUNNER_JWT_SECRET is not configured");
  }
  return jwt.sign(payload, RUNNER_JWT_SECRET, { expiresIn: `${TOKEN_TTL_MIN}m` });
}

async function runnerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${RUNNER_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (RUNNER_JWT_SECRET) {
    headers["Authorization"] = `Bearer ${signToken({ workspaceId: "system", userId: "system" })}`;
  }
  return fetch(url, { ...options, headers, signal: AbortSignal.timeout(5000) });
}

export async function ping(): Promise<boolean> {
  try {
    const res = await runnerFetch("/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function createWorkspace(workspaceId: string, language: string): Promise<any> {
  const res = await runnerFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ workspaceId, language }),
  });
  if (!res.ok) throw new Error(`Runner: create workspace failed (${res.status})`);
  return res.json();
}

export async function startWorkspace(workspaceId: string): Promise<any> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Runner: start failed (${res.status})`);
  return res.json();
}

export async function stopWorkspace(workspaceId: string): Promise<any> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`Runner: stop failed (${res.status})`);
  return res.json();
}

export async function getWorkspaceStatus(workspaceId: string): Promise<string> {
  try {
    const res = await runnerFetch(`/api/workspaces/${workspaceId}/status`);
    if (!res.ok) return "error";
    const data = await res.json();
    return data.status || "unknown";
  } catch {
    return "offline";
  }
}

export async function fsList(workspaceId: string, path: string = "/"): Promise<any[]> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Runner: fs list failed (${res.status})`);
  return res.json();
}

export async function fsRead(workspaceId: string, path: string): Promise<string> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Runner: fs read failed (${res.status})`);
  const data = await res.json();
  return data.content;
}

export async function fsWrite(workspaceId: string, path: string, content: string): Promise<void> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs/write`, {
    method: "POST",
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Runner: fs write failed (${res.status})`);
}

export async function fsMkdir(workspaceId: string, path: string): Promise<void> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs/mkdir`, {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Runner: fs mkdir failed (${res.status})`);
}

export async function fsRm(workspaceId: string, path: string): Promise<void> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs/rm`, {
    method: "DELETE",
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Runner: fs rm failed (${res.status})`);
}

export async function fsRename(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
  const res = await runnerFetch(`/api/workspaces/${workspaceId}/fs/rename`, {
    method: "POST",
    body: JSON.stringify({ oldPath, newPath }),
  });
  if (!res.ok) throw new Error(`Runner: fs rename failed (${res.status})`);
}

export function terminalWsUrl(workspaceId: string, token: string): string {
  const base = RUNNER_BASE_URL.replace(/^http/, "ws");
  return `${base}/ws/terminal/${workspaceId}?token=${encodeURIComponent(token)}`;
}

export function previewUrl(workspaceId: string, port: number = 3000): string {
  return `${RUNNER_BASE_URL}/preview/${workspaceId}/${port}`;
}

export function generateToken(workspaceId: string, userId: string): string {
  return signToken({ workspaceId, userId });
}

export function getBaseUrl(): string {
  return RUNNER_BASE_URL;
}

export async function fetchPreviewContent(workspaceId: string, port: number, subpath: string = "/"): Promise<{ status: number; headers: Record<string, string>; body: Buffer; contentType: string }> {
  const url = `${RUNNER_BASE_URL}/preview/${workspaceId}/${port}${subpath}`;
  const headers: Record<string, string> = {};
  if (RUNNER_JWT_SECRET) {
    headers["Authorization"] = `Bearer ${signToken({ workspaceId, userId: "system" })}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  const contentType = res.headers.get("content-type") || "text/html";
  const buf = Buffer.from(await res.arrayBuffer());
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (!["transfer-encoding", "content-encoding", "connection"].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });
  return { status: res.status, headers: responseHeaders, body: buf, contentType };
}

export async function execInWorkspace(workspaceId: string, command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string } | null> {
  try {
    const res = await runnerFetch(`/api/workspaces/${workspaceId}/exec`, {
      method: "POST",
      body: JSON.stringify({ command, args }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
