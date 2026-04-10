/**
 * Tier-Based Rate Limiting Middleware (Fortune 500)
 * Implements intelligent rate limiting based on user subscription tier
 * 
 * API & AUTH LIMITS (Hard blocking):
 * - Free: 100 req/min (API), 5 req/15min (AUTH)
 * - Pro: 1000 req/min (API), 20 req/15min (AUTH)
 * - Enterprise: 10000 req/min (API), 100 req/15min (AUTH)
 * 
 * AI USAGE: Pay-as-you-go model (NO BLOCKING)
 * - See ai-usage-tracker.ts for AI metering
 * 
 * REDIS SUPPORT (Production):
 * - Uses RateLimiterRedis when Redis is available for distributed rate limiting
 * - Falls back to RateLimiterMemory in development or when Redis is unavailable
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { db } from '../db';
import { rateLimitViolations } from '@shared/schema';
import { createLogger } from '../utils/logger';
import { isViteDevPath } from '../utils/security';

const logger = createLogger('tier-rate-limiter');

// Initialize Redis client for distributed rate limiting in production
let redisClient: Redis | null = null;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl.replace('rediss://', 'redis://'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis connected for tier rate limiting');
    });
    
    redisClient.on('error', (err) => {
      logger.warn('Redis tier rate limiter connection error - using memory fallback', { error: err.message });
      redisClient = null;
    });
    
    redisClient.connect().catch((err) => {
      logger.warn('Redis tier rate limiter connection failed - using memory fallback', { error: err?.message || 'Unknown error' });
      redisClient = null;
    });
  } catch (error: any) {
    logger.warn('Redis tier rate limiter initialization failed - using memory fallback', { error: error?.message });
    redisClient = null;
  }
} else {
  logger.info('No Redis URL configured - tier rate limiter using memory storage');
}

type SubscriptionTier = 'free' | 'core' | 'teams' | 'enterprise';
type LimitType = 'api' | 'auth'; // Streaming handled separately

interface TierLimits {
  points: number;
  duration: number;
}

// Fortune 500 Rate Limits per Tier (API & AUTH only - AI is pay-as-you-go)
const TIER_LIMITS: Record<SubscriptionTier, Record<LimitType, TierLimits>> = {
  free: {
    api: { points: 500, duration: 60 },      // 500 req/min (production-friendly)
    auth: { points: 10, duration: 900 },     // 10 req/15min
  },
  core: {
    api: { points: 1000, duration: 60 },     // 1000 req/min (10x)
    auth: { points: 20, duration: 900 },     // 20 req/15min (4x)
  },
  teams: {
    api: { points: 5000, duration: 60 },     // 5000 req/min (50x)
    auth: { points: 50, duration: 900 },     // 50 req/15min (10x)
  },
  enterprise: {
    api: { points: 10000, duration: 60 },    // 10000 req/min (100x)
    auth: { points: 100, duration: 900 },    // 100 req/15min (20x)
  },
};

// ✅ FORTUNE 500 FIX: Separate streaming limits (different structure than API/auth)
const STREAMING_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { points: 50, duration: 900 },        // 50 streams per 15min (production-friendly)
  core: { points: 100, duration: 3600 },      // 100 streams per hour
  teams: { points: 500, duration: 3600 },     // 500 streams per hour
  enterprise: { points: 1000, duration: 3600 }, // 1000 streams per hour
};

// Development mode: 1000x multiplier for all tiers (allows comprehensive E2E testing)
// Test mode: 10000x multiplier (effectively unlimited for test suites)
const DEV_MULTIPLIER = 
  process.env.NODE_ENV === 'test' ? 10000 :
  process.env.NODE_ENV === 'development' ? 1000 : 
  1;

// Rate limiters per tier/type (Redis or Memory)
const rateLimiters = new Map<string, RateLimiterRedis | RateLimiterMemory>();

/**
 * Creates a rate limiter with Redis support (production) or Memory fallback (development)
 * @param points - Number of requests allowed
 * @param duration - Time window in seconds
 * @param keyPrefix - Prefix for rate limiter keys
 * @returns RateLimiterRedis if Redis is available, otherwise RateLimiterMemory
 */
