import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: "APP_PORT must be a positive integer",
    })
    .default("3000" as unknown as number),

  APP_URL: z
    .string()
    .url("APP_URL must be a valid URL")
    .default("http://localhost:3000"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),

  JWT_EXPIRES_IN: z
    .string()
    .default("15m"),

  STRIPE_PUBLIC_KEY: z
    .string()
    .min(1, "STRIPE_PUBLIC_KEY is required"),

  STRIPE_SECRET_KEY: z
    .string()
    .min(1, "STRIPE_SECRET_KEY is required"),

  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, "STRIPE_WEBHOOK_SECRET is required"),

  SMTP_HOST: z
    .string()
    .min(1, "SMTP_HOST is required"),

  SMTP_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: "SMTP_PORT must be a positive integer",
    }),

  SMTP_USER: z
    .string()
    .min(1, "SMTP_USER is required"),

  SMTP_PASSWORD: z
    .string()
    .min(1, "SMTP_PASSWORD is required"),

  SMTP_FROM_EMAIL: z
    .string()
    .email("SMTP_FROM_EMAIL must be a valid email address"),
});

type RawEnv = NodeJS.ProcessEnv & z.infer<typeof envSchema>;

const rawEnv: RawEnv = process.env as RawEnv;

const parsedEnv = envSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `undefined: undefined`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\nundefined`);
}

const env = parsedEnv.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",

  app: {
    port: typeof env.APP_PORT === "number" ? env.APP_PORT : parseInt(String(env.APP_PORT), 10),
    url: env.APP_URL,
  },

  db: {
    url: env.DATABASE_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },

  stripe: {
    publicKey: env.STRIPE_PUBLIC_KEY,
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: typeof env.SMTP_PORT === "number" ? env.SMTP_PORT : parseInt(String(env.SMTP_PORT), 10),
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromEmail: env.SMTP_FROM_EMAIL,
  },
} as const;

export type AppConfig = typeof config;