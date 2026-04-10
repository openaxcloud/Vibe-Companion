import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, pool } from '../db';
import * as schema from '@shared/schema';
import { ensureAdmin } from '../middleware/admin-auth';
import { eq, sql } from 'drizzle-orm';
import { projectDatabaseService } from '../services/project-database-provisioning.service';

const databaseRouter = Router();

/**
 * Admin Database API Router
 * 
 * ⚠️ ADMIN-ONLY ACCESS - System-wide database inspector
 * 
 * Security: Admin-only, read-only operations, full database access
 * Use Case: Database administration, system monitoring, troubleshooting
 * 
 * Note: Regular users should use /api/projects/:projectId/data for project-scoped data
 */

interface TableInfo {
  name: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
  }>;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

// Security: Strict table name validation to prevent SQL injection
// Only allows lowercase letters, numbers, and underscores, starting with letter or underscore
const SAFE_TABLE_NAME_REGEX = /^[a-z_][a-z0-9_]{0,62}$/i;

// Whitelist of allowed tables for data access
// Add new tables here when they are created in the schema
// Last updated: Dec 2025 - comprehensive list from shared/schema.ts
const ALLOWED_TABLES = new Set([
  // Core user/auth tables
  'users', 'sessions', 'revoked_tokens', 'email_verification_tokens', 'password_reset_tokens',
  
  // Projects & files
  'projects', 'files', 'environment_variables',
  
  // API & security
  'api_keys', 'api_usage', 'security_logs', 'rate_limit_violations',
  
  // Usage & billing
  'usage_events', 'usage_ledger', 'pay_as_you_go_queue', 'usage_tracking',
  'user_credits', 'budget_limits', 'usage_alerts',
  'ai_usage_metering', 'ai_stripe_usage_queue',
  
  // Newsletter & customer support
  'newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries', 'customer_requests',
  
  // Community & mentorship
  'mentor_profiles', 'mentorship_sessions', 'challenges', 'challenge_submissions', 'challenge_leaderboard',
  'community_categories', 'community_posts', 'community_post_likes', 'community_post_bookmarks',
  'community_comments', 'community_follows',
  
  // Mobile
  'mobile_devices', 'mobile_sessions', 'push_notifications', 'notification_preferences',
  
  // AI & knowledge
  'knowledge_graph_nodes', 'knowledge_graph_edges', 'conversation_memory',
  'ai_token_usage', 'ai_task_classifications', 'ai_provider_health', 'ai_request_queue',
  
  // Deployments
  'deployments', 'autoscale_deployments',
  
  // Teams
  'teams', 'team_members', 'invitations',
  
  // AI Agent system
  'ai_agent_sessions', 'ai_agent_conversations', 'ai_agent_steps',
  'agent_plans', 'agent_step_cache', 'agent_audit_trail', 'agent_permissions',
  'autonomous_actions', 'database_operations',
  'ai_approval_queue', 'ai_audit_logs',
  
  // Max Autonomy
  'max_autonomy_sessions', 'max_autonomy_tasks', 'autonomy_message_queue',
  
  // Bounties
  'bounties', 'bounty_submissions', 'bounty_reviews',
  
  // Permissions & roles
  'permissions', 'roles', 'user_roles',
  
  // Testing & builds
  'build_logs', 'terminal_logs', 'test_runs', 'test_cases',
  'browser_test_executions', 'test_artifacts', 'element_selectors', 'session_recordings',
  
  // Security scanning
  'security_scans', 'vulnerabilities', 'security_scan_settings',
  
  // IDE/Editor state
  'resource_metrics', 'pane_configurations', 'lsp_diagnostics',
  
  // Collaboration
  'collaboration_sessions', 'collaboration_cursors', 'collaboration_selections', 'collaboration_changes',
  
  // System
  'system_settings'
]);

function isValidTableName(name: string): boolean {
  return SAFE_TABLE_NAME_REGEX.test(name) && !name.includes('--') && !name.includes(';');
}

function isAllowedTable(name: string): boolean {
  return ALLOWED_TABLES.has(name.toLowerCase());
}

