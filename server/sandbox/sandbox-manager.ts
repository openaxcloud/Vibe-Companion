// @ts-nocheck
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { networkSecurityManager, NetworkSecurityConfig } from './network-security';

const logger = createLogger('sandbox-manager');

export interface SandboxConfig {
  // Resource limits
  maxCpuTime?: number;        // CPU time limit in seconds
  maxMemory?: number;         // Memory limit in MB
  maxDiskSpace?: number;      // Disk space limit in MB
  maxProcesses?: number;      // Maximum number of processes
  maxFileSize?: number;       // Maximum file size in MB
  maxOpenFiles?: number;      // Maximum number of open files
  
  // Network configuration
  networkEnabled?: boolean;   // Allow network access
  allowedHosts?: string[];    // Whitelist of allowed hosts
  blockedPorts?: number[];    // Blocked network ports
  
  // Filesystem configuration
  readOnlyPaths?: string[];   // Read-only filesystem paths
  writablePaths?: string[];   // Writable filesystem paths
  tempDirSize?: number;       // Temporary directory size limit in MB
  
  // Security configuration
  allowedSyscalls?: string[]; // Allowed system calls (seccomp)
  blockedSyscalls?: string[]; // Blocked system calls
  capabilities?: string[];    // Linux capabilities to retain
  
  // User configuration
  uid?: number;              // User ID to run as
  gid?: number;              // Group ID to run as
  
  // Timeout configuration
  executionTimeout?: number;  // Maximum execution time in seconds
  idleTimeout?: number;       // Idle timeout in seconds
}

export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  filesCreated: string[];
  networkActivity: NetworkActivity[];
  securityViolations: SecurityViolation[];
}

export interface NetworkActivity {
  timestamp: Date;
  type: 'connection' | 'dns' | 'data';
  direction: 'in' | 'out';
  host?: string;
  port?: number;
  bytes?: number;
}

export interface SecurityViolation {
  timestamp: Date;
  type: 'syscall' | 'filesystem' | 'network' | 'resource';
  details: string;
  blocked: boolean;
}

export class SandboxManager extends EventEmitter {
  private sandboxes: Map<string, Sandbox> = new Map();
  private defaultConfig: SandboxConfig;

  constructor(defaultConfig?: SandboxConfig) {
    super();
    this.defaultConfig = {
      maxCpuTime: 30,
      maxMemory: 512,
      maxDiskSpace: 100,
      maxProcesses: 50,
      maxFileSize: 10,
      maxOpenFiles: 100,
      networkEnabled: false,
      executionTimeout: 60,
      idleTimeout: 10,
      uid: 65534, // nobody user
      gid: 65534, // nogroup
      ...defaultConfig
    };
  }

  async createSandbox(config?: SandboxConfig): Promise<string> {
    const sandboxId = uuidv4();
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    const sandbox = new Sandbox(sandboxId, mergedConfig);
    await sandbox.initialize();
    
    this.sandboxes.set(sandboxId, sandbox);
    this.emit('sandbox:created', { sandboxId, config: mergedConfig });
    
    return sandboxId;
  }

  async executeSandbox(
    sandboxId: string,
    command: string,
    args: string[] = [],
    env: Record<string, string> = {}
  ): Promise<SandboxResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    try {
      const result = await sandbox.execute(command, args, env);
      this.emit('sandbox:executed', { sandboxId, command, result });
      return result;
    } catch (error) {
      this.emit('sandbox:error', { sandboxId, error });
      throw error;
    }
  }

  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return;
    }

    await sandbox.cleanup();
    this.sandboxes.delete(sandboxId);
    this.emit('sandbox:destroyed', { sandboxId });
  }

  async destroyAllSandboxes(): Promise<void> {
    const promises = Array.from(this.sandboxes.keys()).map(id => 
      this.destroySandbox(id)
    );
    await Promise.all(promises);
  }

  getSandboxInfo(sandboxId: string): SandboxInfo | null {
    const sandbox = this.sandboxes.get(sandboxId);
    return sandbox ? sandbox.getInfo() : null;
  }

  listSandboxes(): SandboxInfo[] {
    return Array.from(this.sandboxes.values()).map(s => s.getInfo());
  }
}

