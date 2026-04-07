/**
 * Secure Docker Executor for sandboxed code execution
 * Replaces simple-executor.ts with proper container isolation
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type Docker from 'dockerode';
import { File } from '@shared/schema';
import { storage } from './storage';
import { withTempDir } from './utils/temp-cleanup';
import { resourceMonitor } from './services/resource-monitor';
import { createLogger } from './utils/logger';

const logger = createLogger('docker-executor');

// Lazy-load dockerode to avoid crashes in production where it may not be available
let dockerInstance: InstanceType<typeof import('dockerode')> | null = null;

async function getDocker(): Promise<InstanceType<typeof import('dockerode')>> {
  if (!dockerInstance) {
    try {
      const Docker = (await import('dockerode')).default;
      dockerInstance = new Docker();
    } catch (error) {
      throw new Error('dockerode is not available in this environment');
    }
  }
  return dockerInstance;
}

interface ContainerConfig {
  image: string;
  command: string[];
  workdir: string;
  networkMode: 'none' | 'bridge';
  readOnlyRootfs: boolean;
}

interface ActiveContainer {
  containerId: string;
  process: ChildProcess | null;
  logs: string[];
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
  port?: number;
  startTime: number;
}

const DOCKER_IMAGES: Record<string, string> = {
  javascript: 'node:20-alpine',
  js: 'node:20-alpine',
  node: 'node:20-alpine',
  nodejs: 'node:20-alpine',
  python: 'python:3.11-alpine',
  py: 'python:3.11-alpine',
};

const SECURITY_DEFAULTS = {
  memory: '256m',
  cpus: '0.5',
  pidsLimit: 100,
  user: '1000:1000',
  timeout: 30000,
  networkMode: 'none' as const,
};

const activeContainers = new Map<number, ActiveContainer>();
const availablePorts: number[] = [];
for (let port = 3000; port <= 4000; port++) {
  availablePorts.push(port);
}
const portsInUse = new Set<number>();

let dockerAvailable: boolean | null = null;

/**
 * Execute container with timeout enforcement
 * Kills and removes container if it exceeds the specified timeout
 */
async function executeWithTimeout(container: Docker.Container, timeout: number): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(async () => {
      try {
        await container.kill();
        await container.remove({ force: true });
      } catch (e) {
        console.error('Failed to kill timed-out container:', e);
      }
      reject(new Error(`Container execution timeout after ${timeout}ms`));
    }, timeout);
  });

  try {
    await Promise.race([
      container.wait(),
      timeoutPromise
    ]);
  } finally {
    // Ensure cleanup
    try {
      await container.remove({ force: true });
    } catch {
      // Container might already be removed
    }
  }
}

/**
 * Check if Docker is available on the system
 */
export async function checkDockerAvailability(): Promise<{ available: boolean; message: string }> {
  if (dockerAvailable !== null) {
    return {
      available: dockerAvailable,
      message: dockerAvailable ? 'Docker is available' : 'Docker is not available',
    };
  }

  try {
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker info', { stdio: 'pipe' });
    dockerAvailable = true;
    logger.info('Docker is available and running');
    return { available: true, message: 'Docker is available and running' };
  } catch (error) {
    dockerAvailable = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Docker is not available', errorMessage);
    return {
      available: false,
      message: `Docker is not available. Please ensure Docker is installed and the Docker daemon is running. Error: ${errorMessage}`,
    };
  }
}

function getNextAvailablePort(): number | null {
  for (const port of availablePorts) {
    if (!portsInUse.has(port)) {
      portsInUse.add(port);
      return port;
    }
  }
  return null;
}

function releasePort(port: number): void {
  portsInUse.delete(port);
}

/**
 * Sanitize container name to prevent injection
 */
function sanitizeContainerName(projectId: number): string {
  return `project-${projectId}-${Date.now()}`.replace(/[^a-zA-Z0-9_.-]/g, '');
}

/**
 * Write project files to temporary directory for mounting
 */
async function writeProjectFiles(projectId: number, files: File[]): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp', `docker-project-${projectId}`);

  await fs.promises.rm(tempDir, { recursive: true, force: true });
  await fs.promises.mkdir(tempDir, { recursive: true });

  for (const file of files) {
    const filePath = path.join(tempDir, file.name);
    const fileDir = path.dirname(filePath);

    await fs.promises.mkdir(fileDir, { recursive: true });
    await fs.promises.writeFile(filePath, file.content || '');
  }

  await fs.promises.chmod(tempDir, 0o755);

  return tempDir;
}

/**
 * Get Docker configuration based on project language
 */
