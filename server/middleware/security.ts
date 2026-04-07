/**
 * Security Middleware
 * Fortune 500-grade security implementation with enhanced protections
 */

import helmet from 'helmet';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';
import { 
  xssProtection, 
  sqlInjectionPrevention, 
  pathTraversalPrevention,
  requestValidation,
  rateLimiting,
  outputEncoding,
  tokenSecurity
} from '../utils/security';
import { securityMonitoring as securityMonitoringService } from '../services/security-monitoring';

const logger = createLogger('security');

/**
 * Content Security Policy Configuration
 * SECURITY: Production CSP removes ALL unsafe directives
 */

interface CSPDirectives {
  [key: string]: string[] | undefined;
}

// Base CSP directives shared between dev and prod
const baseCSPDirectives = {
  defaultSrc: ["'self'"],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com",
    "data:"
  ],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: ["'self'", "https://js.stripe.com"],
  workerSrc: ["'self'", "blob:"],
  childSrc: ["'self'", "blob:"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  manifestSrc: ["'self'"],
  blockAllMixedContent: [],
};

// PRODUCTION CSP: NO unsafe-inline or unsafe-eval
// Uses nonce-based approach for inline scripts/styles
const productionCSPDirectives: CSPDirectives = {
  ...baseCSPDirectives,
  scriptSrc: [
    "'self'",
    "'nonce-{{nonce}}'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://unpkg.com",
    "https://js.stripe.com"
  ],
  styleSrc: [
    "'self'",
    "'nonce-{{nonce}}'", // Nonce for inline styles
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net"
    // NO 'unsafe-inline' in production
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:"
  ],
  connectSrc: [
    "'self'",
    "wss:",
    "https://api.anthropic.com",
    "https://*.googleapis.com",
    "https://api.stripe.com"
  ],
  upgradeInsecureRequests: [],
  reportUri: ['/api/security/csp-report']
};

// DEVELOPMENT CSP: More permissive for rapid development
// Includes unsafe directives ONLY in development
const developmentCSPDirectives: CSPDirectives = {
  ...baseCSPDirectives,
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Allowed ONLY in development for HMR
    "'unsafe-eval'", // Allowed ONLY in development for dev tools
    "'nonce-{{nonce}}'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://unpkg.com"
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Allowed ONLY in development for HMR
    "'nonce-{{nonce}}'",
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net"
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "http://localhost:*" // Allow localhost images in dev
  ],
  connectSrc: [
    "'self'",
    "ws://localhost:*", // WebSocket for HMR
    "http://localhost:*", // HTTP for dev server
    "wss:",
    "https://api.anthropic.com",
    "https://*.googleapis.com"
  ],
  reportUri: ['/api/security/csp-report']
};

/**
 * Get CSP directives based on environment
 * SECURITY: Production automatically uses secure directives
 */
function getCSPDirectives(): CSPDirectives {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? productionCSPDirectives : developmentCSPDirectives;
}

/**
 * Generate CSP nonce for inline scripts/styles
 * Nonce is regenerated for each request for security
 */
const generateCSPNonce = (req: Request, res: Response, next: NextFunction) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
};

/**
 * Build CSP header string from directives
 * Replaces nonce placeholders with actual nonce value
 */
function buildCSPHeader(directives: CSPDirectives, nonce: string): string {
  const processedDirectives: Record<string, string> = {};
  
  for (const [key, values] of Object.entries(directives)) {
    if (!values) {
      continue;
    }
    
    // Handle string values (e.g., reportUri)
    if (typeof values === 'string') {
      processedDirectives[key] = values;
      continue;
    }
    
    // Handle array values
    if (Array.isArray(values)) {
      if (values.length === 0) {
        // Empty directive (e.g., blockAllMixedContent)
        processedDirectives[key] = '';
        continue;
      }
      
      // Replace nonce placeholder with actual nonce
      const processedValues = values.map(value => 
        value === "'nonce-{{nonce}}'" ? `'nonce-${nonce}'` : value
      );
      
      processedDirectives[key] = processedValues.join(' ');
    }
  }
  
  // Convert camelCase to kebab-case and build header
  return Object.entries(processedDirectives)
    .map(([key, value]) => {
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return value ? `${directive} ${value}` : directive;
    })
    .join('; ');
}

/**
 * Apply Content Security Policy middleware
 * SECURITY: Automatically uses secure directives in production
 * DEVELOPMENT: CSP disabled for Vite HMR compatibility
 */
function applyCSP(req: Request, res: Response, next: NextFunction) {
  const nonce = res.locals.cspNonce;
  const directives = getCSPDirectives();
  const cspHeader = buildCSPHeader(directives, nonce);

  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
  } else {
    res.setHeader('Content-Security-Policy', cspHeader);
  }

  if (process.env.CSP_REPORT_ONLY === 'true') {
    res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
  }

  next();
}

