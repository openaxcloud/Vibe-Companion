import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { checkpointService } from './checkpoint-service';
// import { db } from '../db';
// import { agentTasks } from '@shared/schema';
// import { eq, desc } from 'drizzle-orm';

const logger = createLogger('AgentProgressService');

export interface ProgressEvent {
  taskId: string;
  type: 'status' | 'step' | 'log' | 'error' | 'complete';
  data: {
    status?: 'pending' | 'running' | 'success' | 'error' | 'paused';
    step?: {
      name: string;
      description: string;
      progress: number;
      total: number;
    };
    log?: {
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      timestamp: Date;
    };
    error?: {
      message: string;
      stack?: string;
      recoverable: boolean;
    };
    metrics?: {
      filesModified: number;
      linesWritten: number;
      testsRun?: number;
      testsPassed?: number;
      executionTime: number;
      tokensUsed: number;
    };
  };
  timestamp: Date;
}

export interface AgentTask {
  id: string;
  projectId: number;
  userId: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'paused';
  steps: Array<{
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
    progress: number;
    total: number;
    startTime?: Date;
    endTime?: Date;
    output?: string;
    error?: string;
  }>;
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: Date;
  }>;
  metrics: {
    filesModified: number;
    linesWritten: number;
    testsRun: number;
    testsPassed: number;
    executionTime: number;
    tokensUsed: number;
    estimatedCost: number;
  };
  startTime: Date;
  endTime?: Date;
  pausedAt?: Date;
  error?: string;
}

