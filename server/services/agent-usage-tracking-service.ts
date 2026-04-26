import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('AgentUsageTrackingService');

export interface AgentUsageMetrics {
  projectId: number;
  userId: number;
  conversationId?: string;
  taskId?: string;
  timestamp: Date;
  tokensUsed: number;
  model: string;
  cost: number; // in cents
  responseTime: number; // in ms
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
  apiCalls: number;
  errors: number;
  features: {
    webContentImport?: number;
    screenshotCapture?: number;
    promptRefinement?: number;
    checkpointCreated?: number;
    feedbackSubmitted?: number;
  };
}

export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  totalApiCalls: number;
  totalErrors: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
  peakCpuUsage: number;
  modelUsage: Record<string, {
    tokens: number;
    cost: number;
    calls: number;
  }>;
  featureUsage: Record<string, number>;
  hourlyBreakdown: Array<{
    hour: string;
    tokens: number;
    cost: number;
    calls: number;
  }>;
}

export interface RealtimeUsage {
  currentTokens: number;
  currentCost: number;
  activeConversations: number;
  activeTasks: number;
  memoryUsage: number;
  cpuUsage: number;
  apiCallsInProgress: number;
  lastUpdateTime: Date;
}

export class AgentUsageTrackingService extends EventEmitter {
  private usageMetrics: Map<string, AgentUsageMetrics> = new Map();
  private projectUsage: Map<number, AgentUsageMetrics[]> = new Map();
  private userUsage: Map<number, AgentUsageMetrics[]> = new Map();
  private realtimeUsage: Map<number, RealtimeUsage> = new Map();
  private metricsBuffer: AgentUsageMetrics[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startFlushInterval();
  }

  private startFlushInterval() {
    // Flush metrics buffer every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, 30000);
  }

  async trackUsage(params: {
    projectId: number;
    userId: number;
    conversationId?: string;
    taskId?: string;
    tokensUsed: number;
    model: string;
    responseTime: number;
    features?: AgentUsageMetrics['features'];
  }): Promise<void> {
    const cost = this.calculateCost(params.tokensUsed, params.model);
    
    const metrics: AgentUsageMetrics = {
      projectId: params.projectId,
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      timestamp: new Date(),
      tokensUsed: params.tokensUsed,
      model: params.model,
      cost,
      responseTime: params.responseTime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000000, // percentage approximation
      apiCalls: 1,
      errors: 0,
      features: params.features || {}
    };

    // Add to buffer
    this.metricsBuffer.push(metrics);

    // Update realtime usage
    this.updateRealtimeUsage(params.projectId, metrics);

    // Emit usage event
    this.emit('usage', {
      projectId: params.projectId,
      userId: params.userId,
      metrics
    });

    logger.info(`Tracked usage: ${params.tokensUsed} tokens for project ${params.projectId}`);
  }

  async trackError(params: {
    projectId: number;
    userId: number;
    conversationId?: string;
    taskId?: string;
    error: string;
  }): Promise<void> {
    const metrics: AgentUsageMetrics = {
      projectId: params.projectId,
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      timestamp: new Date(),
      tokensUsed: 0,
      model: 'error',
      cost: 0,
      responseTime: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: process.cpuUsage().user / 1000000,
      apiCalls: 0,
      errors: 1,
      features: {}
    };

    this.metricsBuffer.push(metrics);
    logger.error(`Tracked error for project ${params.projectId}: ${params.error}`);
  }

  async getRealtimeUsage(projectId: number): Promise<RealtimeUsage> {
    if (!this.realtimeUsage.has(projectId)) {
      this.realtimeUsage.set(projectId, {
        currentTokens: 0,
        currentCost: 0,
        activeConversations: 0,
        activeTasks: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        apiCallsInProgress: 0,
        lastUpdateTime: new Date()
      });
    }

    return this.realtimeUsage.get(projectId)!;
  }

