import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger('bootstrap-auth');

// Bootstrap token payload interface (matching workspace-bootstrap.router.ts)
interface BootstrapTokenPayload {
  projectId: string;
  conversationId: string;
  sessionId: string;
  userId: number;
  timestamp: number;
}

/**
 * Bootstrap Authentication Middleware
 * 
 * Allows anonymous users with a valid bootstrap token to access project resources.
 * This middleware should be used BEFORE ensureAuthenticated on endpoints that
 * need to support both authenticated users and anonymous bootstrap sessions.
 * 
 * Flow:
 * 1. Check for ?bootstrap=token query parameter
 * 2. Verify and decode the JWT token
 * 3. Validate token age (max 24 hours)
 * 4. Attach bootstrap context to request for downstream handlers
 * 5. Allow request to proceed (even if not authenticated via Passport)
 * 
 * Usage:
 * ```typescript
 * router.get('/api/projects/:id', bootstrapAuth, ensureAuthenticated, handler);
 * ```
 * 
 * Date: November 24, 2025
 * Context: Fix "Project not found" bug for anonymous bootstrap sessions
 */
export const bootstrapAuth = async (req: Request, res: Response, next: NextFunction) => {
  const bootstrapToken = req.query.bootstrap as string;
  
  if (!bootstrapToken) {
    // No bootstrap token - proceed normally (ensureAuthenticated will handle auth)
    return next();
  }
  
  try {
    logger.info('[Bootstrap Auth] Verifying bootstrap token', { 
      path: req.path,
      projectId: req.params.id 
    });
    
    // Verify JWT - SECURITY: Use centralized secrets manager
    const { getJwtSecret } = await import('../utils/secrets-manager');
    const decoded = jwt.verify(bootstrapToken, getJwtSecret()) as BootstrapTokenPayload;
    
    // Validate token age (max 24 hours)
    const ageMs = Date.now() - decoded.timestamp;
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    
    if (ageMs > maxAgeMs) {
      logger.warn('[Bootstrap Auth] Token expired', { ageMs, maxAgeMs });
      return res.status(401).json({ 
        error: 'Bootstrap token expired',
        message: 'This session has expired. Please create a new workspace.' 
      });
    }
    
    // Verify project ID matches if present in route params
    if (req.params.id && decoded.projectId !== req.params.id) {
      logger.warn('[Bootstrap Auth] Project ID mismatch', { 
        tokenProjectId: decoded.projectId,
        requestedProjectId: req.params.id 
      });
      return res.status(403).json({ 
        error: 'Invalid bootstrap token',
        message: 'This token is not valid for the requested project.' 
      });
    }
    
    // Attach bootstrap context to request
    (req as any).bootstrapContext = {
      projectId: decoded.projectId,
      conversationId: decoded.conversationId,
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      isBootstrapSession: true
    };
    
    logger.info('[Bootstrap Auth] ✅ Bootstrap token validated', { 
      projectId: decoded.projectId,
      userId: decoded.userId 
    });
    
    // Allow request to proceed (bypass ensureAuthenticated for this request)
    return next();
    
  } catch (error) {
    logger.error('[Bootstrap Auth] Token verification failed:', error);
    return res.status(401).json({ 
      error: 'Invalid bootstrap token',
      message: 'The bootstrap token is invalid or malformed.' 
    });
  }
};

/**
 * Helper to check if request has valid bootstrap context
 */
export const hasBootstrapContext = (req: Request): boolean => {
  return !!(req as any).bootstrapContext?.isBootstrapSession;
};

/**
 * Helper to get bootstrap context from request
 */
export const getBootstrapContext = (req: Request) => {
  return (req as any).bootstrapContext;
};
