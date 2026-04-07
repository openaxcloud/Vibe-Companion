import type { Request, Response, NextFunction } from 'express';

interface ApiErrorPayload {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  method?: string;
  timestamp: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

const mapStatusToErrorName = (statusCode: number): string => {
  if (statusCode >= 500) return 'InternalServerError';
  if (statusCode === 404) return 'NotFoundError';
  if (statusCode === 403) return 'ForbiddenError';
  if (statusCode === 401) return 'UnauthorizedError';
  if (statusCode === 400) return 'BadRequestError';
  if (statusCode >= 400) return 'ClientError';
  return 'Error';
};

const buildErrorResponse = (
  err: Error | ApiError,
  req: Request,
  statusCode: number
): ApiErrorPayload => {
  const errorName = mapStatusToErrorName(statusCode);

  const base: ApiErrorPayload = {
    statusCode,
    error: errorName,
    message: err.message || 'An unexpected error occurred.',
    path: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  };

  if (err instanceof ApiError && err.details !== undefined) {
    base.details = err.details;
  }

  return base;
};

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = 404;
  const payload: ApiErrorPayload = {
    statusCode,
    error: 'NotFoundError',
    message: 'Resource not found.',
    path: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(payload);
};

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
  }

  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  const payload = buildErrorResponse(err, req, statusCode);

  if (process.env.NODE_ENV !== 'production') {
    (payload as ApiErrorPayload & { stack?: string }).stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

export const asyncHandler =
  <TReq extends Request = Request, TRes extends Response = Response>(
    fn: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown>
  ) =>
  (req: TReq, res: TRes, next: NextFunction): Promise<unknown> =>
    Promise.resolve(fn(req, res, next)).catch(next);