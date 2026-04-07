import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError, ZodSchema } from 'zod';

type ValidationLocation = 'body' | 'query' | 'params';

type SchemaMap = Partial<Record<ValidationLocation, ZodSchema<any>>>;

export interface ValidationSchemas extends SchemaMap {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

interface ValidationErrorItem {
  path: string;
  message: string;
}

interface ValidationErrorResponse {
  error: 'ValidationError';
  details: ValidationErrorItem[];
}

const formatZodError = (error: ZodError): ValidationErrorItem[] =>
  error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const errorDetails: ValidationErrorItem[] = [];

    const validateLocation = (location: ValidationLocation, schema?: ZodSchema<any>): void => {
      if (!schema) return;
      try {
        const data = (req as any)[location];
        const parsed = schema.parse(data);
        (req as any)[location] = parsed;
      } catch (err) {
        if (err instanceof ZodError) {
          errorDetails.push(
            ...formatZodError(err).map((detail) => ({
              ...detail,
              path: `undefinedundefined`,
            }))
          );
        } else {
          errorDetails.push({
            path: location,
            message: 'Invalid request data',
          });
        }
      }
    };

    validateLocation('body', schemas.body);
    validateLocation('query', schemas.query);
    validateLocation('params', schemas.params);

    if (errorDetails.length > 0) {
      const responseBody: ValidationErrorResponse = {
        error: 'ValidationError',
        details: errorDetails,
      };
      res.status(400).json(responseBody);
      return;
    }

    next();
  };

export default validate;