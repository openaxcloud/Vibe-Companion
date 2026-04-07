import { db } from '../db';
import { projects, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';
import * as fsSync from 'fs';
import * as pathModule from 'path';

// SQL identifier escaping to prevent SQL injection in DDL statements
function escapeIdentifier(str: string): string {
  // Only allow alphanumeric and underscores for identifiers
  const sanitized = str.replace(/[^a-zA-Z0-9_]/g, '');
  if (sanitized.length === 0) throw new Error('Invalid identifier');
  if (/^\d/.test(sanitized)) throw new Error('Identifier cannot start with digit');
  // Double-quote escape for PostgreSQL identifiers
  return `"${sanitized.replace(/"/g, '""')}"`;
}

// SQL string literal escaping for passwords
function escapeLiteral(str: string): string {
  // PostgreSQL dollar-quoting for safe string literals
  return `$$${str.replace(/\$/g, '\\$')}$$`;
}
const logger = {
  info: (message: string, ...args: any[]) => {},
  error: (message: string, ...args: any[]) => console.error(`[real-database-management] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[real-database-management] WARN: ${message}`, ...args),
};

interface DatabaseConfig {
  id: number;
  projectId: number;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb';
  status: 'running' | 'stopped' | 'provisioning' | 'error';
  region: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  connectionInfo: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    connectionString: string;
  };
  metrics?: {
    size: number;
    connections: number;
    cpu: number;
    memory: number;
  };
}

// In-memory storage for database configurations (in production, this would be in the database)
const databaseConfigs = new Map<number, DatabaseConfig>();
const databasePools = new Map<number, Pool>();

export class RealDatabaseManagementService {
  private nextDbId = 1;

  constructor() {
    logger.info('Real Database Management Service initialized');
  }

