import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
const AUTH_HEADER_PREFIX = 'Bearer ';
const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  // Fail fast on startup/misconfiguration
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET environment variable is not set');
  throw new Error('JWT_SECRET environment variable is required for auth middleware');
}

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return authHeader.substring(AUTH_HEADER_PREFIX.length).trim();
  }

  const cookies = (req as any).cookies as Record<string, string> | undefined;
  if (cookies && typeof cookies[ACCESS_TOKEN_COOKIE_NAME] === 'string') {
    return cookies[ACCESS_TOKEN_COOKIE_NAME];
  }

  return null;
};

const verifyToken = (token: string): AuthenticatedUser | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;

    if (typeof decoded === 'string') {
      return { id: decoded };
    }

    if (!decoded || (!decoded.sub && !decoded.id)) {
      return null;
    }

    const user: AuthenticatedUser = {
      id: String(decoded.sub ?? decoded.id),
    };

    if (decoded.email && typeof decoded.email === 'string') {
      user.email = decoded.email;
    }

    if (decoded.role && typeof decoded.role === 'string') {
      user.role = decoded.role;
    }

    // Attach any other scalar claims
    Object.keys(decoded).forEach((key) => {
      if (['sub', 'id', 'email', 'role', 'iat', 'exp', 'nbf', 'aud', 'iss', 'jti'].includes(key)) {
        return;
      }
      const value = decoded[key];
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        user[key] = value;
      }
    });

    return user;
  } catch {
    return null;
  }
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  const user = verifyToken(token);

  if (user) {
    req.user = user;
  }

  next();
};

export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }

    next();
  };
};

export default authMiddleware;