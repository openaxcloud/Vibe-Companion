import { NextFunction, Request, Response } from "express";

type HttpStatusCode =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 503;

interface NormalizedErrorShape {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    statusCode: HttpStatusCode;
    traceId?: string;
  };
}

interface AppErrorOptions {
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
  public override readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    const {
      statusCode = 500,
      code = "INTERNAL_SERVER_ERROR",
      details,
      isOperational = true,
      cause,
    } = options;

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

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, {
      statusCode: 422,
      code: "VALIDATION_ERROR",
      details,
      isOperational: true,
    });
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, {
      statusCode: 401,
      code: "AUTHENTICATION_ERROR",
      details,
      isOperational: true,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", details?: unknown) {
    super(message, {
      statusCode: 403,
      code: "FORBIDDEN",
      details,
      isOperational: true,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, {
      statusCode: 404,
      code: "NOT_FOUND",
      details,
      isOperational: true,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, {
      statusCode: 409,
      code: "CONFLICT",
      details,
      isOperational: true,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: unknown) {
    super(message, {
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
      details,
      isOperational: true,
    });
  }
}

export const isProduction = (): boolean =>
  (process.env.NODE_ENV || "").toLowerCase() === "production";

const isDev = (): boolean =>
  (process.env.NODE_ENV || "").toLowerCase() === "development";

const getTraceId = (req: Request): string | undefined => {
  const anyReq = req as Request & { id?: string; traceId?: string };
  return (
    anyReq.traceId ||
    anyReq.id ||
    (req.headers["x-request-id"] as string | undefined) ||
    undefined
  );
};

const normalizeError = (err: unknown): AppError => {
  if (err instanceof AppError) {
    return err;
  }

  // Handle common validation error shapes (e.g., from libraries like Joi, Zod)
  const anyErr = err as any;

  if (anyErr && typeof anyErr === "object") {
    // Example: errors from express-validator
    if (Array.isArray(anyErr.errors) && anyErr.errors.length > 0) {
      return new ValidationError("Validation failed", anyErr.errors);
    }

    // Example: generic "UnauthorizedError" from some JWT middlewares
    if (anyErr.name === "UnauthorizedError") {
      return new AuthError(anyErr.message || "Invalid or missing token");
    }
  }

  const message =
    (anyErr && typeof anyErr.message === "string" && anyErr.message) ||
    "Internal server error";

  return new AppError(message, {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    isOperational: false,
  });
};

const buildResponsePayload = (
  err: AppError,
  traceId?: string
): NormalizedErrorShape => {
  const payload: NormalizedErrorShape = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    },
  };

  if (traceId) {
    payload.error.traceId = traceId;
  }

  // In development, include details for easier debugging
  if (!isProduction() && err.details !== undefined) {
    payload.error.details = err.details;
  }

  return payload;
};

const logError = (err: AppError, req: Request, traceId?: string): void => {
  const baseMeta = {
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: err.statusCode,
    code: err.code,
    traceId,
  };

  if (isDev()) {
    // In development, log full stack and meta
    // eslint-disable-next-line no-console
    console.error(
      `[ERROR] undefined: undefined`,
      {
        ...baseMeta,
        stack: err.stack,
        details: err.details,
        cause: err.cause,
      }
    );
  } else {
    // In non-development, log minimal metadata and stack
    // eslint-disable-next-line no-console
    console.error(
      `[ERROR] undefined: undefined`,
      {
        ...baseMeta,
        stack: err.stack,
      }
    );
  }
};

// Express error-handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const normalized = normalizeError(err);
  const traceId = getTraceId(req);

  logError(normalized, req, traceId);

  const payload = buildResponsePayload(normalized, traceId);

  res
    .status(normalized.statusCode || 500)
    .json(payload);
};

export default errorHandler;