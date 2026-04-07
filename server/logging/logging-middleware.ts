/**
 * Logging Middleware - Fortune 500 Standard
 * Automatic request tracing and performance logging
 */

import { Request, Response, NextFunction } from 'express';
import { createRequestContext, runWithContext, enrichContext, RequestContext } from './request-context';
import { createCentralizedLogger } from './centralized-logger';

const logger = createCentralizedLogger('http');

export interface RequestWithContext extends Request {
  requestContext?: RequestContext;
}

function extractUserId(req: Request): number | undefined {
  const user = (req as any).user;
  return user?.id;
}

function extractSessionId(req: Request): string | undefined {
  return (req as any).sessionID || (req.session as any)?.id;
}

function extractIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export function loggingMiddleware(req: RequestWithContext, res: Response, next: NextFunction): void {
  const correlationId = req.headers['x-correlation-id'] as string || req.headers['x-request-id'] as string;
  
  const context = createRequestContext({
    correlationId,
    userId: extractUserId(req),
    sessionId: extractSessionId(req),
    userAgent: req.headers['user-agent'],
    ip: extractIp(req),
    path: req.path,
    method: req.method,
  });

  req.requestContext = context;

  res.setHeader('X-Request-Id', context.requestId);
  res.setHeader('X-Correlation-Id', context.correlationId);

  runWithContext(context, () => {
    const startTime = Date.now();

    if (req.path !== '/health' && !req.path.startsWith('/health/')) {
      logger.info(`${req.method} ${req.path}`, {
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        contentLength: req.headers['content-length'],
      });
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      if (req.path !== '/health' && !req.path.startsWith('/health/')) {
        logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
          duration,
          statusCode: res.statusCode,
          contentLength: res.getHeader('content-length'),
        });
      }

      if (duration > 5000) {
        logger.performance(`Slow request: ${req.method} ${req.path}`, duration, {
          statusCode: res.statusCode,
          threshold: 5000,
        });
      }
    });

    next();
  });
}

export function enrichRequestContext(req: RequestWithContext, updates: Partial<RequestContext>): void {
  if (req.requestContext) {
    Object.assign(req.requestContext, updates);
  }
  enrichContext(updates);
}

export function securityLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sensitivePatterns = ['/api/auth', '/api/admin', '/api/payments', '/api/user'];
  const isSensitive = sensitivePatterns.some(pattern => req.path.startsWith(pattern));

  if (isSensitive) {
    logger.security(`Sensitive endpoint accessed: ${req.method} ${req.path}`, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
      userId: extractUserId(req),
    });
  }

  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
    /(((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>))/i,
  ];

  const checkValue = (value: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };

  const url = req.originalUrl || req.url;
  if (checkValue(url)) {
    logger.security('Suspicious URL pattern detected', {
      ip: extractIp(req),
      url: url.substring(0, 500),
      userAgent: req.headers['user-agent'],
    });
  }

  next();
}

export function performanceLoggingMiddleware(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;

      if (durationMs > thresholdMs) {
        logger.performance(`Performance threshold exceeded`, durationMs, {
          path: req.path,
          method: req.method,
          threshold: thresholdMs,
          statusCode: res.statusCode,
        });
      }
    });

    next();
  };
}
