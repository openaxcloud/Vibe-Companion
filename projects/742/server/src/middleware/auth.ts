import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

const JWT_SECRET = process.env.JWT_SECRET || "";
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

if (!JWT_SECRET) {
  // Fail fast on startup if secret is not configured
  // eslint-disable-next-line no-console
  console.error("FATAL: JWT_SECRET is not set in environment variables.");
  process.exit(1);
}

export interface AuthTokenPayload extends JwtPayload {
  id: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  tokenPayload: AuthTokenPayload;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser | null;
  }
}

const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;

  if (/^Bearer$/i.test(scheme)) {
    return token.trim();
  }

  return null;
};

const extractToken = (req: Request): string | null => {
  const headerToken = extractTokenFromHeader(req);
  if (headerToken) return headerToken;

  const cookieToken =
    (req.cookies && (req.cookies[AUTH_COOKIE_NAME] as string | undefined)) ||
    (req.signedCookies &&
      (req.signedCookies[AUTH_COOKIE_NAME] as string | undefined));

  return cookieToken || null;
};

const verifyToken = (token: string): AuthTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string") return null;
    if (!decoded.id) return null;
    return decoded as AuthTokenPayload;
  } catch {
    return null;
  }
};

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const payload = verifyToken(token);
  if (!payload) {
    req.user = null;
    return next();
  }

  const user: AuthenticatedUser = {
    id: String(payload.id),
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : undefined,
    tokenPayload: payload,
  };

  req.user = user;
  return next();
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }
  next();
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  const role = req.user.role || req.user.tokenPayload.role;
  if (!role || role.toLowerCase() !== "admin") {
    res.status(StatusCodes.FORBIDDEN).json({
      error: "Forbidden",
      message: "Admin privileges required",
    });
    return;
  }

  next();
};

export default {
  authenticate,
  requireAuth,
  requireAdmin,
};