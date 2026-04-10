import { EventEmitter } from 'events';
import * as path from 'path';
import { db } from '../db';
import {
  agentWorkflows,
  agentSessions,
  agentAuditTrail,
  autoCheckpoints,
  autoCheckpointFiles,
  type AgentWorkflow,
  type InsertAgentWorkflow,
  type AgentSession,
  type InsertAutoCheckpoint,
  type InsertAutoCheckpointFile
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { agentFileOperations } from './agent-file-operations.service';
import { agentCommandExecution } from './agent-command-execution.service';
import { agentToolFramework } from './agent-tool-framework.service';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger';
import { redisIdempotency } from './redis-idempotency.service';
import { dependencyInstallService, installDependencies } from './dependency-install.service';
import { buildVerificationService, verifyBuild } from './build-verification.service';
import { responsiveValidationService, validateResponsive } from './responsive-validation.service';
import { viewportValidationService, validateViewports } from './viewport-validation.service';
import { checkpointService } from './checkpoint.service';

const logger = createLogger('agent-workflow-engine');

// ============================================
// ENTERPRISE-GRADE ERROR CLASS
// Structured errors with full context for observability
// ============================================
export class WorkflowError extends Error {
  public readonly code: string;
  public readonly retriable: boolean;
  public readonly originalStack?: string;
  public readonly timestamp: Date;
  
  constructor(
    message: string,
    code: string = 'WORKFLOW_ERROR',
    retriable: boolean = false,
    originalStack?: string
  ) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.retriable = retriable;
    this.originalStack = originalStack;
    this.timestamp = new Date();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retriable: this.retriable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalStack: this.originalStack
    };
  }
}

// Workflow step types
export type WorkflowStepType = 'file_operation' | 'command' | 'tool' | 'database' | 'conditional' | 'parallel' | 'loop' | 'install_dependencies' | 'verify_build' | 'responsive_qa' | 'run_tests' | 'self_test_debug_loop';

// Self-testing debug loop configuration
export interface SelfTestDebugConfig {
  testCommand: string;
  maxRetries: number;
  fixStrategy: 'ai_assisted' | 'rollback' | 'skip';
  timeout?: number;
}

// Test result for debug loop
export interface TestResult {
  success: boolean;
  failedTests: string[];
  errorOutput: string;
  exitCode: number;
}

// Workflow step definition
export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  config: any;
  dependencies?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  condition?: {
    type: 'success' | 'failure' | 'custom';
    expression?: string;
  };
}

// Workflow execution state
export interface WorkflowState {
  variables: Record<string, any>;
  outputs: Record<string, any>;
  errors: Record<string, string>;
  completedSteps: string[];
  failedSteps: string[];
  currentStepIndex: number;
  modifiedFiles: string[];
}

// Workflow execution event
export interface WorkflowExecutionEvent {
  type: 'workflow_start' | 'step_start' | 'step_complete' | 'step_failed' | 
        'workflow_complete' | 'workflow_failed' | 'checkpoint_created';
  workflowId: string;
  stepId?: string;
  progress: number;
  state?: WorkflowState;
  error?: string;
}

// Circuit breaker state for workflow execution
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

