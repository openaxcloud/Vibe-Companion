/**
 * Rate Limiting Middleware
 * Fortune 500-grade tier-based rate limiting with Redis support
 * 
 * Tier Limits:
 * - Free: 100 requests/minute
 * - Core: 1000 requests/minute
 * - Teams: 5000 requests/minute
 * - Enterprise: 10000 requests/minute
 * 
 * Date: November 30, 2025
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { users, type User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { isViteDevPath } from '../utils/security';

const logger = createLogger('rate-limiter');

// ✅ SENIOR ENGINEER FIX: Dynamic environment check per-request
// Previously: const isTestEnv = process.env.NODE_ENV === 'test' (set once at boot)
// Now: Function checks environment on every call, allowing tests to bypass rate limiting
const isTestEnv = () => process.env.NODE_ENV === 'test';

// ============================================
// TIER-BASED RATE LIMITS (Fortune 500-grade)
// ============================================
export const TIER_LIMITS = {
  free: {
    api: { points: 100, duration: 60 },       // 100 requests/minute
    ai: { points: 10, duration: 60 },         // 10 AI requests/minute
    auth: { points: 5, duration: 900 },       // 5 auth attempts/15min
    deploy: { points: 2, duration: 3600 },    // 2 deployments/hour
  },
  core: {
    api: { points: 1000, duration: 60 },      // 1000 requests/minute
    ai: { points: 100, duration: 60 },        // 100 AI requests/minute
    auth: { points: 20, duration: 900 },      // 20 auth attempts/15min
    deploy: { points: 10, duration: 3600 },   // 10 deployments/hour
  },
  teams: {
    api: { points: 5000, duration: 60 },      // 5000 requests/minute
    ai: { points: 500, duration: 60 },        // 500 AI requests/minute
    auth: { points: 50, duration: 900 },      // 50 auth attempts/15min
    deploy: { points: 30, duration: 3600 },   // 30 deployments/hour
  },
  enterprise: {
    api: { points: 10000, duration: 60 },     // 10000 requests/minute
    ai: { points: 1000, duration: 60 },       // 1000 AI requests/minute
    auth: { points: 100, duration: 900 },     // 100 auth attempts/15min
    deploy: { points: 100, duration: 3600 },  // 100 deployments/hour
  }
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;
export type LimitType = keyof typeof TIER_LIMITS['free'];

// Initialize Redis client if available
let redisClient: Redis | null = null;

// Try to initialize Redis for distributed rate limiting
const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl.replace('rediss://', 'redis://'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    
    redisClient.on('error', (err) => {
      logger.warn('Redis rate limiter connection error:', { error: err.message });
      redisClient = null;
    });
    
    redisClient.connect().catch((err) => {
      logger.warn('Redis rate limiter connection failed, using in-memory fallback', { error: err?.message || 'Unknown error' });
      redisClient = null;
    });
  } catch (error) {
    logger.warn('Redis rate limiter initialization failed, using memory');
    redisClient = null;
  }
}

// ✅ PRODUCTION FIX (Dec 21, 2025): LRU cache to prevent memory exhaustion
// With millions of users, an unbounded Map could consume all memory
// LRU cache evicts least-recently-used entries when max size is reached
const TIER_CACHE_TTL_MS = 60000; // 1 minute cache
const TIER_CACHE_MAX_SIZE = 10000; // Max 10,000 entries (prevents memory exhaustion)

const userTierCache = new LRUCache<number, SubscriptionTier>({
  max: TIER_CACHE_MAX_SIZE,
  ttl: TIER_CACHE_TTL_MS,
  updateAgeOnGet: true, // Reset TTL on access (frequently accessed users stay cached)
});

/**
 * Get user's subscription tier (with LRU caching)
 */
async function getUserTier(userId: number): Promise<SubscriptionTier> {
  // Check cache first (LRU handles TTL automatically)
  const cached = userTierCache.get(userId);
  if (cached) {
    return cached;
  }
  
  try {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const tier = (user?.subscriptionTier as SubscriptionTier) || 'free';
    
    // Cache the result (LRU handles eviction automatically)
    userTierCache.set(userId, tier);
    
    return tier;
  } catch (error) {
    logger.error('Failed to get user tier:', { error, userId });
    return 'free'; // Default to free on error
  }
}

