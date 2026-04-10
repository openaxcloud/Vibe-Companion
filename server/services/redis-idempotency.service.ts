/**
 * Redis-Backed Idempotency Service
 * 
 * Fortune 500-grade distributed idempotency with:
 * - Redis-backed storage (survives restarts)
 * - Distributed locking (SETNX pattern)
 * - Automatic TTL cleanup
 * - Graceful fallback to in-memory when Redis unavailable
 * 
 * Date: November 30, 2025
 */

import Redis from 'ioredis';
import { createLogger } from '../utils/logger';
import { config } from '../config/environment';

const logger = createLogger('redis-idempotency');

interface IdempotencyEntry {
  response: any;
  timestamp: number;
  inProgress: boolean;
  lockId?: string;
}

// In-memory fallback when Redis unavailable
const memoryFallback = new Map<string, IdempotencyEntry>();

export class RedisIdempotencyService {
  private client: Redis | null = null;
  private isEnabled: boolean = false;
  private readonly prefix = 'idem:';
  private readonly lockPrefix = 'idem:lock:';
  private readonly defaultTTL = 86400; // 24 hours in seconds
  private readonly lockTTL = 300; // 5 minutes lock timeout
  private readonly localPromises = new Map<string, Promise<any>>();

  constructor() {
    this.initialize();
  }

  private initialize() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
    
    if (!redisUrl) {
      logger.warn('Redis not configured - idempotency using in-memory fallback (not distributed)');
      return;
    }

    try {
      const connectionUrl = redisUrl.replace('rediss://', 'redis://');
      
      this.client = new Redis(connectionUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 5) return null;
          return Math.min(Math.pow(2, times) * 1000, 30000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis idempotency error:', { error: err.message });
        this.isEnabled = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis idempotency service connected');
        this.isEnabled = true;
      });

