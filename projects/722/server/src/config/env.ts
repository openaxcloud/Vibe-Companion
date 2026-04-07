import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z
    .string()
    .default("4000")
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num) || num <= 0) {
        throw new Error("PORT must be a positive number");
      }
      return num;
    }),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),

  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),

  CORS_ORIGIN: z
    .string()
    .default("*"),

  REDIS_URL: z.string().optional(),

  ENABLE_METRICS: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  APP_URL: z.string().url().optional(),
});

type Env = z.infer<typeof EnvSchema>;

const parsedEnv = (() => {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.errors
      .map((err) => `undefined: undefined`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment configuration:\n" + formatted);
    process.exit(1);
  }

  return result.data;
})();

export const env: Env = parsedEnv;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";