// Security: Escape identifier for safe use in SQL (double quotes escape)
function escapeIdentifier(identifier: string): string {
  // Replace any double quotes with two double quotes (SQL standard escape)
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * GET /api/admin/database/tables
 * Liste toutes les tables disponibles avec leurs métadonnées
 * ⚠️ ADMIN-ONLY
 */
databaseRouter.get('/tables', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Query PostgreSQL system tables to get all user tables (no user input - safe)
    const result = await pool.unsafe(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    // Get row counts for each table (expensive but necessary for UI)
    const tables: TableInfo[] = await Promise.all(
      result.map(async (table: any) => {
        try {
          const tableName = table.table_name;
          
          // Security: Validate table name from database result
          if (!isValidTableName(tableName)) {
            console.warn(`[Database API] Skipping invalid table name: ${tableName}`);
            return { name: tableName, rowCount: 0, columns: [] };
          }
          
          // Use parameterized query for columns (information_schema is safe)
          const columnsResult = await pool`
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_name = ${tableName}
            ORDER BY ordinal_position
          `;

          // For COUNT query, we must use identifier - validated above
          const safeTableName = escapeIdentifier(tableName);
          const countResult = await pool.unsafe(`SELECT COUNT(*) as count FROM ${safeTableName}`);

          return {
            name: tableName,
            rowCount: parseInt(countResult[0]?.count || '0', 10),
            columns: columnsResult.map((col: any) => ({
              name: col.column_name,
              type: col.data_type,
              nullable: col.is_nullable === 'YES',
              defaultValue: col.column_default
            }))
          };
        } catch (error) {
          console.error(`[Database API] Error getting table info for ${table.table_name}:`, error);
          return {
            name: table.table_name,
            rowCount: 0,
            columns: []
          };
        }
      })
    );

    const executionTime = Date.now() - startTime;

    return res.json({
      tables,
      executionTime,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Database API] List tables error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list tables' });
  }
});

/**
 * GET /api/admin/database/table/:tableName/schema
 * Retourne le schéma détaillé d'une table
 * ⚠️ ADMIN-ONLY
 */
databaseRouter.get('/table/:tableName/schema', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    // Security: Validate table name to prevent SQL injection
    if (!isValidTableName(tableName)) {
      return res.status(400).json({ error: 'Invalid table name format' });
    }

    // Use parameterized queries for all user-provided values
    const columnsResult = await pool`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        tc.constraint_type,
        kcu.constraint_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      WHERE c.table_name = ${tableName}
      ORDER BY c.ordinal_position
    `;

    const indexesResult = await pool`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = ${tableName}
    `;

    return res.json({
      tableName,
      columns: columnsResult.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        maxLength: col.character_maximum_length,
        constraint: col.constraint_type,
        isPrimaryKey: col.constraint_type === 'PRIMARY KEY',
        isForeignKey: col.constraint_type === 'FOREIGN KEY',
        isUnique: col.constraint_type === 'UNIQUE'
      })),
      indexes: indexesResult.map((idx: any) => ({
        name: idx.indexname,
        definition: idx.indexdef
      }))
    });
  } catch (error: any) {
    console.error('[Database API] Get table schema error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get table schema' });
  }
});

/**
 * POST /api/admin/database/query
 * ⚠️ DISABLED FOR SECURITY
 * 
 * Reason: User-supplied SQL queries cannot be safely executed without proper
 * SQL parser/sanitizer. Substring checks are insufficient and bypassable.
 * Example bypass: SELECT data; DROP TABLE users with comment delimiters.
 * 
 * Fortune 500 Security Requirements:
 * - No user-supplied raw SQL execution
 * - Use predefined safe operations only (GET /table/:name/data)
 * 
 * Future: Implement with:
 * - Proper SQL parser (e.g. pgsql-parser)
 * - Read-only database connection
 * - Project-scoped access control
 */
databaseRouter.post('/query', ensureAdmin, async (req: Request, res: Response) => {
  return res.status(501).json({ 
    error: 'Custom SQL queries disabled for security',
    message: 'Use GET /api/database/table/:tableName/data for safe data access',
    documentation: 'https://docs.e-code.ai/api/database'
  });
});

