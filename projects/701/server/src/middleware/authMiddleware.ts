import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthUserPayload {
  id: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

const AUTH_HEADER_PREFIX = "Bearer ";
const ACCESS_TOKEN_COOKIE_NAME = "access_token";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not defined");
}

const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  if (!authHeader.startsWith(AUTH_HEADER_PREFIX)) return null;

  const token = authHeader.slice(AUTH_HEADER_PREFIX.length).trim();
  return token || null;
};

const extractTokenFromCookies = (req: Request): string | null => {
  const cookies = (req as any).cookies || {};
  const token = cookies[ACCESS_TOKEN_COOKIE_NAME];
  if (!token || typeof token !== "string") return null;
  return token;
};

const verifyToken = (token: string): AuthUserPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;
    if (typeof decoded === "string") {
      return { id: decoded };
    }
    const payload: AuthUserPayload = {
      id: typeof decoded.sub === "string" ? decoded.sub : (decoded.id as string),
    };
    if (decoded.email && typeof decoded.email === "string") {
      payload.email = decoded.email;
    }
    if (decoded.role && typeof decoded.role === "string") {
      payload.role = decoded.role;
    }
    for (const [key, value] of Object.entries(decoded)) {
      if (!(key in payload)) {
        (payload as any)[key] = value;
      }
    }
    return payload;
  } catch {
    return null;
  }
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const tokenFromHeader = extractTokenFromHeader(req);
  const tokenFromCookies = extractTokenFromCookies(req);
  const token = tokenFromHeader || tokenFromCookies;

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication token is missing",
    });
    return;
  }

  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired authentication token",
    });
    return;
  }

  req.user = user;
  next();
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const tokenFromHeader = extractTokenFromHeader(req);
  const tokenFromCookies = extractTokenFromCookies(req);
  const token = tokenFromHeader || tokenFromCookies;

  if (!token) {
    return next();
  }

  const user = verifyToken(token);

  if (user) {
    req.user = user;
  }

  next();
};