/**
 * OpenTelemetry Configuration
 * Enterprise Observability - Traces, Metrics, Logs
 *
 * Fortune 500 Standard Features:
 * - Distributed tracing
 * - Automatic instrumentation
 * - Custom metrics
 * - Prometheus exporter
 * - Jaeger/Zipkin integration
 * - Performance monitoring
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { 
  ATTR_SERVICE_NAME, 
  ATTR_SERVICE_VERSION, 
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import { metrics, trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('opentelemetry');

/**
 * OpenTelemetry SDK instance
 */
let sdk: NodeSDK | null = null;

/**
 * Prometheus exporter instance (exported for use in routes)
 */
let prometheusExporter: PrometheusExporter | null = null;

/**
 * Get Prometheus exporter instance
 * @returns PrometheusExporter instance or null if not initialized
 */
export function getPrometheusExporter(): PrometheusExporter | null {
  return prometheusExporter;
}

/**
 * Initialize OpenTelemetry SDK
 */
export function initializeOpenTelemetry(): void {
  try {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      logger.info('OpenTelemetry disabled in test environment');
      return;
    }

    // Prometheus exporter for metrics
    //
    // IMPORTANT: Port 9464 is DEV-ONLY (local development)
    // In production (Replit Cloud Run), only port 5000 is exposed.
    // Use /metrics/prometheus endpoint on port 5000 for production metrics.
    //
    // Development:  http://localhost:9464/metrics (Prometheus format)
    // Production:   https://your-app.replit.app/metrics/prometheus (Prometheus format)
    //               https://your-app.replit.app/metrics (JSON format)
    prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
      endpoint: '/metrics'
    });

    // OTLP trace exporter (for Jaeger, Zipkin, etc.)
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
    });

    // Resource attributes (2024 Best Practice: resourceFromAttributes)
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'e-code-platform',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      'service.namespace': 'e-code',
      'service.instance.id': process.env.HOSTNAME || process.pid.toString()
    });

    // Initialize SDK
    sdk = new NodeSDK({
      resource,
      metricReader: prometheusExporter,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false // Disable fs instrumentation (too noisy)
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true // PostgreSQL instrumentation
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true // Redis instrumentation
          }
        })
      ]
    });

    sdk.start();
    logger.info('OpenTelemetry initialized successfully', {
      prometheusPort: prometheusExporter['_port'],
      environment: process.env.NODE_ENV
    });

    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      await shutdownOpenTelemetry();
    });
  } catch (error: any) {
    logger.error('Failed to initialize OpenTelemetry', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry shut down successfully');
    } catch (error: any) {
      logger.error('Error shutting down OpenTelemetry', {
        error: error.message
      });
    }
  }
}

/**
 * Get tracer instance
 */
export function getTracer(name: string = 'e-code-platform') {
  return trace.getTracer(name);
}

/**
 * Get meter instance for custom metrics
 */
export function getMeter(name: string = 'e-code-platform') {
  return metrics.getMeter(name);
}

/**
 * Create custom metrics
 */
export function createCustomMetrics() {
  const meter = getMeter();

  return {
    // HTTP metrics
    httpRequestCounter: meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests'
    }),

    httpRequestDuration: meter.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms'
    }),

    httpErrorCounter: meter.createCounter('http_errors_total', {
      description: 'Total number of HTTP errors'
    }),

    // AI service metrics
    aiRequestCounter: meter.createCounter('ai_requests_total', {
      description: 'Total number of AI service requests'
    }),

    aiRequestDuration: meter.createHistogram('ai_request_duration_ms', {
      description: 'AI request duration in milliseconds',
      unit: 'ms'
    }),

    aiTokensUsed: meter.createCounter('ai_tokens_used_total', {
      description: 'Total number of AI tokens used'
    }),

    aiCostCounter: meter.createCounter('ai_cost_total', {
      description: 'Total AI service cost in USD',
      unit: 'USD'
    }),

    // Database metrics
    dbQueryCounter: meter.createCounter('db_queries_total', {
      description: 'Total number of database queries'
    }),

    dbQueryDuration: meter.createHistogram('db_query_duration_ms', {
      description: 'Database query duration in milliseconds',
      unit: 'ms'
    }),

    dbConnectionPoolSize: meter.createUpDownCounter('db_connection_pool_size', {
      description: 'Current database connection pool size'
    }),

    // Cache metrics
    cacheHitCounter: meter.createCounter('cache_hits_total', {
      description: 'Total number of cache hits'
    }),

    cacheMissCounter: meter.createCounter('cache_misses_total', {
      description: 'Total number of cache misses'
    }),

    // Business metrics
    userRegistrationCounter: meter.createCounter('user_registrations_total', {
      description: 'Total number of user registrations'
    }),

    projectCreationCounter: meter.createCounter('projects_created_total', {
      description: 'Total number of projects created'
    }),

    activeUsersGauge: meter.createUpDownCounter('active_users', {
      description: 'Number of currently active users'
    }),

    // System metrics
    memoryUsageGauge: meter.createObservableGauge('memory_usage_bytes', {
      description: 'Memory usage in bytes',
      unit: 'bytes'
    }),

    cpuUsageGauge: meter.createObservableGauge('cpu_usage_percent', {
      description: 'CPU usage percentage',
      unit: '%'
    })
  };
}

