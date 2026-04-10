import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import fs from 'fs';

const MAX_MEMORY_MB = parseInt(process.env.PROJECT_MAX_MEMORY_MB || '512');
const MAX_CPU_SECONDS = parseInt(process.env.PROJECT_MAX_CPU_SECONDS || '300');
const BLOCKED_PATHS = ['/etc/passwd', '/etc/shadow', '/proc', '/sys'];

export function createSandboxedSpawn(workspacePath: string) {
  return (command: string, args: string[], opts?: SpawnOptions) => {
    const env = {
      ...process.env,
      ...opts?.env,
      HOME: workspacePath,
      TMPDIR: path.join(workspacePath, '.tmp'),
      NODE_OPTIONS: `--max-old-space-size=${MAX_MEMORY_MB}`,
    };

    // Ensure temp dir exists
    const tmpDir = path.join(workspacePath, '.tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    return spawn(command, args, {
      ...opts,
      cwd: workspacePath,
      env,
      stdio: opts?.stdio || ['pipe', 'pipe', 'pipe'],
    });
  };
}

export function validatePath(requestedPath: string, workspacePath: string): boolean {
  const resolved = path.resolve(workspacePath, requestedPath);
  if (!resolved.startsWith(workspacePath)) return false;
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
