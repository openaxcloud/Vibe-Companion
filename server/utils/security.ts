// @ts-nocheck
/**
 * Security Utilities
 * Comprehensive security helpers for input validation, sanitization, and protection
 */

import crypto from 'crypto';
import { createHash } from 'crypto';
import validator from 'validator';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger';

const logger = createLogger('security-utils');

// Lazy-load isomorphic-dompurify to avoid jsdom issues in production bundles
let DOMPurifyInstance: typeof import('isomorphic-dompurify').default | null = null;
let domPurifyLoadFailed = false;

async function getDOMPurify(): Promise<typeof import('isomorphic-dompurify').default | null> {
  if (domPurifyLoadFailed) return null;
  if (DOMPurifyInstance) return DOMPurifyInstance;
  try {
    const module = await import('isomorphic-dompurify');
    DOMPurifyInstance = module.default;
    return DOMPurifyInstance;
  } catch (error) {
    domPurifyLoadFailed = true;
    logger.warn('DOMPurify not available, using fallback HTML sanitization');
    return null;
  }
}

// Fallback HTML sanitization when DOMPurify is not available
function fallbackSanitizeHtml(input: string): string {
  const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'];
  // Simple regex-based sanitization - strips all tags except allowed ones
  return input.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (ALLOWED_TAGS.includes(tag)) {
      // For allowed tags, only keep basic attributes
      if (tag === 'a') {
        const hrefMatch = match.match(/href="([^"]+)"/i);
        if (hrefMatch) {
          const href = hrefMatch[1].replace(/javascript:/gi, '');
          return match.startsWith('</') ? `</${tag}>` : `<${tag} href="${href}" rel="noopener noreferrer">`;
        }
      }
      return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
    }
    return '';
  });
}

/**
 * XSS Protection & Input Sanitization
 */
export const xssProtection = {
  // Sanitize HTML content (sync version using fallback if DOMPurify not loaded)
  sanitizeHtml: (input: string): string => {
    if (DOMPurifyInstance) {
      return DOMPurifyInstance.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
      });
    }
    return fallbackSanitizeHtml(input);
  },
  
  // Async version that ensures DOMPurify is loaded first
  sanitizeHtmlAsync: async (input: string): Promise<string> => {
    const purify = await getDOMPurify();
    if (purify) {
      return purify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
      });
    }
    return fallbackSanitizeHtml(input);
  },

  // Escape HTML entities
  escapeHtml: (input: string): string => {
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
  },

  // Remove all HTML tags
  stripHtml: (input: string): string => {
    return input.replace(/<\/?[^>]+(>|$)/g, '');
  },

  // Sanitize JSON strings
  sanitizeJson: (input: any): any => {
    if (typeof input === 'string') {
      // Remove potential JSON injection patterns
      return input
        .replace(/\$where/gi, '')
        .replace(/\$regex/gi, '')
        .replace(/\$ne/gi, '')
        .replace(/\$gt/gi, '')
        .replace(/\$lt/gi, '');
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = Array.isArray(input) ? [] : {};
      for (const key in input) {
        // Skip dangerous MongoDB operators
        if (key.startsWith('$')) continue;
        sanitized[key] = xssProtection.sanitizeJson(input[key]);
      }
      return sanitized;
    }
    return input;
  },
};

/**
 * SQL Injection Prevention
 */
