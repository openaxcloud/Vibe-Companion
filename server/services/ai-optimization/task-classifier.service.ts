/**
 * Task Classifier Service
 * Intelligently classifies tasks as deterministic (MCP) vs creative (AI)
 * Learns from execution history to optimize routing
 */

import { db } from "../../db/drizzle";
import {
  aiTaskClassifications,
  type InsertAiTaskClassification,
  type AiTaskClassification,
} from "../../../shared/schema";
import { eq } from "drizzle-orm";

export type TaskType =
  | 'build'
  | 'test'
  | 'format'
  | 'typecheck'
  | 'lint'
  | 'migration'
  | 'file_operation'
  | 'plan_generation'
  | 'code_suggestion'
  | 'bug_fix'
  | 'refactoring'
  | 'architecture'
  | 'conversation'
  | 'other';

export type TaskCategory = 'deterministic' | 'creative' | 'hybrid';
export type ExecutorType = 'mcp' | 'ai' | 'hybrid';

export interface ClassificationResult {
  taskType: TaskType;
  category: TaskCategory;
  preferredExecutor: ExecutorType;
  confidence: number; // 0-1
  reasoning: string;
}

export class TaskClassifierService {
  // Default classifications (seed data)
  private static readonly DEFAULT_CLASSIFICATIONS: Record<TaskType, {
    category: TaskCategory;
    preferredExecutor: ExecutorType;
  }> = {
    // Deterministic tasks - Route to MCP
    'build': { category: 'deterministic', preferredExecutor: 'mcp' },
    'test': { category: 'deterministic', preferredExecutor: 'mcp' },
    'format': { category: 'deterministic', preferredExecutor: 'mcp' },
    'typecheck': { category: 'deterministic', preferredExecutor: 'mcp' },
    'lint': { category: 'deterministic', preferredExecutor: 'mcp' },
    'migration': { category: 'deterministic', preferredExecutor: 'mcp' },
    'file_operation': { category: 'deterministic', preferredExecutor: 'mcp' },
    
    // Creative tasks - Route to AI
    'plan_generation': { category: 'creative', preferredExecutor: 'ai' },
    'code_suggestion': { category: 'creative', preferredExecutor: 'ai' },
    'bug_fix': { category: 'creative', preferredExecutor: 'ai' },
    'refactoring': { category: 'creative', preferredExecutor: 'ai' },
    'architecture': { category: 'creative', preferredExecutor: 'ai' },
    'conversation': { category: 'creative', preferredExecutor: 'ai' },
    'other': { category: 'hybrid', preferredExecutor: 'ai' },
  };

  /**
   * Classify a task and determine optimal executor
   */
  async classify(params: {
    operation: string;
    context?: Record<string, any>;
  }): Promise<ClassificationResult> {
    // Infer task type from operation
    const taskType = this.inferTaskType(params.operation);
    
    // Check if we have learned classification
    const learned = await this.getClassification(taskType);
    
    if (learned && (learned.totalExecutions || 0) > 10) {
      // Use learned classification if we have enough data
      const totalExec = learned.totalExecutions || 0;
      const successRate = parseFloat(learned.successRate || '0');
      const confidence = Math.min(
        (successRate / 100) * (totalExec / 100),
        0.95
      );
      
      return {
        taskType,
        category: learned.category,
        preferredExecutor: learned.preferredExecutor as ExecutorType,
        confidence,
        reasoning: `Learned from ${totalExec} executions (${successRate}% success)`,
      };
    }
    
    // Fall back to default classification
    const defaultClass = TaskClassifierService.DEFAULT_CLASSIFICATIONS[taskType];
    
    return {
      taskType,
      category: defaultClass.category,
      preferredExecutor: defaultClass.preferredExecutor,
      confidence: 0.7, // Medium confidence for defaults
      reasoning: 'Default classification (insufficient data)',
    };
  }