function getDockerConfig(
  files: File[],
  language: string
): { config: ContainerConfig; isWebProject: boolean } {
  const image = DOCKER_IMAGES[language.toLowerCase()] || DOCKER_IMAGES.javascript;

  const packageJson = files.find((f) => f.name === 'package.json');
  const hasIndexHtml = files.some((f) => f.name === 'index.html');
  const hasServerJs = files.some((f) => f.name === 'server.js');
  const hasIndexJs = files.some((f) => f.name === 'index.js');
  const hasAppPy = files.some((f) => f.name === 'app.py');
  const hasMainPy = files.some((f) => f.name === 'main.py');

  let command: string[];
  let isWebProject = false;
  let networkMode: 'none' | 'bridge' = 'none';

  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content || '{}');
      if (pkg.scripts?.dev) {
        command = ['npm', 'run', 'dev'];
        isWebProject = true;
        networkMode = 'bridge';
      } else if (pkg.scripts?.start) {
        command = ['npm', 'start'];
        isWebProject = true;
        networkMode = 'bridge';
      } else {
        command = ['node', 'index.js'];
      }
    } catch {
      // Expected: package.json may be malformed - use safe fallback
      command = ['node', 'index.js'];
    }
  } else if (hasIndexHtml) {
    command = ['cat', 'index.html'];
    isWebProject = true;
  } else if (hasServerJs) {
    command = ['node', 'server.js'];
    isWebProject = true;
    networkMode = 'bridge';
  } else if (hasIndexJs) {
    command = ['node', 'index.js'];
  } else if (hasAppPy) {
    command = ['python', 'app.py'];
    isWebProject = true;
    networkMode = 'bridge';
  } else if (hasMainPy) {
    command = ['python', 'main.py'];
  } else if (language.toLowerCase().includes('python')) {
    command = ['python', 'main.py'];
  } else {
    command = ['node', 'index.js'];
  }

  return {
    config: {
      image,
      command,
      workdir: '/app',
      networkMode,
      readOnlyRootfs: !isWebProject,
    },
    isWebProject,
  };
}

/**
 * Build Docker run arguments with security constraints
 */
function buildDockerArgs(
  containerName: string,
  projectDir: string,
  config: ContainerConfig,
  port?: number,
  options: {
    networkEnabled?: boolean;
    readOnlyOverride?: boolean;
  } = {}
): string[] {
  const args: string[] = [
    'run',
    '--rm',
    '--name',
    containerName,
    '--user',
    SECURITY_DEFAULTS.user,
    '--memory',
    SECURITY_DEFAULTS.memory,
    '--cpus',
    SECURITY_DEFAULTS.cpus,
    '--pids-limit',
    String(SECURITY_DEFAULTS.pidsLimit),
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--ulimit',
    'nofile=1024:1024',
    '-v',
    `${projectDir}:/app:ro`,
    '-w',
    config.workdir,
  ];

  const shouldUseNetwork = options.networkEnabled ?? config.networkMode === 'bridge';
  if (!shouldUseNetwork) {
    args.push('--network', 'none');
  } else if (port) {
    args.push('-p', `${port}:${port}`);
    args.push('-e', `PORT=${port}`);
  }

  const shouldBeReadOnly = options.readOnlyOverride ?? config.readOnlyRootfs;
  if (shouldBeReadOnly) {
    args.push('--read-only');
    args.push('--tmpfs', '/tmp:rw,noexec,nosuid,size=64m');
  }

  args.push('-e', 'NODE_ENV=production');
  args.push('-e', 'HOME=/tmp');

  args.push(config.image);
  args.push(...config.command);

  return args;
}

/**
 * Kill container after timeout
 */
function scheduleContainerKill(
  containerName: string,
  projectId: number,
  timeout: number = SECURITY_DEFAULTS.timeout
): NodeJS.Timeout {
  return setTimeout(async () => {
    logger.warn(`Container ${containerName} exceeded timeout, killing...`);
    try {
      const killProcess = spawn('docker', ['kill', containerName], { shell: false });
      killProcess.on('error', (err) => {
        logger.error(`Failed to kill container ${containerName}`, err.message);
      });
    } catch (error) {
      logger.error(`Error killing container ${containerName}`, error);
    }

    const container = activeContainers.get(projectId);
    if (container) {
      container.status = 'error';
      container.logs.push('ERROR: Execution timeout - container killed');
    }
  }, timeout);
}

/**
 * Start a project in a Docker container
 */
