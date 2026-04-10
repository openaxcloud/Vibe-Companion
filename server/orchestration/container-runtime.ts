import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { nixEnvironmentBuilder } from '../package-management/nix-environment-builder';

const logger = createLogger('container-runtime');

export interface ContainerConfig {
  // Container identity
  name: string;
  image: string;
  tag?: string;
  
  // Resource limits
  cpuShares?: number;        // CPU shares (relative weight)
  memoryLimit?: number;      // Memory limit in MB
  cpuQuota?: number;         // CPU quota in microseconds
  cpuPeriod?: number;        // CPU period in microseconds
  pidsLimit?: number;        // Maximum number of PIDs
  
  // Storage
  volumes?: VolumeMount[];
  workingDir?: string;
  readOnlyRootfs?: boolean;
  
  // Networking
  hostname?: string;
  networkMode?: 'none' | 'host' | 'bridge' | 'custom';
  ports?: PortMapping[];
  dns?: string[];
  
  // Security
  user?: string;
  group?: string;
  capabilities?: string[];
  seccompProfile?: string;
  apparmorProfile?: string;
  noNewPrivileges?: boolean;
  
  // Environment
  env?: Record<string, string>;
  command?: string[];
  entrypoint?: string[];
  
  // Runtime behavior
  autoRemove?: boolean;
  restartPolicy?: RestartPolicy;
  healthcheck?: HealthCheck;
  
  // Nix package management
  nixEnabled?: boolean;
  nixPackages?: string[];
  nixProjectId?: string;
  nixLanguage?: string;
}

export interface VolumeMount {
  source: string;
  target: string;
  type: 'bind' | 'tmpfs';
  readOnly?: boolean;
  options?: string[];
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol?: 'tcp' | 'udp';
  hostIp?: string;
}

export interface RestartPolicy {
  name: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  maximumRetryCount?: number;
}

export interface HealthCheck {
  test: string[];
  interval?: number;
  timeout?: number;
  retries?: number;
  startPeriod?: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  created: Date;
  started?: Date;
  finished?: Date;
  exitCode?: number;
  pid?: number;
  resourceUsage: ResourceUsage;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
}

export type ContainerStatus = 
  | 'created'
  | 'starting' 
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'dead';

export interface ContainerRuntime {
  createContainer(config: ContainerConfig): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string, timeout?: number): Promise<void>;
  removeContainer(containerId: string, force?: boolean): Promise<void>;
  pauseContainer(containerId: string): Promise<void>;
  unpauseContainer(containerId: string): Promise<void>;
  getContainerInfo(containerId: string): Promise<ContainerInfo | null>;
  listContainers(all?: boolean): Promise<ContainerInfo[]>;
  getContainerLogs(containerId: string, tail?: number): Promise<string>;
  execInContainer(containerId: string, command: string[]): Promise<ExecResult>;
  waitContainer(containerId: string): Promise<number>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Custom container runtime implementation using Linux namespaces and cgroups
 * This provides Docker-like functionality without requiring Docker
 */
export class ECodeContainerRuntime extends EventEmitter implements ContainerRuntime {
  private containers: Map<string, Container> = new Map();
  private rootDir: string;
  private cgroupRoot: string = '/sys/fs/cgroup';
  
  constructor(rootDir: string = '/var/lib/ecode/containers') {
    super();
    this.rootDir = rootDir;
  }
  
  async initialize(): Promise<void> {
    // Create root directory for containers
    await fs.mkdir(this.rootDir, { recursive: true });
    
    // Verify cgroups v2 is available
    try {
      const cgroupType = await fs.readFile('/proc/filesystems', 'utf-8');
      if (!cgroupType.includes('cgroup2')) {
        throw new Error('cgroups v2 is required for container runtime');
      }
    } catch (error) {
      logger.error('Failed to verify cgroups support:', String(error));
      throw error;
    }
    
    logger.info('Container runtime initialized');
  }
  
  async createContainer(config: ContainerConfig): Promise<string> {
    const containerId = uuidv4();
    const container = new Container(containerId, config, this.rootDir);
    
    await container.create();
    this.containers.set(containerId, container);
    
    this.emit('container:created', { containerId, config });
    logger.info(`Container ${containerId} created with name ${config.name}`);
    
    return containerId;
  }
  
