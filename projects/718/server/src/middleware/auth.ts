import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser | null;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) {
    return null;
  }

  if (!/^Bearer$/i.test(scheme)) {
    return null;
  }

  return token;
};

const extractTokenFromCookies = (req: Request): string | null => {
  const anyReq = req as Request & { cookies?: Record<string, string> };
  if (!anyReq.cookies) return null;

  const token =
    anyReq.cookies["token"] ||
    anyReq.cookies["jwt"] ||
    anyReq.cookies["access_token"];

  return typeof token === "string" && token.length > 0 ? token : null;
};

const extractToken = (req: Request): string | null => {
  const cookieToken = extractTokenFromCookies(req);
  if (cookieToken) return cookieToken;

  const headerToken = extractTokenFromHeader(req);
  return headerToken ?? null;
};

const verifyToken = (token: string): AuthUser | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;

    if (typeof decoded === "string") {
      return { id: decoded };
    }

    const { sub, id, userId, email, role, ...rest } = decoded;

    const userIdValue =
      (typeof id === "string" && id) ||
      (typeof userId === "string" && userId) ||
      (typeof sub === "string" && sub);

    if (!userIdValue) {
      return null;
    }

    const user: AuthUser = {
      id: userIdValue,
      ...(typeof email === "string" ? { email } : {}),
      ...(typeof role === "string" ? { role } : {}),
      ...rest,
    };

    return user;
  } catch {
    return null;
  }
};

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const user = verifyToken(token);
  req.user = user;
  return next();
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }

  next();
};

export const signJwt = (payload: object, options?: jwt.SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    ...(options || {}),
  });
};

export const decodeJwt = (token: string): JwtPayload | string | null => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};