  /**
   * Update classification based on execution result
   */
  async updateFromExecution(params: {
    taskType: TaskType;
    executorUsed: ExecutorType;
    success: boolean;
    tokensUsed: number;
    duration: number;
  }): Promise<void> {
    const existing = await this.getClassification(params.taskType);
    
    if (existing) {
      // Update existing classification
      const totalExec = existing.totalExecutions || 0;
      const successRate = parseFloat(existing.successRate || '0');
      const avgTokens = existing.avgTokens || 0;
      const avgDuration = existing.avgDuration || 0;
      
      const newTotalExec = totalExec + 1;
      const oldSuccessCount = (totalExec * (successRate / 100));
      const newSuccessCount = oldSuccessCount + (params.success ? 1 : 0);
      const newSuccessRate = (newSuccessCount / newTotalExec) * 100;
      
      const newAvgTokens = Math.round(
        (avgTokens * totalExec + params.tokensUsed) / newTotalExec
      );
      
      const newAvgDuration = Math.round(
        (avgDuration * totalExec + params.duration) / newTotalExec
      );

      // Update metadata for MCP vs AI comparison
      const metadata = existing.metadata as any || {};
      if (params.executorUsed === 'mcp') {
        const mcpExecs = (metadata.mcpExecutions || 0) + 1;
        const mcpSuccesses = (metadata.mcpSuccesses || 0) + (params.success ? 1 : 0);
        metadata.mcpSuccessRate = (mcpSuccesses / mcpExecs) * 100;
        metadata.mcpExecutions = mcpExecs;
        metadata.mcpSuccesses = mcpSuccesses;
      } else {
        const aiExecs = (metadata.aiExecutions || 0) + 1;
        const aiSuccesses = (metadata.aiSuccesses || 0) + (params.success ? 1 : 0);
        metadata.aiSuccessRate = (aiSuccesses / aiExecs) * 100;
        metadata.aiExecutions = aiExecs;
        metadata.aiSuccesses = aiSuccesses;
      }

      // Calculate cost savings if using MCP
      if (params.executorUsed === 'mcp') {
        const savedTokens = newAvgTokens; // Tokens we would have used with AI
        metadata.costSavings = (metadata.costSavings || 0) + (savedTokens * 0.00001);
      }

      await db
        .update(aiTaskClassifications)
        .set({
          successRate: newSuccessRate.toFixed(2),
          avgTokens: newAvgTokens,
          avgDuration: newAvgDuration,
          totalExecutions: newTotalExec,
          lastExecuted: new Date(),
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(aiTaskClassifications.taskType, params.taskType));
    } else {
      // Create new classification
      const defaultClass = TaskClassifierService.DEFAULT_CLASSIFICATIONS[params.taskType];
      
      await db.insert(aiTaskClassifications).values({
        taskType: params.taskType,
        category: defaultClass.category,
        preferredExecutor: params.executorUsed,
        successRate: params.success ? '100.00' : '0.00',
        avgTokens: params.tokensUsed,
        avgDuration: params.duration,
        totalExecutions: 1,
        lastExecuted: new Date(),
        metadata: {
          mcpSuccessRate: params.executorUsed === 'mcp' && params.success ? 100 : undefined,
          aiSuccessRate: params.executorUsed === 'ai' && params.success ? 100 : undefined,
          costSavings: params.executorUsed === 'mcp' ? params.tokensUsed * 0.00001 : 0,
        },
      });
    }
  }

  /**
   * Initialize default classifications
   */
  async initializeDefaults(): Promise<void> {
    for (const [taskType, config] of Object.entries(TaskClassifierService.DEFAULT_CLASSIFICATIONS)) {
      const existing = await this.getClassification(taskType as TaskType);
      
      if (!existing) {
        await db.insert(aiTaskClassifications).values({
          taskType: taskType as any,
          category: config.category,
          preferredExecutor: config.preferredExecutor,
          successRate: '0',
          avgTokens: 0,
          avgDuration: 0,
          totalExecutions: 0,
          metadata: {},
        });
      }
    }
  }

  /**
   * Get classification for a task type
   */
  private async getClassification(taskType: TaskType): Promise<AiTaskClassification | undefined> {
    const results = await db
      .select()
      .from(aiTaskClassifications)
      .where(eq(aiTaskClassifications.taskType, taskType))
      .limit(1);
    
    return results[0];
  }

  /**
   * Infer task type from operation string
   */
  private inferTaskType(operation: string): TaskType {
    const lower = operation.toLowerCase();
    
    if (lower.includes('build') || lower.includes('compile')) return 'build';
    if (lower.includes('test') || lower.includes('jest') || lower.includes('playwright')) return 'test';
    if (lower.includes('format') || lower.includes('prettier')) return 'format';
    if (lower.includes('typecheck') || lower.includes('tsc')) return 'typecheck';
    if (lower.includes('lint') || lower.includes('eslint')) return 'lint';
    if (lower.includes('migration') || lower.includes('db:push')) return 'migration';
    if (lower.includes('file') || lower.includes('read') || lower.includes('write')) return 'file_operation';
    if (lower.includes('plan') || lower.includes('strategy')) return 'plan_generation';
    if (lower.includes('suggest') || lower.includes('recommend')) return 'code_suggestion';
    if (lower.includes('fix') || lower.includes('debug')) return 'bug_fix';
    if (lower.includes('refactor')) return 'refactoring';
    if (lower.includes('architect') || lower.includes('design')) return 'architecture';
    if (lower.includes('chat') || lower.includes('conversation')) return 'conversation';
    
    return 'other';
  }

  /**
   * Get all classifications (for dashboard/monitoring)
   */
  async getAllClassifications() {
    const all = await db.select().from(aiTaskClassifications);
    return all;
  }
}

export const taskClassifier = new TaskClassifierService();