export const sqlInjectionPrevention = {
  // Validate and escape SQL identifiers (table/column names)
  escapeIdentifier: (identifier: string): string => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error('Invalid SQL identifier');
    }
    return `"${identifier}"`;
  },

  // Escape SQL string values
  escapeString: (value: string): string => {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/"/g, '""')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      // eslint-disable-next-line no-control-regex
      .replace(/\x00/g, '\\x00')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1a/g, '\\x1a');
  },

  // Validate numeric input
  validateNumeric: (value: any): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error('Invalid numeric value');
    }
    return num;
  },

  // Build safe WHERE clause
  buildWhereClause: (conditions: Record<string, any>): { clause: string; params: any[] } => {
    const clauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(conditions)) {
      const safeKey = sqlInjectionPrevention.escapeIdentifier(key);
      clauses.push(`${safeKey} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    return {
      clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  },
};

/**
 * Path Traversal Prevention
 */
export const pathTraversalPrevention = {
  // Validate file paths
  validatePath: (filePath: string, basePath: string): boolean => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Check for path traversal patterns
    const dangerousPatterns = [
      /\.\./,
      /\.\.\\/, 
      /%2e%2e/i,
      /%252e%252e/i,
      // eslint-disable-next-line no-control-regex
      /\x00/,
      /^\//,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedPath)) {
        logger.warn('Path traversal attempt detected', { path: filePath });
        return false;
      }
    }

    // Ensure path stays within base directory
    const path = require('path');
    const resolvedPath = path.resolve(basePath, normalizedPath);
    return resolvedPath.startsWith(path.resolve(basePath));
  },

  // Sanitize filename
  sanitizeFilename: (filename: string): string => {
    // Remove path components
    const basename = filename.split(/[/\\]/).pop() || '';
    
    // Remove dangerous characters
    const sanitized = basename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .substring(0, 255); // Limit filename length

    // Ensure it doesn't start with a dot (hidden file)
    return sanitized.startsWith('.') ? sanitized.substring(1) : sanitized;
  },
};

/**
 * Request Validation
 */
export const requestValidation = {
  // Validate request size
  validateSize: (maxSize: number = 10 * 1024 * 1024) => {
    return (req: Request, res: Response, next: NextFunction) => {
      let size = 0;
      
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxSize) {
          res.status(413).json({ error: 'Request entity too large' });
          req.destroy();
        }
      });

      next();
    };
  },

  // Validate content type
  validateContentType: (allowedTypes: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentType = req.get('content-type')?.split(';')[0];
      
      if (contentType && !allowedTypes.includes(contentType)) {
        return res.status(415).json({ error: 'Unsupported media type' });
      }

      next();
    };
  },

  // Validate request parameters
  validateParams: (schema: Record<string, any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors: string[] = [];

      for (const [param, rules] of Object.entries(schema)) {
        const value = req.body[param] || req.query[param] || req.params[param];

        if (rules.required && !value) {
          errors.push(`${param} is required`);
          continue;
        }

        if (value && rules.type) {
          const actualType = typeof value;
          if (actualType !== rules.type) {
            errors.push(`${param} must be of type ${rules.type}`);
          }
        }

        if (value && rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${param} has invalid format`);
        }

        if (value && rules.minLength && value.length < rules.minLength) {
          errors.push(`${param} must be at least ${rules.minLength} characters`);
        }

        if (value && rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${param} must be at most ${rules.maxLength} characters`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      next();
    };
  },
};

/**
 * Check if a path is a Vite development asset that should bypass rate limiting
 * ✅ FIX (Dec 19, 2025): Centralized function to prevent module loading failures in IDE
 */
export function isViteDevPath(path: string): boolean {
  if (!path) return false;
  return (
    path.startsWith('/assets/') ||
    path.startsWith('/static/') ||
    path.startsWith('/src/') ||           // Vite source files
    path.startsWith('/@vite/') ||         // Vite client
    path.startsWith('/@fs/') ||           // Vite file system access
    path.startsWith('/@id/') ||           // Vite module IDs
    path.startsWith('/@react-refresh') || // React Fast Refresh
    path.startsWith('/node_modules/') ||  // Node modules
    path.endsWith('.ts') ||               // TypeScript files
    path.endsWith('.tsx') ||              // TypeScript React files
    path.endsWith('.js') || 
    path.endsWith('.mjs') ||
    path.endsWith('.css') || 
    path.endsWith('.png') || 
    path.endsWith('.jpg') || 
    path.endsWith('.svg') || 
    path.endsWith('.ico') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.ttf') ||
    path.endsWith('.map') ||
    path === '/manifest.json' ||          // PWA manifest
    path === '/'                          // Root HTML
  );
}

/**
 * Rate Limiting Utilities
 */
export const rateLimiting = {
  // In-memory store for rate limiting
  store: new Map<string, { count: number; resetTime: number }>(),

  // Create rate limiter
  createLimiter: (options: { 
    windowMs?: number; 
    max?: number; 
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: Request) => string;
  } = {}) => {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      skipSuccessfulRequests = false,
      keyGenerator = (req) => req.ip || 'unknown',
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
      // ✅ FIX (Dec 19, 2025): Skip rate limiting for Vite dev paths to prevent module loading failures
      const reqPath = req.path || req.originalUrl || '';
      if (isViteDevPath(reqPath)) {
        return next();
      }
      
      const key = keyGenerator(req);
      const now = Date.now();
      
      const record = rateLimiting.store.get(key) || { count: 0, resetTime: now + windowMs };
      
      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
      }

      if (record.count >= max) {
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
        res.setHeader('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));
        
        logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
        return res.status(429).json({ error: 'Too many requests' });
      }

      record.count++;
      rateLimiting.store.set(key, record);

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - record.count));
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      if (skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode < 400 && record.count > 0) {
            record.count--;
            rateLimiting.store.set(key, record);
          }
        });
      }

      next();
    };
  },

  // Clear expired entries
  cleanup: () => {
    const now = Date.now();
    for (const [key, record] of rateLimiting.store.entries()) {
      if (now > record.resetTime) {
        rateLimiting.store.delete(key);
      }
    }
  },
};

// Run cleanup every 5 minutes
setInterval(() => rateLimiting.cleanup(), 5 * 60 * 1000);

/**
 * SQL Injection Prevention Enhancement
 */
export function sanitizeSQLIdentifier(identifier: string): string {
  // Only allow alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

export function validateTableName(tableName: string): boolean {
  const validTables = ['users', 'projects', 'files', 'templates', 'deployments', 'api_keys', 'security_logs'];
  return validTables.includes(tableName);
}

export function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  return '';
}

/**
 * Password Security
 */
export const passwordSecurity = {
  // Validate password strength
  validateStrength: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    const commonPatterns = [
      /^123456/,
      /^password/i,
      /^qwerty/i,
      /^abc123/i,
      /^admin/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Hash password
  hash: async (password: string): Promise<string> => {
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  },

  // Verify password
  verify: async (password: string, hash: string): Promise<boolean> => {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, hash);
  },

  // Generate secure random password
  generateSecure: (length: number = 16): string => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }

    return password;
  },
};

/**
 * Token Security
 */
export const tokenSecurity = {
  // Generate secure token
  generateToken: (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
  },

  // Generate JWT token
  generateJWT: (payload: any, secret: string, expiresIn: string = '1h'): string => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, secret, { expiresIn });
  },

  // Verify JWT token
  verifyJWT: (token: string, secret: string): any => {
    const jwt = require('jsonwebtoken');
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  },

  // Generate API key
  generateApiKey: (): string => {
    const prefix = 'eck_'; // E-Code Key
    const key = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${key}`;
  },

  // Hash API key for storage
  hashApiKey: (apiKey: string): string => {
    return createHash('sha256').update(apiKey).digest('hex');
  },
};

