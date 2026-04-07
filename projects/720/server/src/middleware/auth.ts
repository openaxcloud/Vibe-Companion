import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthUserPayload extends JwtPayload {
  id: string;
  email?: string;
  roles?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

const AUTH_HEADER_PREFIX = "Bearer ";

const getTokenFromHeader = (req: Request): string | null => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith(AUTH_HEADER_PREFIX)) return null;
  const token = header.slice(AUTH_HEADER_PREFIX.length).trim();
  return token || null;
};

const verifyToken = (token: string): AuthUserPayload => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT access secret is not configured");
  }

  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  // Ensure required fields
  const { id } = decoded as JwtPayload & { id?: unknown };
  if (!id || typeof id !== "string") {
    throw new Error("Token payload missing required subject");
  }

  return decoded as AuthUserPayload;
};

export const authenticate =
  () => (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const token = getTokenFromHeader(req);
      if (!token) {
        res.status(401).json({ error: "Authorization token missing or malformed" });
        return;
      }

      let payload: AuthUserPayload;
      try {
        payload = verifyToken(token);
      } catch (err) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      req.user = payload;
      next();
    } catch (err) {
      // Fail closed with generic error
      // Avoid leaking internal details
      res.status(500).json({ error: "Authentication error" });
    }
  };

export const requireRole =
  (roles: string | string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!requiredRoles.length) {
      next();
      return;
    }

    const userRoles = req.user.roles ?? [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };

export const optionalAuthenticate =
  () => (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const token = getTokenFromHeader(req);
    if (!token) {
      next();
      return;
    }

    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Ignore invalid token in optional auth
    }

    next();
  };