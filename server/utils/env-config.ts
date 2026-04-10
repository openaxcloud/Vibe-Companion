/**
 * Validated Environment Configuration
 * Zod-validated env vars with categorized required vs optional schemas.
 */

import { z } from 'zod';
import { createLogger } from './logger';

const logger = createLogger('env-config');

const booleanString = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
  .transform((val) => ['true', '1', 'yes', 'on'].includes(val.toLowerCase()))
  .optional();

const numberString = z
  .string()
  .transform((val) => parseInt(val, 10))
  .refine((val) => !isNaN(val), { message: 'Must be a valid number' })
  .optional();

const requiredEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connectivity'),
});

const optionalEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: numberString.default('5000'),
  
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: numberString.default('0.2'),
  
  REDIS_ENABLED: booleanString.default('false'),
  REDIS_URL: z.string().optional(),
  REDIS_DEFAULT_TTL: numberString.default('3600'),
  
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_AGGREGATION_ENABLED: booleanString.default('true'),
  LOG_PERFORMANCE: booleanString.default('false'),
  
  AI_PROVIDER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_ALERT_CHANNEL: z.string().optional(),
  
  GCS_BACKUP_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  
  STORAGE_BACKEND: z.enum(['replit', 's3', 'local']).optional(),
  STORAGE_PATH: z.string().optional(),
  REPLIT_OBJECT_STORAGE_BUCKET: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanString,
  
  CDN_ENABLED: booleanString.default('false'),
  CDN_BASE_URL: z.string().optional(),
  
  RATE_LIMIT_ENABLED: booleanString.default('true'),
  RATE_LIMIT_WINDOW_MS: numberString.default('60000'),
  RATE_LIMIT_MAX_REQUESTS: numberString.default('100'),
  
  REPL_ID: z.string().optional(),
  REPL_SLUG: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_DB_URL: z.string().optional(),
  
  DB_SLOW_QUERY_THRESHOLD_MS: numberString.default('750'),
  DB_OPTIMIZER_WINDOW_MINUTES: numberString.default('60'),
  
  GIT_COMMIT_SHA: z.string().optional(),
  
  RUNNER_URL: z.string().optional(),
  RUNNER_BASE_URL: z.string().optional(),
  RUNNER_JWT_SECRET: z.string().optional(),
  
  ALLOWED_ORIGINS: z.string().optional(),
  APP_URL: z.string().optional(),
  
  DEBUG: booleanString.default('false'),
});

const envSchema = requiredEnvSchema.merge(optionalEnvSchema);

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnvironment(): EnvConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isReplit = !!(process.env.REPL_ID || process.env.REPL_SLUG);

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });

    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;

    if (isProduction && !isReplit) {
      logger.error(errorMessage);
      throw new Error(errorMessage);
    } else {
      logger.warn(`[DEV] ${errorMessage}`);
      
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/ecode',
      });
    }
  }

  if (isProduction) {
    const securityWarnings: string[] = [];

    if (!process.env.JWT_SECRET) {
      securityWarnings.push('JWT_SECRET not set - using auto-generated secret');
    }
    if (!process.env.SESSION_SECRET) {
      securityWarnings.push('SESSION_SECRET not set - using auto-generated secret');
    }
    if (!process.env.SENTRY_DSN) {
      securityWarnings.push('SENTRY_DSN not set - error tracking disabled');
    }

    const storageBackend = process.env.STORAGE_BACKEND?.toLowerCase();
    const hasReplitStorage = !!(process.env.PRIVATE_OBJECT_DIR || process.env.REPLIT_OBJECT_STORAGE_BUCKET);
    const hasS3Storage = !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
    if (!isReplit && !storageBackend && !hasReplitStorage && !hasS3Storage) {
      throw new Error(
        'No object storage configured in production. Set STORAGE_BACKEND=replit (with REPLIT_OBJECT_STORAGE_BUCKET) ' +
        'or STORAGE_BACKEND=s3 (with S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). ' +
        'Local filesystem storage is not durable and not supported in production.'
      );
    }
    if (storageBackend === 's3' && (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)) {
      throw new Error(
        'STORAGE_BACKEND=s3 but required credentials are missing. ' +
        'Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables.'
      );
    }

    if (securityWarnings.length > 0 && !isReplit) {
      logger.warn(`Production security warnings:\n  - ${securityWarnings.join('\n  - ')}`);
    }
  }

  logger.info(`Environment validated successfully`, {
    environment: result.data.NODE_ENV,
    port: result.data.PORT,
    redisEnabled: result.data.REDIS_ENABLED,
    cdnEnabled: result.data.CDN_ENABLED,
    isReplit: isReplit,
  });

  return result.data;
}

