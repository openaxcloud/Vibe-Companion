import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: "user" | "admin" | string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const getTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (!/^Bearer$/i.test(scheme)) return null;

  return token;
};

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      res.status(401).json({ message: "Authentication token missing" });
      return;
    }

    let decoded: JwtPayload | string;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    const payload = decoded as JwtPayload;

    if (!payload || typeof payload !== "object") {
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    const userPayload: AuthUserPayload = {
      id: String(payload.id ?? payload.sub ?? ""),
      email: String(payload.email ?? ""),
      role: (payload.role as AuthUserPayload["role"]) ?? "user",
    };

    if (!userPayload.id) {
      res.status(401).json({ message: "Invalid token: missing user id" });
      return;
    }

    req.user = userPayload;

    next();
  } catch (error) {
    // Fallback in case of unexpected error
    // eslint-disable-next-line no-console
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Internal authentication error" });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Admin role required" });
    return;
  }

  next();
};

export const generateToken = (payload: AuthUserPayload, options?: jwt.SignOptions): string => {
  const token = jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
      ...options,
    }
  );
  return token;
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = getTokenFromHeader(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userPayload: AuthUserPayload = {
      id: String(decoded.id ?? decoded.sub ?? ""),
      email: String(decoded.email ?? ""),
      role: (decoded.role as AuthUserPayload["role"]) ?? "user",
    };

    if (userPayload.id) {
      req.user = userPayload;
    }
  } catch {
    // Ignore invalid token for optional auth
  }

  next();
};