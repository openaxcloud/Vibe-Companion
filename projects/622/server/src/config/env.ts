import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      return Number.isNaN(num) ? 3000 : num;
    })
    .pipe(z.number().int().positive())
    .default("3000" as unknown as number),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(1, "JWT_SECRET is required in production")
    .or(z.string().default("dev-secret"))
    .transform((val, ctx) => {
      const env = process.env.NODE_ENV ?? "development";
      if (env === "production" && (!val || val === "dev-secret")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET must be set in production",
        });
        return z.NEVER;
      }
      return val;
    }),

  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  STRIPE_PUBLIC_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),

  EMAIL_HOST: z.string().default("localhost"),
  EMAIL_PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      return Number.isNaN(num) ? 1025 : num;
    })
    .pipe(z.number().int().positive())
    .default("1025" as unknown as number),
  EMAIL_USER: z.string().default("user"),
  EMAIL_PASSWORD: z.string().default("password"),
  EMAIL_FROM: z.string().email().default("no-reply@example.com"),

  APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

type Env = z.infer<typeof EnvSchema>;

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment configuration:");
  parsedEnv.error.errors.forEach((err) => {
    console.error(`- undefined: undefined`);
  });
  process.exit(1);
}

const env: Env = parsedEnv.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",

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
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    publicKey: env.STRIPE_PUBLIC_KEY,
    isEnabled:
      !!env.STRIPE_SECRET_KEY &&
      !!env.STRIPE_WEBHOOK_SECRET &&
      !!env.STRIPE_PUBLIC_KEY,
  },

  email: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM,
  },

  log: {
    level: env.LOG_LEVEL,
  },
} as const;

export type AppConfig = typeof config;