/**
 * Enhanced security middleware stack
 * SECURITY: CSP is ALWAYS applied (dev and production)
 */
export const securityMiddleware = (): RequestHandler[] => {
  const middlewares: RequestHandler[] = [];
  
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Generate CSP nonce first (required for CSP)
  middlewares.push(generateCSPNonce);

  // 2. Apply Content Security Policy (ALWAYS - no exceptions)
  middlewares.push(applyCSP);

  // 3. Enhanced Helmet configuration (CSP handled separately)
  // Note: Helmet v8+ removed deprecated options: expectCt, ieNoOpen, xssFilter
  middlewares.push(helmet({
    contentSecurityPolicy: false, // We handle CSP ourselves for nonce support
    crossOriginEmbedderPolicy: isProduction,
    crossOriginOpenerPolicy: isProduction ? { policy: "same-origin" } : { policy: "unsafe-none" },
    crossOriginResourcePolicy: isProduction ? { policy: "same-origin" } : { policy: "cross-origin" },
    originAgentCluster: true,
    hsts: isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    dnsPrefetchControl: { allow: false },
    xFrameOptions: isProduction ? { action: 'deny' } : false,
    xPoweredBy: false,
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' }
  }));

  // Enhanced security headers
  middlewares.push((req: Request, res: Response, next: NextFunction) => {
    if (isProduction) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Enhanced Permissions policy (only current valid features, no deprecated ones)
    // Note: Feature-Policy header removed as it's deprecated and causes conflicts
    res.setHeader('Permissions-Policy', 
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), ' +
      'accelerometer=(), gyroscope=(), autoplay=(), ' +
      'encrypted-media=(), picture-in-picture=(), interest-cohort=()'
    );
    
    // Additional security headers
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
    
    // Clear site data on logout
    if (req.path === '/api/logout') {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    
    // API-specific headers
    if (req.path.startsWith('/api')) {
      res.setHeader('X-API-Version', '1.0');
      res.setHeader('X-RateLimit-Policy', 'https://docs.e-code.ai/rate-limits');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Add request ID for tracing
    const requestId = crypto.randomBytes(16).toString('hex');
    res.setHeader('X-Request-ID', requestId);
    (req as any).requestId = requestId;
    
    next();
  });

  return middlewares;
};

// Enhanced CSRF protection with double-submit cookie pattern
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const isApiRequest = req.path.startsWith('/api');
  
  // Skip CSRF for public endpoints
  if (req.path.startsWith('/api/public') || req.path.startsWith('/api/health')) {
    return next();
  }

  // Skip CSRF for anonymous telemetry ingestion (fire-and-forget, no state-change)
  if (req.path === '/api/logs/ingest') {
    return next();
  }

  // Generate CSRF token for GET requests
  if (req.method === 'GET' && !isApiRequest) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf-token', token, {
      httpOnly: false, // Needs to be readable by JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
  }
  
  // Verify CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const headerToken = req.headers['x-csrf-token'] as string;
    const cookieToken = (req as any).cookies?.['csrf-token'];
    
    // For API requests, only skip CSRF if request has a valid session
    // SECURITY: Never skip CSRF based on Bearer token alone - must verify authentication
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // Check if the request has an authenticated session (set by passport)
      const user = (req as any).user;
      if (user && user.id) {
        // User is authenticated via session, safe to skip CSRF for API requests
        return next();
      }
      // No valid session - continue with CSRF validation
      // This prevents attackers from bypassing CSRF with fake Bearer tokens
      logger.warn('Bearer token without valid session, requiring CSRF validation', {
        ip: req.ip,
        path: req.path
      });
    }
    
    if (!headerToken || headerToken !== cookieToken) {
      logger.warn('CSRF token validation failed', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken
      });
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
}

// Input sanitization
// A9-FIX: Code-content fields must NOT have angle brackets stripped.
// Stripping <> from code/content fields corrupts HTML, JSX, TypeScript generics (Array<string>),
// SQL (<, >), and any markup. Sanitise execution vectors (script tags, JS protocol, event handlers)
// for all fields, but preserve angle brackets in fields that carry code or markup content.
const CODE_CONTENT_FIELDS = new Set([
  'content', 'code', 'source', 'body', 'template', 'html', 'css', 'js',
  'typescript', 'javascript', 'python', 'markup', 'text', 'data', 'value',
  'message', 'description', 'snippet', 'script', 'sql', 'query', 'expression',
  'output', 'input', 'prompt', 'response', 'result',
]);

