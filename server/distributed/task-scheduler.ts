// @ts-nocheck
import { EventEmitter } from 'events';
import { clusterManager, DistributedTask } from './cluster-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('task-scheduler');

export interface TaskQueue {
  name: string;
  priority: number;
  maxConcurrency: number;
  timeout?: number;
}

export interface ScheduledTask extends Omit<DistributedTask, 'id' | 'status' | 'createdAt'> {
  queue: string;
  retries?: number;
  maxRetries?: number;
  dependencies?: string[];
  schedule?: {
    cron?: string;
    interval?: number;
    delay?: number;
  };
}

export class DistributedTaskScheduler extends EventEmitter {
  private queues: Map<string, TaskQueue> = new Map();
  private runningTasks: Map<string, Set<string>> = new Map();
  private taskGraph: Map<string, Set<string>> = new Map(); // For dependency tracking
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeDefaultQueues();
    this.setupClusterEventHandlers();
  }

  private initializeDefaultQueues() {
    // High priority queue for critical operations
    this.createQueue({
      name: 'critical',
      priority: 10,
      maxConcurrency: 20,
      timeout: 30000
    });

    // Standard queue for regular tasks
    this.createQueue({
      name: 'standard',
      priority: 5,
      maxConcurrency: 50,
      timeout: 60000
    });

    // Background queue for non-urgent tasks
    this.createQueue({
      name: 'background',
      priority: 1,
      maxConcurrency: 100,
      timeout: 300000
    });

    // AI processing queue
    this.createQueue({
      name: 'ai-processing',
      priority: 7,
      maxConcurrency: 10,
      timeout: 120000
    });

    // Code execution queue
    this.createQueue({
      name: 'code-execution',
      priority: 8,
      maxConcurrency: 30,
      timeout: 180000
    });
  }

  private setupClusterEventHandlers() {
    clusterManager.on('taskCompleted', (task: DistributedTask) => {
      this.handleTaskCompletion(task);
    });

    clusterManager.on('nodeOffline', (node) => {
      logger.warn(`Node ${node.id} went offline, tasks will be redistributed`);
    });

    clusterManager.on('leaderElected', (nodeId) => {
      logger.info(`New leader elected: ${nodeId}`);
    });
  }

  createQueue(queue: TaskQueue) {
    this.queues.set(queue.name, queue);
    this.runningTasks.set(queue.name, new Set());
    logger.info(`Created queue: ${queue.name} with priority ${queue.priority}`);
  }

  async scheduleTask(task: ScheduledTask): Promise<string> {
    // Handle scheduled tasks
    if (task.schedule) {
      return this.scheduleRecurringTask(task);
    }

    // Handle immediate tasks with dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      return this.scheduleWithDependencies(task);
    }

    // Regular immediate task
    return this.submitImmediateTask(task);
  }

  private async submitImmediateTask(task: ScheduledTask): Promise<string> {
    const queue = this.queues.get(task.queue);
    if (!queue) {
      throw new Error(`Queue ${task.queue} not found`);
    }

    // Check queue concurrency
    const runningInQueue = this.runningTasks.get(task.queue)?.size || 0;
    if (runningInQueue >= queue.maxConcurrency) {
      // Queue is full, delay submission
      await this.waitForQueueSlot(task.queue);
    }

    // Submit to cluster
    const taskId = await clusterManager.submitTask({
      type: task.type,
      payload: task.payload,
      priority: queue.priority + (task.priority || 0),
      requiredCapabilities: task.requiredCapabilities
    });

    // Track running task
    this.runningTasks.get(task.queue)?.add(taskId);

    // Set timeout if specified
    if (queue.timeout) {
      setTimeout(() => {
        this.handleTaskTimeout(taskId, task.queue);
      }, queue.timeout);
    }

    return taskId;
  }

  private async scheduleRecurringTask(task: ScheduledTask): Promise<string> {
    const taskId = `recurring-${Date.now()}-${process.hrtime.bigint().toString(36).slice(0, 9)}`;

    if (task.schedule?.interval) {
      // Interval-based scheduling
      const intervalId = setInterval(() => {
        this.submitImmediateTask(task);
      }, task.schedule.interval);
      
      this.scheduledJobs.set(taskId, intervalId);
    } else if (task.schedule?.cron) {
      // Cron-based scheduling (simplified example)
      logger.info(`Cron scheduling not yet implemented for task ${taskId}`);
    } else if (task.schedule?.delay) {
      // Delayed task
      const timeoutId = setTimeout(() => {
        this.submitImmediateTask(task);
        this.scheduledJobs.delete(taskId);
      }, task.schedule.delay);
      
      this.scheduledJobs.set(taskId, timeoutId);
    }

    return taskId;
  }

  private async scheduleWithDependencies(task: ScheduledTask): Promise<string> {
    const taskId = `dep-${Date.now()}-${process.hrtime.bigint().toString(36).slice(0, 9)}`;
    
    // Build dependency graph
    this.taskGraph.set(taskId, new Set(task.dependencies));
    
    // Check if all dependencies are completed
    const allDependenciesCompleted = await this.checkDependencies(task.dependencies);
    
    if (allDependenciesCompleted) {
      // All dependencies met, submit immediately
      return this.submitImmediateTask(task);
    } else {
      // Wait for dependencies
      logger.info(`Task ${taskId} waiting for dependencies: ${task.dependencies.join(', ')}`);
      // Dependencies will trigger submission when completed
      return taskId;
    }
  }

  private async waitForQueueSlot(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const runningInQueue = this.runningTasks.get(queueName)?.size || 0;
        if (runningInQueue < queue.maxConcurrency) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  private handleTaskCompletion(task: DistributedTask) {
    // Remove from running tasks
    for (const [queueName, runningSet] of this.runningTasks) {
      runningSet.delete(task.id);
    }

    // Check if any tasks were waiting for this one
    for (const [waitingTaskId, dependencies] of this.taskGraph) {
      dependencies.delete(task.id);
      
      if (dependencies.size === 0) {
        // All dependencies completed, submit the waiting task
        logger.info(`Dependencies met for task ${waitingTaskId}, submitting`);
        this.taskGraph.delete(waitingTaskId);
        // Submit the dependent task
      }
    }

    this.emit('taskCompleted', task);
  }

  private handleTaskTimeout(taskId: string, queueName: string) {
    logger.warn(`Task ${taskId} in queue ${queueName} timed out`);
    
    // Remove from running tasks
    this.runningTasks.get(queueName)?.delete(taskId);
    
    // Emit timeout event
    this.emit('taskTimeout', taskId, queueName);
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    // In a real implementation, this would check a persistent store
    // For now, we'll assume dependencies are task IDs that need to be completed
    return true; // Simplified for now
  }

  cancelScheduledTask(taskId: string) {
    const job = this.scheduledJobs.get(taskId);
    if (job) {
      clearInterval(job);
      clearTimeout(job);
      this.scheduledJobs.delete(taskId);
      logger.info(`Cancelled scheduled task: ${taskId}`);
    }
  }

  getQueueStatus(queueName?: string) {
    if (queueName) {
      const queue = this.queues.get(queueName);
      const running = this.runningTasks.get(queueName)?.size || 0;
      
      return {
        queue,
        running,
        available: queue ? queue.maxConcurrency - running : 0
      };
    }

    // Return all queue statuses
    const statuses: any[] = [];
    for (const [name, queue] of this.queues) {
      const running = this.runningTasks.get(name)?.size || 0;
      statuses.push({
        name,
        queue,
        running,
        available: queue.maxConcurrency - running
      });
    }
    
    return statuses;
  }

  // Task type definitions for different operations
  static readonly TaskTypes = {
    CODE_EXECUTION: 'code-execution',
    AI_INFERENCE: 'ai-inference',
    FILE_OPERATION: 'file-operation',
    DATABASE_QUERY: 'database-query',
    GIT_OPERATION: 'git-operation',
    BUILD_PROJECT: 'build-project',
    DEPLOY_SERVICE: 'deploy-service',
    PACKAGE_INSTALL: 'package-install',
    SEARCH_INDEX: 'search-index',
    BACKUP_DATA: 'backup-data'
  };
}

// Singleton instance
export const taskScheduler = new DistributedTaskScheduler();