import { Request, Response, NextFunction } from 'express';

interface Metric {
  count: number;
  totalMs: number;
  errors: number;
}

const metrics = new Map<string, Metric>();
const startTime = Date.now();

export function requestMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const key = `${req.method} ${req.route?.path ?? req.path}`;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const existing = metrics.get(key) ?? { count: 0, totalMs: 0, errors: 0 };
    existing.count++;
    existing.totalMs += duration;
    if (res.statusCode >= 400) existing.errors++;
    metrics.set(key, existing);
  });

  next();
}

export function getMetrics(): Record<string, unknown> {
  const result: Record<string, unknown> = {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    routes: {} as Record<string, unknown>,
  };

  for (const [key, metric] of metrics.entries()) {
    (result.routes as Record<string, unknown>)[key] = {
      count: metric.count,
      avgMs: metric.count > 0 ? Math.round(metric.totalMs / metric.count) : 0,
      errors: metric.errors,
      errorRate: metric.count > 0 ? `${((metric.errors / metric.count) * 100).toFixed(1)}%` : '0%',
    };
  }

  return result;
}

export function resetMetrics(): void {
  metrics.clear();
}

export function getHealthStatus(): { status: string; uptime: number; timestamp: string } {
  return {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  };
}