/**
 * Helper function to create and manage spans
 */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Add attributes if provided
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Record AI service call metrics
 */
export function recordAIMetrics(
  provider: string,
  model: string,
  duration: number,
  tokens?: number,
  cost?: number,
  error?: boolean
): void {
  const metrics = createCustomMetrics();

  const attributes = {
    provider,
    model,
    error: error ? 'true' : 'false'
  };

  metrics.aiRequestCounter.add(1, attributes);
  metrics.aiRequestDuration.record(duration, attributes);

  if (tokens) {
    metrics.aiTokensUsed.add(tokens, attributes);
  }

  if (cost) {
    metrics.aiCostCounter.add(cost, attributes);
  }
}

/**
 * Record HTTP request metrics
 */
export function recordHTTPMetrics(
  method: string,
  path: string,
  statusCode: number,
  duration: number
): void {
  const metrics = createCustomMetrics();

  const attributes = {
    method,
    path,
    status_code: statusCode.toString()
  };

  metrics.httpRequestCounter.add(1, attributes);
  metrics.httpRequestDuration.record(duration, attributes);

  if (statusCode >= 400) {
    metrics.httpErrorCounter.add(1, attributes);
  }
}

/**
 * Record database query metrics
 */
export function recordDatabaseMetrics(
  operation: string,
  table: string,
  duration: number,
  error?: boolean
): void {
  const metrics = createCustomMetrics();

  const attributes = {
    operation,
    table,
    error: error ? 'true' : 'false'
  };

  metrics.dbQueryCounter.add(1, attributes);
  metrics.dbQueryDuration.record(duration, attributes);
}

/**
 * Record cache metrics
 */
export function recordCacheMetrics(
  operation: 'hit' | 'miss',
  key: string
): void {
  const metrics = createCustomMetrics();

  const attributes = { key };

  if (operation === 'hit') {
    metrics.cacheHitCounter.add(1, attributes);
  } else {
    metrics.cacheMissCounter.add(1, attributes);
  }
}

/**
 * Record business event metrics
 */
export function recordBusinessMetric(
  event: 'user_registration' | 'project_creation' | 'active_user',
  count: number = 1
): void {
  const metrics = createCustomMetrics();

  switch (event) {
    case 'user_registration':
      metrics.userRegistrationCounter.add(count);
      break;
    case 'project_creation':
      metrics.projectCreationCounter.add(count);
      break;
    case 'active_user':
      metrics.activeUsersGauge.add(count);
      break;
  }
}

/**
 * Middleware to trace HTTP requests
 */
export function tracingMiddleware() {
  return async (req: any, res: any, next: any) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`);

    span.setAttributes({
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.host': req.get('host'),
      'http.user_agent': req.get('user-agent'),
      'net.peer.ip': req.ip
    });

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      span.setAttribute('http.status_code', res.statusCode);
      span.setAttribute('http.response_time_ms', duration);

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();

      // Record metrics
      recordHTTPMetrics(req.method, req.path, res.statusCode, duration);
    });

    next();
  };
}

// Initialize on module load (disabled by default)
// Set OTEL_ENABLED=true to enable OpenTelemetry
if (process.env.OTEL_ENABLED === 'true') {
  initializeOpenTelemetry();
} else {
  logger.info('OpenTelemetry disabled (set OTEL_ENABLED=true to enable)');
}

export default {
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
  getTracer,
  getMeter,
  getPrometheusExporter,
  createCustomMetrics,
  withSpan,
  recordAIMetrics,
  recordHTTPMetrics,
  recordDatabaseMetrics,
  recordCacheMetrics,
  recordBusinessMetric,
  tracingMiddleware
};
