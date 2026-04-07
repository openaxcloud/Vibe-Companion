import express, { NextFunction, Request, Response } from "express";
import rateLimit, { Options as RateLimitOptions } from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import cookieParser from "cookie-parser";

export interface SecurityConfig {
  rateLimit?: {
    windowMs?: number;
    max?: number;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    message?: string | object;
    skipSuccessfulRequests?: boolean;
  };
  trustProxy?: boolean;
  xss?: {
    enabled?: boolean;
  };
}

export const defaultSecurityConfig: Required<SecurityConfig> = {
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests, please try again later.",
    },
    skipSuccessfulRequests: false,
  },
  trustProxy: true,
  xss: {
    enabled: true,
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const sanitizeString = (value: string): string => {
  const trimmed = value.trim();
  const withoutControlChars = trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  const sanitized = xss(withoutControlChars, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "iframe", "object"],
  });
  return sanitized;
};

const deepSanitize = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepSanitize(item));
  }

  if (isPlainObject(value)) {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Avoid prototype pollution
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      sanitizedObj[key] = deepSanitize(val);
    }
    return sanitizedObj;
  }

  return value;
};

export const inputSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === "object") {
    req.body = deepSanitize(req.body) as typeof req.body;
  }

  if (req.query && typeof req.query === "object") {
    req.query = deepSanitize(req.query) as typeof req.query;
  }

  if (req.params && typeof req.params === "object") {
    req.params = deepSanitize(req.params) as typeof req.params;
  }

  next();
};

export const configureRateLimiter = (config?: SecurityConfig["rateLimit"]) => {
  const merged: RateLimitOptions = {
    windowMs: config?.windowMs ?? defaultSecurityConfig.rateLimit.windowMs,
    max: config?.max ?? defaultSecurityConfig.rateLimit.max,
    standardHeaders:
      config?.standardHeaders ?? defaultSecurityConfig.rateLimit.standardHeaders,
    legacyHeaders:
      config?.legacyHeaders ?? defaultSecurityConfig.rateLimit.legacyHeaders,
    message: config?.message ?? defaultSecurityConfig.rateLimit.message,
    skipSuccessfulRequests:
      config?.skipSuccessfulRequests ??
      defaultSecurityConfig.rateLimit.skipSuccessfulRequests,
  };

  return rateLimit(merged);
};

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
    },
  },
  referrerPolicy: { policy: "no-referrer" },
  crossOriginResourcePolicy: { policy: "same-site" },
});

export const csrfDocs = {
  /**
   * CSRF CONSIDERATIONS FOR COOKIE-BASED AUTH
   *
   * 1. Use SameSite cookies for session/auth tokens:
   *    - Prefer `SameSite=Strict` where possible; `Lax` for compatibility.
   *    - Always set `Secure` in production and `HttpOnly` for auth cookies.
   *
   * 2. Use a CSRF token for state-changing requests:
   *    - Generate a CSRF token per session or per request.
   *    - Store the token server-side (session, cache, DB) or sign/encrypt it.
   *    - Send the token to the client via:
   *        a. A non-HttpOnly cookie (e.g., "XSRF-TOKEN"), or
   *        b. An authenticated JSON endpoint (e.g., GET /auth/csrf-token).
   *    - Clients must send the token back via:
   *        a. A custom header (e.g., "X-CSRF-Token"), or
   *        b. A request body field (for forms).
   *
   * 3. Validation strategy:
   *    - For each state-changing request (POST, PUT, PATCH, DELETE):
   *        a. Read CSRF token from header or body.
   *        b. Verify the token against:
   *             - Server-side store, or
   *             - Cryptographic signature (HMAC with secret).
   *        c. Reject with 403 on mismatch or missing token.
   *
   * 4. Defense-in-depth:
   *    - Ensure CORS configuration does NOT allow arbitrary origins with
   *      credentials: true. Lock down allowed origins.
   *    - Prefer short-lived session/auth cookies and rotation.
   *    - Log suspicious CSRF validation failures.
   *
   * Note:
   * This module does not enforce CSRF protection directly so the application
   * can choose an appropriate implementation (e.g., `csurf`, custom tokens,
   * or framework-level protection). The rest of the middleware here is
   * designed to be compatible with a token-based CSRF solution.
   */
  enabledByDesign: true,
};

export const securityMiddleware = (config?: SecurityConfig) => {
  const mergedConfig: Required<SecurityConfig> = {
    rateLimit: {
      ...defaultSecurityConfig.rateLimit,
      ...(config?.rateLimit ?? {}),
    },
    trustProxy: config?.trustProxy ?? defaultSecurityConfig.trustProxy,
    xss: {
      ...defaultSecurityConfig.xss,
      ...(config?.xss ?? {}),
    },
  };

  const router = express.Router();

  if (mergedConfig.trustProxy) {
    // The application must also set `app.set('trust proxy', true)` at the
    // top level; this is a safeguard if used at router-level.
    router.use((req, _res, next) => {
      if (!req.app.get("trust proxy")) {
        req.app.set("trust proxy", 1);
      }
      next();
    });
  }

  router.use(helmetMiddleware);
  router.use(cookieParser());
  router.use(
    mongoSanitize({
      allowDots: true,
      replaceWith: "_",
    })
  );

  if (mergedConfig.xss.enabled) {
    router.use(inputSanitizer);
  }

  router.use(configureRateLimiter(mergedConfig.rateLimit));

  return router;
};

export default securityMiddleware;