// Enhanced rate limiters with Redis or memory fallback
// In test environment, use much higher thresholds to prevent false failures
export const rateLimiters = {
  // Strict rate limiter for auth endpoints
  // Test: 5000 requests/min | Prod: 5 requests/15min
  auth: redisClient ? new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_auth',
    points: isTestEnv() ? 5000 : 5,
    duration: isTestEnv() ? 60 : 900,
    blockDuration: isTestEnv() ? 1 : 900,
    execEvenly: false,
  }) : new RateLimiterMemory({
    keyPrefix: 'rl_auth',
    points: isTestEnv() ? 5000 : 5,
    duration: isTestEnv() ? 60 : 900,
    blockDuration: isTestEnv() ? 1 : 900,
  }),
  
  // Standard API rate limiter
  // Test: 5000 requests/min | Prod: 100 requests/min
  api: redisClient ? new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_api',
    points: isTestEnv() ? 5000 : 100,
    duration: 60,
    blockDuration: isTestEnv() ? 1 : 60,
    execEvenly: false,
  }) : new RateLimiterMemory({
    keyPrefix: 'rl_api',
    points: isTestEnv() ? 5000 : 100,
    duration: 60,
    blockDuration: isTestEnv() ? 1 : 60,
  }),
  
  // AI endpoint rate limiter
  // Development: 1000 requests/min | Production: 10 requests/min
  ai: redisClient ? new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_ai',
    points: process.env.NODE_ENV === 'development' ? 1000 : 10, // ✅ 1000 in dev
    duration: 60, // per minute
    blockDuration: process.env.NODE_ENV === 'development' ? 1 : 300, // ✅ 1 sec in dev, 5 min in prod
    execEvenly: false, // ✅ Don't spread in dev
  }) : new RateLimiterMemory({
    keyPrefix: 'rl_ai',
    points: process.env.NODE_ENV === 'development' ? 1000 : 10,
    duration: 60,
    blockDuration: process.env.NODE_ENV === 'development' ? 1 : 300,
    execEvenly: false,
  }),
  
  // Deployment rate limiter
  deployment: redisClient ? new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_deploy',
    points: 5, // 5 deployments
    duration: 3600, // per hour
    blockDuration: 3600,
    execEvenly: false,
  }) : new RateLimiterMemory({
    keyPrefix: 'rl_deploy',
    points: 5,
    duration: 3600,
    blockDuration: 3600,
  }),
};

/**
 * Create rate limit middleware for specific endpoint type
 */
export function createRateLimitMiddleware(type: keyof typeof rateLimiters) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag first
    if ((req as any)._skipRateLimit === true) {
      return next();
    }
    
    // Bypass rate limiting entirely in test mode (unless explicitly enabled)
    if (isTestEnv() && process.env.ENABLE_RATE_LIMITING !== 'true') {
      return next();
    }
    
    const path = req.path || '';
    
    // ✅ CRITICAL FIX (Dec 19, 2025): Skip ALL non-API routes in development mode
    if (process.env.NODE_ENV === 'development' && !path.startsWith('/api')) {
      return next();
    }
    
    try {
      const key = (req.user as any)?.id || req.ip || 'unknown';
      await rateLimiters[type].consume(key);
      
      // Set rate limit headers
      const rateLimiterRes = await rateLimiters[type].get(key);
      if (rateLimiterRes) {
        res.setHeader('X-RateLimit-Limit', rateLimiters[type].points);
        res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints || 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      }
      
      next();
    } catch (rejRes: any) {
      if (!(rejRes instanceof RateLimiterRes) && (typeof rejRes?.msBeforeNext !== 'number')) {
        logger.warn('Rate limiter Redis error (fail-open)', {
          type,
          path: req.path,
          error: rejRes?.message || String(rejRes),
        });
        return next();
      }

      const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;
      
      logger.warn('Rate limit exceeded', {
        type,
        key: (req.user as any)?.id || req.ip,
        path: req.path,
        retryAfter
      });
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', rateLimiters[type].points);
      res.setHeader('X-RateLimit-Remaining', rejRes.remainingPoints || 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
      
      res.status(429).json({
        error: 'Too many requests',
        message: `Please wait ${retryAfter} seconds before making another request`,
        retryAfter,
      });
    }
  };
}