/**
 * GET /api/admin/database/table/:tableName/data
 * Retourne les données d'une table avec pagination
 * ⚠️ ADMIN-ONLY
 * 
 * Security: Uses parameterized queries and validated identifiers
 */
databaseRouter.get('/table/:tableName/data', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 100), 1000);
    const offset = (page - 1) * limit;

    // Security: Strict table name validation
    if (!isValidTableName(tableName)) {
      return res.status(400).json({ error: 'Invalid table name format' });
    }

    // Security: Whitelist check - only allow access to known application tables
    if (!isAllowedTable(tableName)) {
      return res.status(403).json({ 
        error: 'Access to this table is not permitted',
        message: 'Table is not in the allowed whitelist'
      });
    }

    const startTime = Date.now();
    const safeTableName = escapeIdentifier(tableName);

    // Get total count - table name validated and escaped
    const countResult = await pool.unsafe(`SELECT COUNT(*) as total FROM ${safeTableName}`);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Get first column name for ordering using parameterized query
    const firstColumnResult = await pool`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName} 
      ORDER BY ordinal_position 
      LIMIT 1
    `;
    
    // Get paginated data with safe ordering
    // Note: LIMIT and OFFSET are integers, validated above
    let rows;
    if (firstColumnResult.length > 0) {
      const orderColumn = escapeIdentifier(firstColumnResult[0].column_name);
      rows = await pool.unsafe(
        `SELECT * FROM ${safeTableName} ORDER BY ${orderColumn} LIMIT ${limit} OFFSET ${offset}`
      );
    } else {
      // Fallback: no ordering if no columns found
      rows = await pool.unsafe(
        `SELECT * FROM ${safeTableName} LIMIT ${limit} OFFSET ${offset}`
      );
    }

    const executionTime = Date.now() - startTime;

    return res.json({
      tableName,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: offset + limit < total,
        hasPrevPage: page > 1
      },
      executionTime
    });
  } catch (error: any) {
    console.error('[Database API] Get table data error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get table data' });
  }
});

/**
 * GET /api/admin/database/stats
 * Retourne les statistiques globales de la base de données
 * ⚠️ ADMIN-ONLY
 * 
 * Security: No user input in these queries - all from system catalog
 */
databaseRouter.get('/stats', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Get database size (no user input - safe)
    const sizeResult = await pool.unsafe(`
      SELECT pg_database_size(current_database()) as size
    `);

    // Get table count (no user input - safe)
    const tableCountResult = await pool.unsafe(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    // Get total row count across all tables (no user input - safe)
    const tables = await pool.unsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    let totalRows = 0;
    for (const table of tables) {
      try {
        const tableName = table.table_name;
        // Security: Validate table names from database before using
        if (!isValidTableName(tableName)) {
          console.warn(`[Database API] Skipping invalid table name in stats: ${tableName}`);
          continue;
        }
        const safeTableName = escapeIdentifier(tableName);
        const result = await pool.unsafe(`SELECT COUNT(*) as count FROM ${safeTableName}`);
        totalRows += parseInt(result[0]?.count || '0', 10);
      } catch (error) {
        console.error(`Error counting rows in ${table.table_name}:`, error);
      }
    }

    const executionTime = Date.now() - startTime;

    return res.json({
      databaseSize: parseInt(sizeResult[0]?.size || '0', 10),
      tableCount: parseInt(tableCountResult[0]?.count || '0', 10),
      totalRows,
      executionTime,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Database API] Get stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get database stats' });
  }
});

// ============================================================
// PROJECT DATABASE PROVISIONING ENDPOINTS
// ============================================================

// Helper: Check project ownership
async function checkProjectOwnership(req: Request, res: Response, projectId: number): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return false;
  }
  
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
  if (project.ownerId !== userId && !(req.user as any).isAdmin) {
    res.status(403).json({ error: 'Not authorized to access this project' });
    return false;
  }
  
  return true;
}

