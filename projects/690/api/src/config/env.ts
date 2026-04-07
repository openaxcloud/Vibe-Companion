import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num) || num <= 0) {
        throw new Error("PORT must be a positive number");
      }
      return num;
    })
    .default("3000")
    .transform((val) => (typeof val === "number" ? val : Number(val))),

  // Application
  APP_NAME: z.string().default("my-app"),
  APP_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // JWT / Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters")
    .optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),

  // Misc
  ENABLE_DOCS: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

const parseEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.errors
      .map((err) => `undefined: undefined`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error("[ENV] Invalid environment configuration:\n", formatted);
    throw new Error("Invalid environment variables");
  }

  cachedEnv = result.data;
  return cachedEnv;
};

export const env = parseEnv();

export type { Env };