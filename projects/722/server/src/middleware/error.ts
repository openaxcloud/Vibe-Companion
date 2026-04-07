import type { NextFunction, Request, Response } from "express";

export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
  exposeMessage?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;
  public readonly exposeMessage: boolean;
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.exposeMessage = options.exposeMessage ?? this.statusCode < 500;
    this.cause = options.cause;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError;

const isProd = process.env.NODE_ENV === "production";

type KnownErrorMapping = {
  match: (err: unknown) => boolean;
  toAppError: (err: any) => AppError;
};

const isPrismaError = (err: any): boolean =>
  typeof err?.code === "string" &&
  typeof err?.clientVersion === "string" &&
  /P\d{4}/.test(err.code);

const mapPrismaError = (err: any): AppError => {
  const code = err.code as string;

  if (code === "P2002") {
    return new AppError("Resource already exists", {
      statusCode: 409,
      code: "CONFLICT",
      details: { target: err.meta?.target },
    });
  }

  if (code === "P2025") {
    return new AppError("Resource not found", {
      statusCode: 404,
      code: "NOT_FOUND",
      details: { cause: err.meta?.cause },
    });
  }

  if (code === "P2003") {
    return new AppError("Operation violates data constraints", {
      statusCode: 409,
      code: "FK_CONSTRAINT_VIOLATION",
      details: { field: err.meta?.field_name },
    });
  }

  return new AppError("Database error", {
    statusCode: 500,
    code: "DB_ERROR",
    details: { prismaCode: err.code, meta: err.meta },
    isOperational: false,
  });
};

const isZodError = (err: any): boolean =>
  typeof err?.issues === "object" &&
  Array.isArray(err.issues) &&
  typeof err?.name === "string" &&
  err.name === "ZodError";

const mapZodError = (err: any): AppError => {
  const details = Array.isArray(err.issues)
    ? err.issues.map((issue: any) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      }))
    : undefined;

  return new AppError("Validation failed", {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    details,
  });
};

const isJwtError = (err: any): boolean =>
  typeof err?.name === "string" &&
  (err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError" ||
    err.name === "NotBeforeError");

const mapJwtError = (err: any): AppError => {
  if (err.name === "TokenExpiredError") {
    return new AppError("Authentication token expired", {
      statusCode: 401,
      code: "TOKEN_EXPIRED",
    });
  }

  if (err.name === "NotBeforeError") {
    return new AppError("Authentication token not active", {
      statusCode: 401,
      code: "TOKEN_NOT_ACTIVE",
    });
  }

  return new AppError("Invalid authentication token", {
    statusCode: 401,
    code: "INVALID_TOKEN",
  });
};

const knownErrorMappings: KnownErrorMapping[] = [
  {
    match: (err) => isAppError(err),
    toAppError: (err) => err as AppError,
  },
  {
    match: isPrismaError,
    toAppError: mapPrismaError,
  },
  {
    match: isZodError,
    toAppError: mapZodError,
  },
  {
    match: isJwtError,
    toAppError: mapJwtError,
  },
];

const toAppError = (err: unknown): AppError => {
  for (const mapping of knownErrorMappings) {
    if (mapping.match(err)) {
      return mapping.toAppError(err as any);
    }
  }

  const message =
    err instanceof Error && err.message
      ? err.message
      : "An unexpected error occurred";

  const cause = err instanceof Error ? err : undefined;

  return new AppError(message, {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    isOperational: false,
    exposeMessage: false,
    cause,
  });
};

const buildErrorResponseBody = (error: AppError) => {
  const base: Record<string, unknown> = {
    error: {
      code: error.code,
      message: error.exposeMessage
        ? error.message
        : "An internal server error occurred",
    },
  };

  if (!isProd) {
    base.error.name = error.name;
    base.error.statusCode = error.statusCode;
    base.error.details = error.details;
    base.error.stack = error.stack;
    if (error.cause instanceof Error) {
      base.error.cause = {
        name: error.cause.name,
        message: error.cause.message,
        stack: error.cause.stack,
      };
    }
  }

  return base;
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new AppError("Route not found", {
    statusCode: 404,
    code: "NOT_FOUND",
  });

  res.status(error.statusCode).json(buildErrorResponseBody(error));
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const appError = toAppError(err);

  if (!appError.isOperational && !isProd) {
    // eslint-disable-next-line no-console
    console.error("Non-operational error:", {
      name: appError.name,
      message: appError.message,
      stack: appError.stack,
      cause:
        appError.cause instanceof Error
          ? {
              name: appError.cause.name,
              message: appError.cause.message,
              stack: appError.cause.stack,
            }
          : appError.cause,
    });
  }

  if (res.headersSent) {
    // eslint-disable-next-line no-console
    console.error("Headers already sent when handling error:", {
      name: appError.name,
      message: appError.message,
    });
    return;
  }

  res
    .status(appError.statusCode || 500)
    .json(buildErrorResponseBody(appError));
};

export const createHttpError = (
  statusCode: number,
  message: string,
  options: Omit<AppErrorOptions, "statusCode"> = {}
): AppError =>
  new AppError(message, {
    ...options,
    statusCode,
  });

export const BadRequestError = (
  message = "Bad request",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(400, message, options);

export const UnauthorizedError = (
  message = "Unauthorized",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(401, message, options);

export const ForbiddenError = (
  message = "Forbidden",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(403, message, options);

export const NotFoundError = (
  message = "Not found",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(404, message, options);

export const ConflictError = (
  message = "Conflict",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(409, message, options);

export const UnprocessableEntityError = (
  message = "Unprocessable entity",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError => createHttpError(422, message, options);

export const InternalServerError = (
  message = "Internal server error",
  options?: Omit<AppErrorOptions, "statusCode">
): AppError =>
  createHttpError(500, message, {
    ...options,
    isOperational: options?.isOperational ?? false,
    exposeMessage: options?.exposeMessage ?? false,
  });