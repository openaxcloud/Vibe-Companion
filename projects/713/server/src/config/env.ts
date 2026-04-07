import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

interface AppConfig {
  env: NodeEnv;
  isProd: boolean;
  isDev: boolean;
  isTest: boolean;
  port: number;
  frontendUrl: string;
}

interface DatabaseConfig {
  url: string;
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

interface CorsConfig {
  allowedOrigins: string[];
}

interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
}

class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

function getEnv(name: string, options?: { required?: boolean; defaultValue?: string }): string {
  const value = process.env[name];

  if (value == null || value === '') {
    if (options?.defaultValue !== undefined) {
      return options.defaultValue;
    }
    if (options?.required ?? true) {
      throw new EnvError(`Missing required environment variable: undefined`);
    }
    return '';
  }

  return value;
}

function getNumberEnv(name: string, options?: { required?: boolean; defaultValue?: number }): number {
  const raw = process.env[name];

  if (raw == null || raw === '') {
    if (options?.defaultValue !== undefined) {
      return options.defaultValue;
    }
    if (options?.required ?? true) {
      throw new EnvError(`Missing required numeric environment variable: undefined`);
    }
    return NaN;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new EnvError(`Environment variable undefined must be a valid number. Received: "undefined"`);
  }

  return value;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  const env = (value ?? 'development').toLowerCase();

  if (env === 'development' || env === 'test' || env === 'production') {
    return env;
  }

  throw new EnvError(`NODE_ENV must be one of "development", "test", or "production". Received: "undefined"`);
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const nodeEnv: NodeEnv = parseNodeEnv(process.env.NODE_ENV);

const config: Config = {
  app: {
    env: nodeEnv,
    isProd: nodeEnv === 'production',
    isDev: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port: getNumberEnv('PORT', { defaultValue: 4000 }),
    frontendUrl: getEnv('FRONTEND_URL', { required: true })
  },
  database: {
    url: getEnv('DATABASE_URL', { required: true })
  },
  jwt: {
    secret: getEnv('JWT_SECRET', { required: true }),
    expiresIn: getEnv('JWT_EXPIRES_IN', { defaultValue: '15m' }),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', { required: true }),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', { defaultValue: '7d' })
  },
  cors: {
    allowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL)
  }
};

export { config, Config, AppConfig, DatabaseConfig, JwtConfig, CorsConfig, EnvError };