  async startContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    await container.start();
    this.emit('container:started', { containerId });
  }
  
  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    await container.stop(timeout);
    this.emit('container:stopped', { containerId });
  }
  
  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    if (container.getStatus() === 'running' && !force) {
      throw new Error('Cannot remove running container');
    }
    
    await container.remove();
    this.containers.delete(containerId);
    this.emit('container:removed', { containerId });
  }
  
  async pauseContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    await container.pause();
    this.emit('container:paused', { containerId });
  }
  
  async unpauseContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    await container.unpause();
    this.emit('container:unpaused', { containerId });
  }
  
  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    const container = this.containers.get(containerId);
    return container ? container.getInfo() : null;
  }
  
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    const containers = Array.from(this.containers.values());
    const infos = containers.map(c => c.getInfo());
    
    if (!all) {
      return infos.filter(info => info.status === 'running');
    }
    
    return infos;
  }
  
  async getContainerLogs(containerId: string, tail?: number): Promise<string> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    return container.getLogs(tail);
  }
  
  async execInContainer(containerId: string, command: string[]): Promise<ExecResult> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    return container.exec(command);
  }
  
  async waitContainer(containerId: string): Promise<number> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    return container.wait();
  }
  
  async cleanup(): Promise<void> {
    // Stop and remove all containers
    for (const [id, container] of Array.from(this.containers)) {
      try {
        if (container.getStatus() === 'running') {
          await container.stop();
        }
        await container.remove();
      } catch (error) {
        logger.error(`Failed to cleanup container ${id}:`, String(error));
      }
    }
    
    this.containers.clear();
  }
}

/**
 * Individual container implementation
 */
class Container {
  private id: string;
  private config: ContainerConfig;
  private rootDir: string;
  private bundleDir: string;
  private status: ContainerStatus = 'created';
  private process?: ChildProcess;
  private pid?: number;
  private created: Date;
  private started?: Date;
  private finished?: Date;
  private exitCode?: number;
  private cgroupPath?: string;
  private logPath: string;
  private logStream?: fs.FileHandle;
  private nixEnv?: Record<string, string>;
  private nixMounts?: Map<string, string>;
  
  constructor(id: string, config: ContainerConfig, rootDir: string) {
    this.id = id;
    this.config = config;
    this.rootDir = rootDir;
    this.bundleDir = path.join(rootDir, id);
    this.logPath = path.join(this.bundleDir, 'container.log');
    this.created = new Date();
  }
  
  async create(): Promise<void> {
    // Create container directory structure
    await fs.mkdir(this.bundleDir, { recursive: true });
    await fs.mkdir(path.join(this.bundleDir, 'rootfs'), { recursive: true });
    await fs.mkdir(path.join(this.bundleDir, 'work'), { recursive: true });
    await fs.mkdir(path.join(this.bundleDir, 'upper'), { recursive: true });
    
    // Extract or set up the root filesystem
    await this.setupRootfs();
    
    // Set up Nix environment if enabled
    if (this.config.nixEnabled) {
      await this.setupNixEnvironment();
    }
    
    // Create cgroup for resource control
    await this.createCgroup();
    
    // Write container configuration
    await this.writeConfig();
    
    // Open log file
    this.logStream = await fs.open(this.logPath, 'w');
  }
  
  private async setupRootfs(): Promise<void> {
    // This is where we would extract the container image
    // For now, we'll set up a minimal root filesystem
    const rootfs = path.join(this.bundleDir, 'rootfs');
    
    // Create essential directories
    const dirs = [
      'bin', 'dev', 'etc', 'home', 'lib', 'lib64',
      'proc', 'root', 'sbin', 'sys', 'tmp', 'usr', 'var'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(rootfs, dir), { recursive: true });
    }
    
