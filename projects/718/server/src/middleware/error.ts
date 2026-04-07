import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type HttpErrorOptions = {
  status?: number;
  message?: string;
  details?: unknown;
  cause?: unknown;
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = options.details;

    if (options.cause) {
      // Preserve original error as cause when supported (Node 16+)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

const isProd = process.env.NODE_ENV === "production";

const mapZodError = (error: ZodError) => {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    message: "Validation failed",
    details: issues,
  };
};

const normalizeError = (err: unknown): HttpError => {
  if (err instanceof HttpError) {
    return err;
  }

  if (err instanceof ZodError) {
    const mapped = mapZodError(err);
    return new HttpError(400, mapped.message, { details: mapped.details, cause: err });
  }

  if (err instanceof Error) {
    return new HttpError(500, isProd ? "Internal server error" : err.message, {
      cause: err,
    });
  }

  return new HttpError(500, "Internal server error", { details: err });
};

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    status: 404,
    error: "NotFound",
    message: `Route undefined undefined not found`,
  });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const normalized = normalizeError(err);

  const status = normalized.status || 500;
  const baseBody: {
    status: number;
    error: string;
    message: string;
    details?: unknown;
    stack?: string;
  } = {
    status,
    error: normalized.name || "Error",
    message: normalized.message || "Internal server error",
  };

  if (!isProd && normalized.details !== undefined) {
    baseBody.details = normalized.details;
  }

  if (!isProd && normalized.stack) {
    baseBody.stack = normalized.stack;
  }

  // For unhandled errors in production, never leak internal messages
  if (isProd && status === 500) {
    baseBody.message = "Internal server error";
    delete baseBody.details;
  }

  res.status(status).json(baseBody);
};