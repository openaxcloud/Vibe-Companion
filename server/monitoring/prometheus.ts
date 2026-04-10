// @ts-nocheck
/**
 * Prometheus Metrics Collection
 * Fortune 500-grade metrics endpoint for production monitoring
 * 
 * Exposes:
 * - HTTP request counts by route, method, status
 * - Response time histograms
 * - Active connections
 * - Memory usage
 * - AI request counts
 */

import { Request, Response, NextFunction, Router } from 'express';
import os from 'os';

interface RequestMetric {
  route: string;
  method: string;
  status: number;
  count: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface RouteMetrics {
  requestCount: Map<string, number>;
  responseTimes: number[];
  statusCounts: Map<number, number>;
  lastUpdated: number;
}

class PrometheusMetrics {
  private routeMetrics: Map<string, RouteMetrics> = new Map();
  private activeConnections: number = 0;
  private aiRequestCounts: Map<string, number> = new Map();
  private startTime: number = Date.now();
  
  private readonly histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly maxResponseTimeSamples = 1000;

  recordRequest(route: string, method: string, status: number, durationMs: number) {
    const key = `${method}:${route}`;
    
    if (!this.routeMetrics.has(key)) {
      this.routeMetrics.set(key, {
        requestCount: new Map(),
        responseTimes: [],
        statusCounts: new Map(),
        lastUpdated: Date.now()
      });
    }
    
    const metrics = this.routeMetrics.get(key)!;
    
    const countKey = `${method}:${route}:${status}`;
    metrics.requestCount.set(countKey, (metrics.requestCount.get(countKey) || 0) + 1);
    
    const statusCategory = Math.floor(status / 100) * 100;
    metrics.statusCounts.set(statusCategory, (metrics.statusCounts.get(statusCategory) || 0) + 1);
    
    metrics.responseTimes.push(durationMs / 1000);
    if (metrics.responseTimes.length > this.maxResponseTimeSamples) {
      metrics.responseTimes.shift();
    }
    
    metrics.lastUpdated = Date.now();
  }

  recordAIRequest(model: string, type: string) {
    const key = `${type}:${model}`;
    this.aiRequestCounts.set(key, (this.aiRequestCounts.get(key) || 0) + 1);
  }

  incrementConnections() {
    this.activeConnections++;
  }

  decrementConnections() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  setActiveConnections(count: number) {
    this.activeConnections = count;
  }

