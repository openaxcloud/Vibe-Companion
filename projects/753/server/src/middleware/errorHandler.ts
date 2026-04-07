import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

interface AppErrorProps {
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
}

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;
  public isOperational: boolean;

  constructor({
    message,
    statusCode = 500,
    code,
    details,
    isOperational = true,
  }: AppErrorProps) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

type JsonErrorResponse = {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
  };
};

const isPrismaKnownError = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  !!err &&
  typeof err === "object" &&
  "code" in err &&
  "clientVersion" in err &&
  !!(err as Prisma.PrismaClientKnownRequestError).code;

const isPrismaValidationError = (
  err: unknown,
): err is Prisma.PrismaClientValidationError =>
  !!err &&
  typeof err === "object" &&
  err instanceof Prisma.PrismaClientValidationError;

const formatZodError = (error: ZodError): JsonErrorResponse => {
  const fieldErrors = error.flatten().fieldErrors;

  const details = Object.entries(fieldErrors).map(([field, messages]) => ({
    field,
    messages: messages ?? [],
  }));

  return {
    success: false,
    error: {
      message: "Validation failed",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details,
    },
  };
};

const formatPrismaKnownError = (
  error: Prisma.PrismaClientKnownRequestError,
): JsonErrorResponse => {
  let statusCode = 500;
  let message = "Database error";
  let code = error.code;

  // Map some common Prisma error codes to HTTP-friendly responses
  switch (error.code) {
    case "P2002":
      statusCode = 409;
      message = "Unique constraint violation";
      break;
    case "P2003":
      statusCode = 409;
      message = "Foreign key constraint violation";
      break;
    case "P2025":
      statusCode = 404;
      message = "Record not found";
      break;
    default:
      statusCode = 400;
      message = "Invalid database request";
      break;
  }

  return {
    success: false,
    error: {
      message,
      statusCode,
      code,
      details: {
        meta: error.meta,
      },
    },
  };
};

const formatPrismaValidationError = (
  error: Prisma.PrismaClientValidationError,
): JsonErrorResponse => {
  return {
    success: false,
    error: {
      message: "Database validation error",
      statusCode: 400,
      code: "PRISMA_VALIDATION_ERROR",
      details: {
        error: error.message,
      },
    },
  };
};

const formatAppError = (error: AppError): JsonErrorResponse => {
  return {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    },
  };
};

const formatUnknownError = (error: unknown): JsonErrorResponse => {
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: "Internal server error",
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        details: {
          name: error.name,
        },
      },
    };
  }

  return {
    success: false,
    error: {
      message: "Internal server error",
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
    },
  };
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response<JsonErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Zod validation error
  if (err instanceof ZodError) {
    const formatted = formatZodError(err);
    res.status(formatted.error.statusCode).json(formatted);
    return;
  }

  // Custom application error
  if (err instanceof AppError) {
    const formatted = formatAppError(err);
    res.status(formatted.error.statusCode).json(formatted);
    return;
  }

  // Prisma known request error
  if (isPrismaKnownError(err)) {
    const formatted = formatPrismaKnownError(err);
    res.status(formatted.error.statusCode).json(formatted);
    return;
  }

  // Prisma validation error
  if (isPrismaValidationError(err)) {
    const formatted = formatPrismaValidationError(err);
    res.status(formatted.error.statusCode).json(formatted);
    return;
  }

  // Fallback unknown error
  const formatted = formatUnknownError(err);
  res.status(formatted.error.statusCode).json(formatted);
};

export default errorHandler;