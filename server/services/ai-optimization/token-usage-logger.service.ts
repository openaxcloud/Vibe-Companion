// @ts-nocheck
/**
 * Token Usage Logger Service
 * Tracks AI token consumption by operation type for optimization insights
 */

import { db } from "../../db/drizzle";
import { aiTokenUsage, type InsertAiTokenUsage } from "../../../shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export interface TokenUsageMetrics {
  totalTokens: number;
  estimatedCost: number;
  byProvider: Record<string, { tokens: number; cost: number }>;
  byTaskType: Record<string, { tokens: number; cost: number; count: number }>;
  savings: {
    mcpExecutions: number;
    tokensAvoided: number;
    costAvoided: number;
  };
}

export class TokenUsageLoggerService {
  // Token cost estimates (per 1K tokens) - March 2026 pricing
  private static readonly COST_PER_1K_TOKENS = {
    'gpt-4.1': { prompt: 0.002, completion: 0.008 },
    'gpt-4.1-mini': { prompt: 0.0004, completion: 0.0016 },
    'gpt-4.1-nano': { prompt: 0.0001, completion: 0.0004 },
    'gpt-4o': { prompt: 0.0025, completion: 0.01 },
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'o3': { prompt: 0.01, completion: 0.04 },
    'o3-mini': { prompt: 0.0011, completion: 0.0044 },
    'o4-mini': { prompt: 0.0011, completion: 0.0044 },
    'o1': { prompt: 0.015, completion: 0.06 },
    // Anthropic
    'claude-opus-4-20250514': { prompt: 0.015, completion: 0.075 },
    'claude-sonnet-4-20250514': { prompt: 0.003, completion: 0.015 },
    'claude-sonnet-4-20250514': { prompt: 0.00025, completion: 0.00125 },
    'claude-opus-4-20250514': { prompt: 0.015, completion: 0.075 },
    // Google Gemini
    'gemini-2.5-pro': { prompt: 0.00125, completion: 0.005 },
    'gemini-2.5-flash': { prompt: 0.000075, completion: 0.0003 },
    'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },
    'gemini-2.0-flash-lite': { prompt: 0.000075, completion: 0.0003 },
    'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },
    'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
    // xAI Grok
    'grok-3': { prompt: 0.003, completion: 0.015 },
    'grok-3-mini': { prompt: 0.0003, completion: 0.0005 },
    'grok-3-fast': { prompt: 0.005, completion: 0.025 },
    // Moonshot
    'moonshot-v1-8k': { prompt: 0.0012, completion: 0.0012 },
    'moonshot-v1-32k': { prompt: 0.0024, completion: 0.0024 },
    'moonshot-v1-128k': { prompt: 0.006, completion: 0.006 },
  };

  /**
   * Log token usage for an AI operation
   */
  async logUsage(params: {
    userId?: string;
    projectId?: string;
    sessionId?: string;
    taskType: string;
    taskCategory: 'deterministic' | 'creative' | 'hybrid';
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    metadata?: {
      operation?: string;
      toolsCalled?: string[];
      cacheHit?: boolean;
      fromMcp?: boolean;
    };
  }): Promise<void> {
    const totalTokens = params.promptTokens + params.completionTokens;
    const cost = this.calculateCost(
      params.model,
      params.promptTokens,
      params.completionTokens
    );

    await db.insert(aiTokenUsage).values({
      userId: params.userId,
      projectId: params.projectId,
      sessionId: params.sessionId,
      taskType: params.taskType as any,
      taskCategory: params.taskCategory,
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      estimatedCost: cost.toString(),
      duration: params.duration,
      success: params.success ?? true,
      errorMessage: params.errorMessage,
      metadata: params.metadata || {},
    });
  }

  /**
   * Log MCP execution (tokens = 0)
   */
  async logMcpExecution(params: {
    userId?: string;
    projectId?: string;
    sessionId?: string;
    taskType: string;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    metadata?: {
      operation?: string;
      fromMcp?: boolean;
    };
  }): Promise<void> {
    await db.insert(aiTokenUsage).values({
      userId: params.userId,
      projectId: params.projectId,
      sessionId: params.sessionId,
      taskType: params.taskType as any,
      taskCategory: 'deterministic',
      provider: 'mcp',
      model: 'local-executor',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: '0',
      duration: params.duration,
      success: params.success ?? true,
      errorMessage: params.errorMessage,
      metadata: { ...params.metadata, fromMcp: true },
    });
  }

