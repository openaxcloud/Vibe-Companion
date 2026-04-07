import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  roles: string[];
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface DecodedToken extends JwtPayload {
  id: string;
  roles?: string[];
}

const JWT_SECRET = process.env.JWT_SECRET || '';
const ACCESS_TOKEN_COOKIE_NAME = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const AUTH_HEADER_PREFIX = 'Bearer ';

if (!JWT_SECRET) {
  // Fail fast on boot if secret is not configured
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET is not set in environment variables');
  // In a real application, this would cause the process to exit during startup.
}

function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies && req.cookies[ACCESS_TOKEN_COOKIE_NAME]) || null;

  if (cookieToken && typeof cookieToken === 'string' && cookieToken.trim() !== '') {
    return cookieToken;
  }

  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return null;
  }

  const token = authHeader.substring(AUTH_HEADER_PREFIX.length).trim();
  return token || null;
}

function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    if (!decoded || !decoded.id) {
      return null;
    }

    const roles = Array.isArray(decoded.roles) ? decoded.roles : [];

    const user: AuthUser = {
      id: decoded.id,
      roles,
      ...decoded
    };

    return user;
  } catch {
    return null;
  }
}

/**
 * Middleware that attempts to authenticate the request if a valid token is present.
 * Does not enforce authentication; routes can still be accessed if unauthenticated.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  const user = verifyToken(token);
  if (!user) {
    return next();
  }

  req.user = user;
  return next();
}

/**
 * Middleware that enforces authentication. If no valid token is present,
 * responds with 401 Unauthorized.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token missing'
    });
  }

  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token'
    });
  }

  req.user = user;
  return next();
}

/**
 * Middleware factory that enforces that the authenticated user has at least one
 * of the required roles. Assumes requireAuth has already run or use chained.
 */
export function requireRole(requiredRoles: string | string[]) {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = rolesArray.some((r) => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    return next();
  };
}

/**
 * Convenience combined middleware: require authentication and specific roles.
 */
export function requireAuthWithRole(requiredRoles: string | string[]) {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token missing'
      });
    }

    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    req.user = user;

    const userRoles = req.user.roles || [];
    const hasRole = rolesArray.some((r) => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    return next();
  };
}