  async createDatabase(projectId: number, config: {
    name: string;
    type: string;
    region: string;
    plan: string;
  }): Promise<DatabaseConfig> {
    logger.info(`Creating database for project ${projectId}`, config);

    // Generate secure credentials
    const dbId = this.nextDbId++;
    const username = `user_${crypto.randomBytes(8).toString('hex')}`;
    const password = crypto.randomBytes(32).toString('base64');
    const dbName = `db_${projectId}_${config.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    // In production, this would provision an actual database instance
    // For now, we'll create a new database in our existing PostgreSQL instance
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      // Create new database with proper escaping to prevent SQL injection
      const safeDbName = escapeIdentifier(dbName);
      const safeUsername = escapeIdentifier(username);
      const safePassword = escapeLiteral(password);
      
      await adminPool.query(`CREATE DATABASE ${safeDbName}`);
      
      // Create user with permissions using safe escaping
      await adminPool.query(`CREATE USER ${safeUsername} WITH PASSWORD ${safePassword}`);
      await adminPool.query(`GRANT ALL PRIVILEGES ON DATABASE ${safeDbName} TO ${safeUsername}`);
      
      const host = process.env.PGHOST || 'localhost';
      const port = parseInt(process.env.PGPORT || '5432');
      
      const databaseConfig: DatabaseConfig = {
        id: dbId,
        projectId,
        name: config.name,
        type: 'postgresql',
        status: 'running',
        region: config.region,
        plan: config.plan as any,
        createdAt: new Date(),
        connectionInfo: {
          host,
          port,
          database: dbName,
          username,
          password,
          connectionString: `postgresql://${username}:${password}@${host}:${port}/${dbName}`,
        },
        metrics: {
          size: 0,
          connections: 0,
          cpu: 0,
          memory: 0,
        },
      };

      // Store configuration
      databaseConfigs.set(dbId, databaseConfig);
      
      // Create connection pool for this database
      const dbPool = new Pool({
        host,
        port,
        database: dbName,
        user: username,
        password,
        max: 20,
      });
      
      databasePools.set(dbId, dbPool);
      
      logger.info(`Database created successfully: ${dbName}`);
      return databaseConfig;
    } catch (error) {
      logger.error('Failed to create database:', error);
      throw new Error('Failed to create database');
    } finally {
      await adminPool.end();
    }
  }

  async getDatabasesByProject(projectId: number): Promise<DatabaseConfig[]> {
    const databases: DatabaseConfig[] = [];
    
    for (const [id, config] of Array.from(databaseConfigs.entries())) {
      if (config.projectId === projectId) {
        // Update metrics
        const pool = databasePools.get(id);
        if (pool) {
          try {
            const sizeResult = await pool.query(`
              SELECT pg_database_size(current_database()) as size,
                     numbackends as connections
              FROM pg_stat_database
              WHERE datname = current_database()
            `);
            
            if (sizeResult.rows[0]) {
              const cpus = os.cpus();
              const cpuUsage = cpus.length > 0
                ? cpus.reduce((acc, cpu) => {
                    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
                    const idle = cpu.times.idle;
                    return acc + ((total - idle) / total) * 100;
                  }, 0) / cpus.length
                : 0;
              const memUsage = process.memoryUsage();
              const totalMem = os.totalmem();
              const memoryPercent = totalMem > 0 ? (memUsage.rss / totalMem) * 100 : 0;

              config.metrics = {
                size: parseInt(sizeResult.rows[0].size) / (1024 * 1024),
                connections: parseInt(sizeResult.rows[0].connections),
                cpu: Math.round(cpuUsage * 100) / 100,
                memory: Math.round(memoryPercent * 100) / 100,
              };
            }
          } catch (error) {
            logger.warn(`Failed to get metrics for database ${id}:`, error);
          }
        }
        
        databases.push(config);
      }
    }
    
    return databases;
  }

  async getDatabase(databaseId: number): Promise<DatabaseConfig | null> {
    return databaseConfigs.get(databaseId) || null;
  }

  async getTables(databaseId: number): Promise<any[]> {
    const pool = databasePools.get(databaseId);
    if (!pool) {
      throw new Error('Database not found');
    }

    try {
      const result = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY tablename
      `);

      const indexResult = await pool.query(`
        SELECT tablename, COUNT(*) as index_count
        FROM pg_indexes
        WHERE schemaname = 'public'
        GROUP BY tablename
      `);

      const indexMap = new Map(
        indexResult.rows.map(row => [row.tablename, parseInt(row.index_count)])
      );

      return result.rows.map(row => ({
        name: row.tablename,
        schema: row.schemaname,
        rowCount: parseInt(row.row_count),
        size: row.size,
        indexes: indexMap.get(row.tablename) || 0,
      }));
    } catch (error) {
      logger.error('Failed to get tables:', error);
      throw new Error('Failed to get tables');
    }
  }

  async executeQuery(databaseId: number, query: string): Promise<any> {
    const pool = databasePools.get(databaseId);
    if (!pool) {
      throw new Error('Database not found');
    }

    const startTime = Date.now();
    
    try {
      // Safety check - only allow SELECT queries for now
      const normalizedQuery = query.trim().toUpperCase();
      if (!normalizedQuery.startsWith('SELECT') && 
          !normalizedQuery.startsWith('SHOW') && 
          !normalizedQuery.startsWith('DESCRIBE')) {
        throw new Error('Only SELECT queries are allowed in the query editor');
      }

      const result = await pool.query(query);
      const executionTime = Date.now() - startTime;

      return {
        columns: result.fields.map(field => field.name),
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime,
      };
    } catch (error: any) {
      logger.error('Query execution failed:', error);
      throw new Error(error.message || 'Query execution failed');
    }
  }

  async createBackup(databaseId: number): Promise<string> {
    const config = databaseConfigs.get(databaseId);
    if (!config) {
      throw new Error('Database not found');
    }

    const backupId = `backup_${Date.now()}`;
    const backupDir = pathModule.join(process.cwd(), 'database-backups', String(databaseId));
    const backupFile = pathModule.join(backupDir, `${backupId}.sql`);

    logger.info(`Creating backup ${backupId} for database ${databaseId}`);

    try {
      fsSync.mkdirSync(backupDir, { recursive: true });

      const { host, port, database, username, password } = config.connectionInfo;
      const env = {
        ...process.env,
        PGPASSWORD: password,
      };

      try {
        execSync(
          `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --no-owner --no-acl -f "${backupFile}"`,
          { env, encoding: 'utf8', timeout: 120000 }
        );
      } catch (pgDumpErr: any) {
        logger.warn(`pg_dump not available or failed, falling back to SQL export: ${pgDumpErr.message}`);
        const pool = databasePools.get(databaseId);
        if (!pool) {
          throw new Error('Database pool not found and pg_dump unavailable');
        }

        const tablesResult = await pool.query(`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        `);
        let sqlDump = `-- Backup ${backupId} created at ${new Date().toISOString()}\n`;
        sqlDump += `-- Database: ${database}\n\n`;

        for (const row of tablesResult.rows) {
          const tableName = row.tablename;
          const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);
          sqlDump += `-- Table: ${tableName} (${dataResult.rowCount} rows)\n`;
          if (dataResult.rows.length > 0) {
            const columns = Object.keys(dataResult.rows[0]);
            for (const dataRow of dataResult.rows) {
              const values = columns.map(col => {
                const val = dataRow[col];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return String(val);
                return `'${String(val).replace(/'/g, "''")}'`;
              });
              sqlDump += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
            }
          }
          sqlDump += '\n';
        }

        fsSync.writeFileSync(backupFile, sqlDump, 'utf8');
      }

      const stats = fsSync.statSync(backupFile);
      logger.info(`Backup ${backupId} created successfully (${stats.size} bytes)`);
      return backupId;
    } catch (error: any) {
      logger.error(`Failed to create backup for database ${databaseId}:`, error);
      try { fsSync.unlinkSync(backupFile); } catch (err: any) { console.error("[catch]", err?.message || err);}
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  async restoreBackup(databaseId: number, backupId: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(backupId)) {
      throw new Error(`Invalid backup ID: ${backupId}`);
    }
    const config = databaseConfigs.get(databaseId);
    if (!config) {
      throw new Error('Database not found');
    }

    const backupDir = pathModule.join(process.cwd(), 'database-backups', String(databaseId));
    const backupFile = pathModule.join(backupDir, `${backupId}.sql`);

    if (!fsSync.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupId}`);
    }

    logger.info(`Restoring backup ${backupId} for database ${databaseId}`);

    try {
      const { host, port, database, username, password } = config.connectionInfo;
      const env = {
        ...process.env,
        PGPASSWORD: password,
      };

      try {
        execSync(
          `psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${backupFile}"`,
          { env, encoding: 'utf8', timeout: 120000 }
        );
      } catch (psqlErr: any) {
        logger.warn(`psql not available, falling back to pool-based restore: ${psqlErr.message}`);
        const pool = databasePools.get(databaseId);
        if (!pool) {
          throw new Error('Database pool not found and psql unavailable');
        }

        const sqlContent = fsSync.readFileSync(backupFile, 'utf8');
        const statements = sqlContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          try {
            await pool.query(statement);
          } catch (stmtErr: any) {
            logger.warn(`Restore statement failed (continuing): ${stmtErr.message}`);
          }
        }
      }

      logger.info(`Backup ${backupId} restored successfully for database ${databaseId}`);
    } catch (error: any) {
      logger.error(`Failed to restore backup for database ${databaseId}:`, error);
      throw new Error(`Backup restore failed: ${error.message}`);
    }
  }

  async deleteDatabase(databaseId: number): Promise<void> {
    const config = databaseConfigs.get(databaseId);
    if (!config) {
      throw new Error('Database not found');
    }

    const pool = databasePools.get(databaseId);
    if (pool) {
      await pool.end();
      databasePools.delete(databaseId);
    }

    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      // Drop the database and user
      await adminPool.query(`DROP DATABASE IF EXISTS ${config.connectionInfo.database}`);
      await adminPool.query(`DROP USER IF EXISTS ${config.connectionInfo.username}`);
      
      databaseConfigs.delete(databaseId);
      logger.info(`Database ${databaseId} deleted successfully`);
    } catch (error) {
      logger.error('Failed to delete database:', error);
      throw new Error('Failed to delete database');
    } finally {
      await adminPool.end();
    }
  }

  async updateDatabaseStatus(databaseId: number, status: DatabaseConfig['status']): Promise<void> {
    const config = databaseConfigs.get(databaseId);
    if (config) {
      config.status = status;
    }
  }
}

export const realDatabaseManagementService = new RealDatabaseManagementService();