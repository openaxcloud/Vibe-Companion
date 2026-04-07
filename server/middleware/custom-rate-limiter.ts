/**
 * Custom Rate Limiting Middleware
 * Simple Map-based rate limiting for specific endpoints
 * 
 * Uses IP address for unauthenticated routes, user ID for authenticated routes
 * Returns 429 Too Many Requests with Retry-After header
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('custom-rate-limiter');

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterStore {
  entries: Map<string, RateLimitEntry>;
  lastCleanup: number;
}

const stores = new Map<string, RateLimiterStore>();

const CLEANUP_INTERVAL_MS = 60 * 1000;

function getStore(name: string): RateLimiterStore {
  if (!stores.has(name)) {
    stores.set(name, {
      entries: new Map(),
      lastCleanup: Date.now()
    });
  }
  return stores.get(name)!;
}

function cleanupOldEntries(store: RateLimiterStore): void {
  const now = Date.now();
  if (now - store.lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  
  for (const [key, entry] of store.entries) {
    if (now > entry.resetAt) {
      store.entries.delete(key);
    }
  }
  store.lastCleanup = now;
}

function getClientKey(req: Request, useUserId: boolean): string {
  if (useUserId && req.user) {
    const user = req.user as { id: number | string };
    return `user:${user.id}`;
  }
  
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.ip || req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

export interface RateLimitOptions {
  name: string;
  maxRequests: number;
  windowMs: number;
  useUserId?: boolean;
  message?: string;
}

export function createCustomRateLimiter(options: RateLimitOptions) {
  const {
    name,
    maxRequests,
    windowMs,
    useUserId = false,
    message = 'Too many requests, please try again later'
  } = options;

  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const devMultiplier = isTest ? 10000 : (isDev ? 100 : 1);
  const effectiveMax = maxRequests * devMultiplier;

  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any)._skipRateLimit === true) {
      return next();
    }
    
    if (isTest && process.env.ENABLE_RATE_LIMITING !== 'true') {
      return next();
    }

    const store = getStore(name);
    cleanupOldEntries(store);

    const key = getClientKey(req, useUserId);
    const now = Date.now();
    
    let entry = store.entries.get(key);
    
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      store.entries.set(key, entry);
    }

    entry.count++;
    
    const remaining = Math.max(0, effectiveMax - entry.count);
    const resetAtSeconds = Math.ceil(entry.resetAt / 1000);
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', effectiveMax);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetAtSeconds);

    if (entry.count > effectiveMax) {
      logger.warn('Custom rate limit exceeded', {
        limiter: name,
        key,
        count: entry.count,
        limit: effectiveMax,
        path: req.path
      });

      res.setHeader('Retry-After', retryAfterSeconds);
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: retryAfterSeconds,
        limit: effectiveMax,
        windowMs
      });
    }

    next();
  };
}

export const aiModelsRateLimiter = createCustomRateLimiter({
  name: 'ai-models-list',
  maxRequests: 100,
  windowMs: 60 * 1000,
  useUserId: false,
  message: 'Too many requests to AI models endpoint. Please wait before trying again.'
});

export const resourcesRateLimiter = createCustomRateLimiter({
  name: 'resources',
  maxRequests: 30,
  windowMs: 60 * 1000,
  useUserId: false,
  message: 'Too many requests to resources endpoint. Please wait before trying again.'
});

export const cacheFlushRateLimiter = createCustomRateLimiter({
  name: 'cache-flush',
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  useUserId: true,
  message: 'Cache flush limit exceeded. Maximum 5 flushes per hour.'
});

export const mobileOAuthRateLimiter = createCustomRateLimiter({
  name: 'mobile-oauth',
  maxRequests: 10,
  windowMs: 60 * 1000,
  useUserId: false,
  message: 'Too many OAuth requests. Please wait before trying again.'
});
