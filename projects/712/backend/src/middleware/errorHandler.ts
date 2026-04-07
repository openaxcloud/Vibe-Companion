import type { Request, Response, NextFunction } from 'express';

type HttpStatusCode =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 502
  | 503
  | 504;

export interface AppErrorOptions {
  statusCode?: HttpStatusCode;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_SERVER_ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.cause = options.cause;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

interface SerializedError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  stack?: string;
  cause?: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

function buildErrorResponse(err: unknown): SerializedError {
  if (err instanceof AppError) {
    const base: SerializedError = {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    };

    if (err.details !== undefined) {
      base.details = err.details;
    }

    if (!isProduction) {
      base.stack = err.stack;
      if (err.cause !== undefined) {
        base.cause = err.cause;
      }
    }

    return base;
  }

  const fallback: SerializedError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: isProduction
      ? 'An unexpected error occurred.'
      : err instanceof Error
      ? err.message
      : 'Unknown error',
    statusCode: 500,
  };

  if (!isProduction && err instanceof Error) {
    fallback.stack = err.stack;
  }

  return fallback;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const serialized = buildErrorResponse(err);

  // Handle common validation libraries if passed directly
  // Example: express-validator style errors attached as err.errors or err.details
  if (
    !(err instanceof AppError) &&
    (isValidationLike(err) || isZodErrorLike(err) || isJoiErrorLike(err))
  ) {
    serialized.statusCode = 422;
    serialized.code = 'VALIDATION_ERROR';
    serialized.message = 'One or more validation errors occurred.';
    serialized.details = extractValidationDetails(err);
  }

  // Never send stack in production
  if (isProduction) {
    delete serialized.stack;
    delete serialized.cause;
  }

  return res.status(serialized.statusCode).json({
    error: {
      code: serialized.code,
      message: serialized.message,
      ...(serialized.details !== undefined && { details: serialized.details }),
      ...(!isProduction &&
        serialized.stack && { stack: serialized.stack }),
      ...(!isProduction &&
        serialized.cause !== undefined && { cause: serialized.cause }),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidationLike(err: unknown): boolean {
  if (!isRecord(err)) return false;
  if ('errors' in err && Array.isArray((err as Record<string, unknown>).errors)) {
    return true;
  }
  if ('details' in err && Array.isArray((err as Record<string, unknown>).details)) {
    return true;
  }
  return false;
}

function isZodErrorLike(err: unknown): boolean {
  if (!isRecord(err)) return false;
  if (err.name === 'ZodError' && Array.isArray((err as Record<string, unknown>).issues)) {
    return true;
  }
  return false;
}

function isJoiErrorLike(err: unknown): boolean {
  if (!isRecord(err)) return false;
  if (
    (err.name === 'ValidationError' || err.name === 'JoiValidationError') &&
    isRecord(err.details) &&
    Array.isArray((err.details as Record<string, unknown>).details)
  ) {
    return true;
  }
  return false;
}

type ValidationIssue = {
  message?: string;
  path?: (string | number)[];
  field?: string;
  type?: string;
  [key: string]: unknown;
};

interface NormalizedValidationError {
  field?: string;
  message: string;
  type?: string;
  path?: (string | number)[];
  original?: unknown;
}

function extractValidationDetails(err: unknown): NormalizedValidationError[] {
  if (!isRecord(err)) return [];

  // express-validator style: err.errors: { msg, param, location, value, ... }[]
  if (Array.isArray(err.errors)) {
    return err.errors.map((e: unknown) => {
      if (!isRecord(e)) return { message: 'Invalid value', original: e };
      return {
        field: typeof e.param === 'string' ? e.param : undefined,
        message:
          typeof e.msg === 'string'
            ? e.msg
            : typeof e.message === 'string'
            ? e.message
            : 'Invalid value',
        type: typeof e.location === 'string' ? e.location : undefined,
        original: e,
      };
    });
  }

  // Generic details: { details: ValidationIssue[] }
  if (Array.isArray(err.details)) {
    return err.details.map(normalizeGenericIssue);
  }

  // Joi: err.details.details[]
  if (isRecord(err.details) && Array.isArray(err.details.details)) {
    return err.details.details.map(normalizeGenericIssue);
  }

  // Zod: issues[]
  if (Array.isArray((err as Record<string, unknown>).issues)) {
    return (err as Record<string, unknown>).issues.map((issue: unknown) => {
      if (!isRecord(issue)) return { message: 'Invalid value', original: issue };

      const path = Array.isArray(issue.path)
        ? (issue.path as (string | number)[])
        : undefined;

      return {
        field: typeof issue.path?.[0] === 'string' ? String(issue.path[0]) : undefined,
        message:
          typeof issue.message === 'string'
            ? issue.message
            : 'Invalid value',
        type: typeof issue.code === 'string' ? issue.code : undefined,
        path,
        original: issue,
      };
    });
  }

  return [];
}

function normalizeGenericIssue(issue: unknown): NormalizedValidationError {
  if (!isRecord(issue)) {
    return { message: 'Invalid value', original: issue };
  }

  const castIssue = issue as ValidationIssue;
  const pathArray = Array.isArray(castIssue.path)
    ? castIssue.path
    : castIssue.field
    ? [castIssue.field]
    : undefined;

  return {
    field:
      typeof castIssue.field === 'string'
        ? castIssue.field
        : typeof castIssue.path?.[0] === 'string'
        ? String(castIssue.path[0])
        : undefined,
    message:
      typeof castIssue.message === 'string'
        ? castIssue.message
        : 'Invalid value',
    type: typeof castIssue.type === 'string' ? castIssue.type : undefined,
    path: pathArray,
    original: issue,
  };
}

export function notFoundHandler(req: Request, res: Response): Response {
  const error = new AppError(`Route not found: undefined undefined`, {
    statusCode: 404,
    code: 'NOT_FOUND',
  });

  const serialized = buildErrorResponse(error);

  return res.status(serialized.statusCode).json({
    error: {
      code: serialized.code,
      message: serialized.message,
      ...(serialized.details !== undefined && { details: serialized.details }),
      ...(!isProduction &&
        serialized.stack && { stack: serialized.stack }),
    },
  });
}