export async function startProject(
  projectId: number,
  userId?: number
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const dockerCheck = await checkDockerAvailability();
  if (!dockerCheck.available) {
    return {
      success: false,
      error: dockerCheck.message,
    };
  }

  try {
    if (activeContainers.has(projectId)) {
      const existing = activeContainers.get(projectId)!;
      if (existing.status === 'running') {
        return {
          success: true,
          url: existing.url,
        };
      }
      await stopProject(projectId);
    }

    let files = await storage.getFilesByProject(String(projectId));

    if (!files.length) {
      const project = await storage.getProject(String(projectId));
      const language = project?.language || 'javascript';

      const defaultContent =
        language === 'python'
          ? 'print("Hello, World!")\n'
          : '// Welcome to your new project!\nconsole.log("Hello, World!");\n';

      const defaultFile = language === 'python' ? 'main.py' : 'index.js';

      await storage.createFile({
        projectId: String(projectId),
        path: defaultFile,
        content: defaultContent,
      });

      files = await storage.getFilesByProject(String(projectId));

      if (!files.length) {
        return {
          success: false,
          error: 'Failed to create default project files',
        };
      }
    }

    if (!userId) {
      const project = await storage.getProject(String(projectId));
      userId = project?.ownerId;
    }

    if (userId) {
      await resourceMonitor.startProjectMonitoring(projectId, userId);
    }

    const project = await storage.getProject(String(projectId));
    const language = project?.language || 'javascript';

    const projectDir = await writeProjectFiles(projectId, files);
    const { config, isWebProject } = getDockerConfig(files, language);

    if (config.command[0] === 'cat' && config.command[1] === 'index.html') {
      activeContainers.set(projectId, {
        containerId: '',
        process: null,
        logs: ['Static HTML project ready'],
        status: 'running',
        url: `/preview/${projectId}/index.html`,
        startTime: Date.now(),
      });

      return {
        success: true,
        url: `/preview/${projectId}/index.html`,
      };
    }

    let port: number | undefined;
    if (isWebProject) {
      port = getNextAvailablePort() ?? undefined;
      if (!port) {
        return {
          success: false,
          error: 'No available ports',
        };
      }
    }

    const containerName = sanitizeContainerName(projectId);
    const dockerArgs = buildDockerArgs(containerName, projectDir, config, port, {
      networkEnabled: isWebProject,
      readOnlyOverride: false,
    });

    logger.info(`Starting container for project ${projectId}`, { containerName, image: config.image });

    const dockerProcess = spawn('docker', dockerArgs, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const containerData: ActiveContainer = {
      containerId: containerName,
      process: dockerProcess,
      logs: [],
      status: 'starting',
      port,
      url: isWebProject && port ? `http://localhost:${port}` : undefined,
      startTime: Date.now(),
    };

    const timeoutHandle = scheduleContainerKill(containerName, projectId, SECURITY_DEFAULTS.timeout);

    dockerProcess.stdout?.on('data', (data: Buffer) => {
      const log = data.toString();
      containerData.logs.push(log);
      logger.debug(`[Project ${projectId}] stdout:`, log.trim());
    });

    dockerProcess.stderr?.on('data', (data: Buffer) => {
      const log = data.toString();
      containerData.logs.push(`STDERR: ${log}`);
      logger.debug(`[Project ${projectId}] stderr:`, log.trim());
    });

    dockerProcess.on('exit', async (code: number | null) => {
      clearTimeout(timeoutHandle);
      containerData.status = code === 0 ? 'stopped' : 'error';
      if (port) releasePort(port);
      await resourceMonitor.stopProjectMonitoring(projectId);
      logger.info(`Container for project ${projectId} exited with code ${code}`);
    });

    dockerProcess.on('error', async (error: Error) => {
      clearTimeout(timeoutHandle);
      logger.error(`Container error for project ${projectId}:`, error.message);
      containerData.status = 'error';
      containerData.logs.push(`Error: ${error.message}`);
      if (port) releasePort(port);
    });

    setTimeout(() => {
      if (containerData.status === 'starting') {
        containerData.status = 'running';
      }
    }, 2000);

    activeContainers.set(projectId, containerData);

    return {
      success: true,
      url: containerData.url,
    };
  } catch (error) {
    logger.error('Error starting project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stop a project container
 */
export async function stopProject(
  projectId: number
): Promise<{ success: boolean; error?: string }> {
  const container = activeContainers.get(projectId);
  if (!container) {
    return {
      success: false,
      error: 'Project not running',
    };
  }

  try {
    if (container.containerId) {
      const killProcess = spawn('docker', ['kill', container.containerId], { shell: false });

      await new Promise<void>((resolve) => {
        killProcess.on('exit', () => resolve());
        killProcess.on('error', () => resolve());
        setTimeout(resolve, 5000);
      });
    }

    if (container.process) {
      container.process.kill('SIGKILL');
    }

    if (container.port) {
      releasePort(container.port);
    }

    activeContainers.delete(projectId);
    await resourceMonitor.stopProjectMonitoring(projectId);

    logger.info(`Stopped container for project ${projectId}`);

    return { success: true };
  } catch (error) {
    logger.error(`Error stopping project ${projectId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get project container status
 */
export function getProjectStatus(projectId: number): {
  isRunning: boolean;
  status: 'starting' | 'running' | 'stopped' | 'error';
  logs: string[];
  url?: string;
  port?: number;
  containerId?: string;
} {
  const container = activeContainers.get(projectId);
  if (!container) {
    return {
      isRunning: false,
      status: 'stopped',
      logs: [],
    };
  }

  return {
    isRunning: container.status === 'running',
    status: container.status,
    logs: container.logs,
    url: container.url,
    port: container.port,
    containerId: container.containerId,
  };
}

/**
 * Get project logs
 */
export function getProjectLogs(projectId: number): string[] {
  const container = activeContainers.get(projectId);
  return container?.logs || [];
}

/**
 * DockerExecutor class for sandboxed code execution (for auto-grading, etc.)
 */
export class DockerExecutor {
  private timeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout || SECURITY_DEFAULTS.timeout;
  }

  async executeCode(
    code: string,
    language: string,
    testInput?: string
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: number;
  }> {
    const startTime = Date.now();

    const dockerCheck = await checkDockerAvailability();
    if (!dockerCheck.available) {
      return {
        success: false,
        error: dockerCheck.message,
        executionTime: Date.now() - startTime,
      };
    }

    const image = DOCKER_IMAGES[language.toLowerCase()];
    if (!image) {
      return {
        success: false,
        error: `Unsupported language: ${language}. Supported: javascript, python`,
        executionTime: Date.now() - startTime,
      };
    }

    let fileName: string;
    let command: string[];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'node':
      case 'nodejs':
        fileName = 'code.js';
        command = ['node', 'code.js'];
        break;
      case 'python':
      case 'py':
        fileName = 'code.py';
        command = ['python', 'code.py'];
        break;
      default:
        return {
          success: false,
          error: `Unsupported language: ${language}`,
          executionTime: Date.now() - startTime,
        };
    }

    return withTempDir(async (tempDir) => {
      await fs.promises.writeFile(path.join(tempDir, fileName), code);
      await fs.promises.chmod(tempDir, 0o755);

      const containerName = `grading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const dockerArgs: string[] = [
        'run',
        '--rm',
        '--name',
        containerName,
        '--user',
        SECURITY_DEFAULTS.user,
        '--memory',
        SECURITY_DEFAULTS.memory,
        '--cpus',
        SECURITY_DEFAULTS.cpus,
        '--pids-limit',
        String(SECURITY_DEFAULTS.pidsLimit),
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges:true',
        '--network',
        'none',
        '--read-only',
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=32m',
        '-v',
        `${tempDir}:/app:ro`,
        '-w',
        '/app',
        '-e',
        'HOME=/tmp',
        '-i',
        image,
        ...command,
      ];

      return await new Promise<{
        success: boolean;
        output?: string;
        error?: string;
        executionTime?: number;
      }>((resolve) => {
        const dockerProcess = spawn('docker', dockerArgs, {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let output = '';
        let errorOutput = '';
        let killed = false;

        const timeoutHandle = setTimeout(() => {
          killed = true;
          try {
            spawn('docker', ['kill', containerName], { shell: false });
          } catch (e) {
            // Expected: container may already be stopped or not exist
          }
          dockerProcess.kill('SIGKILL');
        }, this.timeout);

        if (testInput && dockerProcess.stdin) {
          dockerProcess.stdin.write(testInput);
          dockerProcess.stdin.end();
        } else if (dockerProcess.stdin) {
          dockerProcess.stdin.end();
        }

        dockerProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        dockerProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        dockerProcess.on('exit', (exitCode: number | null) => {
          clearTimeout(timeoutHandle);
          const executionTime = Date.now() - startTime;

          if (killed) {
            resolve({
              success: false,
              error: 'Execution timeout',
              executionTime,
            });
          } else if (exitCode === 0) {
            resolve({
              success: true,
              output: output.trim(),
              executionTime,
            });
          } else {
            resolve({
              success: false,
              error: errorOutput.trim() || `Process exited with code ${exitCode}`,
              output: output.trim() || undefined,
              executionTime,
            });
          }
        });

        dockerProcess.on('error', (err: Error) => {
          clearTimeout(timeoutHandle);
          const executionTime = Date.now() - startTime;

          resolve({
            success: false,
            error: err.message,
            executionTime,
          });
        });
      });
    }).catch((error) => {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    })
  }
}

export const dockerExecutor = new DockerExecutor();
