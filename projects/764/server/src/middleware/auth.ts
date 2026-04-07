import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

export interface AuthRequest extends Request {
  user?: AuthUser | null;
}

const ACCESS_TOKEN_COOKIE = "access_token";
const AUTH_HEADER_PREFIX = "Bearer ";

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  // Fail fast at startup if secret is not configured
  // This ensures security misconfigurations are caught early.
  // eslint-disable-next-line no-console
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  throw new Error("JWT_SECRET environment variable is required");
}

const isJwtPayload = (decoded: string | JwtPayload): decoded is JwtPayload => {
  return typeof decoded === "object" && decoded !== null;
};

const parseTokenFromRequest = (req: Request): string | null => {
  const cookieHeader = (req as Request).headers?.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
      const [name, ...rest] = part.trim().split("=");
      if (!name) return acc;
      acc[name] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});
    if (cookies[ACCESS_TOKEN_COOKIE]) {
      return cookies[ACCESS_TOKEN_COOKIE];
    }
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return authHeader.substring(AUTH_HEADER_PREFIX.length).trim();
  }

  return null;
};

export const verifyToken = (token: string): AuthUser | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!isJwtPayload(decoded)) {
      return null;
    }

    const { sub, email, role, ...rest } = decoded;

    if (!sub || typeof sub !== "string") {
      return null;
    }

    const normalizedRole: UserRole =
      role === "admin" ? "admin" : "user";

    const user: AuthUser = {
      id: sub,
      email: typeof email === "string" ? email : "",
      role: normalizedRole,
      ...rest
    };

    return user;
  } catch {
    return null;
  }
};

export const attachUser: (req: AuthRequest, res: Response, next: NextFunction) => void = (
  req,
  _res,
  next
) => {
  const token = parseTokenFromRequest(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const user = verifyToken(token);
  req.user = user;
  return next();
};

export const requireAuth =
  (...allowedRoles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = parseTokenFromRequest(req);

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let user: AuthUser | null = null;
    try {
      user = verifyToken(token);
    } catch {
      user = null;
    }

    if (!user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }

    req.user = user;
    next();
  };

export const requireUser = requireAuth("user", "admin");
export const requireAdmin = requireAuth("admin");