/**
 * Redis Cache Service
 * Fortune 500-grade caching implementation
 */

import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('redis-cache');
const RETRY_DELAY_MS = parseInt(process.env.REDIS_RETRY_DELAY_MS || '60000', 10);

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export class RedisCache {
  private client: Redis | null = null;
  private isConnected = false;
  private defaultTTL = 3600; // 1 hour default
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private static hasLoggedMissingConfig = false;
  private initializing: Promise<void> | null = null;
  private nextRetryAt = 0;
  private disabled = false;
  private redisUrl: string | null = null;

  constructor() {
    const configuredUrl = process.env.REDIS_URL?.trim();

    if (!configuredUrl) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('REDIS_URL not configured. Redis cache disabled.');
        this.disabled = true;
        return;
      }

      logger.info(`REDIS_URL not configured. Falling back to ${DEFAULT_REDIS_URL} for development.`);
      this.redisUrl = DEFAULT_REDIS_URL;
      return;
    }

    this.redisUrl = configuredUrl;
  }

  private async initializeInternal() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const rawUrl = process.env.REDIS_TLS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
    const redisUrl = this.normalizeRedisUrl(rawUrl);

    try {
      this.disposeClient();

      const { options, tlsEnabled } = this.buildRedisOptions(redisUrl);

      logger.info(
        `Initializing Redis cache${tlsEnabled ? ' with TLS enabled' : ''}`
      );

      const client = new Redis(redisUrl, options);

      this.attachEventHandlers(client);

      this.client = client;

      // Removed explicit await client.connect(); to comply with lazyConnect: true best practices.

      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;

      if (this.client) {
        try {
          this.client.removeAllListeners();
          this.client.disconnect();
        } catch (disconnectError) {
          logger.warn('Error while cleaning up Redis client:', disconnectError);
        }
      }

      this.client = null;

      this.scheduleReconnect();
    }
  }

  private disposeClient() {
    if (!this.client) return;

    try {
      this.client.removeAllListeners();
      this.client.disconnect();
    } catch (error) {
      logger.warn('Error while disposing existing Redis client:', error);
    } finally {
      this.client = null;
      this.isConnected = false;
    }
  }

  private attachEventHandlers(client: Redis) {
    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;

      if (!this.initializing) {
        this.scheduleReconnect();
      }
    });

    client.on('connect', () => {
      logger.info('Redis TCP connection established');
    });

    client.on('ready', () => {
      logger.info('Redis ready to accept commands');
      this.isConnected = true;
    });

    client.on('end', () => {
      logger.warn('Redis connection ended');
      this.isConnected = false;
      this.scheduleReconnect();
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
      this.scheduleReconnect();
    });

    client.on('reconnecting', (delay: number) => {
      logger.warn(`Redis reconnecting in ${delay}ms`);
      this.isConnected = false;
    });
  }

  private scheduleReconnect(delay = 5000) {
    if (this.reconnectTimeout) return;

    logger.warn(`Scheduling Redis reconnect in ${delay}ms`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.initialize();
    }, delay);
  }

  private buildRedisOptions(redisUrl: string) {
    const options: any = {
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true
    };

    const tlsEnabled = this.shouldUseTLS(redisUrl);

    if (tlsEnabled) {
      options.tls = this.buildTlsOptions();
    }

    return { options, tlsEnabled };
  }

  private shouldUseTLS(redisUrl: string) {
    if (!redisUrl) return false;

    // Don't auto-enable TLS based on rediss:// prefix - Redis Cloud may not support TLS on all ports
    // Instead, only use TLS if explicitly enabled via environment variable
    const explicitFlag = process.env.REDIS_USE_TLS || process.env.REDIS_TLS_ENABLED;
    if (explicitFlag) {
      return ['1', 'true', 'yes', 'on'].includes(explicitFlag.toLowerCase());
    }

    return false;
  }
  
  private normalizeRedisUrl(url: string): string {
    // Convert rediss:// to redis:// since Redis Cloud may not support TLS on all ports
    return url.replace('rediss://', 'redis://');
  }

  private buildTlsOptions() {
    const tlsOptions: any = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    };

    const servername =
      process.env.REDIS_TLS_SERVERNAME ||
      process.env.REDIS_TLS_SERVER_NAME ||
      process.env.REDIS_SERVERNAME;
    if (servername) {
      tlsOptions.servername = servername;
    }

    const ca = this.loadCertificateFromEnv(
      ['REDIS_TLS_CA', 'REDIS_TLS_CA_CERT', 'REDIS_CA_CERT'],
      ['REDIS_TLS_CA_FILE', 'REDIS_CA_FILE']
    );

    if (ca) {
      tlsOptions.ca = ca;
    }

    const cert = this.loadCertificateFromEnv(
      ['REDIS_TLS_CERT', 'REDIS_CLIENT_CERT'],
      ['REDIS_TLS_CERT_FILE', 'REDIS_CLIENT_CERT_FILE']
    );

    if (cert) {
      tlsOptions.cert = cert;
    }

    const key = this.loadCertificateFromEnv(
      ['REDIS_TLS_KEY', 'REDIS_CLIENT_KEY'],
      ['REDIS_TLS_KEY_FILE', 'REDIS_CLIENT_KEY_FILE']
    );

    if (key) {
      tlsOptions.key = key;
    }

    const passphrase = process.env.REDIS_TLS_PASSPHRASE || process.env.REDIS_CLIENT_PASSPHRASE;
    if (passphrase) {
      tlsOptions.passphrase = passphrase;
    }

    return tlsOptions;
  }

  private loadCertificateFromEnv(valueNames: string[], fileNames: string[]) {
    for (const fileEnv of fileNames) {
      const filePath = process.env[fileEnv];
      if (!filePath) continue;

      try {
        const content = readFileSync(filePath, 'utf8');
        if (content) {
          return this.normalizeMultilineValue(content);
        }
      } catch (error) {
        logger.warn(`Failed to read Redis TLS file ${filePath}:`, error);
      }
    }

    for (const name of valueNames) {
      const value = process.env[name];
      if (!value) continue;

      const normalized = this.normalizeMultilineValue(value);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private normalizeMultilineValue(value: string) {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.includes('-----BEGIN')) {
      return trimmed.replace(/\r?\n/g, '\n');
    }
    
    return trimmed;
  }

  private async ensureClient(): Promise<Redis | null> {
    if (this.disabled) return null;

    if (this.client && this.isConnected) {
      return this.client;
    }

    if (Date.now() < this.nextRetryAt) {
      return null;
    }

    if (!this.initializing) {
      this.initializing = this.initialize();
    }

    try {
      const rawUrl =
        process.env.REDIS_URL ||
        process.env.TEST_REDIS_URL ||
        process.env.VITE_REDIS_URL ||
        '';

      if (!rawUrl) {
        if (!RedisCache.hasLoggedMissingConfig) {
          logger.warn(
            'Redis URL not provided – Redis cache service disabled. Set REDIS_URL to enable Redis integration.'
          );
          RedisCache.hasLoggedMissingConfig = true;
        }
        this.client = null;
        this.isConnected = false;
        return null;
      }

      const redisUrl = this.normalizeRedisUrl(rawUrl);
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 10) {
            logger.error('Redis connection failed after 10 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });
      
      await this.initializing;
    } finally {
      this.initializing = null;
    }

    return this.client && this.isConnected ? this.client : null;
  }

  private async initialize(): Promise<void> {
    if (this.disabled) return;

    const rawUrl = this.redisUrl || process.env.REDIS_URL?.trim();
    if (!rawUrl) {
      logger.warn('Redis URL unavailable. Disabling cache service.');
      this.disabled = true;
      return;
    }

    const redisUrl = this.normalizeRedisUrl(rawUrl);
    this.redisUrl = redisUrl;

    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.disconnect();
      } catch (error) {
        logger.debug('Error cleaning up previous Redis client', error);
      }
      this.client = null;
    }

    try {
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        enableReadyCheck: false,
        retryStrategy: () => null
      });

      client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.handleConnectionLoss();
      });

      client.on('close', () => {
        logger.warn('Redis connection closed');
        this.handleConnectionLoss();
      });

      client.on('end', () => {
        logger.warn('Redis connection ended');
        this.handleConnectionLoss();
      });

      client.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      client.on('ready', () => {
        logger.info('Redis ready to accept commands');
        this.isConnected = true;
        this.nextRetryAt = 0;
      });

      await client.connect();

      this.client = client;
      this.isConnected = true;
      this.nextRetryAt = 0;
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.handleConnectionLoss();
    }
  }

  private handleConnectionLoss() {
    this.isConnected = false;
    this.nextRetryAt = Date.now() + RETRY_DELAY_MS;

    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.disconnect();
      } catch (error) {
        logger.debug('Error while disconnecting Redis client', error);
      }
    }

    this.client = null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    const client = await this.ensureClient();
    if (!client) return null;

    try {
      const data = await client.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    const client = await this.ensureClient();
    if (!client) return;

    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      await client.setex(key, expiry, serialized);
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
    }
  }

  async del(key: string | string[]): Promise<void> {
    if (!this.isConnected || !this.client) return;
    const client = await this.ensureClient();
    if (!client) return;

    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error) {
      logger.error('Failed to delete cache keys:', error);
    }
  }

  async flush(): Promise<void> {
    if (!this.isConnected || !this.client) return;
    const client = await this.ensureClient();
    if (!client) return;

    try {
      await client.flushall();
      logger.info('Redis cache flushed');
    } catch (error) {
      logger.error('Failed to flush cache:', error);
    }
  }

  // Cache patterns for common use cases
  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await callback();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  // Invalidate related cache keys
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    const client = await this.ensureClient();
    if (!client) return;

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
    }
  }

  // Rate limiting implementation
  async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; reset: number; }> {
    const client = await this.ensureClient();
    if (!client) {
      return { allowed: true, remaining: limit, reset: 0 };
    }

    try {
      const multi = client.multi();
      const now = Date.now();
      const windowStart = now - window * 1000;

      // Remove old entries
      multi.zremrangebyscore(key, '-inf', windowStart.toString());

      // Add current request
      multi.zadd(key, now, now.toString());

      // Count requests in window
      multi.zcard(key);

      // Set expiry
      multi.expire(key, window);

      const results = await multi.exec();
      const count = (results?.[2]?.[1] || 0) as number;

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        reset: Math.ceil((windowStart + window * 1000) / 1000)
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return { allowed: true, remaining: limit, reset: 0 };
    }
  }

  // Session storage
  async getSession(sessionId: string): Promise<any> {
    return this.get(`session:${sessionId}`);
  }

  async setSession(sessionId: string, data: any, ttl = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttl);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    // Try to ensure client is connected first
    const client = await this.ensureClient();
    if (!client) return false;
    if (!this.isConnected) return false;

    try {
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  isEnabled(): boolean {
    return !this.disabled;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const redisCache = new RedisCache();
