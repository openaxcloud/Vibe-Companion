import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

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
  cause?: unknown;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    if (options.cause) {
      // @ts-expect-error cause is not yet standard in all TS lib targets
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: HttpStatusCode;
    details?: unknown;
    meta?: Record<string, unknown>;
  };
}

const isZodError = (error: unknown): error is ZodError => {
  return error instanceof ZodError;
};

const isPrismaClientKnownRequestError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "clientVersion" in error)
  );
};

const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

const mapPrismaErrorToHttp = (
  error: Prisma.PrismaClientKnownRequestError
): { statusCode: HttpStatusCode; code: string; message: string; meta?: Record<string, unknown> } => {
  switch (error.code) {
    case "P2002":
      return {
        statusCode: 409,
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "A record with the provided unique field already exists.",
        meta: {
          target: (error.meta?.target as string[]) ?? undefined
        }
      };
    case "P2003":
      return {
        statusCode: 409,
        code: "FOREIGN_KEY_CONSTRAINT_FAILED",
        message: "The record is linked to another resource and cannot be processed.",
        meta: {
          field: error.meta?.field ?? undefined
        }
      };
    case "P2025":
      return {
        statusCode: 404,
        code: "RECORD_NOT_FOUND",
        message: "The requested resource could not be found.",
        meta: {
          cause: error.meta?.cause ?? undefined
        }
      };
    default:
      return {
        statusCode: 500,
        code: "DATABASE_ERROR",
        message: "A database error occurred.",
        meta: {
          prismaCode: error.code,
          clientVersion: error.clientVersion
        }
      };
  }
};

const mapZodErrorToDetails = (error: ZodError): unknown => {
  return error.errors.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
};

const getSafeErrorMessage = (statusCode: HttpStatusCode, message?: string): string => {
  if (statusCode >= 500) {
    return "An unexpected error occurred. Please try again later.";
  }
  return message ?? "Request could not be processed.";
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): Response<ErrorResponse> | void => {
  let statusCode: HttpStatusCode = 500;
  let code = "INTERNAL_ERROR";
  let message: string | undefined;
  let details: unknown;
  let meta: Record<string, unknown> | undefined;

  if (isAppError(err)) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (isZodError(err)) {
    statusCode = 422;
    code = "VALIDATION_ERROR";
    message = "One or more validation errors occurred.";
    details = mapZodErrorToDetails(err);
  } else if (isPrismaClientKnownRequestError(err)) {
    const mapped = mapPrismaErrorToHttp(err);
    statusCode = mapped.statusCode;
    code = mapped.code;
    message = mapped.message;
    meta = mapped.meta;
  } else if (err instanceof Error) {
    message = err.message;
  }

  const safeMessage = getSafeErrorMessage(statusCode, message);

  if (process.env.NODE_ENV !== "production") {
    // In non-production environments, log the full error object
    // eslint-disable-next-line no-console
    console.error(err);
  } else if (!isAppError(err)) {
    // In production, log unknown/unexpected errors with limited exposure
    // eslint-disable-next-line no-console
    console.error("Unexpected error:", {
      name: err instanceof Error ? err.name : "UnknownError",
      message: err instanceof Error ? err.message : String(err)
    });
  }

  const responseBody: ErrorResponse = {
    success: false,
    error: {
      message: safeMessage,
      code,
      statusCode
    }
  };

  if (details !== undefined) {
    responseBody.error.details = details;
  }

  if (meta !== undefined) {
    responseBody.error.meta = meta;
  }

  return res.status(statusCode).json(responseBody);
};

export default errorHandler;