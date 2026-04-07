/**
 * Max Autonomy Service
 * 
 * Manages 200+ minute autonomous sessions with:
 * - Task queue with priority system
 * - Auto-execution loop with configurable intervals
 * - Progress tracking (tasks completed, time elapsed, errors)
 * - Pause/Resume functionality
 * - Session state persistence to database
 * - Integration with checkpoint, testing, and rollback services
 */

import { EventEmitter } from 'events';
import { db } from '../db';
import {
  maxAutonomySessions,
  maxAutonomyTasks,
  agentSessions,
  type MaxAutonomySession,
  type MaxAutonomyTask,
  type RiskThreshold
} from '@shared/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { CheckpointService } from './checkpoint-service';
import { BackgroundTestingService } from './background-testing-service';
import { AutonomyTaskExecutor, type TaskExecutionResult } from './autonomy-task-executor';
import { orchestratorMetrics, type TaskMetric } from './orchestrator-metrics.service';
import crypto from 'crypto';

const logger = createLogger('MaxAutonomyService');

export interface MaxAutonomySessionOptions {
  userId: number;
  projectId: number;
  goal: string;
  model?: string;
  maxDurationMinutes?: number;
  executionIntervalMs?: number;
  autoCheckpoint?: boolean;
  autoTest?: boolean;
  autoRollback?: boolean;
  riskThreshold?: RiskThreshold;
}

export interface CurrentTaskDelegation {
  tier: 'fast' | 'balanced' | 'quality';
  model: string;
  provider: string;
  reason?: string;
  taskComplexity?: number;
  estimatedTokens?: number;
}

export interface SessionProgress {
  sessionId: string;
  status: string;
  goal: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  tasksPending: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  checkpointsCreated: number;
  rollbacksPerformed: number;
  testsRun: number;
  testsPassed: number;
  totalTokensUsed: number;
  totalCostUsd: string;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
  etaConfidence: number;
  etaBasedOnSamples: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  // Orchestrator delegation info for current/last task
  currentTaskDelegation?: CurrentTaskDelegation;
}

export interface TaskQueueItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  order: number;
  dependencies: string[];
  retryCount: number;
  estimatedDurationMs: number | null;
}

class MaxAutonomyService extends EventEmitter {
  private activeSessions: Map<string, {
    intervalId: NodeJS.Timeout | null;
    isPaused: boolean;
    executor: AutonomyTaskExecutor;
  }> = new Map();
  
  private checkpointService: CheckpointService;
  private testingService: BackgroundTestingService;
  
  constructor() {
    super();
    this.checkpointService = new CheckpointService();
    this.testingService = new BackgroundTestingService();
    
    this.testingService.on('test:completed', this.handleTestCompleted.bind(this));
    this.testingService.on('test:failed', this.handleTestFailed.bind(this));
    
    logger.info('Max Autonomy Service initialized');
  }
  
  /**
   * Start a new autonomous session
   */
  async startSession(options: MaxAutonomySessionOptions): Promise<MaxAutonomySession> {
    const startTime = Date.now();
    logger.info(`Starting Max Autonomy session for user ${options.userId}, project ${options.projectId}`);
    
    try {
      const [agentSession] = await db.insert(agentSessions).values({
        userId: options.userId,
        projectId: options.projectId,
        sessionToken: `max-autonomy-${crypto.randomUUID()}`,
        model: options.model || 'gpt-4.1',
        isActive: true,
        autonomousMode: true,
        riskThreshold: options.riskThreshold || 'medium',
        autoApproveActions: true,
        workflowStatus: 'executing',
        context: {
          files: [],
          workingDirectory: '/',
          environment: {},
          capabilities: ['file_operations', 'command_execution', 'testing', 'deployment']
        }
      }).returning();
      
      const [session] = await db.insert(maxAutonomySessions).values({
        userId: options.userId,
        projectId: options.projectId,
        agentSessionId: agentSession.id,
        goal: options.goal,
        status: 'pending',
        maxDurationMinutes: options.maxDurationMinutes || 240,
        executionIntervalMs: options.executionIntervalMs || 2000,
        autoCheckpoint: options.autoCheckpoint !== false,
        autoTest: options.autoTest !== false,
        autoRollback: options.autoRollback !== false,
        riskThreshold: options.riskThreshold || 'medium',
        metadata: {
          model: options.model || 'gpt-4.1',
          conversationHistory: [],
          executionLog: [{
            timestamp: new Date().toISOString(),
            event: 'session_created',
            details: { goal: options.goal }
          }]
        }
      }).returning();
      
      const executor = new AutonomyTaskExecutor({
        sessionId: session.id,
        projectId: options.projectId,
        userId: options.userId,
        model: options.model || 'gpt-4.1',
        checkpointService: this.checkpointService,
        testingService: this.testingService
      });
      
      this.activeSessions.set(session.id, {
        intervalId: null,
        isPaused: false,
        executor
      });
      
      await this.decomposeGoalIntoTasks(session.id, options.goal);
      
      await this.beginExecution(session.id);
      
      const [updatedSession] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, session.id));
      
