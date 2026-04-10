/**
 * Helmet Security Configuration
 * Comprehensive security headers for production
 */

import helmet from 'helmet';

const isDev = process.env.NODE_ENV === 'development';

// Replit sets NODE_ENV=production even in the dev workspace preview.
// Detect Replit dev environment by checking for the riker/replit domain.
const isReplitDev = !!(
  process.env.REPL_ID ||
  process.env.REPL_SLUG ||
  process.env.REPLIT_DEV_DOMAIN
);

export const helmetConfig = helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com",
        "https://code.jquery.com",
        "https://js.stripe.com",
        "blob:"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:",
        "http://localhost:*"
      ],
      mediaSrc: ["'self'", "blob:", "data:"],
      connectSrc: [
        "'self'",
        "wss:",
        "ws:",
        "https:",
        "http://localhost:*",
        "https://api.anthropic.com",
        "https://api.openai.com",
        "https://*.googleapis.com",
        "https://*.replit.dev",
        "https://*.repl.co",
        "wss://*.replit.dev",
        "wss://*.repl.co"
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://*.replit.dev",
        "https://*.repl.co",
        "https://*.replit.app"
      ],
      objectSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      frameAncestors: [
        "'self'",
        "https://*.replit.dev",
        "https://*.repl.co",
        "https://*.replit.app",
        "https://replit.com"
      ],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      reportUri: '/api/security/csp-report'
    },
    reportOnly: false
  },
  // COEP: use 'credentialless' instead of 'require-corp' to allow cross-origin
  // resources (Google Fonts, CDN scripts etc.) without requiring CORP headers.
  // 'require-corp' broke Safari iOS by blocking fonts, images and scripts from CDNs.
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  // Allow iframe embedding from Replit preview (frameguard: deny breaks the preview pane)
  frameguard: isReplitDev ? false : { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

/**
 * Additional security headers not covered by Helmet
 */
export const additionalSecurityHeaders = (req: any, res: any, next: any) => {
  // Permissions Policy (replaces Feature-Policy)
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), ' +
    'magnetometer=(), accelerometer=(), gyroscope=(), ambient-light-sensor=(), ' +
    'autoplay=(), encrypted-media=(), picture-in-picture=(), sync-xhr=(), ' +
    'document-domain=(), interest-cohort=()'
  );
  
  // Additional security headers
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Expect-CT for certificate transparency (production only, not Replit preview)
  if (process.env.NODE_ENV === 'production' && !isReplitDev) {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }
  
  // Clear site data on logout
  if (req.path === '/api/logout' || req.path === '/api/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }
  
  // API-specific cache headers
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

/**
 * CSP Report handler
 */
export const cspReportHandler = (req: any, res: any) => {
  // Support both standard and Safari's CSP report format
  const body = req.body?.['csp-report'] || req.body || {};
  console.warn('[CSP Violation]', {
    documentUri: body['document-uri'],
    violatedDirective: body['violated-directive'] || body['effective-directive'],
    blockedUri: body['blocked-uri'],
    lineNumber: body['line-number'],
    columnNumber: body['column-number'],
    sourceFile: body['source-file'],
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(204).end();
};

/**
 * Security headers for development
 */
export const developmentSecurityHeaders = (req: any, res: any, next: any) => {
  // More relaxed CSP for development - report-only mode
  res.setHeader('Content-Security-Policy-Report-Only',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *; " +
    "style-src 'self' 'unsafe-inline' *; " +
    "img-src * data: blob:; " +
    "connect-src *; " +
    "font-src *; " +
    "frame-src *; " +
    "media-src *; " +
    "object-src 'none'; " +
    "report-uri /api/security/csp-report"
  );
  
  next();
};

/**
 * Apply security headers based on environment
 */
export const applySecurityHeaders = () => {
  const middleware: any[] = [];
  
  if (isDev) {
    middleware.push(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    middleware.push(developmentSecurityHeaders);
  } else {
    middleware.push(helmetConfig);
  }
  
  middleware.push(additionalSecurityHeaders);
  
  return middleware;
};
