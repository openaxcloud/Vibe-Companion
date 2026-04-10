/**
 * Provider Latency Monitor - Smart Fallback Decisions
 * 
 * Tracks real-time latency metrics for all AI providers:
 * - Rolling average latency per provider/model
 * - P50, P95, P99 latency percentiles
 * - Error rate tracking
 * - Automatic provider ranking for fallback decisions
 * - Prometheus-compatible metrics export
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('provider-latency-monitor');

export interface LatencyRecord {
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  tokensGenerated?: number;
  errorType?: string;
}

export interface ProviderStats {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  tokensPerSecond: number;
  lastUpdated: number;
  healthScore: number;
}

export interface ModelStats extends ProviderStats {
  model: string;
}

export interface FallbackRecommendation {
  primaryProvider: string;
  fallbackOrder: string[];
  reason: string;
  confidence: number;
}

const LATENCY_WINDOW_SIZE = 100;
const LATENCY_RETENTION_MS = 3600000;
const HEALTH_CHECK_INTERVAL_MS = 60000;

class ProviderLatencyMonitor {
  private latencyRecords: Map<string, LatencyRecord[]> = new Map();
  private providerStats: Map<string, ProviderStats> = new Map();
  private modelStats: Map<string, ModelStats> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private readonly providers = ['openai', 'anthropic', 'gemini', 'xai', 'moonshot'];

  constructor() {
    this.initializeProviders();
    this.startHealthCheck();
  }

  private initializeProviders(): void {
    for (const provider of this.providers) {
      this.providerStats.set(provider, this.createEmptyStats(provider));
      this.latencyRecords.set(provider, []);
    }
  }

  private createEmptyStats(provider: string): ProviderStats {
    return {
      provider,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      tokensPerSecond: 0,
      lastUpdated: Date.now(),
      healthScore: 100,
    };
  }

  recordLatency(
    provider: string,
    model: string,
    latencyMs: number,
    success: boolean,
    tokensGenerated?: number,
    errorType?: string
  ): void {
    const record: LatencyRecord = {
      provider,
      model,
      latencyMs,
      timestamp: Date.now(),
      success,
      tokensGenerated,
      errorType,
    };

    let records = this.latencyRecords.get(provider);
    if (!records) {
      records = [];
      this.latencyRecords.set(provider, records);
    }

    records.push(record);

    if (records.length > LATENCY_WINDOW_SIZE) {
      records.shift();
    }

    this.updateProviderStats(provider);
    this.updateModelStats(provider, model);

    logger.debug('Latency recorded', { 
      provider, 
      model, 
      latencyMs, 
      success,
      tokensGenerated 
    });
  }

  private updateProviderStats(provider: string): void {
    const records = this.latencyRecords.get(provider);
    if (!records || records.length === 0) return;

    const now = Date.now();
    const recentRecords = records.filter(r => now - r.timestamp < LATENCY_RETENTION_MS);

    const successfulRecords = recentRecords.filter(r => r.success);
    const latencies = successfulRecords.map(r => r.latencyMs).sort((a, b) => a - b);

    const stats = this.providerStats.get(provider) || this.createEmptyStats(provider);

    stats.totalRequests = recentRecords.length;
    stats.successfulRequests = successfulRecords.length;
    stats.failedRequests = recentRecords.filter(r => !r.success).length;
    stats.errorRate = stats.totalRequests > 0 
      ? (stats.failedRequests / stats.totalRequests) * 100 
      : 0;

    if (latencies.length > 0) {
      stats.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      stats.minLatencyMs = latencies[0];
      stats.maxLatencyMs = latencies[latencies.length - 1];
      stats.p50LatencyMs = this.percentile(latencies, 50);
      stats.p95LatencyMs = this.percentile(latencies, 95);
      stats.p99LatencyMs = this.percentile(latencies, 99);

      const totalTokens = successfulRecords.reduce((sum, r) => sum + (r.tokensGenerated || 0), 0);
      const totalTimeSeconds = successfulRecords.reduce((sum, r) => sum + r.latencyMs, 0) / 1000;
      stats.tokensPerSecond = totalTimeSeconds > 0 
        ? Math.round(totalTokens / totalTimeSeconds) 
        : 0;
    }

    stats.healthScore = this.calculateHealthScore(stats);
    stats.lastUpdated = now;

    this.providerStats.set(provider, stats);
  }

  private updateModelStats(provider: string, model: string): void {
    const key = `${provider}:${model}`;
    const allRecords = this.latencyRecords.get(provider) || [];
    const modelRecords = allRecords.filter(r => r.model === model);

    if (modelRecords.length === 0) return;

    const now = Date.now();
    const recentRecords = modelRecords.filter(r => now - r.timestamp < LATENCY_RETENTION_MS);
    const successfulRecords = recentRecords.filter(r => r.success);
    const latencies = successfulRecords.map(r => r.latencyMs).sort((a, b) => a - b);

    const stats: ModelStats = {
      provider,
      model,
      totalRequests: recentRecords.length,
      successfulRequests: successfulRecords.length,
      failedRequests: recentRecords.filter(r => !r.success).length,
      errorRate: recentRecords.length > 0 
        ? (recentRecords.filter(r => !r.success).length / recentRecords.length) * 100 
        : 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      tokensPerSecond: 0,
      lastUpdated: now,
      healthScore: 100,
    };

    if (latencies.length > 0) {
      stats.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      stats.minLatencyMs = latencies[0];
      stats.maxLatencyMs = latencies[latencies.length - 1];
      stats.p50LatencyMs = this.percentile(latencies, 50);
      stats.p95LatencyMs = this.percentile(latencies, 95);
      stats.p99LatencyMs = this.percentile(latencies, 99);
    }

    stats.healthScore = this.calculateHealthScore(stats);
    this.modelStats.set(key, stats);
  }

  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
  }

  private calculateHealthScore(stats: ProviderStats): number {
    let score = 100;

    score -= stats.errorRate * 2;

    if (stats.p95LatencyMs > 10000) score -= 20;
    else if (stats.p95LatencyMs > 5000) score -= 10;
    else if (stats.p95LatencyMs > 2000) score -= 5;

    if (stats.totalRequests < 5) {
      score = Math.min(score, 50);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.cleanupOldRecords();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private cleanupOldRecords(): void {
    const now = Date.now();
    for (const [provider, records] of this.latencyRecords.entries()) {
      const filtered = records.filter(r => now - r.timestamp < LATENCY_RETENTION_MS);
      this.latencyRecords.set(provider, filtered);
      this.updateProviderStats(provider);
    }
  }

  getProviderStats(provider: string): ProviderStats | null {
    return this.providerStats.get(provider) || null;
  }

  getAllProviderStats(): ProviderStats[] {
    return Array.from(this.providerStats.values());
  }

  getModelStats(provider: string, model: string): ModelStats | null {
    return this.modelStats.get(`${provider}:${model}`) || null;
  }

  getAllModelStats(): ModelStats[] {
    return Array.from(this.modelStats.values());
  }

  getFallbackRecommendation(): FallbackRecommendation {
    const stats = this.getAllProviderStats()
      .filter(s => s.totalRequests > 0)
      .sort((a, b) => b.healthScore - a.healthScore);

    if (stats.length === 0) {
      return {
        primaryProvider: 'anthropic',
        fallbackOrder: ['openai', 'gemini', 'xai', 'moonshot'],
        reason: 'No latency data available - using default order',
        confidence: 0,
      };
    }

    const primary = stats[0];
    const fallbacks = stats.slice(1).map(s => s.provider);

    const avgHealthScore = stats.reduce((sum, s) => sum + s.healthScore, 0) / stats.length;
    const confidence = Math.min(100, Math.round(
      (primary.healthScore / 100) * 
      (Math.min(primary.totalRequests, 50) / 50) * 
      100
    ));

    let reason = `${primary.provider} has best health score (${primary.healthScore})`;
    if (primary.avgLatencyMs > 0) {
      reason += `, avg latency ${primary.avgLatencyMs}ms`;
    }
    if (primary.errorRate > 0) {
      reason += `, ${primary.errorRate.toFixed(1)}% error rate`;
    }

    return {
      primaryProvider: primary.provider,
      fallbackOrder: fallbacks,
      reason,
      confidence,
    };
  }

  getPrometheusMetrics(): string {
    const lines: string[] = [
      '# HELP ai_provider_latency_ms AI provider response latency in milliseconds',
      '# TYPE ai_provider_latency_ms gauge',
    ];

    for (const stats of this.providerStats.values()) {
      lines.push(`ai_provider_latency_avg_ms{provider="${stats.provider}"} ${stats.avgLatencyMs}`);
      lines.push(`ai_provider_latency_p50_ms{provider="${stats.provider}"} ${stats.p50LatencyMs}`);
      lines.push(`ai_provider_latency_p95_ms{provider="${stats.provider}"} ${stats.p95LatencyMs}`);
      lines.push(`ai_provider_latency_p99_ms{provider="${stats.provider}"} ${stats.p99LatencyMs}`);
    }

    lines.push('');
    lines.push('# HELP ai_provider_requests_total Total AI provider requests');
    lines.push('# TYPE ai_provider_requests_total counter');

    for (const stats of this.providerStats.values()) {
      lines.push(`ai_provider_requests_total{provider="${stats.provider}",status="success"} ${stats.successfulRequests}`);
      lines.push(`ai_provider_requests_total{provider="${stats.provider}",status="failed"} ${stats.failedRequests}`);
    }

    lines.push('');
    lines.push('# HELP ai_provider_error_rate AI provider error rate percentage');
    lines.push('# TYPE ai_provider_error_rate gauge');

    for (const stats of this.providerStats.values()) {
      lines.push(`ai_provider_error_rate{provider="${stats.provider}"} ${stats.errorRate.toFixed(2)}`);
    }

    lines.push('');
    lines.push('# HELP ai_provider_health_score AI provider health score (0-100)');
    lines.push('# TYPE ai_provider_health_score gauge');

    for (const stats of this.providerStats.values()) {
      lines.push(`ai_provider_health_score{provider="${stats.provider}"} ${stats.healthScore}`);
    }

    lines.push('');
    lines.push('# HELP ai_provider_tokens_per_second AI provider tokens generated per second');
    lines.push('# TYPE ai_provider_tokens_per_second gauge');

    for (const stats of this.providerStats.values()) {
      lines.push(`ai_provider_tokens_per_second{provider="${stats.provider}"} ${stats.tokensPerSecond}`);
    }

    return lines.join('\n');
  }

  reset(): void {
    this.latencyRecords.clear();
    this.modelStats.clear();
    this.initializeProviders();
    logger.info('Latency monitor reset');
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const providerLatencyMonitor = new ProviderLatencyMonitor();
