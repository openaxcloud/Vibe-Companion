/**
 * Database Connection Pooling
 * Production-ready database pooling configuration
 */

import pg from 'pg';
const { Pool } = pg;
type PoolConfig = pg.PoolConfig;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('database-pool');

// Database configuration with production optimizations
const getPoolConfig = (): PoolConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    connectionString: process.env.DATABASE_URL,

    // Pool sizing: see server/services/database-pool.ts for the
    // rationale. Two pool managers exist (this one + DatabasePoolManager);
    // both should agree on production caps.
    min: parseInt(process.env.DB_POOL_MIN || (isProduction ? '5' : '2'), 10),
    max: parseInt(process.env.DB_POOL_MAX || (isProduction ? '50' : '10'), 10),
    
    // Connection management
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Fail after 10 seconds if can't connect
    
    // Statement timeout - prevent long running queries
    statement_timeout: 60000, // 60 seconds
    
    // Application name for monitoring
    application_name: `ecode-${process.env.NODE_ENV || 'development'}`,
    
    // Keep alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
};

export class DatabasePool {
  private pool: Pool | null = null;
  private db: any = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxRetries = 5;
  private retryDelay = 5000; // Start with 5 second delay
  private performanceMetrics = {
    totalQueries: 0,
    totalErrors: 0,
    avgQueryTime: 0,
    slowQueries: [] as any[],
  };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const config = getPoolConfig();
      
      if (!config.connectionString) {
        logger.warn('DATABASE_URL not configured. Database features will be disabled.');
        return;
      }

      this.pool = new Pool(config);

      // Connection event handlers
      this.pool.on('connect', (client) => {
        logger.info('New database connection established');
        
        // Set runtime parameters for each connection
        client.query('SET statement_timeout = 60000'); // 60 seconds
        client.query('SET lock_timeout = 10000'); // 10 seconds
        client.query('SET idle_in_transaction_session_timeout = 60000'); // 60 seconds
      });

      this.pool.on('error', (err, client) => {
        logger.error('Database pool error:', err);
        this.performanceMetrics.totalErrors++;
        
        // Attempt reconnection for critical errors
        if (err.message.includes('Connection terminated') || 
            err.message.includes('ECONNREFUSED')) {
          this.reconnect();
        }
      });

      this.pool.on('remove', (client) => {
        logger.debug('Database connection removed from pool');
      });

      // Test the connection
      await this.testConnection();

      // Initialize Drizzle ORM
      this.db = drizzle(this.pool, { schema });
      this.isConnected = true;
      
      logger.info('Database pool initialized successfully', {
        min: config.min,
        max: config.max,
        idleTimeout: config.idleTimeoutMillis
      });

      // Start monitoring
      this.startMonitoring();
    } catch (error: any) {
      logger.error('Failed to initialize database pool:', error?.message || String(error), error?.stack);
      this.scheduleReconnection();
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.pool) throw new Error('Pool not initialized');
    
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      logger.info('Database connection test successful:', result.rows[0]);
    } finally {
      client.release();
    }
  }

  private async reconnect(): Promise<void> {
    if (this.connectionAttempts >= this.maxRetries) {
      logger.error('Max reconnection attempts reached. Database connection failed.');
      return;
    }

    this.connectionAttempts++;
    logger.info(`Attempting database reconnection (${this.connectionAttempts}/${this.maxRetries})...`);

    await this.shutdown();
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionAttempts));
    await this.initialize();
  }

  private scheduleReconnection(): void {
    if (this.connectionAttempts >= this.maxRetries) return;
    
    const delay = this.retryDelay * Math.pow(2, this.connectionAttempts);
    logger.info(`Scheduling database reconnection in ${delay}ms`);
    
    setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  private startMonitoring(): void {
    if (!this.pool) return;

    // Monitor pool stats every minute
    setInterval(async () => {
      if (!this.pool) return;
      
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };

      logger.debug('Database pool stats:', poolStats);

      // Check for pool exhaustion
      if (poolStats.waiting > 5) {
        logger.warn('High number of waiting connections:', poolStats.waiting);
      }

      // Report slow queries
      if (this.performanceMetrics.slowQueries.length > 0) {
        logger.warn('Slow queries detected:', this.performanceMetrics.slowQueries);
        this.performanceMetrics.slowQueries = []; // Clear after reporting
      }
    }, 60000); // Every minute
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();
    let client;

    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      
      const duration = Date.now() - start;
      this.updateMetrics(duration, text);
      
      return result;
    } catch (error) {
      this.performanceMetrics.totalErrors++;
      logger.error('Query error:', { query: text, error });
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  private updateMetrics(duration: number, query: string): void {
    this.performanceMetrics.totalQueries++;
    
    // Update average query time
    const prevAvg = this.performanceMetrics.avgQueryTime;
    this.performanceMetrics.avgQueryTime = 
      (prevAvg * (this.performanceMetrics.totalQueries - 1) + duration) / 
      this.performanceMetrics.totalQueries;

    // Track slow queries (> 1 second)
    if (duration > 1000) {
      this.performanceMetrics.slowQueries.push({
        query: query.substring(0, 100),
        duration,
        timestamp: new Date(),
      });

      logger.warn('Slow query detected:', {
        duration: `${duration}ms`,
        query: query.substring(0, 100)
      });
    }
  }

  public getDb(): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public isReady(): boolean {
    return this.isConnected && this.pool !== null;
  }

  public getMetrics() {
    return {
      ...this.performanceMetrics,
      poolStats: this.pool ? {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      } : null,
    };
  }

  public async shutdown(): Promise<void> {
    if (this.pool) {
      logger.info('Shutting down database pool...');
      
      try {
        await this.pool.end();
        this.pool = null;
        this.db = null;
        this.isConnected = false;
        logger.info('Database pool shutdown complete');
      } catch (error) {
        logger.error('Error during database pool shutdown:', error);
      }
    }
  }

  public async healthCheck(): Promise<{ status: string; details?: any }> {
    if (!this.pool) {
      return { status: 'unhealthy', details: 'Pool not initialized' };
    }

    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT 1');
        return { 
          status: 'healthy',
          details: {
            poolStats: {
              total: this.pool.totalCount,
              idle: this.pool.idleCount,
              waiting: this.pool.waitingCount,
            },
            metrics: this.performanceMetrics,
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return { 
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const dbPool = new DatabasePool();