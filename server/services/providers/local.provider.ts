import { 
  IDatabaseProvider, 
  DatabaseProvider, 
  ProvisioningOptions, 
  ProvisionedDatabase,
  DatabaseCredentials,
  DatabaseMetrics,
  BackupOptions,
  BackupInfo,
  PLAN_LIMITS,
  PlanType
} from './database-provider.interface';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import * as fsSync from 'fs';
import * as pathModule from 'path';

const logger = createLogger('LocalProvider');

function extractRows(result: unknown): Record<string, unknown>[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === 'object' && 'rows' in result) {
    return (result as { rows: Record<string, unknown>[] }).rows || [];
  }
  return [];
}

export class LocalProvider implements IDatabaseProvider {
  readonly name: DatabaseProvider = 'local';
  
  private generatePassword(length: number = 24): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.randomBytes(length))
      .map(byte => chars[byte % chars.length])
      .join('');
  }

  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  private escapeIdentifier(identifier: string): string {
    const sanitized = this.sanitizeIdentifier(identifier);
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  
  private escapePassword(password: string): string {
    return password.replace(/'/g, "''");
  }
  
  async provision(
    projectId: number,
    options: ProvisioningOptions
  ): Promise<ProvisionedDatabase> {
    const plan = (options.plan || 'free') as PlanType;
    const planLimits = PLAN_LIMITS[plan];
    
    const connectionUrl = process.env.DATABASE_URL || '';
    
    let host = process.env.PGHOST || 'localhost';
    let port = parseInt(process.env.PGPORT || '5432');
    let database = process.env.PGDATABASE || 'neondb';
    
    if (connectionUrl) {
      try {
        const url = new URL(connectionUrl);
        host = url.hostname;
        port = parseInt(url.port) || 5432;
        database = url.pathname.replace('/', '') || database;
      } catch (e) {
        logger.warn('Failed to parse DATABASE_URL, using individual env vars');
      }
    }
    
    const schemaName = this.sanitizeIdentifier(`proj_${projectId}`);
    const roleName = this.sanitizeIdentifier(`proj_user_${projectId}`);
    const rolePassword = this.generatePassword();
    
    const escapedSchema = this.escapeIdentifier(schemaName);
    const escapedRole = this.escapeIdentifier(roleName);
    const escapedPassword = this.escapePassword(rolePassword);
    
    logger.info(`Provisioning schema-based database for project ${projectId}`, { 
      plan, 
      mode: 'schema-isolation',
      schema: schemaName,
      role: roleName
    });
    
    try {
      const checkRoleResult = await db.execute(sql`
        SELECT 1 FROM pg_roles WHERE rolname = ${roleName}
      `);
      const roleExists = extractRows(checkRoleResult).length > 0;
      
      if (!roleExists) {
        await db.execute(sql.raw(`CREATE ROLE ${escapedRole} WITH LOGIN PASSWORD '${escapedPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`));
        logger.info(`Created role: ${roleName}`);
      } else {
        await db.execute(sql.raw(`ALTER ROLE ${escapedRole} WITH PASSWORD '${escapedPassword}'`));
        logger.info(`Updated password for existing role: ${roleName}`);
      }
      
      const checkSchemaResult = await db.execute(sql`
        SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schemaName}
      `);
      const schemaExists = extractRows(checkSchemaResult).length > 0;
      
      if (!schemaExists) {
        await db.execute(sql.raw(`CREATE SCHEMA ${escapedSchema} AUTHORIZATION ${escapedRole}`));
        logger.info(`Created schema: ${schemaName}`);
      } else {
        await db.execute(sql.raw(`ALTER SCHEMA ${escapedSchema} OWNER TO ${escapedRole}`));
        logger.info(`Updated schema ownership: ${schemaName}`);
      }
      
      let publicRevokedGlobally = false;
      try {
        await db.execute(sql.raw(`REVOKE ALL ON SCHEMA public FROM PUBLIC`));
        await db.execute(sql.raw(`REVOKE USAGE ON SCHEMA public FROM PUBLIC`));
        await db.execute(sql.raw(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`));
        publicRevokedGlobally = true;
        logger.info(`Revoked PUBLIC privileges on public schema (global revocation)`);
      } catch (revokeErr: any) {
        logger.warn(`Could not revoke PUBLIC privileges globally (requires schema owner): ${revokeErr.message}`);
      }
      
      try {
        await db.execute(sql.raw(`REVOKE ALL ON SCHEMA public FROM ${escapedRole}`));
        await db.execute(sql.raw(`REVOKE USAGE ON SCHEMA public FROM ${escapedRole}`));
        await db.execute(sql.raw(`REVOKE CREATE ON SCHEMA public FROM ${escapedRole}`));
        logger.info(`Revoked public schema access from role: ${roleName}`);
      } catch (roleRevokeErr: any) {
        logger.warn(`Could not revoke public schema access from role: ${roleRevokeErr.message}`);
      }
      
      if (!publicRevokedGlobally) {
        logger.warn(`SECURITY: Per-project isolation may be incomplete - PUBLIC privileges on public schema could not be globally revoked. In production, ensure the provisioning service role owns the public schema or use separate databases per project.`);
      }
      
      await db.execute(sql.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${escapedRole}`));
      await db.execute(sql.raw(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${escapedRole}`));
      await db.execute(sql.raw(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${escapedRole}`));
      
      const escapedDatabase = this.escapeIdentifier(database);
      try {
        await db.execute(sql.raw(`GRANT CONNECT ON DATABASE ${escapedDatabase} TO ${escapedRole}`));
      } catch (grantErr: any) {
        logger.warn(`Could not grant CONNECT on database (may require superuser): ${grantErr.message}`);
      }
      await db.execute(sql.raw(`GRANT USAGE, CREATE ON SCHEMA ${escapedSchema} TO ${escapedRole}`));
      await db.execute(sql.raw(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${escapedSchema} TO ${escapedRole}`));
      await db.execute(sql.raw(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${escapedSchema} TO ${escapedRole}`));
      await db.execute(sql.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${escapedSchema} GRANT ALL ON TABLES TO ${escapedRole}`));
      await db.execute(sql.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${escapedSchema} GRANT ALL ON SEQUENCES TO ${escapedRole}`));
      
      await db.execute(sql.raw(`ALTER ROLE ${escapedRole} SET search_path TO ${escapedSchema}`));
      
      logger.info(`Successfully provisioned schema for project ${projectId}`, {
        schema: schemaName,
        role: roleName,
        plan,
        storageLimitMb: planLimits.storageMb,
        maxConnections: planLimits.maxConnections
      });
      
    } catch (error: any) {
      logger.error(`Failed to provision schema for project ${projectId}`, { 
        error: error.message,
        schema: schemaName
      });
      throw new Error(`Database provisioning failed: ${error.message}`);
    }
    
    const projectConnectionUrl = `postgresql://${encodeURIComponent(roleName)}:${encodeURIComponent(rolePassword)}@${host}:${port}/${database}?sslmode=require`;
    
    return {
      projectId: String(projectId),
      host,
      port,
      database,
      username: roleName,
      password: rolePassword,
      connectionUrl: projectConnectionUrl,
      metadata: {
        provider: 'local',
        plan,
        mode: 'schema-isolation',
        schema: schemaName,
        storageLimitMb: planLimits.storageMb,
        maxConnections: planLimits.maxConnections
      }
    };
  }
  
  async deprovision(databaseId: number): Promise<void> {
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    const roleName = this.sanitizeIdentifier(`proj_user_${databaseId}`);
    
    const escapedSchema = this.escapeIdentifier(schemaName);
    const escapedRole = this.escapeIdentifier(roleName);
    
    logger.info(`Deprovisioning schema for project ${databaseId}`, { schema: schemaName, role: roleName });
    
    try {
      await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${escapedSchema} CASCADE`));
      logger.info(`Dropped schema: ${schemaName}`);
      
      await db.execute(sql.raw(`DROP ROLE IF EXISTS ${escapedRole}`));
      logger.info(`Dropped role: ${roleName}`);
      
    } catch (error: any) {
      logger.error(`Failed to deprovision schema for project ${databaseId}`, { 
        error: error.message 
      });
      throw new Error(`Database deprovisioning failed: ${error.message}`);
    }
  }
  
  async suspend(databaseId: number): Promise<void> {
    const roleName = this.sanitizeIdentifier(`proj_user_${databaseId}`);
    const escapedRole = this.escapeIdentifier(roleName);
    
    logger.info(`Suspending database access for project ${databaseId}`);
    
    try {
      await db.execute(sql.raw(`ALTER ROLE ${escapedRole} NOLOGIN`));
      logger.info(`Suspended role: ${roleName}`);
    } catch (error: any) {
      logger.warn(`Failed to suspend role ${roleName}`, { error: error.message });
    }
  }
  
  async resume(databaseId: number): Promise<void> {
    const roleName = this.sanitizeIdentifier(`proj_user_${databaseId}`);
    const escapedRole = this.escapeIdentifier(roleName);
    
    logger.info(`Resuming database access for project ${databaseId}`);
    
    try {
      await db.execute(sql.raw(`ALTER ROLE ${escapedRole} LOGIN`));
      logger.info(`Resumed role: ${roleName}`);
    } catch (error: any) {
      logger.warn(`Failed to resume role ${roleName}`, { error: error.message });
    }
  }
  
  async rotateCredentials(databaseId: number): Promise<DatabaseCredentials> {
    const connectionUrl = process.env.DATABASE_URL || '';
    
    let host = process.env.PGHOST || 'localhost';
    let port = parseInt(process.env.PGPORT || '5432');
    let database = process.env.PGDATABASE || 'neondb';
    
    if (connectionUrl) {
      try {
        const url = new URL(connectionUrl);
        host = url.hostname;
        port = parseInt(url.port) || 5432;
        database = url.pathname.replace('/', '') || database;
      } catch (e) {
        logger.warn('Failed to parse DATABASE_URL for credential rotation');
      }
    }
    
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    const roleName = this.sanitizeIdentifier(`proj_user_${databaseId}`);
    const newPassword = this.generatePassword();
    
    const escapedRole = this.escapeIdentifier(roleName);
    const escapedPassword = this.escapePassword(newPassword);
    
    logger.info(`Rotating credentials for project ${databaseId}`);
    
    try {
      await db.execute(sql.raw(`ALTER ROLE ${escapedRole} WITH PASSWORD '${escapedPassword}'`));
      logger.info(`Rotated credentials for role: ${roleName}`);
    } catch (error: any) {
      logger.error(`Failed to rotate credentials for project ${databaseId}`, { error: error.message });
      throw new Error(`Credential rotation failed: ${error.message}`);
    }
    
    const projectConnectionUrl = `postgresql://${encodeURIComponent(roleName)}:${encodeURIComponent(newPassword)}@${host}:${port}/${database}?sslmode=require`;
    
    return {
      host,
      port,
      database,
      username: roleName,
      password: newPassword,
      connectionUrl: projectConnectionUrl,
      sslEnabled: true
    };
  }
  
  async getMetrics(databaseId: number): Promise<DatabaseMetrics> {
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    const roleName = this.sanitizeIdentifier(`proj_user_${databaseId}`);
    const database = process.env.PGDATABASE || 'neondb';
    
    logger.info(`Getting metrics for project ${databaseId}`, { schema: schemaName });
    
    try {
      const sizeRows = extractRows(await db.execute(sql`
        SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) as size_bytes
        FROM pg_tables 
        WHERE schemaname = ${schemaName}
      `));
      const storageUsedBytes = parseInt((sizeRows[0]?.size_bytes as string) || '0');
      
      const connRows = extractRows(await db.execute(sql`
        SELECT count(*) as conn_count 
        FROM pg_stat_activity 
        WHERE datname = ${database} AND usename = ${roleName}
      `));
      const connectionCount = parseInt((connRows[0]?.conn_count as string) || '0');
      
      const queryRows = extractRows(await db.execute(sql`
        SELECT count(*) as active_count 
        FROM pg_stat_activity 
        WHERE datname = ${database} AND usename = ${roleName} AND state = 'active'
      `));
      const activeQueries = parseInt((queryRows[0]?.active_count as string) || '0');
      
      return {
        storageUsedMb: storageUsedBytes / (1024 * 1024),
        connectionCount,
        activeQueries
      };
    } catch (error: any) {
      logger.warn(`Failed to get metrics for project ${databaseId}`, { error: error.message });
      return {
        storageUsedMb: 0,
        connectionCount: 0,
        activeQueries: 0
      };
    }
  }
  
  async createBackup(databaseId: number, options?: BackupOptions): Promise<BackupInfo> {
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    const backupName = options?.name || `backup-${Date.now()}`;
    const backupId = `local-${databaseId}-${Date.now()}`;
    const backupDir = pathModule.join(process.cwd(), 'database-backups', 'local', String(databaseId));
    const backupFile = pathModule.join(backupDir, `${backupId}.sql`);
    
    logger.info(`Creating backup for project ${databaseId}`, { name: backupName, schema: schemaName });
    
    try {
      fsSync.mkdirSync(backupDir, { recursive: true });

      const tableRows = extractRows(await db.execute(sql`
        SELECT tablename FROM pg_tables WHERE schemaname = ${schemaName}
      `));

      let sqlDump = `-- Backup ${backupId} for schema ${schemaName}\n`;
      sqlDump += `-- Created at ${new Date().toISOString()}\n`;
      sqlDump += `-- Name: ${backupName}\n\n`;
      sqlDump += `SET search_path TO ${this.escapeIdentifier(schemaName)};\n\n`;

      for (const row of tableRows) {
        const tableName = row.tablename as string;
        const escapedTable = this.escapeIdentifier(tableName);
        const fullTable = `${this.escapeIdentifier(schemaName)}.${escapedTable}`;

        sqlDump += `-- Table: ${tableName}\n`;

        const dataRows = extractRows(await db.execute(sql.raw(`SELECT * FROM ${fullTable}`)));
        if (dataRows.length > 0) {
          const columns = Object.keys(dataRows[0]);
          for (const dataRow of dataRows) {
            const values = columns.map(col => {
              const val = dataRow[col];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return String(val);
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (val instanceof Date) return `'${val.toISOString()}'`;
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            sqlDump += `INSERT INTO ${escapedTable} (${columns.map(c => this.escapeIdentifier(c)).join(', ')}) VALUES (${values.join(', ')});\n`;
          }
        }
        sqlDump += '\n';
      }

      fsSync.writeFileSync(backupFile, sqlDump, 'utf8');
      const stats = fsSync.statSync(backupFile);
      
      logger.info(`Backup ${backupId} created successfully (${stats.size} bytes)`);

      return {
        id: backupId,
        name: backupName,
        status: 'completed',
        sizeBytes: stats.size,
        createdAt: new Date()
      };
    } catch (error: any) {
      logger.error(`Failed to create backup for project ${databaseId}`, { error: error.message });
      try { fsSync.unlinkSync(backupFile); } catch {}
      return {
        id: backupId,
        name: backupName,
        status: 'failed',
        sizeBytes: 0,
        createdAt: new Date()
      };
    }
  }
  
  async listBackups(databaseId: number): Promise<BackupInfo[]> {
    const backupDir = pathModule.join(process.cwd(), 'database-backups', 'local', String(databaseId));
    logger.info(`Listing backups for project ${databaseId}`);

    try {
      if (!fsSync.existsSync(backupDir)) return [];
      const files = fsSync.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
      return files.map(file => {
        const filePath = pathModule.join(backupDir, file);
        const stats = fsSync.statSync(filePath);
        const backupId = file.replace('.sql', '');
        return {
          id: backupId,
          name: backupId,
          status: 'completed' as const,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
        };
      });
    } catch (error: any) {
      logger.warn(`Failed to list backups for project ${databaseId}`, { error: error.message });
      return [];
    }
  }
  
  private validateBackupId(backupId: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(backupId)) {
      throw new Error(`Invalid backup ID: ${backupId}`);
    }
  }

  async restoreBackup(databaseId: number, backupId: string): Promise<void> {
    this.validateBackupId(backupId);
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    const backupDir = pathModule.join(process.cwd(), 'database-backups', 'local', String(databaseId));
    const backupFile = pathModule.join(backupDir, `${backupId}.sql`);

    if (!fsSync.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupId}`);
    }

    logger.info(`Restoring backup ${backupId} for project ${databaseId}`, { schema: schemaName });

    try {
      const sqlContent = fsSync.readFileSync(backupFile, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      await db.execute(sql.raw(`SET search_path TO ${this.escapeIdentifier(schemaName)}`));

      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
        } catch (stmtErr: any) {
          logger.warn(`Restore statement failed (continuing): ${stmtErr.message}`);
        }
      }

      await db.execute(sql`SET search_path TO public`);
      logger.info(`Backup ${backupId} restored successfully for project ${databaseId}`);
    } catch (error: any) {
      await db.execute(sql`SET search_path TO public`).catch(() => {});
      logger.error(`Failed to restore backup for project ${databaseId}`, { error: error.message });
      throw new Error(`Backup restore failed: ${error.message}`);
    }
  }
  
  async deleteBackup(databaseId: number, backupId: string): Promise<void> {
    this.validateBackupId(backupId);
    const backupDir = pathModule.join(process.cwd(), 'database-backups', 'local', String(databaseId));
    const backupFile = pathModule.join(backupDir, `${backupId}.sql`);
    logger.info(`Deleting backup ${backupId} for project ${databaseId}`);

    try {
      if (fsSync.existsSync(backupFile)) {
        fsSync.unlinkSync(backupFile);
        logger.info(`Backup ${backupId} deleted for project ${databaseId}`);
      } else {
        throw new Error(`Backup file not found: ${backupId}`);
      }
    } catch (error: any) {
      logger.error(`Failed to delete backup ${backupId}`, { error: error.message });
      throw new Error(`Backup deletion failed: ${error.message}`);
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async executeQuery(databaseId: number, query: string, credentials: DatabaseCredentials): Promise<{
    rows: any[];
    rowCount: number;
    fields: Array<{ name: string; dataTypeID?: number }>;
  }> {
    const schemaName = this.sanitizeIdentifier(`proj_${databaseId}`);
    logger.info(`Executing SQL query for project ${databaseId}`, { schemaName });

    try {
      const setSchemaQuery = `SET search_path TO ${schemaName}, public`;
      await db.execute(sql.raw(setSchemaQuery));
      
      const result = await db.execute(sql.raw(query));
      const rows = extractRows(result);
      
      await db.execute(sql`SET search_path TO public`);
      
      return {
        rows: rows || [],
        rowCount: rows?.length || 0,
        fields: []
      };
    } catch (error: any) {
      await db.execute(sql`SET search_path TO public`);
      logger.error(`SQL execution failed for project ${databaseId}:`, error);
      throw new Error(error.message || 'Query execution failed');
    }
  }

  async pointInTimeRestore(databaseId: number, timestamp: string, timezone: string): Promise<void> {
    logger.info(`Point-in-time restore requested for project ${databaseId}`, { timestamp, timezone });
    logger.warn('PITR for local PostgreSQL requires WAL archiving - operation logged but simulated');
  }
}

export const localProvider = new LocalProvider();
