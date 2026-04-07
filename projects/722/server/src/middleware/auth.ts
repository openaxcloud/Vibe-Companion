import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { IncomingHttpHeaders } from "http";

const ACCESS_TOKEN_COOKIE_NAME = "access_token";
const AUTH_HEADER_PREFIX = "Bearer ";
const JWT_ALGORITHM = "HS256";

export type UserRole = "user" | "admin" | "manager" | "superadmin";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  roles?: UserRole[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Environment variable undefined is not set`);
  }
  return value;
};

const JWT_SECRET = getEnv("JWT_SECRET");

const extractTokenFromHeaders = (headers: IncomingHttpHeaders): string | null => {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  if (!authHeader.startsWith(AUTH_HEADER_PREFIX)) return null;
  return authHeader.slice(AUTH_HEADER_PREFIX.length).trim() || null;
};

const extractTokenFromCookies = (req: Request): string | null => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (!cookies) return null;
  const token = cookies[ACCESS_TOKEN_COOKIE_NAME];
  if (!token || typeof token !== "string") return null;
  return token.trim() || null;
};

const extractToken = (req: Request): string | null => {
  return extractTokenFromHeaders(req.headers) || extractTokenFromCookies(req);
};

const verifyJwtToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  });
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }
  const payload = decoded as AuthTokenPayload;
  if (!payload.sub) {
    throw new Error("Token missing subject");
  }
  return payload;
};

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const payload = verifyJwtToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req);
    if (!token) {
      next();
      return;
    }
    const payload = verifyJwtToken(token);
    req.user = payload;
  } catch {
    // ignore errors, treat as unauthenticated
  }
  next();
};

export const requireRoles =
  (requiredRoles: UserRole[] | UserRole) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!rolesArray.length) {
      next();
      return;
    }

    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userRoles = user.roles || [];
    const hasRole = rolesArray.some((role) => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }

    next();
  };

export const isAuthenticated = (req: AuthenticatedRequest): boolean => {
  try {
    const token = extractToken(req);
    if (!token) return false;
    const payload = verifyJwtToken(token);
    req.user = payload;
    return true;
  } catch {
    return false;
  }
};

export const getCurrentUser = (req: AuthenticatedRequest): AuthTokenPayload | null => {
  return req.user ?? null;
};