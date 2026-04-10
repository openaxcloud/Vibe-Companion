import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

const MAX_MEMORY_MB = parseInt(process.env.PROJECT_MAX_MEMORY_MB || '512');
const MAX_CPU_SECONDS = parseInt(process.env.PROJECT_MAX_CPU_SECONDS || '300');
const BLOCKED_PATHS = ['/etc/passwd', '/etc/shadow', '/proc', '/sys'];

// Secrets that must never be forwarded to child processes
const SECRET_ENV_KEYS = [
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'XAI_API_KEY', 'MOONSHOT_API_KEY', 'GROQ_API_KEY',
  'DATABASE_URL', 'SESSION_SECRET', 'REPLIT_DB_URL',
  'STRIPE_SECRET_KEY', 'SENDGRID_API_KEY',
];

/**
 * Create per-project isolated temp directory with restrictive permissions (700).
 * Returns the tmp dir path.
 */
export function ensureProjectTmpDir(workspacePath: string): string {
  const tmpDir = path.join(workspacePath, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  } else {
    try { fs.chmodSync(tmpDir, 0o700); } catch { /* best-effort */ }
  }
  return tmpDir;
}

export function createSandboxedSpawn(workspacePath: string) {
  return (command: string, args: string[], opts?: SpawnOptions): ChildProcess => {
    const tmpDir = ensureProjectTmpDir(workspacePath);

    // Build env: inherit process env, apply overrides, strip secrets
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...process.env, ...opts?.env })) {
      if (v !== undefined && !SECRET_ENV_KEYS.includes(k)) {
        env[k] = v as string;
      }
    }

    // Force workspace-scoped dirs and memory cap
    env['HOME'] = workspacePath;
    env['TMPDIR'] = tmpDir;
    env['TEMP'] = tmpDir;
    env['TMP'] = tmpDir;
    env['NODE_OPTIONS'] = `--max-old-space-size=${MAX_MEMORY_MB}`;

    // detached: true puts the child in its own process group so we can
    // kill the entire tree (child + grandchildren) with process.kill(-pgid)
    const child = spawn(command, args, {
      ...opts,
      cwd: workspacePath,
      env,
      stdio: opts?.stdio || ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    // Enforce wall-clock CPU timeout by killing the whole process group
    const timeout = setTimeout(() => {
      if (child.pid != null) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
      }
    }, MAX_CPU_SECONDS * 1000);
    timeout.unref(); // don't keep Node alive just for the timeout

    child.once('exit', () => clearTimeout(timeout));

    return child;
  };
}

export function validatePath(requestedPath: string, workspacePath: string): boolean {
  const resolved = path.resolve(workspacePath, requestedPath);
  // Must stay inside workspace
  if (!resolved.startsWith(path.resolve(workspacePath) + path.sep) &&
      resolved !== path.resolve(workspacePath)) {
    return false;
  }
  if (BLOCKED_PATHS.some(bp => resolved.startsWith(bp))) return false;
  return true;
}

export function getResourceUsage(pid: number): { memoryMB: number; cpuPercent: number } | null {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`ps -p ${pid} -o rss=,pcpu=`, { encoding: 'utf8' }).trim();
    const [rss, cpu] = result.split(/\s+/);
    return { memoryMB: parseInt(rss) / 1024, cpuPercent: parseFloat(cpu) };
  } catch { return null; }
}

/**
 * Kill an entire process group spawned with detached: true.
 * Safe to call even if the process has already exited.
 */
export function killProcessGroup(pid: number): void {
  try { process.kill(-pid, 'SIGKILL'); } catch { /* already dead */ }
}
