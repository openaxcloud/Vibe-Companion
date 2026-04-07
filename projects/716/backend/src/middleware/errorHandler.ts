import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

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
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.cause = options.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

interface ErrorResponseBody {
  success: false;
  message: string;
  code: string;
  statusCode: HttpStatusCode;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

const isProduction = process.env.NODE_ENV === "production";

const buildErrorResponse = (
  err: unknown,
  req: Request,
  statusCode: HttpStatusCode,
  message: string,
  code: string,
  details?: unknown
): ErrorResponseBody => {
  const base: ErrorResponseBody = {
    success: false,
    message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  const requestId =
    (req as Request & { id?: string }).id ??
    req.headers["x-request-id"]?.toString();
  if (requestId) {
    base.requestId = requestId;
  }

  if (!isProduction && details === undefined && err instanceof Error) {
    base.details = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  } else if (details !== undefined) {
    base.details = details;
  }

  return base;
};

const mapPrismaError = (err: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError) => {
  if ("code" in err) {
    switch (err.code) {
      case "P2002":
        return {
          statusCode: 409 as HttpStatusCode,
          message: "A record with the given unique constraints already exists.",
          code: "DB_UNIQUE_CONSTRAINT",
        };
      case "P2003":
        return {
          statusCode: 409 as HttpStatusCode,
          message: "A foreign key constraint failed.",
          code: "DB_FOREIGN_KEY_CONSTRAINT",
        };
      case "P2025":
        return {
          statusCode: 404 as HttpStatusCode,
          message: "The requested resource could not be found.",
          code: "DB_RECORD_NOT_FOUND",
        };
      default:
        return {
          statusCode: 500 as HttpStatusCode,
          message: "Database operation failed.",
          code: `DB_undefined`,
        };
    }
  }

  return {
    statusCode: 400 as HttpStatusCode,
    message: "Database validation error.",
    code: "DB_VALIDATION_ERROR",
  };
};

const mapStripeError = (err: Stripe.errors.StripeError) => {
  switch (err.type) {
    case "StripeCardError":
      return {
        statusCode: 402 as HttpStatusCode,
        message: err.message || "Your card was declined.",
        code: "STRIPE_CARD_ERROR",
      };
    case "StripeInvalidRequestError":
      return {
        statusCode: 400 as HttpStatusCode,
        message: err.message || "Invalid payment request.",
        code: "STRIPE_INVALID_REQUEST",
      };
    case "StripeAPIError":
      return {
        statusCode: 502 as HttpStatusCode,
        message: "Payment provider is currently unavailable.",
        code: "STRIPE_API_ERROR",
      };
    case "StripeConnectionError":
      return {
        statusCode: 503 as HttpStatusCode,
        message: "Unable to connect to payment provider.",
        code: "STRIPE_CONNECTION_ERROR",
      };
    case "StripeRateLimitError":
      return {
        statusCode: 429 as HttpStatusCode,
        message: "Too many payment requests. Please try again later.",
        code: "STRIPE_RATE_LIMIT",
      };
    default:
      return {
        statusCode: 500 as HttpStatusCode,
        message: "Payment processing failed.",
        code: "STRIPE_ERROR",
      };
  }
};

const isValidationError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { name?: string; errors?: unknown; issues?: unknown; details?: unknown };
  if (
    anyErr.name === "ValidationError" ||
    anyErr.name === "ZodError" ||
    "errors" in anyErr ||
    "issues" in anyErr ||
    "details" in anyErr
  ) {
    return true;
  }
  return false;
};

const mapValidationError = (err: any) => {
  const details =
    err?.errors ??
    err?.issues ??
    err?.details ??
    (Array.isArray(err) ? err : undefined);

  return {
    statusCode: 422 as HttpStatusCode,
    message: "Request validation failed.",
    code: "VALIDATION_ERROR",
    details,
  };
};

const detectAuthError = (err: any) => {
  const message = (err?.message || "").toString().toLowerCase();
  if (
    message.includes("unauthorized") ||
    message.includes("invalid token") ||
    message.includes("jwt") ||
    message.includes("not authenticated")
  ) {
    return true;
  }
  if (err?.name === "UnauthorizedError") return true;
  return false;
};

const mapAuthError = (err: any) => {
  const message = err?.message || "Authentication required.";
  return {
    statusCode: 401 as HttpStatusCode,
    message,
    code: "AUTH_ERROR",
  };
};

const detectNotFoundError = (err: any) => {
  const message = (err?.message || "").toString().toLowerCase();
  return (
    err?.status === 404 ||
    err?.statusCode === 404 ||
    message.includes("not found") ||
    err?.code === "ENOENT"
  );
};

const mapNotFoundError = (err: any) => {
  const message = err?.message || "Resource not found.";
  return {
    statusCode: 404 as HttpStatusCode,
    message,
    code: "NOT_FOUND",
  };
};

const logError = (err: unknown, req: Request, statusCode: HttpStatusCode, code: string): void => {
  const requestId =
    (req as Request & { id?: string }).id ??
    req.headers["x-request-id"]?.toString();

  const baseLog = {
    level: statusCode >= 500 ? "error" : "warn",
    statusCode,
    code,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    requestId,
  };

  if (err instanceof Error) {
    const payload = {
      ...baseLog,
      name: err.name,
      message: err.message,
      stack: !isProduction ? err.stack : undefined,
    };
    // In production, this should be wired into a logging service
    console.error(payload);
  } else {
    console.error({
      ...baseLog,
      error: err,
    });
  }
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode: HttpStatusCode = 500;
  let message = "An unexpected error occurred.";
  let code = "INTERNAL_ERROR";
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message || message;
    code = err.code;
    details = err.details;
  } else if (isValidationError(err)) {
    const mapped = mapValidationError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
    code = mapped.code;
    details = mapped.details;
  } else if (detectAuthError(err)) {
    const mapped = mapAuthError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
    code = mapped.code;
  } else if (detectNotFoundError(err)) {
    const mapped = mapNotFoundError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
    code = mapped.code;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientValidationError