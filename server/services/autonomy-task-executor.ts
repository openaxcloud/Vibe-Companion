/**
 * Autonomy Task Executor
 * 
 * Responsible for:
 * - Task decomposition from user goals into subtasks
 * - AI-powered task breakdown using existing AI providers
 * - Sequential task execution with error handling
 * - Retry logic with exponential backoff
 * - Task dependency management
 */

import { createLogger } from '../utils/logger';
import { AIProviderManager } from '../ai/ai-provider-manager';
import { db } from '../db';
import { files, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { MaxAutonomyTask } from '@shared/schema';
import type { CheckpointService } from './checkpoint-service';
import type { BackgroundTestingService } from './background-testing-service';
import { delegationManager, type DelegationDecision } from './delegation-manager.service';
import { orchestratorMetrics, type TaskMetric } from './orchestrator-metrics.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = createLogger('AutonomyTaskExecutor');

export interface TaskDefinition {
  title: string;
  description: string;
  type: 'file_create' | 'file_edit' | 'file_delete' | 'command' | 'install_package' | 'database' | 'config' | 'analysis';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[];
  input?: Record<string, any>;
  requiresCheckpoint?: boolean;
  requiresTest?: boolean;
  estimatedDurationMs?: number;
  complexityScore?: number; // 1-10 scale indicating task difficulty
  confidenceScore?: number; // 0-1 probability that task definition is accurate
  estimatedTokens?: number; // Estimated AI tokens needed to complete task
}

export interface GoalComplexityAnalysis {
  overallComplexity: number; // 1-10 scale
  suggestedTaskCount: number;
  recommendedModel: string;
  keywordCategories: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DelegationInfo {
  tier: 'fast' | 'balanced' | 'quality';
  model: string;
  provider: string;
  reason?: string;
  taskComplexity?: number;
  estimatedTokens?: number;
}

export interface TaskExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  errorStack?: string;
  filesModified?: string[];
  commandsExecuted?: string[];
  aiResponse?: string;
  tokensUsed?: number;
  delegationInfo?: DelegationInfo;
}

export interface ExecutorOptions {
  sessionId: string;
  projectId: number;
  userId: number;
  model?: string;
  checkpointService: CheckpointService;
  testingService: BackgroundTestingService;
}

const TASK_DECOMPOSITION_PROMPT = `You are an expert software architect and project manager. Your task is to decompose a user's goal into actionable, atomic tasks that can be executed by an AI coding agent.

CRITICAL RULES:
1. Each task should be small and focused (single responsibility principle)
2. Tasks MUST be ordered by dependency - prerequisites always come first
3. Include explicit dependencies using task indices (e.g., ["task-0", "task-1"])
4. Mark tasks that modify critical files (package.json, config files, entry points) as requiring checkpoints
5. Mark tasks that modify code logic as requiring tests
6. Estimate realistic duration for each task (in milliseconds)

COMPLEXITY SCORING (1-10):
- 1-2: Trivial (simple file creation, adding comments)
- 3-4: Easy (basic CRUD operations, simple edits)
- 5-6: Moderate (feature implementation, multiple file changes)
- 7-8: Complex (refactoring, integration work, architecture changes)
- 9-10: Very Complex (system redesign, complex algorithms, security-critical)

CONFIDENCE SCORING (0-1):
- 0.9-1.0: Very confident - clear requirements, well-defined scope
- 0.7-0.8: Confident - some ambiguity but approach is clear
- 0.5-0.6: Moderate - multiple valid approaches, needs validation
- 0.3-0.4: Low confidence - unclear requirements, may need clarification
- 0.0-0.2: Very uncertain - speculative, high risk of rework

DEPENDENCY RESOLUTION RULES:
- Use "task-N" format for dependencies (N is zero-indexed position)
- A task cannot depend on itself or tasks that come after it
- Database/schema tasks must precede related API/UI tasks
- Package installation must precede code using those packages
- Config changes often need to precede related code changes

TOKEN ESTIMATION GUIDELINES:
- Simple file operations: 500-1000 tokens
- Moderate code generation: 1000-2500 tokens
- Complex implementations: 2500-5000 tokens
- Large refactoring: 5000-8000 tokens

Task types available:
- file_create: Create a new file with content
- file_edit: Modify an existing file
- file_delete: Delete a file
- command: Run a shell command
- install_package: Install npm/pip packages
- database: Database operations (migrations, schema changes)
- config: Configuration changes
- analysis: Code analysis without modifications

Priority levels: critical (blocking), high (important), medium (standard), low (nice-to-have)

Respond with a JSON array of tasks in this format:
[
  {
    "id": "task-0",
    "title": "Short task title",
    "description": "Detailed description of what to do and why",
    "type": "file_create|file_edit|command|etc",
    "priority": "critical|high|medium|low",
    "dependencies": [],
    "input": { "filePath": "/path/to/file", "content": "..." },
    "requiresCheckpoint": true/false,
    "requiresTest": true/false,
    "estimatedDurationMs": 5000,
    "complexityScore": 5,
    "confidenceScore": 0.85,
    "estimatedTokens": 1500
  }
]

User's Goal:`;

const TASK_EXECUTION_PROMPT = `You are an expert AI coding agent executing a specific task as part of a larger project. Execute the task precisely and report the results.

Current Task:
Title: {title}
Description: {description}
Type: {type}
Input: {input}

Project Context:
- Project ID: {projectId}
- Working Directory: {workingDirectory}

Instructions:
1. Analyze the task requirements
2. Plan the exact changes needed
3. Execute the task
4. Report success or failure with details

For file operations, respond with JSON:
{
  "action": "create_file|edit_file|delete_file",
  "filePath": "/path/to/file",
  "content": "file content if creating/editing",
  "changes": "description of changes made"
}

For commands, respond with JSON:
{
  "action": "run_command",
  "command": "the command to run",
  "workingDirectory": "/path"
}

For analysis, respond with JSON:
{
  "action": "analysis",
  "findings": "analysis results",
  "recommendations": ["list", "of", "recommendations"]
}

Execute the task now:`;

export class AutonomyTaskExecutor {
  private sessionId: string;
  private projectId: number;
  private userId: number;
  private model: string;
  private aiProvider: AIProviderManager;
  private checkpointService: CheckpointService;
  private testingService: BackgroundTestingService;
  private projectBasePath: string;
  
  constructor(options: ExecutorOptions) {
    this.sessionId = options.sessionId;
    this.projectId = options.projectId;
    this.userId = options.userId;
    this.model = options.model || 'gpt-4.1';
    this.aiProvider = new AIProviderManager();
    this.checkpointService = options.checkpointService;
    this.testingService = options.testingService;
    this.projectBasePath = path.join(process.cwd(), 'project-workspaces', String(options.projectId));
    
    logger.info(`AutonomyTaskExecutor initialized for session ${options.sessionId}`);
  }
  
  /**
   * Decompose a user goal into actionable tasks using AI
   */
  async decomposeGoal(goal: string): Promise<TaskDefinition[]> {
    logger.info(`Decomposing goal for session ${this.sessionId}: ${goal.substring(0, 100)}...`);
    
    try {
      const projectContext = await this.getProjectContext();
      
      const complexityAnalysis = this.calculateGoalComplexity(goal, projectContext);
      logger.info(`Goal complexity analysis: ${JSON.stringify(complexityAnalysis)}`);
      
      const useModel = complexityAnalysis.recommendedModel !== this.model 
        ? complexityAnalysis.recommendedModel 
        : this.model;
      
      const prompt = `${TASK_DECOMPOSITION_PROMPT}
${goal}

Current Project Structure:
${projectContext}

Complexity Hints:
- Detected categories: ${complexityAnalysis.keywordCategories.join(', ')}
- Suggested task count: ${complexityAnalysis.suggestedTaskCount}
- Overall complexity estimate: ${complexityAnalysis.overallComplexity}/10
- Risk level: ${complexityAnalysis.riskLevel}

Generate the task breakdown (aim for ${complexityAnalysis.suggestedTaskCount} tasks):`;

      const messages = [
        { role: 'user', content: prompt }
      ];
      
      let response = '';
      for await (const chunk of this.aiProvider.streamChat(useModel, messages, {
        system: 'You are an expert software architect. Respond only with valid JSON. Ensure all tasks have proper complexity and confidence scores.',
        max_tokens: 8000,
        temperature: 0.3
      })) {
        response += chunk;
      }
      
      const tasks = this.parseTasksFromResponse(response);
      
      const totalComplexity = tasks.reduce((sum, t) => sum + (t.complexityScore || 5), 0) / tasks.length;
      const avgConfidence = tasks.reduce((sum, t) => sum + (t.confidenceScore || 0.7), 0) / tasks.length;
      const totalTokens = tasks.reduce((sum, t) => sum + (t.estimatedTokens || 1500), 0);
      
      logger.info(`Decomposed goal into ${tasks.length} tasks (avg complexity: ${totalComplexity.toFixed(1)}, avg confidence: ${avgConfidence.toFixed(2)}, total tokens: ${totalTokens})`);
      return tasks;
      
    } catch (error: any) {
      logger.error(`Failed to decompose goal:`, error);
      
      return this.createFallbackTasks(goal);
    }
  }
  
  /**
   * Parse tasks from AI response
   */
  private parseTasksFromResponse(response: string): TaskDefinition[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      
      const tasks = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(tasks)) {
        throw new Error('Response is not an array');
      }
      
      return tasks.map((task: any, index: number) => ({
        title: task.title || `Task ${index + 1}`,
        description: task.description || '',
        type: this.validateTaskType(task.type),
        priority: this.validatePriority(task.priority),
        dependencies: this.validateDependencies(task.dependencies, index),
        input: task.input || {},
        requiresCheckpoint: Boolean(task.requiresCheckpoint),
        requiresTest: Boolean(task.requiresTest),
        estimatedDurationMs: this.validateEstimatedDuration(task.estimatedDurationMs),
        complexityScore: this.validateComplexityScore(task.complexityScore),
        confidenceScore: this.validateConfidenceScore(task.confidenceScore),
        estimatedTokens: this.validateEstimatedTokens(task.estimatedTokens)
      }));
      
    } catch (error: any) {
      logger.error('Failed to parse tasks from response:', error);
      throw error;
    }
  }
  
  /**
   * Validate complexity score (1-10 scale)
   */
  private validateComplexityScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore)) return 5; // Default to medium complexity
    return Math.max(1, Math.min(10, Math.round(numScore)));
  }
  
  /**
   * Validate confidence score (0-1 scale)
   */
  private validateConfidenceScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore)) return 0.7; // Default to reasonably confident
    return Math.max(0, Math.min(1, numScore));
  }
  
  /**
   * Validate estimated tokens
   */
  private validateEstimatedTokens(tokens: any): number {
    const numTokens = Number(tokens);
    if (isNaN(numTokens) || numTokens < 0) return 1500; // Default estimate
    return Math.min(numTokens, 50000); // Cap at 50k tokens
  }
  
  /**
   * Validate estimated duration
   */
  private validateEstimatedDuration(duration: any): number {
    const numDuration = Number(duration);
    if (isNaN(numDuration) || numDuration < 0) return 5000; // Default 5 seconds
    return Math.min(numDuration, 600000); // Cap at 10 minutes
  }
  
  /**
   * Validate dependencies - ensure they only reference earlier tasks
   */
  private validateDependencies(deps: any, currentIndex: number): string[] {
    if (!Array.isArray(deps)) return [];
    
    return deps.filter((dep: any) => {
      if (typeof dep !== 'string') return false;
      const match = dep.match(/^task-(\d+)$/);
      if (!match) return true; // Keep non-standard deps for backward compat
      const depIndex = parseInt(match[1], 10);
      return depIndex < currentIndex; // Only allow deps on earlier tasks
    });
  }
  
  /**
   * Validate task type
   */
  private validateTaskType(type: string): TaskDefinition['type'] {
    const validTypes = ['file_create', 'file_edit', 'file_delete', 'command', 'install_package', 'database', 'config', 'analysis'];
    return validTypes.includes(type) ? type as TaskDefinition['type'] : 'analysis';
  }
  
  /**
   * Validate priority
   */
  private validatePriority(priority: string): TaskDefinition['priority'] {
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    return validPriorities.includes(priority) ? priority as TaskDefinition['priority'] : 'medium';
  }
  
  /**
   * Keyword patterns for goal analysis
   */
  private readonly GOAL_KEYWORDS = {
    database: ['database', 'db', 'sql', 'postgres', 'mysql', 'mongo', 'schema', 'migration', 'table', 'query'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'route', 'controller', 'request', 'response', 'fetch'],
    auth: ['auth', 'login', 'logout', 'register', 'password', 'session', 'jwt', 'token', 'oauth', 'permission'],
    ui: ['component', 'page', 'button', 'form', 'modal', 'ui', 'ux', 'layout', 'style', 'css', 'design'],
    testing: ['test', 'spec', 'jest', 'vitest', 'cypress', 'e2e', 'unit', 'integration', 'mock'],
    deployment: ['deploy', 'build', 'docker', 'ci', 'cd', 'pipeline', 'production', 'staging'],
    refactor: ['refactor', 'restructure', 'reorganize', 'clean', 'optimize', 'improve', 'update'],
    feature: ['add', 'create', 'implement', 'build', 'develop', 'feature', 'functionality'],
    fix: ['fix', 'bug', 'error', 'issue', 'problem', 'debug', 'resolve', 'patch'],
    config: ['config', 'configure', 'setup', 'install', 'environment', 'env', 'settings']
  };
  
  /**
   * Analyze goal to detect keyword categories
   */
  private analyzeGoalKeywords(goal: string): string[] {
    const lowerGoal = goal.toLowerCase();
    const detectedCategories: string[] = [];
    
    for (const [category, keywords] of Object.entries(this.GOAL_KEYWORDS)) {
      if (keywords.some(kw => lowerGoal.includes(kw))) {
        detectedCategories.push(category);
      }
    }
    
    return detectedCategories.length > 0 ? detectedCategories : ['feature'];
  }
  
  /**
   * Create fallback tasks when AI decomposition fails
   * Uses goal analysis to create more specific and relevant tasks
   */
  private createFallbackTasks(goal: string): TaskDefinition[] {
    const categories = this.analyzeGoalKeywords(goal);
    const tasks: TaskDefinition[] = [];
    
    tasks.push({
      title: 'Analyze requirements and project structure',
      description: `Analyze the goal "${goal.substring(0, 100)}..." and understand the current project structure, dependencies, and constraints.`,
      type: 'analysis',
      priority: 'critical',
      dependencies: [],
      requiresCheckpoint: false,
      requiresTest: false,
      estimatedDurationMs: 3000,
      complexityScore: 2,
      confidenceScore: 0.9,
      estimatedTokens: 800
    });
    
    if (categories.includes('database')) {
      tasks.push({
        title: 'Define or update database schema',
        description: 'Create or modify database schema, tables, and relationships required for the goal.',
        type: 'database',
        priority: 'high',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: false,
        estimatedDurationMs: 8000,
        complexityScore: 6,
        confidenceScore: 0.7,
        estimatedTokens: 2000
      });
    }
    
    if (categories.includes('config') || categories.includes('deployment')) {
      tasks.push({
        title: 'Update configuration files',
        description: 'Modify configuration files, environment variables, or deployment settings as needed.',
        type: 'config',
        priority: 'high',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: false,
        estimatedDurationMs: 5000,
        complexityScore: 4,
        confidenceScore: 0.75,
        estimatedTokens: 1200
      });
    }
    
    if (categories.includes('api')) {
      tasks.push({
        title: 'Implement API endpoints',
        description: 'Create or modify API routes, controllers, and request handlers.',
        type: 'file_create',
        priority: 'high',
        dependencies: categories.includes('database') ? ['task-0', 'task-1'] : ['task-0'],
        requiresCheckpoint: true,
        requiresTest: true,
        estimatedDurationMs: 12000,
        complexityScore: 6,
        confidenceScore: 0.7,
        estimatedTokens: 3000
      });
    }
    
    if (categories.includes('ui')) {
      tasks.push({
        title: 'Create UI components',
        description: 'Build or update user interface components, pages, and styling.',
        type: 'file_create',
        priority: 'high',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: true,
        estimatedDurationMs: 15000,
        complexityScore: 5,
        confidenceScore: 0.7,
        estimatedTokens: 3500
      });
    }
    
    if (categories.includes('auth')) {
      tasks.push({
        title: 'Implement authentication logic',
        description: 'Add or modify authentication, authorization, and session management.',
        type: 'file_edit',
        priority: 'critical',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: true,
        estimatedDurationMs: 15000,
        complexityScore: 8,
        confidenceScore: 0.6,
        estimatedTokens: 4000
      });
    }
    
    if (categories.includes('refactor') || categories.includes('fix')) {
      tasks.push({
        title: 'Refactor or fix existing code',
        description: `${categories.includes('fix') ? 'Debug and fix issues' : 'Refactor code'} as specified in the goal.`,
        type: 'file_edit',
        priority: 'high',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: true,
        estimatedDurationMs: 10000,
        complexityScore: 6,
        confidenceScore: 0.65,
        estimatedTokens: 2500
      });
    }
    
    if (categories.includes('feature') && !categories.includes('api') && !categories.includes('ui')) {
      tasks.push({
        title: 'Implement core functionality',
        description: `Implement the main functionality for: ${goal.substring(0, 80)}...`,
        type: 'file_edit',
        priority: 'high',
        dependencies: ['task-0'],
        requiresCheckpoint: true,
        requiresTest: true,
        estimatedDurationMs: 12000,
        complexityScore: 5,
        confidenceScore: 0.7,
        estimatedTokens: 2800
      });
    }
    
    if (categories.includes('testing')) {
      tasks.push({
        title: 'Write or update tests',
        description: 'Create or modify test files to verify the implementation.',
        type: 'file_create',
        priority: 'medium',
        dependencies: tasks.length > 1 ? [`task-${tasks.length - 1}`] : ['task-0'],
        requiresCheckpoint: false,
        requiresTest: false,
        estimatedDurationMs: 8000,
        complexityScore: 4,
        confidenceScore: 0.8,
        estimatedTokens: 2000
      });
    }
    
    tasks.push({
      title: 'Verify and validate implementation',
      description: 'Verify the implementation works correctly and meets the requirements.',
      type: 'analysis',
      priority: 'medium',
      dependencies: [`task-${tasks.length - 1}`],
      requiresCheckpoint: false,
      requiresTest: false,
      estimatedDurationMs: 5000,
      complexityScore: 3,
      confidenceScore: 0.85,
      estimatedTokens: 1000
    });
    
    logger.info(`Created ${tasks.length} fallback tasks for categories: ${categories.join(', ')}`);
    return tasks;
  }
  
  /**
   * Calculate complexity analysis for a goal
   */
  calculateGoalComplexity(goal: string, projectContext: string): GoalComplexityAnalysis {
    const categories = this.analyzeGoalKeywords(goal);
    const goalLength = goal.length;
    const contextSize = projectContext.length;
    
    let baseComplexity = 3;
    
    if (categories.includes('auth')) baseComplexity += 2;
    if (categories.includes('database')) baseComplexity += 1.5;
    if (categories.includes('refactor')) baseComplexity += 1.5;
    if (categories.includes('api') && categories.includes('ui')) baseComplexity += 1;
    if (categories.includes('deployment')) baseComplexity += 1;
    if (categories.includes('testing')) baseComplexity += 0.5;
    
    if (goalLength > 500) baseComplexity += 1;
    if (goalLength > 1000) baseComplexity += 1;
    
    const overallComplexity = Math.min(10, Math.max(1, Math.round(baseComplexity)));
    
    const suggestedTaskCount = Math.max(3, Math.min(15, 
      Math.round(overallComplexity * 1.5) + categories.length
    ));
    
    let recommendedModel = 'gpt-4.1';
    if (overallComplexity >= 8) {
      recommendedModel = 'gpt-4.1';
    } else if (overallComplexity <= 3) {
      recommendedModel = 'gpt-4.1-nano';
    }
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (overallComplexity >= 7 || categories.includes('auth') || categories.includes('database')) {
      riskLevel = 'high';
    } else if (overallComplexity >= 5) {
      riskLevel = 'medium';
    }
    
    return {
      overallComplexity,
      suggestedTaskCount,
      recommendedModel,
      keywordCategories: categories,
      riskLevel
    };
  }
  
  /**
   * Get project context for AI
   */
  private async getProjectContext(): Promise<string> {
    try {
      const projectFiles = await db.select()
        .from(files)
        .where(and(
          eq(files.projectId, this.projectId),
          eq(files.isDirectory, false)
        ));
      
      const fileList = projectFiles
        .map(f => `- ${f.path}`)
        .slice(0, 50)
        .join('\n');
      
      return fileList || 'No files in project yet';
      
    } catch (error: any) {
      logger.error('Failed to get project context:', error);
      return 'Unable to retrieve project context';
    }
  }
  
  /**
   * Execute a single task with intelligent model delegation and metrics tracking
   * ✅ INTEGRATED: DelegationManager + OrchestratorMetrics (Dec 29, 2025)
   * ✅ FIXED: Read complexity from task entity columns, not task.input (Dec 29, 2025)
   */
  async executeTask(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    logger.info(`Executing task ${task.id}: ${task.title}`);
    
    const startTime = Date.now();
    
    // ✅ FIXED: Read complexity data from task entity columns (top-level), not task.input
    // MaxAutonomyTask has complexityScore, confidenceScore, estimatedTokens as direct columns
    const complexityScore = task.complexityScore ?? 5;
    const confidenceScore = task.confidenceScore ?? 0.7;
    const estimatedTokens = task.estimatedTokens ?? 1500;
    const estimatedDurationMs = task.estimatedDurationMs ?? 5000;
    
    // ✅ INTELLIGENT DELEGATION: Route to appropriate model based on complexity
    let delegationDecision: DelegationDecision | null = null;
    try {
      delegationDecision = await delegationManager.delegateTask({
        complexityScore,
        confidenceScore,
        estimatedTokens,
        taskType: task.type,
        preferredProvider: 'openai' // Default preference
      });
      
      // Update the model to use the delegated one
      this.currentTaskModel = delegationDecision.selectedModel;
      this.currentTaskProvider = delegationDecision.selectedProvider;
      
      logger.info(`Delegation: ${delegationDecision.selectedProvider}/${delegationDecision.selectedModel} (tier: ${delegationDecision.tier})`);
    } catch (delegationError: any) {
      logger.warn(`Delegation failed, using default model: ${delegationError.message}`);
      this.currentTaskModel = this.model;
      this.currentTaskProvider = 'openai';
    }
    
    let result: TaskExecutionResult;
    
    try {
      switch (task.type) {
        case 'file_create':
          result = await this.executeFileCreate(task);
          break;
        case 'file_edit':
          result = await this.executeFileEdit(task);
          break;
        case 'file_delete':
          result = await this.executeFileDelete(task);
          break;
        case 'command':
          result = await this.executeCommand(task);
          break;
        case 'install_package':
          result = await this.executeInstallPackage(task);
          break;
        case 'database':
          result = await this.executeDatabaseOperation(task);
          break;
        case 'config':
          result = await this.executeConfig(task);
          break;
        case 'analysis':
          result = await this.executeAnalysis(task);
          break;
        default:
          result = await this.executeGenericTask(task);
      }
      
    } catch (error: any) {
      logger.error(`Task ${task.id} execution failed:`, error);
      result = {
        success: false,
        error: error.message,
        errorStack: error.stack
      };
    }
    
    const actualDurationMs = Date.now() - startTime;
    // ✅ FIXED: Only use actual tokens if returned, otherwise use estimate
    const actualTokens = (result.tokensUsed && result.tokensUsed > 0) ? result.tokensUsed : estimatedTokens;
    
    // ✅ METRICS RECORDING: Track execution for ETA improvement
    try {
      const metric: TaskMetric = {
        taskType: task.type,
        complexity: complexityScore,
        estimatedDurationMs,
        actualDurationMs,
        estimatedTokens,
        actualTokens,
        success: result.success,
        provider: this.currentTaskProvider || 'openai',
        model: this.currentTaskModel || this.model,
        timestamp: new Date()
      };
      
      orchestratorMetrics.recordTaskExecution(metric);
      logger.info(`Metrics recorded: duration=${actualDurationMs}ms, tokens=${actualTokens}, success=${result.success}`);
      
      // ✅ FIXED: Report provider success/failure for ALL failures, not just API/timeout
      // This ensures circuit breaker properly degrades unavailable providers
      const provider = this.currentTaskProvider as any || 'openai';
      if (result.success) {
        delegationManager.reportProviderSuccess(provider);
      } else {
        // Report failure for any non-success - broader failure detection
        delegationManager.reportProviderFailure(provider);
        logger.warn(`Provider ${provider} failure reported: ${result.error || 'unknown error'}`);
      }
    } catch (metricsError: any) {
      logger.warn(`Failed to record metrics: ${metricsError.message}`);
    }
    
    // ✅ Add delegation info to result for frontend visibility
    if (delegationDecision) {
      result.delegationInfo = {
        tier: delegationDecision.tier,
        model: delegationDecision.selectedModel,
        provider: delegationDecision.selectedProvider,
        reason: delegationDecision.reason,
        taskComplexity: complexityScore,
        estimatedTokens: estimatedTokens
      };
      // Store for getCurrentDelegationInfo() to return between tasks
      this.lastDelegationInfo = result.delegationInfo;
    }
    
    // Clear task-specific model
    this.currentTaskModel = null;
    this.currentTaskProvider = null;
    
    return result;
  }
  
  // Task-specific model and provider (set by delegation)
  private currentTaskModel: string | null = null;
  private currentTaskProvider: string | null = null;
  private lastDelegationInfo: DelegationInfo | null = null;
  
  /**
   * Get the current delegation info (for UI display)
   */
  getCurrentDelegationInfo(): DelegationInfo | null {
    if (this.currentTaskModel && this.currentTaskProvider) {
      return {
        tier: this.getDelegationTier(),
        model: this.currentTaskModel,
        provider: this.currentTaskProvider
      };
    }
    return this.lastDelegationInfo;
  }
  
  private getDelegationTier(): 'fast' | 'balanced' | 'quality' {
    const model = this.currentTaskModel || '';
    if (model.includes('nano') || model.includes('haiku') || model.includes('flash')) {
      return 'fast';
    }
    if (model.includes('mini') || model.includes('sonnet')) {
      return 'balanced';
    }
    return 'quality';
  }
  
  /**
   * Execute file creation task
   */
  private async executeFileCreate(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    const filePath = input.filePath || input.path;
    let content = input.content;
    
    if (!filePath) {
      const aiResult = await this.askAIForTaskExecution(task);
      if (aiResult.action === 'create_file') {
        return await this.createFile(aiResult.filePath, aiResult.content);
      }
      return { success: false, error: 'AI could not determine file path' };
    }
    
    if (!content) {
      const aiResult = await this.askAIForTaskExecution(task);
      content = aiResult.content || '';
    }
    
    return await this.createFile(filePath, content);
  }
  
  /**
   * Execute file edit task
   */
  private async executeFileEdit(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    const filePath = input.filePath || input.path;
    
    if (!filePath) {
      const aiResult = await this.askAIForTaskExecution(task);
      if (aiResult.action === 'edit_file') {
        return await this.editFile(aiResult.filePath, aiResult.content, aiResult.changes);
      }
      return { success: false, error: 'AI could not determine file path' };
    }
    
    const aiResult = await this.askAIForTaskExecution(task);
    return await this.editFile(filePath, aiResult.content, aiResult.changes);
  }
  
  /**
   * Execute file deletion task
   */
  private async executeFileDelete(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    const filePath = input.filePath || input.path;
    
    if (!filePath) {
      return { success: false, error: 'File path not specified' };
    }
    
    try {
      const fullPath = path.join(this.projectBasePath, filePath);
      await fs.unlink(fullPath);
      
      await db.delete(files)
        .where(and(
          eq(files.projectId, this.projectId),
          eq(files.path, filePath)
        ));
      
      return {
        success: true,
        output: { deletedFile: filePath },
        filesModified: [filePath]
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Execute command task
   */
  private async executeCommand(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    let command = input.command;
    
    if (!command) {
      const aiResult = await this.askAIForTaskExecution(task);
      if (aiResult.action === 'run_command') {
        command = aiResult.command;
      }
    }
    
    if (!command) {
      return { success: false, error: 'Command not specified' };
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectBasePath,
        timeout: 60000
      });
      
      return {
        success: true,
        output: { stdout, stderr },
        commandsExecuted: [command]
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: { stderr: error.stderr }
      };
    }
  }
  
  /**
   * Execute package installation task
   */
  private async executeInstallPackage(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    const packages = input.packages || [];
    const packageManager = input.packageManager || 'npm';
    
    if (packages.length === 0) {
      return { success: false, error: 'No packages specified' };
    }
    
    const command = packageManager === 'npm'
      ? `npm install ${packages.join(' ')}`
      : `pip install ${packages.join(' ')}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectBasePath,
        timeout: 120000
      });
      
      return {
        success: true,
        output: { stdout, stderr, installedPackages: packages },
        commandsExecuted: [command]
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Execute database operation task
   */
  private async executeDatabaseOperation(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    return {
      success: true,
      output: { message: 'Database operation simulated' }
    };
  }
  
  /**
   * Execute configuration task
   */
  private async executeConfig(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const input = task.input as Record<string, any> || {};
    const configFile = input.configFile || 'package.json';
    const changes = input.changes || {};
    
    try {
      const fullPath = path.join(this.projectBasePath, configFile);
      let content: any = {};
      
      try {
        const existing = await fs.readFile(fullPath, 'utf-8');
        content = JSON.parse(existing);
      } catch (err: any) { console.error("[catch]", err?.message || err);
      }
      
      const merged = { ...content, ...changes };
      await fs.writeFile(fullPath, JSON.stringify(merged, null, 2));
      
      return {
        success: true,
        output: { configFile, changes },
        filesModified: [configFile]
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Execute analysis task
   */
  private async executeAnalysis(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const aiResult = await this.askAIForTaskExecution(task);
    
    return {
      success: true,
      output: {
        findings: aiResult.findings,
        recommendations: aiResult.recommendations
      },
      aiResponse: JSON.stringify(aiResult)
    };
  }
  
  /**
   * Execute generic task using AI
   */
  private async executeGenericTask(task: MaxAutonomyTask): Promise<TaskExecutionResult> {
    const aiResult = await this.askAIForTaskExecution(task);
    
    if (aiResult.action === 'create_file') {
      return await this.createFile(aiResult.filePath, aiResult.content);
    } else if (aiResult.action === 'edit_file') {
      return await this.editFile(aiResult.filePath, aiResult.content, aiResult.changes);
    } else if (aiResult.action === 'run_command') {
      return await this.executeCommand({
        ...task,
        input: { command: aiResult.command }
      });
    }
    
    return {
      success: true,
      output: aiResult,
      aiResponse: JSON.stringify(aiResult)
    };
  }
  
  /**
   * Ask AI for task execution guidance
   * ✅ INTEGRATED: Uses delegated model based on task complexity (Dec 29, 2025)
   */
  private async askAIForTaskExecution(task: MaxAutonomyTask): Promise<any> {
    const prompt = TASK_EXECUTION_PROMPT
      .replace('{title}', task.title)
      .replace('{description}', task.description || '')
      .replace('{type}', task.type)
      .replace('{input}', JSON.stringify(task.input || {}))
      .replace('{projectId}', String(this.projectId))
      .replace('{workingDirectory}', this.projectBasePath);
    
    const messages = [
      { role: 'user', content: prompt }
    ];
    
    // ✅ Use delegated model if available, otherwise fall back to default
    const modelToUse = this.currentTaskModel || this.model;
    logger.info(`AI execution using model: ${modelToUse}`);
    
    let response = '';
    let tokensUsed = 0;
    
    try {
      for await (const chunk of this.aiProvider.streamChat(modelToUse, messages, {
        system: 'You are an expert AI coding agent. Respond only with valid JSON.',
        max_tokens: 4000,
        temperature: 0.2
      })) {
        response += chunk;
      }
      
      // Estimate tokens used (rough calculation)
      tokensUsed = Math.ceil((prompt.length + response.length) / 4);
    } catch (aiError: any) {
      logger.error(`AI call failed with model ${modelToUse}:`, aiError);
      
      // Report failure for circuit breaker
      if (this.currentTaskProvider) {
        delegationManager.reportProviderFailure(this.currentTaskProvider as any);
      }
      
      throw aiError;
    }
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        result.tokensUsed = tokensUsed;
        return result;
      }
      return { action: 'analysis', findings: response, tokensUsed };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return { action: 'analysis', findings: response, tokensUsed };
    }
  }
  
  /**
   * Create a file
   */
  private async createFile(filePath: string, content: string): Promise<TaskExecutionResult> {
    try {
      const fullPath = path.join(this.projectBasePath, filePath);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      
      const fileName = path.basename(filePath);
      await db.insert(files).values({
        name: fileName,
        path: filePath,
        content,
        projectId: this.projectId,
        isDirectory: false,
        type: this.getFileType(fileName)
      }).onConflictDoUpdate({
        target: [files.projectId, files.path],
        set: {
          content,
          updatedAt: new Date()
        }
      });
      
      return {
        success: true,
        output: { createdFile: filePath },
        filesModified: [filePath]
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Edit a file
   */
  private async editFile(filePath: string, content: string, changes?: string): Promise<TaskExecutionResult> {
    try {
      const fullPath = path.join(this.projectBasePath, filePath);
      
      await fs.writeFile(fullPath, content, 'utf-8');
      
      await db.update(files)
        .set({
          content,
          updatedAt: new Date()
        })
        .where(and(
          eq(files.projectId, this.projectId),
          eq(files.path, filePath)
        ));
      
      return {
        success: true,
        output: { editedFile: filePath, changes },
        filesModified: [filePath]
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get file type from extension
   */
  private getFileType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const typeMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.sql': 'sql'
    };
    return typeMap[ext] || 'text';
  }
}