export class AgentProgressService extends EventEmitter {
  private tasks: Map<string, AgentTask> = new Map();
  private activeTasksByProject: Map<number, Set<string>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent connections
  }

  async createTask(params: {
    projectId: number;
    userId: number;
    title: string;
    description: string;
    estimatedSteps?: number;
  }): Promise<AgentTask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: AgentTask = {
      id: taskId,
      projectId: params.projectId,
      userId: params.userId,
      title: params.title,
      description: params.description,
      status: 'pending',
      steps: [],
      logs: [],
      metrics: {
        filesModified: 0,
        linesWritten: 0,
        testsRun: 0,
        testsPassed: 0,
        executionTime: 0,
        tokensUsed: 0,
        estimatedCost: 0
      },
      startTime: new Date()
    };

    this.tasks.set(taskId, task);
    
    // Track active tasks by project
    if (!this.activeTasksByProject.has(params.projectId)) {
      this.activeTasksByProject.set(params.projectId, new Set());
    }
    this.activeTasksByProject.get(params.projectId)!.add(taskId);

    // In-memory storage only for now
    // Database integration will be added when tables are created

    logger.info(`Created new agent task: ${taskId}`);
    this.emitProgress(taskId, 'status', { status: 'pending' });

    return task;
  }

  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'running';
    task.startTime = new Date();

    await this.updateTaskInDatabase(taskId);
    this.emitProgress(taskId, 'status', { status: 'running' });
    
    logger.info(`Started task: ${taskId}`);
  }

  async addStep(taskId: string, step: {
    name: string;
    description: string;
    total?: number;
  }): Promise<string> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const stepId = `step_${task.steps.length + 1}`;
    const newStep = {
      id: stepId,
      name: step.name,
      description: step.description,
      status: 'pending' as const,
      progress: 0,
      total: step.total || 100,
      startTime: undefined,
      endTime: undefined
    };

    task.steps.push(newStep);
    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'step', {
      step: {
        name: step.name,
        description: step.description,
        progress: 0,
        total: newStep.total
      }
    });

    logger.info(`Added step ${stepId} to task ${taskId}: ${step.name}`);
    return stepId;
  }

  async updateStepProgress(taskId: string, stepId: string, progress: number, output?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const step = task.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in task ${taskId}`);
    }

    step.progress = Math.min(progress, step.total);
    
    if (progress > 0 && !step.startTime) {
      step.startTime = new Date();
      step.status = 'running';
    }

    if (output) {
      step.output = output;
    }

    if (progress >= step.total) {
      step.status = 'success';
      step.endTime = new Date();
    }

    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'step', {
      step: {
        name: step.name,
        description: step.description,
        progress: step.progress,
        total: step.total
      }
    });
  }

  async completeStep(taskId: string, stepId: string, output?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const step = task.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in task ${taskId}`);
    }

    step.status = 'success';
    step.progress = step.total;
    step.endTime = new Date();
    
    if (output) {
      step.output = output;
    }

    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'step', {
      step: {
        name: step.name,
        description: step.description,
        progress: step.total,
        total: step.total
      }
    });

    logger.info(`Completed step ${stepId} in task ${taskId}`);
  }

  async failStep(taskId: string, stepId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const step = task.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in task ${taskId}`);
    }

    step.status = 'error';
    step.error = error;
    step.endTime = new Date();

    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'error', {
      error: {
        message: `Step failed: ${error}`,
        recoverable: true
      }
    });

    logger.error(`Step ${stepId} failed in task ${taskId}: ${error}`);
  }

  async addLog(taskId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const log = {
      level,
      message,
      timestamp: new Date()
    };

    task.logs.push(log);

    // Keep only last 1000 logs
    if (task.logs.length > 1000) {
      task.logs = task.logs.slice(-1000);
    }

    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'log', { log });
  }

  async updateMetrics(taskId: string, metrics: Partial<AgentTask['metrics']>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    Object.assign(task.metrics, metrics);

    // Calculate estimated cost based on tokens
    if (metrics.tokensUsed) {
      task.metrics.estimatedCost = Math.ceil(metrics.tokensUsed * 0.00003 * 100); // cents
    }

    await this.updateTaskInDatabase(taskId);

    this.emitProgress(taskId, 'status', { metrics: task.metrics });
  }

  async pauseTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'running') {
      throw new Error(`Cannot pause task in ${task.status} state`);
    }

    task.status = 'paused';
    task.pausedAt = new Date();

    await this.updateTaskInDatabase(taskId);
    this.emitProgress(taskId, 'status', { status: 'paused' });

    logger.info(`Paused task: ${taskId}`);
  }

  async resumeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'paused') {
      throw new Error(`Cannot resume task in ${task.status} state`);
    }

    task.status = 'running';
    task.pausedAt = undefined;

    await this.updateTaskInDatabase(taskId);
    this.emitProgress(taskId, 'status', { status: 'running' });

    logger.info(`Resumed task: ${taskId}`);
  }

  async completeTask(taskId: string, finalMetrics?: Partial<AgentTask['metrics']>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'success';
    task.endTime = new Date();
    
    if (finalMetrics) {
      Object.assign(task.metrics, finalMetrics);
    }

    // Calculate total execution time
    task.metrics.executionTime = task.endTime.getTime() - task.startTime.getTime();

    // Remove from active tasks
    if (this.activeTasksByProject.has(task.projectId)) {
      this.activeTasksByProject.get(task.projectId)!.delete(taskId);
    }

    await this.updateTaskInDatabase(taskId);
    this.emitProgress(taskId, 'complete', { metrics: task.metrics });

    // Create checkpoint for billing
    await checkpointService.createAgentCheckpoint(
      task.projectId,
      task.userId,
      `Completed agent task: ${task.title}`,
      { taskId: task.id, metrics: task.metrics }
    );

    logger.info(`Completed task: ${taskId}`);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'error';
    task.error = error;
    task.endTime = new Date();

    // Remove from active tasks
    if (this.activeTasksByProject.has(task.projectId)) {
      this.activeTasksByProject.get(task.projectId)!.delete(taskId);
    }

    await this.updateTaskInDatabase(taskId);
    this.emitProgress(taskId, 'error', {
      error: {
        message: error,
        recoverable: false
      }
    });

    logger.error(`Task ${taskId} failed: ${error}`);
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  getProjectTasks(projectId: number): AgentTask[] {
    const taskIds = this.activeTasksByProject.get(projectId) || new Set();
    return Array.from(taskIds).map(id => this.tasks.get(id)!).filter(Boolean);
  }

  async loadRecentTasks(projectId: number, limit: number = 10): Promise<AgentTask[]> {
    // Return tasks from memory for now
    const tasks = this.getProjectTasks(projectId);
    return tasks.slice(0, limit);
  }

  private emitProgress(taskId: string, type: ProgressEvent['type'], data: ProgressEvent['data']): void {
    const event: ProgressEvent = {
      taskId,
      type,
      data,
      timestamp: new Date()
    };

    this.emit('progress', event);
    this.emit(`task:${taskId}`, event);
  }

  private async updateTaskInDatabase(taskId: string): Promise<void> {
    // In-memory only for now
    // Database updates will be added when tables are created
  }

  // WebSocket connection handler
  handleWebSocketConnection(ws: any, projectId: number): void {
    // Send current tasks on connection
    const tasks = this.getProjectTasks(projectId);
    ws.send(JSON.stringify({
      type: 'initial',
      tasks
    }));

    // Listen for progress events
    const progressHandler = (event: ProgressEvent) => {
      const task = this.tasks.get(event.taskId);
      if (task && task.projectId === projectId) {
        ws.send(JSON.stringify(event));
      }
    };

    this.on('progress', progressHandler);

    ws.on('close', () => {
      this.off('progress', progressHandler);
    });
  }
}

export const agentProgressService = new AgentProgressService();