interface SandboxInfo {
  id: string;
  created: Date;
  status: 'initialized' | 'running' | 'idle' | 'terminated';
  config: SandboxConfig;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

class Sandbox {
  private id: string;
  private config: SandboxConfig;
  private rootDir: string;
  private process?: ChildProcess;
  private created: Date;
  private status: 'initialized' | 'running' | 'idle' | 'terminated';
  private resourceMonitor?: NodeJS.Timeout;
  private networkMonitor?: NetworkMonitor;
  private securityMonitor?: SecurityMonitor;
  private networkNamespace?: string;
  
  constructor(id: string, config: SandboxConfig) {
    this.id = id;
    this.config = config;
    this.rootDir = path.join(os.tmpdir(), 'ecode-sandbox', id);
    this.created = new Date();
    this.status = 'initialized';
  }

  async initialize(): Promise<void> {
    // Create sandbox filesystem
    await this.setupFilesystem();
    
    // Setup network isolation
    if (!this.config.networkEnabled) {
      await this.setupNetworkIsolation();
    }
    
    // Setup security monitors
    this.networkMonitor = new NetworkMonitor(this.id);
    this.securityMonitor = new SecurityMonitor(this.id);
    
    // Start resource monitoring
    this.startResourceMonitoring();
  }

  private async setupFilesystem(): Promise<void> {
    // Create sandbox root directory
    await fs.mkdir(this.rootDir, { recursive: true });
    
    // Create subdirectories
    const dirs = ['bin', 'lib', 'lib64', 'usr', 'tmp', 'home', 'workspace'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.rootDir, dir), { recursive: true });
    }
    
    // Copy essential binaries and libraries
    await this.copyEssentialFiles();
    
    // Set up read-only bind mounts
    if (this.config.readOnlyPaths) {
      for (const roPath of this.config.readOnlyPaths) {
        await this.createReadOnlyMount(roPath);
      }
    }
    