  /**
   * Get usage summary for dashboard (last N days)
   */
  async getUsageSummary(days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const metrics = await this.getMetrics({ since });
    
    return {
      totalTokens: metrics.totalTokens,
      totalCost: metrics.estimatedCost,
      avgTokensPerOperation: metrics.totalTokens / Math.max(1, Object.values(metrics.byTaskType).reduce((sum, t) => sum + t.count, 0)),
      operationCount: Object.values(metrics.byTaskType).reduce((sum, t) => sum + t.count, 0),
      byTaskType: metrics.byTaskType,
      savings: metrics.savings,
    };
  }

  /**
   * Get provider breakdown for cost analysis
   */
  async getProviderBreakdown(days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const metrics = await this.getMetrics({ since });
    
    return Object.entries(metrics.byProvider).map(([provider, data]) => ({
      provider,
      tokens: data.tokens,
      cost: data.cost,
      count: 1, // getMetrics doesn't track count per provider, estimate
    }));
  }

  /**
   * Get usage metrics for a time period
   */
  async getMetrics(params: {
    userId?: string;
    projectId?: string;
    since?: Date;
  }): Promise<TokenUsageMetrics> {
    const conditions = [];
    if (params.userId) conditions.push(eq(aiTokenUsage.userId, params.userId));
    if (params.projectId) conditions.push(eq(aiTokenUsage.projectId, params.projectId));
    if (params.since) conditions.push(gte(aiTokenUsage.timestamp, params.since));

    const records = await db
      .select()
      .from(aiTokenUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiTokenUsage.timestamp))
      .limit(10000);

    const byProvider: Record<string, { tokens: number; cost: number }> = {};
    const byTaskType: Record<string, { tokens: number; cost: number; count: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;
    let mcpExecutions = 0;
    let tokensAvoided = 0;

    for (const record of records) {
      const cost = parseFloat(record.estimatedCost || '0');
      
      if (record.provider === 'mcp') {
        mcpExecutions++;
        // Estimate tokens avoided (average AI task = 500 tokens)
        tokensAvoided += 500;
      } else {
        totalTokens += record.totalTokens;
        totalCost += cost;
      }

      // By provider
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { tokens: 0, cost: 0 };
      }
      byProvider[record.provider].tokens += record.totalTokens;
      byProvider[record.provider].cost += cost;

      // By task type
      if (!byTaskType[record.taskType]) {
        byTaskType[record.taskType] = { tokens: 0, cost: 0, count: 0 };
      }
      byTaskType[record.taskType].tokens += record.totalTokens;
      byTaskType[record.taskType].cost += cost;
      byTaskType[record.taskType].count += 1;
    }

    const costAvoided = tokensAvoided * 0.001; // $0.001 per 1K tokens average

    return {
      totalTokens,
      estimatedCost: totalCost,
      byProvider,
      byTaskType,
      savings: {
        mcpExecutions,
        tokensAvoided,
        costAvoided,
      },
    };
  }

  /**
   * Get top token consumers
   */
  async getTopConsumers(params: {
    since?: Date;
    limit?: number;
  }): Promise<Array<{
    taskType: string;
    totalTokens: number;
    estimatedCost: number;
    avgTokens: number;
    count: number;
  }>> {
    const sinceDate = params.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const results = await db
      .select({
        taskType: aiTokenUsage.taskType,
        totalTokens: sql<number>`sum(${aiTokenUsage.totalTokens})::int`,
        estimatedCost: sql<number>`sum(${aiTokenUsage.estimatedCost})::decimal`,
        avgTokens: sql<number>`avg(${aiTokenUsage.totalTokens})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(aiTokenUsage)
      .where(gte(aiTokenUsage.timestamp, sinceDate))
      .groupBy(aiTokenUsage.taskType)
      .orderBy(desc(sql`sum(${aiTokenUsage.totalTokens})`))
      .limit(params.limit || 20);

    return results.map(r => ({
      taskType: r.taskType,
      totalTokens: r.totalTokens || 0,
      estimatedCost: parseFloat(r.estimatedCost?.toString() || '0'),
      avgTokens: r.avgTokens || 0,
      count: r.count || 0,
    }));
  }

  /**
   * Calculate cost for a model
   */
  private calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const costs = TokenUsageLoggerService.COST_PER_1K_TOKENS[model as keyof typeof TokenUsageLoggerService.COST_PER_1K_TOKENS];
    
    if (!costs) {
      // Default cost if model not found
      return ((promptTokens + completionTokens) / 1000) * 0.001;
    }

    return (
      (promptTokens / 1000) * costs.prompt +
      (completionTokens / 1000) * costs.completion
    );
  }
}

export const tokenUsageLogger = new TokenUsageLoggerService();
