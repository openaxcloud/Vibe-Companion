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
  | 503;

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
  };
}

interface KnownError extends Error {
  statusCode?: HttpStatusCode;
  code?: string;
  expose?: boolean;
  meta?: unknown;
}

const isZodError = (err: unknown): err is ZodError =>
  err instanceof ZodError;

const isPrismaError = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError;

const isPrismaValidationError = (err: unknown): err is Prisma.PrismaClientValidationError =>
  err instanceof Prisma.PrismaClientValidationError;

const isKnownError = (err: unknown): err is KnownError =>
  typeof err === "object" && err !== null && "message" in err;

const mapZodError = (err: ZodError): { statusCode: HttpStatusCode; body: ErrorResponse } => {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return {
    statusCode: 422,
    body: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fieldErrors,
      },
    },
  };
};

const mapPrismaKnownError = (
  err: Prisma.PrismaClientKnownRequestError
): { statusCode: HttpStatusCode; body: ErrorResponse } => {
  // See: https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
  switch (err.code) {
    case "P2002": {
      return {
        statusCode: 409,
        body: {
          success: false,
          error: {
            code: "CONFLICT",
            message: "Resource already exists",
          },
        },
      };
    }
    case "P2003": {
      return {
        statusCode: 409,
        body: {
          success: false,
          error: {
            code: "FOREIGN_KEY_CONSTRAINT",
            message: "Operation violates a foreign key constraint",
          },
        },
      };
    }
    case "P2025": {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Requested resource not found",
          },
        },
      };
    }
    default: {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "A database error occurred",
          },
        },
      };
    }
  }
};

const mapPrismaValidationError = (
  _err: Prisma.PrismaClientValidationError
): { statusCode: HttpStatusCode; body: ErrorResponse } => {
  return {
    statusCode: 400,
    body: {
      success: false,
      error: {
        code: "INVALID_QUERY",
        message: "The database query is invalid",
      },
    },
  };
};

const mapKnownAppError = (
  err: KnownError
): { statusCode: HttpStatusCode; body: ErrorResponse } => {
  const statusCode: HttpStatusCode = (err.statusCode as HttpStatusCode) || 400;
  const code = err.code || "BAD_REQUEST";
  const expose = err.expose ?? true;

  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message: expose ? err.message : "An error occurred while processing your request",
        details: expose ? err.meta : undefined,
      },
    },
  };
};

const mapUnknownError = (): { statusCode: HttpStatusCode; body: ErrorResponse } => {
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response | void => {
  // If headers are already sent, delegate to Express default
  if (res.headersSent) {
    return;
  }

  let statusCode: HttpStatusCode;
  let body: ErrorResponse;

  if (isZodError(err)) {
    ({ statusCode, body } = mapZodError(err));
  } else if (isPrismaError(err)) {
    ({ statusCode, body } = mapPrismaKnownError(err));
  } else if (isPrismaValidationError(err)) {
    ({ statusCode, body } = mapPrismaValidationError(err));
  } else if (isKnownError(err)) {
    ({ statusCode, body } = mapKnownAppError(err));
  } else {
    ({ statusCode, body } = mapUnknownError());
  }

  return res.status(statusCode).json(body);
};

export default errorHandler;