// ============================================
// TIER-BASED RATE LIMITING (Fortune 500-grade)
// Dynamic limits based on user subscription tier
// ============================================

// ✅ CRITICAL FIX (Dec 19, 2025): Harmonized DEV_MULTIPLIER with tier-rate-limiter.ts and ai-usage-tracker.ts
// Development: 1000x (comprehensive E2E testing), Test: 10000x (effectively unlimited), Prod: 1x
const DEV_MULTIPLIER = 
  process.env.NODE_ENV === 'test' ? 10000 :
  process.env.NODE_ENV === 'development' ? 1000 : 
  1;

// Cache of tier-specific rate limiters (created on demand)
const tierRateLimiters = new Map<string, RateLimiterMemory | RateLimiterRedis>();

/**
 * Get or create a rate limiter for specific tier and limit type
 * ✅ CRITICAL FIX (Dec 19, 2025): Apply DEV_MULTIPLIER to all tier-based rate limiters
 */
function getTierRateLimiter(tier: SubscriptionTier, limitType: LimitType): RateLimiterMemory | RateLimiterRedis {
  const key = `${tier}:${limitType}`;
  
  if (tierRateLimiters.has(key)) {
    return tierRateLimiters.get(key)!;
  }
  
  const limits = TIER_LIMITS[tier][limitType];
  // ✅ CRITICAL FIX: Apply dev multiplier to allow comprehensive testing
  const effectivePoints = limits.points * DEV_MULTIPLIER;
  
  const limiter = redisClient 
    ? new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `rl_tier_${key}`,
        points: effectivePoints,
        duration: limits.duration,
        blockDuration: Math.min(limits.duration, 60), // Block for max 1 minute
        execEvenly: false,
      })
    : new RateLimiterMemory({
        keyPrefix: `rl_tier_${key}`,
        points: effectivePoints,
        duration: limits.duration,
        blockDuration: Math.min(limits.duration, 60),
      });
  
  tierRateLimiters.set(key, limiter);
  return limiter;
}

/**
 * Fortune 500-grade tier-based rate limiting middleware
 * Automatically applies limits based on user's subscription tier
 * 
 * @param limitType - Type of rate limit to apply (api, ai, auth, deploy)
 */
export function createTierBasedRateLimiter(limitType: LimitType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag set by early middleware
    if ((req as any)._skipRateLimit === true) {
      return next();
    }
    
    // Bypass rate limiting in test/dev mode
    if (isTestEnv() && process.env.ENABLE_RATE_LIMITING !== 'true') {
      return next();
    }
    
    // Skip localhost in development
    if (process.env.NODE_ENV === 'development') {
      if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
        return next();
      }
    }
    
    // ✅ FIX (Dec 19, 2025): Skip Vite dev paths to prevent module loading failures
    const path = req.path || req.originalUrl || '';
    if (isViteDevPath(path)) {
      return next();
    }
    
    // ✅ CRITICAL FIX (Dec 19, 2025): Skip ALL non-API routes in development mode
    if (process.env.NODE_ENV === 'development' && !path.startsWith('/api')) {
      return next();
    }
    
    try {
      // Get user ID and tier
      const user = req.user as User | undefined;
      const userId = user?.id;
      const userKey = userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
      
      // Get tier (authenticated users get their tier, anonymous users get 'free')
      let tier: SubscriptionTier = 'free';
      if (userId) {
        tier = await getUserTier(userId);
      }
      
      // Get the appropriate rate limiter for this tier
      const limiter = getTierRateLimiter(tier, limitType);
      const limits = TIER_LIMITS[tier][limitType];
      // ✅ CRITICAL FIX: Use effective limit with dev multiplier
      const effectiveLimit = limits.points * DEV_MULTIPLIER;
      
      // Consume a point
      const result = await limiter.consume(userKey);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', effectiveLimit);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
      res.setHeader('X-RateLimit-Tier', tier);
      
      next();
    } catch (rejRes: any) {
      if (!(rejRes instanceof RateLimiterRes) && (typeof rejRes?.msBeforeNext !== 'number')) {
        logger.warn('Tier rate limiter Redis error (fail-open)', {
          limitType,
          path: req.path,
          error: rejRes?.message || String(rejRes),
        });
        return next();
      }

      // Rate limit exceeded
      const user = req.user as User | undefined;
      const tier = user?.id ? await getUserTier(user.id) : 'free';
      const limits = TIER_LIMITS[tier][limitType];
      // ✅ CRITICAL FIX: Use effective limit with dev multiplier
      const effectiveLimit = limits.points * DEV_MULTIPLIER;
      const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;
      
      logger.warn('Tier-based rate limit exceeded', {
        limitType,
        tier,
        userId: user?.id,
        ip: req.ip,
        path: req.path,
        retryAfter,
        limit: effectiveLimit,
        isDev: process.env.NODE_ENV === 'development'
      });
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', effectiveLimit);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
      res.setHeader('X-RateLimit-Tier', tier);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You've exceeded your ${tier} tier limit of ${effectiveLimit} requests per ${limits.duration} seconds. Please wait ${retryAfter} seconds or upgrade your plan.`,
        tier,
        limit: effectiveLimit,
        duration: limits.duration,
        retryAfter,
        upgradeUrl: tier !== 'enterprise' ? '/pricing' : undefined
      });
    }
  };
}

