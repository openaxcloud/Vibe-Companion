import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Invalid email address" })
  .max(254, { message: "Email is too long" });

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long" })
  .max(128, { message: "Password must be at most 128 characters long" })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

export const usernameSchema = z
  .string()
  .trim()
  .min(3, { message: "Username must be at least 3 characters long" })
  .max(32, { message: "Username must be at most 32 characters long" })
  .regex(/^[a-zA-Z0-9_]+$/, {
    message: "Username may only contain letters, numbers, and underscores",
  });

export const authRegisterRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});

export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>;

export const authLoginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: "Password is required" }),
});

export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: emailSchema,
  username: usernameSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authRegisterResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema.optional(),
});

export type AuthRegisterResponse = z.infer<typeof authRegisterResponseSchema>;

export const authLoginResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});

export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;

export const authMeResponseSchema = z.object({
  user: authUserSchema,
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const validateRegisterRequest = (data: unknown) => {
  return authRegisterRequestSchema.parse(data);
};

export const validateLoginRequest = (data: unknown) => {
  return authLoginRequestSchema.parse(data);
};

export const validateMeResponse = (data: unknown) => {
  return authMeResponseSchema.parse(data);
};

export const validateRegisterResponse = (data: unknown) => {
  return authRegisterResponseSchema.parse(data);
};

export const validateLoginResponse = (data: unknown) => {
  return authLoginResponseSchema.parse(data);
};