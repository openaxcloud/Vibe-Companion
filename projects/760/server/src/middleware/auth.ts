import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail fast on startup if secret is not provided
  throw new Error("JWT_SECRET environment variable is required");
}

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export type AuthMode = "required" | "optional";

export interface VerifyTokenOptions {
  ignoreExpiration?: boolean;
}

export const signAuthToken = (
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  options?: SignOptions
): string => {
  const defaultOptions: SignOptions = {
    algorithm: "HS256",
    expiresIn: "1h",
  };

  return jwt.sign(payload, JWT_SECRET, { ...defaultOptions, ...options });
};

const extractBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  const [scheme, token] = authHeader.trim().split(" ");
  if (!scheme || !token) return null;
  if (!/^Bearer$/i.test(scheme)) return null;

  return token;
};

const verifyToken = (
  token: string,
  options?: VerifyTokenOptions
): AuthTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: options?.ignoreExpiration ?? false,
    });
    if (typeof decoded === "string") {
      return null;
    }
    return decoded as AuthTokenPayload;
  } catch {
    return null;
  }
};

export const authMiddleware =
  (mode: AuthMode = "required") =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);

    if (!token) {
      if (mode === "optional") {
        req.user = undefined;
        return next();
      }
      res.status(401).json({ error: "Authorization token missing" });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      if (mode === "optional") {
        req.user = undefined;
        return next();
      }
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = payload;
    next();
  };

export const requireAuth = authMiddleware("required");
export const optionalAuth = authMiddleware("optional");