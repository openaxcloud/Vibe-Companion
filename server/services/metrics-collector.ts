// @ts-nocheck
/**
 * Metrics Collector Service
 * Collects various application and system metrics
 */

import { Request, Response, NextFunction } from 'express';
import * as os from 'os';
import { performanceMonitoringService } from './performance-monitoring';
import { createLogger } from '../utils/logger';

const logger = createLogger('metrics-collector');

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  userId?: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

export class MetricsCollector {
  private requestMetrics: RequestMetrics[] = [];
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0
  };
  private wsEventCount = 0;
  private customMetrics: Map<string, any> = new Map();

  constructor() {
    this.startSystemMetricsCollection();
  }

  private startSystemMetricsCollection() {
    // Collect system metrics every 5 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);
  }

  private collectSystemMetrics() {
    const metrics = {
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics(),
      process: this.getProcessMetrics()
    };

    // Send to performance monitoring service
    performanceMonitoringService.recordCustomMetric('system_cpu_load', metrics.cpu.loadAverage[0]);
    performanceMonitoringService.recordCustomMetric('system_memory_percent', metrics.memory.usedPercent);
    performanceMonitoringService.recordCustomMetric('process_cpu_percent', metrics.process.cpuUsage);
    performanceMonitoringService.recordCustomMetric('process_memory_mb', metrics.process.memoryUsage / (1024 * 1024));
  }

  private getCPUMetrics() {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;
    
    cpus.forEach(cpu => {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    });
    
    const total = user + nice + sys + idle + irq;
    
    return {
      count: cpus.length,
      model: cpus[0]?.model || 'unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage,
      usage: {
        user: (user / total) * 100,
        system: (sys / total) * 100,
        idle: (idle / total) * 100
      }
    };
  }

  private getMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usedPercent: (usedMem / totalMem) * 100
    };
  }

  private getNetworkMetrics() {
    const interfaces = os.networkInterfaces();
    const activeInterfaces: any[] = [];
    
    Object.keys(interfaces).forEach(name => {
      const iface = interfaces[name];
      if (iface) {
        iface.forEach(details => {
          if (!details.internal && details.family === 'IPv4') {
            activeInterfaces.push({
              name,
              address: details.address,
              mac: details.mac
            });
          }
        });
      }
    });
    
    return {
      interfaces: activeInterfaces
    };
  }

  private getProcessMetrics() {
    const usage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    return {
      pid: process.pid,
      uptime: process.uptime(),
      cpuUsage: (usage.user + usage.system) / 1000000, // Convert to seconds
      memoryUsage: memUsage.heapUsed,
      memoryTotal: memUsage.heapTotal,
      memoryExternal: memUsage.external,
      memoryArrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  // Express middleware for request/response tracking
  public requestTrackingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Store original end function
      const originalEnd = res.end;
      
      // Override end function
      const self = this; // Capture the correct 'this' context
      res.end = function(...args: any[]) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Record metrics
        const metrics: RequestMetrics = {
          method: req.method,
          path: req.path,
          statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.headers['user-agent'],
          userId: (req as any).user?.id
        };
        
        // Store request metrics
        self.requestMetrics.push(metrics);
        if (self.requestMetrics.length > 1000) {
          self.requestMetrics.shift(); // Keep last 1000 requests
        }
        
        // Send to performance monitoring
        performanceMonitoringService.recordRequest(responseTime, statusCode >= 400);
        
        // Log slow requests
        if (responseTime > 1000) {
          logger.warn(`Slow request detected: ${req.method} ${req.path} took ${responseTime}ms`);
        }
        
        // Call original end function
        return originalEnd.apply(this, args);
      }.bind(res);
      
      next();
    };
  }

  // Database query performance tracking
  public trackDatabaseQuery(query: string, duration: number) {
    performanceMonitoringService.recordDatabaseQuery(duration);
    
    if (duration > 1000) {
      logger.warn(`Slow query detected: ${query.substring(0, 100)}... took ${duration}ms`);
    }
    
    // Track custom metric for specific query types
    if (query.includes('SELECT')) {
      performanceMonitoringService.recordCustomMetric('db_select_time', duration);
    } else if (query.includes('INSERT')) {
      performanceMonitoringService.recordCustomMetric('db_insert_time', duration);
    } else if (query.includes('UPDATE')) {
      performanceMonitoringService.recordCustomMetric('db_update_time', duration);
    } else if (query.includes('DELETE')) {
      performanceMonitoringService.recordCustomMetric('db_delete_time', duration);
    }
  }

  // Cache performance tracking
  public recordCacheHit() {
    this.cacheMetrics.hits++;
    this.updateCacheHitRate();
  }

  public recordCacheMiss() {
    this.cacheMetrics.misses++;
    this.updateCacheHitRate();
  }

  private updateCacheHitRate() {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    if (total > 0) {
      this.cacheMetrics.hitRate = (this.cacheMetrics.hits / total) * 100;
      performanceMonitoringService.recordCustomMetric('cache_hit_rate', this.cacheMetrics.hitRate);
    }
  }

  public updateCacheSize(size: number) {
    this.cacheMetrics.size = size;
    performanceMonitoringService.recordCustomMetric('cache_size_mb', size / (1024 * 1024));
  }

  // WebSocket metrics
  public recordWebSocketEvent(event: string) {
    this.wsEventCount++;
    performanceMonitoringService.recordCustomMetric('ws_events_total', this.wsEventCount);
    
    // Track specific event types
    const eventKey = `ws_event_${event}`;
    const current = this.customMetrics.get(eventKey) || 0;
    this.customMetrics.set(eventKey, current + 1);
    performanceMonitoringService.recordCustomMetric(eventKey, current + 1);
  }

  public updateWebSocketConnections(count: number) {
    performanceMonitoringService.updateWebSocketConnections(count);
  }

  // Custom metric registration
  public registerCustomMetric(name: string, value: number, tags?: Record<string, string>) {
    const metricKey = tags ? `${name}_${Object.values(tags).join('_')}` : name;
    this.customMetrics.set(metricKey, value);
    performanceMonitoringService.recordCustomMetric(metricKey, value);
    
    logger.debug(`Custom metric registered: ${metricKey} = ${value}`);
  }

  // Batch custom metrics update
  public registerCustomMetrics(metrics: Record<string, number>) {
    Object.entries(metrics).forEach(([name, value]) => {
      this.registerCustomMetric(name, value);
    });
  }

  // Get current metrics summary
  public getMetricsSummary() {
    const recentRequests = this.requestMetrics.slice(-100);
    const avgResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length
      : 0;
    
    const errorRate = recentRequests.length > 0
      ? recentRequests.filter(r => r.statusCode >= 400).length / recentRequests.length * 100
      : 0;
    
    return {
      requests: {
        total: this.requestMetrics.length,
        recent: recentRequests.length,
        avgResponseTime,
        errorRate
      },
      cache: this.cacheMetrics,
      system: {
        cpu: this.getCPUMetrics(),
        memory: this.getMemoryMetrics(),
        process: this.getProcessMetrics()
      },
      websocket: {
        totalEvents: this.wsEventCount
      },
      custom: Object.fromEntries(this.customMetrics)
    };
  }

  // Get request metrics by path
  public getRequestMetricsByPath(path: string) {
    const pathMetrics = this.requestMetrics.filter(m => m.path === path);
    
    if (pathMetrics.length === 0) {
      return null;
    }
    
    const avgResponseTime = pathMetrics.reduce((sum, m) => sum + m.responseTime, 0) / pathMetrics.length;
    const errorRate = pathMetrics.filter(m => m.statusCode >= 400).length / pathMetrics.length * 100;
    
    return {
      path,
      count: pathMetrics.length,
      avgResponseTime,
      errorRate,
      statusCodes: this.groupByStatusCode(pathMetrics)
    };
  }

  private groupByStatusCode(metrics: RequestMetrics[]) {
    const groups: Record<number, number> = {};
    
    metrics.forEach(m => {
      groups[m.statusCode] = (groups[m.statusCode] || 0) + 1;
    });
    
    return groups;
  }

  // Get top slow endpoints
  public getSlowEndpoints(limit: number = 10) {
    const endpointTimes: Map<string, number[]> = new Map();
    
    this.requestMetrics.forEach(m => {
      const key = `${m.method} ${m.path}`;
      if (!endpointTimes.has(key)) {
        endpointTimes.set(key, []);
      }
      endpointTimes.get(key)!.push(m.responseTime);
    });
    
    const avgTimes = Array.from(endpointTimes.entries()).map(([endpoint, times]) => ({
      endpoint,
      avgTime: times.reduce((sum, t) => sum + t, 0) / times.length,
      count: times.length
    }));
    
    return avgTimes
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  // Clear metrics (for testing or reset)
  public clearMetrics() {
    this.requestMetrics = [];
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0
    };
    this.wsEventCount = 0;
    this.customMetrics.clear();
  }
}

export const metricsCollector = new MetricsCollector();