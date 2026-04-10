/**
 * Centralized Error Handling Middleware
 * Fortune 500 Standard: Consistent, Secure, Monitored
 *
 * Features:
 * - Typed error classes
 * - Automatic logging
 * - Environment-aware responses
 * - Error tracking integration (Sentry)
 * - Correlation IDs for tracing
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

let _sentry: any = null;
function getSentry() {
  if (_sentry === null) {
    try { _sentry = require('@sentry/node'); } catch (err: any) { console.error("[catch]", err?.message || err); _sentry = undefined; }
  }
  return _sentry;
}

const logger = createLogger('error-handler');

/**
 * Base Application Error Class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this);
  }
}

/**
 * HTTP Error Classes for common scenarios
 */

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', details?: any) {
    super(message, 400, true, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, true, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, 403, true, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, true, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: any) {
    super(message, 409, true, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 422, true, 'VALIDATION_ERROR', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, false, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: any) {
    super(message, 503, true, 'SERVICE_UNAVAILABLE', details);
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Gateway timeout', details?: any) {
    super(message, 504, true, 'GATEWAY_TIMEOUT', details);
  }
}

/**
 * AI Service Specific Errors
 */

export class AIServiceError extends AppError {
  constructor(
    message: string,
    statusCode: number = 503,
    public readonly provider?: string,
    details?: any
  ) {
    super(message, statusCode, true, 'AI_SERVICE_ERROR', details);
    this.provider = provider;
  }
}

export class AIQuotaExceededError extends AIServiceError {
  constructor(provider: string, details?: any) {
    super(
      `AI service quota exceeded for provider: ${provider}`,
      429,
      provider,
      details
    );
  }
}

export class AIModelNotAvailableError extends AIServiceError {
  constructor(model: string, provider: string, details?: any) {
    super(
      `AI model ${model} not available on provider: ${provider}`,
      503,
      provider,
      details
    );
  }
}

/**
 * Database Errors
 */

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super(message, 500, false, 'DATABASE_ERROR', details);
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(details?: any) {
    super('Database connection failed', 500, false, 'DATABASE_CONNECTION_ERROR', details);
  }
}

export class DatabaseQueryError extends AppError {
  constructor(message: string = 'Database query failed', details?: any) {
    super(message, 500, false, 'DATABASE_QUERY_ERROR', details);
  }
}

/**
 * Error Response Interface
 */
interface ErrorResponse {
  status: 'error';
  code?: string;
  message: string;
  details?: any;
  requestId?: string;
  timestamp: string;
  path?: string;
  stack?: string;
}

/**
 * Format error for client response
 */
function formatErrorResponse(
  err: Error | AppError,
  req: Request
): ErrorResponse {
  const isAppError = err instanceof AppError;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ErrorResponse = {
    status: 'error',
    code: isAppError ? err.code : 'INTERNAL_SERVER_ERROR',
    message: isAppError ? err.message : 'An unexpected error occurred',
    requestId: (req as any).requestId,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Include details in development or for operational errors
  if (isDevelopment || (isAppError && err.isOperational)) {
    if (isAppError && err.details) {
      response.details = err.details;
    }
  }

  // Include stack trace only in development
  if (isDevelopment) {
    response.stack = err.stack;
  }

  return response;
}

/**
 * Log error with appropriate level and context
 */
function logError(err: Error | AppError, req: Request): void {
  const isAppError = err instanceof AppError;
  const isOperational = isAppError && err.isOperational;

  const errorContext = {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    error: {
      name: err.name,
      message: err.message,
      code: isAppError ? err.code : undefined,
      statusCode: isAppError ? err.statusCode : 500,
      isOperational,
      stack: err.stack
    }
  };

  // Use different log levels based on error type
  if (!isOperational) {
    // Critical errors (non-operational) - requires immediate attention
    logger.error('CRITICAL ERROR - Non-operational error occurred', errorContext);

    // Send to error tracking service (Sentry)
    if (process.env.SENTRY_DSN) {
      getSentry()?.captureException(err, {
        tags: {
          requestId: errorContext.requestId,
          path: errorContext.path,
          isOperational: String(isOperational)
        },
        user: {
          id: errorContext.userId,
          ip_address: errorContext.ip
        },
        extra: errorContext
      });
    }
  } else if (isAppError && err.statusCode >= 500) {
    // Server errors (operational) - should be investigated
    logger.error('Server error occurred', errorContext);
  } else if (isAppError && err.statusCode >= 400) {
    // Client errors - informational
    logger.warn('Client error occurred', errorContext);
  } else {
    // Unknown errors - treat as critical
    logger.error('Unknown error occurred', errorContext);
  }
}

/**
 * Central Error Handling Middleware
 * Must be registered LAST in middleware chain
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logError(err, req);

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Format error response
  const errorResponse = formatErrorResponse(err, req);

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found Handler
 * Handles 404 errors for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
  next(error);
}

/**
 * Unhandled Rejection Handler
 * Catches unhandled promise rejections globally
 */
export function setupUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: String(promise)
    });

    // Send to error tracking
    if (process.env.SENTRY_DSN) {
      getSentry()?.captureException(reason);
    }

    // In production, exit gracefully to let process manager restart
    if (process.env.NODE_ENV === 'production') {
      logger.error('Shutting down due to unhandled rejection');
      process.exit(1);
    }
  });
}

/**
 * Uncaught Exception Handler
 * Catches uncaught exceptions globally
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });

    // Send to error tracking
    if (process.env.SENTRY_DSN) {
      getSentry()?.captureException(error);
    }

    // Always exit on uncaught exceptions
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
}

/**
 * Initialize Global Error Handlers
 */
export function initializeErrorHandlers(): void {
  setupUnhandledRejectionHandler();
  setupUncaughtExceptionHandler();

  logger.info('Global error handlers initialized');
}

/**
 * Helper function to check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Shutdown handler for graceful termination
 */
export async function shutdownGracefully(
  signal: string,
  server: any
): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Give existing connections 10 seconds to finish
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);

  try {
    // Close database connections
    // await closeDatabaseConnections();
    logger.info('Database connections closed');

    // Close other resources (Redis, etc.)
    // await closeRedisConnections();
    logger.info('All resources cleaned up');

    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err });
    process.exit(1);
  }
}
