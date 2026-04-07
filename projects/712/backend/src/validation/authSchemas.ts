import { z } from "zod";

const emailSchema = z
  .string({ required_error: "Email is required", invalid_type_error: "Email must be a string" })
  .trim()
  .min(5, "Email must be at least 5 characters long")
  .max(254, "Email must be at most 254 characters long")
  .email("Invalid email format")
  .toLowerCase();

const passwordSchema = z
  .string({ required_error: "Password is required", invalid_type_error: "Password must be a string" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long")
  .regex(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

const nameSchema = z
  .string({ required_error: "Name is required", invalid_type_error: "Name must be a string" })
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(100, "Name must be at most 100 characters long");

const optionalStringSchema = z
  .string({ invalid_type_error: "Value must be a string" })
  .trim()
  .max(255, "Value must be at most 255 characters long")
  .optional()
  .nullable();

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be a string" })
    .min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string({ required_error: "Confirm password is required", invalid_type_error: "Confirm password must be a string" })
      .min(1, "Confirm password is required"),
    termsAccepted: z
      .boolean({ required_error: "Terms acceptance is required", invalid_type_error: "Terms acceptance must be a boolean" })
      .refine((val) => val === true, {
        message: "You must accept the terms and conditions",
      }),
    metadata: z
      .object({
        referralCode: optionalStringSchema,
        locale: optionalStringSchema,
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z
  .object({
    token: z
      .string({ required_error: "Reset token is required", invalid_type_error: "Reset token must be a string" })
      .min(10, "Reset token is invalid"),
    password: passwordSchema,
    confirmPassword: z
      .string({ required_error: "Confirm password is required", invalid_type_error: "Confirm password must be a string" })
      .min(1, "Confirm password is required"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required", invalid_type_error: "Current password must be a string" })
      .min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z
      .string({
        required_error: "Confirm new password is required",
        invalid_type_error: "Confirm new password must be a string",
      })
      .min(1, "Confirm new password is required"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from current password",
      });
    }
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "New passwords do not match",
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: "Verification token is required", invalid_type_error: "Verification token must be a string" })
    .min(10, "Verification token is invalid"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: "Refresh token is required", invalid_type_error: "Refresh token must be a string" })
    .min(10, "Refresh token is invalid"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;