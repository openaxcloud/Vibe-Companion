import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError, ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

export interface ValidationSchemas {
  body?: AnyZodObject | ZodSchema<unknown>;
  query?: AnyZodObject | ZodSchema<unknown>;
  params?: AnyZodObject | ZodSchema<unknown>;
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export interface ValidationErrorResponse {
  status: number;
  error: string;
  details: ValidationErrorDetail[];
}

const formatZodError = (error: ZodError): ValidationErrorDetail[] => {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return {
      path: path || "root",
      message: issue.message,
    };
  });
};

const validateTarget =
  (schema: AnyZodObject | ZodSchema<unknown>, target: ValidationTarget) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        const details = formatZodError(result.error);
        const response: ValidationErrorResponse = {
          status: 400,
          error: "ValidationError",
          details,
        };
        res.status(400).json(response);
        return;
      }

      (req as any)[target] = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };

export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const middlewares: Array<
      (req: Request, res: Response, next: NextFunction) => void
    > = [];

    if (schemas.body) {
      middlewares.push(validateTarget(schemas.body, "body"));
    }
    if (schemas.query) {
      middlewares.push(validateTarget(schemas.query, "query"));
    }
    if (schemas.params) {
      middlewares.push(validateTarget(schemas.params, "params"));
    }

    if (middlewares.length === 0) {
      next();
      return;
    }

    let idx = 0;
    const run = (): void => {
      const middleware = middlewares[idx];
      if (!middleware) {
        next();
        return;
      }
      middleware(req, res, (err?: any) => {
        if (err) {
          next(err);
          return;
        }
        idx += 1;
        run();
      });
    };

    run();
  };

export const validateBody = (schema: AnyZodObject | ZodSchema<unknown>) =>
  validate({ body: schema });

export const validateQuery = (schema: AnyZodObject | ZodSchema<unknown>) =>
  validate({ query: schema });

export const validateParams = (schema: AnyZodObject | ZodSchema<unknown>) =>
  validate({ params: schema });