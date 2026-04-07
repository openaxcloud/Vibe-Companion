import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

interface EnvConfig {
  NODE_ENV: NodeEnv;
  PORT: number;

  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  LOG_LEVEL: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined || value === null || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: undefined`);
  }
  return value;
};

const parseNumber = (value: string, key: string): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable undefined must be a valid number, received: "undefined"`);
  }
  return parsed;
};

const parseBoolean = (value: string, key: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new Error(`Environment variable undefined must be a boolean-like value, received: "undefined"`);
};

const parseNodeEnv = (value: string): NodeEnv => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }
  throw new Error(
    `NODE_ENV must be one of "development" | "test" | "production", received: "undefined"`
  );
};

const parseLogLevel = (value: string): EnvConfig["LOG_LEVEL"] => {
  const normalized = value.trim().toLowerCase();
  const allowed: EnvConfig["LOG_LEVEL"][] = [
    "error",
    "warn",
    "info",
    "http",
    "verbose",
    "debug",
    "silly",
  ];
  if (allowed.includes(normalized as EnvConfig["LOG_LEVEL"])) {
    return normalized as EnvConfig["LOG_LEVEL"];
  }
  throw new Error(
    `LOG_LEVEL must be one of undefined, received: "undefined"`
  );
};

const env: EnvConfig = {
  NODE_ENV: parseNodeEnv(getEnv("NODE_ENV", "development")),
  PORT: parseNumber(getEnv("PORT", "3000"), "PORT"),

  DB_HOST: getEnv("DB_HOST", "localhost"),
  DB_PORT: parseNumber(getEnv("DB_PORT", "5432"), "DB_PORT"),
  DB_USER: getEnv("DB_USER", "postgres"),
  DB_PASSWORD: getEnv("DB_PASSWORD", ""),
  DB_NAME: getEnv("DB_NAME", "app_db"),
  DB_SSL: parseBoolean(getEnv("DB_SSL", "false"), "DB_SSL"),

  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "1h"),

  LOG_LEVEL: parseLogLevel(getEnv("LOG_LEVEL", "info")),
};

export default env;
export type { EnvConfig, NodeEnv };