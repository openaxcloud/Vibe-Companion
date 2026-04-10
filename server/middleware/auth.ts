import { Request, Response, NextFunction } from 'express';

/**
 * SECURITY FIX: Fortune 500 grade authentication guard
 * 
 * - Relies ONLY on Passport session authentication
 * - NO development bypasses - all authentication must go through proper login flow
 * - Ensures consistent security in both development and production environments
 * 
 * To test authenticated routes during development:
 * 1. Use the login page at /auth with test credentials (testuser@test.com / testpass123)
 * 2. Session cookies will be maintained by your browser/client
 * 3. For API testing, use tools like Postman with cookie jar enabled
 */
export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check for valid Passport session only - no bypass mechanisms
  const isAuthenticated = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const hasUser = !!req.user;
  
  if (isAuthenticated && hasUser) {
    return next();
  }
  
  // No valid authentication found
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
export const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  // First check authentication
  const isAuthenticated = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const hasUser = !!req.user;
  
  if (!isAuthenticated || !hasUser) {
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