export const envConfig = validateEnvironment();

export function getEnvConfig(): EnvConfig {
  return envConfig;
}

export function isProduction(): boolean {
  return envConfig.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return envConfig.NODE_ENV === 'development';
}

export function isTest(): boolean {
  return envConfig.NODE_ENV === 'test';
}

export function isReplitEnvironment(): boolean {
  return !!(envConfig.REPL_ID || envConfig.REPL_SLUG);
}

export function requireEnv(key: keyof EnvConfig): string {
  const value = envConfig[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return String(value);
}

export function getEnv<K extends keyof EnvConfig>(
  key: K,
  defaultValue?: EnvConfig[K]
): EnvConfig[K] {
  const value = envConfig[key];
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set and no default provided`);
  }
  return value;
}

export const ENV_CATEGORIES = {
  required: ['DATABASE_URL'] as const,
  
  security: [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
  ] as const,
  
  monitoring: [
    'SENTRY_DSN',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_TRACES_SAMPLE_RATE',
    'LOG_LEVEL',
    'LOG_AGGREGATION_ENABLED',
    'LOG_PERFORMANCE',
  ] as const,
  
  cache: [
    'REDIS_ENABLED',
    'REDIS_URL',
    'REDIS_DEFAULT_TTL',
  ] as const,
  
  ai: [
    'AI_PROVIDER',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_AI_API_KEY',
    'XAI_API_KEY',
  ] as const,
  
  payments: [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ] as const,
  
  email: [
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL',
  ] as const,
  
  notifications: [
    'SLACK_BOT_TOKEN',
    'SLACK_ALERT_CHANNEL',
  ] as const,
  
  storage: [
    'GCS_BACKUP_BUCKET',
    'GCS_PROJECT_ID',
    'STORAGE_BACKEND',
    'STORAGE_PATH',
    'REPLIT_OBJECT_STORAGE_BUCKET',
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_ENDPOINT',
    'S3_FORCE_PATH_STYLE',
  ] as const,
  
  performance: [
    'CDN_ENABLED',
    'CDN_BASE_URL',
    'DB_SLOW_QUERY_THRESHOLD_MS',
    'DB_OPTIMIZER_WINDOW_MINUTES',
  ] as const,
  
  rateLimit: [
    'RATE_LIMIT_ENABLED',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
  ] as const,
  
  runner: [
    'RUNNER_URL',
    'RUNNER_BASE_URL',
    'RUNNER_JWT_SECRET',
  ] as const,
  
  replit: [
    'REPL_ID',
    'REPL_SLUG',
    'REPLIT_DEV_DOMAIN',
    'REPLIT_DB_URL',
  ] as const,
} as const;

export function getConfiguredCategories(): string[] {
  const configured: string[] = [];
  
  for (const [category, keys] of Object.entries(ENV_CATEGORIES)) {
    const hasAny = keys.some((key) => {
      const value = process.env[key];
      return value !== undefined && value !== '';
    });
    if (hasAny) {
      configured.push(category);
    }
  }
  
  return configured;
}

export { envSchema, requiredEnvSchema, optionalEnvSchema };
