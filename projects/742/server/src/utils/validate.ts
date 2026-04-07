import { NextFunction, Request, RequestHandler, Response } from "express";
import { AnyZodObject, ZodError, ZodIssue } from "zod";

export type ValidationSchemas<
  TBody extends AnyZodObject | undefined = AnyZodObject | undefined,
  TQuery extends AnyZodObject | undefined = AnyZodObject | undefined,
  TParams extends AnyZodObject | undefined = AnyZodObject | undefined
> = {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
};

export type InferValidatedRequest<TSchemas extends ValidationSchemas> = Request<
  TSchemas["params"] extends AnyZodObject ? z.infer<NonNullable<TSchemas["params"]>> : Request["params"],
  any,
  TSchemas["body"] extends AnyZodObject ? z.infer<NonNullable<TSchemas["body"]>> : Request["body"],
  TSchemas["query"] extends AnyZodObject ? z.infer<NonNullable<TSchemas["query"]>> : Request["query"]
>;

export interface ValidationErrorItem {
  path: string;
  message: string;
  code: string;
}

export interface ValidationErrorResponse {
  status: "error";
  type: "validation";
  errors: {
    body?: ValidationErrorItem[];
    query?: ValidationErrorItem[];
    params?: ValidationErrorItem[];
  };
}

type ZodSchemaLike = AnyZodObject;

const formatZodIssues = (issues: ZodIssue[]): ValidationErrorItem[] => {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
};

const buildValidationErrorResponse = (errors: {
  body?: ZodError;
  query?: ZodError;
  params?: ZodError;
}): ValidationErrorResponse => {
  const responseErrors: ValidationErrorResponse["errors"] = {};

  if (errors.body) {
    responseErrors.body = formatZodIssues(errors.body.issues);
  }
  if (errors.query) {
    responseErrors.query = formatZodIssues(errors.query.issues);
  }
  if (errors.params) {
    responseErrors.params = formatZodIssues(errors.params.issues);
  }

  return {
    status: "error",
    type: "validation",
    errors: responseErrors,
  };
};

export const validateRequest = <
  TBody extends ZodSchemaLike | undefined = undefined,
  TQuery extends ZodSchemaLike | undefined = undefined,
  TParams extends ZodSchemaLike | undefined = undefined
>(
  schemas: ValidationSchemas<TBody, TQuery, TParams>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { body?: ZodError; query?: ZodError; params?: ZodError } = {};

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
        req.query = result.data as any;
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

    if (errors.body || errors.query || errors.params) {
      const formatted = buildValidationErrorResponse(errors);
      res.status(400).json(formatted);
      return;
    }

    next();
  };
};

type ZodInfer<T> = T extends AnyZodObject ? import("zod").infer<T> : never;

export type TypedRequest<
  TBodySchema extends AnyZodObject | undefined,
  TQuerySchema extends AnyZodObject | undefined,
  TParamsSchema extends AnyZodObject | undefined
> = Request<
  TParamsSchema extends AnyZodObject ? ZodInfer<TParamsSchema> : Request["params"],
  any,
  TBodySchema extends AnyZodObject ? ZodInfer<TBodySchema> : Request["body"],
  TQuerySchema extends AnyZodObject ? ZodInfer<TQuerySchema> : Request["query"]
>;

export const createValidatedHandler = <
  TBodySchema extends AnyZodObject | undefined = undefined,
  TQuerySchema extends AnyZodObject | undefined = undefined,
  TParamsSchema extends AnyZodObject | undefined = undefined,
  TResBody = any
>(
  schemas: ValidationSchemas<TBodySchema, TQuerySchema, TParamsSchema>,
  handler: (
    req: TypedRequest<TBodySchema, TQuerySchema, TParamsSchema>,
    res: Response<TResBody>,
    next: NextFunction
  ) => unknown | Promise<unknown>
): RequestHandler => {
  const validator = validateRequest(schemas);

  return (req: Request, res: Response, next: NextFunction): void => {
    validator(req, res, (err?: any) => {
      if (err) {
        next(err);
        return;
      }

      Promise.resolve(handler(req as any, res, next)).catch(next);
    });
  };
};

export const validate = {
  request: validateRequest,
  handler: createValidatedHandler,
};