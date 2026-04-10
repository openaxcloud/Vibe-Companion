// @ts-nocheck
import { createLogger } from '../utils/logger';
import { eq, lt } from 'drizzle-orm';
import { revokedTokens } from '../../shared/schema';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';

const logger = createLogger('token-revocation');

interface RevokedToken {
  jti: string;
  expiresAt: Date;
  userId?: string;
  revokedAt: Date;
}

function normalizeUserIdToString(userId: number | string | undefined): string | undefined {
  if (userId === undefined || userId === null) return undefined;
  return String(userId);
}

class TokenRevocationManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000;
  private db: any = null;
  private initialized: boolean = false;

  constructor() {
    this.startAutoCleanup();
  }

  async initializeFromDatabase(db: any): Promise<void> {
    if (this.initialized) return;
    
    this.db = db;
    
    try {
      const now = new Date();
      const tokens = await db
        .select()
        .from(revokedTokens)
        .where(lt(now, revokedTokens.expiresAt));
      
      let loadedCount = 0;
      for (const token of tokens) {
        const ttlSeconds = Math.max(1, Math.floor((token.expiresAt.getTime() - now.getTime()) / 1000));
        const revokedToken: RevokedToken = {
          jti: token.jti,
          expiresAt: token.expiresAt,
          userId: token.userId || undefined,
          revokedAt: token.revokedAt
        };
        
        await redisCache.set(CacheKeys.revokedToken(token.jti), revokedToken, ttlSeconds);
        
        if (token.userId) {
          await redisCache.sadd(CacheKeys.revokedUserTokens(token.userId), token.jti);
          const tokenTTL = Math.max(1, Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 1000));
          const setTTL = Math.max(tokenTTL, CacheTTL.WEEK);
          await redisCache.expire(CacheKeys.revokedUserTokens(token.userId), setTTL);
        }
        loadedCount++;
      }
      
      this.initialized = true;
      logger.info('Token revocation loaded from database into Redis', {
        loadedCount
      });
    } catch (error) {
      logger.error('Failed to load revoked tokens from database', { error });
    }
  }

  async revokeToken(jti: string, expiresAt: Date, userId?: number | string): Promise<void> {
    const normalizedUserId = normalizeUserIdToString(userId);
    const now = new Date();
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    
    const revokedToken: RevokedToken = {
      jti,
      expiresAt,
      userId: normalizedUserId,
      revokedAt: now
    };

    await redisCache.set(CacheKeys.revokedToken(jti), revokedToken, ttlSeconds);

    if (normalizedUserId) {
      await redisCache.sadd(CacheKeys.revokedUserTokens(normalizedUserId), jti);
      const setTTL = Math.max(ttlSeconds, CacheTTL.WEEK);
      await redisCache.expire(CacheKeys.revokedUserTokens(normalizedUserId), setTTL);
    }

    if (this.db) {
      try {
        await this.db.insert(revokedTokens).values({
          jti,
          userId: normalizedUserId,
          expiresAt,
          revokedAt: now
        }).onConflictDoNothing();
      } catch (error) {
        logger.error('Failed to persist revoked token to database', { error, jti });
      }
    }

    logger.info('Token revoked', {
      jti: jti.substring(0, 8) + '...',
      userId: normalizedUserId,
      expiresAt: expiresAt.toISOString()
    });
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const exists = await redisCache.exists(CacheKeys.revokedToken(jti));
    if (exists) return true;

    if (this.db) {
      try {
        const result = await this.db.select().from(revokedTokens)
          .where(eq(revokedTokens.jti, jti))
          .limit(1);
        if (result.length > 0) {
          const token = result[0];
          if (new Date(token.expiresAt) > new Date()) {
            const ttl = Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 1000);
            await redisCache.set(CacheKeys.revokedToken(jti), {
              jti,
              expiresAt: token.expiresAt,
              userId: token.userId,
              revokedAt: token.revokedAt
            }, Math.max(ttl, 60));
            return true;
          }
        }
      } catch (error) {
        logger.error('Failed to check token revocation in database', { error, jti });
      }
    }
    return false;
  }

  isTokenRevokedSync(jti: string): boolean {
    return false;
  }

  async revokeAllUserTokens(userId: number | string): Promise<number> {
    const normalizedUserId = normalizeUserIdToString(userId);
    if (!normalizedUserId) return 0;
    
    const userJtis = await redisCache.smembers(CacheKeys.revokedUserTokens(normalizedUserId));
    if (!userJtis || userJtis.length === 0) {
      logger.info('No tokens found for user', { userId: normalizedUserId });
      return 0;
    }

    const futureExpiry = new Date();
    futureExpiry.setHours(futureExpiry.getHours() + 24);
    const ttlSeconds = 24 * 3600;

    let revokedCount = 0;
    for (const jti of userJtis) {
      const alreadyRevoked = await redisCache.exists(CacheKeys.revokedToken(jti));
      if (!alreadyRevoked) {
        const revokedToken: RevokedToken = {
          jti,
          expiresAt: futureExpiry,
          userId: normalizedUserId,
          revokedAt: new Date()
        };
        
        await redisCache.set(CacheKeys.revokedToken(jti), revokedToken, ttlSeconds);
        
        if (this.db) {
          try {
            await this.db.insert(revokedTokens).values({
              jti,
              userId: normalizedUserId,
              expiresAt: futureExpiry,
              revokedAt: new Date()
            }).onConflictDoNothing();
          } catch (error) {
            logger.error('Failed to persist bulk revoked token', { error, jti });
          }
        }
        
        revokedCount++;
      }
    }

    logger.info('All user tokens revoked', { userId: normalizedUserId, revokedCount });
    return revokedCount;
  }

  async trackUserToken(userId: number | string, jti: string, expiresAt?: Date): Promise<void> {
    const normalizedUserId = normalizeUserIdToString(userId);
    if (!normalizedUserId) return;
    
    await redisCache.sadd(CacheKeys.revokedUserTokens(normalizedUserId), jti);
    const tokenTTL = expiresAt
      ? Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      : CacheTTL.WEEK;
    const setTTL = Math.max(tokenTTL, CacheTTL.WEEK);
    await redisCache.expire(CacheKeys.revokedUserTokens(normalizedUserId), setTTL);
  }

  private async cleanupExpiredTokens(): Promise<void> {
    if (this.db) {
      try {
        const now = new Date();
        await this.db.delete(revokedTokens).where(lt(revokedTokens.expiresAt, now));
      } catch (error) {
        logger.error('Failed to cleanup expired tokens from database', { error });
      }
    }
  }

  private startAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.CLEANUP_INTERVAL_MS);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    logger.info('Token revocation auto-cleanup started', {
      intervalMs: this.CLEANUP_INTERVAL_MS
    });
  }

  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Token revocation auto-cleanup stopped');
    }
  }

  async getStats(): Promise<{ revokedCount: number; trackedUsers: number }> {
    return {
      revokedCount: 0,
      trackedUsers: 0
    };
  }

  async clear(): Promise<void> {
    await redisCache.delPattern('revoked:token:*');
    await redisCache.delPattern('revoked:user:*');
    logger.info('Token revocation store cleared');
  }
}

export const tokenRevocationManager = new TokenRevocationManager();

export async function initializeTokenRevocation(db: any): Promise<void> {
  await tokenRevocationManager.initializeFromDatabase(db);
}

export function revokeToken(jti: string, expiresAt: Date, userId?: number | string): void {
  tokenRevocationManager.revokeToken(jti, expiresAt, userId);
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  return tokenRevocationManager.isTokenRevoked(jti);
}

export function revokeAllUserTokens(userId: number | string): Promise<number> {
  return tokenRevocationManager.revokeAllUserTokens(userId);
}

export function trackUserToken(userId: number | string, jti: string, expiresAt?: Date): void {
  tokenRevocationManager.trackUserToken(userId, jti, expiresAt);
}
