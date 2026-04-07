import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthUserPayload {
  id: string;
  email: string;
  role?: "user" | "admin" | string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  const cookieToken =
    (req as any).cookies?.token ||
    (req as any).cookies?.jwt ||
    (req as any).cookies?.access_token;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  return null;
};

const verifyToken = (token: string): AuthUserPayload => {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  const { id, email, role, ...rest } = decoded;
  if (!id || !email) {
    throw new Error("Token missing required fields");
  }

  return {
    id: String(id),
    email: String(email),
    role: role ? String(role) : undefined,
    ...rest,
  };
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return next();
    }

    const user = verifyToken(token);
    req.user = user;
    return next();
  } catch {
    return next();
  }
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = verifyToken(token);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = verifyToken(token);
    if (!user.role || user.role !== "admin") {
      res.status(403).json({ error: "Admin privileges required" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;