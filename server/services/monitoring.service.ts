/**
 * Production Monitoring Service
 * Real-time metrics for API latency, error rates, WebSocket connections, memory/CPU usage
 * Fortune 500-grade observability and alerting
 */

import { createLogger } from '../utils/logger';
import os from 'os';

const logger = createLogger('monitoring');

export interface MetricData {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
}

export interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
}

export interface WebSocketMetrics {
  activeConnections: number;
  totalMessages: number;
  messageRate: number;
}

class MonitoringService {
  private metrics: Map<string, MetricData[]> = new Map();
  private counters: Map<string, number> = new Map();
  private latencies: number[] = [];
  private wsConnections: Set<string> = new Set();
  private wsMessageCount: number = 0;
  private startTime: number = Date.now();
  
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly LATENCY_WINDOW = 100;

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    logger.info('Initializing production monitoring service...');
    
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Clean old metrics every 5 minutes
    setInterval(() => {
      this.cleanOldMetrics();
    }, 300000);
  }

  /**
   * Record API request
   */
  recordRequest(path: string, method: string, statusCode: number, latencyMs: number) {
    // Increment request counter
    this.incrementCounter('api_requests_total');
    this.incrementCounter(`api_requests_${method.toLowerCase()}`);
    
    // Track errors - only 5xx server errors affect health; 4xx are client errors
    if (statusCode >= 500) {
      this.incrementCounter('api_errors_total');
      this.incrementCounter(`api_errors_${Math.floor(statusCode / 100)}xx`);
    } else if (statusCode >= 400) {
      // Track 4xx separately for visibility but don't count toward health degradation
      this.incrementCounter(`api_errors_${Math.floor(statusCode / 100)}xx`);
    }
    
    // Record latency
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.LATENCY_WINDOW) {
      this.latencies.shift();
    }
    
    // Record metric
    this.recordMetric('api_latency', latencyMs, {
      path,
      method,
      status: statusCode.toString()
    });
  }

  /**
   * Record WebSocket connection
   */
  recordWebSocketConnection(connectionId: string, connected: boolean) {
    if (connected) {
      this.wsConnections.add(connectionId);
      this.incrementCounter('websocket_connections_total');
      logger.debug(`WebSocket connected: ${connectionId} (Total: ${this.wsConnections.size})`);
    } else {
      this.wsConnections.delete(connectionId);
      this.incrementCounter('websocket_disconnections_total');
      logger.debug(`WebSocket disconnected: ${connectionId} (Total: ${this.wsConnections.size})`);
    }
  }

  /**
   * Record WebSocket message
   */
  recordWebSocketMessage(type: string) {
    this.wsMessageCount++;
    this.incrementCounter('websocket_messages_total');
    this.incrementCounter(`websocket_messages_${type}`);
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // CPU usage calculation (simple approximation)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    
    const cpuUsage = 100 - (100 * totalIdle / totalTick);
    
    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        loadAverage: os.loadavg()
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: Math.round((usedMem / totalMem) * 100 * 100) / 100
      },
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Get API metrics
   */
  getApiMetrics(): ApiMetrics {
    const requestCount = this.getCounter('api_requests_total');
    const errorCount = this.getCounter('api_errors_total');
    
    // Calculate latency percentiles
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const avgLatency = sortedLatencies.length > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
      : 0;
    
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    return {
      requestCount,
      errorCount,
      averageLatency: Math.round(avgLatency * 100) / 100,
      p95Latency: sortedLatencies[p95Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0
    };
  }

  /**
   * Get WebSocket metrics
   */
  getWebSocketMetrics(): WebSocketMetrics {
    const totalMessages = this.getCounter('websocket_messages_total');
    const uptime = (Date.now() - this.startTime) / 1000;
    const messageRate = uptime > 0 ? Math.round((totalMessages / uptime) * 100) / 100 : 0;
    
    return {
      activeConnections: this.wsConnections.size,
      totalMessages,
      messageRate
    };
  }

  /**
   * Get all metrics for dashboard
   */
  getAllMetrics() {
    return {
      system: this.getSystemMetrics(),
      api: this.getApiMetrics(),
      websocket: this.getWebSocketMetrics(),
      counters: Object.fromEntries(this.counters),
      timestamp: Date.now()
    };
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit: number = 100): MetricData[] {
    const history = this.metrics.get(name) || [];
    return history.slice(-limit);
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    const data: MetricData = {
      timestamp: Date.now(),
      value,
      labels
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const history = this.metrics.get(name)!;
    history.push(data);
    
    // Limit history size
    if (history.length > this.MAX_METRICS_HISTORY) {
      history.shift();
    }
  }

  /**
   * Increment a counter
   */
  private incrementCounter(name: string, by: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + by);
  }

  /**
   * Get counter value
   */
  private getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics() {
    const metrics = this.getSystemMetrics();
    
    this.recordMetric('system_cpu_usage', metrics.cpu.usage);
    this.recordMetric('system_memory_usage', metrics.memory.percentage);
    this.recordMetric('system_load_average', metrics.cpu.loadAverage[0]);
    
    // Alert on high resource usage
    if (metrics.memory.percentage > 90) {
      logger.warn(`High memory usage: ${metrics.memory.percentage}%`);
    }
    
    if (metrics.cpu.usage > 90) {
      logger.warn(`High CPU usage: ${metrics.cpu.usage}%`);
    }
  }

  /**
   * Clean old metrics to prevent memory leaks
   */
  private cleanOldMetrics() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [name, history] of this.metrics.entries()) {
      const filtered = history.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
    
    logger.debug('Old metrics cleaned up');
  }

  /**
   * Reset all metrics (for testing)
   */
  reset() {
    this.metrics.clear();
    this.counters.clear();
    this.latencies = [];
    this.wsConnections.clear();
    this.wsMessageCount = 0;
    logger.info('Monitoring metrics reset');
  }

  /**
   * Get health check data
   */
  getHealthCheck() {
    const metrics = this.getAllMetrics();
    const isErrorRateOk = metrics.api.requestCount === 0 ||
      metrics.api.errorCount < (metrics.api.requestCount * 0.1); // <10% error rate
    const isHealthy = 
      metrics.system.memory.percentage < 95 &&
      metrics.system.cpu.usage < 95 &&
      isErrorRateOk;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      metrics,
      checks: {
        memory: metrics.system.memory.percentage < 95,
        cpu: metrics.system.cpu.usage < 95,
        errorRate: isErrorRateOk
      }
    };
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Export middleware for Express
export const monitoringMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const latency = Date.now() - startTime;
    monitoringService.recordRequest(
      req.path,
      req.method,
      res.statusCode,
      latency
    );
    return originalSend.call(this, data);
  };
  
  next();
};
