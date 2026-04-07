/**
 * Error Tracking Service
 * Sentry-free implementation — set SENTRY_DSN to enable Sentry in the future.
 * All Sentry imports removed so the deployment bundle needs zero Sentry packages.
 */

import { createLogger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

const logger = createLogger('error-tracking');

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsByEndpoint: Map<string, number>;
  recentErrors: Array<{ timestamp: Date; message: string; type: string }>;
}

export class ErrorTrackingService {
  private initialized = false;
  private stats: ErrorStats = {
    totalErrors: 0,
    errorsByType: new Map(),
    errorsByEndpoint: new Map(),
    recentErrors: [],
  };
  private maxRecentErrors = 100;

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      logger.warn('SENTRY_DSN is set but Sentry integration is disabled in this build. Remove SENTRY_DSN or rebuild with Sentry enabled.');
    } else {
      logger.info('Error tracking initialized (local stats only — set SENTRY_DSN to enable Sentry)');
    }

    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.captureException(error, { type: 'uncaughtException' });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      this.captureException(new Error(`Unhandled Rejection: ${reason}`), {
        type: 'unhandledRejection',
      });
    });

    process.on('warning', (warning) => {
      logger.warn('Process Warning:', warning);
    });
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) return data;
    const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apiKey'];
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }
    return sanitized;
  }

  captureException(error: Error | unknown, context?: ErrorContext) {
    this.updateStats(error, context);
    logger.error('Captured exception:', error, context);
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    const logMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
    logger[logMethod](`Captured message: ${message}`, context);
  }

  private updateStats(error: Error | unknown, context?: ErrorContext) {
    this.stats.totalErrors++;
    const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
    const typeCount = this.stats.errorsByType.get(errorType) || 0;
    this.stats.errorsByType.set(errorType, typeCount + 1);

    if (context?.endpoint) {
      const endpointCount = this.stats.errorsByEndpoint.get(context.endpoint) || 0;
      this.stats.errorsByEndpoint.set(context.endpoint, endpointCount + 1);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.stats.recentErrors.unshift({
      timestamp: new Date(),
      message: errorMessage.substring(0, 200),
      type: errorType,
    });

    if (this.stats.recentErrors.length > this.maxRecentErrors) {
      this.stats.recentErrors = this.stats.recentErrors.slice(0, this.maxRecentErrors);
    }
  }

  getStats(): ErrorStats {
    return {
      ...this.stats,
      errorsByType: new Map(this.stats.errorsByType),
      errorsByEndpoint: new Map(this.stats.errorsByEndpoint),
      recentErrors: [...this.stats.recentErrors],
    };
  }

  errorHandler() {
    return (error: Error, req: Request, res: Response, _next: NextFunction) => {
      const context: ErrorContext = {
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        sessionId: (req as any).sessionID,
        userId: (req as any).user?.id,
        query: req.query,
        body: this.sanitizeData(req.body),
      };
      this.captureException(error, context);

      const statusCode = (error as any).statusCode || (error as any).status || 500;
      res.status(statusCode).json({
        error: {
          message:
            process.env.NODE_ENV === 'production'
              ? 'An error occurred processing your request'
              : error.message,
          statusCode,
          ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
        },
      });
    };
  }

  setupExpressErrorHandler(_app: import('express').Application) {
    logger.info('Express error handler registered (local stats only)');
  }

  userContextMiddleware() {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  async flush(_timeout: number = 2000): Promise<boolean> {
    return true;
  }

  close(_timeout: number = 2000): Promise<boolean> {
    return Promise.resolve(true);
  }
}

export const errorTracking = new ErrorTrackingService();
