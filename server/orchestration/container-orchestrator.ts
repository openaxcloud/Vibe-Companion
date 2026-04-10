// @ts-nocheck
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { 
  containerRuntime, 
  ContainerConfig, 
  ContainerInfo, 
  ContainerStatus,
  ECodeContainerRuntime,
  ExecResult
} from './container-runtime';
import { sandboxManager } from '../sandbox/sandbox-manager';
import { networkSecurityManager } from '../sandbox/network-security';
import { clusterManager } from '../distributed/cluster-manager';
import { taskScheduler, DistributedTaskScheduler } from '../distributed/task-scheduler';

const logger = createLogger('container-orchestrator');

export interface OrchestrationConfig {
  maxContainers?: number;
  maxMemoryPerContainer?: number;
  maxCpuPerContainer?: number;
  defaultImage?: string;
  registryUrl?: string;
  schedulingStrategy?: SchedulingStrategy;
  resourceLimits?: ResourceLimits;
}

export interface ResourceLimits {
  totalMemory?: number;
  totalCpu?: number;
  totalDisk?: number;
  totalContainers?: number;
}

export type SchedulingStrategy = 'round-robin' | 'least-loaded' | 'random' | 'bin-packing';

export interface Task {
  id: string;
  projectId: string;
  userId: number;
  language: string;
  code: string;
  files: Map<string, string>;
  command: string[];
  env: Record<string, string>;
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  networkEnabled?: boolean;
  created: Date;
  status: TaskStatus;
  containerId?: string;
  result?: TaskResult;
}

export type TaskStatus = 
  | 'pending'
  | 'scheduled'
  | 'preparing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface TaskResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTime: number;
  memoryUsed: number;
  cpuUsed: number;
  filesCreated: string[];
}

export interface Node {
  id: string;
  hostname: string;
  totalMemory: number;
  totalCpu: number;
  usedMemory: number;
  usedCpu: number;
  containerCount: number;
  status: NodeStatus;
  lastHealthCheck: Date;
}

export type NodeStatus = 'ready' | 'not-ready' | 'cordoned' | 'draining';

/**
 * Container orchestrator that manages container lifecycle and task execution
 * Similar to Replit's orchestration system
 */
export class ContainerOrchestrator extends EventEmitter {
  private config: OrchestrationConfig;
  private tasks: Map<string, Task> = new Map();
  private pendingTasks: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private containerToTask: Map<string, string> = new Map();
  private nodes: Map<string, Node> = new Map();
  private scheduler?: NodeJS.Timeout;
  private runtime: ECodeContainerRuntime;
  
  constructor(config?: OrchestrationConfig) {
    super();
    this.config = {
      maxContainers: 100,
      maxMemoryPerContainer: 2048, // 2GB
      maxCpuPerContainer: 2,
      defaultImage: 'ecode-base',
      schedulingStrategy: 'least-loaded',
      resourceLimits: {
        totalMemory: 16384, // 16GB
        totalCpu: 8,
        totalDisk: 100000, // 100GB
        totalContainers: 100
      },
      ...config
    };
    
    this.runtime = containerRuntime;
    
    // Initialize with a local node
    this.registerNode({
      id: 'local',
      hostname: 'localhost',
      totalMemory: this.config.resourceLimits?.totalMemory || 16384,
      totalCpu: this.config.resourceLimits?.totalCpu || 8,
      usedMemory: 0,
      usedCpu: 0,
      containerCount: 0,
      status: 'ready',
      lastHealthCheck: new Date()
    });
  }
  
  async initialize(): Promise<void> {
    // Initialize container runtime
    await this.runtime.initialize();
    
    // Initialize network security manager
    await networkSecurityManager.initialize();
    
    // Start scheduler
    this.startScheduler();
    
    logger.info('Container orchestrator initialized');
  }
  
  /**
   * Submit a task for execution
   */
  async submitTask(
    projectId: string,
    userId: number,
    language: string,
    code: string,
    files: Record<string, string> = {},
    options: {
      command?: string[];
      env?: Record<string, string>;
      timeout?: number;
      memoryLimit?: number;
      cpuLimit?: number;
      networkEnabled?: boolean;
    } = {}
  ): Promise<string> {
    const taskId = uuidv4();
    
    const task: Task = {
      id: taskId,
      projectId,
      userId,
      language,
      code,
      files: new Map(Object.entries(files)),
      command: options.command || this.getDefaultCommand(language, code),
      env: options.env || {},
      timeout: options.timeout || 30,
      memoryLimit: options.memoryLimit || 512,
      cpuLimit: options.cpuLimit || 1,
      networkEnabled: options.networkEnabled || false,
      created: new Date(),
      status: 'pending'
    };
    
    this.tasks.set(taskId, task);
    this.pendingTasks.push(task);
    
    this.emit('task:submitted', { taskId, task });
    logger.info(`Task ${taskId} submitted for project ${projectId}`);
    
    // Trigger scheduling
    this.scheduleNextTask();
    
    return taskId;
  }
  
