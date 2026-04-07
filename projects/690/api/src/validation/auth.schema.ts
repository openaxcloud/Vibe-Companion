import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, { message: "Email is required" })
  .email({ message: "Invalid email format" })
  .max(254, { message: "Email is too long" });

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long" })
  .max(128, { message: "Password is too long" });

export const nameSchema = z
  .string()
  .min(1, { message: "Name is required" })
  .max(100, { message: "Name is too long" });

export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
});

export type RegisterRequestBody = z.infer<typeof registerSchema>["body"];
export type LoginRequestBody = z.infer<typeof loginSchema>["body"];