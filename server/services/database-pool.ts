// @ts-nocheck
/**
 * Database Connection Pooling Service
 * Fortune 500-grade database optimization
 */

import pg from 'pg';
const { Pool } = pg;
type PoolClient = pg.PoolClient;
type PoolConfig = pg.PoolConfig;
import { drizzle } from 'drizzle-orm/node-postgres';
import { createLogger } from '../utils/logger';
import * as schema from '@shared/schema';

const logger = createLogger('database-pool');

export class DatabasePoolManager {
  private pools: Map<string, Pool> = new Map();
  private activeConnections: Map<string, number> = new Map();
  private config: PoolConfig = {
    // Pool sizing: prod targets ~1k concurrent users; without PgBouncer
    // we need a healthy direct-connection ceiling. min=5 keeps warm
    // connections so the first request doesn't pay TCP+TLS handshake;
    // max=50 absorbs request bursts. Override with DB_POOL_MIN /
    // DB_POOL_MAX if running behind PgBouncer (then drop to ~5/10
    // because the bouncer multiplexes).
    // Dev keeps a tighter ceiling (Neon free tier caps connections).
    max: parseInt(process.env.DB_POOL_MAX || (process.env.NODE_ENV === 'production' ? '50' : '10')),
    min: parseInt(process.env.DB_POOL_MIN || (process.env.NODE_ENV === 'production' ? '5' : '2')),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
    
    // Connection string from environment
    connectionString: process.env.DATABASE_URL,

    // SSL: Neon requires TLS even in development, so don't force ssl:false.
    // We honor sslmode=… from the connection string and only set
    // rejectUnauthorized:false (Neon's cert chain isn't always recognized
    // by node's bundled CA list).
    ssl: { rejectUnauthorized: false }
  };

  constructor() {
    this.initializePrimaryPool();
    this.setupMonitoring();
  }

  private initializePrimaryPool() {
    try {
      const pool = new Pool(this.config);
      
      // Error handling
      pool.on('error', (err, client) => {
        logger.error('Unexpected database pool error:', err);
      });

      // Connection monitoring
      pool.on('connect', (client) => {
        const poolName = 'primary';
        const current = this.activeConnections.get(poolName) || 0;
        this.activeConnections.set(poolName, current + 1);
        logger.debug(`New connection established. Active: ${current + 1}`);
      });

      pool.on('remove', (client) => {
        const poolName = 'primary';
        const current = this.activeConnections.get(poolName) || 0;
        this.activeConnections.set(poolName, Math.max(0, current - 1));
        logger.debug(`Connection removed. Active: ${Math.max(0, current - 1)}`);
      });

      this.pools.set('primary', pool);
      logger.info('Database pool initialized successfully', {
        max: this.config.max,
        min: this.config.min
      });
    } catch (error: any) {
      logger.error('Failed to initialize database pool:', error?.message || String(error));
      throw error;
    }
  }

