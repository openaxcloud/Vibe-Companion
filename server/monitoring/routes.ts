import { Router } from 'express';
import { performanceMonitor } from './performance';
import { monitoringService } from '../services/monitoring-service';
import { ensureAuthenticated } from '../middleware/auth';
import { logAggregator } from './log-aggregator';
import { uptimeMonitor } from '../services/uptime-monitor';
import { databaseQueryOptimizer } from '../services/database-query-optimizer';
import { redisCache } from '../services/redis-cache';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

export const monitoringRouter = Router();

// Health check endpoint
monitoringRouter.get('/health', (req, res) => {
  const uptime = uptimeMonitor.getSummary();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    availability: uptime.availability,
    lastHeartbeat: uptime.lastHeartbeat,
  });
});

// Database health check
monitoringRouter.get('/health/db', async (req, res) => {
  try {
    // Perform a simple database query to check connectivity
    const result = await req.app.locals.db.raw('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

monitoringRouter.get('/logs/recent', ensureAuthenticated, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({
    timestamp: new Date().toISOString(),
    logs: logAggregator.getRecent(Math.min(500, limit)),
  });
});

monitoringRouter.get('/logs/stats', ensureAuthenticated, (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    stats: logAggregator.getStats(),
  });
});

monitoringRouter.get('/uptime', ensureAuthenticated, (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    summary: uptimeMonitor.getSummary(),
  });
});

monitoringRouter.get('/database/slow-queries', ensureAuthenticated, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json({
    timestamp: new Date().toISOString(),
    slowQueries: databaseQueryOptimizer.getSlowQueries(limit),
    recommendations: databaseQueryOptimizer.getRecommendations(),
    cache: databaseQueryOptimizer.getCacheStats(),
  });
});

monitoringRouter.get('/cache/health', ensureAuthenticated, async (_req, res) => {
  const healthy = await redisCache.healthCheck();
  res.json({
    timestamp: new Date().toISOString(),
    healthy,
    stats: databaseQueryOptimizer.getCacheStats(),
  });
});

// Performance metrics endpoint (protected)
monitoringRouter.get('/metrics', ensureAuthenticated, (req, res) => {
  const timeWindow = parseInt(req.query.window as string) || undefined;
  const stats = performanceMonitor.getStats(timeWindow);
  
  res.json({
    timestamp: new Date().toISOString(),
    stats,
  });
});

// Real-time metrics for dashboard (protected)
monitoringRouter.get('/metrics/realtime', ensureAuthenticated, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const metrics = performanceMonitor.getRealtimeMetrics(limit);
  
  res.json({
    timestamp: new Date().toISOString(),
    metrics,
  });
});

// Time series data for charts (protected)
monitoringRouter.get('/metrics/timeseries', ensureAuthenticated, (req, res) => {
  const interval = parseInt(req.query.interval as string) || 60000;
  const data = performanceMonitor.getTimeSeriesData(interval);
  
  res.json({
    timestamp: new Date().toISOString(),
    data,
  });
});

// System health status (protected)
monitoringRouter.get('/status', ensureAuthenticated, (req, res) => {
  const health = performanceMonitor.getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    timestamp: new Date().toISOString(),
    ...health,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
  });
});

// Server-sent events for real-time monitoring (protected)
monitoringRouter.get('/stream', ensureAuthenticated, (req, res) => {
  // Set SSE headers with CORS security - reject invalid origins with 403
  if (!validateAndSetSSEHeaders(res, req)) {
    return;
  }

  // Send initial data
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Listen for new metrics
  const handleMetric = (metric: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'metric',
      timestamp: new Date().toISOString(),
      metric,
    })}\n\n`);
  };

  const handleSlowResponse = (metric: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'alert',
      severity: 'warning',
      message: `Slow response detected: ${metric.method} ${metric.endpoint} (${metric.responseTime}ms)`,
      timestamp: new Date().toISOString(),
      metric,
    })}\n\n`);
  };

  const handleServerError = (metric: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'alert',
      severity: 'error',
      message: `Server error: ${metric.method} ${metric.endpoint} (${metric.statusCode})`,
      timestamp: new Date().toISOString(),
      metric,
    })}\n\n`);
  };

  performanceMonitor.on('metric', handleMetric);
  performanceMonitor.on('slow-response', handleSlowResponse);
  performanceMonitor.on('server-error', handleServerError);

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    })}\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    performanceMonitor.off('metric', handleMetric);
    performanceMonitor.off('slow-response', handleSlowResponse);
    performanceMonitor.off('server-error', handleServerError);
    clearInterval(heartbeat);
  });
});

// Export metrics in Prometheus format (for external monitoring)
monitoringRouter.get('/metrics/prometheus', (req, res) => {
  const stats = performanceMonitor.getStats();
  let output = '';

  // Add header
  output += '# HELP http_requests_total Total number of HTTP requests\n';
  output += '# TYPE http_requests_total counter\n';

  // Add metrics
  Object.entries(stats).forEach(([key, stat]) => {
    const [method, ...endpointParts] = key.split(' ');
    const endpoint = endpointParts.join(' ');
    
    output += `http_requests_total{method="${method}",endpoint="${endpoint}",status="success"} ${stat.count - stat.errorCount}\n`;
    output += `http_requests_total{method="${method}",endpoint="${endpoint}",status="error"} ${stat.errorCount}\n`;
  });

  output += '\n# HELP http_request_duration_seconds HTTP request latencies in seconds\n';
  output += '# TYPE http_request_duration_seconds summary\n';

  Object.entries(stats).forEach(([key, stat]) => {
    const [method, ...endpointParts] = key.split(' ');
    const endpoint = endpointParts.join(' ');
    
    output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.5"} ${stat.p50 / 1000}\n`;
    output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.95"} ${stat.p95 / 1000}\n`;
    output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.99"} ${stat.p99 / 1000}\n`;
    output += `http_request_duration_seconds_sum{method="${method}",endpoint="${endpoint}"} ${(stat.avgResponseTime * stat.count) / 1000}\n`;
    output += `http_request_duration_seconds_count{method="${method}",endpoint="${endpoint}"} ${stat.count}\n`;
  });

  res.set('Content-Type', 'text/plain');
  res.send(output);
});

// Monitoring event endpoint for frontend monitoring
monitoringRouter.post('/event', async (req, res) => {
  try {
    const { type, category, message, metadata, userId, projectId, url, userAgent } = req.body;
    
    // Basic validation
    if (!type || !category || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, category, and message' 
      });
    }
    
    // Create monitoring event
    const event = await monitoringService.trackEvent({
      type,
      category,
      message,
      metadata,
      userId: userId || req.user?.id,
      projectId,
      url,
      userAgent: userAgent || req.get('user-agent'),
      ipAddress: req.ip
    });
    
    res.json({ 
      success: true, 
      eventId: event.id 
    });
  } catch (error) {
    console.error('Error tracking monitoring event:', error);
    res.status(500).json({ 
      error: 'Failed to track monitoring event' 
    });
  }
});