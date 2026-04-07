/**
 * Runtime Router for E-Code Platform
 * Handles project runtime lifecycle (start, stop, status, execute, logs)
 */

import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import {
  getRuntimeDependencies,
  startProjectRuntime,
  stopProjectRuntime,
  getProjectRuntimeStatus,
  executeProjectCommand,
  getProjectRuntimeLogs
} from '../runtimes/api';
import { storage } from '../storage';
import { CodeExecutor } from '../execution/executor';
import { createLogger } from '../utils/logger';

const logger = createLogger('runtime-router');
const codeExecutor = new CodeExecutor();

const router = Router();

/**
 * Middleware to ensure user has access to project
 */
async function ensureProjectAccess(req: any, res: any, next: any) {
  try {
    const projectId = req.params.id || req.params.projectId;
    
    // Validate project ID format (UUID or numeric)
    if (!projectId || (typeof projectId === 'string' && projectId.trim().length === 0)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user owns the project
    if (project.ownerId === userId) {
      return next();
    }
    
    // Check if user is a collaborator
    const collaborators = await storage.getProjectCollaborators(projectId);
    const isCollaborator = collaborators.some((c: any) => c.userId === userId);
    
    if (!isCollaborator) {
      return res.status(403).json({ error: "You don't have access to this project" });
    }
    
    next();
  } catch (error) {
    console.error('Error checking project access:', error);
    res.status(500).json({ error: 'Failed to verify project access' });
  }
}

// ===============================
// Project-Scoped Runtime Routes (CANONICAL)
// ===============================

/**
 * POST /api/projects/:id/runtime/start
 * Start a project's runtime
 */
router.post('/projects/:id/runtime/start', ensureAuthenticated, ensureProjectAccess, startProjectRuntime);

/**
 * POST /api/projects/:id/runtime/stop
 * Stop a project's runtime
 */
router.post('/projects/:id/runtime/stop', ensureAuthenticated, ensureProjectAccess, stopProjectRuntime);

/**
 * GET /api/projects/:id/runtime
 * Get project runtime status
 */
router.get('/projects/:id/runtime', ensureAuthenticated, ensureProjectAccess, getProjectRuntimeStatus);

/**
 * POST /api/projects/:id/runtime/execute
 * Execute command in project runtime
 */
router.post('/projects/:id/runtime/execute', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { command, args, input } = req.body;
    const projectId = req.params.id;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    await executeProjectCommand(req, res);
  } catch (err: any) {
    logger.error('Execute command failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to execute command', 
        details: err.message,
        projectId: req.params.id
      });
    }
  }
});

/**
 * GET /api/projects/:id/runtime/logs
 * Get project runtime logs
 */
router.get('/projects/:id/runtime/logs', ensureAuthenticated, ensureProjectAccess, getProjectRuntimeLogs);

// ===============================
// Alternative Runtime Routes (COMPATIBILITY)
// These proxy to project-scoped routes for backward compatibility
// ===============================

/**
 * POST /api/runtime/start
 * Start runtime (requires projectId in body)
 */
router.post('/runtime/start', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required in request body' });
  }
  
  // Set projectId in params for downstream handler
  req.params.id = projectId.toString();
  
  return ensureProjectAccess(req, res, () => startProjectRuntime(req, res));
});

/**
 * POST /api/runtime/stop
 * Stop runtime (requires projectId in body)
 */
router.post('/runtime/stop', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required in request body' });
  }
  
  req.params.id = projectId.toString();
  
  return ensureProjectAccess(req, res, () => stopProjectRuntime(req, res));
});

/**
 * GET /api/runtime/:projectId
 * Get runtime status (projectId in path)
 */
router.get('/runtime/:projectId', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  
  req.params.id = projectId;
  
  return ensureProjectAccess(req, res, () => getProjectRuntimeStatus(req, res));
});

/**
 * POST /api/runtime/:projectId/start
 * Start runtime (projectId in path)
 */
router.post('/runtime/:projectId/start', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  
  req.params.id = projectId;
  
  return ensureProjectAccess(req, res, () => startProjectRuntime(req, res));
});

/**
 * POST /api/runtime/:projectId/stop
 * Stop runtime (projectId in path)
 */
router.post('/runtime/:projectId/stop', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  
  req.params.id = projectId;
  
  return ensureProjectAccess(req, res, () => stopProjectRuntime(req, res));
});

/**
 * POST /api/runtime/:projectId/execute
 * Execute command (projectId in path)
 */
router.post('/runtime/:projectId/execute', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  
  req.params.id = projectId;
  
  return ensureProjectAccess(req, res, () => executeProjectCommand(req, res));
});

/**
 * GET /api/runtime/:projectId/logs
 * Get logs (projectId in path)
 */
router.get('/runtime/:projectId/logs', ensureAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  
  req.params.id = projectId;
  
  return ensureProjectAccess(req, res, () => getProjectRuntimeLogs(req, res));
});

// ===============================
// System Runtime Routes
// ===============================

/**
 * GET /api/runtime/dependencies
 * Get runtime dependencies (Docker, Nix, languages)
 * SECURITY: Requires authentication to prevent enumeration attacks
 */
