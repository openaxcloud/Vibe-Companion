import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  dbUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  stripeSecretKey: string;
  frontendUrl: string;
  email: EmailConfig;
}

const getEnv = (key: string, options?: { required?: boolean; defaultValue?: string }): string => {
  const value = process.env[key] ?? options?.defaultValue;
  if ((options?.required ?? true) && (!value || value.trim() === "")) {
    throw new Error(`Missing required environment variable: undefined`);
  }
  return value as string;
};

const parseNumber = (value: string, key: string): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable undefined must be a valid number, received: undefined`);
  }
  return parsed;
};

const nodeEnv = (getEnv("NODE_ENV", { required: false, defaultValue: "development" }) ||
  "development") as NodeEnv;

const port = parseNumber(getEnv("PORT", { required: false, defaultValue: "4000" }), "PORT");

const dbUrl = getEnv("DB_URL", { required: true });

const jwtSecret = getEnv("JWT_SECRET", { required: true });

const jwtExpiresIn = getEnv("JWT_EXPIRES_IN", {
  required: false,
  defaultValue: "7d",
});

const stripeSecretKey = getEnv("STRIPE_SECRET_KEY", { required: true });

const frontendUrl = getEnv("FRONTEND_URL", { required: true });

const emailHost = getEnv("EMAIL_HOST", { required: true });
const emailPortRaw = getEnv("EMAIL_PORT", { required: true });
const emailPort = parseNumber(emailPortRaw, "EMAIL_PORT");
const emailSecureRaw = getEnv("EMAIL_SECURE", { required: false, defaultValue: "false" });
const emailSecure = emailSecureRaw.toLowerCase() === "true";
const emailUser = getEnv("EMAIL_USER", { required: true });
const emailPass = getEnv("EMAIL_PASS", { required: true });
const emailFrom = getEnv("EMAIL_FROM", { required: true });

const emailConfig: EmailConfig = {
  host: emailHost,
  port: emailPort,
  secure: emailSecure,
  user: emailUser,
  pass: emailPass,
  from: emailFrom,
};

export const config: AppConfig = {
  nodeEnv,
  port,
  dbUrl,
  jwtSecret,
  jwtExpiresIn,
  stripeSecretKey,
  frontendUrl,
  email: emailConfig,
};

export default config;