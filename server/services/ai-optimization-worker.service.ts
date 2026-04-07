// @ts-nocheck
/**
 * AI Optimization Worker Service
 * Background worker that polls the queue and executes tasks
 * Integrates circuit breaker, MCP router, and token tracking
 */

import { aiOptimization } from './ai-optimization';
import { TaskType } from './ai-optimization/task-classifier.service';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-optimization-worker');

export class AiOptimizationWorker {
  private isRunning = false;
  private pollInterval = 1000; // 1 second
  private maxConcurrent = 3; // Process 3 requests concurrently
  private currentlyProcessing = 0;

  /**
   * Start the worker
   */
  start() {
    if (this.isRunning) {
      logger.debug('[AI Optimization Worker] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[AI Optimization Worker] Starting worker...');
    this.poll();
  }

  /**
   * Stop the worker
   */
  stop() {
    this.isRunning = false;
    logger.info('[AI Optimization Worker] Stopping worker...');
  }

  /**
   * Poll queue for pending requests
   */
  private async poll() {
    while (this.isRunning) {
      try {
        // Don't exceed max concurrent processing
        if (this.currentlyProcessing < this.maxConcurrent) {
          const request = await aiOptimization.priorityQueue.dequeue();
          
          if (request) {
            this.currentlyProcessing++;
            
            // Process async without blocking the poll loop
            this.processRequest(request)
              .finally(() => {
                this.currentlyProcessing--;
              });
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      } catch (error: any) {
        logger.error('[AI Optimization Worker] Poll error:', error);
        await new Promise(resolve => setTimeout(resolve, this.pollInterval * 2));
      }
    }
  }

  /**
   * Process a single request from the queue
   */
  private async processRequest(request: any) {
    const startTime = Date.now();
    let tokensUsed = 0;
    let success = false;

    try {
      logger.info(`[AI Optimization Worker] Processing request ${request.id} (${request.taskType})`);

      // Step 1: Classify task (deterministic vs creative)
      const classification = await aiOptimization.taskClassifier.classify({
        operation: request.payload.operation,
        context: request.payload.context,
      });

      logger.info(`[AI Optimization Worker] Classification: ${classification.category} (${classification.preferredExecutor})`);

      // Step 2: Check circuit breaker if using AI
      let provider = request.provider;
      if (classification.preferredExecutor === 'ai') {
        // Find healthy provider
        const allStatus = await aiOptimization.circuitBreaker.getAllStatus();
        const healthyProviders = allStatus.filter(p => p.canAcceptRequests);
        
        if (healthyProviders.length === 0) {
          throw new Error('No healthy AI providers available');
        }

        provider = healthyProviders[0].provider;
      }

      // Step 3: Execute task based on executor
      let result;
      if (classification.preferredExecutor === 'mcp' && aiOptimization.mcpRouter.canExecuteLocally(request.taskType as TaskType)) {
        // Execute via MCP (local)
        result = await aiOptimization.mcpRouter.executeTask({
          taskType: request.taskType as TaskType,
          operation: request.payload.operation,
          projectPath: request.payload.context?.projectPath,
        });
        
        tokensUsed = 0; // MCP doesn't use tokens!
        success = result.success;
      } else {
        // Execute via AI provider using AgentOrchestrator
        const { AgentOrchestratorService } = await import('./agent-orchestrator.service');
        const orchestrator = new AgentOrchestratorService();
        
        // Create temporary session for this task
        const session = await orchestrator.createSession(
          request.userId!,
          request.projectId,
          provider || 'gpt-4.1'
        );

        try {
          // Execute AI request
          const aiResult = await orchestrator.executeAgent(
            session.id,
            [
              {
                role: 'user',
                content: `Execute task: ${request.payload.operation}\n\nParameters: ${JSON.stringify(request.payload.parameters, null, 2)}`,
              },
            ],
            request.userId!
          );

          result = {
            success: true,
            output: aiResult.message,
            duration: Date.now() - startTime,
          };

          // Fetch actual token usage from session
          const updatedSession = await db.select().from(agentSessions).where(eq(agentSessions.id, session.id)).limit(1);
          tokensUsed = updatedSession[0]?.totalTokensUsed || 0;
          success = true;
        } catch (error: any) {
          result = {
            success: false,
            output: error.message,
            duration: Date.now() - startTime,
          };
          tokensUsed = 0;
          success = false;
        } finally {
          // Cleanup temporary session
          await orchestrator.closeSession(session.id, request.userId!);
        }
      }

      // Step 4: Record success OR failure
      if (success) {
        if (classification.preferredExecutor === 'mcp') {
          await aiOptimization.circuitBreaker.recordSuccess({
            provider: 'mcp',
            responseTime: Date.now() - startTime,
          });
        } else if (provider) {
          await aiOptimization.circuitBreaker.recordSuccess({
            provider,
            responseTime: Date.now() - startTime,
          });
        }
      } else {
        // Record failure for circuit breaker (MCP + AI)
        if (classification.preferredExecutor === 'mcp') {
          await aiOptimization.circuitBreaker.recordFailure({
            provider: 'mcp',
            error: result?.output || 'Unknown error',
          });
        } else if (provider) {
          await aiOptimization.circuitBreaker.recordFailure({
            provider,
            error: result?.output || 'Unknown error',
          });
        }
      }

      // Step 5: Update classification with execution result
      await aiOptimization.taskClassifier.updateFromExecution({
        taskType: request.taskType as TaskType,
        executorUsed: classification.preferredExecutor === 'mcp' ? 'mcp' : 'ai',
        success,
        tokensUsed,
        duration: Date.now() - startTime,
      });

      // Step 6: Log token usage (if AI was used)
      if (tokensUsed > 0 && provider) {
        await aiOptimization.tokenUsageLogger.logUsage({
          userId: request.userId,
          projectId: request.projectId,
          taskType: request.taskType as TaskType,
          taskCategory: classification.category,
          provider,
          model: 'unknown', // Will be filled by AI orchestrator
          promptTokens: Math.floor(tokensUsed * 0.7), // Estimate
          completionTokens: Math.floor(tokensUsed * 0.3),
          duration: Date.now() - startTime,
          success,
          metadata: {
            operation: request.payload.operation,
            fromMcp: false,
          },
        });
      }

      // Step 7: Complete queue request
      await aiOptimization.priorityQueue.complete({
        id: request.id,
        result: {
          output: result,
          tokensUsed,
        },
      });

      logger.info(`[AI Optimization Worker] ✓ Request ${request.id} completed in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`[AI Optimization Worker] ✗ Request ${request.id} failed:`, error.message);

      // Record failure in circuit breaker
      if (request.provider) {
        await aiOptimization.circuitBreaker.recordFailure({
          provider: request.provider,
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }

      // Update classification with failure
      await aiOptimization.taskClassifier.updateFromExecution({
        taskType: request.taskType as TaskType,
        executorUsed: 'ai', // Assume AI for now
        success: false,
        tokensUsed,
        duration: Date.now() - startTime,
      });

      // Fail queue request
      await aiOptimization.priorityQueue.fail({
        id: request.id,
        error: error.message,
        shouldRetry: request.retryCount < request.maxRetries,
      });
    }
  }
}

// Singleton instance
export const aiOptimizationWorker = new AiOptimizationWorker();
