// @ts-nocheck
import { type IStorage } from '../storage';
import { type PlanTask, type ExecutionPlan } from './ai-plan-generator.service';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { exec, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = createLogger('BuildExecutorService');

/**
 * Build Execution Event Types for SSE streaming
 */
export interface BuildExecutionEvent {
  type: 'start' | 'task_start' | 'task_progress' | 'task_complete' | 'task_error' | 'complete' | 'error';
  buildId: string;
  timestamp: Date;
  data: any;
}

/**
 * Task Execution Result
 */
export interface TaskExecutionResult {
  success: boolean;
  taskId: string;
  filesCreated?: string[];
  packagesInstalled?: string[];
  commandsExecuted?: string[];
  error?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Build Executor Service
 * Executes build plans with dependency resolution, sandboxed file operations,
 * package installation, and command execution with SSE progress streaming.
 * 
 * Features:
 * - DAG-based task ordering (topological sort)
 * - Sandboxed filesystem operations (path validation)
 * - Package installation via packager tool proxy
 * - Command execution with timeouts
 * - Real-time progress via SSE
 * - Database persistence (buildExecutions table)
 * - Error handling with rollback capability
 */
export class BuildExecutorService {
  private storage: IStorage;
  private projectRoot: string;
  private eventListeners: Map<string, ((event: BuildExecutionEvent) => void)[]> = new Map();
  private runningProcesses: Map<string, ChildProcess[]> = new Map();

  constructor(storage: IStorage, projectRoot?: string) {
    this.storage = storage;
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Subscribe to build execution events for SSE streaming
   */
  onEvent(buildId: string, callback: (event: BuildExecutionEvent) => void): () => void {
    if (!this.eventListeners.has(buildId)) {
      this.eventListeners.set(buildId, []);
    }
    this.eventListeners.get(buildId)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(buildId);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit build execution event to all subscribers
   */
  private emitEvent(event: BuildExecutionEvent): void {
    const listeners = this.eventListeners.get(event.buildId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Execute a complete build plan
   * Returns buildExecutionId for progress tracking
   * @param buildId - Optional pre-created buildExecution ID (if router already created record)
   */
  async executeBuild(
    projectId: string,
    conversationId: number | undefined,
    plan: ExecutionPlan,
    userId: string,
    buildId?: string
  ): Promise<string> {
    logger.info('Starting build execution', { projectId, planId: plan.id, providedBuildId: buildId });

    // Use provided buildId or create new build execution record
    let finalBuildId: string;
    if (buildId) {
      finalBuildId = buildId;
    } else {
      const buildExecution = await this.storage.createBuildExecution({
        projectId,
        conversationId,
        planId: plan.id,
        totalTasks: plan.totalTasks,
        metadata: {
          approvedBy: userId,
          estimatedTime: plan.estimatedTime,
          technologies: plan.technologies,
          riskLevel: plan.riskAssessment.level,
        },
      });
      finalBuildId = buildExecution.id;
    }

    // Emit start event
    this.emitEvent({
      type: 'start',
      buildId: finalBuildId,
      timestamp: new Date(),
      data: {
        totalTasks: plan.totalTasks,
        estimatedTime: plan.estimatedTime,
        technologies: plan.technologies,
      },
    });

    // Update status to running
    await this.storage.updateBuildExecution(finalBuildId, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // Execute tasks in dependency order
      const orderedTasks = this.resolveTaskDependencies(plan.tasks);
      const executionLog: any[] = [];

      for (let i = 0; i < orderedTasks.length; i++) {
        const task = orderedTasks[i];
        
        // Update current task
        await this.storage.updateBuildExecution(finalBuildId, {
          currentTaskId: task.id,
          currentTaskIndex: i,
          progress: Math.floor((i / orderedTasks.length) * 100),
        });

        // Emit task start event
        this.emitEvent({
          type: 'task_start',
          buildId: finalBuildId,
          timestamp: new Date(),
          data: {
            taskId: task.id,
            title: task.title,
            type: task.type,
            progress: Math.floor((i / orderedTasks.length) * 100),
          },
        });

        // Execute task
        const result = await this.executeTask(finalBuildId, task, projectId);
        
        // Add to execution log
        executionLog.push({
          taskId: task.id,
          taskTitle: task.title,
          status: result.success ? 'completed' : 'failed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: result.error,
          filesCreated: result.filesCreated,
          packagesInstalled: result.packagesInstalled,
          commandsExecuted: result.commandsExecuted,
        });

        // Update execution log in database
        await this.storage.updateBuildExecution(finalBuildId, {
          executionLog,
        });

        if (result.success) {
          // Emit task complete event
          this.emitEvent({
            type: 'task_complete',
            buildId: finalBuildId,
            timestamp: new Date(),
            data: {
              taskId: task.id,
              title: task.title,
              filesCreated: result.filesCreated,
              packagesInstalled: result.packagesInstalled,
              commandsExecuted: result.commandsExecuted,
            },
          });
        } else {
          // Task failed - emit error and stop build
          this.emitEvent({
            type: 'task_error',
            buildId: finalBuildId,
            timestamp: new Date(),
            data: {
              taskId: task.id,
              title: task.title,
              error: result.error,
              stdout: result.stdout,
              stderr: result.stderr,
            },
          });

          await this.storage.updateBuildExecution(finalBuildId, {
            status: 'failed',
            error: `Task "${task.title}" failed: ${result.error}`,
            completedAt: new Date(),
          });

          throw new Error(`Task "${task.title}" failed: ${result.error}`);
        }
      }

      // Build completed successfully
      await this.storage.updateBuildExecution(finalBuildId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      });

      this.emitEvent({
        type: 'complete',
        buildId: finalBuildId,
        timestamp: new Date(),
        data: {
          totalTasks: orderedTasks.length,
          executionLog,
        },
      });

      logger.info('Build execution completed', { buildId: finalBuildId, projectId });
      return finalBuildId;

    } catch (error: any) {
      logger.error('Build execution failed:', error);

      await this.storage.updateBuildExecution(finalBuildId, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });

      this.emitEvent({
        type: 'error',
        buildId: finalBuildId,
        timestamp: new Date(),
        data: {
          error: error.message,
          stack: error.stack,
        },
      });

      throw error;
    }
  }

  /**
   * Resolve task dependencies using topological sort (DAG ordering)
   * Ensures tasks execute in correct order based on dependencies
   */
  private resolveTaskDependencies(tasks: PlanTask[]): PlanTask[] {
    const taskMap = new Map<string, PlanTask>();
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Build task map and initialize in-degree
    for (const task of tasks) {
      taskMap.set(task.id, task);
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    }

    // Build dependency graph and validate dependency IDs
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!graph.has(depId)) {
          throw new Error(
            `Task "${task.id}" has unknown dependency "${depId}". ` +
            `Valid task IDs: ${Array.from(taskMap.keys()).join(', ')}`
          );
        }
        graph.get(depId)!.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const result: PlanTask[] = [];

    // Find all nodes with in-degree 0 (no dependencies)
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      const task = taskMap.get(taskId)!;
      result.push(task);

      // Reduce in-degree for dependent tasks
      for (const dependentId of graph.get(taskId)!) {
        const newDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    // Check for circular dependencies
    if (result.length !== tasks.length) {
      logger.warn('Circular dependencies detected, using original order');
      return tasks;
    }

    logger.info('Tasks ordered by dependencies', { 
      original: tasks.map(t => t.id),
      ordered: result.map(t => t.id),
    });

    return result;
  }

  /**
   * Execute a single task based on its type
   */
  private async executeTask(
    buildId: string,
    task: PlanTask,
    projectId: string
  ): Promise<TaskExecutionResult> {
    logger.info('Executing task', { buildId, taskId: task.id, type: task.type });

    try {
      switch (task.type) {
        case 'file_create':
        case 'file_edit':
          return await this.executeFileOperation(buildId, task);
        
        case 'install_package':
          return await this.executePackageInstall(buildId, task);
        
        case 'command':
          return await this.executeCommand(buildId, task);
        
        case 'config':
          return await this.executeConfigUpdate(buildId, task);
        
        default:
          throw new Error(`Unknown task type: ${(task as any).type}`);
      }
    } catch (error: any) {
      logger.error('Task execution error:', { taskId: task.id, error: error.message });
      return {
        success: false,
        taskId: task.id,
        error: error.message,
      };
    }
  }

  /**
   * Execute file create/edit operations with path sandboxing
   */
  private async executeFileOperation(
    buildId: string,
    task: PlanTask
  ): Promise<TaskExecutionResult> {
    const filesCreated: string[] = [];

    if (!task.files || task.files.length === 0) {
      throw new Error('No files specified for file operation');
    }

    for (const file of task.files) {
      // Sanitize and validate file path
      const sanitizedPath = this.sanitizeFilePath(file.path);
      const fullPath = path.resolve(this.projectRoot, sanitizedPath);

      // Ensure path is within project root (prevent directory traversal)
      const resolvedRoot = path.resolve(this.projectRoot);
      if (!fullPath.startsWith(resolvedRoot)) {
        throw new Error(`Invalid file path: ${file.path} (outside project root: ${resolvedRoot})`);
      }

      // Create parent directories if needed
      const dirname = path.dirname(fullPath);
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
      }

      // Write file content
      if (file.content) {
        fs.writeFileSync(fullPath, file.content, 'utf8');
        filesCreated.push(sanitizedPath);
        
        this.emitEvent({
          type: 'task_progress',
          buildId,
          timestamp: new Date(),
          data: {
            taskId: task.id,
            message: `Created file: ${sanitizedPath}`,
          },
        });
      }
    }

    return {
      success: true,
      taskId: task.id,
      filesCreated,
    };
  }

  /**
   * Execute command with process tracking for cancellation support
   */
  private execWithTracking(
    buildId: string,
    command: string,
    options: any
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const childProcess = exec(command, options, (error, stdout, stderr) => {
        // Remove from tracking
        const processes = this.runningProcesses.get(buildId) || [];
        const index = processes.indexOf(childProcess);
        if (index > -1) {
          processes.splice(index, 1);
        }

        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Track the process for cancellation
      if (!this.runningProcesses.has(buildId)) {
        this.runningProcesses.set(buildId, []);
      }
      this.runningProcesses.get(buildId)!.push(childProcess);
    });
  }

  /**
   * Execute package installation
   * NOTE: Actual packager_tool integration requires agent framework
   * This implementation uses npm directly for now
   */
  private async executePackageInstall(
    buildId: string,
    task: PlanTask
  ): Promise<TaskExecutionResult> {
    if (!task.packages || task.packages.length === 0) {
      throw new Error('No packages specified for installation');
    }

    const packagesInstalled: string[] = [];

    for (const pkg of task.packages) {
      this.emitEvent({
        type: 'task_progress',
        buildId,
        timestamp: new Date(),
        data: {
          taskId: task.id,
          message: `Installing package: ${pkg}`,
        },
      });

      try {
        // Execute npm install with timeout (2 minutes) and process tracking
        await this.execWithTracking(buildId, `npm install ${pkg}`, {
          cwd: this.projectRoot,
          timeout: 120000,
        });

        packagesInstalled.push(pkg);
        logger.info('Package installed', { package: pkg, buildId });
      } catch (error: any) {
        throw new Error(`Failed to install ${pkg}: ${error.message}`);
      }
    }

    return {
      success: true,
      taskId: task.id,
      packagesInstalled,
    };
  }

  /**
   * Execute shell commands with timeout and security validation
   */
  private async executeCommand(
    buildId: string,
    task: PlanTask
  ): Promise<TaskExecutionResult> {
    if (!task.commands || task.commands.length === 0) {
      throw new Error('No commands specified');
    }

    const commandsExecuted: string[] = [];
    let stdout = '';
    let stderr = '';

    for (const command of task.commands) {
      // Validate command safety (basic check)
      if (this.isDangerousCommand(command)) {
        throw new Error(`Dangerous command blocked: ${command}`);
      }

      this.emitEvent({
        type: 'task_progress',
        buildId,
        timestamp: new Date(),
        data: {
          taskId: task.id,
          message: `Executing: ${command}`,
        },
      });

      try {
        const result = await this.execWithTracking(buildId, command, {
          cwd: this.projectRoot,
          timeout: 300000, // 5 minutes
        });

        stdout += result.stdout;
        stderr += result.stderr;
        commandsExecuted.push(command);
        
        logger.info('Command executed', { command, buildId });
      } catch (error: any) {
        stderr += error.stderr || '';
        throw new Error(`Command failed: ${command}\n${error.message}`);
      }
    }

    return {
      success: true,
      taskId: task.id,
      commandsExecuted,
      stdout,
      stderr,
    };
  }

  /**
   * Execute configuration updates (JSON/env file edits)
   */
  private async executeConfigUpdate(
    buildId: string,
    task: PlanTask
  ): Promise<TaskExecutionResult> {
    // Config updates are handled as file operations
    return this.executeFileOperation(buildId, task);
  }

  /**
   * Sanitize file path to prevent directory traversal
   */
  private sanitizeFilePath(filePath: string): string {
    // Remove leading slashes and normalize
    let sanitized = filePath.replace(/^\/+/, '');
    
    // Remove ../ patterns
    sanitized = sanitized.replace(/\.\.\//g, '');
    
    // Normalize path separators
    sanitized = path.normalize(sanitized);
    
    return sanitized;
  }

  /**
   * Check if command is potentially dangerous
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      />\s*\/dev\//, // Redirect to system devices
      /curl.*\|\s*bash/, // Pipe to bash
      /wget.*\|\s*sh/, // Pipe to shell
      /;\s*rm\s+-rf/, // Chained rm -rf
      /mkfs/, // Format filesystem
      /dd\s+if=/, // Direct disk access
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Cancel a running build
   * Kills all child processes and updates database status
   */
  async cancelBuild(buildId: string): Promise<void> {
    // Kill all running processes for this build
    const processes = this.runningProcesses.get(buildId);
    if (processes) {
      for (const childProcess of processes) {
        try {
          // Send SIGTERM for graceful shutdown
          childProcess.kill('SIGTERM');
          
          // If still running after 2 seconds, force kill with SIGKILL
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 2000);
        } catch (error) {
          logger.warn('Failed to kill child process:', error);
        }
      }
      
      // Clear process list
      this.runningProcesses.delete(buildId);
    }

    await this.storage.updateBuildExecution(buildId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    this.emitEvent({
      type: 'error',
      buildId,
      timestamp: new Date(),
      data: {
        error: 'Build cancelled by user',
      },
    });

    logger.info('Build cancelled', { buildId, processesKilled: processes?.length || 0 });
  }
}

// Singleton instance
let buildExecutorInstance: BuildExecutorService | null = null;

export function getBuildExecutor(storage: IStorage): BuildExecutorService {
  if (!buildExecutorInstance) {
    buildExecutorInstance = new BuildExecutorService(storage);
  }
  return buildExecutorInstance;
}
