import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development")
    .transform((v) => v as "development" | "test" | "production"),

  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 3000)),

  APP_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, "STRIPE_WEBHOOK_SECRET is required"),

  // SMTP / Email
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z
    .string()
    .min(1, "SMTP_PORT is required")
    .transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required"),
  SMTP_FROM_NAME: z.string().min(1, "SMTP_FROM_NAME is required"),
  SMTP_FROM_EMAIL: z
    .string()
    .email("SMTP_FROM_EMAIL must be a valid email address"),

  // Optional extras
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .optional()
    .default("info"),

  REDIS_URL: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.errors
    .map((err) => `undefined: undefined`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:\n" + formattedErrors);
  throw new Error("Invalid environment configuration");
}

const env: Env = parsedEnv.data;

export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",
  isProd: env.NODE_ENV === "production",

  app: {
    port: env.PORT,
    url: env.APP_URL,
  },

  db: {
    url: env.DATABASE_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL,
  },

  log: {
    level: env.LOG_LEVEL,
  },

  redis: {
    url: env.REDIS_URL,
  },
} as const;

export type AppConfig = typeof config;