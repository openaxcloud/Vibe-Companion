import type { NextFunction, Request, Response } from 'express';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR';

export interface ErrorDetails {
  field?: string;
  message?: string;
  [key: string]: unknown;
}

export interface AppErrorOptions {
  statusCode?: number;
  code?: ErrorCode;
  details?: ErrorDetails | ErrorDetails[] | null;
  cause?: unknown;
  exposeMessage?: boolean;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: ErrorDetails | ErrorDetails[] | null;
  public readonly isOperational: boolean;
  public readonly exposeMessage: boolean;

  // Maintain proper stack for where error was thrown (only on V8)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private static readonly captureStackTrace = Error.captureStackTrace?.bind(Error) ?? null;

  constructor(message: string, options: AppErrorOptions = {}) {
    const { statusCode, code, details = null, cause, exposeMessage = true } = options;
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;

    this.statusCode = statusCode ?? 500;
    this.code = code ?? 'INTERNAL_ERROR';
    this.details = details;
    this.isOperational = true;
    this.exposeMessage = exposeMessage;

    if (cause instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = cause;
    }

    if (AppError.captureStackTrace) {
      AppError.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): {
    name: string;
    message: string;
    code: ErrorCode;
    statusCode: number;
    details: ErrorDetails | ErrorDetails[] | null;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// Convenience constructors

export const badRequest = (
  message = 'Bad request',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 400,
    code: 'BAD_REQUEST',
    ...options,
  });

export const unauthorized = (
  message = 'Unauthorized',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 401,
    code: 'UNAUTHORIZED',
    ...options,
  });

export const forbidden = (
  message = 'Forbidden',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 403,
    code: 'FORBIDDEN',
    ...options,
  });

export const notFound = (
  message = 'Not found',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 404,
    code: 'NOT_FOUND',
    ...options,
  });

export const conflict = (
  message = 'Conflict',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 409,
    code: 'CONFLICT',
    ...options,
  });

export const unprocessableEntity = (
  message = 'Unprocessable entity',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 422,
    code: 'UNPROCESSABLE_ENTITY',
    ...options,
  });

export const rateLimited = (
  message = 'Too many requests',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 429,
    code: 'RATE_LIMITED',
    ...options,
  });

export const serviceUnavailable = (
  message = 'Service unavailable',
  options: Omit<AppErrorOptions, 'statusCode' | 'code'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 503,
    code: 'SERVICE_UNAVAILABLE',
    ...options,
  });

export const validationError = (
  message = 'Validation failed',
  details: ErrorDetails[] = [],
  options: Omit<AppErrorOptions, 'statusCode' | 'code' | 'details'> = {},
): AppError =>
  new AppError(message, {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    details,
    ...options,
  });

// Type guards

export const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError ||
  (typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    'message' in err);

// Error response payload

export interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails | ErrorDetails[];
    traceId?: string;
  };
}

// Helpers

export const toAppError = (err: unknown, fallbackMessage = 'Internal server error'): AppError => {
  if (isAppError(err)) return err;

  if (err instanceof Error) {
    return new AppError(err.message || fallbackMessage, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      cause: err,
      exposeMessage: false,
    });
  }

  return new AppError(fallbackMessage, {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    details: { originalError: err as unknown },
    exposeMessage: false,
  });
};

// Central Express error handling middleware

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response<ErrorResponseBody>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void => {
  const appError = toAppError(err);

  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = appError.statusCode || 500;

  const traceId: string | undefined =
    (req as Request & { traceId?: string }).traceId ||
    (res as Response & { locals: { traceId?: string } }).locals?.traceId;

  const response: ErrorResponseBody = {
    success: false,
    error: {
      code: appError.code,
      message:
        isProd && !appError.exposeMessage && statusCode >= 500
          ? 'Internal server error'
          : appError.message || 'Unexpected error',
    },
  };

  if (appError.details) {
    response.error.details = appError.details;
  }

  if (traceId) {
    response.error.traceId = traceId;
  }

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.error('[ErrorMiddleware]', {
      name: appError.name,
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      stack: appError.stack,
      cause:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appError as any).cause instanceof Error
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: (appError as any).cause.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              message: (appError as any).cause.message,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              stack: (appError as any).cause.stack,
            }
          : undefined,
      details: appError.details,
      traceId,
    });
  }

  if (res.headersSent) {
    // eslint-disable-next-line no-console
    if (!isProd) console.warn('[ErrorMiddleware] Headers already sent, delegating to default handler');
    return;
  }

  res.status(statusCode).json(response);
};

// 404 handler helper

export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  next(
    notFound('Resource not found', {
      details: {
        method: req.method,
        path: req.originalUrl ?? req.url,
      },
    }),
  );
};