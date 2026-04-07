import { z } from "zod";

const nodeEnvSchema = z
  .enum(["development", "test", "production"])
  .default("development");

const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0 && val < 65536, {
      message: "PORT must be a valid port number",
    })
    .default("3000" as unknown as number),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),

  // SMTP / Email
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0 && val < 65536, {
      message: "SMTP_PORT must be a valid port number",
    }),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : false)),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required"),
  SMTP_FROM_EMAIL: z.string().email("SMTP_FROM_EMAIL must be a valid email address"),

  // CORS
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return ["http://localhost:3000"];
      return val
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    }),

  // Optional app-specific
  APP_URL: z.string().url().optional(),
});

const productionOverrides = baseEnvSchema.extend({
  NODE_ENV: z.literal("production"),
});

const developmentOverrides = baseEnvSchema.extend({
  NODE_ENV: z.union([z.literal("development"), z.literal("test")]),
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT ?? "3000",

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ?? "587",
  SMTP_SECURE: process.env.SMTP_SECURE ?? "false",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,

  CORS_ORIGINS: process.env.CORS_ORIGINS,

  APP_URL: process.env.APP_URL,
};

const schema =
  rawEnv.NODE_ENV === "production" ? productionOverrides : developmentOverrides;

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  parsed.error.issues.forEach((issue) => {
    console.error(`  - undefined: undefined`);
  });
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

export type Env = z.infer<typeof schema>;

export const env: Env = parsed.data;