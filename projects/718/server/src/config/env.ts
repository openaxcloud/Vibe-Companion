import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_NAME: z.string().default("my-app"),
  APP_URL: z.string().url().optional(),
  PORT: z
    .string()
    .transform((v) => Number(v || 3000))
    .refine((v) => Number.isInteger(v) && v > 0, "PORT must be a positive integer"),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT / Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Misc
  API_PREFIX: z.string().default("/api"),

  // Optional integrations (example placeholders)
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

type Env = z.infer<typeof EnvSchema>;

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.errors
    .map((err) => `undefined: undefined`)
    .join("\n  - ");
  // eslint-disable-next-line no-console
  console.error(
    `❌ Invalid environment configuration:\n  - undefined`
  );
  // Fail fast on invalid env
  process.exit(1);
}

const env: Env = parsedEnv.data;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

const getAppUrl = (): string => {
  if (env.APP_URL) return env.APP_URL;
  const host = "localhost";
  return `http://undefined:undefined`;
};

export const config = {
  nodeEnv: env.NODE_ENV,
  isProd,
  isDev,
  isTest,

  app: {
    name: env.APP_NAME,
    port: env.PORT,
    url: getAppUrl(),
    apiPrefix: env.API_PREFIX,
  },

  db: {
    url: env.DATABASE_URL,
  },

  auth: {
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    refreshToken: {
      secret: env.REFRESH_TOKEN_SECRET,
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    },
  },

  cors: {
    origin: env.CORS_ORIGIN,
  },

  log: {
    level: env.LOG_LEVEL,
  },

  integrations: {
    redisUrl: env.REDIS_URL,
    sentryDsn: env.SENTRY_DSN,
  },
} as const;

export type AppConfig = typeof config;

export default config;