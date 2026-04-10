import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../monitoring/performance';

const router = Router();

router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const stats = performanceMonitor.getStats();
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    let output = '';

    output += '# HELP http_requests_total Total number of HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';

    Object.entries(stats).forEach(([key, stat]) => {
      const [method, ...endpointParts] = key.split(' ');
      const endpoint = endpointParts.join(' ').replace(/"/g, '\\"');
      
      output += `http_requests_total{method="${method}",endpoint="${endpoint}",status="success"} ${stat.count - stat.errorCount}\n`;
      output += `http_requests_total{method="${method}",endpoint="${endpoint}",status="error"} ${stat.errorCount}\n`;
    });

    output += '\n# HELP http_request_duration_seconds HTTP request latencies in seconds\n';
    output += '# TYPE http_request_duration_seconds summary\n';

    Object.entries(stats).forEach(([key, stat]) => {
      const [method, ...endpointParts] = key.split(' ');
      const endpoint = endpointParts.join(' ').replace(/"/g, '\\"');
      
      output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.5"} ${stat.p50 / 1000}\n`;
      output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.95"} ${stat.p95 / 1000}\n`;
      output += `http_request_duration_seconds{method="${method}",endpoint="${endpoint}",quantile="0.99"} ${stat.p99 / 1000}\n`;
      output += `http_request_duration_seconds_sum{method="${method}",endpoint="${endpoint}"} ${(stat.avgResponseTime * stat.count) / 1000}\n`;
      output += `http_request_duration_seconds_count{method="${method}",endpoint="${endpoint}"} ${stat.count}\n`;
    });

    output += '\n# HELP process_memory_heap_bytes Node.js heap memory usage\n';
    output += '# TYPE process_memory_heap_bytes gauge\n';
    output += `process_memory_heap_bytes{type="used"} ${memUsage.heapUsed}\n`;
    output += `process_memory_heap_bytes{type="total"} ${memUsage.heapTotal}\n`;

    output += '\n# HELP process_memory_rss_bytes Resident set size memory\n';
    output += '# TYPE process_memory_rss_bytes gauge\n';
    output += `process_memory_rss_bytes ${memUsage.rss}\n`;

    output += '\n# HELP process_uptime_seconds Process uptime in seconds\n';
    output += '# TYPE process_uptime_seconds gauge\n';
    output += `process_uptime_seconds ${uptime}\n`;

    output += '\n# HELP nodejs_active_handles_total Number of active handles\n';
    output += '# TYPE nodejs_active_handles_total gauge\n';
    output += `nodejs_active_handles_total ${(process as any)._getActiveHandles?.()?.length || 0}\n`;

    output += '\n# HELP nodejs_active_requests_total Number of active requests\n';
    output += '# TYPE nodejs_active_requests_total gauge\n';
    output += `nodejs_active_requests_total ${(process as any)._getActiveRequests?.()?.length || 0}\n`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(output);
  } catch (error) {
    console.error('Error generating Prometheus metrics:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

export default router;
