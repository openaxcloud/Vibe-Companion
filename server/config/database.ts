/**
 * Database Configuration
 * Handles dev/prod database separation with security controls to prevent agent access to production
 */

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Request, Response, NextFunction } from 'express';
import * as schema from "@shared/schema";
import { createLogger } from '../utils/logger';

const logger = createLogger('database-config');

type DatabaseEnvironment = 'development' | 'production';

interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeout: number;
  maxLifetime: number;
  connectTimeout: number;
  applicationName: string;
  debug: boolean;
}

interface DatabaseConnection {
  client: postgres.Sql;
  db: PostgresJsDatabase<typeof schema>;
  environment: DatabaseEnvironment;
}

const developmentConfig: Partial<DatabaseConfig> = {
  maxConnections: 20,
  idleTimeout: 60,
  maxLifetime: 60 * 60,
  connectTimeout: 10,
  applicationName: 'e-code-platform-dev',
  debug: true,
};

const productionConfig: Partial<DatabaseConfig> = {
  maxConnections: 50,
  idleTimeout: 120,
  maxLifetime: 60 * 30,
  connectTimeout: 15,
  applicationName: 'e-code-platform-prod',
  debug: false,
};

class DatabaseManager {
  private devConnection: DatabaseConnection | null = null;
  private prodConnection: DatabaseConnection | null = null;
  private agentBlockedFromProd = true;
  private currentContext: DatabaseEnvironment = 'development';

  constructor() {
    this.initializeConnections();
  }

  private initializeConnections() {
    const databaseUrl = process.env.DATABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set.");
    }

    if (isProduction) {
      this.prodConnection = this.createConnection(databaseUrl, 'production', productionConfig);
      this.devConnection = this.prodConnection;
      logger.info('Production database connection initialized');
    } else {
      this.devConnection = this.createConnection(databaseUrl, 'development', developmentConfig);
      logger.info('Development database connection initialized');
    }
  }

  private createConnection(
    connectionString: string,
    environment: DatabaseEnvironment,
    config: Partial<DatabaseConfig>
  ): DatabaseConnection {
    const client = postgres(connectionString, {
      max: config.maxConnections || 20,
      idle_timeout: config.idleTimeout || 60,
      max_lifetime: config.maxLifetime || 3600,
      connect_timeout: config.connectTimeout || 10,
      prepare: false,
      transform: {
        undefined: null,
      },
      onnotice: () => {},
      debug: config.debug || false,
      connection: {
        application_name: config.applicationName || 'e-code-platform',
      },
    });

    const db = drizzle(client, { schema });

    return {
      client,
      db,
      environment,
    };
  }

  getDevDatabase(): PostgresJsDatabase<typeof schema> {
    if (!this.devConnection) {
      throw new Error('Development database not initialized');
    }
    return this.devConnection.db;
  }

  getDevClient(): postgres.Sql {
    if (!this.devConnection) {
      throw new Error('Development database not initialized');
    }
    return this.devConnection.client;
  }

  getProdDatabase(options?: { agentRequest?: boolean; userId?: number }): PostgresJsDatabase<typeof schema> {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      throw new Error('Production database only available in production environment.');
    }
    
    if (!this.prodConnection) {
      throw new Error('Production database not initialized.');
    }

    if (options?.agentRequest && this.agentBlockedFromProd) {
      logger.error(`Agent attempted to access production database (userId: ${options.userId})`);
      throw new Error('SECURITY: Agent is not allowed to access production database directly');
    }

    return this.prodConnection.db;
  }

  getProdClient(options?: { agentRequest?: boolean; userId?: number }): postgres.Sql {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      throw new Error('Production database only available in production environment.');
    }
    
    if (!this.prodConnection) {
      throw new Error('Production database not initialized.');
    }

    if (options?.agentRequest && this.agentBlockedFromProd) {
      logger.error(`Agent attempted to access production database client (userId: ${options.userId})`);
      throw new Error('SECURITY: Agent is not allowed to access production database directly');
    }

    return this.prodConnection.client;
  }

  getDatabaseForContext(
    context: DatabaseEnvironment = 'development',
    options?: { agentRequest?: boolean; userId?: number }
  ): PostgresJsDatabase<typeof schema> {
    if (context === 'production') {
      return this.getProdDatabase(options);
    }
    return this.getDevDatabase();
  }

  getClientForContext(
    context: DatabaseEnvironment = 'development',
    options?: { agentRequest?: boolean; userId?: number }
  ): postgres.Sql {
    if (context === 'production') {
      return this.getProdClient(options);
    }
    return this.getDevClient();
  }

  setContext(context: DatabaseEnvironment): void {
    this.currentContext = context;
    logger.info(`Database context set to: ${context}`);
  }

  getCurrentContext(): DatabaseEnvironment {
    return this.currentContext;
  }

  setAgentProdAccess(allowed: boolean, adminUserId?: number): void {
    if (allowed) {
      logger.warn(`Agent production database access ENABLED by admin (userId: ${adminUserId})`);
    } else {
      logger.info(`Agent production database access DISABLED`);
    }
    this.agentBlockedFromProd = !allowed;
  }

  isAgentBlockedFromProd(): boolean {
    return this.agentBlockedFromProd;
  }

  isProdAvailable(): boolean {
    return process.env.NODE_ENV === 'production' && this.prodConnection !== null;
  }

  getConnectionStats(): {
    development: { available: boolean; environment: string };
    production: { available: boolean; environment: string };
    agentProdBlocked: boolean;
    currentContext: DatabaseEnvironment;
  } {
    return {
      development: {
        available: this.devConnection !== null,
        environment: 'development',
      },
      production: {
        available: this.prodConnection !== null,
        environment: 'production',
      },
      agentProdBlocked: this.agentBlockedFromProd,
      currentContext: this.currentContext,
    };
  }

  async closeConnections(): Promise<void> {
    if (this.devConnection) {
      await this.devConnection.client.end();
      logger.info('Development database connection closed');
    }
    if (this.prodConnection) {
      await this.prodConnection.client.end();
      logger.info('Production database connection closed');
    }
  }
}

export const databaseManager = new DatabaseManager();

declare global {
  namespace Express {
    interface Request {
      dbContext?: DatabaseEnvironment;
      isAgentRequest?: boolean;
    }
  }
}

export function databaseContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const contextHeader = req.headers['x-database-context'] as DatabaseEnvironment | undefined;
  const agentHeader = req.headers['x-agent-request'];
  const agentUserId = req.headers['x-agent-user-id'];

  req.dbContext = contextHeader || 'development';
  req.isAgentRequest = agentHeader === 'true';

  if (req.isAgentRequest && req.dbContext === 'production') {
    logger.warn(`Blocked agent request to production database (userId: ${agentUserId})`);
    res.status(403).json({
      error: 'SECURITY_VIOLATION',
      message: 'Agent requests cannot access production database',
    });
    return;
  }

  next();
}

export function getDatabase(req?: Request): PostgresJsDatabase<typeof schema> {
  if (req) {
    return databaseManager.getDatabaseForContext(req.dbContext, {
      agentRequest: req.isAgentRequest,
    });
  }
  return databaseManager.getDevDatabase();
}

export function getDatabaseClient(req?: Request): postgres.Sql {
  if (req) {
    return databaseManager.getClientForContext(req.dbContext, {
      agentRequest: req.isAgentRequest,
    });
  }
  return databaseManager.getDevClient();
}

export { DatabaseEnvironment, DatabaseConfig, DatabaseConnection };