/**
 * Output Encoding
 */
export const outputEncoding = {
  // JSON encoding with safety
  encodeJson: (data: any): string => {
    // Remove sensitive fields
    const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
      if (sensitiveFields.includes(key)) {
        return '[REDACTED]';
      }
      return value;
    }));

    return JSON.stringify(sanitized);
  },

  // URL encoding
  encodeUrl: (url: string): string => {
    return encodeURIComponent(url);
  },

  // Base64 encoding
  encodeBase64: (data: string): string => {
    return Buffer.from(data).toString('base64');
  },

  // Hex encoding
  encodeHex: (data: string): string => {
    return Buffer.from(data).toString('hex');
  },
};

/**
 * Email Validation
 */
export const emailValidation = {
  // Validate email format
  isValid: (email: string): boolean => {
    return validator.isEmail(email, {
      allow_utf8_local_part: false,
      require_tld: true,
      allow_ip_domain: false,
    });
  },

  // Normalize email
  normalize: (email: string): string => {
    return validator.normalizeEmail(email, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }) || email.toLowerCase();
  },

  // Check for disposable email
  isDisposable: (email: string): boolean => {
    const disposableDomains = [
      'tempmail.com',
      'throwaway.email',
      'guerrillamail.com',
      'mailinator.com',
      '10minutemail.com',
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.includes(domain);
  },
};

/**
 * Session Security
 */
export const sessionSecurity = {
  // Generate secure session ID
  generateSessionId: (): string => {
    return crypto.randomBytes(32).toString('hex');
  },

  // Session configuration
  getSecureSessionConfig: () => ({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    name: 'ecode.sid',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
      secure: process.env.NODE_ENV === 'production' || !!process.env.REPL_ID,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: (process.env.NODE_ENV === 'production' || !!process.env.REPL_ID) ? 'none' as const : 'lax' as const,
      path: '/',
    },
  }),
};

/**
 * Two-Factor Authentication
 */
export const twoFactorAuth = {
  // Generate secret
  generateSecret: (): { secret: string; qrCode: string } => {
    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');
    
    const secret = speakeasy.generateSecret({
      name: 'E-Code Platform',
      length: 32,
    });

    const qrCodeUrl = qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  },

  // Verify token
  verifyToken: (secret: string, token: string): boolean => {
    const speakeasy = require('speakeasy');
    
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps tolerance
    });
  },

  // Generate backup codes
  generateBackupCodes: (count: number = 10): string[] => {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomInt(100000, 999999).toString();
      codes.push(code);
    }

    return codes;
  },
};

export default {
  xssProtection,
  sqlInjectionPrevention,
  pathTraversalPrevention,
  requestValidation,
  rateLimiting,
  passwordSecurity,
  tokenSecurity,
  outputEncoding,
  emailValidation,
  sessionSecurity,
  twoFactorAuth,
};