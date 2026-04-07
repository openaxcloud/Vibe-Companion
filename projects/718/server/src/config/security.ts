import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet, { HelmetOptions } from 'helmet';
import { Request } from 'express';

export interface SecurityConfig {
  rateLimitWindowMs: number;
  rateLimitMax: number;
  rateLimitMessage: string;
  trustProxy: boolean;
}

export const createSecurityConfig = (): SecurityConfig => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  return {
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax:
      Number(process.env.RATE_LIMIT_MAX) ||
      (isProduction ? 100 : 500),
    rateLimitMessage:
      process.env.RATE_LIMIT_MESSAGE ||
      'Too many requests from this IP, please try again later.',
    trustProxy: process.env.TRUST_PROXY === 'true' || isProduction
  };
};

export const createRateLimiter = (config: SecurityConfig): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
      return forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
    },
    message: config.rateLimitMessage,
    skipFailedRequests: false,
    skipSuccessfulRequests: false
  });
};

export const createHelmetConfig = (): HelmetOptions => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  const helmetOptions: HelmetOptions = {
    contentSecurityPolicy: isProduction
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
          }
        }
      : false,
    crossOriginEmbedderPolicy: isProduction ? { policy: 'require-corp' } : false,
    crossOriginResourcePolicy: isProduction ? { policy: 'same-origin' } : { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    hidePoweredBy: true
  };

  return helmetOptions;
};

export const securityConfig: SecurityConfig = createSecurityConfig();
export const rateLimiter: RateLimitRequestHandler = createRateLimiter(securityConfig);
export const helmetMiddleware = helmet(createHelmetConfig());