/**
 * AI Optimization Orchestrator
 * Coordinates all AI optimization services for maximum token savings
 * Main entry point for optimized AI operations
 */

import { tokenUsageLogger, type TokenUsageMetrics } from './token-usage-logger.service';
import { taskClassifier, type ClassificationResult } from './task-classifier.service';
import { mcpRouter, type McpExecutionResult } from './mcp-router.service';
import { circuitBreaker, type ProviderHealthStatus } from './circuit-breaker.service';
import { priorityQueue, type QueuedRequest, type QueuePriority } from './priority-queue.service';
import { requestDebouncer } from './request-debouncer.service';
import { planCache } from './plan-cache.service';

export interface OptimizedExecutionParams {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  operation: string;
  parameters: Record<string, any>;
  context?: Record<string, any>;
  priority?: QueuePriority;
  allowMcp?: boolean;
  allowCache?: boolean;
  aiExecutor?: (params: any) => Promise<any>;
}

export interface OptimizedExecutionResult {
  success: boolean;
  output: any;
  metadata: {
    executedBy: 'mcp' | 'ai' | 'cache';
    provider?: string;
    model?: string;
    tokensUsed: number;
    duration: number;
    cached?: boolean;
    debouncedWith?: number;
    classification?: ClassificationResult;
  };
}

export class AiOptimizationOrchestrator {
  /**
   * Execute an operation with full optimization
   */
  async execute(params: OptimizedExecutionParams): Promise<OptimizedExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Check cache first
      if (params.allowCache && planCache.shouldCache(params.operation)) {
        const cached = await planCache.get({
          operation: params.operation,
          context: params.context,
        });

        if (cached) {
          return {
            success: true,
            output: cached.plan,
            metadata: {
              executedBy: 'cache',
              provider: cached.metadata.provider,
              model: cached.metadata.model,
              tokensUsed: 0, // No tokens used for cache hit
              duration: Date.now() - startTime,
              cached: true,
            },
          };
        }
      }

      // 2. Classify task
      const classification = await taskClassifier.classify({
        operation: params.operation,
        context: params.context,
      });

      // 3. Route to MCP if deterministic and allowed
      if (
        params.allowMcp !== false &&
        classification.preferredExecutor === 'mcp' &&
        mcpRouter.canExecuteLocally(classification.taskType)
      ) {
        const mcpResult = await mcpRouter.executeTask({
          taskType: classification.taskType,
          operation: params.operation,
          projectPath: params.context?.projectPath,
        });

        // Log MCP execution
        await tokenUsageLogger.logMcpExecution({
          userId: params.userId,
          projectId: params.projectId,
          sessionId: params.sessionId,
          taskType: classification.taskType,
          duration: mcpResult.duration,
          success: mcpResult.success,
          errorMessage: mcpResult.error,
          metadata: {
            operation: params.operation,
            fromMcp: true,
          },
        });

        // Update classification
        await taskClassifier.updateFromExecution({
          taskType: classification.taskType,
          executorUsed: 'mcp',
          success: mcpResult.success,
          tokensUsed: 0,
          duration: mcpResult.duration,
        });

        if (mcpResult.success) {
          return {
            success: true,
            output: mcpResult.output,
            metadata: {
              executedBy: 'mcp',
              tokensUsed: 0,
              duration: mcpResult.duration,
              classification,
            },
          };
        }

        // MCP failed, fall through to AI
      }

      // 4. Execute with AI provider
      if (!params.aiExecutor) {
        throw new Error('AI executor not provided and MCP execution failed/unavailable');
      }

      // 5. Check provider health (circuit breaker)
      const availableProviders = await circuitBreaker.getAllStatus();
      const healthyProvider = availableProviders.find(p => p.canAcceptRequests);

      if (!healthyProvider) {
        throw new Error('No healthy AI providers available');
      }

      // 6. Queue if needed
      const queueId = await priorityQueue.enqueue({
        userId: params.userId,
        projectId: params.projectId,
        priority: params.priority || 'normal',
        taskType: classification.taskType,
        operation: params.operation,
        parameters: params.parameters,
        context: params.context,
      });

      // 7. Execute AI operation
      const aiResult = await params.aiExecutor({
        ...params.parameters,
        provider: healthyProvider.provider,
      });

      // Extract token usage (implementation specific)
      const tokensUsed = aiResult.tokensUsed || aiResult.usage?.totalTokens || 0;
      const provider = aiResult.provider || healthyProvider.provider;
      const model = aiResult.model || 'unknown';

      // 8. Log token usage
      await tokenUsageLogger.logUsage({
        userId: params.userId,
        projectId: params.projectId,
        sessionId: params.sessionId,
        taskType: classification.taskType,
        taskCategory: classification.category,
        provider,
        model,
        promptTokens: aiResult.promptTokens || aiResult.usage?.promptTokens || 0,
        completionTokens: aiResult.completionTokens || aiResult.usage?.completionTokens || 0,
        duration: Date.now() - startTime,
        success: true,
        metadata: {
          operation: params.operation,
          fromMcp: false,
        },
      });

      // 9. Update classification
      await taskClassifier.updateFromExecution({
        taskType: classification.taskType,
        executorUsed: 'ai',
        success: true,
        tokensUsed,
        duration: Date.now() - startTime,
      });

      // 10. Update circuit breaker
      await circuitBreaker.recordSuccess({
        provider,
        responseTime: Date.now() - startTime,
      });

      // 11. Complete queue item
      await priorityQueue.complete({
        id: queueId,
        result: {
          output: aiResult,
          tokensUsed,
        },
      });

      // 12. Cache result if applicable
      if (params.allowCache && planCache.shouldCache(params.operation)) {
        await planCache.set({
          operation: params.operation,
          context: params.context,
          plan: aiResult,
          provider,
          model,
          tokensUsed,
        });
      }

      return {
        success: true,
        output: aiResult,
        metadata: {
          executedBy: 'ai',
          provider,
          model,
          tokensUsed,
          duration: Date.now() - startTime,
          classification,
        },
      };
    } catch (error: any) {
      // Log failure
      const classification = await taskClassifier.classify({
        operation: params.operation,
        context: params.context,
      });

      await tokenUsageLogger.logUsage({
        userId: params.userId,
        projectId: params.projectId,
        sessionId: params.sessionId,
        taskType: classification.taskType,
        taskCategory: classification.category,
        provider: 'unknown',
        model: 'unknown',
        promptTokens: 0,
        completionTokens: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Get optimization metrics
   */
  async getMetrics(params: {
    userId?: string;
    projectId?: string;
    since?: Date;
  }): Promise<TokenUsageMetrics> {
    return tokenUsageLogger.getMetrics(params);
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<ProviderHealthStatus[]> {
    return circuitBreaker.getAllStatus();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    // Initialize task classifications
    await taskClassifier.initializeDefaults();

    // Initialize provider health
    const providers = ['openai', 'anthropic', 'gemini', 'xai', 'groq'];
    await Promise.all(
      providers.map(p => circuitBreaker.initializeProvider(p))
    );
  }
}

export const aiOptimizer = new AiOptimizationOrchestrator();

// Export individual services
export {
  tokenUsageLogger,
  taskClassifier,
  mcpRouter,
  circuitBreaker,
  priorityQueue,
  requestDebouncer,
  planCache,
};

// Export all services as single object for convenience
export const aiOptimization = {
  tokenUsageLogger,
  taskClassifier,
  mcpRouter,
  circuitBreaker,
  priorityQueue,
  requestDebouncer,
  planCache,
  optimizer: aiOptimizer,
};
