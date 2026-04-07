// @ts-nocheck
/**
 * AI Optimization Router
 * Endpoints for queue management, circuit breaker, and token usage monitoring
 */

import { Router } from 'express';
import { z } from 'zod';
import { aiOptimization } from '../services/ai-optimization';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { promptCacheManager } from '../ai/prompt-cache-manager';
import { batchAPIManager } from '../ai/batch-api-manager';
import { providerLatencyMonitor } from '../ai/provider-latency-monitor';

const router = Router();

// ============================================================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================================================

/**
 * GET /api/ai-optimization/metrics/prometheus
 * Public endpoint for Prometheus scraping - no auth required
 */
router.get('/metrics/prometheus', async (req, res) => {
  try {
    const metrics = providerLatencyMonitor.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error: any) {
    res.status(500).send(`# Error: ${error.message}`);
  }
});

// ============================================================================
// AUTHENTICATED ENDPOINTS
// ============================================================================
router.use(ensureAuthenticated);

/**
 * POST /api/ai-optimization/queue/enqueue
 * Add a request to the priority queue (admin only)
 */
router.post('/queue/enqueue', ensureAdmin, async (req, res) => {
  try {
    const schema = z.object({
      priority: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
      taskType: z.enum([
        'build', 'test', 'format', 'typecheck', 'lint', 'migration', 'file_operation',
        'plan_generation', 'code_suggestion', 'bug_fix', 'refactoring', 'architecture',
        'conversation', 'other'
      ] as const),
      operation: z.string(),
      parameters: z.record(z.any()),
      context: z.record(z.any()).optional(),
      metadata: z.object({
        debounced: z.boolean().optional(),
        cacheKey: z.string().optional(),
        estimatedTokens: z.number().optional(),
      }).optional(),
    });

    const data = schema.parse(req.body);

    const requestId = await aiOptimization.priorityQueue.enqueue({
      userId: req.user!.id,
      projectId: req.body.projectId,
      ...data,
    });

    res.json({ 
      success: true, 
      requestId,
      message: 'Request queued successfully'
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/queue/dequeue
 * Dequeue next request (admin only)
 */
router.post('/queue/dequeue', ensureAdmin, async (req, res) => {
  try {
    const request = await aiOptimization.priorityQueue.dequeue();
    
    if (!request) {
      return res.json({ 
        success: true, 
        request: null,
        message: 'Queue is empty' 
      });
    }

    res.json({ 
      success: true, 
      request 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/queue/complete
 * Mark request as completed (admin only)
 */
router.post('/queue/complete', ensureAdmin, async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
      result: z.object({
        output: z.any().optional(),
        tokensUsed: z.number().optional(),
      }),
    });

    const data = schema.parse(req.body);
    await aiOptimization.priorityQueue.complete(data);

    res.json({ 
      success: true, 
      message: 'Request marked as completed' 
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/queue/fail
 * Mark request as failed (admin only)
 */
router.post('/queue/fail', ensureAdmin, async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
      error: z.string(),
      shouldRetry: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    await aiOptimization.priorityQueue.fail(data);

    res.json({ 
      success: true, 
      message: 'Request marked as failed' 
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/queue/stats
 * Get queue statistics (admin only)
 */
router.get('/queue/stats', ensureAdmin, async (req, res) => {
  try {
    const stats = await aiOptimization.priorityQueue.getQueueStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/circuit-breaker/status
 * Get all providers health status (admin only)
 */
router.get('/circuit-breaker/status', ensureAdmin, async (req, res) => {
  try {
    const statuses = await aiOptimization.circuitBreaker.getAllStatus();
    res.json(statuses);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/circuit-breaker/reset
 * Manually reset circuit for a provider (admin only)
 */
router.post('/circuit-breaker/reset/:provider', ensureAdmin, async (req, res) => {
  try {
    await aiOptimization.circuitBreaker.resetCircuit(req.params.provider);
    res.json({ 
      success: true, 
      message: `Circuit reset for ${req.params.provider}` 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/token-usage/summary
 * Get token usage summary with cost analysis (admin only)
 */
router.get('/token-usage/summary', ensureAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const summary = await aiOptimization.tokenUsageLogger.getUsageSummary(days);
    
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/token-usage/by-provider
 * Get token usage breakdown by provider (admin only)
 */
router.get('/token-usage/by-provider', ensureAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const breakdown = await aiOptimization.tokenUsageLogger.getProviderBreakdown(days);
    
    res.json(breakdown);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/task-classification/stats
 * Get task classification statistics (admin only)
 */
router.get('/task-classification/stats', ensureAdmin, async (req, res) => {
  try {
    const stats = await aiOptimization.taskClassifier.getAllClassifications();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/dashboard
 * Get comprehensive dashboard data (admin only)
 */
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    const [
      queueStats,
      circuitBreakerStatus,
      tokenUsageSummary,
      classificationStats,
    ] = await Promise.all([
      aiOptimization.priorityQueue.getQueueStats(),
      aiOptimization.circuitBreaker.getAllStatus(),
      aiOptimization.tokenUsageLogger.getUsageSummary(7),
      aiOptimization.taskClassifier.getAllClassifications(),
    ]);

    res.json({
      queueStats,
      circuitBreakers: circuitBreakerStatus,
      tokenUsage: tokenUsageSummary,
      taskClassifications: classificationStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/prompt-cache/metrics
 * Get prompt cache metrics for cost analysis (admin only)
 * Returns: hit rates, tokens saved, estimated cost savings
 */
router.get('/prompt-cache/metrics', ensureAdmin, async (req, res) => {
  try {
    const metrics = promptCacheManager.getMetrics();
    const stats = promptCacheManager.getCacheStats();
    
    res.json({
      success: true,
      metrics: {
        systemPromptCache: {
          hits: metrics.systemPromptHits,
          misses: metrics.systemPromptMisses,
          hitRate: metrics.systemPromptHits + metrics.systemPromptMisses > 0
            ? (metrics.systemPromptHits / (metrics.systemPromptHits + metrics.systemPromptMisses) * 100).toFixed(2) + '%'
            : '0%',
          size: stats.systemPromptCacheSize,
        },
        responseCache: {
          hits: metrics.responseHits,
          misses: metrics.responseMisses,
          hitRate: metrics.responseHits + metrics.responseMisses > 0
            ? (metrics.responseHits / (metrics.responseHits + metrics.responseMisses) * 100).toFixed(2) + '%'
            : '0%',
          size: stats.responseCacheSize,
        },
        costSavings: {
          totalTokensSaved: metrics.totalTokensSaved,
          totalCostSaved: `$${metrics.totalCostSaved.toFixed(4)}`,
          estimatedMonthlySavings: `$${stats.estimatedMonthlySavings.toFixed(2)}`,
        },
        overallHitRate: stats.hitRate + '%',
        cacheSize: metrics.cacheSize,
        cacheAgeRange: {
          oldest: new Date(metrics.oldestEntry).toISOString(),
          newest: new Date(metrics.newestEntry).toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/prompt-cache/clear
 * Clear prompt cache (admin only)
 * Query params: type = 'system' | 'response' | 'all' (default: 'all')
 */
router.post('/prompt-cache/clear', ensureAdmin, async (req, res) => {
  try {
    const type = (req.query.type as 'system' | 'response' | 'all') || 'all';
    promptCacheManager.clearCache(type);
    
    res.json({
      success: true,
      message: `Prompt cache cleared (type: ${type})`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/prompt-cache/warm
 * Pre-warm cache with common system prompts (admin only)
 */
router.post('/prompt-cache/warm', ensureAdmin, async (req, res) => {
  try {
    const schema = z.object({
      prompts: z.array(z.string()).optional(),
    });
    
    const data = schema.parse(req.body);
    
    if (data.prompts && data.prompts.length > 0) {
      promptCacheManager.warmCache(data.prompts);
    } else {
      const { warmSystemPromptCache } = await import('../ai/prompt-cache-manager');
      warmSystemPromptCache();
    }
    
    const stats = promptCacheManager.getCacheStats();
    
    res.json({
      success: true,
      message: 'Cache warmed successfully',
      cacheSize: stats.systemPromptCacheSize,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// BATCH API ENDPOINTS - 50% Cost Reduction for Non-Urgent Tasks
// ============================================================================

/**
 * POST /api/ai-optimization/batch/queue
 * Queue a task for batch processing (50% cost reduction)
 */
router.post('/batch/queue', ensureAuthenticated, async (req, res) => {
  try {
    if (!batchAPIManager.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Batch API not available - OpenAI API key not configured',
      });
    }

    const schema = z.object({
      model: z.string(),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })),
      priority: z.enum(['low', 'normal']).optional(),
    });

    const data = schema.parse(req.body);
    const taskId = await batchAPIManager.queueTask(data.model, data.messages, {
      priority: data.priority,
    });

    res.json({
      success: true,
      taskId,
      message: 'Task queued for batch processing (50% cost savings)',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/batch/status/:taskId
 * Get status of a batch task
 */
router.get('/batch/status/:taskId', ensureAuthenticated, async (req, res) => {
  try {
    const task = await batchAPIManager.getTaskStatus(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      task,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/batch/metrics
 * Get batch API metrics (admin only)
 */
router.get('/batch/metrics', ensureAdmin, async (req, res) => {
  try {
    const metrics = batchAPIManager.getMetrics();
    const pendingTasks = batchAPIManager.getPendingTasks();
    const allBatches = batchAPIManager.getAllBatches();

    res.json({
      success: true,
      metrics,
      pendingTaskCount: pendingTasks.length,
      batchJobCount: allBatches.length,
      recentBatches: allBatches.slice(-10).map(b => ({
        id: b.id,
        status: b.status,
        taskCount: b.tasks.length,
        costSaved: b.totalCostSaved,
        createdAt: new Date(b.createdAt).toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// PROVIDER LATENCY MONITORING - Smart Fallback Decisions
// ============================================================================

/**
 * GET /api/ai-optimization/latency/providers
 * Get latency stats for all providers
 */
router.get('/latency/providers', ensureAuthenticated, async (req, res) => {
  try {
    const stats = providerLatencyMonitor.getAllProviderStats();
    const recommendation = providerLatencyMonitor.getFallbackRecommendation();

    res.json({
      success: true,
      providers: stats,
      fallbackRecommendation: recommendation,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/latency/models
 * Get latency stats for all models
 */
router.get('/latency/models', ensureAuthenticated, async (req, res) => {
  try {
    const stats = providerLatencyMonitor.getAllModelStats();

    res.json({
      success: true,
      models: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/ai-optimization/latency/provider/:provider
 * Get latency stats for a specific provider
 */
router.get('/latency/provider/:provider', ensureAuthenticated, async (req, res) => {
  try {
    const stats = providerLatencyMonitor.getProviderStats(req.params.provider);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    res.json({
      success: true,
      provider: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai-optimization/latency/reset
 * Reset latency data (admin only)
 */
router.post('/latency/reset', ensureAdmin, async (req, res) => {
  try {
    providerLatencyMonitor.reset();

    res.json({
      success: true,
      message: 'Latency data reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
