// @ts-nocheck
/**
 * AI Usage Tracking Middleware (Pay-As-You-Go)
 * 
 * PHILOSOPHY: Never block AI requests - ALWAYS allow them and bill via Stripe
 * - Free tier: 100 AI requests/month included at $0/month
 * - Pro tier: 10,000 AI requests/month included at $20/month
 * - Enterprise tier: 100,000 AI requests/month included at $500/month
 * - Overage: Charged per token at official model pricing
 * 
 * This middleware:
 * 1. Captures AI request (model, tokens)
 * 2. Calculates cost based on official pricing
 * 3. Records to ai_usage_metering table
 * 4. Reports to Stripe metered billing (async)
 * 5. Rate limits per tier (Issue #38)
 */

import { Request, Response, NextFunction } from 'express';
import { aiMeteringService } from '../services/ai-metering-service';
import { createLogger } from '../utils/logger';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const logger = createLogger('ai-usage-tracker');

type SubscriptionTier = 'free' | 'core' | 'teams' | 'enterprise';

// Monthly included quotas (requests)
const MONTHLY_INCLUDED_REQUESTS: Record<SubscriptionTier, number> = {
  free: 100,
  core: 10_000,
  teams: 50_000,
  enterprise: 100_000,
};

// ✅ Issue #38 FIX: Rate limiting per tier
// Limits are requests per minute to prevent abuse while allowing normal usage
// ✅ CRITICAL FIX (Jan 14, 2026): Aligned tiers with Replit pricing model (free/core/teams/enterprise)
const RATE_LIMITS_PER_MINUTE: Record<SubscriptionTier, number> = {
  free: 10,        // 10 requests/min for free tier
  core: 60,        // 60 requests/min for core tier (was pro)
  teams: 150,      // 150 requests/min for teams tier
  enterprise: 300  // 300 requests/min for enterprise tier
};

// Create rate limiters per tier
const rateLimiters: Record<SubscriptionTier, RateLimiterMemory> = {
  free: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.free,
    duration: 60, // 1 minute
    keyPrefix: 'ai_rate_free'
  }),
  core: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.core,
    duration: 60,
    keyPrefix: 'ai_rate_core'
  }),
  teams: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.teams,
    duration: 60,
    keyPrefix: 'ai_rate_teams'
  }),
  enterprise: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.enterprise,
    duration: 60,
    keyPrefix: 'ai_rate_enterprise'
  })
};

interface AiUsageContext {
  model?: string;
  provider?: string;
  tokensInput?: number;
  tokensOutput?: number;
  status?: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  startTime?: number;
}

// ✅ CRITICAL FIX (Dec 19, 2025): Harmonized multiplier with tier-rate-limiter.ts
// Development: 1000x (comprehensive E2E testing), Test: 10000x (effectively unlimited), Prod: 1x
const DEV_MULTIPLIER = 
  process.env.NODE_ENV === 'test' ? 10000 :
  process.env.NODE_ENV === 'development' ? 1000 : 
  1;

// ✅ CRITICAL FIX (Dec 19, 2025): Create dev-mode-aware rate limiters with harmonized multiplier
// ✅ CRITICAL FIX (Jan 14, 2026): Aligned with Replit pricing tiers (free/core/teams/enterprise)
const devAwareRateLimiters: Record<SubscriptionTier, RateLimiterMemory> = {
  free: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.free * DEV_MULTIPLIER,
    duration: 60,
    keyPrefix: 'ai_rate_free'
  }),
  core: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.core * DEV_MULTIPLIER,
    duration: 60,
    keyPrefix: 'ai_rate_core'
  }),
  teams: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.teams * DEV_MULTIPLIER,
    duration: 60,
    keyPrefix: 'ai_rate_teams'
  }),
  enterprise: new RateLimiterMemory({
    points: RATE_LIMITS_PER_MINUTE.enterprise * DEV_MULTIPLIER,
    duration: 60,
    keyPrefix: 'ai_rate_enterprise'
  })
};

/**
 * Middleware to track AI usage with rate limiting per tier
 * ✅ Issue #38 FIX: Added rate limiting that doesn't block but warns
 * ✅ CRITICAL FIX (Dec 19, 2025): Added dev mode bypass and multiplier
 */
