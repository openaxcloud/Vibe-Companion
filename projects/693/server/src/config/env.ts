import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_NAME: z.string().min(1).default("my-app"),
  APP_PORT: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("APP_PORT must be a positive integer");
      }
      return num;
    })
    .default("3000"),
  APP_HOST: z.string().min(1).default("0.0.0.0"),
  APP_URL: z.string().url().optional(),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Security
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num < 4) {
        throw new Error("BCRYPT_SALT_ROUNDS must be an integer >= 4");
      }
      return num;
    })
    .default("10"),

  // CORS
  CORS_ORIGIN: z.string().optional(),
  CORS_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("RATE_LIMIT_WINDOW_MS must be a positive integer");
      }
      return num;
    })
    .default("60000"),
  RATE_LIMIT_MAX: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("RATE_LIMIT_MAX must be a positive integer");
      }
      return num;
    })
    .default("100"),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("SMTP_PORT must be a positive integer");
      }
      return num;
    }),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),

  // Redis / Cache (optional)
  REDIS_URL: z.string().optional(),

  // Misc
  SENTRY_DSN: z.string().optional(),
  ENABLE_DOCS: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? true : val === "true")),
});

type EnvSchemaType = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const formattedErrors = parsed.error.issues
    .map((issue) => `undefined: undefined`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:\n" + formattedErrors);
  process.exit(1);
}

const env = parsed.data;

export type Env = EnvSchemaType;

export const config = {
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",
  isProd: env.NODE_ENV === "production",

  app: {
    name: env.APP_NAME,
    port: env.APP_PORT,
    host: env.APP_HOST,
    url:
      env.APP_URL ??
      (env.APP_PORT === 80 || env.APP_PORT === 443
        ? `http://localhost`
        : `http://localhost:undefined`),
  },

  log: {
    level: env.LOG_LEVEL,
  },

  db: {
    url: env.DATABASE_URL,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
  },

  cors: {
    enabled: env.CORS_ENABLED,
    origin: env.CORS_ORIGIN,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },

  email: {
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPassword: env.SMTP_PASSWORD,
    smtpSecure: env.SMTP_SECURE,
  },

  cache: {
    redisUrl: env.REDIS_URL,
  },

  monitoring: {
    sentryDsn: env.SENTRY_DSN,
  },

  features: {
    docsEnabled: env.ENABLE_DOCS,
  },
} as const;

export default config;