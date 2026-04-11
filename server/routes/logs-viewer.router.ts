import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { deployments, buildLogs, terminalLogs, projects } from '@shared/schema';
import { eq, desc, and, gte, lte, sql, like, inArray, or, ilike } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { filterStream, transformStream, collectStream } from '../utils/db-streaming';

const router = Router();
const logger = createLogger('logs-viewer');

/**
 * ✅ 40-YEAR SENIOR SECURITY FIX
 * Logs contain sensitive information (errors, debug data, potential secrets in output)
 * All routes require authentication
 */
router.use(ensureAuthenticated);

const logsQuerySchema = z.object({
  deploymentId: z.string().optional(),
  projectId: z.string().optional(),
  buildId: z.string().optional(),
  level: z.enum(['info', 'warn', 'error', 'debug', 'all']).optional().default('all'),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0)
});

const exportLogsSchema = z.object({
  deploymentId: z.string().optional(),
  projectId: z.string().optional(),
  buildId: z.string().optional(),
  format: z.enum(['json', 'csv', 'txt']).default('json'),
  level: z.enum(['info', 'warn', 'error', 'debug', 'all']).optional().default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  deploymentId?: string;
  buildId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

/**
 * Build SQL WHERE conditions for logs query
 * Moves filtering to database level for memory efficiency
 */
function buildLogsWhereConditions(params: {
  buildId?: string;
  projectId?: string;
  level?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  const conditions: any[] = [];
  
  if (params.buildId) {
    conditions.push(eq(buildLogs.buildId, params.buildId));
  }
  if (params.projectId) {
    const projectIdNum = parseInt(params.projectId, 10);
    if (!isNaN(projectIdNum)) {
      conditions.push(eq(buildLogs.projectId, projectIdNum));
    }
  }
  if (params.level && params.level !== 'all') {
    conditions.push(eq(buildLogs.level, params.level));
  }
  if (params.search) {
    conditions.push(ilike(buildLogs.message, `%${params.search}%`));
  }
  if (params.startDate) {
    conditions.push(gte(buildLogs.timestamp, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(buildLogs.timestamp, new Date(params.endDate)));
  }
  
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Get deployment logs with search and filtering
 * GET /api/logs
 * 
 * MEMORY OPTIMIZATION: Uses SQL-level filtering instead of loading
 * all records into memory and filtering with .filter()
 * 
 * SECURITY: Always requires at least one valid scope (buildId, projectId, or deploymentId)
 * to prevent exposing all logs to unauthorized users.
 */
router.get('/', async (req, res) => {
  try {
    const {
      deploymentId,
      projectId,
      buildId,
      level,
      search,
      startDate,
      endDate,
      limit,
      offset
    } = logsQuerySchema.parse(req.query);

    let logs: LogEntry[] = [];

    // SECURITY: Validate projectId is numeric if provided
    if (projectId) {
      const projectIdNum = parseInt(projectId, 10);
      if (isNaN(projectIdNum)) {
        return res.status(400).json({ error: 'Invalid projectId: must be a number' });
      }
    }

    // P0 SECURITY FIX: Verify project ownership before returning logs
    if (projectId) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId)
      });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.userId !== (req.user as any)?.id) {
        logger.warn('Unauthorized logs access attempt', { userId: (req.user as any)?.id, projectId });
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // SQL-level filtering for memory efficiency (Replit pattern)
    if (buildId || projectId) {
      const whereConditions = buildLogsWhereConditions({
        buildId,
        projectId,
        level,
        search,
        startDate,
        endDate
      });

      // SECURITY: Ensure we always have a WHERE clause for scoped queries
      if (!whereConditions) {
        return res.status(400).json({ error: 'At least buildId or projectId is required' });
      }

      // Get total count first (for pagination) - using SQL count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(buildLogs)
        .where(whereConditions);
      const total = Number(countResult[0]?.count ?? 0);

      // Fetch only the needed page with SQL LIMIT/OFFSET
      const buildLogsRecords = await db
        .select()
        .from(buildLogs)
        .where(whereConditions)
        .orderBy(desc(buildLogs.timestamp))
        .limit(limit)
        .offset(offset);

      logs = buildLogsRecords.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        buildId: log.buildId,
        projectId: String(log.projectId),
        metadata: { source: log.source, logType: log.logType, ...((log.metadata as Record<string, any>) || {}) }
      }));

      // Return early with SQL-based pagination
      return res.json({
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    }

    // Fallback: Get from deployment record (legacy support)
    if (deploymentId) {
      const deployment = await db.query.deployments.findFirst({
        where: eq(deployments.deploymentId, deploymentId)
      });

      // P0 SECURITY FIX: Verify deployment ownership
      if (deployment) {
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, String(deployment.projectId))
        });
        if (!project || project.userId !== (req.user as any)?.id) {
          logger.warn('Unauthorized deployment logs access', { userId: (req.user as any)?.id, deploymentId });
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      if (deployment?.deploymentLogs) {
        logs = parseDeploymentLogs(deployment.deploymentLogs, deploymentId, String(deployment.projectId));
      } else if (deployment?.buildLogs) {
        logs = parseDeploymentLogs(deployment.buildLogs, deploymentId, String(deployment.projectId));
      }

      // Apply in-memory filters only for legacy deployment logs
      if (level !== 'all') {
        logs = logs.filter(log => log.level === level);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        logs = logs.filter(log => log.message.toLowerCase().includes(searchLower));
      }
      if (startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
      }
      if (endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate));
      }
    }

    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    res.json({
      logs: paginatedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export logs to file
 * POST /api/logs/export
 */
router.post('/export', async (req, res) => {
  try {
    const {
      deploymentId,
      projectId,
      buildId,
      format,
      level,
      startDate,
      endDate
    } = exportLogsSchema.parse(req.body);

    // Get logs
    let logs: LogEntry[] = [];

    if (buildId) {
      const buildLogsRecords = await db.query.buildLogs.findMany({
        where: eq(buildLogs.buildId, buildId),
        orderBy: [desc(buildLogs.timestamp)]
      });

      logs = buildLogsRecords.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        buildId: log.buildId,
        projectId: String(log.projectId),
        metadata: { source: log.source, logType: log.logType }
      }));
    } else if (projectId) {
      const buildLogsRecords = await db.query.buildLogs.findMany({
        where: eq(buildLogs.projectId, parseInt(projectId as string, 10)),
        orderBy: [desc(buildLogs.timestamp)]
      });

      logs = buildLogsRecords.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        buildId: log.buildId,
        projectId: String(log.projectId),
        metadata: { source: log.source, logType: log.logType }
      }));
    } else if (deploymentId) {
      const deployment = await db.query.deployments.findFirst({
        where: eq(deployments.deploymentId, deploymentId)
      });

      if (deployment?.deploymentLogs) {
        logs = parseDeploymentLogs(deployment.deploymentLogs, deploymentId, String(deployment.projectId));
      }
    }

    // Apply filters
    if (level !== 'all') {
      logs = logs.filter(log => log.level === level);
    }
    if (startDate) {
      const start = new Date(startDate);
      logs = logs.filter(log => new Date(log.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      logs = logs.filter(log => new Date(log.timestamp) <= end);
    }

    // Format output
    let output: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'json':
        output = JSON.stringify(logs, null, 2);
        contentType = 'application/json';
        filename = `logs-${Date.now()}.json`;
        break;

      case 'csv':
        output = logsToCSV(logs);
        contentType = 'text/csv';
        filename = `logs-${Date.now()}.csv`;
        break;

      case 'txt':
        output = logsToText(logs);
        contentType = 'text/plain';
        filename = `logs-${Date.now()}.txt`;
        break;

      default:
        throw new Error('Invalid format');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(output);
  } catch (error: any) {
    logger.error('Failed to export logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get log statistics
 * GET /api/logs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { deploymentId, projectId, buildId } = req.query;

    let logs: LogEntry[] = [];

    if (buildId) {
      const buildLogsRecords = await db.query.buildLogs.findMany({
        where: eq(buildLogs.buildId, buildId as string)
      });

      logs = buildLogsRecords.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        buildId: log.buildId,
        projectId: String(log.projectId)
      }));
    } else if (projectId) {
      const buildLogsRecords = await db.query.buildLogs.findMany({
        where: eq(buildLogs.projectId, parseInt(projectId as string, 10)),
        orderBy: [desc(buildLogs.timestamp)]
      });

      logs = buildLogsRecords.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        buildId: log.buildId,
        projectId: String(log.projectId)
      }));
    } else if (deploymentId) {
      const deployment = await db.query.deployments.findFirst({
        where: eq(deployments.deploymentId, deploymentId as string)
      });

      if (deployment?.deploymentLogs) {
        logs = parseDeploymentLogs(deployment.deploymentLogs, deploymentId as string, String(deployment.projectId));
      }
    }

    const stats = {
      total: logs.length,
      byLevel: {
        info: logs.filter(l => l.level === 'info').length,
        warn: logs.filter(l => l.level === 'warn').length,
        error: logs.filter(l => l.level === 'error').length,
        debug: logs.filter(l => l.level === 'debug').length
      },
      timeRange: {
        start: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        end: logs.length > 0 ? logs[0].timestamp : null
      }
    };

    res.json(stats);
  } catch (error: any) {
    logger.error('Failed to get log stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Infer log level from message content
 */
function inferLogLevel(message: string): 'info' | 'warn' | 'error' | 'debug' {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('❌')) {
    return 'error';
  } else if (msgLower.includes('warn') || msgLower.includes('warning') || msgLower.includes('⚠️')) {
    return 'warn';
  } else if (msgLower.includes('debug') || msgLower.includes('🔍')) {
    return 'debug';
  }
  
  return 'info';
}

/**
 * Helper: Parse deployment logs (fallback)
 * Handles both JSON arrays and plain text logs
 */
function parseDeploymentLogs(logData: string | string[] | any, deploymentId: string, projectId?: string): LogEntry[] {
  try {
    // Parse JSON if it's a string
    const logMessages = Array.isArray(logData) ? logData : JSON.parse(logData);
    
    return logMessages.map((entry: any, index: number) => {
      // Handle both string messages and structured log objects
      if (typeof entry === 'string') {
        return {
          timestamp: new Date(Date.now() - (logMessages.length - index) * 1000).toISOString(),
          level: inferLogLevel(entry),
          message: entry,
          deploymentId,
          projectId
        };
      } else if (typeof entry === 'object' && entry !== null) {
        // Handle structured log objects {timestamp, level, message, ...}
        return {
          timestamp: entry.timestamp || new Date(Date.now() - (logMessages.length - index) * 1000).toISOString(),
          level: (entry.level as any) || inferLogLevel(entry.message || JSON.stringify(entry)),
          message: entry.message || JSON.stringify(entry),
          deploymentId,
          projectId,
          metadata: entry.metadata || entry
        };
      } else {
        // Fallback: convert to string
        const messageStr = String(entry);
        return {
          timestamp: new Date(Date.now() - (logMessages.length - index) * 1000).toISOString(),
          level: inferLogLevel(messageStr),
          message: messageStr,
          deploymentId,
          projectId
        };
      }
    });
  } catch (error) {
    // Fallback: treat as plain text, split by newlines
    const lines = typeof logData === 'string' ? logData.split('\n') : [String(logData)];
    
    return lines.filter(line => line.trim()).map((message, index) => ({
      timestamp: new Date(Date.now() - (lines.length - index) * 1000).toISOString(),
      level: inferLogLevel(message),
      message,
      deploymentId,
      projectId
    }));
  }
}

/**
 * Helper: Convert logs to CSV
 */
function logsToCSV(logs: LogEntry[]): string {
  const headers = 'Timestamp,Level,Message,DeploymentID,ProjectID\n';
  const rows = logs.map(log =>
    `"${log.timestamp}","${log.level}","${log.message.replace(/"/g, '""')}","${log.deploymentId || ''}","${log.projectId || ''}"`
  ).join('\n');
  return headers + rows;
}

/**
 * Helper: Convert logs to text
 */
function logsToText(logs: LogEntry[]): string {
  return logs.map(log =>
    `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
  ).join('\n');
}

export default router;