export async function aiUsageTracker(req: Request, res: Response, next: NextFunction) {
  // ✅ CRITICAL FIX (Dec 19, 2025): Check global rate limit bypass flag
  if ((req as any)._skipRateLimit === true) {
    return next();
  }
  
  // ✅ CRITICAL FIX (Dec 28, 2025): Skip rate limiting for non-AI routes
  // These are conversation management routes that don't make actual AI calls
  // Note: When middleware is mounted at /api/agent, req.path is the sub-path (e.g., /conversation)
  // Use req.originalUrl for full path matching
  const nonAiPathPatterns = [
    '/conversation',      // Matches /api/agent/conversation
    '/preferences',       // Matches /api/agent/preferences
    '/models',            // Matches /api/agent/models
    '/recommend-model',   // Matches /api/agent/recommend-model
    '/repo-overview',     // Matches /api/agent/repo-overview
    '/step-cache',        // Matches /api/agent/step-cache
  ];
  
  const isNonAiRoute = nonAiPathPatterns.some(pattern => 
    req.path === pattern || req.path.startsWith(pattern + '/')
  );
  if (isNonAiRoute) {
    return next();
  }
  
  const user = req.user as any;
  
  if (!user?.id) {
    // Silent skip for unauthenticated requests - this is expected behavior
    return next();
  }

  // ✅ CRITICAL FIX (Jan 14, 2026): Normalize tier to valid values, fallback to 'free' for unknown tiers
  const rawTier = user.subscriptionTier || 'free';
  const validTiers: SubscriptionTier[] = ['free', 'core', 'teams', 'enterprise'];
  const tier: SubscriptionTier = validTiers.includes(rawTier) ? rawTier : 'free';
  
  // ✅ CRITICAL FIX (Dec 19, 2025): Use dev-aware rate limiters with 1000x multiplier
  const rateLimiter = devAwareRateLimiters[tier];
  const effectiveLimit = RATE_LIMITS_PER_MINUTE[tier] * DEV_MULTIPLIER;
  
  // ✅ Issue #38: Check rate limit per tier
  try {
    await rateLimiter.consume(user.id);
  } catch (rateLimitError: any) {
    // Rate limited - return 429 with retry-after header
    const retryAfter = Math.ceil(rateLimitError.msBeforeNext / 1000) || 60;
    
    logger.warn(`Rate limit exceeded for user ${user.id} (tier: ${tier})`, {
      userId: user.id,
      tier,
      effectiveLimit,
      isDev: process.env.NODE_ENV === 'development',
      msBeforeNext: rateLimitError.msBeforeNext
    });
    
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', effectiveLimit);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', Date.now() + (retryAfter * 1000));
    
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You've exceeded the ${tier} tier rate limit of ${effectiveLimit} requests per minute. Please try again in ${retryAfter} seconds.`,
      retryAfter,
      tier,
      limit: effectiveLimit,
      upgradeUrl: tier === 'free' ? '/pricing' : undefined
    });
  }

  // Initialize tracking context
  const trackingContext: AiUsageContext = {
    startTime: Date.now(),
    status: 'success',
  };
  res.locals.aiTracking = trackingContext;

  // Intercept response to capture usage data
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Capture AI usage from response body (if present)
    if (body?.usage || body?.model) {
      trackingContext.model = body.model;
      trackingContext.tokensInput = body.usage?.prompt_tokens || body.usage?.input_tokens || 0;
      trackingContext.tokensOutput = body.usage?.completion_tokens || body.usage?.output_tokens || 0;
      trackingContext.provider = extractProvider(body.model);
      
      // Track usage asynchronously (don't block response)
      trackAiUsage(req, trackingContext).catch((error) => {
        logger.error('Failed to track AI usage', { error });
      });
    }
    
    return originalJson(body);
  };

  next();
}

/**
 * Extract provider from model name
 */
function extractProvider(model: string | undefined): string {
  // CRITICAL FIX: Validate model is a string before calling .startsWith()
  // Bug: body.model could be an object/number, causing "TypeError: model.startsWith is not a function"
  if (!model || typeof model !== 'string') {
    logger.debug(`Invalid model type (expected string, got ${typeof model}):`, model);
    return 'unknown';
  }
  
  if (model.startsWith('gpt-') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'gemini';
  if (model.startsWith('grok-')) return 'xai';
  if (model.startsWith('kimi-')) return 'moonshot';
  
  return 'unknown';
}

/**
 * Track AI usage to database and Stripe
 */
async function trackAiUsage(req: Request, context: AiUsageContext) {
  const user = req.user as any;
  
  // ✅ CRITICAL FIX: Track even if tokens are 0 (input-only requests still cost money)
  if (!context.model || context.tokensInput === undefined || context.tokensOutput === undefined) {
    logger.debug('Incomplete AI usage data - skipping tracking', { context });
    return;
  }

  // ✅ CRITICAL FIX (Jan 14, 2026): Normalize tier to valid values
  const rawTier = user.subscriptionTier || 'free';
  const validTiers: SubscriptionTier[] = ['free', 'core', 'teams', 'enterprise'];
  const tier: SubscriptionTier = validTiers.includes(rawTier) ? rawTier : 'free';
  const requestDurationMs = context.startTime ? Date.now() - context.startTime : undefined;

  try {
    await aiMeteringService.trackUsage({
      userId: user.id,
      endpoint: req.path,
      model: context.model,
      provider: context.provider || 'unknown',
      tokensInput: context.tokensInput,
      tokensOutput: context.tokensOutput,
      userTier: tier,
      subscriptionId: user.stripeSubscriptionId,
      requestDurationMs,
      status: context.status || 'success',
      errorMessage: context.errorMessage,
      metadata: {
        method: req.method,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      },
    });
    
    logger.info(`AI usage tracked: user=${user.id}, model=${context.model}, tokens=${context.tokensInput + context.tokensOutput}`);
  } catch (error) {
    logger.error('Failed to track AI usage', { error, userId: user.id, model: context.model });
  }
}

/**
 * Helper to manually track AI usage (for SSE streams where response interception won't work)
 */
export async function trackAiUsageManually(params: {
  userId: string;
  endpoint: string;
  model: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  userTier: SubscriptionTier;
  subscriptionId?: string;
  requestDurationMs?: number;
  status?: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await aiMeteringService.trackUsage({
      ...params,
      status: params.status || 'success',
    });
    logger.info(`AI usage tracked manually: user=${params.userId}, model=${params.model}, tokens=${params.tokensInput + params.tokensOutput}`);
  } catch (error) {
    logger.error('Failed to track AI usage manually', { error, params });
  }
}
