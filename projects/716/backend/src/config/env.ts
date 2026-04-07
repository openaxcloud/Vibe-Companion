import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const boolFromEnv = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
};

const numberFromEnv = (
  value: string | undefined,
  defaultValue?: number
): number | undefined => {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return defaultValue;
  return parsed;
};

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_NAME: z.string().default("MyApp"),
  APP_URL: z.string().url().optional(),

  PORT: z
    .preprocess((v) => numberFromEnv(v as string | undefined, 4000), z.number())
    .describe("HTTP server port"),

  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),

  CORS_ORIGIN: z
    .string()
    .default("*")
    .describe("Comma-separated list of allowed origins or *"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .describe("Primary database connection string"),

  DB_LOGGING: z
    .preprocess((v) => boolFromEnv(v as string | undefined, false), z.boolean())
    .default(false),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .describe("Secret key for signing JWTs"),

  JWT_EXPIRES_IN: z
    .string()
    .default("15m")
    .describe("Access token expiry (e.g., 15m, 1h, 7d)"),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters")
    .describe("Secret key for signing refresh tokens"),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default("7d")
    .describe("Refresh token expiry"),

  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .preprocess((v) => numberFromEnv(v as string | undefined), z.number())
    .optional(),
  SMTP_SECURE: z
    .preprocess((v) => boolFromEnv(v as string | undefined, true), z.boolean())
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional(),

  REDIS_URL: z.string().optional(),

  // Optional feature flags
  FEATURE_REGISTRATION_ENABLED: z
    .preprocess((v) => boolFromEnv(v as string | undefined, true), z.boolean())
    .default(true),
  FEATURE_BILLING_ENABLED: z
    .preprocess((v) => boolFromEnv(v as string | undefined, false), z.boolean())
    .default(false),
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  APP_NAME: process.env.APP_NAME,
  APP_URL: process.env.APP_URL,
  PORT: process.env.PORT,
  LOG_LEVEL: process.env.LOG_LEVEL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,

  DATABASE_URL: process.env.DATABASE_URL,
  DB_LOGGING: process.env.DB_LOGGING,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,

  STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,

  REDIS_URL: process.env.REDIS_URL,

  FEATURE_REGISTRATION_ENABLED: process.env.FEATURE_REGISTRATION_ENABLED,
  FEATURE_BILLING_ENABLED: process.env.FEATURE_BILLING_ENABLED,
};

const parsed = EnvSchema.safeParse(rawEnv);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`- undefined: undefined`);
  }
  // Fail fast on invalid configuration
  process.exit(1);
}

export type EnvConfig = z.infer<typeof EnvSchema>;

const config: EnvConfig & {
  isDev: boolean;
  isTest: boolean;
  isProd: boolean;
  corsOrigins: string[];
} = {
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === "development",
  isTest: parsed.data.NODE_ENV === "test",
  isProd: parsed.data.NODE_ENV === "production",
  corsOrigins:
    parsed.data.CORS_ORIGIN === "*"
      ? ["*"]
      : parsed.data.CORS_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
};

export default config;