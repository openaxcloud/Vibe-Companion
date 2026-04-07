import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface JwtConfig {
  secret: string;
  algorithms?: jwt.Algorithm[];
  clockToleranceSeconds?: number;
}

const DEFAULT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

const getTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) return null;

  if (!/^Bearer$/i.test(scheme)) return null;

  return token;
};

const verifyToken = (token: string, config: JwtConfig): AuthUser => {
  const { secret, algorithms = DEFAULT_ALGORITHMS, clockToleranceSeconds } = config;

  const decoded = jwt.verify(token, secret, {
    algorithms,
    clockTolerance: clockToleranceSeconds,
  }) as JwtPayload | string;

  if (typeof decoded === 'string') {
    return { id: decoded };
  }

  const { sub, email, roles, ...rest } = decoded;

  const id = (sub ?? decoded.id) as string | undefined;
  if (!id) {
    throw new Error('Invalid token: missing subject or id');
  }

  const user: AuthUser = {
    id,
    ...(email ? { email: String(email) } : {}),
    ...(Array.isArray(roles) ? { roles: roles.map(String) } : {}),
    ...rest,
  };

  return user;
};

const createUnauthorizedResponse = (res: Response, message = 'Unauthorized') => {
  return res.status(401).json({
    error: 'unauthorized',
    message,
  });
};

export const createAuthMiddleware = (config: JwtConfig) => {
  if (!config?.secret) {
    throw new Error('JWT secret must be provided to createAuthMiddleware');
  }

  const optional = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const token = getTokenFromHeader(req);
      if (!token) {
        return next();
      }

      const user = verifyToken(token, config);
      req.user = user;
      return next();
    } catch {
      // For optional auth we don't block the request; just proceed without user
      return next();
    }
  };

  const required = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = getTokenFromHeader(req);
      if (!token) {
        return createUnauthorizedResponse(res, 'Missing Authorization header');
      }

      const user = verifyToken(token, config);
      req.user = user;
      return next();
    } catch (err) {
      const message =
        err instanceof jwt.TokenExpiredError
          ? 'Token expired'
          : err instanceof jwt.JsonWebTokenError
          ? 'Invalid token'
          : 'Unauthorized';
      return createUnauthorizedResponse(res, message);
    }
  };

  return { optional, required };
};

export const withRequiredAuth =
  (config: JwtConfig) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return createAuthMiddleware(config).required(req, res, next);
  };

export const withOptionalAuth =
  (config: JwtConfig) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return createAuthMiddleware(config).optional(req, res, next);
  };