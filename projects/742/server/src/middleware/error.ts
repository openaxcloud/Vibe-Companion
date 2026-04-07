import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown, isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized", statusCode = 401, details?: unknown) {
    super(message, statusCode, details, true);
    this.name = "AuthError";
  }
}

export interface ErrorResponseBody {
  success: false;
  error: {
    name: string;
    message: string;
    code?: string | number;
    issues?: Array<{
      path: (string | number)[];
      message: string;
      code?: string;
    }>;
    details?: unknown;
  };
}

const isZodError = (err: unknown): err is ZodError =>
  err instanceof ZodError;

const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError;

const isAuthError = (err: unknown): err is AuthError =>
  err instanceof AuthError;

const serializeZodErrorIssues = (error: ZodError): ErrorResponseBody["error"]["issues"] =>
  error.issues.map(issue => ({
    path: issue.path,
    message: issue.message,
    code: issue.code
  }));

const determineStatusCode = (error: unknown): number => {
  if (isAuthError(error)) {
    return error.statusCode || 401;
  }

  if (isAppError(error)) {
    return error.statusCode || 400;
  }

  if (isZodError(error)) {
    return 400;
  }

  return 500;
};

const buildErrorResponse = (error: unknown, statusCode: number): ErrorResponseBody => {
  if (isZodError(error)) {
    return {
      success: false,
      error: {
        name: "ValidationError",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: serializeZodErrorIssues(error)
      }
    };
  }

  if (isAppError(error)) {
    return {
      success: false,
      error: {
        name: error.name,
        message: error.message,
        code: error.statusCode,
        details: error.details
      }
    };
  }

  const unknownError = error as Error | undefined;

  return {
    success: false,
    error: {
      name: unknownError?.name || "InternalServerError",
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR"
    }
  };
};

// Basic logger to STDOUT/STDERR; in production, replace with structured logger
const logError = (error: unknown, req: Request, statusCode: number): void => {
  const baseContext = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    timestamp: new Date().toISOString(),
    ip: req.ip
  };

  if (isZodError(error)) {
    console.warn(
      "[ValidationError]",
      JSON.stringify(
        {
          ...baseContext,
          issues: serializeZodErrorIssues(error)
        },
        null,
        2
      )
    );
    return;
  }

  if (isAppError(error)) {
    console.warn(
      `[undefined]`,
      JSON.stringify(
        {
          ...baseContext,
          message: error.message,
          details: error.details,
          stack: error.stack
        },
        null,
        2
      )
    );
    return;
  }

  const unknownError = error as Error | undefined;

  console.error(
    "[UnexpectedError]",
    JSON.stringify(
      {
        ...baseContext,
        name: unknownError?.name,
        message: unknownError?.message,
        stack: unknownError?.stack
      },
      null,
      2
    )
  );
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response<ErrorResponseBody> => {
  const statusCode = determineStatusCode(err);

  logError(err, req, statusCode);

  const payload = buildErrorResponse(err, statusCode);

  if (res.headersSent) {
    // If headers are already sent, delegate to Express default handler
    // by terminating the response as best as we can.
    return res;
  }

  return res.status(statusCode).json(payload);
};