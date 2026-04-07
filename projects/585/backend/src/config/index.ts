import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: process.env.NODE_ENV === 'test'
    ? path.resolve(process.cwd(), '.env.test')
    : path.resolve(process.cwd(), '.env'),
});

type NodeEnv = 'development' | 'production' | 'test';

interface ServerConfig {
  env: NodeEnv;
  host: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  trustProxy: boolean;
}

interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  ssl: boolean;
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  bcryptSaltRounds: number;
}

interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
  prettyPrint: boolean;
}

interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

const parseNumber = (
  value: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) return options.min;
  if (options?.max !== undefined && parsed > options.max) return options.max;
  return parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: undefined`);
  }
  return value;
};

const parseCorsOrigins = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const env = ((): NodeEnv => {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'test' || nodeEnv === 'development') {
    return nodeEnv;
  }
  return 'development';
})();

const server: ServerConfig = {
  env,
  host: process.env.HOST || '0.0.0.0',
  port: parseNumber(process.env.PORT, 3000, { min: 1, max: 65535 }),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS, ['*']),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, env === 'production'),
};

const database: DatabaseConfig = {
  url:
    process.env.DATABASE_URL ||
    (() => {
      if (env === 'test') {
        return 'postgres://user:password@localhost:5432/app_test';
      }
      return 'postgres://user:password@localhost:5432/app';
    })(),
  poolMin: parseNumber(process.env.DB_POOL_MIN, 2, { min: 0 }),
  poolMax: parseNumber(process.env.DB_POOL_MAX, 10, { min: 1 }),
  ssl: parseBoolean(process.env.DB_SSL, env === 'production'),
};

const security: SecurityConfig = {
  jwtSecret: process.env.JWT_SECRET || (env === 'development' || env === 'test'
    ? 'insecure-dev-secret-change-me'
    : getRequiredEnv('JWT_SECRET')),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenSecret:
    process.env.REFRESH_TOKEN_SECRET ||
    (env === 'development' || env === 'test'
      ? 'insecure-refresh-secret-change-me'
      : getRequiredEnv('REFRESH_TOKEN_SECRET')),
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, env === 'test' ? 4 : 12, {
    min: 4,
    max: 15,
  }),
};

const logging: LoggingConfig = {
  level:
    (process.env.LOG_LEVEL as LoggingConfig['level']) ||
    (env === 'production' ? 'info' : 'debug'),
  prettyPrint: parseBoolean(process.env.LOG_PRETTY_PRINT, env !== 'production'),
};

export const config: AppConfig = {
  server,
  database,
  security,
  logging,
};

export type { AppConfig, ServerConfig, DatabaseConfig, SecurityConfig, LoggingConfig, NodeEnv };