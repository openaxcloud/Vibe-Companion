/**
 * Logs API Router - Fortune 500 Standard
 * Centralized log access and frontend log ingestion
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { centralizedAggregator, createCentralizedLogger } from '../logging/centralized-logger';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();
const logger = createCentralizedLogger('logs-api');

const frontendLogSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']),
  message: z.string().max(10000),
  timestamp: z.string().optional(),
  source: z.string().optional(),
  category: z.enum(['error', 'action', 'navigation', 'performance', 'network']).optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.number().optional(),
  stack: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const frontendLogBatchSchema = z.object({
  logs: z.array(frontendLogSchema).max(100),
  sessionId: z.string().optional(),
  pageUrl: z.string().optional(),
});

router.post('/logs/ingest', async (req: Request, res: Response) => {
  try {
    const result = frontendLogBatchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid log format', details: result.error.flatten() });
    }

    const { logs, sessionId, pageUrl } = result.data;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    const userId = (req as any).user?.id;

    for (const log of logs) {
      const enrichedLog = {
        ...log,
        sessionId: log.sessionId || sessionId,
        userId: log.userId || userId,
        source: log.source || 'frontend',
        clientIp,
        pageUrl: log.url || pageUrl,
      };

      centralizedAggregator.record({
        level: log.level as any,
        message: `[FRONTEND] ${log.message}`,
        timestamp: log.timestamp || new Date().toISOString(),
        service: 'frontend',
        requestId: undefined,
        correlationId: sessionId,
        userId: enrichedLog.userId,
        sessionId: enrichedLog.sessionId,
        category: log.category as any,
        details: enrichedLog.metadata,
        environment: process.env.NODE_ENV || 'development',
      });

      if (log.level === 'error') {
        logger.error(`Frontend error: ${log.message}`, {
          stack: log.stack,
          url: log.url,
          ...log.metadata,
        });
      }
    }

    res.status(202).json({ 
      success: true, 
      processed: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to ingest frontend logs', { error: error.message });
    res.status(500).json({ error: 'Failed to process logs' });
  }
});

async function handleLogsQuery(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const level = req.query.level as string;
    const service = req.query.service as string;
    const since = req.query.since ? parseInt(req.query.since as string) : undefined;

    const logs = centralizedAggregator.getRecent({ limit, level, service, since });

    res.json({
      logs,
      count: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch recent logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}

// Primary query endpoint with full filter support
router.get('/logs/query', ensureAuthenticated, handleLogsQuery);

// Alias for backward compatibility
router.get('/logs/recent', ensureAuthenticated, handleLogsQuery);

router.get('/logs/search', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const caseSensitive = req.query.caseSensitive === 'true';

    const logs = centralizedAggregator.search(query, { limit, caseSensitive });

    res.json({
      logs,
      count: logs.length,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to search logs', { error: error.message });
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

router.get('/logs/request/:requestId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const logs = centralizedAggregator.getByRequestId(requestId);

    res.json({
      logs,
      count: logs.length,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch request logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/logs/correlation/:correlationId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { correlationId } = req.params;
    const logs = centralizedAggregator.getByCorrelationId(correlationId);

    res.json({
      logs,
      count: logs.length,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch correlation logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/logs/stats', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const stats = centralizedAggregator.getStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch log stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/logs/errors', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string) : Date.now() - 24 * 60 * 60 * 1000;
    const summary = centralizedAggregator.getErrorSummary(since);

    res.json({
      errors: summary,
      count: summary.length,
      since: new Date(since).toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch error summary', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

router.get('/logs/export', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const data = centralizedAggregator.export(format);

    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error: any) {
    logger.error('Failed to export logs', { error: error.message });
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

router.post('/logs/clear', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    centralizedAggregator.clear();
    logger.audit('clear_logs', 'log_aggregator', { userId: user.id });

    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    logger.error('Failed to clear logs', { error: error.message });
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

export default router;
