import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, VerifyErrors } from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  [key: string]: unknown;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface DecodedToken extends JwtPayload {
  id: string;
  email: string;
  roles?: string[];
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return null;
  }

  return token;
};

const verifyToken = (token: string): DecodedToken => {
  return jwt.verify(token, JWT_SECRET) as DecodedToken;
};

export const authenticate =
  (options?: { required?: boolean }) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = extractTokenFromHeader(req);

    if (!token) {
      if (options?.required === false) {
        return next();
      }
      res.status(401).json({ message: 'Authorization token missing' });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: VerifyErrors | null, decoded: JwtPayload | undefined) => {
      if (err || !decoded) {
        res.status(401).json({ message: 'Invalid or expired authorization token' });
        return;
      }

      const payload = decoded as DecodedToken;

      if (!payload.id || !payload.email) {
        res.status(401).json({ message: 'Invalid token payload' });
        return;
      }

      req.user = {
        id: payload.id,
        email: payload.email,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        ...payload,
      };

      next();
    });
  };

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = extractTokenFromHeader(req);

  if (!token) {
    res.status(401).json({ message: 'Authorization token missing' });
    return;
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded.id || !decoded.email) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      ...decoded,
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired authorization token' });
  }
};

export const requireRoles =
  (...requiredRoles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!requiredRoles || requiredRoles.length === 0) {
      next();
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({ message: 'Forbidden: insufficient privileges' });
      return;
    }

    next();
  };

export const requireOrderManagementRole = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  requireRoles('admin', 'manager', 'order_manager')(req, res, next);
};

export default {
  authenticate,
  requireAuth,
  requireRoles,
  requireOrderManagementRole,
};