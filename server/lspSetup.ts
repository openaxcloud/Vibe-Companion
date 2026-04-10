import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface LspServer {
  process: ChildProcess;
  language: string;
  projectPath: string;
}

const activeServers = new Map<string, LspServer>();

export function startLspServer(language: string, projectPath: string): ChildProcess | null {
  const key = `${language}:${projectPath}`;
  if (activeServers.has(key)) {
    return activeServers.get(key)!.process;
  }

  const command = getLspCommand(language);
  if (!command) return null;

  const proc = spawn(command.bin, command.args, {
    cwd: projectPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  activeServers.set(key, { process: proc, language, projectPath });

  proc.on('exit', () => {
    activeServers.delete(key);
  });

  return proc;
}

export function stopLspServer(language: string, projectPath: string): void {
  const key = `${language}:${projectPath}`;
  const server = activeServers.get(key);
  if (server) {
    server.process.kill();
    activeServers.delete(key);
  }
}

export function stopAllLspServers(projectPath: string): void {
  for (const [key, server] of activeServers.entries()) {
    if (server.projectPath === projectPath) {
      server.process.kill();
      activeServers.delete(key);
    }
  }
}

function getLspCommand(language: string): { bin: string; args: string[] } | null {
  const commands: Record<string, { bin: string; args: string[] }> = {
    typescript: { bin: 'typescript-language-server', args: ['--stdio'] },
    javascript: { bin: 'typescript-language-server', args: ['--stdio'] },
    python: { bin: 'pylsp', args: [] },
    rust: { bin: 'rust-analyzer', args: [] },
    go: { bin: 'gopls', args: [] },
  };
  return commands[language] ?? null;
}

export function getActiveLspServers(): string[] {
  return Array.from(activeServers.keys());
}
