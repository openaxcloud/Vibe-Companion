// @ts-nocheck
/**
 * Input Validation & Sanitization Middleware
 * Production-grade validation layer for Fortune 500 security standards
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import path from 'path';

// Lazy-load isomorphic-dompurify to avoid jsdom issues in production bundles
let DOMPurifyInstance: typeof import('isomorphic-dompurify').default | null = null;

async function getDOMPurify(): Promise<typeof import('isomorphic-dompurify').default | null> {
  if (DOMPurifyInstance) return DOMPurifyInstance;
  try {
    const module = await import('isomorphic-dompurify');
    DOMPurifyInstance = module.default;
    return DOMPurifyInstance;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return null;
  }
}

// Initialize DOMPurify asynchronously (non-blocking)
getDOMPurify().catch(() => {});

// Fallback sanitization when DOMPurify is not available
function fallbackStripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
    return map[c] || c;
  });
}

/**
 * Validate request body against a Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

/**
 * Validate request query parameters against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          code: 'QUERY_VALIDATION_ERROR',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid URL parameters',
          code: 'PARAMS_VALIDATION_ERROR',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

/**
 * XSS Sanitization for all string fields in request body
 * Recursively sanitizes objects and arrays
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitive strings first (e.g., from express.text() middleware)
  if (typeof obj === 'string') {
    // Sanitize HTML to prevent XSS
    if (DOMPurifyInstance) {
      return DOMPurifyInstance.sanitize(obj, { 
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [] // Strip all attributes
      });
    }
    return fallbackStripHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    // Skip objects that don't have own properties (like String objects)
    if (!Object.keys(obj).length && !(obj.constructor === Object)) {
      return obj;
    }
    
    const sanitized: any = {};
    for (const key in obj) {
      // Use Object.prototype.hasOwnProperty.call for safety
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Path Traversal Protection
 * Validates file paths to prevent directory traversal attacks
 */
const DANGEROUS_PATTERNS = [
  /\.\./g,           // Parent directory traversal
  /~\//g,            // Home directory access
  /\/etc\//gi,       // System files
  /\/proc\//gi,      // Process info
  /\/sys\//gi,       // System info
  /\.env/gi,         // Environment files
  /\.git/gi,         // Git directory
  /node_modules/gi,  // Dependencies
  /server\//gi,      // Server source code
  /package\.json/gi, // Package config
];

const ALLOWED_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.jsonc',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  // Images and media
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Frameworks
  '.vue', '.svelte', '.astro',
  // Documentation
  '.md', '.mdx', '.txt', '.rst',
  // Config files
  '.yml', '.yaml', '.toml', '.xml', '.ini', '.cfg', '.conf',
  '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc',
  '.babelrc', '.nvmrc', '.npmrc', '.yarnrc',
  // Backend languages
  '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql', '.prisma',
  // Other
  '.map', '.lock', '.log', '.csv', '.tsv', '.ejs', '.hbs', '.pug', '.njk',
  '.dockerfile', '.dockerignore', '.makefile', '.cmake'
];

export interface PathValidationResult {
  isValid: boolean;
  error?: string;
  normalizedPath?: string;
}

export function validateFilePath(filePath: string): PathValidationResult {
  // Normalize the path
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filePath) || pattern.test(normalizedPath)) {
      return {
        isValid: false,
        error: 'Path contains forbidden patterns'
      };
    }
  }
  
  // Check file extension
  const ext = path.extname(normalizedPath).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `File extension '${ext}' is not allowed`
    };
  }
  
  // Ensure path doesn't escape project root
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) {
    return {
      isValid: false,
      error: 'Path traversal attempt detected'
    };
  }
  
  return {
    isValid: true,
    normalizedPath
  };
}

/**
 * Middleware to validate file paths in request
 */
export const validateFilePathMiddleware = (pathParam: string = 'path') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const filePath = req.body[pathParam] || req.params[pathParam] || req.query[pathParam];
    
    if (!filePath) {
      return res.status(400).json({
        message: 'File path is required',
        code: 'PATH_REQUIRED'
      });
    }
    
    const validation = validateFilePath(filePath as string);
    
    if (!validation.isValid) {
      return res.status(400).json({
        message: validation.error,
        code: 'INVALID_PATH',
        securityViolation: true
      });
    }
    
    // Store normalized path
    if (validation.normalizedPath) {
      req.body[`${pathParam}Normalized`] = validation.normalizedPath;
    }
    
    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0)
  }),
  id: z.object({
    id: z.string().min(1, 'ID is required')
  })
};

/**
 * SQL Injection Prevention Utilities
 * These are helpers for validating database inputs
 * Note: Using Drizzle ORM already provides SQL injection protection
 * but these are additional safeguards
 */
export function sanitizeSqlInput(input: string): string {
  // Remove SQL keywords and dangerous characters
  // This is a backup - Drizzle's parameterized queries are the primary defense
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comments
    .trim();
}

/**
 * Rate-limited validation (prevents abuse of validation endpoint)
 */
export const validationRateLimit = {
  windowMs: 60 * 1000, // 1 minute
  max: 100 // Max 100 validation requests per minute per IP
};
