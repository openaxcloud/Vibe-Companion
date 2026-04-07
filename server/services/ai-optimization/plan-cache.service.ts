/**
 * Plan Cache Service
 * Caches similar AI-generated plans to reduce redundant token usage
 * Uses Redis with intelligent cache key generation
 */

import { redisCache as redisCacheService } from '../redis-cache.service';
import crypto from 'crypto';

export interface CachedPlan {
  plan: any;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    generatedAt: Date;
    hitCount: number;
  };
}

export class PlanCacheService {
  private readonly TTL_SECONDS = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'ai:plan:';

  /**
   * Get cached plan
   */
  async get(params: {
    operation: string;
    context?: Record<string, any>;
  }): Promise<CachedPlan | null> {
    const cacheKey = this.generateCacheKey(params.operation, params.context);
    const cached = await redisCacheService.get<CachedPlan>(cacheKey);
    
    if (cached) {
      // Increment hit count
      cached.metadata.hitCount++;
      await redisCacheService.set(cacheKey, cached, this.TTL_SECONDS);
      this.trackCacheOperation('hit');
    }

    return cached;
  }

  /**
   * Set plan in cache
   */
  async set(params: {
    operation: string;
    context?: Record<string, any>;
    plan: any;
    provider: string;
    model: string;
    tokensUsed: number;
  }): Promise<void> {
    const cacheKey = this.generateCacheKey(params.operation, params.context);
    
    const cachedPlan: CachedPlan = {
      plan: params.plan,
      metadata: {
        provider: params.provider,
        model: params.model,
        tokensUsed: params.tokensUsed,
        generatedAt: new Date(),
        hitCount: 0,
      },
    };

    await redisCacheService.set(cacheKey, cachedPlan, this.TTL_SECONDS);
    this.trackCacheOperation('set', params.tokensUsed);
  }

  /**
   * Invalidate cache for an operation
   */
  async invalidate(params: {
    operation: string;
    context?: Record<string, any>;
  }): Promise<void> {
    const cacheKey = this.generateCacheKey(params.operation, params.context);
    await redisCacheService.del(cacheKey);
  }

  /**
   * Invalidate all cached plans
   */
  async invalidateAll(): Promise<void> {
    // Redis pattern deletion not supported in current service
    // Would need to implement scan + delete pattern
    // For now, plans expire naturally after TTL
  }

  /**
   * Get cache statistics
   * Uses internal counters tracked on each cache hit
   */
  private cacheStats = {
    totalCached: 0,
    totalHits: 0,
    totalTokensSaved: 0,
  };

  async getStats(): Promise<{
    totalCached: number;
    totalHits: number;
    avgTokensSaved: number;
  }> {
    return {
      totalCached: this.cacheStats.totalCached,
      totalHits: this.cacheStats.totalHits,
      avgTokensSaved: this.cacheStats.totalCached > 0 
        ? Math.round(this.cacheStats.totalTokensSaved / this.cacheStats.totalCached) 
        : 0,
    };
  }

  /**
   * Increment cache stats (called internally on cache operations)
   */
  private trackCacheOperation(operation: 'set' | 'hit', tokensUsed?: number): void {
    if (operation === 'set') {
      this.cacheStats.totalCached++;
      if (tokensUsed) {
        this.cacheStats.totalTokensSaved += tokensUsed;
      }
    } else if (operation === 'hit') {
      this.cacheStats.totalHits++;
    }
  }

  /**
   * Generate cache key from operation and context
   */
  private generateCacheKey(
    operation: string,
    context?: Record<string, any>
  ): string {
    // Create stable hash from operation + context
    const data = {
      operation,
      context: context || {},
    };

    // Sort keys for stable hash
    const sorted = JSON.stringify(data, Object.keys(data).sort());
    const hash = crypto.createHash('sha256').update(sorted).digest('hex');

    return `${this.CACHE_PREFIX}${hash}`;
  }

  /**
   * Check if operation should be cached
   */
  shouldCache(operation: string): boolean {
    // Cache plan generation and code suggestions
    const cacheable = [
      'plan',
      'suggest',
      'generate',
      'create',
      'design',
    ];

    return cacheable.some(keyword => operation.toLowerCase().includes(keyword));
  }
}

export const planCache = new PlanCacheService();
