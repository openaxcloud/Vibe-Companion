/**
 * Admin authentication middleware
 * Ensures only admin users can access protected routes
 * Uses role-based access control (role = 'admin' | 'user')
 */

import { Request, Response, NextFunction } from 'express';
import { getStorage } from '../storage';

/**
 * Helper function to check if a user has admin role
 */
export const isAdmin = (user: { role?: string | null }): boolean => {
  return user?.role === 'admin';
};

export const ensureAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    }

    const storage = getStorage();
    const userId = typeof req.user.id === 'number' ? String(req.user.id) : req.user.id;
    const user = await storage.getUser(userId);

    // Check if user has admin role
    if (!user || !isAdmin(user)) {
      return res.status(403).json({
        message: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      message: 'Authorization check failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const checkAdminStatus = async (userId: number | string): Promise<boolean> => {
  try {
    const storage = getStorage();
    const userIdStr = typeof userId === 'number' ? String(userId) : userId;
    const user = await storage.getUser(userIdStr);
    return isAdmin(user || {});
  } catch (error) {
    console.error('Admin status check error:', error);
    return false;
  }
};