/**
 * Express middleware to apply tier-based rate limiting to all API routes
 */
export const tierBasedApiRateLimiter = createTierBasedRateLimiter('api');
export const tierBasedAiRateLimiter = createTierBasedRateLimiter('ai');
export const tierBasedAuthRateLimiter = createTierBasedRateLimiter('auth');
export const tierBasedDeployRateLimiter = createTierBasedRateLimiter('deploy');

// ✅ FIX (Dec 19, 2025): Helper function to check if request should skip rate limiting
const shouldSkipRateLimiting = (req: Request): boolean => {
  // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag first
  if ((req as any)._skipRateLimit === true) {
    return true;
  }
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  const path = req.path || req.originalUrl || '';
  return isLocalhost || isViteDevPath(path);
};

// Legacy express-rate-limit middleware (kept for backward compatibility)
// Configured to properly handle trusted proxies and extract real client IPs
// In test environment, use much higher limits to prevent test failures
export const legacyRateLimiters = {
  // Strict limit for auth endpoints
  // Test: 5000 requests/min | Prod: 10 requests/15min
  auth: rateLimit({
    windowMs: isTestEnv() ? 60 * 1000 : 15 * 60 * 1000,
    max: isTestEnv() ? 5000 : 10,
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: shouldSkipRateLimiting
  }),

  // Standard API rate limit
  // Test: 5000 requests/min | Dev: 5000 requests/min | Prod: 100 requests/min
  api: rateLimit({
    windowMs: 1 * 60 * 1000,
    max: (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? 5000 : 100,
    message: 'API rate limit exceeded, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: (req: Request) => {
      if (shouldSkipRateLimiting(req)) return true;
      return req.path === '/api/monitoring/health';
    }
  }),

  // Relaxed limit for static assets
  static: rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: shouldSkipRateLimiting
  }),

  // Very strict limit for expensive operations
  expensive: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 requests per hour
    message: 'This operation is resource intensive. Please wait before trying again.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: shouldSkipRateLimiting
  })
};

// Middleware for dynamic rate limiting based on user tier
export const dynamicRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag first
    if ((req as any)._skipRateLimit === true) {
      return next();
    }
    
    const path = req.path || '';
    
    // ✅ FIX (Dec 19, 2025): Skip Vite dev paths to prevent module loading failures
    if (isViteDevPath(path)) {
      return next();
    }
    
    // ✅ CRITICAL FIX (Dec 19, 2025): Skip ALL non-API routes in development mode
    if (process.env.NODE_ENV === 'development' && !path.startsWith('/api')) {
      return next();
    }

    if (path.startsWith('/api/ai') || path.startsWith('/api/deployments')) {
      return legacyRateLimiters.expensive(req, res, next);
    }

    return next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Continue without rate limiting if there's an error
    next();
  }
};

// Rate limit violation logging
export const logRateLimitViolations = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ✅ FIX (Dec 19, 2025): Use centralized isViteDevPath helper
  const path = req.path || req.originalUrl || '';
  if (isViteDevPath(path)) {
    return next();
  }
  
  const originalSend = res.send;
  
  res.send = function(body: any) {
    if (res.statusCode === 429) {
      console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
    }
    return originalSend.call(this, body);
  };
  
  next();
};