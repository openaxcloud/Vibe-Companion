import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Socket } from "socket.io";

export interface AuthUserPayload {
  id: string;
  email: string;
  roles?: string[];
  [key: string]: unknown;
}

interface DecodedToken extends JwtPayload {
  user: AuthUserPayload;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUserPayload;
    token?: string;
  }
}

declare module "socket.io" {
  interface Socket {
    user?: AuthUserPayload;
    token?: string;
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const AUTH_HEADER_PREFIX = "Bearer ";

const extractTokenFromHeader = (header?: string): string | null => {
  if (!header) return null;
  if (!header.startsWith(AUTH_HEADER_PREFIX)) return null;
  const token = header.slice(AUTH_HEADER_PREFIX.length).trim();
  return token || null;
};

const verifyToken = (token: string): AuthUserPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken | JwtPayload | string;

    if (typeof decoded === "string" || !decoded) {
      throw new Error("Invalid token payload");
    }

    const userPayload: AuthUserPayload | undefined =
      "user" in decoded ? (decoded.user as AuthUserPayload) : (decoded as unknown as AuthUserPayload);

    if (!userPayload || !userPayload.id) {
      throw new Error("Token missing required user payload");
    }

    return userPayload;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization || req.headers.Authorization;
    const token = extractTokenFromHeader(typeof header === "string" ? header : undefined);

    if (!token) {
      res.status(401).json({ error: "Authorization token missing" });
      return;
    }

    const user = verifyToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization || req.headers.Authorization;
    const token = extractTokenFromHeader(typeof header === "string" ? header : undefined);

    if (!token) {
      return next();
    }

    const user = verifyToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (_error) {
    next();
  }
};

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void): void => {
  try {
    // Token can come from handshake auth or query
    const authToken =
      (socket.handshake.auth && (socket.handshake.auth.token as string | undefined)) ||
      (socket.handshake.query && (socket.handshake.query.token as string | undefined));

    const token =
      extractTokenFromHeader(authToken) ||
      // Allow raw token without "Bearer " prefix for Socket.IO
      (typeof authToken === "string" && authToken.trim() ? authToken.trim() : null);

    if (!token) {
      return next(new Error("Authentication error: token missing"));
    }

    const user = verifyToken(token);
    socket.user = user;
    socket.token = token;

    next();
  } catch (_error) {
    next(new Error("Authentication error: invalid or expired token"));
  }
};

export const generateToken = (user: AuthUserPayload, expiresIn: string | number = "7d"): string => {
  const payload: DecodedToken = {
    user,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export default {
  authMiddleware,
  optionalAuthMiddleware,
  socketAuthMiddleware,
  generateToken,
};