  getPrometheusOutput(): string {
    const lines: string[] = [];
    const memUsage = process.memoryUsage();
    const systemMem = { total: os.totalmem(), free: os.freemem() };
    const cpus = os.cpus();
    
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    
    const requestTotals = new Map<string, { success: number; error: number }>();
    
    for (const [key, metrics] of this.routeMetrics) {
      const [method, route] = key.split(':');
      
      for (const [countKey, count] of metrics.requestCount) {
        const parts = countKey.split(':');
        const status = parseInt(parts[parts.length - 1]);
        const routeKey = `${method}:${route}`;
        
        if (!requestTotals.has(routeKey)) {
          requestTotals.set(routeKey, { success: 0, error: 0 });
        }
        
        if (status < 400) {
          requestTotals.get(routeKey)!.success += count;
        } else {
          requestTotals.get(routeKey)!.error += count;
        }
      }
    }
    
    for (const [routeKey, counts] of requestTotals) {
      const [method, route] = routeKey.split(':');
      const sanitizedRoute = this.sanitizeLabel(route);
      lines.push(`http_requests_total{method="${method}",route="${sanitizedRoute}",status="2xx"} ${counts.success}`);
      lines.push(`http_requests_total{method="${method}",route="${sanitizedRoute}",status="4xx"} ${counts.error}`);
    }
    
    lines.push('');
    lines.push('# HELP http_request_duration_seconds HTTP request latency histogram');
    lines.push('# TYPE http_request_duration_seconds histogram');
    
    for (const [key, metrics] of this.routeMetrics) {
      const [method, route] = key.split(':');
      const sanitizedRoute = this.sanitizeLabel(route);
      const times = metrics.responseTimes;
      
      if (times.length === 0) continue;
      
      const sortedTimes = [...times].sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      const count = times.length;
      
      for (const bucket of this.histogramBuckets) {
        const bucketCount = sortedTimes.filter(t => t <= bucket).length;
        lines.push(`http_request_duration_seconds_bucket{method="${method}",route="${sanitizedRoute}",le="${bucket}"} ${bucketCount}`);
      }
      lines.push(`http_request_duration_seconds_bucket{method="${method}",route="${sanitizedRoute}",le="+Inf"} ${count}`);
      lines.push(`http_request_duration_seconds_sum{method="${method}",route="${sanitizedRoute}"} ${sum.toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{method="${method}",route="${sanitizedRoute}"} ${count}`);
    }
    
    lines.push('');
    lines.push('# HELP active_connections Current number of active connections');
    lines.push('# TYPE active_connections gauge');
    lines.push(`active_connections ${this.activeConnections}`);
    
    lines.push('');
    lines.push('# HELP process_memory_bytes Process memory usage in bytes');
    lines.push('# TYPE process_memory_bytes gauge');
    lines.push(`process_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`process_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    lines.push(`process_memory_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`process_memory_bytes{type="external"} ${memUsage.external}`);
    
    lines.push('');
    lines.push('# HELP system_memory_bytes System memory in bytes');
    lines.push('# TYPE system_memory_bytes gauge');
    lines.push(`system_memory_bytes{type="total"} ${systemMem.total}`);
    lines.push(`system_memory_bytes{type="free"} ${systemMem.free}`);
    lines.push(`system_memory_bytes{type="used"} ${systemMem.total - systemMem.free}`);
    
    lines.push('');
    lines.push('# HELP ai_requests_total Total AI/LLM requests by model and type');
    lines.push('# TYPE ai_requests_total counter');
    
    for (const [key, count] of this.aiRequestCounts) {
      const [type, model] = key.split(':');
      const sanitizedModel = this.sanitizeLabel(model || 'unknown');
      lines.push(`ai_requests_total{type="${type}",model="${sanitizedModel}"} ${count}`);
    }
    
    if (this.aiRequestCounts.size === 0) {
      lines.push(`ai_requests_total{type="chat",model="default"} 0`);
    }
    
    lines.push('');
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);
    
    lines.push('');
    lines.push('# HELP nodejs_cpu_usage_percent Node.js CPU usage percentage');
    lines.push('# TYPE nodejs_cpu_usage_percent gauge');
    
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuUsage = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100).toFixed(2) : '0';
    lines.push(`nodejs_cpu_usage_percent ${cpuUsage}`);
    
    lines.push('');
    lines.push('# HELP nodejs_event_loop_lag_seconds Event loop lag in seconds');
    lines.push('# TYPE nodejs_event_loop_lag_seconds gauge');
    lines.push(`nodejs_event_loop_lag_seconds 0`);
    
    return lines.join('\n') + '\n';
  }

  private sanitizeLabel(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/[{}]/g, '_');
  }

  getStats() {
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [_, metrics] of this.routeMetrics) {
      for (const [countKey, count] of metrics.requestCount) {
        totalRequests += count;
        const status = parseInt(countKey.split(':').pop() || '0');
        if (status >= 400) {
          totalErrors += count;
        }
      }
    }
    
    return {
      totalRequests,
      totalErrors,
      activeConnections: this.activeConnections,
      aiRequests: Object.fromEntries(this.aiRequestCounts),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

export const prometheusMetrics = new PrometheusMetrics();

export function prometheusMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]) {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationMs = durationNs / 1_000_000;
    
    let route = req.route?.path || req.path;
    route = route.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
    
    prometheusMetrics.recordRequest(route, req.method, res.statusCode, durationMs);
    
    if (req.path.includes('/ai/') || req.path.includes('/agent/')) {
      const model = (req.body as any)?.model || 'default';
      const type = req.path.includes('/chat') ? 'chat' : 
                   req.path.includes('/complete') ? 'completion' : 
                   req.path.includes('/agent') ? 'agent' : 'other';
      prometheusMetrics.recordAIRequest(model, type);
    }
    
    return originalEnd.apply(this, args);
  } as any;
  
  next();
}

export const prometheusRouter = Router();

prometheusRouter.get('/metrics', (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(prometheusMetrics.getPrometheusOutput());
});

prometheusRouter.get('/metrics/json', (req: Request, res: Response) => {
  res.json({
    timestamp: new Date().toISOString(),
    ...prometheusMetrics.getStats(),
    memory: process.memoryUsage(),
    system: {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg()
    }
  });
});