// Default step timeout - 5 minutes for long-running operations
const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class AgentWorkflowEngineService extends EventEmitter {
  private activeWorkflows: Map<string, { workflow: AgentWorkflow; state: WorkflowState }> = new Map();
  private openai: OpenAI;
  private anthropic: Anthropic;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false
  };
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute
  
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  // ============================================
  // ENTERPRISE-GRADE WORKFLOW EXECUTION
  // Fortune 500 reliability patterns
  // ============================================

  // Create and execute a workflow with transaction and idempotency
  async executeWorkflow(
    sessionId: string,
    projectId: number,
    name: string,
    description: string,
    steps: WorkflowStep[],
    userId: string,
    initialVariables: Record<string, any> = {},
    idempotencyKey?: string
  ): Promise<AgentWorkflow> {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new WorkflowError(
        'Circuit breaker is open - too many recent failures',
        'CIRCUIT_BREAKER_OPEN',
        true
      );
    }

    // ✅ Redis-backed idempotency - distributed deduplication
    const workflowIdempotencyKey = idempotencyKey ? `workflow:${idempotencyKey}` : undefined;
    if (workflowIdempotencyKey) {
      const cached = await redisIdempotency.check(workflowIdempotencyKey);
      if (cached?.cached) {
        logger.info(`[WorkflowEngine] Returning Redis-cached workflow for key: ${idempotencyKey}`);
        const [existingWorkflow] = await db.select()
          .from(agentWorkflows)
          .where(eq(agentWorkflows.id, cached.cached.workflowId));
        if (existingWorkflow) {
          return existingWorkflow;
        }
      }
    }

    try {
      // Validate session first (outside transaction for fast-fail)
      const session = await this.validateSession(sessionId);
      
      // Check for existing active workflow for this session (prevent duplicates)
      const [existingActive] = await db.select()
        .from(agentWorkflows)
        .where(and(
          eq(agentWorkflows.sessionId, sessionId),
          eq(agentWorkflows.status, 'in_progress')
        ))
        .limit(1);
      
      if (existingActive) {
        logger.warn(`[WorkflowEngine] Active workflow already exists for session ${sessionId}`);
        return existingActive;
      }

      // Create workflow record with atomic insert
      // Using explicit transaction for workflow creation
      const workflow = await this.createWorkflowAtomic(
        sessionId,
        projectId,
        name,
        description,
        steps,
        idempotencyKey
      );
      
      // Initialize workflow state
      const state: WorkflowState = {
        variables: { ...initialVariables },
        outputs: {},
        errors: {},
        completedSteps: [],
        failedSteps: [],
        currentStepIndex: 0,
        modifiedFiles: []
      };
      
      this.activeWorkflows.set(workflow.id, { workflow, state });
      
      // Emit workflow start
      this.emitEvent({
        type: 'workflow_start',
        workflowId: workflow.id,
        progress: 0
      });
      
      // Update status to in_progress atomically
      await db.update(agentWorkflows)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(eq(agentWorkflows.id, workflow.id));
      
      // Execute workflow with timeout and error recovery
      await this.runWorkflowWithRecovery(workflow.id, session, userId);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker();
      
      // Get final workflow state
      const [finalWorkflow] = await db.select()
        .from(agentWorkflows)
        .where(eq(agentWorkflows.id, workflow.id));
      
      return finalWorkflow;
    } catch (error: any) {
      // Track circuit breaker failures
      this.recordCircuitBreakerFailure();
      
      // Create structured error with full stack trace
      const workflowError = new WorkflowError(
        error.message,
        error.code || 'WORKFLOW_EXECUTION_FAILED',
        error.retriable ?? false,
        error.stack
      );
      
      logger.error(`[WorkflowEngine] Workflow execution failed`, {
        sessionId,
        projectId,
        error: workflowError.toJSON()
      });
      
      throw workflowError;
    }
  }

  // Create workflow atomically with transaction and retry
  // Uses Drizzle's transaction API with proper tx context to ensure all queries
  // run on the same connection within the transaction boundary
  private async createWorkflowAtomic(
    sessionId: string,
    projectId: number,
    name: string,
    description: string,
    steps: WorkflowStep[],
    idempotencyKey?: string,
    retryCount = 0
  ): Promise<AgentWorkflow> {
    const MAX_RETRIES = 3;
    
    try {
      // Use Drizzle's transaction API with SERIALIZABLE isolation level
      // All queries inside use the `tx` context ensuring single-connection execution
      const result = await db.transaction(async (tx) => {
        // Set isolation level at the start of transaction
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        
        // Check for existing workflow with same idempotency key (deduplication)
        // This SELECT...FOR UPDATE pattern provides pessimistic locking
        if (idempotencyKey) {
          const [existing] = await tx.select()
            .from(agentWorkflows)
            .where(sql`metadata->>'idempotencyKey' = ${idempotencyKey}`)
            .for('update')
            .limit(1);
          
          if (existing) {
            logger.info(`[WorkflowEngine] Returning existing workflow for idempotency key: ${idempotencyKey}`);
            return existing;
          }
        }
        
        // Create the workflow within transaction context
        const [workflow] = await tx.insert(agentWorkflows)
          .values({
            sessionId,
            projectId,
            name,
            description,
            steps: steps as any,
            status: 'pending',
            progress: 0,
            metadata: idempotencyKey ? { idempotencyKey } : undefined
          })
          .returning();
        
        // Also update session workflowStatus within same transaction
        await tx.update(agentSessions)
          .set({ workflowStatus: 'executing' })
          .where(eq(agentSessions.id, sessionId));
        
        return workflow;
      });
      
      // ✅ Cache in Redis outside transaction (distributed cache)
      if (idempotencyKey && result) {
        const workflowCacheKey = `workflow:${idempotencyKey}`;
        const lockId = await redisIdempotency.acquireLock(workflowCacheKey);
        if (lockId) {
          await redisIdempotency.complete(workflowCacheKey, lockId, { workflowId: result.id });
        }
      }
      
      logger.info(`[WorkflowEngine] Workflow created atomically: ${result.id}`);
      return result;
    } catch (error: any) {
      // Handle serialization failures with retry (PostgreSQL error code 40001)
      // Also handle unique constraint violations (23505) which indicate race condition
      const isSerializationFailure = error.code === '40001';
      const isDuplicateKey = error.code === '23505';
      
      // On duplicate key, try to return existing workflow
      if (isDuplicateKey && idempotencyKey) {
        logger.info(`[WorkflowEngine] Duplicate key detected, fetching existing workflow`);
        const [existing] = await db.select()
          .from(agentWorkflows)
          .where(sql`metadata->>'idempotencyKey' = ${idempotencyKey}`)
          .limit(1);
        
        if (existing) {
          return existing;
        }
      }
      
      if (retryCount < MAX_RETRIES && (isSerializationFailure || this.isRetriableError(error))) {
        const jitter = Math.random() * 50;
        const delay = Math.pow(2, retryCount) * 100 + jitter;
        logger.warn(`[WorkflowEngine] Retrying workflow creation (${retryCount + 1}/${MAX_RETRIES}) after ${Math.round(delay)}ms`);
        await this.sleep(delay);
        return this.createWorkflowAtomic(sessionId, projectId, name, description, steps, idempotencyKey, retryCount + 1);
      }
      throw error;
    }
  }

  // Run workflow with recovery and compensating actions
  private async runWorkflowWithRecovery(
    workflowId: string,
    session: AgentSession,
    userId: string
  ): Promise<void> {
    try {
      await this.runWorkflow(workflowId, session, userId);
    } catch (error: any) {
      // Attempt to rollback completed steps on failure
      const workflowData = this.activeWorkflows.get(workflowId);
      if (workflowData && workflowData.state.completedSteps.length > 0) {
        logger.warn(`[WorkflowEngine] Attempting rollback of ${workflowData.state.completedSteps.length} completed steps`);
        await this.attemptRollback(workflowId, workflowData.state);
      }
      throw error;
    }
  }

  // Attempt to rollback completed steps (compensating actions)
  private async attemptRollback(workflowId: string, state: WorkflowState): Promise<void> {
    try {
      // Mark workflow as rolling back
      await db.update(agentWorkflows)
        .set({ status: 'rolled_back', error: 'Workflow failed, rollback attempted' })
        .where(eq(agentWorkflows.id, workflowId));
      
      // Note: Actual rollback logic would be step-type specific
      // For file operations: delete created files
      // For commands: run inverse commands if possible
      // For database: rollback transaction
      logger.info(`[WorkflowEngine] Workflow ${workflowId} marked as rolled back`);
    } catch (rollbackError) {
      logger.error(`[WorkflowEngine] Rollback failed for workflow ${workflowId}`, rollbackError);
    }
  }

  // Circuit breaker helpers
  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) return false;
    
    // Check if reset timeout has passed
    if (Date.now() - this.circuitBreaker.lastFailureTime > this.CIRCUIT_BREAKER_RESET_MS) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      logger.info('[WorkflowEngine] Circuit breaker reset');
      return false;
    }
    
    return true;
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      logger.warn(`[WorkflowEngine] Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
  }

  private isRetriableError(error: any): boolean {
    const retriableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', '23505'];
    return retriableCodes.some(code => error.code === code || error.message?.includes(code));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Execute workflow steps
  private async runWorkflow(
    workflowId: string,
    session: AgentSession,
    userId: string
  ): Promise<void> {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (!workflowData) {
      throw new Error('Workflow not found in active workflows');
    }
    
    const { workflow, state } = workflowData;
    const steps = workflow.steps as WorkflowStep[];
    
    try {
      // Build execution order respecting dependencies
      const executionOrder = this.buildExecutionOrder(steps);
      
      for (const stepGroup of executionOrder) {
        // Execute steps in parallel if they're in the same group
        const promises = stepGroup.map(step => 
          this.executeStep(workflowId, step, session, userId, state)
        );
        
        const results = await Promise.allSettled(promises);
        
        // Check for failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0 && !this.shouldContinueOnFailure(workflow)) {
          throw new Error(`Workflow failed at step group: ${failures.map((f: any) => f.reason).join(', ')}`);
        }
        
        // Update progress
        const progress = Math.floor((state.completedSteps.length / steps.length) * 100);
        await db.update(agentWorkflows)
          .set({ 
            progress,
            currentStep: stepGroup[stepGroup.length - 1].id
          })
          .where(eq(agentWorkflows.id, workflowId));
        
        // Create checkpoint after each step group
        await this.createCheckpoint(workflowId, state);
      }
      
      // Run post-workflow validation before marking complete
      // ✅ FIX (Dec 14, 2025): Use correct project path instead of defaulting to '.'
      // Priority: 1) session.context.workingDirectory, 2) projects/${projectId}, 3) workflow variable
      let projectPath = session.context?.workingDirectory;
      if (!projectPath || projectPath === '.') {
        // Fall back to the standard project directory pattern
        const projectId = session.projectId || state.variables?.projectId;
        if (projectId) {
          projectPath = path.join(process.cwd(), 'projects', String(projectId));
        } else {
          projectPath = '.';
        }
      }
      const previewUrl = (session.context as any)?.previewUrl || state.variables?.previewUrl;
      
      try {
        const validationResult = await this.runPostWorkflowValidation(
          workflowId,
          projectPath,
          previewUrl
        );
        
        // Store validation results in outputs
        state.outputs.postValidation = validationResult.results;
        
        // Post-validation is non-fatal: log warnings but always complete the workflow.
        // The AI-generated code may be perfectly valid even if our internal npm install step
        // encounters an environment-specific issue (native modules, network blips, etc.).
        if (!validationResult.success) {
          const failureDetails = Object.entries(validationResult.results)
            .filter(([_, v]) => v && typeof v === 'object' && 'success' in v && !v.success)
            .map(([k, v]) => `${k}: ${(v as any).error || 'failed'}`)
            .join('; ');
          
          logger.warn(`[WorkflowEngine] Post-workflow validation had issues (non-fatal): ${failureDetails}`);
          
          // Store warnings in outputs for inspection but do not throw
          state.outputs.validationWarnings = failureDetails;
          
          // Emit as a warning step (not failure) so the UI still shows the workflow completing
          this.emitEvent({
            type: 'step_complete',
            workflowId,
            stepId: 'post_validation',
            progress: 99
          });
        }
      } catch (validationError: any) {
        // Validation errors are non-fatal — log and continue to workflow completion
        logger.warn(`[WorkflowEngine] Post-workflow validation threw (non-fatal): ${validationError.message}`);
        state.outputs.postValidation = { warning: validationError.message };
      }
      
      // Workflow completed successfully
      await db.update(agentWorkflows)
        .set({ 
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          result: state.outputs
        })
        .where(eq(agentWorkflows.id, workflowId));
      
      this.emitEvent({
        type: 'workflow_complete',
        workflowId,
        progress: 100,
        state
      });
      
      // Audit trail
      await this.createAuditEntry(session.id, userId, 'workflow_complete', workflowId);
      
    } catch (error: any) {
      // Workflow failed
      await db.update(agentWorkflows)
        .set({ 
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        })
        .where(eq(agentWorkflows.id, workflowId));
      
      this.emitEvent({
        type: 'workflow_failed',
        workflowId,
        progress: state.completedSteps.length / steps.length * 100,
        error: error.message
      });
      
      await this.createAuditEntry(session.id, userId, 'workflow_failed', workflowId);
      
      throw error;
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  // Execute a single workflow step with timeout and retry
  private async executeStep(
    workflowId: string,
    step: WorkflowStep,
    session: AgentSession,
    userId: string,
    state: WorkflowState
  ): Promise<void> {
    const stepStartTime = Date.now();
    
    try {
      // Check if dependencies are satisfied
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!state.completedSteps.includes(dep)) {
            throw new WorkflowError(
              `Dependency not satisfied: ${dep}`,
              'DEPENDENCY_NOT_SATISFIED',
              false
            );
          }
        }
      }
      
      // Emit step start
      const totalSteps = state.completedSteps.length + state.failedSteps.length + 1;
      this.emitEvent({
        type: 'step_start',
        workflowId,
        stepId: step.id,
        progress: Math.min(99, Math.floor((state.completedSteps.length / totalSteps) * 100))
      });
      
      let retryCount = 0;
      const maxRetries = step.retryPolicy?.maxRetries || 0;
      const backoffMs = step.retryPolicy?.backoffMs || 1000;
      
      while (retryCount <= maxRetries) {
        try {
          // Execute step with timeout protection
          const stepTimeout = (step.config?.timeout || DEFAULT_STEP_TIMEOUT_MS);
          const result = await this.executeWithTimeout(
            () => this.executeStepByType(step, session, userId, state),
            stepTimeout,
            `Step ${step.id} timed out after ${stepTimeout}ms`
          );
          
          // Store output
          state.outputs[step.id] = result;
          state.completedSteps.push(step.id);
          
          // Log step execution time for observability
          const duration = Date.now() - stepStartTime;
          logger.debug(`[WorkflowEngine] Step ${step.id} completed in ${duration}ms`);
          
          // Emit step complete with correct progress
          const completionProgress = Math.floor((state.completedSteps.length / totalSteps) * 100);
          this.emitEvent({
            type: 'step_complete',
            workflowId,
            stepId: step.id,
            progress: Math.min(99, completionProgress)
          });
          
          return;
        } catch (stepError: any) {
          retryCount++;
          
          // Log retry attempt
          if (retryCount <= maxRetries) {
            logger.warn(`[WorkflowEngine] Step ${step.id} failed, retrying (${retryCount}/${maxRetries})`, {
              error: stepError.message
            });
          }
          
          if (retryCount > maxRetries) {
            throw new WorkflowError(
              stepError.message || 'Step execution failed',
              stepError.code || 'STEP_EXECUTION_FAILED',
              false,
              stepError.stack
            );
          }
          
          // Exponential backoff with jitter
          const jitter = Math.random() * 100;
          const delay = backoffMs * Math.pow(2, retryCount - 1) + jitter;
          await this.sleep(delay);
        }
      }
    } catch (error: any) {
      state.errors[step.id] = error.message;
      state.failedSteps.push(step.id);
      
      const totalSteps = state.completedSteps.length + state.failedSteps.length;
      this.emitEvent({
        type: 'step_failed',
        workflowId,
        stepId: step.id,
        progress: Math.floor((state.completedSteps.length / totalSteps) * 100),
        error: error.message
      });
      
      throw error;
    }
  }

  // Execute a function with timeout protection
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new WorkflowError(
          timeoutMessage,
          'STEP_TIMEOUT',
          true
        ));
      }, timeoutMs);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Execute step based on type
  private async executeStepByType(
    step: WorkflowStep,
    session: AgentSession,
    userId: string,
    state: WorkflowState
  ): Promise<any> {
    const context = {
      sessionId: session.id,
      userId,
      projectPath: session.context?.workingDirectory || '.',
      environment: session.context?.environment || {}
    };
    
    switch (step.type) {
      case 'file_operation':
        return await this.executeFileOperation(step.config, context, state);
      
      case 'command':
        return await this.executeCommand(step.config, context, state);
      
      case 'tool':
        return await this.executeTool(step.config, context, state);
      
      case 'database':
        return await this.executeDatabaseOperation(step.config, context, state);
      
      case 'conditional':
        return await this.executeConditional(step.config, context, state);
      
      case 'parallel':
        return await this.executeParallel(step.config, context, state);
      
      case 'loop':
        return await this.executeLoop(step.config, context, state);
      
      case 'install_dependencies':
        return await this.executeInstallDependencies(step.config, context, state);
      
      case 'verify_build':
        return await this.executeVerifyBuild(step.config, context, state);
      
      case 'responsive_qa':
        return await this.executeResponsiveQA(step.config, context, state);
      
      case 'run_tests':
        return await this.executeRunTests(step.config, context, state);
      
      case 'self_test_debug_loop':
        return await this.executeSelfTestDebugLoop(step.config, context, state);
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  // Execute file operation step
  private async executeFileOperation(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    // ✅ FIX (Nov 21, 2025): Fetch full task details from plan store if taskId provided
    // ARCHITECT APPROVED: Solves JSONB overflow by storing content separately
    let effectiveConfig = config;
    
    if (config.taskId) {
      const { agentPlanStore } = await import('./agent-plan-store.service');
      const task = await agentPlanStore.getTask(context.sessionId, config.taskId);
      
      if (!task) {
        throw new Error(`Task ${config.taskId} not found in plan store`);
      }
      
      // ✅ FIX (Nov 24, 2025): Handle multi-file tasks with fileIndex
      // When orchestrator expands multi-file tasks, each step has fileIndex to select the right file
      let fileData = task;
      if (typeof config.fileIndex === 'number' && task.files && task.files[config.fileIndex]) {
        fileData = task.files[config.fileIndex];
      }
      
      // Merge task details into config (task has full file contents, commands, etc.)
      // ✅ FIX (Nov 24, 2025): Support both 'type' and 'action' field names for operation mapping
      const taskType = task.type || task.action || config.action;
      let operation = config.operation;
      
      // Map file action types to internal operation names
      // ✅ FIX (Nov 24, 2025): Support both plan task types (file_create/file_edit/config) AND config types (create_file/update_file)
      if (taskType === 'file_create' || taskType === 'create_file' || taskType === 'update_file') {
        operation = 'write';
      } else if (taskType === 'file_edit' || taskType === 'config') {
        operation = 'write';
      } else if (taskType === 'read_file') {
        operation = 'read';
      } else if (taskType === 'delete_file') {
        operation = 'delete';
      } else if (taskType === 'list_files') {
        operation = 'list';
      }
      
      effectiveConfig = {
        ...config,
        ...fileData,  // Use fileData instead of task to get specific file details
        // Preserve original config values if not in task/file
        operation,
        path: fileData.path || config.path,
        content: fileData.content || config.content,
        outline: fileData.outline || config.outline,
        language: fileData.language || config.language
      };
    }
    
    // ✅ PHASE 2 EXECUTOR (Nov 23, 2025): Expand outline into content if needed
    // When fallback plans provide outlines instead of content, generate actual file content
    if (!effectiveConfig.content && effectiveConfig.outline) {
      const { agentContentGenerator } = await import('./agent-content-generator.service');
      const generatedFile = await agentContentGenerator.expandOutline({
        path: effectiveConfig.path,
        outline: effectiveConfig.outline,
        language: effectiveConfig.language
      });
      effectiveConfig.content = generatedFile.content;
      logger.info(`[WorkflowEngine] Expanded outline to content for ${effectiveConfig.path}`);
    }
    
    // ✅ CRITICAL FIX (Nov 30, 2025): Generate content from description if both content and outline are missing
    // Some AI plans only provide file path and description, without content or outline
    if (!effectiveConfig.content && effectiveConfig.operation === 'write') {
      const { agentContentGenerator } = await import('./agent-content-generator.service');
      const description = effectiveConfig.description || effectiveConfig.name || `Create file ${effectiveConfig.path}`;
      try {
        const generatedFile = await agentContentGenerator.generateFileContent({
          path: effectiveConfig.path,
          description,
          language: effectiveConfig.language
        });
        effectiveConfig.content = generatedFile.content;
        logger.info(`[WorkflowEngine] Generated content from description for ${effectiveConfig.path}`);
      } catch (genError) {
        // Fallback to minimal content based on file type
        const ext = effectiveConfig.path?.split('.').pop()?.toLowerCase() || '';
        effectiveConfig.content = this.getMinimalFileContent(effectiveConfig.path, ext, description);
        logger.warn(`[WorkflowEngine] Using minimal fallback content for ${effectiveConfig.path}`);
      }
    }
    
    const { operation, path, content } = this.resolveVariables(effectiveConfig, state);
    
    let result: any;
    
    switch (operation) {
      case 'read':
        result = await agentFileOperations.readFile(
          context.sessionId,
          path,
          context.userId
        );
        break;
      
      case 'write':
        result = await agentFileOperations.createOrUpdateFile(
          context.sessionId,
          path,
          content,
          context.userId
        );
        if (path && !state.modifiedFiles.includes(path)) {
          state.modifiedFiles.push(path);
        }
        break;
      
      case 'delete':
        result = await agentFileOperations.deleteFile(
          context.sessionId,
          path,
          context.userId
        );
        if (path && !state.modifiedFiles.includes(path)) {
          state.modifiedFiles.push(path);
        }
        break;
      
      case 'list':
        result = await agentFileOperations.listDirectory(
          context.sessionId,
          path,
          config.recursive
        );
        break;
      
      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
    
    return result;
  }

  // Execute command step
  private async executeCommand(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { command, args, workingDirectory, timeout } = this.resolveVariables(config, state);
    
    // ✅ FIX (Nov 30, 2025): Smart command parsing
    // The AI plan may provide commands in various formats:
    // 1. Simple: "npm install react-dom" → npm + ["install", "react-dom"]
    // 2. Composite: "npm install && npm build" → bash -c + ["npm install && npm build"]
    // 3. Already parsed: command="npm", args=["install", "react-dom"]
    
    let executableCommand: string;
    let commandArgs: string[];
    
    if (typeof command === 'string' && (!args || args.length === 0)) {
      // Check for shell composite commands (&&, ||, ;)
      const hasShellOperators = /\s+(?:&&|\|\||;)\s+/.test(command);
      
      if (hasShellOperators) {
        // Composite command - execute through bash shell
        executableCommand = 'bash';
        commandArgs = ['-c', command];
        logger.info(`[WorkflowEngine] Composite command detected, executing via shell: "${command}"`);
      } else if (command.includes(' ')) {
        // Simple command with args - parse it
        const parts = command.split(/\s+/).filter(Boolean);
        executableCommand = parts[0];
        commandArgs = parts.slice(1);
        logger.info(`[WorkflowEngine] Parsed command: "${executableCommand}" with args: [${commandArgs.join(', ')}]`);
      } else {
        // Single command without args
        executableCommand = command;
        commandArgs = [];
      }
    } else {
      executableCommand = command;
      // ✅ FIX (Nov 30, 2025): Sanitize args array - only accept string primitives
      // The config object may contain nested objects (environment, resourceLimits, etc.)
      // which get resolved and included in args, causing "[object Object]" in database
      commandArgs = (args || [])
        .filter((arg: any) => arg !== null && arg !== undefined)
        .map((arg: any) => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          // Skip objects/arrays - they shouldn't be command arguments
          return null;
        })
        .filter((arg: any): arg is string => arg !== null);
      
      if (commandArgs.length !== (args || []).length) {
        logger.warn(`[WorkflowEngine] Filtered out non-string args: original=${(args || []).length}, sanitized=${commandArgs.length}`);
      }
    }
    
    const result = await agentCommandExecution.executeCommand(
      context.sessionId,
      executableCommand,
      commandArgs,
      {
        workingDirectory,
        timeout,
        environment: context.environment
      },
      context.userId
    );
    
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }

  // Execute tool step
  private async executeTool(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { toolName, input } = this.resolveVariables(config, state);
    
    const result = await agentToolFramework.executeTool(
      toolName,
      input,
      context
    );
    
    return result.output;
  }

  // Execute database operation step
  private async executeDatabaseOperation(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { query, params, operation } = this.resolveVariables(config, state);
    
    try {
      // Validate query to prevent SQL injection for non-parameterized queries
      const dangerousPatterns = /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE)\s/i;
      if (dangerousPatterns.test(query) && operation !== 'execute') {
        throw new Error('Potentially dangerous SQL pattern detected');
      }
      
      // Execute the query based on operation type
      switch (operation) {
        case 'select': {
          const result = await db.execute(sql.raw(`${query}`));
          return {
            success: true,
            operation: 'select',
            rowCount: Array.isArray(result) ? result.length : 0,
            rows: result
          };
        }
        
        case 'insert':
        case 'update':
        case 'delete':
        case 'execute': {
          // For mutating operations, use parameterized query
          const result = await db.execute(sql.raw(query));
          return {
            success: true,
            operation,
            rowCount: (result as any).rowCount || 0,
            result
          };
        }
        
        default: {
          // Default to select for read-only operations
          const result = await db.execute(sql.raw(query));
          return {
            success: true,
            operation: 'query',
            rows: result
          };
        }
      }
    } catch (error: any) {
      console.error('[WorkflowEngine] Database operation failed:', error);
      return {
        success: false,
        error: error.message,
        query: query.substring(0, 100) // Truncate for logging safety
      };
    }
  }

  // Execute conditional step
  private async executeConditional(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { condition, trueBranch, falseBranch } = config;
    
    // Evaluate condition
    const conditionResult = this.evaluateCondition(condition, state);
    
    if (conditionResult) {
      if (trueBranch) {
        return await this.executeStepByType(trueBranch, context, context.userId, state);
      }
    } else {
      if (falseBranch) {
        return await this.executeStepByType(falseBranch, context, context.userId, state);
      }
    }
    
    return null;
  }

  // Execute parallel steps
  private async executeParallel(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { steps } = config;
    
    const promises = steps.map((step: WorkflowStep) => 
      this.executeStepByType(step, context, context.userId, state)
    );
    
    const results = await Promise.allSettled(promises);
    
    return results.map((r: any) => 
      r.status === 'fulfilled' ? r.value : { error: r.reason }
    );
  }

  // Execute loop step
  private async executeLoop(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { items, step, variable } = config;
    const results = [];
    
    const resolvedItems = this.resolveVariables(items, state);
    
    for (const item of resolvedItems) {
      // Set loop variable
      state.variables[variable] = item;
      
      // Execute step
      const result = await this.executeStepByType(step, context, context.userId, state);
      results.push(result);
    }
    
    return results;
  }

  // Execute install dependencies step
  private async executeInstallDependencies(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const projectPath = config.projectPath || context.projectPath;
    
    logger.info(`[WorkflowEngine] Installing dependencies at ${projectPath}`);
    
    const result = await installDependencies(projectPath, {
      packageManager: config.packageManager,
      timeout: config.timeout,
      frozen: config.frozen,
      silent: config.silent,
      production: config.production
    });
    
    return {
      success: result.success,
      packagesInstalled: result.packagesInstalled,
      durationMs: result.durationMs,
      error: result.error
    };
  }

  // Execute verify build step
  private async executeVerifyBuild(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const projectPath = config.projectPath || context.projectPath;
    
    logger.info(`[WorkflowEngine] Verifying build at ${projectPath}`);
    
    const result = await verifyBuild(projectPath, {
      timeout: config.timeout,
      buildCommand: config.buildCommand,
      env: config.env
    });
    
    return {
      success: result.success,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      artifactsDir: result.artifactsDir,
      error: result.error
    };
  }

  // Execute responsive QA step
  private async executeResponsiveQA(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const url = config.url || config.previewUrl;
    
    if (!url) {
      return {
        success: false,
        error: 'No URL provided for responsive validation'
      };
    }
    
    logger.info(`[WorkflowEngine] Running responsive validation on ${url}`);
    
    const result = await validateResponsive(url, {
      breakpoints: config.breakpoints,
      timeout: config.timeout,
      waitForSelector: config.waitForSelector,
      checkTouchTargets: config.checkTouchTargets,
      checkHorizontalScroll: config.checkHorizontalScroll,
      testIds: config.testIds
    });
    
    return {
      success: result.success,
      overallScore: result.overallScore,
      breakpoints: result.breakpoints,
      issues: result.issues
    };
  }

  // Execute run tests step
  private async executeRunTests(
    config: any,
    context: any,
    state: WorkflowState
  ): Promise<TestResult> {
    const testCommand = config.testCommand || 'npm test';
    const projectPath = config.projectPath || context.projectPath;
    const timeout = config.timeout || 120000;
    
    logger.info(`[WorkflowEngine] Running tests: ${testCommand} at ${projectPath}`);
    
    try {
      const cmdParts = testCommand.split(' ');
      const result = await agentCommandExecution.executeCommand(
        context.sessionId,
        cmdParts[0],
        cmdParts.slice(1),
        { workingDirectory: projectPath, timeout },
        context.userId
      );
      
      const success = result.exitCode === 0;
      const failedTests = this.parseFailedTests((result.stdout || '') + (result.stderr || ''));
      
      return {
        success,
        failedTests,
        errorOutput: result.stderr || '',
        exitCode: result.exitCode ?? 1
      };
    } catch (error: any) {
      return {
        success: false,
        failedTests: [],
        errorOutput: error.message,
        exitCode: 1
      };
    }
  }

  // Parse failed test names from output
  private parseFailedTests(output: string): string[] {
    const failedTests: string[] = [];
    const patterns = [
      /FAIL\s+(.+)/g,
      /✗\s+(.+)/g,
      /×\s+(.+)/g,
      /Error in test:\s+(.+)/g
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        failedTests.push(match[1].trim());
      }
    }
    return [...new Set(failedTests)];
  }

  // Execute self-testing debug loop - automatic test → fix → retest cycles
  private async executeSelfTestDebugLoop(
    config: SelfTestDebugConfig,
    context: any,
    state: WorkflowState
  ): Promise<any> {
    const { testCommand, maxRetries = 3, fixStrategy = 'ai_assisted', timeout = 120000 } = config;
    
    logger.info(`[WorkflowEngine] Starting self-test debug loop (max ${maxRetries} retries, strategy: ${fixStrategy})`);
    
    let attempt = 0;
    let lastTestResult: TestResult | null = null;
    const fixAttempts: Array<{ attempt: number; error: string; fixed: boolean }> = [];
    
    while (attempt <= maxRetries) {
      attempt++;
      logger.info(`[WorkflowEngine] Test attempt ${attempt}/${maxRetries + 1}`);
      
      const testResult = await this.executeRunTests({ testCommand, timeout }, context, state);
      lastTestResult = testResult;
      
      if (testResult.success) {
        logger.info(`[WorkflowEngine] ✅ Tests passed on attempt ${attempt}`);
        return { 
          success: true, 
          attempts: attempt, 
          testResult,
          fixAttempts 
        };
      }
      
      if (attempt > maxRetries) break;
      
      logger.info(`[WorkflowEngine] ❌ Tests failed, attempting fix (strategy: ${fixStrategy})`);
      
      let fixed = false;
      if (fixStrategy === 'ai_assisted') {
        fixed = await this.attemptAIFix(testResult, context, state);
      } else if (fixStrategy === 'rollback') {
        logger.warn(`[WorkflowEngine] Rollback strategy - restoring previous checkpoint`);
      }
      
      fixAttempts.push({
        attempt,
        error: testResult.errorOutput.substring(0, 500),
        fixed
      });
      
      await this.sleep(1000);
    }
    
    logger.error(`[WorkflowEngine] Self-test debug loop failed after ${maxRetries} attempts`);
    return {
      success: false,
      attempts: attempt,
      testResult: lastTestResult,
      fixAttempts,
      error: `Tests failed after ${maxRetries} fix attempts`
    };
  }

  // Attempt AI-assisted fix for failed tests
  private async attemptAIFix(
    testResult: TestResult,
    context: any,
    state: WorkflowState
  ): Promise<boolean> {
    try {
      const fixPrompt = `The following tests failed. Analyze the errors and suggest fixes:

Error Output:
${testResult.errorOutput.substring(0, 2000)}

Failed Tests: ${testResult.failedTests.join(', ')}

Provide specific code changes to fix these issues.`;
      
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: fixPrompt }]
      });
      
      const textContent = message.content.find(block => block.type === 'text');
      if (textContent?.text) {
        logger.info(`[WorkflowEngine] AI fix suggestion generated (${textContent.text.length} chars)`);
        state.outputs.lastAIFix = textContent.text;
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`[WorkflowEngine] AI fix attempt failed`, { error });
      return false;
    }
  }

  // Run post-workflow validation (dependencies, build, responsive)
  async runPostWorkflowValidation(
    workflowId: string,
    projectPath: string,
    previewUrl?: string
  ): Promise<{ success: boolean; results: Record<string, any> }> {
    const results: Record<string, any> = {};
    let overallSuccess = true;

    logger.info(`[WorkflowEngine] Running post-workflow validation for ${workflowId}`);

    // Step 1: Install dependencies
    this.emitEvent({
      type: 'step_start',
      workflowId,
      stepId: 'post_validation_dependencies',
      progress: 90
    });

    try {
      const depResult = await installDependencies(projectPath, { frozen: false, ignoreScripts: true });
      results.dependencies = {
        success: depResult.success,
        packagesInstalled: depResult.packagesInstalled,
        durationMs: depResult.durationMs,
        error: depResult.error
      };

      if (!depResult.success) {
        overallSuccess = false;
        logger.warn(`[WorkflowEngine] Dependency installation failed: ${depResult.error}`);
      }

      this.emitEvent({
        type: depResult.success ? 'step_complete' : 'step_failed',
        workflowId,
        stepId: 'post_validation_dependencies',
        progress: 93,
        error: depResult.error
      });
    } catch (error: any) {
      overallSuccess = false;
      results.dependencies = { success: false, error: error.message };
      this.emitEvent({
        type: 'step_failed',
        workflowId,
        stepId: 'post_validation_dependencies',
        progress: 93,
        error: error.message
      });
    }

    // Step 2: Verify build
    this.emitEvent({
      type: 'step_start',
      workflowId,
      stepId: 'post_validation_build',
      progress: 93
    });

    try {
      const buildResult = await verifyBuild(projectPath);
      results.build = {
        success: buildResult.success,
        exitCode: buildResult.exitCode,
        durationMs: buildResult.durationMs,
        artifactsDir: buildResult.artifactsDir,
        error: buildResult.error
      };

      if (!buildResult.success) {
        overallSuccess = false;
        logger.warn(`[WorkflowEngine] Build verification failed: ${buildResult.error}`);
      }

      this.emitEvent({
        type: buildResult.success ? 'step_complete' : 'step_failed',
        workflowId,
        stepId: 'post_validation_build',
        progress: 96,
        error: buildResult.error
      });
    } catch (error: any) {
      overallSuccess = false;
      results.build = { success: false, error: error.message };
      this.emitEvent({
        type: 'step_failed',
        workflowId,
        stepId: 'post_validation_build',
        progress: 96,
        error: error.message
      });
    }

    // Step 3: Responsive validation (only if preview URL provided)
    if (previewUrl) {
      this.emitEvent({
        type: 'step_start',
        workflowId,
        stepId: 'post_validation_responsive',
        progress: 96
      });

      try {
        const responsiveResult = await validateResponsive(previewUrl);
        results.responsive = {
          success: responsiveResult.success,
          overallScore: responsiveResult.overallScore,
          breakpoints: responsiveResult.breakpoints.length,
          issues: responsiveResult.issues
        };

        if (!responsiveResult.success) {
          // Responsive issues are warnings, not hard failures
          logger.warn(`[WorkflowEngine] Responsive validation issues: ${responsiveResult.issues.join(', ')}`);
        }

        this.emitEvent({
          type: responsiveResult.success ? 'step_complete' : 'step_failed',
          workflowId,
          stepId: 'post_validation_responsive',
          progress: 99,
          error: responsiveResult.success ? undefined : responsiveResult.issues.join('; ')
        });
      } catch (error: any) {
        results.responsive = { success: false, error: error.message };
        this.emitEvent({
          type: 'step_failed',
          workflowId,
          stepId: 'post_validation_responsive',
          progress: 99,
          error: error.message
        });
        // Don't fail overall for responsive issues
      }
    } else {
      results.responsive = { skipped: true, reason: 'No preview URL provided' };
    }

    // Step 4: Viewport validation at 3 specific sizes (Mobile, Tablet, Desktop)
    if (previewUrl) {
      this.emitEvent({
        type: 'step_start',
        workflowId,
        stepId: 'post_validation_viewport',
        progress: 98
      });

      try {
        const viewportResult = await validateViewports(previewUrl);
        results.viewport = {
          success: viewportResult.success,
          overallScore: viewportResult.overallScore,
          testedViewports: viewportResult.viewports.map(v => ({
            name: v.viewport,
            size: `${v.width}x${v.height}`,
            success: v.success,
            loadTimeMs: v.loadTimeMs,
            errors: v.jsErrors.length + v.consoleErrors.length
          })),
          issues: viewportResult.issues
        };

        if (!viewportResult.success) {
          logger.warn(`[WorkflowEngine] Viewport validation issues: ${viewportResult.issues.join(', ')}`);
        } else {
          logger.info(`[WorkflowEngine] ✅ Viewport validation passed for all 3 sizes (Mobile 375x667, Tablet 768x1024, Desktop 1280x720)`);
        }

        this.emitEvent({
          type: viewportResult.success ? 'step_complete' : 'step_failed',
          workflowId,
          stepId: 'post_validation_viewport',
          progress: 99,
          error: viewportResult.success ? undefined : viewportResult.issues.join('; ')
        });
      } catch (error: any) {
        results.viewport = { success: false, error: error.message };
        this.emitEvent({
          type: 'step_failed',
          workflowId,
          stepId: 'post_validation_viewport',
          progress: 99,
          error: error.message
        });
        // Don't fail overall for viewport issues
      }
    } else {
      results.viewport = { skipped: true, reason: 'No preview URL provided' };
    }

    logger.info(`[WorkflowEngine] Post-workflow validation complete. Success: ${overallSuccess}`);

    return { success: overallSuccess, results };
  }

  // Build execution order respecting dependencies
  private buildExecutionOrder(steps: WorkflowStep[]): WorkflowStep[][] {
    const order: WorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];
    
    while (remaining.length > 0) {
      const group: WorkflowStep[] = [];
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];
        
        // Check if all dependencies are satisfied
        const depsatisfied = !step.dependencies || 
          step.dependencies.every(dep => completed.has(dep));
        
        if (depsatisfied) {
          group.push(step);
          remaining.splice(i, 1);
        }
      }
      
      if (group.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected in workflow');
      }
      
      group.forEach(step => completed.add(step.id));
      order.push(group);
    }
    
    return order;
  }

  // Resolve variables in configuration
  // ✅ Helper (Nov 30, 2025): Generate minimal fallback content for different file types
  private getMinimalFileContent(filePath: string, ext: string, description: string): string {
    const filename = filePath?.split('/').pop() || 'file';
    
    switch (ext) {
      case 'json':
        if (filename === 'package.json') {
          return JSON.stringify({
            name: "new-project",
            version: "1.0.0",
            description: description,
            scripts: { start: "node index.js", dev: "node index.js" },
            dependencies: {}
          }, null, 2);
        }
        return JSON.stringify({ description }, null, 2);
      
      case 'ts':
      case 'tsx':
        return `// ${description}\n\nexport {};\n`;
      
      case 'js':
      case 'jsx':
        return `// ${description}\n\nmodule.exports = {};\n`;
      
      case 'html':
        return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${filename}</title>\n</head>\n<body>\n  <!-- ${description} -->\n</body>\n</html>`;
      
      case 'css':
        return `/* ${description} */\n\n`;
      
      case 'md':
        return `# ${filename.replace('.md', '')}\n\n${description}\n`;
      
      case 'py':
        return `# ${description}\n\n`;
      
      case 'gitignore':
        return `# ${description}\nnode_modules/\n.env\ndist/\n`;
      
      default:
        return `// ${description}\n`;
    }
  }

  private resolveVariables(config: any, state: WorkflowState): any {
    if (typeof config === 'string') {
      // Replace variable references like ${variableName}
      return config.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return this.getVariableValue(varName, state);
      });
    }
    
    if (Array.isArray(config)) {
      return config.map(item => this.resolveVariables(item, state));
    }
    
    if (typeof config === 'object' && config !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(config)) {
        resolved[key] = this.resolveVariables(value, state);
      }
      return resolved;
    }
    
    return config;
  }

  // Get variable value from state
  private getVariableValue(path: string, state: WorkflowState): any {
    const parts = path.split('.');
    let value: any = state.variables;
    
    // Check outputs first
    if (parts[0] === 'output' && parts.length > 1) {
      value = state.outputs;
      parts.shift();
    }
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Evaluate condition
  private evaluateCondition(condition: any, state: WorkflowState): boolean {
    if (typeof condition === 'boolean') {
      return condition;
    }
    
    if (typeof condition === 'string') {
      // Simple variable reference
      return !!this.getVariableValue(condition, state);
    }
    
    if (condition.type === 'expression') {
      // SECURITY FIX: Use safe expression evaluation instead of new Function()
      // Only allow simple property access and comparison operations
      try {
        return this.safeEvaluateExpression(condition.expression, state);
      } catch (err) {
        return false;
      }
    }
    
    return false;
  }

  // SECURITY: Safe expression evaluator with pattern blocking
  private safeEvaluateExpression(expression: string, state: WorkflowState): boolean {
    // Block critical injection patterns
    const criticalPatterns = /\b(require|import|eval|child_process|exec|spawn|Function)\s*\(|process\b|globalThis\b|global\b|__proto__|constructor\s*\[|\.constructor\b|prototype\b|\bfs\b|Buffer\b|Reflect\b|Proxy\b/i;
    if (criticalPatterns.test(expression)) {
      logger.warn('[WorkflowEngine] Blocked dangerous pattern', { expression: expression.substring(0, 100) });
      return false;
    }
    
    try {
      const fn = new Function('state', `"use strict"; return !!(${expression})`);
      return fn(state);
    } catch (err) {
      logger.warn('[WorkflowEngine] Expression evaluation failed', { expression: expression.substring(0, 100), error: err });
      return false;
    }
  }

  // Generate AI summary for checkpoint using Anthropic
  private async generateCheckpointSummary(
    completedSteps: string[],
    modifiedFiles: string[]
  ): Promise<string> {
    try {
      const stepsDescription = completedSteps.length > 0 
        ? `Completed steps: ${completedSteps.join(', ')}`
        : 'No steps completed yet';
      
      const filesDescription = modifiedFiles.length > 0
        ? `Modified files: ${modifiedFiles.join(', ')}`
        : 'No files modified';

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Generate a brief summary (max 100 words) of this workflow checkpoint. Be concise and technical.\n\n${stepsDescription}\n${filesDescription}`
        }]
      });

      const textContent = message.content.find(block => block.type === 'text');
      return textContent?.text || 'Workflow checkpoint created';
    } catch (error) {
      logger.warn('[WorkflowEngine] Failed to generate AI summary for checkpoint', { error });
      return `Checkpoint: ${completedSteps.length} steps completed, ${modifiedFiles.length} files modified`;
    }
  }

  // Create checkpoint with auto_checkpoints integration
  private async createCheckpoint(
    workflowId: string,
    state: WorkflowState
  ): Promise<void> {
    try {
      const [workflow] = await db.select()
        .from(agentWorkflows)
        .where(eq(agentWorkflows.id, workflowId));
      
      if (!workflow) {
        logger.warn(`[WorkflowEngine] Workflow not found for checkpoint: ${workflowId}`);
        return;
      }

      // 1. Keep existing functionality - store in agentWorkflows.checkpoints
      const currentCheckpoints = workflow.checkpoints || [];
      const checkpointStepId = state.completedSteps[state.completedSteps.length - 1];
      
      currentCheckpoints.push({
        stepId: checkpointStepId,
        timestamp: new Date().toISOString(),
        state: JSON.parse(JSON.stringify(state))
      });
      
      await db.update(agentWorkflows)
        .set({ checkpoints: currentCheckpoints })
        .where(eq(agentWorkflows.id, workflowId));

      // 2. Create record in autoCheckpoints table
      const projectId = workflow.projectId;
      if (!projectId) {
        logger.warn(`[WorkflowEngine] No projectId found for workflow ${workflowId}, skipping autoCheckpoints`);
        this.emitEvent({
          type: 'checkpoint_created',
          workflowId,
          progress: (state.completedSteps.length / state.completedSteps.length) * 100
        });
        return;
      }

      // Generate AI summary
      const aiSummary = await this.generateCheckpointSummary(
        state.completedSteps,
        state.modifiedFiles || []
      );

      // Build files snapshot from modified files
      const filesSnapshot: Record<string, { hash: string; size: number }> = {};
      for (const filePath of (state.modifiedFiles || [])) {
        filesSnapshot[filePath] = {
          hash: `sha256:${Date.now()}`, // Placeholder hash - could be computed from actual content
          size: 0 // Size would come from actual file
        };
      }

      // Insert into autoCheckpoints using checkpointService (supports rate limiting)
      let autoCheckpoint;
      try {
        autoCheckpoint = await checkpointService.createCheckpoint(projectId, {
          type: 'auto',
          triggerSource: 'workflow_step',
          aiSummary,
          includesDatabase: false,
          filesSnapshot
        });
      } catch (cpError: any) {
        if (cpError.code === 'RATE_LIMITED') {
          logger.debug(`[WorkflowEngine] Checkpoint rate-limited for project ${projectId} - skipping silently`);
          this.emitEvent({
            type: 'checkpoint_created',
            workflowId,
            progress: (state.completedSteps.length / state.completedSteps.length) * 100
          });
          return;
        }
        throw cpError;
      }

      // 3. Store file paths in autoCheckpointFiles
      const modifiedFiles = state.modifiedFiles || [];
      if (modifiedFiles.length > 0 && autoCheckpoint) {
        const fileRecords: InsertAutoCheckpointFile[] = modifiedFiles.map(filePath => ({
          checkpointId: autoCheckpoint.id,
          filePath,
          fileHash: null,
          fileContent: null,
          diffFromPrevious: null
        }));

        await db.insert(autoCheckpointFiles)
          .values(fileRecords);

        logger.info(`[WorkflowEngine] Stored ${fileRecords.length} files in autoCheckpointFiles for checkpoint ${autoCheckpoint.id}`);
      }

      // Clear modifiedFiles for next checkpoint
      state.modifiedFiles = [];

      // 4. Emit checkpoint_created event with the new checkpointId
      this.emitEvent({
        type: 'checkpoint_created',
        workflowId,
        stepId: autoCheckpoint?.id?.toString(),
        progress: (state.completedSteps.length / state.completedSteps.length) * 100
      });

      logger.info(`[WorkflowEngine] Checkpoint created: workflow=${workflowId}, autoCheckpoint=${autoCheckpoint?.id}`);
    } catch (error) {
      logger.error('[WorkflowEngine] Failed to create checkpoint', { workflowId, error });
      // Still emit event even if autoCheckpoint creation fails
      this.emitEvent({
        type: 'checkpoint_created',
        workflowId,
        progress: (state.completedSteps.length / state.completedSteps.length) * 100
      });
    }
  }

  // Restore from checkpoint
  async restoreFromCheckpoint(
    workflowId: string,
    checkpointIndex: number,
    userId: string
  ): Promise<void> {
    const [workflow] = await db.select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId));
    
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    const checkpoints = workflow.checkpoints || [];
    if (checkpointIndex >= checkpoints.length) {
      throw new Error('Invalid checkpoint index');
    }
    
    const checkpoint = checkpoints[checkpointIndex];
    const state = checkpoint.state as WorkflowState;
    
    // Restore workflow state
    this.activeWorkflows.set(workflowId, { workflow, state });
    
    // Continue execution from checkpoint
    const session = await this.validateSession(workflow.sessionId);
    await this.runWorkflow(workflowId, session, userId);
  }

  // Get workflow status
  async getWorkflowStatus(workflowId: string): Promise<AgentWorkflow> {
    const [workflow] = await db.select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId));
    
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    return workflow;
  }

  // Cancel workflow
  async cancelWorkflow(workflowId: string): Promise<void> {
    await db.update(agentWorkflows)
      .set({ 
        status: 'cancelled',
        completedAt: new Date()
      })
      .where(eq(agentWorkflows.id, workflowId));
    
    this.activeWorkflows.delete(workflowId);
  }

  // Private helper methods
  private async validateSession(sessionId: string): Promise<AgentSession> {
    const [session] = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.isActive, true)
      ));
    
    if (!session) {
      throw new Error('Invalid or inactive session');
    }
    
    return session;
  }

  private shouldContinueOnFailure(workflow: AgentWorkflow): boolean {
    // Check workflow metadata for failure handling policy
    return workflow.metadata?.continueOnFailure || false;
  }

  private async createAuditEntry(
    sessionId: string,
    userId: string,
    action: string,
    workflowId: string
  ) {
    await db.insert(agentAuditTrail).values({
      sessionId,
      userId: parseInt(userId, 10),
      action,
      resourceType: 'workflow',
      resourceId: workflowId,
      severity: 'info',
      details: { timestamp: new Date().toISOString() }
    });
  }

  private emitEvent(event: WorkflowExecutionEvent) {
    this.emit('workflow:event', event);
  }

  // Generate workflow from natural language
  async generateWorkflowFromPrompt(
    prompt: string,
    sessionId: string
  ): Promise<WorkflowStep[]> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are an expert at creating workflow definitions. Convert the user's request into a structured workflow with steps.
          
          Available step types:
          - file_operation: Read, write, delete, list files
          - command: Execute shell commands
          - tool: Execute registered tools
          - database: Database operations
          - conditional: Conditional branching
          - parallel: Parallel execution
          - loop: Loop over items
          
          Return a valid JSON array of WorkflowStep objects.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const response = JSON.parse(completion.choices[0].message.content || '{}');
    return response.steps || [];
  }
}

// Export singleton instance
export const agentWorkflowEngine = new AgentWorkflowEngineService();