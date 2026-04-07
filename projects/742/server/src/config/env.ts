import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
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
    .default("3000"),
  DB_URL: z.string().min(1, "DB_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),

  STRIPE_PUBLIC_KEY: z.string().min(1, "STRIPE_PUBLIC_KEY is required"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),

  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num) || num <= 0) {
        throw new Error("SMTP_PORT must be a positive number");
      }
      return num;
    }),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required"),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),

  APP_URL: z.string().url().optional(),
});

type EnvVars = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.errors
    .map((err) => `• undefined: undefined`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error("Invalid or missing environment variables:\n" + formatted);
  process.exit(1);
}

const env = parsed.data as EnvVars;

export interface AppConfig {
  nodeEnv: EnvVars["NODE_ENV"];
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  port: number;
  db: {
    url: string;
  };
  jwt: {
    secret: string;
  };
  stripe: {
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };
  appUrl?: string;
}

const config: AppConfig = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",
  port: typeof env.PORT === "number" ? env.PORT : Number(env.PORT),
  db: {
    url: env.DB_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
  },
  stripe: {
    publicKey: env.STRIPE_PUBLIC_KEY,
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  smtp: {
    host: env.SMTP_HOST,
    port: typeof env.SMTP_PORT === "number" ? env.SMTP_PORT : Number(env.SMTP_PORT),
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    secure: env.SMTP_SECURE ?? true,
  },
  appUrl: env.APP_URL,
};

export { config, env };