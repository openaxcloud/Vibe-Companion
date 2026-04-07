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
    .default("4000")
    .transform((val) => (typeof val === "number" ? val : Number(val))),

  DATABASE_URL: z.string().url().nonempty(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),

  STRIPE_PUBLIC_KEY: z.string().nonempty("STRIPE_PUBLIC_KEY is required"),
  STRIPE_SECRET_KEY: z.string().nonempty("STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().nonempty("STRIPE_WEBHOOK_SECRET is required"),

  SMTP_HOST: z.string().nonempty("SMTP_HOST is required"),
  SMTP_PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num) || num <= 0) {
        throw new Error("SMTP_PORT must be a positive number");
      }
      return num;
    }),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined))
    .optional()
    .or(z.boolean().optional())
    .default(false),
  SMTP_USER: z.string().nonempty("SMTP_USER is required"),
  SMTP_PASSWORD: z.string().nonempty("SMTP_PASSWORD is required"),
  SMTP_FROM_EMAIL: z.string().email("SMTP_FROM_EMAIL must be a valid email"),

  CLIENT_URL: z.string().url().nonempty("CLIENT_URL is required"),
});

type Env = z.infer<typeof envSchema>;

let cachedConfig: Env | null = null;

const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `undefined: undefined`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment configuration:\n" + formattedErrors);
    process.exit(1);
  }

  return result.data;
};

export const env: Env = (() => {
  if (cachedConfig) return cachedConfig;
  cachedConfig = parseEnv();
  return cachedConfig;
})();

export const {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  STRIPE_PUBLIC_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_FROM_EMAIL,
  CLIENT_URL,
} = env;