function createRateLimiter(points: number, duration: number, keyPrefix: string): RateLimiterRedis | RateLimiterMemory {
  const blockDuration = process.env.NODE_ENV === 'development' ? 1 : duration;
  
  // Use Redis in production when available for distributed rate limiting
  if (redisClient && redisClient.status === 'ready') {
    logger.debug(`Creating Redis rate limiter: ${keyPrefix}`);
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix,
      points: points * DEV_MULTIPLIER,
      duration,
      blockDuration,
      execEvenly: false,
    });
  }
  
  // Fallback to memory (development or Redis unavailable)
  logger.debug(`Creating Memory rate limiter: ${keyPrefix}`);
  return new RateLimiterMemory({
    keyPrefix,
    points: points * DEV_MULTIPLIER,
    duration,
    blockDuration,
  });
}

function getRateLimiter(tier: SubscriptionTier, limitType: LimitType): RateLimiterRedis | RateLimiterMemory {
  const key = `${tier}_${limitType}`;
  
  if (!rateLimiters.has(key)) {
    const limits = TIER_LIMITS[tier][limitType];
    const limiter = createRateLimiter(limits.points, limits.duration, `rl_tier_${key}`);
    rateLimiters.set(key, limiter);
  }
  
  return rateLimiters.get(key)!;
}

