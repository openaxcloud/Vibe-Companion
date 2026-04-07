import { NextFunction, Request, Response } from 'express';
import { ValidationError } from 'express-validation';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AppErrorOptions {
  statusCode?: number;
  status?: 'fail' | 'error';
  isOperational?: boolean;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  public statusCode: number;
  public status: 'fail' | 'error';
  public isOperational: boolean;
  public code?: string;
  public details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = options.statusCode ?? 500;
    this.status = options.status ?? (this.statusCode >= 500 ? 'error' : 'fail');
    this.isOperational = options.isOperational ?? true;
    this.code = options.code;
    this.details = options.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

interface ErrorResponse {
  status: 'fail' | 'error';
  message: string;
  code?: string;
  details?: unknown;
}

const isDev = process.env.NODE_ENV === 'development';

const formatErrorResponse = (err: AppError, includeStack = false): ErrorResponse & { stack?: string } => {
  const response: ErrorResponse & { stack?: string } = {
    status: err.status,
    message: err.message,
  };

  if (err.code) {
    response.code = err.code;
  }

  if (err.details) {
    response.details = err.details;
  }

  if (includeStack && err.stack) {
    response.stack = err.stack;
  }

  return response;
};

const handleValidationError = (err: ValidationError): AppError => {
  const details = err.details
    ? Object.entries(err.details).reduce<Record<string, unknown[]>>((acc, [key, value]) => {
        acc[key] = value.map((d: any) => d.message || String(d));
        return acc;
      }, {})
    : undefined;

  return new AppError('Validation failed', {
    statusCode: 400,
    status: 'fail',
    code: 'VALIDATION_ERROR',
    isOperational: true,
    details,
  });
};

const handleJwtError = (err: JsonWebTokenError | TokenExpiredError): AppError => {
  if (err instanceof TokenExpiredError) {
    return new AppError('Authentication token has expired', {
      statusCode: 401,
      status: 'fail',
      code: 'TOKEN_EXPIRED',
      isOperational: true,
    });
  }

  return new AppError('Invalid authentication token', {
    statusCode: 401,
    status: 'fail',
    code: 'INVALID_TOKEN',
    isOperational: true,
  });
};

const normalizeError = (err: unknown): AppError => {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof ValidationError) {
    return handleValidationError(err);
  }

  if (err instanceof JsonWebTokenError || err instanceof TokenExpiredError) {
    return handleJwtError(err);
  }

  if (err instanceof Error) {
    const appError = new AppError(err.message || 'Internal server error', {
      statusCode: 500,
      status: 'error',
      isOperational: false,
    });
    appError.stack = err.stack;
    return appError;
  }

  return new AppError('Internal server error', {
    statusCode: 500,
    status: 'error',
    isOperational: false,
  });
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const normalizedError = normalizeError(err);

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    statusCode: normalizedError.statusCode,
    status: normalizedError.status,
    code: normalizedError.code,
    isOperational: normalizedError.isOperational,
    message: normalizedError.message,
    stack: normalizedError.stack,
    userId: (req as any).user?.id,
  };

  if (normalizedError.isOperational) {
    logger.warn('Operational error', logPayload);
  } else {
    logger.error('Unexpected error', logPayload);
  }

  if (res.headersSent) {
    return;
  }

  const statusCode = normalizedError.statusCode || 500;

  if (isDev) {
    const responseBody = formatErrorResponse(normalizedError, true);
    res.status(statusCode).json(responseBody);
    return;
  }

  if (!normalizedError.isOperational) {
    const genericError = new AppError('Something went wrong', {
      statusCode: 500,
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      isOperational: true,
    });
    const responseBody = formatErrorResponse(genericError, false);
    res.status(genericError.statusCode).json(responseBody);
    return;
  }

  const responseBody = formatErrorResponse(normalizedError, false);
  res.status(statusCode).json(responseBody);
};

export default errorHandler;