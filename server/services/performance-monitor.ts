// @ts-nocheck
/**
 * Performance Monitoring Service
 * Fortune 500-grade performance tracking
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { monitoringService } from './monitoring-service';
import os from 'os';

const logger = createLogger('performance-monitor');

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private thresholds = {
    responseTime: 1000, // 1 second
    cpuUsage: 80, // 80%
    memoryUsage: 90, // 90%
    errorRate: 5 // 5%
  };

  constructor() {
    this.startSystemMonitoring();
  }

  // Request timing middleware
  requestTimer() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      const path = req.path;
      const method = req.method;

      // Track response
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        
        // Record metric
        const key = `${method}:${path}`;
        const metric = this.getOrCreateMetric(key);
        metric.count++;
        metric.totalTime += duration;
        metric.averageTime = metric.totalTime / metric.count;
        metric.lastTime = duration;
        
        if (duration > metric.maxTime) {
          metric.maxTime = duration;
        }
        
        if (metric.minTime === 0 || duration < metric.minTime) {
          metric.minTime = duration;
        }

        // Alert on slow requests
        if (duration > this.thresholds.responseTime) {
          logger.warn('Slow request detected', {
            method,
            path,
            duration: Math.round(duration),
            threshold: this.thresholds.responseTime
          });
        }

        // Track to monitoring service
        monitoringService.trackPerformance(
          'request_duration',
          duration,
          'milliseconds',
          { method, path, status: res.statusCode.toString() }
        );

        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  // System monitoring
  private startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  private async collectSystemMetrics() {
    try {
      // CPU Usage
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 * 100;
      
      // Memory Usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const memPercent = (memUsage.heapUsed / totalMem) * 100;
      
      // Event Loop Lag
      const eventLoopLag = await this.measureEventLoopLag();
      
      // Record metrics
      this.recordSystemMetric('cpu_usage', cpuPercent, '%');
      this.recordSystemMetric('memory_usage', memPercent, '%');
      this.recordSystemMetric('heap_used', memUsage.heapUsed / 1024 / 1024, 'MB');
      this.recordSystemMetric('event_loop_lag', eventLoopLag, 'ms');
      
      // Alert on high usage
      if (cpuPercent > this.thresholds.cpuUsage) {
        logger.warn('High CPU usage detected', { usage: cpuPercent });
      }
      
      if (memPercent > this.thresholds.memoryUsage) {
        logger.warn('High memory usage detected', { usage: memPercent });
      }
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000;
        resolve(lag);
      });
    });
  }

  private recordSystemMetric(name: string, value: number, unit: string) {
    const metric = this.getOrCreateMetric(name);
    metric.count++;
    metric.lastTime = value;
    metric.totalTime += value;
    metric.averageTime = metric.totalTime / metric.count;
    
    // Track to monitoring service
    monitoringService.trackPerformance(name, value, unit);
  }

  private getOrCreateMetric(key: string): PerformanceMetric {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: 0,
        lastTime: 0
      });
    }
    return this.metrics.get(key)!;
  }

  // Get performance report
  getReport(): PerformanceReport {
    const endpointMetrics: Record<string, EndpointMetric> = {};
    const systemMetrics: Record<string, number> = {};
    
    for (const [key, metric] of this.metrics) {
      if (key.includes(':')) {
        // Endpoint metric
        endpointMetrics[key] = {
          requests: metric.count,
          avgResponseTime: Math.round(metric.averageTime),
          maxResponseTime: Math.round(metric.maxTime),
          minResponseTime: Math.round(metric.minTime)
        };
      } else {
        // System metric
        systemMetrics[key] = Math.round(metric.lastTime);
      }
    }
    
    return {
      endpoints: endpointMetrics,
      system: systemMetrics,
      timestamp: new Date().toISOString()
    };
  }

  // Reset metrics
  reset() {
    this.metrics.clear();
    logger.info('Performance metrics reset');
  }

  // Get slow endpoints
  getSlowEndpoints(threshold: number = 500): string[] {
    const slow: string[] = [];
    
    for (const [key, metric] of this.metrics) {
      if (key.includes(':') && metric.averageTime > threshold) {
        slow.push(`${key} (avg: ${Math.round(metric.averageTime)}ms)`);
      }
    }
    
    return slow;
  }

  // Health check
  isHealthy(): boolean {
    const report = this.getReport();
    const cpuUsage = report.system.cpu_usage || 0;
    const memUsage = report.system.memory_usage || 0;
    
    return cpuUsage < this.thresholds.cpuUsage && 
           memUsage < this.thresholds.memoryUsage;
  }
}

// Interfaces
interface PerformanceMetric {
  count: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  lastTime: number;
}

interface EndpointMetric {
  requests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
}

interface PerformanceReport {
  endpoints: Record<string, EndpointMetric>;
  system: Record<string, number>;
  timestamp: string;
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();