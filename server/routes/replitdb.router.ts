import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { replitDB } from '../database/replitdb';
import { createLogger } from '../utils/logger';

const replitdbRouter = Router();
const logger = createLogger('replitdb');

/**
 * ReplDB-Compatible Key-Value Database API
 * 
 * Provides Replit-compatible database access for user code running in containers.
 * Environment variable REPLIT_DB_URL points to this API.
 * 
 * API Format: /api/db/:projectId
 * 
 * Operations:
 * - GET /api/db/:projectId/:key - Get value for key
 * - GET /api/db/:projectId?prefix=... - List keys with optional prefix
 * - POST /api/db/:projectId/:key - Set value for key (body = value)
 * - DELETE /api/db/:projectId/:key - Delete key
 * 
 * SECURITY: All routes require authentication via container token or session
 */

// Middleware to parse raw text bodies (Replit clients send plain text)
replitdbRouter.use(express.text({ type: '*/*' }));

/**
 * SECURITY: Authenticate ReplitDB requests
 * Supports two auth methods:
 * 1. Container token (X-Container-Token header) - for code running in containers
 * 2. Session auth (req.isAuthenticated) - for direct API calls
 */
async function authenticateReplitDB(req: Request, res: Response, next: NextFunction) {
  const projectId = parseInt(req.params.projectId);
  
  // Method 1: Container token authentication
  const containerToken = req.headers['x-container-token'] as string | undefined;
  if (containerToken) {
    // Verify container token matches the project
    const expectedToken = process.env.CONTAINER_SECRET_KEY;
    if (expectedToken && containerToken.startsWith(expectedToken)) {
      // Token format: SECRET_KEY:projectId
      const tokenProjectId = parseInt(containerToken.split(':')[1]);
      if (tokenProjectId === projectId || !tokenProjectId) {
        return next();
      }
    }
    logger.warn('Invalid container token for ReplitDB access', { projectId });
    return res.status(401).send('Unauthorized: Invalid container token');
  }
  
  // Method 2: Session-based authentication
  if (req.isAuthenticated && req.isAuthenticated()) {
    // User is logged in - verify they have access to the project
    // For now, allow any authenticated user (project access check can be added later)
    return next();
  }
  
  // No valid authentication
  logger.warn('Unauthenticated ReplitDB access attempt', { 
    projectId,
    ip: req.ip 
  });
  return res.status(401).send('Unauthorized: Authentication required');
}

// Apply authentication middleware to all routes
replitdbRouter.use('/:projectId', authenticateReplitDB);
replitdbRouter.use('/:projectId/:key', authenticateReplitDB);

// GET /api/db/:projectId - List all keys (with optional prefix filter)
replitdbRouter.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const prefix = req.query.prefix as string | undefined;
    const keys = await replitDB.keys(projectId, prefix);
    
    // Return keys as newline-separated list (Replit format)
    res.type('text/plain').send(keys.join('\n'));
  } catch (error) {
    console.error('ReplitDB list error:', error);
    res.status(500).send('Internal server error');
  }
});

// GET /api/db/:projectId/:key - Get value for key
replitdbRouter.get('/:projectId/:key', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const key = req.params.key;
    const value = await replitDB.get(projectId, key);
    
    if (value === undefined) {
      return res.status(404).send('Key not found');
    }
    
    // Return value as JSON string (Replit format)
    res.type('text/plain').send(typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) {
    console.error('ReplitDB get error:', error);
    res.status(500).send('Internal server error');
  }
});

// POST /api/db/:projectId/:key - Set value for key
replitdbRouter.post('/:projectId/:key', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const key = req.params.key;
    
    // Get value from request body (text or JSON)
    let value: any;
    if (typeof req.body === 'string') {
      value = req.body;
    } else if (typeof req.body === 'object') {
      value = req.body;
    } else {
      value = String(req.body);
    }
    
    await replitDB.set(projectId, key, value);
    res.status(200).send('OK');
  } catch (error) {
    console.error('ReplitDB set error:', error);
    res.status(500).send('Internal server error');
  }
});

// DELETE /api/db/:projectId/:key - Delete key
replitdbRouter.delete('/:projectId/:key', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const key = req.params.key;
    const deleted = await replitDB.delete(projectId, key);
    
    if (deleted) {
      res.status(200).send('OK');
    } else {
      res.status(404).send('Key not found');
    }
  } catch (error) {
    console.error('ReplitDB delete error:', error);
    res.status(500).send('Internal server error');
  }
});

// POST /api/db/:projectId - Bulk set (Replit extension)
// Also accepts JSON body for bulk operations
replitdbRouter.post('/:projectId', express.json({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    let data = req.body;
    
    // Handle text body that might be JSON
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err: any) { console.error("[catch]", err?.message || err);
        return res.status(400).send('Body must be a JSON object');
      }
    }
    
    if (typeof data !== 'object' || data === null) {
      return res.status(400).send('Body must be a JSON object');
    }

    for (const [key, value] of Object.entries(data)) {
      await replitDB.set(projectId, key, value);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('ReplitDB bulk set error:', error);
    res.status(500).send('Internal server error');
  }
});

// DELETE /api/db/:projectId - Clear all keys for project
replitdbRouter.delete('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    await replitDB.clear(projectId);
    res.status(200).send('OK');
  } catch (error) {
    console.error('ReplitDB clear error:', error);
    res.status(500).send('Internal server error');
  }
});

export { replitdbRouter };
