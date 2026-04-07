import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

interface AppConfig {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string | RegExp | (string | RegExp)[];
  LOG_LEVEL: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
  BCRYPT_SALT_ROUNDS: number;
  ENABLE_METRICS: boolean;
  ENABLE_REQUEST_LOGGING: boolean;
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined || value === null || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: undefined`);
  }
  return value;
};

const toNumber = (value: string, key: string): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable undefined must be a valid number, got: undefined`);
  }
  return parsed;
};

const toBoolean = (value: string): boolean => {
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
};

const parseCorsOrigin = (rawOrigin: string): string | RegExp | (string | RegExp)[] => {
  // Support:
  // - "*"
  // - single origin: "http://localhost:3000"
  // - comma-separated list: "http://localhost:3000,https://example.com"
  // - regex-like patterns: "/^https?:\/\/localhost(:\d+)?$/"
  const trimmed = rawOrigin.trim();

  if (trimmed === "*") {
    return "*";
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);

  const parsePart = (part: string): string | RegExp => {
    if (part.startsWith("/") && part.endsWith("/") && part.length > 2) {
      const body = part.slice(1, -1);
      return new RegExp(body);
    }
    return part;
  };

  if (parts.length === 1) {
    return parsePart(parts[0]);
  }

  return parts.map(parsePart);
};

const nodeEnvRaw = getEnv("NODE_ENV", "development").toLowerCase();
if (!["development", "test", "production"].includes(nodeEnvRaw)) {
  throw new Error(`Invalid NODE_ENV value: undefined. Expected development | test | production`);
}
const NODE_ENV = nodeEnvRaw as NodeEnv;

const config: AppConfig = {
  NODE_ENV,
  PORT: toNumber(getEnv("PORT", "4000"), "PORT"),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "1d"),
  CORS_ORIGIN: parseCorsOrigin(
    getEnv(
      "CORS_ORIGIN",
      NODE_ENV === "development" ? "http://localhost:3000" : "*"
    )
  ),
  LOG_LEVEL: (() => {
    const defaultLevel = NODE_ENV === "production" ? "info" : "debug";
    const level = getEnv("LOG_LEVEL", defaultLevel).toLowerCase();
    const allowed: AppConfig["LOG_LEVEL"][] = [
      "error",
      "warn",
      "info",
      "http",
      "verbose",
      "debug",
      "silly",
    ];
    if (!allowed.includes(level as AppConfig["LOG_LEVEL"])) {
      throw new Error(
        `Invalid LOG_LEVEL: undefined. Allowed values: undefined`
      );
    }
    return level as AppConfig["LOG_LEVEL"];
  })(),
  BCRYPT_SALT_ROUNDS: toNumber(getEnv("BCRYPT_SALT_ROUNDS", "10"), "BCRYPT_SALT_ROUNDS"),
  ENABLE_METRICS: toBoolean(getEnv("ENABLE_METRICS", NODE_ENV === "production" ? "true" : "false")),
  ENABLE_REQUEST_LOGGING: toBoolean(
    getEnv("ENABLE_REQUEST_LOGGING", NODE_ENV === "test" ? "false" : "true")
  ),
};

export const env = Object.freeze(config);