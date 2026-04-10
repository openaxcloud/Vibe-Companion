import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('database-management');

export interface TableInfo {
  tableName: string;
  schema: string;
  rowCount: number;
  sizeInBytes: number;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  lastModified?: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export class DatabaseManagementService {
  async getTables(): Promise<TableInfo[]> {
    try {
      // Get all tables in the database using postgres-js syntax
      const tablesQuery = await pool`
        SELECT 
          schemaname,
          tablename,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
          n_live_tup as row_count
        FROM pg_tables
        LEFT JOIN pg_stat_user_tables 
          ON pg_tables.tablename = pg_stat_user_tables.relname
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tablename
      `;

      const tables: TableInfo[] = [];

      for (const table of tablesQuery) {
        // Get column information using postgres-js syntax
        const columnsQuery = await pool`
          SELECT
            columns.column_name,
            columns.data_type,
            columns.is_nullable,
            columns.column_default,
            CASE
              WHEN pk.column_name IS NOT NULL THEN true
              ELSE false
            END as is_primary_key
          FROM information_schema.columns columns
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = ${table.tablename}
          ) pk ON columns.column_name = pk.column_name
          WHERE table_schema = ${table.schemaname} AND table_name = ${table.tablename}
          ORDER BY ordinal_position
        `;

        // Get index information
        const indexesQuery = await pool`
          SELECT 
            indexname as name,
            indexdef,
            CASE 
              WHEN indexdef LIKE '%UNIQUE%' THEN true 
              ELSE false 
            END as is_unique,
            CASE 
              WHEN indexname LIKE '%_pkey' THEN true 
              ELSE false 
            END as is_primary
          FROM pg_indexes
          WHERE schemaname = ${table.schemaname} AND tablename = ${table.tablename}
        `;

        tables.push({
          tableName: table.tablename,
          schema: table.schemaname,
          rowCount: parseInt(table.row_count) || 0,
          sizeInBytes: parseInt(table.size_bytes) || 0,
          columns: columnsQuery.map((col: any) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            defaultValue: col.column_default,
            isPrimaryKey: col.is_primary_key
          })),
          indexes: indexesQuery.map((idx: any) => ({
            name: idx.name,
            columns: this.extractColumnsFromIndexDef(idx.indexdef),
            isUnique: idx.is_unique,
            isPrimary: idx.is_primary
          }))
        });
      }

      logger.info(`Retrieved information for ${tables.length} tables`);
      return tables;
    } catch (error) {
      logger.error('Error getting tables:', error);
      throw error;
    }
  }

  async getTableSchema(tableName: string, schema: string = 'public'): Promise<ColumnInfo[]> {
    try {
      const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!tableNameRegex.test(tableName)) {
        throw new Error('Invalid table name');
      }

      const columnsQuery = await pool`
        SELECT
          columns.column_name,
          columns.data_type,
          columns.is_nullable,
          columns.column_default,
          CASE
            WHEN pk.column_name IS NOT NULL THEN true
            ELSE false
          END as is_primary_key
        FROM information_schema.columns columns
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = ${tableName}
            AND tc.table_schema = ${schema}
        ) pk ON columns.column_name = pk.column_name
        WHERE columns.table_schema = ${schema} AND columns.table_name = ${tableName}
        ORDER BY columns.ordinal_position
      `;

      return columnsQuery.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        isPrimaryKey: col.is_primary_key,
      }));
    } catch (error) {
      logger.error('Error getting table schema:', error);
      throw error;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Validate query (basic safety check)
      const lowerQuery = query.toLowerCase().trim();
      const dangerousKeywords = ['drop', 'truncate', 'delete', 'alter', 'grant', 'revoke'];
      
      for (const keyword of dangerousKeywords) {
        if (lowerQuery.startsWith(keyword)) {
          return {
            rows: [],
            rowCount: 0,
            executionTime: 0,
            error: `Dangerous operation '${keyword}' is not allowed`
          };
        }
      }

      // FIXED: Use postgres-js unsafe query for dynamic SQL
      const result = await pool.unsafe(query);
      const executionTime = Date.now() - startTime;

      // Handle both SELECT (returns array) and DML (returns count) results
      return {
        rows: Array.isArray(result) ? result : [],
        rowCount: typeof (result as any).count === 'number' 
          ? (result as any).count  // INSERT/UPDATE/DELETE affected rows
          : Array.isArray(result) ? result.length : 0,  // SELECT result count
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution error:', error);
      
      return {
        rows: [],
        rowCount: 0,
        executionTime,
        error: error.message
      };
    }
  }

  async getTableData(tableName: string, limit: number = 100, offset: number = 0): Promise<QueryResult> {
    try {
      // SECURITY: Validate table name to prevent SQL injection
      const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!tableNameRegex.test(tableName)) {
        throw new Error('Invalid table name format');
      }

      // SECURITY: Validate limit and offset are positive integers
      const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const safeOffset = Math.max(0, Math.floor(offset));

      // FIXED: Use postgres-js template literal syntax with validated table name
      const startTime = Date.now();
      const result = await pool.unsafe(`SELECT * FROM ${tableName} LIMIT ${safeLimit} OFFSET ${safeOffset}`);
      const executionTime = Date.now() - startTime;

      return {
        rows: Array.isArray(result) ? result : [],
        rowCount: Array.isArray(result) ? result.length : 0,
        executionTime
      };
    } catch (error) {
      logger.error('Error getting table data:', error);
      throw error;
    }
  }

  async createBackup(description?: string): Promise<{ id: string; timestamp: Date; size: number }> {
    try {
      const timestamp = new Date();
      const backupId = `backup_${timestamp.getTime()}`;
      
      // In a real implementation, this would create an actual database backup
      // For now, we'll simulate it by getting database statistics
      const sizeQuery = await pool`
        SELECT pg_database_size(current_database()) as size
      `;
      
      const size = parseInt(sizeQuery[0]?.size) || 0;
      
      logger.info(`Created backup ${backupId} with size ${size} bytes`);
      
      return {
        id: backupId,
        timestamp,
        size
      };
    } catch (error) {
      logger.error('Error creating backup:', error);
      throw error;
    }
  }

  async getDatabaseStats(): Promise<{
    totalSize: number;
    tableCount: number;
    connectionCount: number;
    uptime: number;
  }> {
    try {
      const [sizeResult, tableCountResult, connectionResult, uptimeResult] = await Promise.all([
        pool`SELECT pg_database_size(current_database()) as size`,
        pool`SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
        pool`SELECT count(*) FROM pg_stat_activity`,
        pool`SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime`
      ]);

      return {
        totalSize: parseInt(sizeResult[0]?.size) || 0,
        tableCount: parseInt(tableCountResult[0]?.count) || 0,
        connectionCount: parseInt(connectionResult[0]?.count) || 0,
        uptime: parseInt(uptimeResult[0]?.uptime) || 0
      };
    } catch (error) {
      logger.error('Error getting database stats:', error);
      throw error;
    }
  }

  private extractColumnsFromIndexDef(indexDef: string): string[] {
    // Extract column names from index definition
    // Example: "CREATE INDEX idx_name ON table_name (col1, col2)"
    const match = indexDef.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim());
    }
    return [];
  }
}

// Export singleton instance
export const databaseManagementService = new DatabaseManagementService();