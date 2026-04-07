import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { IncomingHttpHeaders } from "http";

export interface AuthUserPayload extends JwtPayload {
  id: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

type TokenSource = "header" | "cookie";

const DEFAULT_COOKIE_NAME = "token";
const DEFAULT_HEADER_NAME = "authorization";
const DEFAULT_BEARER_PREFIX = "Bearer ";

export interface AuthMiddlewareOptions {
  jwtSecret: string;
  headerName?: string;
  cookieName?: string;
  algorithms?: jwt.Algorithm[];
  clockToleranceSeconds?: number;
  required?: boolean;
  tokenSourcePriority?: TokenSource[];
  /**
   * Custom function to resolve the raw token string if you need full control.
   * If provided and returns a non-empty string, it will be used in place of
   * default header/cookie parsing.
   */
  resolveToken?: (req: Request) => string | null | undefined;
}

/**
 * Extracts a bearer token from the Authorization header.
 */
const getTokenFromHeader = (
  headers: IncomingHttpHeaders,
  headerName: string
): string | null => {
  const value = headers[headerName.toLowerCase()];
  if (!value) return null;

  const headerValue = Array.isArray(value) ? value[0] : value;
  if (!headerValue) return null;

  if (headerValue.startsWith(DEFAULT_BEARER_PREFIX)) {
    return headerValue.substring(DEFAULT_BEARER_PREFIX.length).trim();
  }

  // Allow non-bearer raw token if needed
  return headerValue.trim() || null;
};

/**
 * Extracts a token from cookies.
 */
const getTokenFromCookies = (
  req: Request,
  cookieName: string
): string | null => {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  if (!cookies) return null;
  const token = cookies[cookieName];
  return token && token.trim().length > 0 ? token.trim() : null;
};

/**
 * Standardized unauthorized response helper.
 */
const unauthorized = (
  res: Response,
  message = "Unauthorized"
): Response => {
  return res.status(401).json({
    error: "unauthorized",
    message,
  });
};

/**
 * Standardized forbidden response helper.
 */
const forbidden = (res: Response, message = "Forbidden"): Response => {
  return res.status(403).json({
    error: "forbidden",
    message,
  });
};

/**
 * Core middleware factory to authenticate a request using JWT.
 */
export const authMiddleware =
  (options: AuthMiddlewareOptions) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const {
      jwtSecret,
      headerName = DEFAULT_HEADER_NAME,
      cookieName = DEFAULT_COOKIE_NAME,
      algorithms = ["HS256"],
      clockToleranceSeconds = 0,
      required = true,
      tokenSourcePriority = ["header", "cookie"],
      resolveToken,
    } = options;

    let token: string | null | undefined = null;

    if (typeof resolveToken === "function") {
      token = resolveToken(req);
    }

    if (!token) {
      for (const source of tokenSourcePriority) {
        if (source === "header") {
          token = getTokenFromHeader(req.headers, headerName);
        } else if (source === "cookie") {
          token = getTokenFromCookies(req, cookieName);
        }
        if (token) break;
      }
    }

    if (!token) {
      if (!required) {
        return next();
      }
      unauthorized(res, "Missing authentication token");
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms,
        clockTolerance: clockToleranceSeconds,
      }) as AuthUserPayload;

      // Basic sanity check: ensure id exists
      if (!decoded || typeof decoded.id !== "string") {
        if (!required) {
          return next();
        }
        unauthorized(res, "Invalid token payload");
        return;
      }

      req.user = decoded;
      return next();
    } catch (error) {
      if (!required) {
        return next();
      }
      unauthorized(res, "Invalid or expired token");
    }
  };

/**
 * Middleware requiring that the user is authenticated.
 * This assumes authMiddleware has already run and attached req.user.
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    unauthorized(res, "Authentication required");
    return;
  }
  next();
};

export interface RequireRoleOptions {
  /**
   * If true, user must have *all* of the specified roles.
   * If false (default), user must have *at least one* of the specified roles.
   */
  requireAll?: boolean;
  /**
   * If true, treat missing roles on user as forbidden (default).
   * If false, will treat as unauthorized.
   */
  missingRolesIsForbidden?: boolean;
}

/**
 * Role-based guard middleware factory.
 *
 * Example:
 *   router.get(
 *     "/admin",
 *     authMiddleware({ jwtSecret }),
 *     requireRoles(["admin"])
 *   );
 */
export const requireRoles =
  (
    roles: string[],
    options: RequireRoleOptions = {}
  ) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const {
      requireAll = false,
      missingRolesIsForbidden = true,
    } = options;

    if (!req.user) {
      unauthorized(res, "Authentication required");
      return;
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];

    if (userRoles.length === 0) {
      if (missingRolesIsForbidden) {
        forbidden(res, "Insufficient permissions");
      } else {
        unauthorized(res, "Roles not present in token");
      }
      return;
    }

    const normalizedUserRoles = new Set(
      userRoles.map((r) => r.toLowerCase().trim())
    );
    const normalizedRequiredRoles = roles.map((r) =>
      r.toLowerCase().trim()
    );

    let hasAccess = false;

    if (requireAll) {
      hasAccess = normalizedRequiredRoles.every((role) =>
        normalizedUserRoles.has(role)
      );
    } else {
      hasAccess = normalizedRequiredRoles.some((role) =>
        normalizedUserRoles.has(role)
      );
    }

    if (!hasAccess) {
      forbidden(res, "Insufficient permissions");
      return;
    }

    next();
  };

/**
 * Convenience guard for a single role string.
 */
export const requireRole = (
  role: string,
  options?: RequireRoleOptions
) => requireRoles([role], options);

/**
 * Utility to sign a JWT for a user payload.
 */
export interface SignTokenOptions {
  expiresIn?: string | number;
  algorithm?: jwt.Algorithm;
}

export const signAuthToken = (
  payload: AuthUserPayload,
  secret: string,
  options: SignTokenOptions = {}
): string => {
  const {
    expiresIn = "1h",
    algorithm = "HS256",
  } = options;

  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm,
  });
};

/**
 * Utility to decode a JWT without verification (useful for debugging/logging).
 * Do not use this for auth decisions.
 */
export const decodeToken = (token: string): null | JwtPayload | string => {
  return jwt.decode(token);
};