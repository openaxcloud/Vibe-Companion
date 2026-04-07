import { Request, Response, NextFunction } from "express";

type SecurityHeadersOptions = {
  frameOptions?: "DENY" | "SAMEORIGIN" | "";
  contentTypeOptions?: "nosniff" | "";
  xssProtection?: "0" | "1; mode=block" | "";
  referrerPolicy?:
    | ""
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";
  permissionsPolicy?: string;
  contentSecurityPolicy?: string;
  strictTransportSecurity?: string;
  hidePoweredBy?: boolean;
};

const defaultOptions: Required<SecurityHeadersOptions> = {
  frameOptions: "SAMEORIGIN",
  contentTypeOptions: "nosniff",
  xssProtection: "0",
  referrerPolicy: "no-referrer",
  permissionsPolicy: "geolocation=(), microphone=(), camera=()",
  // NOTE: This is a safe placeholder CSP; adjust based on application needs.
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
  ].join("; "),
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  hidePoweredBy: true,
};

export const securityHeaders =
  (options: SecurityHeadersOptions = {}) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const config: Required<SecurityHeadersOptions> = {
      ...defaultOptions,
      ...options,
    };

    if (config.hidePoweredBy) {
      res.removeHeader("X-Powered-By");
    }

    if (config.frameOptions) {
      res.setHeader("X-Frame-Options", config.frameOptions);
    }

    if (config.contentTypeOptions) {
      res.setHeader("X-Content-Type-Options", config.contentTypeOptions);
    }

    if (config.xssProtection) {
      res.setHeader("X-XSS-Protection", config.xssProtection);
    }

    if (config.referrerPolicy) {
      res.setHeader("Referrer-Policy", config.referrerPolicy);
    }

    if (config.permissionsPolicy) {
      res.setHeader("Permissions-Policy", config.permissionsPolicy);
    }

    if (config.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", config.contentSecurityPolicy);
    }

    if (config.strictTransportSecurity && req.secure) {
      res.setHeader("Strict-Transport-Security", config.strictTransportSecurity);
    }

    next();
  };

export default securityHeaders;