  // Get connection from pool
  async getConnection(poolName: string = 'primary'): Promise<PoolClient> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    try {
      const client = await pool.connect();
      
      // Add query timing
      const originalQuery = client.query.bind(client);
      client.query = async function(...args: any[]) {
        const start = Date.now();
        try {
          const result = await originalQuery(...args);
          const duration = Date.now() - start;
          
          // Log slow queries
          if (duration > 1000) {
            logger.warn('Slow query detected', {
              duration,
              query: args[0]?.text || args[0]
            });
          }
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          logger.error('Query failed', {
            duration,
            query: args[0]?.text || args[0],
            error
          });
          throw error;
        }
      };

      return client;
    } catch (error) {
      logger.error('Failed to get connection from pool:', error);
      throw error;
    }
  }

  // Execute query with automatic connection management
  async query<T = any>(
    query: string | { text: string; values?: any[] },
    values?: any[]
  ): Promise<T[]> {
    const client = await this.getConnection();
    try {
      const queryConfig = typeof query === 'string' 
        ? { text: query, values }
        : query;
      
      const result = await client.query(queryConfig);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  // Get pool statistics
  getPoolStatistics(): any {
    const pool = this.pools.get('primary');
    if (!pool) {
      return {
        totalConnections: 0,
        idleConnections: 0,
        activeConnections: 0,
        waitingRequests: 0
      };
    }

    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      activeConnections: this.activeConnections.get('primary') || 0,
      waitingRequests: pool.waitingCount,
      configuration: {
        max: this.config.max,
        min: this.config.min,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis
      }
    };
  }

  // Setup monitoring
  private setupMonitoring(): void {
    setInterval(() => {
      const stats = this.getPoolStatistics();
      if (stats.waitingRequests > 5) {
        logger.warn('Database pool has waiting requests', stats);
      }
      if (stats.idleConnections === 0 && stats.activeConnections === this.config.max) {
        logger.warn('Database pool at maximum capacity', stats);
      }
    }, 30000); // Every 30 seconds
  }

  // Cleanup on shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down database pools...');
    for (const [name, pool] of this.pools) {
      await pool.end();
      logger.info(`Pool ${name} closed`);
    }
  }

  // Transaction support
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getConnection();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create read replica pool
  async createReadReplica(name: string, connectionString: string) {
    const replicaConfig = {
      ...this.config,
      connectionString,
      max: 10, // Lower max for read replicas
      min: 2
    };

    const pool = new Pool(replicaConfig);
    this.pools.set(name, pool);
    logger.info(`Read replica pool '${name}' created`);
  }

  // Load balancing for read queries
  async readQuery<T = any>(
    query: string | { text: string; values?: any[] },
    values?: any[]
  ): Promise<T[]> {
    // Get all read replica pools
    const replicaPools = Array.from(this.pools.entries())
      .filter(([name]) => name !== 'primary');
    
    if (replicaPools.length === 0) {
      // Fallback to primary if no replicas
      return this.query(query, values);
    }

    // Simple round-robin selection
    const poolName = replicaPools[
      Math.floor(Math.random() * replicaPools.length)
    ][0];
    
    const client = await this.getConnection(poolName);
    try {
      const queryConfig = typeof query === 'string' 
        ? { text: query, values }
        : query;
      
      const result = await client.query(queryConfig);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck(): Promise<{
    healthy: boolean;
    pools: Record<string, {
      waiting: number;
      idle: number;
      total: number;
    }>;
  }> {
    const poolStats: Record<string, any> = {};
    
    for (const [name, pool] of this.pools) {
      try {
        // Test connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        poolStats[name] = {
          waiting: pool.waitingCount,
          idle: pool.idleCount,
          total: pool.totalCount
        };
      } catch (error) {
        logger.error(`Health check failed for pool ${name}:`, error);
        poolStats[name] = {
          waiting: 0,
          idle: 0,
          total: 0,
          error: error.message
        };
      }
    }

    const healthy = Object.values(poolStats).every(
      stats => !stats.error
    );

    return { healthy, pools: poolStats };
  }

  // Get Drizzle instance with pooled connection
  getDrizzle(poolName: string = 'primary') {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    return drizzle(pool, { schema });
  }

  // Connection pool optimization strategies
  async optimizePool(poolName: string = 'primary') {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const stats = {
      waiting: pool.waitingCount,
      idle: pool.idleCount,
      total: pool.totalCount
    };

    // Auto-scale pool based on usage
    if (stats.waiting > 5 && stats.total < this.config.max!) {
      logger.info(`Scaling up pool '${poolName}' due to high demand`);
      // Pool will automatically scale up to max
    }

    if (stats.idle > this.config.min! * 2) {
      logger.info(`Pool '${poolName}' has excessive idle connections`);
      // Connections will be cleaned up by idleTimeoutMillis
    }
  }
}

// Export singleton instance
export const dbPool = new DatabasePoolManager();

// Helper function for query with retry
export async function queryWithRetry<T = any>(
  query: string | { text: string; values?: any[] },
  values?: any[],
  maxRetries: number = 3
): Promise<T[]> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await dbPool.query<T>(query, values);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Query attempt ${i + 1} failed, retrying...`, {
        error: error.message
      });
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
  
  throw lastError;
}