  /**
   * Get task status and result
   */
  async getTaskStatus(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }
  
  /**
   * Cancel a running or pending task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    if (task.status === 'pending') {
      // Remove from pending queue
      const index = this.pendingTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.pendingTasks.splice(index, 1);
      }
      task.status = 'cancelled';
      this.emit('task:cancelled', { taskId });
      return true;
    }
    
    if (task.status === 'running' && task.containerId) {
      // Stop the container
      await this.runtime.stopContainer(task.containerId);
      task.status = 'cancelled';
      this.runningTasks.delete(taskId);
      this.containerToTask.delete(task.containerId);
      this.emit('task:cancelled', { taskId });
      return true;
    }
    
    return false;
  }
  
  /**
   * Register a new node for scheduling
   */
  registerNode(node: Node): void {
    this.nodes.set(node.id, node);
    this.emit('node:registered', { nodeId: node.id, node });
  }
  
  /**
   * Remove a node from the cluster
   */
  async drainNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    
    node.status = 'draining';
    
    // Stop scheduling new tasks on this node
    // Wait for running tasks to complete
    // This would be more complex in a real distributed system
    
    this.emit('node:draining', { nodeId });
  }
  
  /**
   * Start the task scheduler
   */
  private startScheduler(): void {
    this.scheduler = setInterval(() => {
      this.scheduleNextTask();
    }, 1000); // Check every second
  }
  
  /**
   * Schedule the next pending task using distributed cluster
   */
  private async scheduleNextTask(): Promise<void> {
    if (this.pendingTasks.length === 0) {
      return;
    }
    
    // Get next task based on scheduling strategy
    const task = this.pendingTasks.shift();
    if (!task) {
      return;
    }
    
    try {
      task.status = 'scheduled';
      
      // Use distributed cluster manager for horizontal scaling
      const distributedTaskId = await clusterManager.submitTask({
        type: 'code-execution',
        payload: {
          projectId: task.projectId,
          userId: task.userId,
          language: task.language,
          code: task.code,
          files: Object.fromEntries(task.files),
          command: task.command,
          env: task.env,
          timeout: task.timeout,
          memoryLimit: task.memoryLimit,
          cpuLimit: task.cpuLimit,
          networkEnabled: task.networkEnabled
        },
        priority: this.calculateTaskPriority(task),
        requiredCapabilities: this.getRequiredCapabilities(task)
      });
      
      // Store distributed task ID for tracking
      task.containerId = distributedTaskId;
      this.runningTasks.set(task.id, task);
      
      // Monitor distributed task execution
      this.monitorDistributedTask(task.id, distributedTaskId);
      
      logger.info(`Task ${task.id} scheduled to distributed cluster as ${distributedTaskId}`);
      this.emit('task:scheduled', { taskId: task.id, distributedTaskId });
      
    } catch (error) {
      logger.error(`Failed to schedule task ${task.id}:`, String(error));
      task.status = 'failed';
      task.result = {
        exitCode: -1,
        stdout: '',
        stderr: `Scheduling error: ${error}`,
        executionTime: 0,
        memoryUsed: 0,
        cpuUsed: 0,
        filesCreated: []
      };
      this.emit('task:failed', { taskId: task.id, error });
    }
  }
  
  /**
   * Check if resources are available for new tasks
   */
  private hasResourcesAvailable(): boolean {
    const totalRunning = this.runningTasks.size;
    return totalRunning < (this.config.maxContainers || 100);
  }
  
  /**
   * Calculate task priority for distributed scheduling
   */
  private calculateTaskPriority(task: Task): number {
    let priority = 5; // Base priority
    
    // Higher priority for interactive tasks
    if (task.timeout < 10) priority += 3;
    if (task.memoryLimit < 256) priority += 2;
    
    // Language-specific priorities
    if (['javascript', 'typescript', 'python'].includes(task.language)) {
      priority += 1;
    }
    
    return Math.min(priority, 10); // Max priority is 10
  }
  
  /**
   * Get required capabilities for task execution
   */
  private getRequiredCapabilities(task: Task): string[] {
    const capabilities: string[] = ['code-execution'];
    
    // GPU requirements
    if (task.language === 'cuda' || task.language.includes('gpu')) {
      capabilities.push('gpu');
    }
    
    // High memory requirements
    if (task.memoryLimit > 2048) {
      capabilities.push('high-memory');
    }
    
    // Network access
    if (task.networkEnabled) {
      capabilities.push('network-access');
    }
    
    // Language-specific capabilities
    const languageCapabilities: Record<string, string> = {
      'rust': 'rust-toolchain',
      'go': 'go-toolchain',
      'java': 'jvm',
      'csharp': 'dotnet',
      'cpp': 'cpp-toolchain',
      'cuda': 'cuda-toolkit'
    };
    
    if (languageCapabilities[task.language]) {
      capabilities.push(languageCapabilities[task.language]);
    }
    
    return capabilities;
  }
  
  /**
   * Monitor distributed task execution
   */
  private monitorDistributedTask(localTaskId: string, distributedTaskId: string): void {
    // Set up event listeners for task updates
    const handleTaskUpdate = (update: any) => {
      if (update.taskId === distributedTaskId) {
        const localTask = this.tasks.get(localTaskId);
        if (!localTask) return;
        
        // Update local task status based on distributed task status
        switch (update.status) {
          case 'running':
            localTask.status = 'running';
            this.emit('task:started', { taskId: localTaskId });
            break;
            
          case 'completed':
            localTask.status = 'completed';
            localTask.result = {
              exitCode: update.result?.exitCode || 0,
              stdout: update.result?.stdout || '',
              stderr: update.result?.stderr || '',
              executionTime: update.result?.executionTime || 0,
              memoryUsed: update.result?.memoryUsed || 0,
              cpuUsed: update.result?.cpuUsed || 0,
              filesCreated: update.result?.filesCreated || []
            };
            this.runningTasks.delete(localTaskId);
            this.emit('task:completed', { taskId: localTaskId, task: localTask });
            clusterManager.removeListener('taskUpdate', handleTaskUpdate);
            break;
            
          case 'failed':
            localTask.status = 'failed';
            localTask.result = {
              exitCode: update.error?.exitCode || -1,
              stdout: '',
              stderr: update.error?.message || 'Task execution failed',
              executionTime: 0,
              memoryUsed: 0,
              cpuUsed: 0,
              filesCreated: []
            };
            this.runningTasks.delete(localTaskId);
            this.emit('task:failed', { taskId: localTaskId, error: update.error });
            clusterManager.removeListener('taskUpdate', handleTaskUpdate);
            break;
        }
      }
    };
    
    clusterManager.on('taskUpdate', handleTaskUpdate);
    
    // Set timeout for task monitoring
    const timeoutMs = (task.timeout || 30) * 1000;
    const timeoutId = setTimeout(() => {
      const task = this.tasks.get(localTaskId);
      if (task && (task.status === 'scheduled' || task.status === 'running')) {
        task.status = 'failed';
        task.result = {
          exitCode: -1,
          stdout: '',
          stderr: 'Task execution timeout',
          executionTime: task.timeout || 30,
          memoryUsed: 0,
          cpuUsed: 0,
          filesCreated: []
        };
        this.runningTasks.delete(localTaskId);
        this.emit('task:failed', { taskId: localTaskId, error: new Error('Timeout') });
        clusterManager.removeListener('taskUpdate', handleTaskUpdate);
      }
    }, timeoutMs);
    
    // Store timeout ID for cleanup if task completes before timeout
    (task as any).timeoutId = timeoutId;
  }
  
  /**
   * Select a node for task execution based on strategy
   */
  private selectNode(task: Task): Node | null {
    const readyNodes = Array.from(this.nodes.values())
      .filter(n => n.status === 'ready');
    
    if (readyNodes.length === 0) {
      return null;
    }
    
    switch (this.config.schedulingStrategy) {
      case 'round-robin':
        // Simple round-robin selection
        return readyNodes[0];
        
      case 'least-loaded':
        // Select node with least resource usage
        return readyNodes.reduce((min, node) => {
          const nodeLoad = (node.usedMemory / node.totalMemory) + 
                          (node.usedCpu / node.totalCpu);
          const minLoad = (min.usedMemory / min.totalMemory) + 
                         (min.usedCpu / min.totalCpu);
          return nodeLoad < minLoad ? node : min;
        });
        
      case 'bin-packing':
        // Pack tasks onto nodes to maximize utilization
        return readyNodes.find(node => 
          node.totalMemory - node.usedMemory >= (task.memoryLimit || 512) &&
          node.totalCpu - node.usedCpu >= (task.cpuLimit || 1)
        ) || null;
        
      case 'random':
      default:
        // Random selection
        // Use deterministic selection based on task ID
        const taskHash = task.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return readyNodes[taskHash % readyNodes.length];
    }
  }
  
  /**
   * Execute a task on a node
   */
  private async executeTask(task: Task, node: Node): Promise<void> {
    task.status = 'preparing';
    this.runningTasks.set(task.id, task);
    
    try {
      // Create container configuration
      const containerConfig: ContainerConfig = {
        name: `task-${task.id}`,
        image: this.getImageForLanguage(task.language),
        memoryLimit: task.memoryLimit,
        cpuQuota: (task.cpuLimit || 1) * 100000, // Convert to microseconds
        cpuPeriod: 100000, // 100ms
        networkMode: task.networkEnabled ? 'bridge' : 'none',
        env: {
          ...task.env,
          TASK_ID: task.id,
          PROJECT_ID: task.projectId,
          USER_ID: String(task.userId)
        },
        command: task.command,
        workingDir: '/workspace',
        autoRemove: true,
        // Enable Nix package management
        nixEnabled: true,
        nixProjectId: task.projectId,
        nixLanguage: task.language,
        nixPackages: task.packages || []
      };
      
      // Create sandbox for additional isolation
      const sandboxId = await sandboxManager.createSandbox({
        networkEnabled: task.networkEnabled,
        maxMemory: task.memoryLimit,
        maxCpuTime: task.timeout,
        executionTimeout: task.timeout
      });
      
      // Create container
      const containerId = await this.runtime.createContainer(containerConfig);
      task.containerId = containerId;
      this.containerToTask.set(containerId, task.id);
      
      // Prepare workspace
      await this.prepareWorkspace(containerId, task);
      
      // Update node resources
      node.usedMemory += task.memoryLimit || 512;
      node.usedCpu += task.cpuLimit || 1;
      node.containerCount++;
      
      // Start container
      task.status = 'running';
      const startTime = Date.now();
      await this.runtime.startContainer(containerId);
      
      // Wait for completion or timeout
      const exitCode = await Promise.race([
        this.runtime.waitContainer(containerId),
        this.waitForTimeout(task.timeout || 30)
      ]);
      
      // Get results
      const logs = await this.runtime.getContainerLogs(containerId);
      const executionTime = (Date.now() - startTime) / 1000;
      
      task.result = {
        exitCode: exitCode === -2 ? -1 : exitCode, // -2 indicates timeout
        stdout: this.extractStdout(logs),
        stderr: this.extractStderr(logs),
        executionTime,
        memoryUsed: 0, // Would get from container stats
        cpuUsed: 0,
        filesCreated: await this.getCreatedFiles(containerId)
      };
      
      task.status = exitCode === -2 ? 'timeout' : 'completed';
      
      // Cleanup
      await this.runtime.stopContainer(containerId).catch((err) => {
        logger.debug(`[ContainerOrchestrator] Container ${containerId} stop cleanup error (non-critical):`, err?.message);
      });
      await this.runtime.removeContainer(containerId, true);
      await sandboxManager.destroySandbox(sandboxId);
      
      // Update node resources
      node.usedMemory -= task.memoryLimit || 512;
      node.usedCpu -= task.cpuLimit || 1;
      node.containerCount--;
      
      this.emit('task:completed', { taskId: task.id, result: task.result });
      
    } catch (error) {
      logger.error(`Task ${task.id} execution failed:`, String(error));
      task.status = 'failed';
      task.result = {
        exitCode: -1,
        stdout: '',
        stderr: String(error),
        executionTime: 0,
        memoryUsed: 0,
        cpuUsed: 0,
        filesCreated: []
      };
      
      this.emit('task:failed', { taskId: task.id, error });
      
    } finally {
      this.runningTasks.delete(task.id);
      if (task.containerId) {
        this.containerToTask.delete(task.containerId);
      }
    }
  }
  
  /**
   * Prepare workspace with task files
   */
  private async prepareWorkspace(containerId: string, task: Task): Promise<void> {
    // Write main code file
    const mainFile = this.getMainFileName(task.language);
    await this.runtime.execInContainer(containerId, [
      'sh', '-c', `echo '${task.code.replace(/'/g, "'\\''")}' > /workspace/${mainFile}`
    ]);
    
    // Write additional files
    for (const [path, content] of Array.from(task.files)) {
      await this.runtime.execInContainer(containerId, [
        'sh', '-c', `mkdir -p $(dirname /workspace/${path}) && echo '${content.replace(/'/g, "'\\''")}' > /workspace/${path}`
      ]);
    }
  }
  
  /**
   * Get default command for language
   */
  private getDefaultCommand(language: string, code: string): string[] {
    const mainFile = this.getMainFileName(language);
    
    switch (language) {
      case 'python':
        return ['python', mainFile];
      case 'javascript':
      case 'typescript':
        return ['node', mainFile];
      case 'go':
        return ['go', 'run', mainFile];
      case 'rust':
        return ['cargo', 'run'];
      case 'java':
        return ['java', mainFile.replace('.java', '')];
      case 'cpp':
        return ['sh', '-c', `g++ ${mainFile} -o main && ./main`];
      case 'c':
        return ['sh', '-c', `gcc ${mainFile} -o main && ./main`];
      case 'ruby':
        return ['ruby', mainFile];
      case 'php':
        return ['php', mainFile];
      default:
        return ['sh', mainFile];
    }
  }
  
  /**
   * Get main file name for language
   */
  private getMainFileName(language: string): string {
    const extensions: Record<string, string> = {
      python: 'main.py',
      javascript: 'main.js',
      typescript: 'main.ts',
      go: 'main.go',
      rust: 'main.rs',
      java: 'Main.java',
      cpp: 'main.cpp',
      c: 'main.c',
      ruby: 'main.rb',
      php: 'main.php',
      bash: 'main.sh'
    };
    
    return extensions[language] || 'main.txt';
  }
  
  /**
   * Get container image for language
   */
  private getImageForLanguage(language: string): string {
    // In a real system, these would be pre-built images
    // For now, we use a base image and install at runtime
    const imageMap: Record<string, string> = {
      python: 'ecode-python:3.11',
      javascript: 'ecode-node:20',
      typescript: 'ecode-node:20',
      go: 'ecode-go:1.21',
      rust: 'ecode-rust:latest',
      java: 'ecode-java:17',
      cpp: 'ecode-gcc:latest',
      c: 'ecode-gcc:latest',
      ruby: 'ecode-ruby:3.2',
      php: 'ecode-php:8.2'
    };
    
    return imageMap[language] || this.config.defaultImage || 'ecode-base';
  }
  
  /**
   * Wait for timeout
   */
  private waitForTimeout(seconds: number): Promise<number> {
    return new Promise(resolve => {
      setTimeout(() => resolve(-2), seconds * 1000);
    });
  }
  
  /**
   * Extract stdout from logs
   */
  private extractStdout(logs: string): string {
    // In a real implementation, we'd separate stdout/stderr
    return logs;
  }
  
  /**
   * Extract stderr from logs
   */
  private extractStderr(logs: string): string {
    // In a real implementation, we'd separate stdout/stderr
    return '';
  }
  
  /**
   * Get list of created files
   */
  private async getCreatedFiles(containerId: string): Promise<string[]> {
    try {
      const result = await this.runtime.execInContainer(containerId, [
        'find', '/workspace', '-type', 'f', '-newer', '/workspace'
      ]);
      return result.stdout.split('\n').filter(f => f.length > 0);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return [];
    }
  }
  
  /**
   * Get cluster statistics
   */
  getClusterStats(): {
    nodes: number;
    totalMemory: number;
    usedMemory: number;
    totalCpu: number;
    usedCpu: number;
    runningTasks: number;
    pendingTasks: number;
    containers: number;
  } {
    let totalMemory = 0;
    let usedMemory = 0;
    let totalCpu = 0;
    let usedCpu = 0;
    let containers = 0;
    
    for (const node of Array.from(this.nodes.values())) {
      totalMemory += node.totalMemory;
      usedMemory += node.usedMemory;
      totalCpu += node.totalCpu;
      usedCpu += node.usedCpu;
      containers += node.containerCount;
    }
    
    return {
      nodes: this.nodes.size,
      totalMemory,
      usedMemory,
      totalCpu,
      usedCpu,
      runningTasks: this.runningTasks.size,
      pendingTasks: this.pendingTasks.length,
      containers
    };
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Stop scheduler
    if (this.scheduler) {
      clearInterval(this.scheduler);
    }
    
    // Cancel pending tasks
    for (const task of this.pendingTasks) {
      task.status = 'cancelled';
    }
    
    // Stop running tasks
    for (const [taskId, task] of Array.from(this.runningTasks)) {
      await this.cancelTask(taskId);
    }
    
    // Cleanup runtime
    await this.runtime.cleanup();
    
    logger.info('Container orchestrator shut down');
  }
}

// Export singleton instance
export const containerOrchestrator = new ContainerOrchestrator();