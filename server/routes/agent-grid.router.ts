/**
 * Agent Grid API Router
 * REST endpoints for AG Grid data access
 * Phase 2 - Agent Activity Dashboard
 * 
 * SECURITY: All endpoints require authentication
 * REFACTORED Nov 2025: Proper auth, error propagation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { agentGridDataService } from '../services/agent-grid-data.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('agent-grid-router');
const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated?.() || !req.user) {
    logger.warn('Unauthorized access attempt to agent-grid API');
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

function parseQueryParams(query: any, userId?: number) {
  return {
    page: Math.max(1, parseInt(query.page) || 1),
    pageSize: Math.min(Math.max(1, parseInt(query.pageSize) || 25), 100),
    sortField: query.sortField as string | undefined,
    sortDirection: (query.sortDirection === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    userId: query.allUsers === 'true' ? undefined : userId,
    projectId: query.projectId ? parseInt(query.projectId) : undefined,
    sessionId: query.sessionId as string | undefined,
    status: query.status as string | undefined,
    model: query.model as string | undefined,
    startDate: query.startDate as string | undefined,
    endDate: query.endDate as string | undefined,
    operationType: query.operationType as string | undefined,
    role: query.role as string | undefined,
    searchQuery: query.searchQuery as string | undefined,
  };
}

/**
 * GET /api/agent-grid/sessions
 * Get paginated list of agent sessions
 * REQUIRES projectId parameter to scope sessions to current project
 */
router.get('/sessions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const params = parseQueryParams(req.query, userId);
  
  if (!params.projectId) {
    logger.warn('Sessions request missing required projectId parameter');
    return res.status(400).json({ error: 'projectId parameter is required' });
  }
  
  logger.debug('Fetching sessions grid data', { userId: params.userId, projectId: params.projectId, page: params.page });
  const result = await agentGridDataService.getSessions(params);
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch sessions' });
  }
  
  res.json(result);
}));

/**
 * GET /api/agent-grid/sessions/:sessionId
 * Get single session details
 */
router.get('/sessions/:sessionId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const result = await agentGridDataService.getSessions({ 
    page: 1, 
    pageSize: 1000 
  });
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch session' });
  }
  
  const session = result.rows.find(s => s.id === sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session);
}));

/**
 * GET /api/agent-grid/actions
 * Get paginated list of agent actions
 */
router.get('/actions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const params = parseQueryParams(req.query);
  
  logger.debug('Fetching actions grid data', { sessionId: params.sessionId, page: params.page });
  const result = await agentGridDataService.getActions(params);
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch actions' });
  }
  
  res.json(result);
}));

/**
 * GET /api/agent-grid/files
 * Get paginated list of file operations
 */
router.get('/files', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const params = parseQueryParams(req.query);
  
  logger.debug('Fetching file operations grid data', { sessionId: params.sessionId, page: params.page });
  const result = await agentGridDataService.getFileOperations(params);
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch file operations' });
  }
  
  res.json(result);
}));

/**
 * GET /api/agent-grid/conversations
 * Get paginated list of conversation messages
 */
router.get('/conversations', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const params = parseQueryParams(req.query);
  
  logger.debug('Fetching conversations grid data', { sessionId: params.sessionId, page: params.page });
  const result = await agentGridDataService.getConversations(params);
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch conversations' });
  }
  
  res.json(result);
}));

/**
 * GET /api/agent-grid/metrics
 * Get aggregated metrics for dashboard
 * REQUIRES projectId parameter to scope metrics to current project
 */
router.get('/metrics', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const params = parseQueryParams(req.query, userId);
  
  if (!params.projectId) {
    logger.warn('Metrics request missing required projectId parameter');
    return res.status(400).json({ error: 'projectId parameter is required' });
  }
  
  logger.debug('Fetching metrics dashboard data', { userId: params.userId, projectId: params.projectId });
  const result = await agentGridDataService.getMetrics(params);
  
  if (result.error) {
    return res.status(500).json({ error: result.error, message: 'Failed to fetch metrics' });
  }
  
  res.json(result);
}));

/**
 * GET /api/agent-grid/export/sessions
 * Export sessions data as CSV or JSON
 */
router.get('/export/sessions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const format = (req.query.format as 'csv' | 'json') || 'json';
  const params = parseQueryParams(req.query, userId);
  
  logger.debug('Exporting sessions data', { userId: params.userId, format });
  const result = await agentGridDataService.exportSessions(format, params);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=agent-sessions-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(result);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=agent-sessions-${new Date().toISOString().split('T')[0]}.json`);
    res.json(result);
  }
}));

/**
 * Error handler for this router
 */
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Agent Grid API error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

export default router;
