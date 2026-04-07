import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const getTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;

  return token;
};

const verifyToken = (token: string): AuthenticatedUser | null => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload | string;

    if (typeof decoded === 'string') {
      return { id: decoded };
    }

    const { sub, id, email, roles, ...rest } = decoded;

    const userId = (typeof sub === 'string' && sub) || (typeof id === 'string' && id);
    if (!userId) {
      return null;
    }

    const user: AuthenticatedUser = {
      id: userId,
    };

    if (typeof email === 'string') {
      user.email = email;
    }

    if (Array.isArray(roles)) {
      user.roles = roles;
    }

    Object.assign(user, rest);

    return user;
  } catch {
    return null;
  }
};

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = getTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token missing' });
    return;
  }

  let user: AuthenticatedUser | null;
  try {
    user = verifyToken(token);
  } catch (err) {
    // Configuration error, fail fast
    // eslint-disable-next-line no-console
    console.error('JWT verification configuration error:', err);
    res.status(500).json({ error: 'Authentication configuration error' });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired authorization token' });
    return;
  }

  req.user = user;
  next();
};

export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return next();
  }

  try {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('JWT verification configuration error (optional):', err);
  }

  next();
};

export const requireRoles =
  (requiredRoles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!requiredRoles.length) {
      next();
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }

    next();
  };

export const getUserFromRequest = (req: AuthenticatedRequest): AuthenticatedUser | undefined => {
  return req.user;
};