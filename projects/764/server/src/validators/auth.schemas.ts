import { z } from "zod";

export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  .max(254, "Email must be at most 254 characters")
  .email("Invalid email format");

export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  );

export const nameSchema = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

export const optionalNameSchema = nameSchema.optional();

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ required_error: "Password is required" })
      .min(1, "Password is required"),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string({ required_error: "Refresh token is required" })
      .min(1, "Refresh token is required"),
  })
  .strict();

export const userIdParamSchema = z
  .object({
    userId: z
      .string({ required_error: "User ID is required" })
      .uuid("Invalid user ID format"),
  })
  .strict();

export const authQuerySchema = z
  .object({
    redirect: z
      .string()
      .url("redirect must be a valid URL")
      .max(2048, "redirect URL is too long")
      .optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UserIdParamInput = z.infer<typeof userIdParamSchema>;
export type AuthQueryInput = z.infer<typeof authQuerySchema>;