/**
 * Parallel File Executor Service
 * 
 * Optimizes workspace creation by executing file operations in parallel
 * based on a dependency DAG (Directed Acyclic Graph).
 * 
 * Key Features:
 * - Dependency-aware parallel execution
 * - Streaming task processing (start work before full plan is ready)
 * - Batched file writes for I/O efficiency
 * - Progress tracking and metrics
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('parallel-file-executor');

export interface FileTask {
  id: string;
  path: string;
  content?: string;
  outline?: string;
  language?: string;
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ExecutionResult {
  taskId: string;
  path: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  parallelBatches: number;
  totalDurationMs: number;
  avgTaskDurationMs: number;
  maxConcurrency: number;
}

interface TaskNode {
  task: FileTask;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ExecutionResult;
}

export class ParallelFileExecutor extends EventEmitter {
  private projectRoot: string;
  private maxConcurrency: number;
  private taskGraph: Map<string, TaskNode> = new Map();
  private pendingQueue: FileTask[] = [];
  private runningCount = 0;
  private metrics: ExecutionMetrics;
  private startTime = 0;

  constructor(projectRoot: string, maxConcurrency: number = 5) {
    super();
    this.projectRoot = projectRoot;
    this.maxConcurrency = maxConcurrency;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      parallelBatches: 0,
      totalDurationMs: 0,
      avgTaskDurationMs: 0,
      maxConcurrency
    };
  }

  /**
   * Execute file tasks in parallel respecting dependencies
   * 
   * @param tasks - Array of file tasks to execute
   * @returns Promise resolving when all tasks complete
   */
  async executeParallel(tasks: FileTask[]): Promise<ExecutionResult[]> {
    if (tasks.length === 0) {
      return [];
    }

    this.startTime = Date.now();
    this.metrics.totalTasks = tasks.length;
    this.metrics.parallelBatches = 0;

    // Build task graph
    for (const task of tasks) {
      this.taskGraph.set(task.id, {
        task,
        status: 'pending'
      });
    }

    // Find and queue ready tasks (no dependencies)
    this.queueReadyTasks();

    // Process queue until all tasks complete
    const results: ExecutionResult[] = [];
    
    while (this.hasIncompleteTasks()) {
      // Execute batch of ready tasks
      const batch = this.getNextBatch();
      
      if (batch.length === 0) {
        // Check for circular dependencies
        if (this.hasIncompleteTasks() && this.runningCount === 0) {
          logger.error('[ParallelExecutor] Circular dependency detected');
          break;
        }
        // Wait for running tasks to complete
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      this.metrics.parallelBatches++;
      logger.info(`[ParallelExecutor] Executing batch ${this.metrics.parallelBatches} with ${batch.length} tasks`);

      // Execute batch in parallel
      const batchPromises = batch.map(task => this.executeTask(task));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const task = batch[i];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.emit('task-complete', result.value);
        } else {
          const errorResult: ExecutionResult = {
            taskId: task.id,
            path: task.path,
            success: false,
            durationMs: 0,
            error: result.reason?.message || 'Unknown error'
          };
          results.push(errorResult);
          this.emit('task-error', errorResult);
        }
      }

      // Queue newly ready tasks
      this.queueReadyTasks();
    }

    // Calculate final metrics
    this.metrics.totalDurationMs = Date.now() - this.startTime;
    this.metrics.avgTaskDurationMs = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)
      : 0;

    logger.info('[ParallelExecutor] Execution complete', this.metrics);
    this.emit('complete', this.metrics);

    return results;
  }

  /**
   * Execute a single file task
   */
  private async executeTask(task: FileTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    const node = this.taskGraph.get(task.id);
    
    if (node) {
      node.status = 'running';
    }
    this.runningCount++;

    try {
      const fullPath = path.join(this.projectRoot, task.path);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // CRITICAL FIX: Only write actual content, never outline placeholders
      // Outline is descriptive metadata, not file content - writing it would corrupt files
      if (!task.content) {
        // Task has no content yet - mark as failed/pending for later content generation
        // This prevents downstream tasks from assuming the file exists
        logger.warn(`[ParallelExecutor] Task ${task.id} has no content, only outline - marking as failed`);
        
        if (node) {
          node.status = 'failed';
          this.metrics.failedTasks++;
        }
        this.runningCount--;
        
        return {
          taskId: task.id,
          path: task.path,
          success: false,
          durationMs: Date.now() - startTime,
          error: 'No content available - requires content generation'
        };
      }

      // Write actual file content
      await fs.writeFile(fullPath, task.content, 'utf-8');

      const durationMs = Date.now() - startTime;
      
      if (node) {
        node.status = 'completed';
        this.metrics.completedTasks++;
      }
      this.runningCount--;

      return {
        taskId: task.id,
        path: task.path,
        success: true,
        durationMs
      };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      if (node) {
        node.status = 'failed';
        this.metrics.failedTasks++;
      }
      this.runningCount--;

      logger.error(`[ParallelExecutor] Task ${task.id} failed:`, error);

      return {
        taskId: task.id,
        path: task.path,
        success: false,
        durationMs,
        error: error.message
      };
    }
  }

  /**
   * Find tasks with satisfied dependencies and add to queue
   */
  private queueReadyTasks(): void {
    for (const [id, node] of this.taskGraph) {
      if (node.status !== 'pending') continue;

      const allDepsComplete = node.task.dependencies.every(depId => {
        const depNode = this.taskGraph.get(depId);
        return depNode?.status === 'completed';
      });

      if (allDepsComplete) {
        // Mark as ready (will be picked up by getNextBatch)
        this.pendingQueue.push(node.task);
      }
    }

    // Sort by priority
    this.pendingQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get next batch of tasks to execute
   */
  private getNextBatch(): FileTask[] {
    const available = this.maxConcurrency - this.runningCount;
    const batch = this.pendingQueue.splice(0, available);
    return batch;
  }

  /**
   * Check if there are incomplete tasks
   */
  private hasIncompleteTasks(): boolean {
    for (const node of this.taskGraph.values()) {
      if (node.status === 'pending' || node.status === 'running') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get current execution metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Stream tasks and execute as they arrive (for streaming plan execution)
   * 
   * @param taskStream - Async iterator of tasks
   * @returns Promise resolving when all streamed tasks complete
   */
  async executeStreaming(taskStream: AsyncIterable<FileTask>): Promise<ExecutionResult[]> {
    this.startTime = Date.now();
    const allTasks: FileTask[] = [];
    const results: ExecutionResult[] = [];
    
    // Collect tasks and execute ready ones as they arrive
    for await (const task of taskStream) {
      allTasks.push(task);
      this.taskGraph.set(task.id, {
        task,
        status: 'pending'
      });
      this.metrics.totalTasks++;

      this.emit('task-received', task);

      // Check if this task can start immediately (no deps or deps complete)
      const allDepsComplete = task.dependencies.every(depId => {
        const depNode = this.taskGraph.get(depId);
        return depNode?.status === 'completed';
      });

      if (allDepsComplete && this.runningCount < this.maxConcurrency) {
        // Execute immediately without waiting
        const promise = this.executeTask(task).then(result => {
          results.push(result);
          this.emit('task-complete', result);
          this.queueReadyTasks();
        });
      }
    }

    // Wait for all remaining tasks
    while (this.hasIncompleteTasks()) {
      this.queueReadyTasks();
      const batch = this.getNextBatch();
      
      if (batch.length === 0) {
        if (this.runningCount === 0) break;
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      const batchResults = await Promise.all(batch.map(t => this.executeTask(t)));
      results.push(...batchResults);
    }

    this.metrics.totalDurationMs = Date.now() - this.startTime;
    return results;
  }
}

/**
 * Create a parallel executor for a project
 */
export function createParallelExecutor(projectRoot: string, concurrency?: number): ParallelFileExecutor {
  return new ParallelFileExecutor(projectRoot, concurrency);
}
