import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z
    .string()
    .transform((val) => {
      const port = Number(val);
      if (Number.isNaN(port) || port <= 0 || !Number.isInteger(port)) {
        throw new Error("PORT must be a positive integer");
      }
      return port;
    })
    .default("4000")
    .transform((val) => (typeof val === "number" ? val : Number(val))),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z
    .string()
    .min(1, "CORS_ORIGIN is required")
    .default("*"),
  CLIENT_URL: z
    .string()
    .url("CLIENT_URL must be a valid URL"),
  UPLOAD_DIR: z
    .string()
    .min(1, "UPLOAD_DIR is required")
    .default("uploads"),
  WEB_PUSH_PUBLIC_KEY: z
    .string()
    .min(1, "WEB_PUSH_PUBLIC_KEY is required"),
  WEB_PUSH_PRIVATE_KEY: z
    .string()
    .min(1, "WEB_PUSH_PRIVATE_KEY is required"),
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT ?? "4000",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  CLIENT_URL: process.env.CLIENT_URL,
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",
  WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY,
  WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
};

const parsed = EnvSchema.safeParse(rawEnv);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:");
  // eslint-disable-next-line no-console
  console.error(parsed.error.format());
  // Fail fast in case of invalid configuration
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;