      this.client.connect().catch((err) => {
        logger.warn('Redis idempotency connection failed - using memory fallback:', { error: err.message });
        this.isEnabled = false;
      });

    } catch (error: any) {
      logger.warn('Redis idempotency initialization failed:', { error: error.message });
      this.isEnabled = false;
    }
  }

  /**
   * Check if a request with this key is already cached or in progress
   * Returns: { cached: response } if completed, { inProgress: true } if processing, null if new
   */
  async check(key: string): Promise<{ cached?: any; inProgress?: boolean; lockId?: string } | null> {
    const fullKey = this.prefix + key;
    
    if (this.isEnabled && this.client) {
      try {
        const data = await this.client.get(fullKey);
        if (data) {
          const entry: IdempotencyEntry = JSON.parse(data);
          if (entry.inProgress) {
            return { inProgress: true, lockId: entry.lockId };
          }
          return { cached: entry.response };
        }
      } catch (error) {
        logger.error('Redis check error:', { error, key });
      }
    }

    // Fallback to memory
    const memEntry = memoryFallback.get(key);
    if (memEntry) {
      if (memEntry.inProgress) {
        return { inProgress: true, lockId: memEntry.lockId };
      }
      return { cached: memEntry.response };
    }

    return null;
  }

  /**
   * Acquire a distributed lock for processing this request
   * Returns lockId if acquired, null if already locked
   */
  async acquireLock(key: string): Promise<string | null> {
    const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullKey = this.prefix + key;
    const lockKey = this.lockPrefix + key;
    
    if (this.isEnabled && this.client) {
      try {
        // SETNX pattern for distributed lock
        const acquired = await this.client.set(lockKey, lockId, 'EX', this.lockTTL, 'NX');
        
        if (acquired) {
          // Mark as in-progress
          const entry: IdempotencyEntry = {
            response: null,
            timestamp: Date.now(),
            inProgress: true,
            lockId
          };
          await this.client.setex(fullKey, this.defaultTTL, JSON.stringify(entry));
          logger.info(`[Idempotency] Lock acquired for key: ${key}`, { lockId });
          return lockId;
        }
        
        logger.info(`[Idempotency] Lock already held for key: ${key}`);
        return null;
      } catch (error) {
        logger.error('Redis lock acquisition error:', { error, key });
      }
    }

    // Fallback to memory
    if (memoryFallback.has(key)) {
      const entry = memoryFallback.get(key)!;
      if (entry.inProgress) {
        return null; // Already processing
      }
    }

    memoryFallback.set(key, {
      response: null,
      timestamp: Date.now(),
      inProgress: true,
      lockId
    });
    
    return lockId;
  }

  /**
   * Store the completed response and release the lock
   */
  async complete(key: string, lockId: string, response: any): Promise<boolean> {
    const fullKey = this.prefix + key;
    const lockKey = this.lockPrefix + key;
    
    if (this.isEnabled && this.client) {
      try {
        // Verify we still hold the lock
        const currentLock = await this.client.get(lockKey);
        if (currentLock !== lockId) {
          logger.warn(`[Idempotency] Lock lost for key: ${key}`, { expectedLock: lockId, currentLock });
          return false;
        }

        // Store completed response
        const entry: IdempotencyEntry = {
          response,
          timestamp: Date.now(),
          inProgress: false
        };
        await this.client.setex(fullKey, this.defaultTTL, JSON.stringify(entry));
        
        // Release lock
        await this.client.del(lockKey);
        
        logger.info(`[Idempotency] Response cached for key: ${key}`, { 
          projectId: response?.projectId,
          sessionId: response?.sessionId 
        });
        return true;
      } catch (error) {
        logger.error('Redis complete error:', { error, key });
      }
    }

    // Fallback to memory
    memoryFallback.set(key, {
      response,
      timestamp: Date.now(),
      inProgress: false
    });
    
    return true;
  }

  /**
   * Release lock and remove entry on failure
   */
  async fail(key: string, lockId: string): Promise<void> {
    const fullKey = this.prefix + key;
    const lockKey = this.lockPrefix + key;
    
    if (this.isEnabled && this.client) {
      try {
        const currentLock = await this.client.get(lockKey);
        if (currentLock === lockId) {
          await this.client.del(lockKey);
          await this.client.del(fullKey);
        }
      } catch (error) {
        logger.error('Redis fail cleanup error:', { error, key });
      }
    }

    // Memory fallback
    const entry = memoryFallback.get(key);
    if (entry?.lockId === lockId) {
      memoryFallback.delete(key);
    }
  }

  /**
   * Wait for an in-progress request to complete
   * Polls Redis until response is available or timeout
   */
  async waitForCompletion(key: string, timeoutMs: number = 30000): Promise<any | null> {
    const startTime = Date.now();
    const pollInterval = 100; // 100ms polling

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.check(key);
      
      if (result?.cached) {
        return result.cached;
      }
      
      if (!result?.inProgress) {
        // Request failed or was removed
        return null;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    logger.warn(`[Idempotency] Timeout waiting for completion: ${key}`);
    return null;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{ redis: boolean; memoryEntries: number; redisKeys?: number }> {
    const stats: any = {
      redis: this.isEnabled,
      memoryEntries: memoryFallback.size
    };

    if (this.isEnabled && this.client) {
      try {
        const keys = await this.client.keys(this.prefix + '*');
        stats.redisKeys = keys.length;
      } catch (error) {
        // Ignore
      }
    }

    return stats;
  }

  /**
   * Manual cleanup of expired memory entries
   */
  cleanupMemory(): number {
    const now = Date.now();
    const ttlMs = this.defaultTTL * 1000;
    let cleaned = 0;

    for (const [key, entry] of memoryFallback.entries()) {
      if (now - entry.timestamp > ttlMs) {
        memoryFallback.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance
export const redisIdempotency = new RedisIdempotencyService();

// Periodic memory cleanup
setInterval(() => {
  const cleaned = redisIdempotency.cleanupMemory();
  if (cleaned > 0) {
    logger.info(`[Idempotency] Cleaned ${cleaned} expired memory entries`);
  }
}, 60 * 60 * 1000); // Every hour
