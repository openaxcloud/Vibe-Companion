import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { db } from '../db';

const logger = createLogger('OrchestratorMetrics');

export interface TaskMetric {
  taskType: string;
  complexity: number;
  estimatedDurationMs: number;
  actualDurationMs: number;
  estimatedTokens: number;
  actualTokens: number;
  success: boolean;
  provider: string;
  model: string;
  timestamp: Date;
}

export interface AggregatedMetrics {
  taskType: string;
  avgDurationMs: number;
  avgTokens: number;
  successRate: number;
  sampleCount: number;
  durationAccuracy: number; // How close estimates are to actual
  lastUpdated: Date;
}

class OrchestratorMetricsService extends EventEmitter {
  private metricsBuffer: TaskMetric[] = [];
  private aggregatedMetrics: Map<string, AggregatedMetrics> = new Map();
  private readonly BUFFER_FLUSH_SIZE = 50;
  private readonly MOVING_AVERAGE_WINDOW = 100;
  
  constructor() {
    super();
    logger.info('Orchestrator Metrics Service initialized');
  }
  
  // Record a task execution
  recordTaskExecution(metric: TaskMetric): void {
    // Sanitize numeric values to prevent NaN propagation
    const sanitizedMetric: TaskMetric = {
      ...metric,
      complexity: Number.isFinite(metric.complexity) ? metric.complexity : 5,
      estimatedDurationMs: Number.isFinite(metric.estimatedDurationMs) ? metric.estimatedDurationMs : 5000,
      actualDurationMs: Number.isFinite(metric.actualDurationMs) ? metric.actualDurationMs : 0,
      estimatedTokens: Number.isFinite(metric.estimatedTokens) ? metric.estimatedTokens : 0,
      actualTokens: Number.isFinite(metric.actualTokens) ? metric.actualTokens : 0
    };
    
    this.metricsBuffer.push(sanitizedMetric);
    this.updateAggregatedMetrics(sanitizedMetric);
    
    if (this.metricsBuffer.length >= this.BUFFER_FLUSH_SIZE) {
      this.flushBuffer();
    }
    
    this.emit('metric:recorded', sanitizedMetric);
  }
  
  // Update running aggregates
  private updateAggregatedMetrics(metric: TaskMetric): void {
    const key = `${metric.taskType}:${metric.provider}`;
    const existing = this.aggregatedMetrics.get(key);
    
    // Ensure numeric values are finite to prevent NaN propagation
    const actualDurationMs = Number.isFinite(metric.actualDurationMs) ? metric.actualDurationMs : 0;
    const actualTokens = Number.isFinite(metric.actualTokens) ? metric.actualTokens : 0;
    const estimatedDurationMs = Number.isFinite(metric.estimatedDurationMs) ? metric.estimatedDurationMs : 5000;
    
    if (!existing) {
      this.aggregatedMetrics.set(key, {
        taskType: metric.taskType,
        avgDurationMs: actualDurationMs,
        avgTokens: actualTokens,
        successRate: metric.success ? 1 : 0,
        sampleCount: 1,
        durationAccuracy: this.calculateAccuracy(estimatedDurationMs, actualDurationMs),
        lastUpdated: new Date()
      });
    } else {
      const n = Math.min(existing.sampleCount, this.MOVING_AVERAGE_WINDOW);
      existing.avgDurationMs = (existing.avgDurationMs * n + actualDurationMs) / (n + 1);
      existing.avgTokens = (existing.avgTokens * n + actualTokens) / (n + 1);
      existing.successRate = (existing.successRate * n + (metric.success ? 1 : 0)) / (n + 1);
      existing.durationAccuracy = (existing.durationAccuracy * n + 
        this.calculateAccuracy(estimatedDurationMs, actualDurationMs)) / (n + 1);
      existing.sampleCount++;
      existing.lastUpdated = new Date();
    }
  }
  
  private calculateAccuracy(estimated: number, actual: number): number {
    if (actual === 0) return estimated === 0 ? 1 : 0;
    return 1 - Math.abs(estimated - actual) / actual;
  }
  
  // Get improved ETA based on historical data
  getImprovedETA(taskType: string, provider: string, estimatedMs: number): {
    adjustedEstimateMs: number;
    confidence: number;
    basedOnSamples: number;
  } {
    const key = `${taskType}:${provider}`;
    const metrics = this.aggregatedMetrics.get(key);
    
    if (!metrics || metrics.sampleCount < 5) {
      return {
        adjustedEstimateMs: estimatedMs,
        confidence: 0.3,
        basedOnSamples: metrics?.sampleCount || 0
      };
    }
    
    // Blend estimated with historical average
    const historicalWeight = Math.min(metrics.sampleCount / 50, 0.7);
    const adjustedEstimate = estimatedMs * (1 - historicalWeight) + metrics.avgDurationMs * historicalWeight;
    
    return {
      adjustedEstimateMs: Math.round(adjustedEstimate),
      confidence: Math.min(0.3 + (metrics.sampleCount / 100) * 0.7, 0.95),
      basedOnSamples: metrics.sampleCount
    };
  }
  
  // Get all aggregated metrics
  getAllMetrics(): AggregatedMetrics[] {
    return Array.from(this.aggregatedMetrics.values());
  }
  
  // Get metrics for specific task type
  getMetricsForTaskType(taskType: string): AggregatedMetrics[] {
    return Array.from(this.aggregatedMetrics.values())
      .filter(m => m.taskType === taskType);
  }
  
  // Flush buffer (would persist to DB in production)
  private flushBuffer(): void {
    logger.info(`Flushing ${this.metricsBuffer.length} metrics`);
    // In production, persist to database
    this.metricsBuffer = [];
  }
  
  // Get health status
  getHealthStatus(): {
    totalSamples: number;
    uniqueTaskTypes: number;
    avgAccuracy: number;
    bufferSize: number;
  } {
    const metrics = this.getAllMetrics();
    const totalSamples = metrics.reduce((sum, m) => sum + m.sampleCount, 0);
    const avgAccuracy = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.durationAccuracy * m.sampleCount, 0) / totalSamples
      : 0;
    
    return {
      totalSamples,
      uniqueTaskTypes: new Set(metrics.map(m => m.taskType)).size,
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      bufferSize: this.metricsBuffer.length
    };
  }
}

export const orchestratorMetrics = new OrchestratorMetricsService();