router.get('/runtime/dependencies', ensureAuthenticated, getRuntimeDependencies);

// ===============================
// Direct Code Execution Routes (No Docker Required)
// SECURITY: These endpoints are gated by feature flag and rate limiting
// ===============================

// Feature flag for direct execution (DISABLED by default everywhere - explicit opt-in required)
// SECURITY: Direct execution allows code to run without sandboxing. Enable only for admin testing.
const ENABLE_DIRECT_EXECUTION = process.env.ENABLE_DIRECT_EXECUTION === 'true';

// Rate limiting: Track executions per user
const executionRateLimits = new Map<number, { count: number; resetTime: number }>();
const MAX_EXECUTIONS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const limit = executionRateLimits.get(userId);
  
  if (!limit || now > limit.resetTime) {
    executionRateLimits.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (limit.count >= MAX_EXECUTIONS_PER_MINUTE) {
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * POST /api/execute
 * Execute code directly without Docker
 * SECURITY: Requires authentication, rate limited, feature-flagged
 * Body: { language: string, code: string, projectId?: string }
 */
router.post('/execute', ensureAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Feature flag check
    if (!ENABLE_DIRECT_EXECUTION) {
      logger.warn(`Direct execution disabled. User ${userId} attempted to use /api/execute`);
      return res.status(403).json({ 
        success: false, 
        error: 'Direct code execution is currently disabled in production. Use container-based execution instead.' 
      });
    }
    
    // Rate limit check
    if (!checkRateLimit(userId)) {
      logger.warn(`Rate limit exceeded for user ${userId} on /api/execute`);
      return res.status(429).json({ 
        success: false, 
        error: `Rate limit exceeded. Maximum ${MAX_EXECUTIONS_PER_MINUTE} executions per minute.` 
      });
    }
    
    const { language, code, projectId } = req.body;
    
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Language is required' 
      });
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Code is required' 
      });
    }
    
    // Audit log
    logger.info(`[AUDIT] Direct code execution: userId=${userId}, language=${language}, project=${projectId || 'none'}, codeSize=${code.length}`);
    
    const result = await codeExecutor.execute(language, code, {
      timeout: 30000,
      maxMemory: 128 * 1024 * 1024
    });
    
    return res.json({
      success: result.exitCode === 0,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
      exitCode: result.exitCode
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Direct code execution failed: ${errorMessage}`);
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      output: '',
      executionTime: 0,
      exitCode: 1
    });
  }
});

/**
 * POST /api/projects/:id/execute-direct
 * Execute code directly for a project without Docker
 * SECURITY: Requires authentication, rate limited, feature-flagged
 * Body: { language: string, code: string }
 */
router.post('/projects/:id/execute-direct', ensureAuthenticated, async (req, res, next) => {
  const projectId = req.params.id;
  req.params.id = projectId;
  
  return (async () => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Feature flag check
      if (!ENABLE_DIRECT_EXECUTION) {
        logger.warn(`Direct execution disabled. User ${userId} attempted to use /api/projects/${projectId}/execute-direct`);
        return res.status(403).json({ 
          success: false, 
          error: 'Direct code execution is currently disabled in production. Use container-based execution instead.' 
        });
      }
      
      // Rate limit check
      if (!checkRateLimit(userId)) {
        logger.warn(`Rate limit exceeded for user ${userId} on /api/projects/${projectId}/execute-direct`);
        return res.status(429).json({ 
          success: false, 
          error: `Rate limit exceeded. Maximum ${MAX_EXECUTIONS_PER_MINUTE} executions per minute.` 
        });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      if (project.ownerId !== userId) {
        const collaborators = await storage.getProjectCollaborators(projectId);
        const isCollaborator = collaborators.some((c: any) => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ error: "You don't have access to this project" });
        }
      }
      
      const { language, code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Code is required' 
        });
      }
      
      const detectedLanguage = language || project.language || 'javascript';
      
      // Audit log
      logger.info(`[AUDIT] Project direct execution: userId=${userId}, projectId=${projectId}, language=${detectedLanguage}, codeSize=${code.length}`);
      
      const result = await codeExecutor.execute(detectedLanguage, code, {
        timeout: 30000,
        maxMemory: 128 * 1024 * 1024
      });
      
      return res.json({
        success: result.exitCode === 0,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
        exitCode: result.exitCode,
        projectId,
        language: detectedLanguage
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Project direct execution failed: ${errorMessage}`);
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        output: '',
        executionTime: 0,
        exitCode: 1
      });
    }
  })();
});

/**
 * GET /api/execute/languages
 * Get list of supported languages for direct execution
 * SECURITY: Requires authentication to gate execution feature info
 * Returns all 27+ supported languages from the language configuration
 */
router.get('/execute/languages', ensureAuthenticated, async (req, res) => {
  // Import from languages config for full language support
  const { languageConfigs } = await import('../runtimes/languages');
  
  const languages = Object.entries(languageConfigs).map(([id, config]) => ({
    id,
    name: (config as any).displayName,
    extension: (config as any).fileExtensions[0],
    version: (config as any).version || undefined,
    icon: (config as any).icon
  }));
  
  res.json({ languages });
});

export default router;
