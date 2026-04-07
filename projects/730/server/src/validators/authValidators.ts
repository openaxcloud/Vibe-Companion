import { z, ZodError, ZodIssue } from "zod";
import { Request, Response, NextFunction } from "express";

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

const formatZodIssues = (issues: ZodIssue[]): ApiErrorDetail[] =>
  issues.map((issue) => ({
    field: issue.path.join(".") || undefined,
    message: issue.message,
    code: issue.code,
  }));

export const createValidationErrorResponse = (
  message: string,
  issues: ZodIssue[]
): ApiErrorResponse => ({
  success: false,
  message,
  errors: formatZodIssues(issues),
});

export const createSuccessResponse = <T = unknown>(
  message: string,
  data?: T
): ApiSuccessResponse<T> => ({
  success: true,
  message,
  ...(data !== undefined ? { data } : {}),
});

const emailSchema = z
  .string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  })
  .trim()
  .min(1, "Email is required")
  .max(255, "Email must be at most 255 characters")
  .email("Email must be a valid email address");

const passwordSchema = z
  .string({
    required_error: "Password is required",
    invalid_type_error: "Password must be a string",
  })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long")
  .regex(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

const optionalPasswordSchema = passwordSchema.optional();

const nameSchema = z
  .string({
    required_error: "Name is required",
    invalid_type_error: "Name must be a string",
  })
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

const usernameSchema = z
  .string({
    required_error: "Username is required",
    invalid_type_error: "Username must be a string",
  })
  .trim()
  .min(3, "Username must be at least 3 characters long")
  .max(30, "Username must be at most 30 characters long")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username may only contain letters, numbers, and underscores"
  );

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    const normalized = val.toLowerCase().trim();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    throw new Error("Invalid boolean value");
  });

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string({
        required_error: "Confirm password is required",
        invalid_type_error: "Confirm password must be a string",
      })
      .min(1, "Confirm password is required"),
    name: nameSchema,
    username: usernameSchema.optional(),
    acceptTerms: booleanStringSchema.refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(1, "Password is required"),
  rememberMe: booleanStringSchema.optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({
      required_error: "Refresh token is required",
      invalid_type_error: "Refresh token must be a string",
    })
    .min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string({
        required_error: "Reset token is required",
        invalid_type_error: "Reset token must be a string",
      })
      .min(1, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z
      .string({
        required_error: "Confirm password is required",
        invalid_type_error: "Confirm password must be a string",
      })
      .min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({
        required_error: "Current password is required",
        invalid_type_error: "Current password must be a string",
      })
      .min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z
      .string({
        required_error: "Confirm new password is required",
        invalid_type_error: "Confirm new password must be a string",
      })
      .min(1, "Confirm new password is required"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z
    .string({
      required_error: "Verification token is required",
      invalid_type_error: "Verification token must be a string",
    })
    .min(1, "Verification token is required"),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  password: optionalPasswordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

type AnyZodObject = z.ZodObject<any, any, any>;
type ValidationTarget = "body" | "query" | "params";

interface ValidationOptions {
  target?: ValidationTarget;
  stripUnknown?: boolean;
}

const validateRequest =
  (schema: AnyZodObject, options: ValidationOptions = {}) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { target = "body", stripUnknown = true } = options;

    const data =
      target === "body" ? req.body : target === "query" ? req.query : req.params;

    try {
      const parsed = schema.parse(
        stripUnknown ? schema.strip().parse(data) : data
      );

      if (target === "body") {
        req.body = parsed;
      } else if (target === "query") {
        req.query = parsed;
      } else {
        req.params = parsed;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response = createValidationErrorResponse(
          "Invalid request payload",
          error.issues
        );
        res.status(400).json(response);
        return;
      }

      next(error);
    }
  };

export const validateRegister = validateRequest(registerSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateLogin = validateRequest(loginSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateRefreshToken = validateRequest(refreshTokenSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateForgotPassword = validateRequest(forgotPasswordSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateResetPassword = validateRequest(resetPasswordSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateChangePassword = validateRequest(changePasswordSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateVerifyEmail = validateRequest(verifyEmailSchema, {
  target: "body",
  stripUnknown: true,
});

export const validateUpdateProfile = validateRequest(updateProfileSchema, {
  target: "body",
  stripUnknown: true,
});