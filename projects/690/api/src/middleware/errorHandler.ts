import type { NextFunction, Request, Response } from 'express';

interface ApiErrorOptions {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
  isOperational?: boolean;
  cause?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;
  public readonly cause?: unknown;

  constructor(options: ApiErrorOptions = {}) {
    const {
      statusCode = 500,
      code = 'INTERNAL_SERVER_ERROR',
      message = 'An unexpected error occurred.',
      details,
      isOperational = true,
      cause,
    } = options;

    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    this.cause = cause;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

const isProduction = process.env.NODE_ENV === 'production';

const sanitizeErrorForClient = (err: unknown): { message: string; code: string; details?: unknown } => {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      code: err.code,
      ...(err.details !== undefined && { details: err.details }),
    };
  }

  if (isProduction) {
    return {
      message: 'An unexpected error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  const genericError = err as Error | undefined;
  return {
    message: genericError?.message || 'An unexpected error occurred.',
    code: 'INTERNAL_SERVER_ERROR',
  };
};

const logError = (err: unknown, req: Request): void => {
  const timestamp = new Date().toISOString();
  const baseLog = {
    timestamp,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
  };

  if (err instanceof ApiError) {
    // Replace with a proper logger (e.g., pino, winston) in production
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        type: 'ApiError',
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        details: err.details,
        stack: isProduction ? undefined : err.stack,
        ...baseLog,
      })
    );
  } else {
    const unknownError = err as Error | undefined;
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        type: 'UnknownError',
        message: unknownError?.message || 'Unknown error',
        stack: isProduction ? undefined : unknownError?.stack,
        ...baseLog,
      })
    );
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  logError(err, req);

  let statusCode = 500;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
  } else if (typeof err?.status === 'number') {
    statusCode = err.status;
  } else if (typeof err?.statusCode === 'number') {
    statusCode = err.statusCode;
  }

  const errorPayload = sanitizeErrorForClient(err);

  const responseBody = {
    success: false,
    error: errorPayload,
  };

  if (res.headersSent) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Headers already sent when attempting to handle error',
        path: req.originalUrl || req.url,
      })
    );
    return;
  }

  res.status(statusCode).json(responseBody);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      details: {
        method: req.method,
        path: req.originalUrl || req.url,
      },
    },
  });
};