    // Copy essential binaries and libraries
    // This would be replaced with proper image extraction
    await this.copyEssentialFiles(rootfs);
  }
  
  private async copyEssentialFiles(rootfs: string): Promise<void> {
    // Copy minimal set of binaries for a functional container
    const essentials = [
      '/bin/sh',
      '/bin/bash',
      '/bin/ls',
      '/bin/cat',
      '/bin/echo',
      '/usr/bin/env'
    ];
    
    for (const file of essentials) {
      try {
        const dest = path.join(rootfs, file);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(file, dest);
        await fs.chmod(dest, 0o755);
      } catch (error) {
        // Skip if file doesn't exist
      }
    }
  }
  
  private async setupNixEnvironment(): Promise<void> {
    if (!this.config.nixEnabled || !this.config.nixProjectId) {
      return;
    }
    
    logger.info(`Setting up Nix environment for container ${this.id}`);
    
    try {
      // Build Nix environment
      const environment = await nixEnvironmentBuilder.buildEnvironment({
        projectId: this.config.nixProjectId,
        language: this.config.nixLanguage || 'bash',
        packages: this.config.nixPackages || []
      });
      
      // Store Nix environment variables
      this.nixEnv = environment.envVars;
      
      // Merge Nix environment variables with container config
      this.config.env = {
        ...this.config.env,
        ...environment.envVars,
        PATH: `${environment.binPaths.join(':')}:${this.config.env?.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
        LD_LIBRARY_PATH: environment.libPaths.join(':'),
        C_INCLUDE_PATH: environment.includePaths.join(':')
      };
      
      // Create Nix bind mounts
      this.nixMounts = await nixEnvironmentBuilder.createContainerBindMounts(environment);
      
      // Add Nix mounts to container volumes
      const nixVolumes: VolumeMount[] = [];
      for (const [source, target] of Array.from(this.nixMounts)) {
        const [targetPath, options] = target.split(':');
        nixVolumes.push({
          source,
          target: targetPath,
          type: 'bind',
          readOnly: options === 'ro',
          options: ['bind']
        });
      }
      
      this.config.volumes = [...(this.config.volumes || []), ...nixVolumes];
      
      // Create nix directory in rootfs
      const rootfs = path.join(this.bundleDir, 'rootfs');
      await fs.mkdir(path.join(rootfs, 'nix'), { recursive: true });
      await fs.mkdir(path.join(rootfs, 'ecode'), { recursive: true });
      
      logger.info(`Nix environment setup complete for container ${this.id}`);
    } catch (error) {
      logger.error(`Failed to setup Nix environment for container ${this.id}:`, String(error));
      throw error;
    }
  }
  
  private async createCgroup(): Promise<void> {
    const cgroupName = `ecode-container-${this.id}`;
    this.cgroupPath = `/sys/fs/cgroup/${cgroupName}`;
    
    try {
      // Create cgroup
      await fs.mkdir(this.cgroupPath, { recursive: true });
      
      // Set resource limits
      if (this.config.memoryLimit) {
        await fs.writeFile(
          path.join(this.cgroupPath, 'memory.max'),
          `${this.config.memoryLimit * 1024 * 1024}`
        );
      }
      
      if (this.config.cpuQuota && this.config.cpuPeriod) {
        await fs.writeFile(
          path.join(this.cgroupPath, 'cpu.max'),
          `${this.config.cpuQuota} ${this.config.cpuPeriod}`
        );
      }
      
      if (this.config.pidsLimit) {
        await fs.writeFile(
          path.join(this.cgroupPath, 'pids.max'),
          `${this.config.pidsLimit}`
        );
      }
    } catch (error) {
      logger.error(`Failed to create cgroup for container ${this.id}:`, String(error));
      throw error;
    }
  }
  
  private async writeConfig(): Promise<void> {
    const configPath = path.join(this.bundleDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }
  
  async start(): Promise<void> {
    if (this.status !== 'created' && this.status !== 'stopped') {
      throw new Error(`Container ${this.id} is not in a startable state`);
    }
    
    this.status = 'starting';
    
    try {
      // Build the command to start the container
      const cmd = this.buildStartCommand();
      
      // Start the container process
      this.process = spawn(cmd[0], cmd.slice(1), {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.pid = this.process.pid;
      
      // Pipe output to log file
      if (this.logStream) {
        this.process.stdout?.pipe(this.logStream.createWriteStream());
        this.process.stderr?.pipe(this.logStream.createWriteStream());
      }
      
      // Add process to cgroup
      if (this.cgroupPath && this.pid) {
        await fs.writeFile(
          path.join(this.cgroupPath, 'cgroup.procs'),
          `${this.pid}`
        );
      }
      
      this.status = 'running';
      this.started = new Date();
      
      // Monitor process
      this.process.on('exit', (code) => {
        this.status = 'stopped';
        this.finished = new Date();
        this.exitCode = code || 0;
      });
      
    } catch (error) {
      this.status = 'dead';
      throw error;
    }
  }
  
  private buildStartCommand(): string[] {
    const rootfs = path.join(this.bundleDir, 'rootfs');
    const cmd = [
      'unshare',
      '--fork',
      '--pid',
      '--mount',
      '--uts',
      '--ipc',
      '--net',
      '--user',
      '--map-root-user',
      'chroot',
      rootfs
    ];
    
    // Add command or entrypoint
    const execCmd = this.config.command || this.config.entrypoint || ['/bin/sh'];
    cmd.push(...execCmd);
    
    return cmd;
  }
  
  async stop(timeout: number = 10): Promise<void> {
    if (this.status !== 'running') {
      return;
    }
    
    this.status = 'stopping';
    
    if (this.process && !this.process.killed) {
      // Send SIGTERM
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      const stopped = await this.waitForStop(timeout * 1000);
      
      if (!stopped && !this.process.killed) {
        // Force kill if not stopped
        this.process.kill('SIGKILL');
      }
    }
    
    this.status = 'stopped';
    this.finished = new Date();
  }
  
  private waitForStop(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      
      if (this.process) {
        this.process.once('exit', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      } else {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  }
  
  async pause(): Promise<void> {
    if (this.status !== 'running' || !this.pid) {
      throw new Error(`Container ${this.id} is not running`);
    }
    
    // Send SIGSTOP to pause the process
    try {
      process.kill(this.pid, 'SIGSTOP');
      this.status = 'paused';
    } catch (error) {
      throw new Error(`Failed to pause container: ${error}`);
    }
  }
  
  async unpause(): Promise<void> {
    if (this.status !== 'paused' || !this.pid) {
      throw new Error(`Container ${this.id} is not paused`);
    }
    
    // Send SIGCONT to resume the process
    try {
      process.kill(this.pid, 'SIGCONT');
      this.status = 'running';
    } catch (error) {
      throw new Error(`Failed to unpause container: ${error}`);
    }
  }
  
  async remove(): Promise<void> {
    if (this.status === 'running') {
      await this.stop();
    }
    
    // Close log stream
    if (this.logStream) {
      await this.logStream.close();
    }
    
    // Remove cgroup
    if (this.cgroupPath) {
      try {
        await fs.rmdir(this.cgroupPath);
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Remove container directory
    try {
      await fs.rm(this.bundleDir, { recursive: true, force: true });
    } catch (error) {
      logger.error(`Failed to remove container directory: ${error}`);
    }
  }
  
  async exec(command: string[]): Promise<ExecResult> {
    if (this.status !== 'running') {
      throw new Error(`Container ${this.id} is not running`);
    }
    
    const rootfs = path.join(this.bundleDir, 'rootfs');
    
    return new Promise((resolve, reject) => {
      const proc = spawn('chroot', [rootfs, ...command]);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => stdout += data);
      proc.stderr.on('data', (data) => stderr += data);
      
      proc.on('exit', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr
        });
      });
      
      proc.on('error', reject);
    });
  }
  
  async getLogs(tail?: number): Promise<string> {
    try {
      const logs = await fs.readFile(this.logPath, 'utf-8');
      
      if (tail) {
        const lines = logs.split('\n');
        return lines.slice(-tail).join('\n');
      }
      
      return logs;
    } catch (error) {
      return '';
    }
  }
  
  async wait(): Promise<number> {
    if (this.status === 'stopped' || this.status === 'dead') {
      return this.exitCode || 0;
    }
    
    return new Promise((resolve) => {
      if (this.process) {
        this.process.once('exit', (code) => {
          resolve(code || 0);
        });
      } else {
        resolve(0);
      }
    });
  }
  
  async getResourceUsage(): Promise<ResourceUsage> {
    const usage: ResourceUsage = {
      cpuPercent: 0,
      memoryUsage: 0,
      memoryLimit: this.config.memoryLimit || 0,
      networkRx: 0,
      networkTx: 0,
      blockRead: 0,
      blockWrite: 0
    };
    
    if (this.status !== 'running' || !this.cgroupPath) {
      return usage;
    }
    
    try {
      // Read memory usage
      const memoryCurrent = await fs.readFile(
        path.join(this.cgroupPath, 'memory.current'),
        'utf-8'
      );
      usage.memoryUsage = parseInt(memoryCurrent) / 1024 / 1024; // Convert to MB
      
      // Read CPU usage
      const cpuStat = await fs.readFile(
        path.join(this.cgroupPath, 'cpu.stat'),
        'utf-8'
      );
      // Parse CPU usage from cgroup stats
      
    } catch (error) {
      // Return default values on error
    }
    
    return usage;
  }
  
  getInfo(): ContainerInfo {
    return {
      id: this.id,
      name: this.config.name,
      image: this.config.image,
      status: this.status,
      created: this.created,
      started: this.started,
      finished: this.finished,
      exitCode: this.exitCode,
      pid: this.pid,
      resourceUsage: {
        cpuPercent: 0,
        memoryUsage: 0,
        memoryLimit: this.config.memoryLimit || 0,
        networkRx: 0,
        networkTx: 0,
        blockRead: 0,
        blockWrite: 0
      }
    };
  }
  
  getStatus(): ContainerStatus {
    return this.status;
  }
}

// Export singleton instance
export const containerRuntime = new ECodeContainerRuntime();