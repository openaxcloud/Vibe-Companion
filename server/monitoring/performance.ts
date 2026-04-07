// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  error?: string;
}

interface PerformanceStats {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory
  private readonly metricsWindow = 5 * 60 * 1000; // 5 minutes window

  constructor() {
    super();
    // Clean up old metrics every minute
    setInterval(() => this.cleanupOldMetrics(), 60 * 1000);
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - this.metricsWindow;
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only the latest metrics if we exceed the limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Emit event for real-time monitoring
    this.emit('metric', metric);

    // Check for performance issues
    if (metric.responseTime > 3000) {
      this.emit('slow-response', metric);
    }

    if (metric.statusCode >= 500) {
      this.emit('server-error', metric);
    }
  }

  getStats(timeWindow?: number): Record<string, PerformanceStats> {
    const window = timeWindow || this.metricsWindow;
    const cutoff = Date.now() - window;
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    const groupedMetrics: Record<string, PerformanceMetric[]> = {};
    
    // Group metrics by endpoint and method
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groupedMetrics[key]) {
        groupedMetrics[key] = [];
      }
      groupedMetrics[key].push(metric);
    });

    const stats: Record<string, PerformanceStats> = {};

    // Calculate stats for each endpoint
    Object.entries(groupedMetrics).forEach(([key, metrics]) => {
      const [method, endpoint] = key.split(' ');
      const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
      const errorCount = metrics.filter(m => m.statusCode >= 400).length;

      stats[key] = {
        endpoint,
        method,
        count: metrics.length,
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0] || 0,
        maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
        errorCount,
        successRate: ((metrics.length - errorCount) / metrics.length) * 100,
        p50: this.percentile(responseTimes, 50),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
      };
    });

    return stats;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[index];
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    stats: any;
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    Object.values(stats).forEach(stat => {
      // Check for slow endpoints
      if (stat.p95 > 2000) {
        issues.push(`Slow endpoint: ${stat.method} ${stat.endpoint} (p95: ${stat.p95}ms)`);
        status = 'degraded';
      }

      // Check for high error rates
      if (stat.errorCount > 0 && stat.successRate < 95) {
        issues.push(`High error rate: ${stat.method} ${stat.endpoint} (${stat.successRate.toFixed(1)}% success)`);
        if (stat.successRate < 90) {
          status = 'unhealthy';
        } else if (status !== 'unhealthy') {
          status = 'degraded';
        }
      }
    });

    // Check overall metrics
    const totalRequests = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
    const totalErrors = Object.values(stats).reduce((sum, stat) => sum + stat.errorCount, 0);
    const overallSuccessRate = ((totalRequests - totalErrors) / totalRequests) * 100;

    if (overallSuccessRate < 95) {
      issues.push(`Overall success rate low: ${overallSuccessRate.toFixed(1)}%`);
      if (overallSuccessRate < 90) {
        status = 'unhealthy';
      } else if (status !== 'unhealthy') {
        status = 'degraded';
      }
    }

    return {
      status,
      issues,
      stats: {
        totalRequests,
        totalErrors,
        overallSuccessRate,
        endpointStats: stats,
      },
    };
  }

  // Get metrics for real-time dashboard
  getRealtimeMetrics(limit = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  // Get aggregated metrics for charts
  getTimeSeriesData(interval = 60000): any[] { // 1 minute intervals
    const now = Date.now();
    const data: any[] = [];
    
    for (let i = 0; i < 10; i++) { // Last 10 intervals
      const end = now - (i * interval);
      const start = end - interval;
      
      const intervalMetrics = this.metrics.filter(m => {
        const time = m.timestamp.getTime();
        return time >= start && time < end;
      });

      if (intervalMetrics.length > 0) {
        const avgResponseTime = intervalMetrics.reduce((sum, m) => sum + m.responseTime, 0) / intervalMetrics.length;
        const errorCount = intervalMetrics.filter(m => m.statusCode >= 400).length;
        
        data.unshift({
          timestamp: new Date(end),
          requests: intervalMetrics.length,
          avgResponseTime,
          errorCount,
          errorRate: (errorCount / intervalMetrics.length) * 100,
        });
      }
    }

    return data;
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to capture timing
  res.send = function(data: any) {
    res.send = originalSend;
    recordMetric();
    return res.send(data);
  };

  res.json = function(data: any) {
    res.json = originalJson;
    recordMetric();
    return res.json(data);
  };

  function recordMetric() {
    const responseTime = Date.now() - start;
    const metric: PerformanceMetric = {
      endpoint: req.route ? req.route.path : req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    // Add error message if status code indicates error
    if (res.statusCode >= 400 && res.locals.error) {
      metric.error = res.locals.error;
    }

    performanceMonitor.recordMetric(metric);
  }

  next();
}

// Helper to mark errors in response locals
export function markError(res: Response, error: string) {
  res.locals.error = error;
}