    // Set permissions
    await fs.chmod(path.join(this.rootDir, 'tmp'), 0o1777);
    await fs.chmod(path.join(this.rootDir, 'workspace'), 0o755);
  }

  private async copyEssentialFiles(): Promise<void> {
    // Copy essential system files for isolated environment
    const essentialFiles = [
      '/bin/sh',
      '/bin/bash',
      '/usr/bin/env',
      '/lib/x86_64-linux-gnu/libc.so.6',
      '/lib64/ld-linux-x86-64.so.2'
    ];
    
    for (const file of essentialFiles) {
      try {
        const dest = path.join(this.rootDir, file);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(file, dest);
        await fs.chmod(dest, 0o755);
      } catch (error) {
        // Skip if file doesn't exist on host
      }
    }
  }

  private async createReadOnlyMount(sourcePath: string): Promise<void> {
    const targetPath = path.join(this.rootDir, sourcePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Create bind mount with read-only flag
    await this.runCommand('mount', [
      '--bind',
      '-o', 'ro',
      sourcePath,
      targetPath
    ]);
  }

  private async setupNetworkIsolation(): Promise<void> {
    // Initialize network security manager if not already done
    await networkSecurityManager.initialize();
    
    // Convert sandbox config to network security config
    const networkConfig: NetworkSecurityConfig = {
      enableNetworkIsolation: !this.config.networkEnabled,
      allowLoopback: true,
      allowDNS: this.config.networkEnabled || false,
      allowedPorts: this.config.blockedPorts 
        ? Array.from({length: 65535}, (_, i) => i + 1).filter(p => !this.config.blockedPorts?.includes(p))
        : [],
      allowedHosts: this.config.allowedHosts || [],
      bandwidthLimit: 10, // 10 Mbps default
      packetRateLimit: 10000, // 10k packets/sec
      connectionLimit: 100 // 100 concurrent connections
    };
    
    // Create network namespace with security policies
    const namespace = await networkSecurityManager.createNetworkNamespace(this.id, networkConfig);
    this.networkNamespace = namespace.name;
    
    // Create host-level firewall rules for additional isolation
    await networkSecurityManager.createHostFirewallRules(this.id);
    
    logger.info(`Network isolation established for sandbox ${this.id} with namespace ${namespace.name}`);
  }

  private async setupFirewallRules(): Promise<void> {
    // Setup iptables rules for network filtering
    const rules = [
      // Default policy: DROP
      ['iptables', '-P', 'OUTPUT', 'DROP'],
      ['iptables', '-P', 'INPUT', 'DROP'],
      
      // Allow loopback
      ['iptables', '-A', 'OUTPUT', '-o', 'lo', '-j', 'ACCEPT'],
      ['iptables', '-A', 'INPUT', '-i', 'lo', '-j', 'ACCEPT'],
    ];
    
    // Add allowed hosts
    if (this.config.allowedHosts) {
      for (const host of this.config.allowedHosts) {
        rules.push(['iptables', '-A', 'OUTPUT', '-d', host, '-j', 'ACCEPT']);
        rules.push(['iptables', '-A', 'INPUT', '-s', host, '-j', 'ACCEPT']);
      }
    }
    
    // Execute rules
    for (const rule of rules) {
      await this.runCommand(rule[0], rule.slice(1));
    }
  }

  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.checkResourceUsage();
    }, 1000);
  }

  private async checkResourceUsage(): Promise<void> {
    if (!this.process) return;
    
    try {
      // Check CPU usage
      const cpuUsage = await this.getCpuUsage();
      if (cpuUsage > this.config.maxCpuTime!) {
        await this.terminate('CPU time limit exceeded');
      }
      
      // Check memory usage
      const memUsage = await this.getMemoryUsage();
      if (memUsage > this.config.maxMemory! * 1024 * 1024) {
        await this.terminate('Memory limit exceeded');
      }
      
      // Check disk usage
      const diskUsage = await this.getDiskUsage();
      if (diskUsage > this.config.maxDiskSpace! * 1024 * 1024) {
        await this.terminate('Disk space limit exceeded');
      }
    } catch (error) {
      console.error('Resource monitoring error:', error);
    }
  }

  async execute(
    command: string,
    args: string[] = [],
    env: Record<string, string> = {}
  ): Promise<SandboxResult> {
    this.status = 'running';
    const startTime = Date.now();
    
    const result: SandboxResult = {
      exitCode: -1,
      stdout: '',
      stderr: '',
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      filesCreated: [],
      networkActivity: [],
      securityViolations: []
    };

    try {
      // Prepare sandbox command with all security features
      const sandboxCmd = this.buildSandboxCommand(command, args);
      
      // Execute in sandbox
      const { stdout, stderr, exitCode } = await this.runSandboxCommand(
        sandboxCmd,
        env
      );
      
      result.stdout = stdout;
      result.stderr = stderr;
      result.exitCode = exitCode;
      result.executionTime = (Date.now() - startTime) / 1000;
      
      // Collect metrics
      result.memoryUsage = await this.getMemoryUsage();
      result.cpuUsage = await this.getCpuUsage();
      result.filesCreated = await this.getCreatedFiles();
      result.networkActivity = this.networkMonitor?.getActivity() || [];
      result.securityViolations = this.securityMonitor?.getViolations() || [];
      
    } catch (error) {
      result.stderr = error instanceof Error ? error.message : String(error);
      result.exitCode = -1;
    } finally {
      this.status = 'idle';
    }

    return result;
  }

  private buildSandboxCommand(command: string, args: string[]): string[] {
    const sandboxCmd = [
      'unshare',
      '--user',
      '--pid',
      '--mount',
      '--uts',
      '--ipc',
      '--cgroup',
    ];

    // Use our pre-created network namespace if network is disabled
    if (!this.config.networkEnabled && this.networkNamespace) {
      // Instead of creating a new network namespace, use the existing one
      sandboxCmd.unshift('ip', 'netns', 'exec', this.networkNamespace);
    }

    // Add resource limits
    sandboxCmd.push(
      'prlimit',
      `--cpu=${this.config.maxCpuTime}`,
      `--as=${this.config.maxMemory! * 1024 * 1024}`,
      `--nproc=${this.config.maxProcesses}`,
      `--nofile=${this.config.maxOpenFiles}`,
      `--fsize=${this.config.maxFileSize! * 1024 * 1024}`,
      '--'
    );

    // Add timeout
    sandboxCmd.push(
      'timeout',
      `${this.config.executionTimeout}s`,
      '--'
    );

    // Add chroot
    sandboxCmd.push(
      'chroot',
      this.rootDir,
      '--'
    );

    // Add user switching
    sandboxCmd.push(
      'su',
      '-s', '/bin/sh',
      '-c', `cd /workspace && ${command} ${args.join(' ')}`,
      'nobody'
    );

    return sandboxCmd;
  }

  private async runSandboxCommand(
    cmd: string[],
    env: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      this.process = spawn(cmd[0], cmd.slice(1), {
        env: {
          ...env,
          PATH: '/usr/bin:/bin',
          HOME: '/home',
          USER: 'nobody',
          TMPDIR: '/tmp'
        },
        cwd: this.rootDir
      });

      this.process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      this.process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      this.process.on('exit', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      // Setup kill timer for timeout with proper cleanup
      const timeoutMs = (this.config.executionTimeout || 30) * 1000;
      const killTimer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
          stderr += '\nProcess killed due to timeout';
        }
      }, timeoutMs);
      
      // Clear timeout when process exits normally
      this.process.on('exit', () => {
        clearTimeout(killTimer);
      });
    });
  }

  private async runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      });
    });
  }

  private async getCpuUsage(): Promise<number> {
    if (!this.process || !this.process.pid) return 0;
    
    try {
      const stat = await fs.readFile(`/proc/${this.process.pid}/stat`, 'utf-8');
      const fields = stat.split(' ');
      const utime = parseInt(fields[13]);
      const stime = parseInt(fields[14]);
      return (utime + stime) / 100; // Convert to seconds
    } catch {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    if (!this.process || !this.process.pid) return 0;
    
    try {
      const status = await fs.readFile(`/proc/${this.process.pid}/status`, 'utf-8');
      const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
      return vmRssMatch ? parseInt(vmRssMatch[1]) * 1024 : 0;
    } catch {
      return 0;
    }
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const { stdout } = await this.runCommandOutput('du', ['-sb', this.rootDir]);
      return parseInt(stdout.split('\t')[0]);
    } catch {
      return 0;
    }
  }

  private async runCommandOutput(command: string, args: string[]): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      proc.stdout.on('data', (data) => stdout += data.toString());
      proc.on('exit', (code) => {
        if (code === 0) resolve({ stdout });
        else reject(new Error(`Command failed: ${command}`));
      });
    });
  }

  private async getCreatedFiles(): Promise<string[]> {
    const files: string[] = [];
    const workspaceDir = path.join(this.rootDir, 'workspace');
    
    try {
      const walkDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(workspaceDir, fullPath);
          
          if (entry.isFile()) {
            files.push(relativePath);
          } else if (entry.isDirectory()) {
            await walkDir(fullPath);
          }
        }
      };
      
      await walkDir(workspaceDir);
    } catch {
      // Ignore errors
    }
    
    return files;
  }

  private async terminate(reason: string): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
      this.securityMonitor?.addViolation({
        timestamp: new Date(),
        type: 'resource',
        details: reason,
        blocked: true
      });
    }
  }

  async cleanup(): Promise<void> {
    this.status = 'terminated';
    
    // Stop monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }
    
    // Kill process if still running
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
    }
    
    // Cleanup network namespace using network security manager
    if (!this.config.networkEnabled && this.networkNamespace) {
      try {
        await networkSecurityManager.destroyNetworkNamespace(this.id);
      } catch (error) {
        logger.warn(`Failed to destroy network namespace for sandbox ${this.id}: ${String(error)}`);
      }
    }
    
    // Remove sandbox directory
    try {
      await fs.rm(this.rootDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }

  getInfo(): SandboxInfo {
    return {
      id: this.id,
      created: this.created,
      status: this.status,
      config: this.config,
      resourceUsage: {
        cpu: 0, // Would be populated from monitoring
        memory: 0,
        disk: 0
      }
    };
  }
}

class NetworkMonitor {
  private activity: NetworkActivity[] = [];
  
  constructor(private sandboxId: string) {}
  
  addActivity(activity: NetworkActivity): void {
    this.activity.push(activity);
  }
  
  getActivity(): NetworkActivity[] {
    return this.activity;
  }
}

class SecurityMonitor {
  private violations: SecurityViolation[] = [];
  
  constructor(private sandboxId: string) {}
  
  addViolation(violation: SecurityViolation): void {
    this.violations.push(violation);
  }
  
  getViolations(): SecurityViolation[] {
    return this.violations;
  }
}

export const sandboxManager = new SandboxManager();