  async getUsageSummary(projectId: number, params?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week';
  }): Promise<UsageSummary> {
    await this.flushMetricsBuffer();

    const projectMetrics = this.projectUsage.get(projectId) || [];
    const filteredMetrics = this.filterMetricsByDate(projectMetrics, params);

    // Calculate summary
    const summary: UsageSummary = {
      totalTokens: 0,
      totalCost: 0,
      totalApiCalls: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      peakCpuUsage: 0,
      modelUsage: {},
      featureUsage: {},
      hourlyBreakdown: []
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const metric of filteredMetrics) {
      summary.totalTokens += metric.tokensUsed;
      summary.totalCost += metric.cost;
      summary.totalApiCalls += metric.apiCalls;
      summary.totalErrors += metric.errors;

      if (metric.responseTime > 0) {
        totalResponseTime += metric.responseTime;
        responseTimeCount++;
      }

      // Track peak usage
      if (metric.memoryUsage > summary.peakMemoryUsage) {
        summary.peakMemoryUsage = metric.memoryUsage;
      }
      if (metric.cpuUsage > summary.peakCpuUsage) {
        summary.peakCpuUsage = metric.cpuUsage;
      }

      // Model usage
      if (metric.model !== 'error') {
        if (!summary.modelUsage[metric.model]) {
          summary.modelUsage[metric.model] = {
            tokens: 0,
            cost: 0,
            calls: 0
          };
        }
        summary.modelUsage[metric.model].tokens += metric.tokensUsed;
        summary.modelUsage[metric.model].cost += metric.cost;
        summary.modelUsage[metric.model].calls += metric.apiCalls;
      }

      // Feature usage
      for (const [feature, count] of Object.entries(metric.features)) {
        summary.featureUsage[feature] = (summary.featureUsage[feature] || 0) + count;
      }
    }

    // Calculate average response time
    if (responseTimeCount > 0) {
      summary.averageResponseTime = totalResponseTime / responseTimeCount;
    }

    // Generate hourly breakdown
    summary.hourlyBreakdown = this.generateHourlyBreakdown(filteredMetrics);

    return summary;
  }

  async getUserUsageSummary(userId: number, params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<UsageSummary> {
    await this.flushMetricsBuffer();

    const userMetrics = this.userUsage.get(userId) || [];
    const filteredMetrics = this.filterMetricsByDate(userMetrics, params);

    // Reuse the same summary calculation logic
    return this.calculateSummaryFromMetrics(filteredMetrics);
  }

  async getUsageAlerts(projectId: number): Promise<Array<{
    type: 'cost' | 'tokens' | 'errors' | 'performance';
    severity: 'low' | 'medium' | 'high';
    message: string;
    value: number;
    threshold: number;
    timestamp: Date;
  }>> {
    const alerts: Array<any> = [];
    const summary = await this.getUsageSummary(projectId, {
      startDate: new Date(Date.now() - 3600000) // Last hour
    });

    // Cost alert
    if (summary.totalCost > 5000) { // $50
      alerts.push({
        type: 'cost',
        severity: 'high',
        message: 'High cost in the last hour',
        value: summary.totalCost,
        threshold: 5000,
        timestamp: new Date()
      });
    } else if (summary.totalCost > 2000) { // $20
      alerts.push({
        type: 'cost',
        severity: 'medium',
        message: 'Moderate cost in the last hour',
        value: summary.totalCost,
        threshold: 2000,
        timestamp: new Date()
      });
    }

    // Token alert
    if (summary.totalTokens > 1000000) {
      alerts.push({
        type: 'tokens',
        severity: 'high',
        message: 'High token usage in the last hour',
        value: summary.totalTokens,
        threshold: 1000000,
        timestamp: new Date()
      });
    }

    // Error rate alert
    const errorRate = summary.totalErrors / (summary.totalApiCalls || 1);
    if (errorRate > 0.1) { // 10% error rate
      alerts.push({
        type: 'errors',
        severity: 'high',
        message: 'High error rate detected',
        value: errorRate * 100,
        threshold: 10,
        timestamp: new Date()
      });
    }

    // Performance alert
    if (summary.averageResponseTime > 5000) { // 5 seconds
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: 'Slow response times detected',
        value: summary.averageResponseTime,
        threshold: 5000,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  async exportUsageData(projectId: number, format: 'json' | 'csv'): Promise<string> {
    await this.flushMetricsBuffer();
    
    const metrics = this.projectUsage.get(projectId) || [];

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp', 'Conversation ID', 'Task ID', 'Model', 'Tokens', 
      'Cost (cents)', 'Response Time (ms)', 'Memory (MB)', 'CPU (%)', 
      'API Calls', 'Errors'
    ];
    
    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.conversationId || '',
      m.taskId || '',
      m.model,
      m.tokensUsed,
      m.cost,
      m.responseTime,
      Math.round(m.memoryUsage),
      Math.round(m.cpuUsage),
      m.apiCalls,
      m.errors
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  }

  private updateRealtimeUsage(projectId: number, metrics: AgentUsageMetrics): void {
    const realtime = this.realtimeUsage.get(projectId) || {
      currentTokens: 0,
      currentCost: 0,
      activeConversations: 0,
      activeTasks: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      apiCallsInProgress: 0,
      lastUpdateTime: new Date()
    };

    // Update realtime metrics
    realtime.currentTokens += metrics.tokensUsed;
    realtime.currentCost += metrics.cost;
    realtime.memoryUsage = metrics.memoryUsage;
    realtime.cpuUsage = metrics.cpuUsage;
    realtime.lastUpdateTime = new Date();

    // Track active conversations/tasks
    if (metrics.conversationId) {
      const activeConvs = new Set<string>();
      const recentMetrics = this.metricsBuffer.filter(
        m => m.projectId === projectId && 
             m.conversationId && 
             new Date().getTime() - m.timestamp.getTime() < 300000 // 5 minutes
      );
      recentMetrics.forEach(m => activeConvs.add(m.conversationId!));
      realtime.activeConversations = activeConvs.size;
    }

    if (metrics.taskId) {
      const activeTasks = new Set<string>();
      const recentMetrics = this.metricsBuffer.filter(
        m => m.projectId === projectId && 
             m.taskId && 
             new Date().getTime() - m.timestamp.getTime() < 300000 // 5 minutes
      );
      recentMetrics.forEach(m => activeTasks.add(m.taskId!));
      realtime.activeTasks = activeTasks.size;
    }

    this.realtimeUsage.set(projectId, realtime);

    // Emit realtime update
    this.emit('realtime-update', {
      projectId,
      usage: realtime
    });
  }

  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    logger.info(`Flushing ${this.metricsBuffer.length} metrics to storage`);

    // Process buffered metrics
    for (const metric of this.metricsBuffer) {
      // Add to project usage
      if (!this.projectUsage.has(metric.projectId)) {
        this.projectUsage.set(metric.projectId, []);
      }
      this.projectUsage.get(metric.projectId)!.push(metric);

      // Add to user usage
      if (!this.userUsage.has(metric.userId)) {
        this.userUsage.set(metric.userId, []);
      }
      this.userUsage.get(metric.userId)!.push(metric);
    }

    // Clear buffer
    this.metricsBuffer = [];

    // Clean up old metrics (keep last 7 days)
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [projectId, metrics] of Array.from(this.projectUsage)) {
      this.projectUsage.set(
        projectId, 
        metrics.filter((m: AgentUsageMetrics) => m.timestamp > cutoffDate)
      );
    }

    for (const [userId, metrics] of Array.from(this.userUsage)) {
      this.userUsage.set(
        userId,
        metrics.filter((m: AgentUsageMetrics) => m.timestamp > cutoffDate)
      );
    }
  }

  private calculateCost(tokens: number, model: string): number {
    // Pricing in cents per 1K tokens (December 2025)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-opus-4-7': { input: 1.5, output: 7.5 },
      'claude-sonnet-4-6': { input: 0.3, output: 1.5 },
      'claude-sonnet-4-6': { input: 0.025, output: 0.125 },
      'gpt-4o': { input: 0.5, output: 1.5 },
      'gpt-4.1': { input: 0.25, output: 1.0 },
      'gpt-4o-mini': { input: 0.015, output: 0.06 },
      'gemini-2.5-pro': { input: 0.125, output: 0.5 }
    };

    const modelPricing = pricing[model] || { input: 0.1, output: 0.1 };
    // Assume 70% input, 30% output for cost estimation
    const avgCost = (modelPricing.input * 0.7 + modelPricing.output * 0.3);
    
    return Math.ceil((tokens / 1000) * avgCost);
  }

  private filterMetricsByDate(
    metrics: AgentUsageMetrics[], 
    params?: { startDate?: Date; endDate?: Date }
  ): AgentUsageMetrics[] {
    if (!params?.startDate && !params?.endDate) return metrics;

    return metrics.filter(m => {
      if (params.startDate && m.timestamp < params.startDate) return false;
      if (params.endDate && m.timestamp > params.endDate) return false;
      return true;
    });
  }

  private generateHourlyBreakdown(metrics: AgentUsageMetrics[]): Array<{
    hour: string;
    tokens: number;
    cost: number;
    calls: number;
  }> {
    const hourlyData: Map<string, {
      tokens: number;
      cost: number;
      calls: number;
    }> = new Map();

    for (const metric of metrics) {
      const hour = metric.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { tokens: 0, cost: 0, calls: 0 });
      }

      const data = hourlyData.get(hour)!;
      data.tokens += metric.tokensUsed;
      data.cost += metric.cost;
      data.calls += metric.apiCalls;
    }

    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  private calculateSummaryFromMetrics(metrics: AgentUsageMetrics[]): UsageSummary {
    const summary: UsageSummary = {
      totalTokens: 0,
      totalCost: 0,
      totalApiCalls: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      peakCpuUsage: 0,
      modelUsage: {},
      featureUsage: {},
      hourlyBreakdown: []
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const metric of metrics) {
      summary.totalTokens += metric.tokensUsed;
      summary.totalCost += metric.cost;
      summary.totalApiCalls += metric.apiCalls;
      summary.totalErrors += metric.errors;

      if (metric.responseTime > 0) {
        totalResponseTime += metric.responseTime;
        responseTimeCount++;
      }

      if (metric.memoryUsage > summary.peakMemoryUsage) {
        summary.peakMemoryUsage = metric.memoryUsage;
      }
      if (metric.cpuUsage > summary.peakCpuUsage) {
        summary.peakCpuUsage = metric.cpuUsage;
      }

      // Model usage
      if (metric.model !== 'error') {
        if (!summary.modelUsage[metric.model]) {
          summary.modelUsage[metric.model] = {
            tokens: 0,
            cost: 0,
            calls: 0
          };
        }
        summary.modelUsage[metric.model].tokens += metric.tokensUsed;
        summary.modelUsage[metric.model].cost += metric.cost;
        summary.modelUsage[metric.model].calls += metric.apiCalls;
      }

      // Feature usage
      for (const [feature, count] of Object.entries(metric.features)) {
        summary.featureUsage[feature] = (summary.featureUsage[feature] || 0) + count;
      }
    }

    if (responseTimeCount > 0) {
      summary.averageResponseTime = totalResponseTime / responseTimeCount;
    }

    summary.hourlyBreakdown = this.generateHourlyBreakdown(metrics);

    return summary;
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushMetricsBuffer();
  }
}

export const agentUsageTrackingService = new AgentUsageTrackingService();