      this.emit('session:started', { sessionId: session.id, session: updatedSession });
      logger.info(`Max Autonomy session ${session.id} started in ${Date.now() - startTime}ms`);
      
      return updatedSession;
    } catch (error: any) {
      logger.error('Failed to start Max Autonomy session:', error);
      throw new Error(`Failed to start autonomous session: ${error.message}`);
    }
  }
  
  /**
   * Decompose user goal into actionable tasks using AI
   */
  private async decomposeGoalIntoTasks(sessionId: string, goal: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('Session not found');
    }
    
    logger.info(`Decomposing goal into tasks for session ${sessionId}`);
    
    try {
      const tasks = await activeSession.executor.decomposeGoal(goal);
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await db.insert(maxAutonomyTasks).values({
          sessionId,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority || 'medium',
          status: 'pending',
          order: i,
          dependencies: task.dependencies || [],
          input: task.input,
          requiresCheckpoint: task.requiresCheckpoint || false,
          requiresTest: task.requiresTest || false,
          estimatedDurationMs: task.estimatedDurationMs,
          complexityScore: task.complexityScore,
          confidenceScore: task.confidenceScore,
          estimatedTokens: task.estimatedTokens
        });
      }
      
      await db.update(maxAutonomySessions)
        .set({
          tasksTotal: tasks.length,
          updatedAt: new Date()
        })
        .where(eq(maxAutonomySessions.id, sessionId));
      
      logger.info(`Created ${tasks.length} tasks for session ${sessionId}`);
      this.emit('tasks:created', { sessionId, taskCount: tasks.length, tasks });
    } catch (error: any) {
      logger.error(`Failed to decompose goal for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Begin execution loop
   */
  private async beginExecution(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('Session not found');
    }
    
    const [session] = await db.select()
      .from(maxAutonomySessions)
      .where(eq(maxAutonomySessions.id, sessionId));
    
    if (!session) {
      throw new Error('Session not found in database');
    }
    
    await db.update(maxAutonomySessions)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    const pendingTasks = await db.select()
      .from(maxAutonomyTasks)
      .where(and(
        eq(maxAutonomyTasks.sessionId, sessionId),
        eq(maxAutonomyTasks.status, 'pending')
      ));
    
    const provider = (session.metadata as any)?.model?.includes('claude') ? 'anthropic' : 'openai';
    let totalImprovedEtaMs = 0;
    for (const task of pendingTasks) {
      const etaInfo = orchestratorMetrics.getImprovedETA(
        task.type,
        provider,
        task.estimatedDurationMs || 5000
      );
      totalImprovedEtaMs += etaInfo.adjustedEstimateMs;
    }
    logger.info(`Session ${sessionId} initial improved ETA: ${totalImprovedEtaMs}ms for ${pendingTasks.length} tasks`);
    
    const intervalMs = session.executionIntervalMs || 2000;
    const maxDurationMs = (session.maxDurationMinutes || 240) * 60 * 1000;
    const startTime = Date.now();
    
    const executeNextTask = async () => {
      try {
        const sessionState = this.activeSessions.get(sessionId);
        if (!sessionState || sessionState.isPaused) {
          return;
        }
        
        if (Date.now() - startTime > maxDurationMs) {
          logger.info(`Session ${sessionId} reached max duration, completing...`);
          await this.completeSession(sessionId, 'Max duration reached');
          return;
        }
        
        const [currentSession] = await db.select()
          .from(maxAutonomySessions)
          .where(eq(maxAutonomySessions.id, sessionId));
        
        if (!currentSession || currentSession.status !== 'running') {
          return;
        }
        
        const nextTask = await this.getNextTask(sessionId);
        
        if (!nextTask) {
          logger.info(`Session ${sessionId} has no more tasks, completing...`);
          await this.completeSession(sessionId, 'All tasks completed');
          return;
        }
        
        await this.executeTask(sessionId, nextTask);
        
      } catch (error: any) {
        logger.error(`Error in execution loop for session ${sessionId}:`, error);
        this.emit('session:error', { sessionId, error: error.message });
      }
    };
    
    await executeNextTask();
    
    activeSession.intervalId = setInterval(executeNextTask, intervalMs);
    
    logger.info(`Execution loop started for session ${sessionId} with ${intervalMs}ms interval`);
  }
  
  /**
   * Get next task to execute based on priority and dependencies
   */
  private async getNextTask(sessionId: string): Promise<MaxAutonomyTask | null> {
    const completedTasks = await db.select()
      .from(maxAutonomyTasks)
      .where(and(
        eq(maxAutonomyTasks.sessionId, sessionId),
        inArray(maxAutonomyTasks.status, ['completed', 'skipped'])
      ));
    
    const completedTaskIds = new Set(completedTasks.map(t => t.id));
    
    const pendingTasks = await db.select()
      .from(maxAutonomyTasks)
      .where(and(
        eq(maxAutonomyTasks.sessionId, sessionId),
        eq(maxAutonomyTasks.status, 'pending')
      ))
      .orderBy(
        desc(maxAutonomyTasks.priority),
        asc(maxAutonomyTasks.order)
      );
    
    for (const task of pendingTasks) {
      const dependencies = (task.dependencies as string[]) || [];
      const allDependenciesMet = dependencies.every(depId => completedTaskIds.has(depId));
      
      if (allDependenciesMet) {
        return task;
      }
    }
    
    return null;
  }
  
  /**
   * Execute a single task
   */
  private async executeTask(sessionId: string, task: MaxAutonomyTask): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('Session not found');
    }
    
    logger.info(`Executing task ${task.id}: ${task.title}`);
    
    const startTime = Date.now();
    
    await db.update(maxAutonomyTasks)
      .set({
        status: 'running',
        startedAt: new Date()
      })
      .where(eq(maxAutonomyTasks.id, task.id));
    
    await db.update(maxAutonomySessions)
      .set({
        currentTaskId: task.id,
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    this.emit('task:started', { sessionId, taskId: task.id, task });
    
    try {
      const [session] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, sessionId));
      
      if (task.requiresCheckpoint && session?.autoCheckpoint) {
        await this.createCheckpoint(sessionId, task.id, `Before: ${task.title}`);
      }
      
      const result = await activeSession.executor.executeTask(task);
      
      const actualDurationMs = Date.now() - startTime;
      
      if (result.success) {
        await db.update(maxAutonomyTasks)
          .set({
            status: 'completed',
            output: result.output,
            actualDurationMs,
            completedAt: new Date(),
            metadata: {
              ...task.metadata,
              filesModified: result.filesModified,
              commandsExecuted: result.commandsExecuted,
              aiResponse: result.aiResponse
            }
          })
          .where(eq(maxAutonomyTasks.id, task.id));
        
        await db.update(maxAutonomySessions)
          .set({
            tasksCompleted: session!.tasksCompleted! + 1,
            totalTokensUsed: (session!.totalTokensUsed || 0) + (result.tokensUsed || 0),
            currentTaskId: null,
            updatedAt: new Date()
          })
          .where(eq(maxAutonomySessions.id, sessionId));
        
        if (task.requiresTest && session?.autoTest && result.filesModified?.length) {
          await this.runTests(sessionId, task.id, result.filesModified);
        }
        
        orchestratorMetrics.recordTaskExecution({
          taskType: task.type,
          complexity: (task.metadata as any)?.complexity ?? 5,
          estimatedDurationMs: task.estimatedDurationMs ?? 5000,
          actualDurationMs: actualDurationMs || 0,
          estimatedTokens: (task.metadata as any)?.estimatedTokens ?? 0,
          actualTokens: result.tokensUsed ?? 0,
          success: true,
          provider: (session?.metadata as any)?.model?.includes('claude') ? 'anthropic' : 'openai',
          model: (session?.metadata as any)?.model || 'gpt-4.1',
          timestamp: new Date()
        });
        
        this.emit('task:completed', { sessionId, taskId: task.id, result });
        logger.info(`Task ${task.id} completed successfully in ${actualDurationMs}ms`);
        
      } else {
        const failureDurationMs = Date.now() - startTime;
        orchestratorMetrics.recordTaskExecution({
          taskType: task.type,
          complexity: (task.metadata as any)?.complexity ?? 5,
          estimatedDurationMs: task.estimatedDurationMs ?? 5000,
          actualDurationMs: failureDurationMs || 0,
          estimatedTokens: (task.metadata as any)?.estimatedTokens ?? 0,
          actualTokens: result.tokensUsed ?? 0,
          success: false,
          provider: (session?.metadata as any)?.model?.includes('claude') ? 'anthropic' : 'openai',
          model: (session?.metadata as any)?.model || 'gpt-4.1',
          timestamp: new Date()
        });
        
        await this.handleTaskFailure(sessionId, task, result, session!);
      }
      
    } catch (error: any) {
      const actualDurationMs = Date.now() - startTime;
      logger.error(`Task ${task.id} threw an error:`, error);
      
      const [session] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, sessionId));
      
      await this.handleTaskFailure(sessionId, task, {
        success: false,
        error: error.message,
        errorStack: error.stack
      }, session!);
    }
  }
  
  /**
   * Handle task failure with retry logic
   */
  private async handleTaskFailure(
    sessionId: string,
    task: MaxAutonomyTask,
    result: TaskExecutionResult,
    session: MaxAutonomySession
  ): Promise<void> {
    const retryCount = (task.retryCount || 0) + 1;
    const maxRetries = task.maxRetries || 3;
    
    if (retryCount < maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
      
      logger.info(`Task ${task.id} failed, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await db.update(maxAutonomyTasks)
        .set({
          status: 'pending',
          retryCount,
          errorMessage: result.error,
          errorStack: result.errorStack
        })
        .where(eq(maxAutonomyTasks.id, task.id));
      
      this.emit('task:retry', { sessionId, taskId: task.id, retryCount, backoffMs });
      
    } else {
      logger.error(`Task ${task.id} failed after ${maxRetries} attempts`);
      
      await db.update(maxAutonomyTasks)
        .set({
          status: 'failed',
          retryCount,
          errorMessage: result.error,
          errorStack: result.errorStack,
          completedAt: new Date()
        })
        .where(eq(maxAutonomyTasks.id, task.id));
      
      await db.update(maxAutonomySessions)
        .set({
          tasksFailed: (session.tasksFailed || 0) + 1,
          currentTaskId: null,
          updatedAt: new Date()
        })
        .where(eq(maxAutonomySessions.id, sessionId));
      
      if (session.autoRollback && task.checkpointId) {
        await this.rollbackToCheckpoint(sessionId, task.checkpointId);
      }
      
      this.emit('task:failed', { sessionId, taskId: task.id, error: result.error });
    }
  }
  
  /**
   * Create checkpoint before risky operations
   */
  private async createCheckpoint(sessionId: string, taskId: string, name: string): Promise<void> {
    try {
      const [session] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, sessionId));
      
      if (!session) return;
      
      const checkpoint = await this.checkpointService.createCheckpoint({
        projectId: session.projectId,
        name,
        description: `Auto-checkpoint for Max Autonomy task: ${taskId}`,
        type: 'before_action',
        userId: session.userId,
        includeDatabase: true,
        includeEnvironment: true
      });
      
      await db.update(maxAutonomyTasks)
        .set({ checkpointId: checkpoint.id })
        .where(eq(maxAutonomyTasks.id, taskId));
      
      await db.update(maxAutonomySessions)
        .set({
          checkpointsCreated: (session.checkpointsCreated || 0) + 1,
          lastCheckpointId: checkpoint.id,
          updatedAt: new Date()
        })
        .where(eq(maxAutonomySessions.id, sessionId));
      
      this.emit('checkpoint:created', { sessionId, taskId, checkpointId: checkpoint.id });
      logger.info(`Checkpoint ${checkpoint.id} created for task ${taskId}`);
      
    } catch (error: any) {
      logger.error(`Failed to create checkpoint for task ${taskId}:`, error);
    }
  }
  
  /**
   * Run tests after code changes
   */
  private async runTests(sessionId: string, taskId: string, changedFiles: string[]): Promise<void> {
    try {
      const [session] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, sessionId));
      
      if (!session) return;
      
      await this.testingService.scheduleTest(session.projectId, changedFiles);
      
      await db.update(maxAutonomySessions)
        .set({
          testsRun: (session.testsRun || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(maxAutonomySessions.id, sessionId));
      
      this.emit('tests:scheduled', { sessionId, taskId, changedFiles });
      
    } catch (error: any) {
      logger.error(`Failed to schedule tests for task ${taskId}:`, error);
    }
  }
  
  /**
   * Handle test completion
   */
  private async handleTestCompleted(data: { projectId: number; job: any; results: any }): Promise<void> {
    const sessions = await db.select()
      .from(maxAutonomySessions)
      .where(and(
        eq(maxAutonomySessions.projectId, data.projectId),
        eq(maxAutonomySessions.status, 'running')
      ));
    
    for (const session of sessions) {
      if (data.results.passed) {
        await db.update(maxAutonomySessions)
          .set({
            testsPassed: (session.testsPassed || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(maxAutonomySessions.id, session.id));
        
        this.emit('tests:passed', { sessionId: session.id, results: data.results });
      } else {
        if (session.autoRollback && session.lastCheckpointId) {
          await this.rollbackToCheckpoint(session.id, session.lastCheckpointId);
        }
        
        this.emit('tests:failed', { sessionId: session.id, results: data.results });
      }
    }
  }
  
  /**
   * Handle test failure
   */
  private async handleTestFailed(data: { projectId: number; job: any; error: any }): Promise<void> {
    const sessions = await db.select()
      .from(maxAutonomySessions)
      .where(and(
        eq(maxAutonomySessions.projectId, data.projectId),
        eq(maxAutonomySessions.status, 'running')
      ));
    
    for (const session of sessions) {
      this.emit('tests:error', { sessionId: session.id, error: data.error });
    }
  }
  
  /**
   * Rollback to a checkpoint
   */
  private async rollbackToCheckpoint(sessionId: string, checkpointId: number): Promise<void> {
    try {
      const [session] = await db.select()
        .from(maxAutonomySessions)
        .where(eq(maxAutonomySessions.id, sessionId));
      
      if (!session) return;
      
      await this.checkpointService.restoreCheckpoint({
        checkpointId,
        userId: session.userId,
        restoreFiles: true,
        restoreDatabase: true,
        restoreEnvironment: true
      });
      
      await db.update(maxAutonomySessions)
        .set({
          rollbacksPerformed: (session.rollbacksPerformed || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(maxAutonomySessions.id, sessionId));
      
      this.emit('rollback:completed', { sessionId, checkpointId });
      logger.info(`Rolled back session ${sessionId} to checkpoint ${checkpointId}`);
      
    } catch (error: any) {
      logger.error(`Failed to rollback session ${sessionId} to checkpoint ${checkpointId}:`, error);
      this.emit('rollback:failed', { sessionId, checkpointId, error: error.message });
    }
  }
  
  /**
   * Pause session execution
   */
  async pauseSession(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('Session not found or not active');
    }
    
    activeSession.isPaused = true;
    
    await db.update(maxAutonomySessions)
      .set({
        status: 'paused',
        pausedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    this.emit('session:paused', { sessionId });
    logger.info(`Session ${sessionId} paused`);
  }
  
  /**
   * Resume session execution
   */
  async resumeSession(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('Session not found or not active');
    }
    
    activeSession.isPaused = false;
    
    await db.update(maxAutonomySessions)
      .set({
        status: 'running',
        resumedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    this.emit('session:resumed', { sessionId });
    logger.info(`Session ${sessionId} resumed`);
  }
  
  /**
   * Stop session execution
   */
  async stopSession(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      if (activeSession.intervalId) {
        clearInterval(activeSession.intervalId);
      }
      this.activeSessions.delete(sessionId);
    }
    
    await db.update(maxAutonomySessions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    await db.update(maxAutonomyTasks)
      .set({ status: 'cancelled' })
      .where(and(
        eq(maxAutonomyTasks.sessionId, sessionId),
        inArray(maxAutonomyTasks.status, ['pending', 'queued', 'running'])
      ));
    
    this.emit('session:stopped', { sessionId });
    logger.info(`Session ${sessionId} stopped`);
  }
  
  /**
   * Complete session
   */
  private async completeSession(sessionId: string, reason: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      if (activeSession.intervalId) {
        clearInterval(activeSession.intervalId);
      }
      this.activeSessions.delete(sessionId);
    }
    
    await db.update(maxAutonomySessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maxAutonomySessions.id, sessionId));
    
    this.emit('session:completed', { sessionId, reason });
    logger.info(`Session ${sessionId} completed: ${reason}`);
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<MaxAutonomySession | null> {
    const [session] = await db.select()
      .from(maxAutonomySessions)
      .where(eq(maxAutonomySessions.id, sessionId));
    
    return session || null;
  }
  
  /**
   * Get session progress
   */
  async getProgress(sessionId: string): Promise<SessionProgress | null> {
    const [session] = await db.select()
      .from(maxAutonomySessions)
      .where(eq(maxAutonomySessions.id, sessionId));
    
    if (!session) return null;
    
    const pendingTasks = await db.select()
      .from(maxAutonomyTasks)
      .where(and(
        eq(maxAutonomyTasks.sessionId, sessionId),
        eq(maxAutonomyTasks.status, 'pending')
      ));
    
    let currentTaskTitle: string | null = null;
    if (session.currentTaskId) {
      const [currentTask] = await db.select()
        .from(maxAutonomyTasks)
        .where(eq(maxAutonomyTasks.id, session.currentTaskId));
      currentTaskTitle = currentTask?.title || null;
    }
    
    const elapsedTimeMs = session.startedAt
      ? Date.now() - new Date(session.startedAt).getTime()
      : 0;
    
    const completedCount = session.tasksCompleted || 0;
    const totalCount = session.tasksTotal || 1;
    const avgTimePerTask = completedCount > 0 ? elapsedTimeMs / completedCount : 0;
    const remainingTasks = totalCount - completedCount - (session.tasksFailed || 0) - (session.tasksSkipped || 0);
    const rawEstimatedRemainingMs = Math.round(avgTimePerTask * remainingTasks);
    
    let currentTask: typeof pendingTasks[0] | null = null;
    if (session.currentTaskId) {
      const [task] = await db.select()
        .from(maxAutonomyTasks)
        .where(eq(maxAutonomyTasks.id, session.currentTaskId));
      currentTask = task || null;
    }
    
    const etaInfo = orchestratorMetrics.getImprovedETA(
      currentTask?.type || 'unknown',
      (session.metadata as any)?.model?.includes('claude') ? 'anthropic' : 'openai',
      rawEstimatedRemainingMs
    );
    
    // Get delegation info from executor if session is active
    let currentTaskDelegation: CurrentTaskDelegation | undefined;
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession?.executor) {
      const delegationInfo = activeSession.executor.getCurrentDelegationInfo();
      if (delegationInfo) {
        currentTaskDelegation = {
          tier: delegationInfo.tier,
          model: delegationInfo.model,
          provider: delegationInfo.provider,
          reason: delegationInfo.reason,
          taskComplexity: delegationInfo.taskComplexity,
          estimatedTokens: delegationInfo.estimatedTokens
        };
      }
    }
    
    return {
      sessionId: session.id,
      status: session.status,
      goal: session.goal,
      tasksTotal: session.tasksTotal || 0,
      tasksCompleted: session.tasksCompleted || 0,
      tasksFailed: session.tasksFailed || 0,
      tasksSkipped: session.tasksSkipped || 0,
      tasksPending: pendingTasks.length,
      currentTaskId: session.currentTaskId,
      currentTaskTitle,
      checkpointsCreated: session.checkpointsCreated || 0,
      rollbacksPerformed: session.rollbacksPerformed || 0,
      testsRun: session.testsRun || 0,
      testsPassed: session.testsPassed || 0,
      totalTokensUsed: session.totalTokensUsed || 0,
      totalCostUsd: session.totalCostUsd || '0',
      elapsedTimeMs,
      estimatedRemainingMs: etaInfo.adjustedEstimateMs,
      etaConfidence: etaInfo.confidence,
      etaBasedOnSamples: etaInfo.basedOnSamples,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      currentTaskDelegation
    };
  }
  
  /**
   * Get tasks for a session
   */
  async getTasks(sessionId: string): Promise<TaskQueueItem[]> {
    const tasks = await db.select()
      .from(maxAutonomyTasks)
      .where(eq(maxAutonomyTasks.sessionId, sessionId))
      .orderBy(asc(maxAutonomyTasks.order));
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      order: task.order,
      dependencies: (task.dependencies as string[]) || [],
      retryCount: task.retryCount || 0,
      estimatedDurationMs: task.estimatedDurationMs
    }));
  }
  
  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: number, limit = 10): Promise<MaxAutonomySession[]> {
    const sessions = await db.select()
      .from(maxAutonomySessions)
      .where(eq(maxAutonomySessions.userId, userId))
      .orderBy(desc(maxAutonomySessions.createdAt))
      .limit(limit);
    
    return sessions;
  }
}

export const maxAutonomyService = new MaxAutonomyService();
export { MaxAutonomyService };
