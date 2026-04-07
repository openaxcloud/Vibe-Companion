import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import cookie from "cookie";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: "user" | "admin" | string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookie.parse(cookieHeader);
    if (cookies.token) {
      return cookies.token;
    }
    if (cookies.access_token) {
      return cookies.access_token;
    }
  }

  if ((req as any).cookies) {
    const cookies = (req as any).cookies as Record<string, string>;
    if (cookies.token) {
      return cookies.token;
    }
    if (cookies.access_token) {
      return cookies.access_token;
    }
  }

  return null;
};

const verifyToken = (token: string): AuthUserPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload");
    }

    const { id, email, role, ...rest } = decoded;

    if (!id || !email) {
      throw new Error("Token payload missing required fields");
    }

    return {
      id: String(id),
      email: String(email),
      role: (role as string) || "user",
      ...rest,
    };
  } catch (err) {
    throw err;
  }
};

export const authenticate: (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token missing",
    });
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};

export const requireAuth = authenticate;

export const optionalAuth: (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void = (req, _res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const user = verifyToken(token);
    req.user = user;
  } catch {
  }

  return next();
};

export const requireAdmin: (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  return next();
};

export const attachUserIfPresent: (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void = optionalAuth;

export default {
  authenticate,
  requireAuth,
  optionalAuth,
  requireAdmin,
  attachUserIfPresent,
};