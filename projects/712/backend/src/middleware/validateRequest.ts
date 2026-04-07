import { Request, Response, NextFunction, RequestHandler } from "express";
import Joi, { ObjectSchema, ValidationErrorItem } from "joi";

type ValidationTarget = "body" | "query" | "params";

export interface ValidationSchemas {
  body?: ObjectSchema;
  query?: ObjectSchema;
  params?: ObjectSchema;
}

interface FormattedValidationError {
  field: string;
  location: ValidationTarget;
  message: string;
  type: string;
}

interface ValidationErrorResponse {
  status: "error";
  code: string;
  message: string;
  errors: FormattedValidationError[];
}

interface ValidateOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  convert?: boolean;
}

const defaultJoiOptions: ValidateOptions = {
  abortEarly: false,
  allowUnknown: true,
  stripUnknown: true,
  convert: true,
};

const formatJoiErrors = (
  errorItems: ValidationErrorItem[],
  location: ValidationTarget
): FormattedValidationError[] => {
  return errorItems.map((err) => {
    const path = err.path.join(".") || "value";
    return {
      field: path,
      location,
      message: err.message.replace(/["]/g, ""),
      type: err.type,
    };
  });
};

const buildErrorResponse = (errors: FormattedValidationError[]): ValidationErrorResponse => {
  return {
    status: "error",
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    errors,
  };
};

export const validateRequest =
  (schemas: ValidationSchemas, options: ValidateOptions = {}): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const joiOptions: Joi.ValidationOptions = {
      abortEarly: options.abortEarly ?? defaultJoiOptions.abortEarly,
      allowUnknown: options.allowUnknown ?? defaultJoiOptions.allowUnknown,
      stripUnknown: options.stripUnknown ?? defaultJoiOptions.stripUnknown,
      convert: options.convert ?? defaultJoiOptions.convert,
    };

    const aggregatedErrors: FormattedValidationError[] = [];

    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, joiOptions);
      if (error) {
        aggregatedErrors.push(...formatJoiErrors(error.details, "body"));
      } else {
        req.body = value;
      }
    }

    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, joiOptions);
      if (error) {
        aggregatedErrors.push(...formatJoiErrors(error.details, "query"));
      } else {
        req.query = value;
      }
    }

    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, joiOptions);
      if (error) {
        aggregatedErrors.push(...formatJoiErrors(error.details, "params"));
      } else {
        req.params = value;
      }
    }

    if (aggregatedErrors.length > 0) {
      const response = buildErrorResponse(aggregatedErrors);
      res.status(400).json(response);
      return;
    }

    next();
  };

export default validateRequest;