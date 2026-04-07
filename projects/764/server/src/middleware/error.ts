import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

type Primitive = string | number | boolean | null | undefined;

export interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;
  public readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    const { message, statusCode = 500, code = 'INTERNAL_ERROR', details, cause, isOperational = true } = options;
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super({
      message,
      statusCode: 404,
      code: 'NOT_FOUND',
      details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super({
      message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super({
      message,
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      details,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super({
      message,
      statusCode: 403,
      code: 'FORBIDDEN',
      details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super({
      message,
      statusCode: 409,
      code: 'CONFLICT',
      details,
    });
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super({
      message,
      statusCode: 400,
      code: 'BAD_REQUEST',
      details,
    });
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

const isProduction = process.env.NODE_ENV === 'production';

const toSafePrimitive = (value: unknown): Primitive | Record<string, unknown> | Array<Primitive | Record<string, unknown>> => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => toSafePrimitive(v)) as Array<Primitive | Record<string, unknown>>;
  }

  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      obj[key] = toSafePrimitive(val);
    }
    return obj;
  }

  return String(value);
};

const formatZodError = (error: ZodError) => {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      expected: (issue as any).expected,
      received: (issue as any).received,
    })),
  };
};

const buildErrorResponse = (err: unknown): ErrorResponse => {
  if (err instanceof AppError) {
    const base: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
      },
    };

    if (err.details !== undefined) {
      base.error.details = toSafePrimitive(err.details);
    }

    if (!isProduction && err.stack) {
      base.error.stack = err.stack;
    }

    return base;
  }

  if (err instanceof ZodError) {
    const details = formatZodError(err);
    const base: ErrorResponse = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details,
      },
    };

    if (!isProduction && err.stack) {
      base.error.stack = err.stack;
    }

    return base;
  }

  const unknownError = err as Error | undefined;

  const base: ErrorResponse = {
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : (unknownError?.message || 'Unknown error'),
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    },
  };

  if (!isProduction && unknownError?.stack) {
    base.error.stack = unknownError.stack;
  }

  return base;
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const response = buildErrorResponse(err);
  res.status(response.error.statusCode).json(response);
};

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError());
};

export const wrapAsync =
  <TReq extends Request = Request, TRes extends Response = Response>(
    fn: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown> | unknown
  ) =>
  (req: TReq, res: TRes, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};