async function logViolation(req: Request, tier: SubscriptionTier, limitType: LimitType | 'streaming', attempted: number, allowed: number) {
  try {
    await db.insert(rateLimitViolations).values({
      userId: (req.user as any)?.id || null,
      ip: req.ip || 'unknown',
      endpoint: req.path,
      method: req.method,
      userTier: tier,
      limitType,
      attemptedRequests: attempted,
      allowedLimit: allowed,
      userAgent: req.get('user-agent') || null,
      metadata: {
        query: req.query,
        tier,
        env: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    logger.error('Failed to log rate limit violation', { error });
  }
}

export function createTierRateLimitMiddleware(limitType: LimitType | 'streaming') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.originalUrl || '';
    
    // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag set by early middleware
    if ((req as any)._skipRateLimit === true) {
      return next();
    }
    
    // ✅ CRITICAL FIX (Dec 19, 2025): Double-check for Vite dev paths
    // Even if _skipRateLimit wasn't set, skip rate limiting for dev assets
    if (process.env.NODE_ENV === 'development' && !path.startsWith('/api')) {
      return next();
    }
    
    // Skip rate limiting in test mode (unless explicitly enabled)
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITING !== 'true') {
      return next();
    }

    // Skip localhost in development
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')) {
      return next();
    }
    
    // ✅ PRODUCTION FIX (Dec 10, 2025): Skip rate limiting for static assets
    // ✅ FIX (Dec 19, 2025): Use centralized isViteDevPath helper to prevent module loading failures
    if (isViteDevPath(path)) {
      return next();
    }
    
    // ✅ PRODUCTION FIX (Jan 30, 2026): Skip rate limiting for public API endpoints
    // These endpoints are accessed by the landing page and should allow higher traffic
    const publicApiPaths = [
      '/api/health',
      '/health',
      '/api/docs',
      '/api/marketplace/templates',
      '/api/ai/models',
      '/api/me', // User check on every page load
    ];
    
    if (publicApiPaths.some(p => path === p || path.startsWith(p + '/'))) {
      return next();
    }
    
    // Skip rate limiting for static assets served by Express (not Vite)
    if (path.startsWith('/assets/') || 
        path.endsWith('.js') || 
        path.endsWith('.css') || 
        path.endsWith('.ico') ||
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.svg') ||
        path.endsWith('.woff2')) {
      return next();
    }

    try {
      // Determine user tier (default to 'free' if not authenticated or no tier)
      const user = req.user as any;
      const tier: SubscriptionTier = user?.subscriptionTier || 'free';
      
      // ✅ FORTUNE 500 FIX: Handle streaming separately (different limit structure)
      if (limitType === 'streaming') {
        const limits = STREAMING_LIMITS[tier];
        const key = `${tier}_streaming`;
        
        let limiter = rateLimiters.get(key);
        if (!limiter) {
          // Use createRateLimiter for Redis/Memory fallback pattern
          limiter = createRateLimiter(limits.points, limits.duration, `rl_tier_${key}`);
          rateLimiters.set(key, limiter);
        }
        
        const userId = user?.id || req.ip || 'anonymous';
        try {
          await limiter.consume(userId, 1);
          return next();
        } catch (error: any) {
          if (typeof error?.msBeforeNext !== 'number') {
            logger.warn('Streaming rate limiter Redis error (fail-open)', {
              tier, limitType, error: error?.message || String(error),
            });
            return next();
          }
          logger.warn('Streaming rate limit exceeded', { userId, tier, limitType });
          await logViolation(req, tier, 'streaming', error.consumedPoints || 1, limits.points);
          return res.status(429).json({
            error: 'Too many streaming requests',
            message: `${tier === 'free' ? 'Free' : tier === 'core' ? 'Core' : tier === 'teams' ? 'Teams' : 'Enterprise'} tier: Maximum ${limits.points} concurrent AI streams per ${limits.duration / 60} minutes. ${tier === 'free' ? 'Upgrade to Core for higher limits.' : ''}`,
            retryAfter: Math.ceil(error.msBeforeNext / 1000),
            tier,
            limit: limits.points,
            window: `${limits.duration / 60} minutes`
          });
        }
      }
      
      // ✅ CRITICAL FIX: Only handle API/auth after this point (streaming already returned)
      if (limitType !== 'api' && limitType !== 'auth') {
        // Should not reach here - streaming handled above
        logger.error('Invalid limitType', { limitType });
        return next();
      }
      
      // Get appropriate rate limiter for this tier/type
      const limiter = getRateLimiter(tier, limitType);
      const key = user?.id || req.ip || 'anonymous';
      
      // Consume a point
      await limiter.consume(key);
      
      // Set rate limit headers
      const rateLimiterRes = await limiter.get(key);
      if (rateLimiterRes) {
        // ✅ TYPE SAFETY: limitType is guaranteed to be 'api' or 'auth' here (streaming returned early)
        const limits = TIER_LIMITS[tier]?.[limitType as LimitType] || TIER_LIMITS.free.api;
        res.setHeader('X-RateLimit-Limit', limits.points * DEV_MULTIPLIER);
        res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints || 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
        res.setHeader('X-RateLimit-Tier', tier);
      }
      
      next();
    } catch (rejRes: any) {
      if (typeof rejRes?.msBeforeNext !== 'number') {
        logger.warn('Tier rate limiter Redis error (fail-open)', {
          limitType,
          path: req.path,
          error: rejRes?.message || String(rejRes),
        });
        return next();
      }

      const user = req.user as any;
      const rawTier = user?.subscriptionTier || 'free';
      // ✅ SAFETY: Validate tier exists in TIER_LIMITS, fallback to 'free'
      const tier: SubscriptionTier = (rawTier in TIER_LIMITS) ? rawTier : 'free';
      // ✅ TYPE SAFETY: limitType is guaranteed to be 'api' or 'auth' here (streaming returned early)
      const limits = TIER_LIMITS[tier]?.[limitType as LimitType] || TIER_LIMITS.free.api;
      const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;
      
      logger.warn('Rate limit exceeded', {
        tier,
        limitType,
        userId: user?.id,
        ip: req.ip,
        path: req.path,
        retryAfter
      });
      
      // Log violation to database (async, don't block response)
      logViolation(req, tier, limitType, rejRes.consumedPoints || 0, limits.points).catch((err) => {
        logger.warn('[RateLimiter] Failed to log violation:', err.message);
      });
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', limits.points * DEV_MULTIPLIER);
      res.setHeader('X-RateLimit-Remaining', 0);
      // ✅ SAFETY: Handle undefined msBeforeNext gracefully
      const resetTime = rejRes?.msBeforeNext ? Date.now() + rejRes.msBeforeNext : Date.now() + 60000;
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
      res.setHeader('X-RateLimit-Tier', tier);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Your ${tier} tier allows ${limits.points} requests per ${limits.duration}s for ${limitType} endpoints. Please wait ${retryAfter} seconds or upgrade your plan.`,
        tier,
        limit: limits.points,
        retryAfter,
        upgradeTo: tier === 'free' ? 'core' : tier === 'core' ? 'teams' : tier === 'teams' ? 'enterprise' : null,
      });
    }
  };
}

// Export specific middleware for different endpoint types
// Note: AI endpoints now use pay-as-you-go tracking (see ai-usage-tracker.ts)
export const tierRateLimiters = {
  api: createTierRateLimitMiddleware('api'),
  auth: createTierRateLimitMiddleware('auth'),
  // ✅ FORTUNE 500 FIX: Streaming endpoints use tuned limits
  // Free: 10/15min, Pro: 100/hr, Enterprise: 1000/hr
  streaming: createTierRateLimitMiddleware('streaming')
};
