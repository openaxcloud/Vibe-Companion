import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError, ZodIssue } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

interface ValidationErrorField {
  path: string;
  message: string;
}

interface ValidationErrorResponse {
  status: 'error';
  error: 'ValidationError';
  message: string;
  details: Record<ValidationTarget, ValidationErrorField[]>;
}

const formatZodIssues = (issues: ZodIssue[]): ValidationErrorField[] => {
  return issues.map((issue) => {
    const path = issue.path.join('.') || '';
    return {
      path,
      message: issue.message,
    };
  });
};

const buildErrorResponse = (errors: Partial<Record<ValidationTarget, ZodError>>): ValidationErrorResponse => {
  const details: Record<ValidationTarget, ValidationErrorField[]> = {
    body: [],
    query: [],
    params: [],
  };

  (Object.keys(errors) as ValidationTarget[]).forEach((key) => {
    const err = errors[key];
    if (err) {
      details[key] = formatZodIssues(err.issues);
    }
  });

  return {
    status: 'error',
    error: 'ValidationError',
    message: 'Request validation failed',
    details,
  };
};

export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const errors: Partial<Record<ValidationTarget, ZodError>> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = result.error;
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = result.error;
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = result.error;
      } else {
        req.params = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      const responseBody = buildErrorResponse(errors);
      res.status(400).json(responseBody);
      return;
    }

    next();
  };

export default validate;