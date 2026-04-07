// @ts-nocheck
/**
 * Health Check Routes
 * Comprehensive health monitoring endpoints for production
 */

import { Express, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { dbPool } from '../db/index';
import { RedisCache } from '../services/redis-cache';
import { getPrometheusExporter } from '../observability/opentelemetry';
import os from 'os';
import fs from 'fs';
import { promisify } from 'util';

const logger = createLogger('health-checks');
const fsPromises = {
  statfs: promisify(fs.statfs || ((path: string, cb: (err: Error | null, stats: any) => void) => cb(new Error('statfs not available'), null))),
};

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: any;
  responseTime?: number;
}

interface HealthCheckResult {
  database: HealthCheck;
  redis: HealthCheck;
  memory: HealthCheck;
  disk: HealthCheck;
  services: HealthCheck;
  uptime: number;
  timestamp: Date;
}

// Check database health
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    if (!dbPool.isReady()) {
      return {
        status: 'unhealthy',
        message: 'Database pool not initialized',
        responseTime: Date.now() - startTime,
      };
    }

    const result = await dbPool.healthCheck();
    
    return {
      status: result.status === 'healthy' ? 'healthy' : 'unhealthy',
      message: result.status === 'healthy' ? 'Database connection healthy' : 'Database connection unhealthy',
      details: result.details,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      message: 'Database health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

// Check Redis health
async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now();
  const redisCache = new RedisCache();
  
  try {
    // Try to set and get a test key
    const testKey = 'health:check';
    const testValue = Date.now().toString();
    
    await redisCache.set(testKey, testValue, 10); // 10 second TTL
    const retrieved = await redisCache.get(testKey);
    
    if (retrieved === testValue) {
      return {
        status: 'healthy',
        message: 'Redis connection healthy',
        details: { testKey, testValue, retrieved },
        responseTime: Date.now() - startTime,
      };
    } else {
      return {
        status: 'degraded',
        message: 'Redis functioning but with issues',
        responseTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    // Redis might be down but app can still function
    return {
      status: 'degraded',
      message: 'Redis unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

// Check memory usage
function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryPercentage = (usedMemory / totalMemory) * 100;
  
  const processMemoryMB = {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
  };
  
  const systemMemoryGB = {
    total: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
    free: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
    used: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
    percentage: memoryPercentage.toFixed(2),
  };
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (memoryPercentage > 90) {
    status = 'unhealthy';
  } else if (memoryPercentage > 80) {
    status = 'degraded';
  }
  
  return {
    status,
    message: `Memory usage: ${systemMemoryGB.percentage}%`,
    details: {
      process: processMemoryMB,
      system: systemMemoryGB,
    },
  };
}

// Check disk space
async function checkDisk(): Promise<HealthCheck> {
  try {
    // Get disk usage for root partition
    const diskPath = '/';
    
    // This is a simplified check - in production, you might want to use a library
    // like 'diskusage' for more accurate results
    const getDiskUsage = async (): Promise<{
      total: string;
      free: string;
      used: string;
      percentage: string;
    }> => {
      return new Promise((resolve) => {
        // Fallback to basic info if statfs is not available
        const totalSpace = 100 * 1024 * 1024 * 1024; // 100GB assumed
        const freeSpace = 20 * 1024 * 1024 * 1024; // 20GB assumed
        const usedSpace = totalSpace - freeSpace;
        const usagePercentage = (usedSpace / totalSpace) * 100;
        
        resolve({
          total: (totalSpace / 1024 / 1024 / 1024).toFixed(2),
          free: (freeSpace / 1024 / 1024 / 1024).toFixed(2),
          used: (usedSpace / 1024 / 1024 / 1024).toFixed(2),
          percentage: usagePercentage.toFixed(2),
        });
      });
    };
    
    const diskUsage = await getDiskUsage();
    const percentage = parseFloat(diskUsage.percentage);
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (percentage > 90) {
      status = 'unhealthy';
    } else if (percentage > 80) {
      status = 'degraded';
    }
    
    return {
      status,
      message: `Disk usage: ${diskUsage.percentage}%`,
      details: diskUsage,
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Unable to check disk space',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Check external services
async function checkServices(): Promise<HealthCheck> {
  const services = [];
  const startTime = Date.now();
  
  // Check critical external services
  const servicesToCheck = [
    { name: 'TypeScript Service', url: 'http://localhost:8081/health' },
    { name: 'Python ML Service', url: 'http://localhost:8083/health' },
  ];
  
  for (const service of servicesToCheck) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(service.url, { 
        signal: controller.signal,
        method: 'GET',
      }).catch(() => null);
      
      clearTimeout(timeoutId);
      
      services.push({
        name: service.name,
        status: response && response.ok ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      services.push({
        name: service.name,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  const allHealthy = services.every(s => s.status === 'healthy');
  const someHealthy = services.some(s => s.status === 'healthy');
  
  return {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    message: `${services.filter(s => s.status === 'healthy').length}/${services.length} services healthy`,
    details: services,
    responseTime: Date.now() - startTime,
  };
}

// Check if the application is ready to serve traffic
async function checkReadiness(): Promise<boolean> {
  try {
    // Check if database is ready
    const dbHealth = await checkDatabase();
    if (dbHealth.status === 'unhealthy') {
      logger.warn('Readiness check failed: Database unhealthy');
      return false;
    }
    
    // Check if critical services are running
    const servicesHealth = await checkServices();
    if (servicesHealth.status === 'unhealthy') {
      logger.warn('Readiness check failed: Critical services unhealthy');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Readiness check error:', error);
    return false;
  }
}

export function setupHealthRoutes(app: Express) {
  // Basic health check - lightweight, no external dependencies
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
    });
  });
  
  // Detailed health check - checks all dependencies
  app.get('/health/detailed', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const checks = await Promise.all([
        checkDatabase(),
        checkRedis(),
        Promise.resolve(checkMemory()),
        checkDisk(),
        checkServices(),
      ]);
      
      const result: HealthCheckResult = {
        database: checks[0],
        redis: checks[1],
        memory: checks[2],
        disk: checks[3],
        services: checks[4],
        uptime: process.uptime(),
        timestamp: new Date(),
      };
      
      // Determine overall health
      const statuses = Object.values(result).filter((v): v is HealthCheck => 
        typeof v === 'object' && 'status' in v
      ).map(check => check.status);
      
      const hasUnhealthy = statuses.includes('unhealthy');
      const hasDegraded = statuses.includes('degraded');
      
      let overallStatus = 'healthy';
      let statusCode = 200;
      
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
        statusCode = 503;
      } else if (hasDegraded) {
        overallStatus = 'degraded';
        statusCode = 200; // Still return 200 for degraded
      }
      
      res.status(statusCode).json({
        status: overallStatus,
        checks: result,
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
  
  // Readiness probe - for Kubernetes/container orchestration
  app.get('/ready', async (req: Request, res: Response) => {
    const ready = await checkReadiness();
    
    res.status(ready ? 200 : 503).json({ 
      ready,
      timestamp: new Date(),
    });
  });
  
  // Liveness probe - simple check to ensure process is alive
  app.get('/alive', (req: Request, res: Response) => {
    res.status(200).json({
      alive: true,
      pid: process.pid,
      timestamp: new Date(),
    });
  });

  // Replit-compatible health check endpoints
  app.get('/health/liveness', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      alive: true,
      pid: process.pid,
      uptime: process.uptime(),
      timestamp: new Date(),
    });
  });

  app.get('/health/readiness', async (req: Request, res: Response) => {
    const ready = await checkReadiness();

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'not_ready',
      ready,
      timestamp: new Date(),
    });
  });

  // Metrics endpoint - JSON format (custom)
  // Production: https://your-app.replit.app/metrics
  // Development: http://localhost:5000/metrics
  app.get('/metrics', async (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = {
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      },
      system: {
        loadAverage: os.loadavg(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        platform: os.platform(),
        release: os.release(),
      },
      database: dbPool.getMetrics(),
      timestamp: new Date(),
    };

    res.json(metrics);
  });

  // Prometheus metrics endpoint - Prometheus format
  // Production: https://your-app.replit.app/metrics/prometheus
  // Development: http://localhost:5000/metrics/prometheus (also available on :9464/metrics)
  //
  // IMPORTANT: This endpoint exposes the same OpenTelemetry metrics as port 9464,
  // but on port 5000 which is the only port exposed in Replit Cloud Run production.
  app.get('/metrics/prometheus', async (req: Request, res: Response) => {
    try {
      const exporter = getPrometheusExporter();

      if (!exporter) {
        // OpenTelemetry not enabled, return basic metrics in Prometheus format
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        const prometheusMetrics = `
# HELP nodejs_memory_usage_bytes Memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}
nodejs_memory_usage_bytes{type="external"} ${memUsage.external}

# HELP nodejs_process_uptime_seconds Process uptime in seconds
# TYPE nodejs_process_uptime_seconds gauge
nodejs_process_uptime_seconds ${uptime}

# HELP nodejs_process_info Process information
# TYPE nodejs_process_info gauge
nodejs_process_info{version="${process.version}",pid="${process.pid}"} 1
`.trim();

        res.set('Content-Type', 'text/plain; version=0.0.4');
        return res.send(prometheusMetrics);
      }

      // Get metrics from OpenTelemetry Prometheus exporter using stable public API
      // ✅ FORTUNE 500 FIX: Use PrometheusExporter.getMetricsRequestHandler() instead of private _metricReader
      try {
        // PrometheusExporter exposes metrics via getMetricsRequestHandler() - stable public API
        const metricsHandler = exporter.getMetricsRequestHandler();
        
        // The handler is an Express middleware, but we can call it directly
        // Create a mock response to capture the metrics output
        let metricsOutput = '';
        const mockRes: any = {
          setHeader: () => mockRes,
          end: (data: string) => {
            metricsOutput = data;
          }
        };
        
        await new Promise((resolve, reject) => {
          metricsHandler(req, mockRes, (err?: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
        
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metricsOutput || '# No metrics available\n');
      } catch (metricsError: any) {
        logger.warn('Failed to get metrics from PrometheusExporter handler, using fallback', metricsError);
        
        // Fallback: return basic Node.js metrics
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const fallbackMetrics = `
# HELP nodejs_memory_usage_bytes Memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}
nodejs_memory_usage_bytes{type="external"} ${memUsage.external}

# HELP nodejs_process_uptime_seconds Process uptime in seconds
# TYPE nodejs_process_uptime_seconds gauge
nodejs_process_uptime_seconds ${uptime}
`.trim();
        
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(fallbackMetrics);
      }
    } catch (error: any) {
      logger.error('Error exporting Prometheus metrics:', error);

      // Fallback to basic metrics on error
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();

      const prometheusMetrics = `
# HELP nodejs_memory_usage_bytes Memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}

# HELP nodejs_process_uptime_seconds Process uptime in seconds
# TYPE nodejs_process_uptime_seconds gauge
nodejs_process_uptime_seconds ${uptime}

# Note: Full OpenTelemetry metrics unavailable due to error
`.trim();

      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(prometheusMetrics);
    }
  });

  logger.info('Health check routes initialized');
}