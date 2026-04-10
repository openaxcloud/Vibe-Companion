/**
 * Redis Session Manager - Fortune 500 Session Persistence
 * Externalizes terminal session state to Redis for fault tolerance and horizontal scaling
 */

import Redis from 'ioredis';
import { createLogger } from '../utils/logger';
import { config } from '../config/environment';

const logger = createLogger('redis-session');

// Session data structure
export interface TerminalSession {
  sessionId: string;
  projectId: string;
  commandHistory: string[];
  currentDirectory: string;
  columns?: number;
  rows?: number;
  createdAt: number;
  lastActivity: number;
  containerId?: string;
  shellPid?: number;
  outputSnapshot?: string;
  sessionEnded?: boolean;
}

// Session TTL: 24 hours
const SESSION_TTL_SECONDS = 24 * 60 * 60;

export class RedisSessionManager {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly RECONNECT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection with bounded exponential backoff
   */
  private async initialize(): Promise<void> {
    try {
      // Check if Redis is enabled via REDIS_ENABLED env var (defaults to true in production)
      if (!config.redis.enabled) {
        logger.info('Redis disabled in configuration - session persistence disabled (sessions will be lost on restart)');
        this.isConnected = false;
        this.redis = null;
        return;
      }

      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        logger.info('REDIS_URL not configured - session persistence disabled (sessions will be lost on restart)');
        this.isConnected = false;
        this.redis = null;
        return;
      }

      // Normalize URL to redis:// (remove TLS for now - Redis Cloud on this port may not support TLS)
      const connectionUrl = redisUrl.replace('rediss://', 'redis://');
      
      logger.info(`Connecting to Redis for session persistence: ${connectionUrl.replace(/:[^:@]+@/, ':***@')}`);

      this.redis = new Redis(connectionUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          // True exponential backoff: max 5 retries
          if (times > this.MAX_RETRIES) {
            logger.warn(`Redis max retries reached - will retry reconnection every ${this.RECONNECT_INTERVAL_MS / 1000}s`);
            this.scheduleReconnect();
            return null; // Stop retrying, use periodic reconnect instead
          }
          // True exponential: 2s, 4s, 8s, 16s, 32s
          const delay = Math.min(Math.pow(2, times) * 1000, 32000);
          logger.info(`Redis retry attempt ${times}/${this.MAX_RETRIES} in ${delay}ms`);
          return delay;
        },
        lazyConnect: true
      });

      this.redis.on('error', (err) => {
        this.retryCount++;
        if (this.retryCount === 1) {
          logger.error('Redis error:', { error: err.message, willRetry: this.retryCount <= this.MAX_RETRIES });
        }
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        logger.info('✓ Redis connected successfully');
        this.isConnected = true;
        this.retryCount = 0;
        this.clearReconnectTimer();
      });

      this.redis.on('close', () => {
        if (this.isConnected) {
          // Only log if we were previously connected
          logger.warn('Redis connection closed - will attempt reconnect');
        }
        this.isConnected = false;
      });

      // Test connection
      await this.redis.connect();
      await this.redis.ping();
      logger.info('Redis connection verified');
      this.isConnected = true;

    } catch (error: any) {
      logger.warn('Redis initial connection failed - will retry:', { error: error.message });
      this.isConnected = false;
    }
  }

  /**
   * Schedule periodic reconnection attempts
   */
  private scheduleReconnect() {
    this.clearReconnectTimer();
    
    this.reconnectTimer = setInterval(() => {
      if (!this.isConnected && this.redis) {
        logger.info('Redis attempting periodic reconnection...');
        this.retryCount = 0; // Reset retry counter for new connection attempt
        this.redis.connect().catch((err) => {
          logger.warn('Redis periodic reconnect failed - will retry later:', { error: err.message });
        });
      }
    }, this.RECONNECT_INTERVAL_MS);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Get session key for Redis
   */
  private getSessionKey(sessionId: string): string {
    return `terminal:session:${sessionId}`;
  }

  /**
   * Save session to Redis
   */
  async saveSession(session: TerminalSession): Promise<boolean> {
    if (!this.isAvailable()) {
      logger.debug('Redis not available - session not persisted');
      return false;
    }

    try {
      const key = this.getSessionKey(session.sessionId);
      const data = JSON.stringify(session);

      await this.redis!.setex(key, SESSION_TTL_SECONDS, data);

      logger.debug(`Session saved: ${session.sessionId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to save session ${session.sessionId}: ${error}`);
      return false;
    }
  }

  /**
   * Get session from Redis
   */
  async getSession(sessionId: string): Promise<TerminalSession | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.getSessionKey(sessionId);
      const data = await this.redis!.get(key);

      if (!data) {
        return null;
      }

      const session = JSON.parse(data) as TerminalSession;
      logger.debug(`Session retrieved: ${sessionId}`);

      return session;

    } catch (error) {
      logger.error(`Failed to get session ${sessionId}: ${error}`);
      return null;
    }
  }

  /**
   * Delete session from Redis
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.getSessionKey(sessionId);
      await this.redis!.del(key);

      logger.debug(`Session deleted: ${sessionId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}: ${error}`);
      return false;
    }
  }

  /**
   * Update session last activity timestamp
   */
  async touchSession(sessionId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.lastActivity = Date.now();
      return await this.saveSession(session);

    } catch (error) {
      logger.error(`Failed to touch session ${sessionId}: ${error}`);
      return false;
    }
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<TerminalSession[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const pattern = this.getSessionKey('*');
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const sessions: TerminalSession[] = [];

      for (const key of keys) {
        const data = await this.redis!.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }

      return sessions;

    } catch (error) {
      logger.error(`Failed to get all sessions: ${error}`);
      return [];
    }
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const pattern = this.getSessionKey('*');
      const keys = await this.redis!.keys(pattern);
      return keys.length;

    } catch (error) {
      logger.error(`Failed to get session count: ${error}`);
      return 0;
    }
  }

  /**
   * Clear all sessions (admin/testing only)
   */
  async clearAllSessions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const pattern = this.getSessionKey('*');
      const keys = await this.redis!.keys(pattern);

      if (keys.length > 0) {
        await this.redis!.del(...keys);
        logger.info(`Cleared ${keys.length} sessions`);
      }

      return true;

    } catch (error) {
      logger.error(`Failed to clear sessions: ${error}`);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

// Singleton instance
export const redisSessionManager = new RedisSessionManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received - disconnecting Redis');
  await redisSessionManager.disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received - disconnecting Redis');
  await redisSessionManager.disconnect();
});