export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (value: any, fieldKey?: string): any => {
    if (typeof value === 'string') {
      let sanitized = value
        .replace(/<\s*\/??\s*script[^>]*>/gi, '') // Remove script tags (always)
        .replace(/javascript:/gi, '')               // Remove javascript: protocol (always)
        .replace(/on\w+\s*=/gi, '');               // Remove inline event handlers (always)

      // Only strip bare angle brackets from non-code fields.
      // Code fields (content, source, html, css, etc.) preserve <> for markup & generics.
      const isCodeField = fieldKey && CODE_CONTENT_FIELDS.has(fieldKey.toLowerCase());
      if (!isCodeField) {
        sanitized = sanitized.replace(/[<>]/g, '');
      }

      return sanitized;
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item, fieldKey));
    }
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitize(value[key], key);
      }
      return sanitized;
    }
    return value;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query as any);
  req.params = sanitize(req.params);

  next();
};

/**
 * SQL injection prevention (for raw queries)
 * 
 * @deprecated This function is NOT recommended for production use.
 * Drizzle ORM automatically parameterizes all queries, providing robust SQL injection protection.
 * This function exists only for edge cases involving raw SQL (which should be avoided).
 * 
 * SECURITY NOTE: Regex-based sanitization is inherently bypassable with encoding tricks.
 * Always use parameterized queries via Drizzle ORM instead.
 */
export const preventSQLInjection = (query: string): string => {
  // Basic SQL injection patterns
  const dangerousPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\*|;|'|"|`|\\)/g,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi
  ];

  let sanitized = query;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
};

// File upload security
export const fileUploadSecurity = {
  // Allowed file types
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json'
  ],

  // Max file size (10MB)
  maxFileSize: 10 * 1024 * 1024,

  // Validate file
  validateFile: (file: Express.Multer.File): { valid: boolean; error?: string } => {
    // Check MIME type
    if (!fileUploadSecurity.allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid file type' };
    }

    // Check file size
    if (file.size > fileUploadSecurity.maxFileSize) {
      return { valid: false, error: 'File too large' };
    }

    // Check file extension matches MIME type
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const mimeExtMap: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'application/json': ['json']
    };

    const allowedExts = mimeExtMap[file.mimetype];
    if (!allowedExts || !ext || !allowedExts.includes(ext)) {
      return { valid: false, error: 'File extension mismatch' };
    }

    return { valid: true };
  },

  // Generate secure filename
  generateSecureFilename: (originalName: string): string => {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const randomName = crypto.randomBytes(16).toString('hex');
    return `${randomName}.${ext}`;
  }
};

// API key validation
export const apiKeyValidation = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // In production, validate against database
  // For now, basic validation
  if (apiKey.length < 32) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Security monitoring
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Log security-relevant events
  const securityEvent = {
    timestamp: new Date(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    suspicious: false
  };

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
    /\${.*}/  // Template injection
  ];

  const checkString = `${req.path}${JSON.stringify(req.query)}${JSON.stringify(req.body)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      securityEvent.suspicious = true;
      logger.warn('Suspicious request detected', securityEvent);
      break;
    }
  }

  next();
};

// IP-based security
export const ipSecurity = {
  // Whitelist for admin access
  adminWhitelist: process.env.ADMIN_IP_WHITELIST?.split(',') || [],

  // Blacklist for blocked IPs
  blacklist: new Set<string>(),

  // Check if IP is allowed for admin
  isAdminIpAllowed: (ip: string): boolean => {
    // SECURITY: Strict IP enforcement for Fortune 500 standards
    // No bypass even in development unless explicitly enabled with token
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_ALL_ADMIN_IPS === 'true') {
      logger.warn('⚠️  SECURITY WARNING: Admin IP whitelist bypassed in development mode');
      return true;
    }
    
    // Production: Always enforce whitelist (no bypasses)
    return ipSecurity.adminWhitelist.includes(ip);
  },

  // Block IP
  blockIp: (ip: string, duration: number = 3600000) => {
    ipSecurity.blacklist.add(ip);
    setTimeout(() => {
      ipSecurity.blacklist.delete(ip);
    }, duration);
  },

  // Middleware
  middleware: (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    if (ipSecurity.blacklist.has(clientIp)) {
      logger.warn('Blocked IP attempted access', { ip: clientIp });
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check admin routes
    if (req.path.startsWith('/admin') && !ipSecurity.isAdminIpAllowed(clientIp)) {
      logger.warn('Unauthorized admin access attempt', { ip: clientIp });
      return res.status(403).json({ error: 'Admin access restricted' });
    }

    next();
  }
};

// Export CSP functions for testing
export {
  getCSPDirectives,
  productionCSPDirectives,
  developmentCSPDirectives,
  buildCSPHeader,
  generateCSPNonce
};