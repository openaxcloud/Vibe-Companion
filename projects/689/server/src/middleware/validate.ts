import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError, ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

export interface ValidationSchemas {
  body?: AnyZodObject | ZodSchema<unknown>;
  params?: AnyZodObject | ZodSchema<unknown>;
  query?: AnyZodObject | ZodSchema<unknown>;
}

interface NormalizedZodIssue {
  path: string;
  message: string;
  code: string;
}

interface ValidationErrorResponse {
  status: 'error';
  message: string;
  errors: {
    body?: NormalizedZodIssue[];
    params?: NormalizedZodIssue[];
    query?: NormalizedZodIssue[];
  };
}

const normalizeZodError = (error: ZodError): NormalizedZodIssue[] => {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
};

const sendValidationError = (
  res: Response,
  target: ValidationTarget,
  error: ZodError
): void => {
  const response: ValidationErrorResponse = {
    status: 'error',
    message: 'Validation failed',
    errors: {
      [target]: normalizeZodError(error),
    },
  };

  res.status(400).json(response);
};

const validateTarget =
  (target: ValidationTarget, schema?: AnyZodObject | ZodSchema<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!schema) {
      next();
      return;
    }

    try {
      const parsed = schema.parse((req as any)[target]);
      (req as any)[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        sendValidationError(res, target, err);
        return;
      }

      res.status(500).json({
        status: 'error',
        message: 'Internal server error during validation',
      });
    }
  };

export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { body, params, query } = schemas;

    const stack: Array<() => void> = [];

    stack.push(() => validateTarget('body', body)(req, res, nextWrapper(0)));
    stack.push(() => validateTarget('params', params)(req, res, nextWrapper(1)));
    stack.push(() => validateTarget('query', query)(req, res, nextWrapper(2)));

    function nextWrapper(index: number): NextFunction {
      return (err?: unknown): void => {
        if (err) {
          next(err);
          return;
        }
        const nextIndex = index + 1;
        if (nextIndex >= stack.length) {
          next();
          return;
        }
        stack[nextIndex]();
      };
    }

    stack[0]();
  };

export const validateBody = (schema: AnyZodObject | ZodSchema<unknown>) => {
  return validate({ body: schema });
};

export const validateParams = (schema: AnyZodObject | ZodSchema<unknown>) => {
  return validate({ params: schema });
};

export const validateQuery = (schema: AnyZodObject | ZodSchema<unknown>) => {
  return validate({ query: schema });
};