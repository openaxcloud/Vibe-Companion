import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload as DefaultJwtPayload } from "jsonwebtoken";

export interface JwtUserPayload extends DefaultJwtPayload {
  id: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

const AUTH_HEADER_PREFIX = "Bearer ";
const ADMIN_ROLES = new Set<string>(["admin", "superadmin"]);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail fast on startup misconfiguration
  throw new Error("JWT_SECRET environment variable is required for auth middleware");
}

const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  if (!authHeader.startsWith(AUTH_HEADER_PREFIX)) return null;
  return authHeader.substring(AUTH_HEADER_PREFIX.length).trim() || null;
};

const extractTokenFromCookies = (req: Request): string | null => {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  if (!cookies) return null;

  // Common cookie name options
  const possibleNames = ["token", "jwt", "access_token", "accessToken"];
  for (const name of possibleNames) {
    if (cookies[name]) return cookies[name];
  }

  return null;
};

const verifyJwtToken = (token: string): JwtUserPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
    if (!decoded || typeof decoded !== "object") return null;
    if (!decoded.id) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const authMiddleware = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const tokenFromCookie = extractTokenFromCookies(req);
  const tokenFromHeader = extractTokenFromHeader(req);
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    req.user = undefined;
    return next();
  }

  const user = verifyJwtToken(token);
  if (!user) {
    req.user = undefined;
    return next();
  }

  req.user = user;
  return next();
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const role = (req.user.role || "").toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }

  next();
};

export const signJwt = (payload: Omit<JwtUserPayload, "iat" | "exp">, options?: jwt.SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    ...options,
  });
};

export const getUserFromRequest = (req: AuthenticatedRequest): JwtUserPayload | null => {
  return req.user ?? null;
};

export default authMiddleware;