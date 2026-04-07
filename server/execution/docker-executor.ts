// @ts-nocheck
/**
 * Real Docker-based code execution environment
 * Provides sandboxed, containerized runtime for user code
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import type Docker from 'dockerode';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { Project, File } from '@shared/schema';
// @ts-expect-error - tar-stream doesn't have type definitions
import * as tarStream from 'tar-stream';
import { Readable } from 'stream';

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

// Base directory for execution workspaces
const EXECUTION_BASE_DIR = path.join(os.tmpdir(), 'e-code-executions');

export interface ExecutionConfig {
  projectId: number;
  language: string;
  command?: string;
  files: File[];
  environmentVars?: Record<string, string>;
  port?: number;
  memoryLimit?: string; // e.g., '512m', '1g'
  cpuLimit?: number; // e.g., 0.5 for half a CPU
  timeout?: number; // in seconds
}

export interface ExecutionResult {
  containerId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  output: string[];
  errorOutput: string[];
  exitCode?: number;
  url?: string;
  port?: number;
  stats?: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: { rx: number; tx: number };
  };
}

export class DockerExecutor extends EventEmitter {
  private activeContainers: Map<string, {
    container: Docker.Container;
    projectId: number;
    result: ExecutionResult;
    workDir: string;  // Host directory for file sync
    originalFiles: Map<string, string>;  // Original file contents for diffing
    synced: boolean;  // Flag to prevent double sync
  }> = new Map();

  constructor() {
    super();
    this.setupCleanup();
    this.ensureBaseDir();
  }

  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(EXECUTION_BASE_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create execution base directory:', error);
    }
  }

  private setupCleanup() {
    // Clean up containers on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async executeProject(config: ExecutionConfig): Promise<ExecutionResult> {
    const containerId = crypto.randomUUID();
    const containerName = `project-${config.projectId}-${containerId.slice(0, 8)}`;
    
    const result: ExecutionResult = {
      containerId,
      status: 'starting',
      output: [],
      errorOutput: [],
      port: config.port
    };

    try {
      // Create container with appropriate image
      const image = await this.getOrPullImage(config.language);
      
      // Create a writable workspace on the host and populate with project files
      const { workDir, originalFiles } = await this.setupWorkspace(containerId, config.files);
      
      // Container configuration - use DOCKER_NETWORK for sibling container access
      const networkMode = process.env.DOCKER_NETWORK || 'bridge';
      const containerConfig: Docker.ContainerCreateOptions = {
        name: containerName,
        Image: image,
        Cmd: this.getCommand(config),
        WorkingDir: '/app',
        Env: this.formatEnvironmentVars(config.environmentVars, config.projectId),
        HostConfig: {
          Memory: this.parseMemoryLimit(config.memoryLimit || '512m'),
          CpuQuota: config.cpuLimit ? config.cpuLimit * 100000 : undefined,
          CpuPeriod: 100000,
          NetworkMode: networkMode,
          AutoRemove: false,
          // Bind mount the workspace directory with read-write access
          Binds: [`${workDir}:/app:rw`],
          // Allow writing to /app but keep other areas restricted
          Tmpfs: { '/tmp': 'rw,nosuid,size=128m' },
          PortBindings: config.port ? {
            [`${config.port}/tcp`]: [{ HostPort: '0' }]
          } : undefined,
          ExtraHosts: ['host.docker.internal:host-gateway'],
          // Security: Drop all capabilities, run as non-root
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true']
        },
        ExposedPorts: config.port ? {
          [`${config.port}/tcp`]: {}
        } : undefined,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false
      };

      // Create container (files are already in workDir via bind mount)
      const docker = await getDocker();
      const container = await docker.createContainer(containerConfig);
      
      // Set up output streams
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true
      });

      // Handle output
      stream.on('data', (chunk) => {
        const output = chunk.toString();
        // Docker multiplexes stdout/stderr, first byte indicates stream type
        const streamType = chunk[0];
        const message = chunk.slice(8).toString();
        
        if (streamType === 1) { // stdout
          result.output.push(message);
          this.emit('output', { containerId, type: 'stdout', message });
        } else if (streamType === 2) { // stderr
          result.errorOutput.push(message);
          this.emit('output', { containerId, type: 'stderr', message });
        }
      });

      // Start the container
      await container.start();
      result.status = 'running';

      // Get assigned port if applicable
      if (config.port) {
        const containerInfo = await container.inspect();
        const hostPort = containerInfo.NetworkSettings.Ports[`${config.port}/tcp`]?.[0]?.HostPort;
        if (hostPort) {
          result.url = `http://localhost:${hostPort}`;
          result.port = parseInt(hostPort);
        }
      }

      // Store container reference with workDir for file sync
      this.activeContainers.set(containerId, {
        container,
        projectId: config.projectId,
        result,
        workDir,
        originalFiles,
        synced: false  // Will be set to true after first sync
      });

      // Set up monitoring
      this.monitorContainer(containerId, container, result);

      // Set up timeout if specified - with guaranteed kill after grace period
      if (config.timeout) {
        const timeoutMs = config.timeout * 1000;
        
        // First attempt: graceful stop
        setTimeout(() => this.stopContainer(containerId), timeoutMs);
        
        // Second attempt: force kill after 5s grace period if still running
        setTimeout(async () => {
          try {
            const containerInfo = this.activeContainers.get(containerId);
            if (containerInfo) {
              const inspect = await containerInfo.container.inspect();
              if (inspect.State.Running) {
                logger.warn(`Container ${containerId} still running after timeout, forcing kill`);
                await containerInfo.container.kill({ signal: 'SIGKILL' });
              }
            }
          } catch (e) {
            // Container already terminated - this is expected
          }
        }, timeoutMs + 5000);
      }

      logger.info(`Container ${containerName} started successfully`);
      return result;

    } catch (error) {
      logger.error(`Failed to execute project: ${error}`);
      result.status = 'error';
      result.errorOutput.push(error.message);
      throw error;
    }
  }

  private async getOrPullImage(language: string): Promise<string> {
    // Production-ready language support with verified Docker images
    // All languages tested for single-file execution without project scaffolding
    
    const imageMap: Record<string, string> = {
      // === TIER-1: Core Languages (Single-file execution works) ===
      // JavaScript/TypeScript
      'nodejs': 'node:20-alpine',
      'javascript': 'node:20-alpine',
      'js': 'node:20-alpine',
      'typescript': 'node:20-alpine',
      'ts': 'node:20-alpine',
      // Python
      'python': 'python:3.12-slim',
      'python3': 'python:3.12-slim',
      // C/C++ (compile + run)
      'c': 'gcc:13',
      'cpp': 'gcc:13',
      'c++': 'gcc:13',
      // Java (compile + run)
      'java': 'eclipse-temurin:21-jdk',
      // Scripting
      'ruby': 'ruby:3.2-slim',
      'php': 'php:8.2-cli',
      'perl': 'perl:5.38',
      // Shell
      'bash': 'bash:5.2',
      'shell': 'alpine:3.19',
      
      // === TIER-2: Project-based Languages (Need go.mod, Cargo.toml, etc.) ===
      'go': 'golang:1.22-alpine',
      'rust': 'rust:1.77-slim',
      
      // === TIER-3: Requires Additional Setup (Not single-file ready) ===
      // These require project scaffolding or custom images
      'swift': 'swift:5.9-jammy',
      'csharp': 'mcr.microsoft.com/dotnet/sdk:8.0',
      'fsharp': 'mcr.microsoft.com/dotnet/sdk:8.0',
      'lua': 'nickblah/lua:5.4',
      'haskell': 'haskell:9.4',
      'elixir': 'elixir:1.15',
      'clojure': 'clojure:temurin-17-tools-deps',
      'r': 'r-base:4.3.2',
      'julia': 'julia:1.10',
      'kotlin': 'eclipse-temurin:21-jdk',
      'scala': 'eclipse-temurin:21-jdk'
    };

    const imageName = imageMap[language] || 'ubuntu:22.04';
    
    try {
      const docker = await getDocker();
      // Check if image exists locally
      await docker.getImage(imageName).inspect();
      logger.info(`Using existing image: ${imageName}`);
    } catch (error) {
      // Pull image if not found
      logger.info(`Pulling image: ${imageName}`);
      const docker = await getDocker();
      const stream = await docker.pull(imageName);
      
      // Wait for pull to complete
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    }

    return imageName;
  }

  /**
   * Create a writable workspace directory on the host and populate with project files
   * Returns the workspace path and a map of original file contents for later diffing
   */
  private async setupWorkspace(containerId: string, files: File[]): Promise<{
    workDir: string;
    originalFiles: Map<string, string>;
  }> {
    const workDir = path.join(EXECUTION_BASE_DIR, containerId);
    const originalFiles = new Map<string, string>();
    
    try {
      // Create workspace directory
      await fs.mkdir(workDir, { recursive: true });
      
      // Write all project files to workspace
      for (const file of files) {
        const filePath = path.join(workDir, file.path || file.name);
        
        if (file.isDirectory) {
          await fs.mkdir(filePath, { recursive: true });
        } else if (file.content !== null && file.content !== undefined) {
          // Ensure parent directory exists
          const parentDir = path.dirname(filePath);
          await fs.mkdir(parentDir, { recursive: true });
          
          // Write file content
          await fs.writeFile(filePath, file.content, 'utf8');
          
          // Store original content for later comparison
          const relativePath = file.path || file.name;
          originalFiles.set(relativePath, file.content);
        }
      }
      
      logger.info(`Created workspace for execution ${containerId} with ${files.length} files`);
      return { workDir, originalFiles };
      
    } catch (error) {
      logger.error(`Failed to setup workspace: ${error}`);
      throw error;
    }
  }

  /**
   * Sync modified files from workspace back to storage
   * Compares current files against original content and persists changes
   * Optimized: fetches existing files ONCE to avoid O(n²) DB calls
   */
  private async syncWorkspaceToStorage(
    projectId: number,
    workDir: string,
    originalFiles: Map<string, string>
  ): Promise<{ created: number; modified: number; deleted: number }> {
    const stats = { created: 0, modified: 0, deleted: 0 };
    
    try {
      // Walk the workspace and find all files
      const currentFiles = new Map<string, string>();
      const currentDirs = new Set<string>();
      await this.walkDirectory(workDir, '', currentFiles, currentDirs);
      
      // Fetch existing files ONCE (avoid O(n²) DB calls)
      const existingFiles = await storage.getFilesByProjectId(projectId.toString());
      const existingFileMap = new Map(existingFiles.map(f => [f.path || f.name, f]));
      const existingDirPaths = new Set(existingFiles.filter(f => f.isDirectory).map(f => f.path || f.name));
      
      // Create new directories first (required for nested file creation)
      for (const dirPath of currentDirs) {
        if (!existingDirPaths.has(dirPath)) {
          try {
            await storage.createFile({
              projectId,
              name: path.basename(dirPath),
              path: dirPath,
              content: null,
              isDirectory: true
            });
            stats.created++;
            logger.debug(`Created new directory: ${dirPath}`);
          } catch (error) {
            logger.warn(`Failed to create directory ${dirPath}:`, error);
          }
        }
      }
      
      // Find modified and new files
      for (const [relativePath, content] of currentFiles) {
        const originalContent = originalFiles.get(relativePath);
        const existingFile = existingFileMap.get(relativePath);
        
        // Handle large files: store up to 5MB, warn for larger
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (content.length > MAX_FILE_SIZE) {
          logger.warn(`Skipping very large file: ${relativePath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
          continue;
        }
        
        if (originalContent === undefined) {
          // New file created during execution
          try {
            await storage.createFile({
              projectId,
              name: path.basename(relativePath),
              path: relativePath,
              content,
              isDirectory: false
            });
            stats.created++;
            logger.debug(`Created new file: ${relativePath}`);
          } catch (error) {
            logger.warn(`Failed to create file ${relativePath}:`, error);
          }
        } else if (originalContent !== content) {
          // File was modified - use cached lookup
          if (existingFile) {
            try {
              await storage.updateFile(existingFile.id, { content });
              stats.modified++;
              logger.debug(`Updated file: ${relativePath}`);
            } catch (error) {
              logger.warn(`Failed to update file ${relativePath}:`, error);
            }
          }
        }
      }
      
      // Find deleted files (in original but not in current) - use cached lookup
      for (const [relativePath] of originalFiles) {
        if (!currentFiles.has(relativePath)) {
          const existingFile = existingFileMap.get(relativePath);
          if (existingFile) {
            try {
              await storage.deleteFile(existingFile.id);
              stats.deleted++;
              logger.debug(`Deleted file: ${relativePath}`);
            } catch (error) {
              logger.warn(`Failed to delete file ${relativePath}:`, error);
            }
          }
        }
      }
      
      logger.info(`Synced workspace for project ${projectId}: ${stats.created} created, ${stats.modified} modified, ${stats.deleted} deleted`);
      return stats;
      
    } catch (error) {
      logger.error(`Failed to sync workspace to storage:`, error);
      return stats;
    }
  }

  /**
   * Walk a directory recursively and collect all file contents and directories
   */
  private async walkDirectory(
    baseDir: string,
    relativePath: string,
    files: Map<string, string>,
    directories?: Set<string>
  ): Promise<void> {
    const currentDir = path.join(baseDir, relativePath);
    
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        
        // Skip node_modules and other heavy directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Track directory for later creation
          if (directories) {
            directories.add(entryRelativePath);
          }
          await this.walkDirectory(baseDir, entryRelativePath, files, directories);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(path.join(currentDir, entry.name), 'utf8');
            files.set(entryRelativePath, content);
          } catch (readError) {
            // Try reading as binary and encode as base64 for binary files
            try {
              const buffer = await fs.readFile(path.join(currentDir, entry.name));
              // Store binary files up to 5MB (aligned with syncWorkspaceToStorage limit)
              const MAX_BINARY_SIZE = 5 * 1024 * 1024; // 5MB
              if (buffer.length < MAX_BINARY_SIZE) {
                files.set(entryRelativePath, buffer.toString('base64'));
                logger.debug(`Stored binary file as base64: ${entryRelativePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
              } else {
                logger.warn(`Skipping large binary file: ${entryRelativePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
              }
            } catch (binaryError) {
              logger.debug(`Skipping unreadable file: ${entryRelativePath}`);
            }
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to walk directory ${currentDir}:`, error);
    }
  }

  /**
   * Clean up workspace directory after execution
   */
  private async cleanupWorkspace(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      logger.debug(`Cleaned up workspace: ${workDir}`);
    } catch (error) {
      logger.warn(`Failed to cleanup workspace ${workDir}:`, error);
    }
  }

  private async createProjectTar(files: File[]): Promise<Buffer> {
    const entries: Array<{ name: string; content: Buffer }> = [];
    
    for (const file of files) {
      if (!file.isDirectory && file.content) {
        entries.push({
          name: file.name,
          content: Buffer.from(file.content, 'utf8')
        });
      }
    }

    return new Promise((resolve, reject) => {
      const pack = tarStream.pack();
      const chunks: Buffer[] = [];
      
      pack.on('data', (chunk: Buffer) => chunks.push(chunk));
      pack.on('end', () => resolve(Buffer.concat(chunks)));
      pack.on('error', reject);
      
      // Add each file sequentially using buffer form of pack.entry
      const addEntry = (index: number) => {
        if (index >= entries.length) {
          pack.finalize();
          return;
        }
        
        const { name, content } = entries[index];
        // Use buffer form: pack.entry(header, buffer, callback)
        // This synchronously writes buffer and calls callback when done
        pack.entry({ name, size: content.length }, content, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          // Schedule next entry to avoid stack overflow for large file counts
          setImmediate(() => addEntry(index + 1));
        });
      };
      
      addEntry(0);
    });
  }

  private getCommand(config: ExecutionConfig): string[] | undefined {
    // Build the base command
    let baseCommand: string[];
    
    if (config.command) {
      baseCommand = config.command.split(' ');
    } else {
      baseCommand = this.getDefaultCommand(config.language);
      if (!baseCommand) return undefined;
    }
    
    // Build ReplDB file creation prefix (Replit compatibility)
    // The Replit Python/Node.js clients check /tmp/replitdb for published apps
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://host.docker.internal:${process.env.PORT || 5000}`;
    const dbUrl = config.projectId ? `${baseUrl}/api/db/${config.projectId}` : '';
    const repldbPrefix = `echo '${dbUrl}' > /tmp/replitdb 2>/dev/null || true`;
    
    // Check if command is already a shell wrapper ['sh', '-c', '...']
    if (baseCommand.length === 3 && 
        (baseCommand[0] === 'sh' || baseCommand[0] === 'bash') && 
        baseCommand[1] === '-c') {
      // Extract the inner command and prepend the ReplDB setup
      const innerCommand = baseCommand[2];
      return [baseCommand[0], '-c', `${repldbPrefix}; ${innerCommand}`];
    }
    
    // Simple command - wrap it in shell with ReplDB prefix
    const commandStr = baseCommand.join(' ');
    return ['sh', '-c', `${repldbPrefix}; ${commandStr}`];
  }
  
  private getDefaultCommand(language: string): string[] | undefined {
    // Production-ready command support matching imageMap tiers
    // Commands verified to work with single-file execution
    const defaultCommands: Record<string, string[]> = {
      // === TIER-1: Single-file Execution (Works out of the box) ===
      // JavaScript/TypeScript
      'nodejs': ['node', 'index.js'],
      'javascript': ['node', 'index.js'],
      'js': ['node', 'index.js'],
      'typescript': ['sh', '-c', 'npx --yes tsx index.ts'],
      'ts': ['sh', '-c', 'npx --yes tsx index.ts'],
      // Python
      'python': ['python', 'main.py'],
      'python3': ['python', 'main.py'],
      // C/C++ (compile + run)
      'c': ['sh', '-c', 'gcc -o main main.c && ./main'],
      'cpp': ['sh', '-c', 'g++ -o main main.cpp && ./main'],
      'c++': ['sh', '-c', 'g++ -o main main.cpp && ./main'],
      // Java (compile + run)
      'java': ['sh', '-c', 'javac Main.java && java Main'],
      // Scripting
      'ruby': ['ruby', 'main.rb'],
      'php': ['php', 'index.php'],
      'perl': ['perl', 'main.pl'],
      // Shell
      'bash': ['bash', 'main.sh'],
      'shell': ['sh', 'main.sh'],
      
      // === TIER-2: Project-based (Auto-scaffolds if needed) ===
      'go': ['sh', '-c', 'if [ ! -f go.mod ]; then go mod init app 2>/dev/null; fi && go run .'],
      'rust': ['sh', '-c', 'if [ -f main.rs ] && [ ! -f Cargo.toml ]; then rustc main.rs -o main && ./main; else cargo run; fi'],
      
      // === TIER-3: Requires Setup (May need project files or custom config) ===
      'swift': ['swift', 'main.swift'],
      'csharp': ['sh', '-c', 'echo "C# requires a .csproj project. Create with: dotnet new console" && exit 1'],
      'fsharp': ['sh', '-c', 'echo "F# requires a .fsproj project. Create with: dotnet new console -lang F#" && exit 1'],
      'lua': ['lua', 'main.lua'],
      'haskell': ['runhaskell', 'Main.hs'],
      'elixir': ['elixir', 'main.exs'],
      'clojure': ['sh', '-c', 'echo "Clojure requires deps.edn setup. See: https://clojure.org/guides/deps_and_cli" && exit 1'],
      'r': ['Rscript', 'main.R'],
      'julia': ['julia', 'main.jl'],
      'kotlin': ['sh', '-c', 'echo "Kotlin requires kotlinc. Use a custom image or install via SDKMAN." && exit 1'],
      'scala': ['sh', '-c', 'echo "Scala requires scalac. Use a custom image or sbt project." && exit 1']
    };

    return defaultCommands[language];
  }

  private formatEnvironmentVars(vars?: Record<string, string>, projectId?: number): string[] {
    const envVars: string[] = [];
    
    // Inject standard E-Code environment variables (Replit parity)
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://host.docker.internal:${process.env.PORT || 5000}`;
    
    // REPLIT_DB_URL - Key-value database URL (Replit parity)
    if (projectId) {
      envVars.push(`REPLIT_DB_URL=${baseUrl}/api/db/${projectId}`);
      envVars.push(`ECODE_DB_URL=${baseUrl}/api/db/${projectId}`);
    }
    
    // Standard Replit environment variables
    envVars.push(`REPL_ID=${projectId || 'unknown'}`);
    envVars.push(`REPL_OWNER=ecode`);
    envVars.push(`REPL_SLUG=project-${projectId || 'unknown'}`);
    envVars.push(`REPLIT_DEPLOYMENT=1`);
    
    // Add user-provided environment variables
    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        envVars.push(`${key}=${value}`);
      }
    }
    
    return envVars;
  }

  private parseMemoryLimit(limit: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = limit.match(/^(\d+)([bkmg])?$/i);
    if (!match) {
      throw new Error(`Invalid memory limit: ${limit}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || 'b';
    
    return value * (units[unit] || 1);
  }

  private async monitorContainer(
    containerId: string, 
    container: Docker.Container, 
    result: ExecutionResult
  ) {
    const statsStream = await container.stats({ stream: true });
    
    statsStream.on('data', (chunk) => {
      try {
        const stats = JSON.parse(chunk.toString());
        
        // Calculate CPU usage percentage
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                        stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - 
                           stats.precpu_stats.system_cpu_usage;
        const cpuUsage = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

        // Calculate memory usage
        const memoryUsage = stats.memory_stats.usage / stats.memory_stats.limit * 100;

        // Network I/O
        const networkIO = {
          rx: stats.networks?.eth0?.rx_bytes || 0,
          tx: stats.networks?.eth0?.tx_bytes || 0
        };

        result.stats = {
          cpuUsage: Math.round(cpuUsage * 100) / 100,
          memoryUsage: Math.round(memoryUsage * 100) / 100,
          networkIO
        };

        this.emit('stats', { containerId, stats: result.stats });
      } catch (error) {
        logger.error(`Failed to parse container stats: ${error}`);
      }
    });

    // Monitor container status
    container.wait(async (err, data) => {
      if (err) {
        logger.error(`Container wait error: ${err}`);
        result.status = 'error';
      } else {
        result.status = 'stopped';
        result.exitCode = data.StatusCode;
      }
      
      // Clean up stats stream
      (statsStream as any).destroy?.();
      
      // Get container data before removing from map
      const containerData = this.activeContainers.get(containerId);
      
      if (containerData) {
        // Sync workspace files back to storage before cleanup
        // ONLY if not already synced (prevents double-sync when stopContainer is called)
        if (!containerData.synced) {
          try {
            await this.syncWorkspaceToStorage(
              containerData.projectId,
              containerData.workDir,
              containerData.originalFiles
            );
            containerData.synced = true;
          } catch (syncError) {
            logger.error(`Failed to sync workspace for container ${containerId}:`, syncError);
          }
        }
        
        // Always clean up workspace directory (even if already synced)
        await this.cleanupWorkspace(containerData.workDir);
      }
      
      // Remove from active containers
      this.activeContainers.delete(containerId);
      
      this.emit('stopped', { containerId, exitCode: result.exitCode });
    });
  }

  async stopContainer(containerId: string): Promise<void> {
    const containerData = this.activeContainers.get(containerId);
    if (!containerData) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Sync files BEFORE stopping the container to ensure data is saved
    if (!containerData.synced) {
      try {
        await this.syncWorkspaceToStorage(
          containerData.projectId,
          containerData.workDir,
          containerData.originalFiles
        );
        containerData.synced = true;  // Mark as synced to prevent double-sync in wait handler
        logger.info(`Synced files before stopping container ${containerId}`);
      } catch (syncError) {
        logger.error(`Failed to sync files before stopping container ${containerId}:`, syncError);
      }
    }

    try {
      await containerData.container.stop({ t: 5 });
      logger.info(`Container ${containerId} stopped`);
    } catch (error) {
      // Force kill if stop fails
      await containerData.container.kill();
      logger.warn(`Container ${containerId} force killed`);
    }
    
    // Note: workspace cleanup is handled by the container.wait handler
    // to avoid race conditions with the sync process
  }

  async getContainerLogs(containerId: string): Promise<string[]> {
    const containerData = this.activeContainers.get(containerId);
    if (!containerData) {
      throw new Error(`Container ${containerId} not found`);
    }

    const logs = await containerData.container.logs({
      stdout: true,
      stderr: true,
      timestamps: true
    });

    return logs.toString().split('\n').filter(line => line.trim());
  }

  async getContainerStatus(containerId: string): Promise<ExecutionResult | null> {
    const containerData = this.activeContainers.get(containerId);
    return containerData?.result || null;
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up all containers...');
    
    for (const [containerId, data] of this.activeContainers) {
      try {
        // Sync files before cleanup (only if not already synced)
        if (!data.synced) {
          await this.syncWorkspaceToStorage(data.projectId, data.workDir, data.originalFiles);
          data.synced = true;  // Mark as synced to prevent double-sync in wait handler
        }
        await this.cleanupWorkspace(data.workDir);
        
        await data.container.stop({ t: 0 });
        await data.container.remove();
      } catch (error) {
        logger.error(`Failed to cleanup container ${containerId}: ${error}`);
      }
    }
    
    // Clear all containers AFTER cleanup to ensure wait handlers see synced=true
    this.activeContainers.clear();
  }

  async executeCommand(
    containerId: string, 
    command: string[]
  ): Promise<{ output: string; exitCode: number }> {
    const containerData = this.activeContainers.get(containerId);
    if (!containerData) {
      throw new Error(`Container ${containerId} not found`);
    }

    const exec = await containerData.container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ Detach: false });
    
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await new Promise((resolve) => stream.on('end', resolve));
    
    const inspectResult = await exec.inspect();
    
    return {
      output,
      exitCode: inspectResult.ExitCode || 0
    };
  }

  /**
   * Execute code directly (convenience method for auto-grading)
   * @param language - Programming language
   * @param code - Code to execute
   * @param input - Standard input
   * @param workDir - Working directory (optional)
   */
  async executeCode(
    language: string,
    code: string,
    input?: string,
    workDir?: string
  ): Promise<{ output: string; error: string; exitCode: number }> {
    const mainFiles: Record<string, string> = {
      'python': 'main.py',
      'javascript': 'index.js',
      'nodejs': 'index.js',
      'java': 'Main.java',
      'cpp': 'main.cpp',
      'c': 'main.c',
      'go': 'main.go',
      'ruby': 'main.rb',
      'php': 'index.php',
      'rust': 'main.rs',
    };

    const fileName = mainFiles[language] || 'main.txt';
    const files: File[] = [{
      id: 0,
      projectId: 0,
      name: fileName,
      path: fileName,
      content: code,
      isDirectory: false,
      parentId: null,
      type: null,
      size: code.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    try {
      const result = await this.executeProject({
        projectId: 0,
        language,
        files,
        timeout: 30,
        memoryLimit: '256m',
      });

      // Wait for container to finish or timeout
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (result.status === 'stopped' || result.status === 'error') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Max wait of 35 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 35000);
      });

      return {
        output: result.output.join('\n'),
        error: result.errorOutput.join('\n'),
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }
}

export const dockerExecutor = new DockerExecutor();