/**
 * Get database info for a specific project
 * GET /api/database/project/:projectId
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const database = await projectDatabaseService.getProjectDatabase(projectId);
    if (!database) {
      return res.json({ 
        provisioned: false, 
        message: 'No database provisioned for this project' 
      });
    }

    const stats = await projectDatabaseService.getDatabaseStats(projectId);

    return res.json({
      provisioned: true,
      database: {
        id: database.id,
        name: database.name,
        type: database.type,
        status: database.status,
        region: database.region,
        version: database.version,
        plan: database.plan,
        host: database.host,
        port: database.port,
        databaseName: database.database,
        username: database.username,
        sslEnabled: database.sslEnabled,
        storageUsedMb: database.storageUsedMb,
        storageLimitMb: database.storageLimitMb,
        connectionCount: database.connectionCount,
        maxConnections: database.maxConnections,
        autoBackup: database.autoBackup,
        lastBackupAt: database.lastBackupAt,
        provisionedAt: database.provisionedAt,
        createdAt: database.createdAt
      },
      stats
    });
  } catch (error: any) {
    console.error('[Database API] Get project database error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get project database' });
  }
});

/**
 * Provision a new database for a project
 * POST /api/database/project/:projectId/provision
 * REQUIRES: Authentication + Project ownership
 */
const provisionSchema = z.object({
  type: z.enum(['postgresql', 'mysql']).optional().default('postgresql'),
  region: z.string().optional().default('us-east-1'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional().default('free'),
  provider: z.enum(['neon', 'cloudnativepg', 'supabase', 'local']).optional(),
  suspendTimeoutSeconds: z.number().optional(),
  k8sNamespace: z.string().optional()
});

databaseRouter.post('/project/:projectId/provision', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const validation = provisionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
    }

    const options = validation.data;
    const database = await projectDatabaseService.provisionDatabase(projectId, options);

    return res.json({
      success: true,
      message: 'Database provisioned successfully',
      database: {
        id: database.id,
        name: database.name,
        type: database.type,
        status: database.status,
        region: database.region,
        plan: database.plan,
        provider: database.provider,
        host: database.host,
        port: database.port,
        databaseName: database.database,
        username: database.username,
        sslEnabled: database.sslEnabled,
        storageLimitMb: database.storageLimitMb,
        maxConnections: database.maxConnections,
        backupRetentionDays: database.backupRetentionDays
      }
    });
  } catch (error: any) {
    console.error('[Database API] Provision database error:', error);
    return res.status(500).json({ error: error.message || 'Failed to provision database' });
  }
});

/**
 * Get database credentials (connection string)
 * GET /api/database/project/:projectId/credentials
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.get('/project/:projectId/credentials', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const credentials = await projectDatabaseService.getCredentials(projectId);
    if (!credentials) {
      return res.status(404).json({ error: 'No database provisioned for this project' });
    }

    return res.json({
      credentials: {
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        databaseName: credentials.database,
        username: credentials.username,
        password: credentials.password,
        connectionUrl: credentials.connectionUrl,
        sslEnabled: credentials.sslEnabled
      }
    });
  } catch (error: any) {
    console.error('[Database API] Get credentials error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get database credentials' });
  }
});

/**
 * Delete/deprovision a project database
 * DELETE /api/database/project/:projectId
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.delete('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const success = await projectDatabaseService.deleteDatabase(projectId);
    if (!success) {
      return res.status(404).json({ error: 'No database found for this project' });
    }

    return res.json({ success: true, message: 'Database deleted successfully' });
  } catch (error: any) {
    console.error('[Database API] Delete database error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete database' });
  }
});

/**
 * Rotate database credentials
 * POST /api/database/project/:projectId/rotate-credentials
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/rotate-credentials', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const credentials = await projectDatabaseService.rotateCredentials(projectId);
    if (!credentials) {
      return res.status(404).json({ error: 'No database found for this project' });
    }

    return res.json({
      success: true,
      message: 'Credentials rotated successfully',
      credentials: {
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        username: credentials.username,
        password: credentials.password,
        connectionUrl: credentials.connectionUrl,
        sslEnabled: credentials.sslEnabled
      }
    });
  } catch (error: any) {
    console.error('[Database API] Rotate credentials error:', error);
    return res.status(500).json({ error: error.message || 'Failed to rotate credentials' });
  }
});

/**
 * Suspend database (for auto-suspend support)
 * POST /api/database/project/:projectId/suspend
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/suspend', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    await projectDatabaseService.suspendDatabase(projectId);
    return res.json({ success: true, message: 'Database suspended successfully' });
  } catch (error: any) {
    console.error('[Database API] Suspend database error:', error);
    return res.status(500).json({ error: error.message || 'Failed to suspend database' });
  }
});

/**
 * Resume suspended database
 * POST /api/database/project/:projectId/resume
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/resume', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    await projectDatabaseService.resumeDatabase(projectId);
    return res.json({ success: true, message: 'Database resumed successfully' });
  } catch (error: any) {
    console.error('[Database API] Resume database error:', error);
    return res.status(500).json({ error: error.message || 'Failed to resume database' });
  }
});

/**
 * Get database metrics
 * GET /api/database/project/:projectId/metrics
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.get('/project/:projectId/metrics', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const metrics = await projectDatabaseService.getMetrics(projectId);
    if (!metrics) {
      return res.status(404).json({ error: 'No database found for this project' });
    }

    return res.json({ metrics });
  } catch (error: any) {
    console.error('[Database API] Get metrics error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get database metrics' });
  }
});

// ============ Backup Management Endpoints ============

/**
 * Create a backup for a project database
 * POST /api/database/project/:projectId/backups
 * REQUIRES: Authentication + Project ownership
 */
const createBackupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  backupType: z.enum(['manual', 'pre_migration']).optional().default('manual')
});

databaseRouter.post('/project/:projectId/backups', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const validation = createBackupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
    }

    const backup = await projectDatabaseService.createBackup(projectId, {
      name: validation.data.name,
      backupType: validation.data.backupType,
      initiatedBy: 'user'
    });

    return res.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        id: backup.id,
        name: backup.name,
        status: backup.status,
        backupType: backup.backupType,
        createdAt: backup.createdAt,
        expiresAt: backup.expiresAt
      }
    });
  } catch (error: any) {
    console.error('[Database API] Create backup error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create backup' });
  }
});

/**
 * List all backups for a project database
 * GET /api/database/project/:projectId/backups
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.get('/project/:projectId/backups', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const backups = await projectDatabaseService.listBackups(projectId);

    return res.json({
      backups: backups.map(backup => ({
        id: backup.id,
        name: backup.name,
        status: backup.status,
        backupType: backup.backupType,
        sizeBytes: backup.sizeBytes,
        restorePoint: backup.restorePoint,
        createdAt: backup.createdAt,
        expiresAt: backup.expiresAt,
        completedAt: backup.completedAt
      }))
    });
  } catch (error: any) {
    console.error('[Database API] List backups error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
});

/**
 * Restore a backup
 * POST /api/database/project/:projectId/backups/:backupId/restore
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/backups/:backupId/restore', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const backupId = parseInt(req.params.backupId);
    
    if (isNaN(projectId) || isNaN(backupId)) {
      return res.status(400).json({ error: 'Invalid project ID or backup ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    await projectDatabaseService.restoreBackup(projectId, backupId);

    return res.json({
      success: true,
      message: 'Backup restoration initiated successfully'
    });
  } catch (error: any) {
    console.error('[Database API] Restore backup error:', error);
    return res.status(500).json({ error: error.message || 'Failed to restore backup' });
  }
});

/**
 * Delete a backup
 * DELETE /api/database/project/:projectId/backups/:backupId
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.delete('/project/:projectId/backups/:backupId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const backupId = parseInt(req.params.backupId);
    
    if (isNaN(projectId) || isNaN(backupId)) {
      return res.status(400).json({ error: 'Invalid project ID or backup ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    await projectDatabaseService.deleteBackup(projectId, backupId);

    return res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error: any) {
    console.error('[Database API] Delete backup error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete backup' });
  }
});

/**
 * Get database stats including backup info
 * GET /api/database/project/:projectId/stats
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.get('/project/:projectId/stats', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const stats = await projectDatabaseService.getDatabaseStats(projectId);
    if (!stats) {
      return res.status(404).json({ error: 'No database found for this project' });
    }

    return res.json({ stats });
  } catch (error: any) {
    console.error('[Database API] Get stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get database stats' });
  }
});

/**
 * Execute SQL query in project database (SQL Console)
 * POST /api/database/project/:projectId/sql/execute
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/sql/execute', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Security: Limit query length
    if (query.length > 10000) {
      return res.status(400).json({ error: 'Query too long (max 10000 characters)' });
    }

    // Security: Block dangerous operations in read-only mode
    const queryLower = query.toLowerCase().trim();
    const dangerousOps = ['drop ', 'truncate ', 'alter ', 'create database', 'drop database'];
    for (const op of dangerousOps) {
      if (queryLower.includes(op)) {
        return res.status(403).json({ error: `Operation not allowed: ${op.trim().toUpperCase()}` });
      }
    }

    // Check if database is provisioned and running first
    const dbInfo = await projectDatabaseService.getDatabaseInfo(projectId);
    if (!dbInfo || !dbInfo.provisioned) {
      return res.status(400).json({ 
        error: 'Database not provisioned. Please provision a database first.',
        needsProvisioning: true
      });
    }
    
    if (dbInfo.status !== 'running') {
      return res.status(503).json({ 
        error: `Database is not available (status: ${dbInfo.status}). Please wait for provisioning to complete or retry.`,
        status: dbInfo.status,
        retryable: dbInfo.status === 'provisioning'
      });
    }

    const startTime = Date.now();
    const result = await projectDatabaseService.executeQuery(projectId, query);
    const executionTime = Date.now() - startTime;

    return res.json({
      success: true,
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      fields: result.fields || [],
      executionTime
    });
  } catch (error: any) {
    console.error('[Database API] SQL execute error:', error);
    return res.status(500).json({ error: error.message || 'Failed to execute query' });
  }
});

/**
 * Point-in-time restore for project database
 * POST /api/database/project/:projectId/restore
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.post('/project/:projectId/restore', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const { timestamp, timezone } = req.body;
    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp is required' });
    }

    // Validate timestamp format
    const restoreDate = new Date(timestamp);
    if (isNaN(restoreDate.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp format' });
    }

    // Don't allow restore to future dates
    if (restoreDate > new Date()) {
      return res.status(400).json({ error: 'Cannot restore to a future timestamp' });
    }

    // Check if database exists and get plan
    const dbInfo = await projectDatabaseService.getDatabaseInfo(projectId);
    if (!dbInfo || !dbInfo.provisioned) {
      return res.status(404).json({ error: 'No database found for this project' });
    }

    // PITR requires Pro or Enterprise plan
    if (dbInfo.plan !== 'pro' && dbInfo.plan !== 'enterprise') {
      return res.status(403).json({ error: 'Point-in-time restore requires Pro or Enterprise plan' });
    }

    await projectDatabaseService.pointInTimeRestore(projectId, timestamp, timezone || 'UTC');

    return res.json({
      success: true,
      message: 'Point-in-time restore initiated successfully',
      restorePoint: timestamp,
      timezone: timezone || 'UTC'
    });
  } catch (error: any) {
    console.error('[Database API] PITR error:', error);
    return res.status(500).json({ error: error.message || 'Failed to restore database' });
  }
});

/**
 * Update history retention period for project database
 * PATCH /api/database/project/:projectId/settings
 * REQUIRES: Authentication + Project ownership
 */
databaseRouter.patch('/project/:projectId/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!await checkProjectOwnership(req, res, projectId)) {
      return;
    }

    const { historyRetentionDays } = req.body;
    
    // Validate retention period
    const allowedDays = [7, 14, 30, 90];
    if (historyRetentionDays && !allowedDays.includes(historyRetentionDays)) {
      return res.status(400).json({ error: 'Invalid retention period. Allowed: 7, 14, 30, 90 days' });
    }

    await projectDatabaseService.updateSettings(projectId, { historyRetentionDays });

    return res.json({
      success: true,
      message: 'Database settings updated successfully'
    });
  } catch (error: any) {
    console.error('[Database API] Update settings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

export default databaseRouter;
