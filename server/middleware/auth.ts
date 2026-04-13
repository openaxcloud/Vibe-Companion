import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export const ensureAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const isAuthenticated = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const hasUser = !!req.user;

  if (isAuthenticated && hasUser) {
    return next();
  }

  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) {
    try {
      const user = await storage.getUser(sessionUserId);
      if (user) {
        (req as any).user = user;
        return next();
      }
    } catch {}
  }

  res.status(401).json({ 
    error: 'Authentication required',
    code: 'AUTH_REQUIRED'
  });
};

/**
 * Optional authentication middleware
 * Populates req.user if a valid session exists, but doesn't fail if not authenticated
 * Used for routes that have different behavior for authenticated vs anonymous users
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Just pass through - Passport middleware already populates req.user if session exists
  next();
};

/**
 * SECURITY FIX: Role-based admin check
 * Uses the 'role' field in the users table instead of weak email string matching
 * 
 * Allowed admin roles: 'admin', 'superadmin', 'owner'
 */
export const ensureAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    const sessionUserId = (req.session as any)?.userId;
    if (sessionUserId) {
      try {
        const user = await storage.getUser(sessionUserId);
        if (user) (req as any).user = user;
      } catch {}
    }
  }

  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check for admin role using database field (not email string matching)
  const user = req.user as { id: number; role?: string; email?: string };
  const adminRoles = ['admin', 'superadmin', 'owner'];
  
  if (user.role && adminRoles.includes(user.role.toLowerCase())) {
    return next();
  }
  
  // Denied - log for security audit
  console.warn(`[SECURITY] Admin access denied for user ${user.id} with role "${user.role || 'undefined'}"`);
  
  res.status(403).json({ 
    error: 'Admin access required',
    code: 'ADMIN_REQUIRED'
  });
};