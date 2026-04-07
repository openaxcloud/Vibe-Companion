/**
 * Security Utilities - Fortune 500 Grade
 * 
 * Centralized security functions for:
 * - Path traversal prevention
 * - Safe JSON parsing
 * - Session regeneration
 * - Input sanitization
 */

import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger';

const logger = createLogger('security-utils');

/**
 * Prevents path traversal attacks by ensuring the resolved path
 * stays within the allowed base directory.
 * 
 * @param basePath - The allowed base directory
 * @param userPath - The user-provided path (potentially malicious)
 * @returns The safe resolved path, or null if traversal was attempted
 */
export function safePath(basePath: string, userPath: string): string | null {
  // Normalize and resolve the paths
  const resolvedBase = path.resolve(basePath);
  const resolvedUser = path.resolve(basePath, userPath);
  
  // Check if the resolved path starts with the base path
  if (!resolvedUser.startsWith(resolvedBase + path.sep) && resolvedUser !== resolvedBase) {
    logger.warn(`[SECURITY] Path traversal attempt blocked: ${userPath} -> ${resolvedUser}`);
    return null;
  }
  
  return resolvedUser;
}

/**
 * Validates that a path doesn't contain dangerous sequences
 */
export function isPathSafe(userPath: string): boolean {
  // Block null bytes (can bypass checks in some languages)
  if (userPath.includes('\0')) return false;
  
  // Block obvious traversal attempts
  if (userPath.includes('..')) return false;
  
  // Block absolute paths on Unix
  if (userPath.startsWith('/')) return false;
  
  // Block absolute paths on Windows
  if (/^[a-zA-Z]:/.test(userPath)) return false;
  
  // Block backslashes (Windows path separator)
  if (userPath.includes('\\')) return false;
  
  return true;
}

/**
 * Safely parses JSON with a fallback value
 * Prevents crashes from malformed JSON
 * 
 * @param json - The JSON string to parse
 * @param fallback - The value to return if parsing fails
 * @returns The parsed object or the fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.debug(`[SECURITY] JSON parse failed for input: ${json.substring(0, 100)}...`);
    return fallback;
  }
}

/**
 * Safely parses JSON and validates against expected type
 * Returns null if parsing fails or validation fails
 */
export function safeJsonParseWithValidator<T>(
  json: string, 
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    if (validator(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Regenerates session after successful authentication
 * Prevents session fixation attacks
 * 
 * CRITICAL SECURITY: Must be called after successful login
 */
export function regenerateSession(
  req: Request, 
  userId: number | string,
  callback: (err?: Error) => void
): void {
  if (!req.session) {
    callback(new Error('No session available'));
    return;
  }
  
  // Store user ID before regeneration
  const storedUserId = userId;
  
  req.session.regenerate((err) => {
    if (err) {
      logger.error('[SECURITY] Session regeneration failed:', err);
      callback(err);
      return;
    }
    
    // Restore passport user in the new session
    if (req.session) {
      (req.session as any).passport = { user: storedUserId };
    }
    
    req.session?.save((saveErr) => {
      if (saveErr) {
        logger.error('[SECURITY] Session save failed after regeneration:', saveErr);
        callback(saveErr);
        return;
      }
      
      logger.info(`[SECURITY] Session regenerated for user ${storedUserId}`);
      callback();
    });
  });
}

/**
 * Sanitizes user input by removing potentially dangerous characters
 * For use in contexts where HTML/JS injection is a concern
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes deep link parameters to prevent XSS
 */
export function sanitizeDeepLinkParams(params: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Remove dangerous characters from values
    sanitized[key] = value.replace(/[<>"'`]/g, '');
  }
  
  return sanitized;
}

/**
 * Validates allowed deep link actions (whitelist approach)
 */
const ALLOWED_DEEP_LINK_ACTIONS = new Set([
  'project',
  'file', 
  'workspace',
  'settings',
  'auth',
  'oauth-callback',
  'invite',
  'share'
]);

export function isAllowedDeepLinkAction(action: string): boolean {
  return ALLOWED_DEEP_LINK_ACTIONS.has(action);
}

/**
 * Validates allowed file paths for IPC operations (Desktop app)
 */
export function isAllowedFilePath(
  filePath: string, 
  allowedBasePaths: string[]
): boolean {
  const resolved = path.resolve(filePath);
  
  return allowedBasePaths.some(allowed => {
    const resolvedAllowed = path.resolve(allowed);
    return resolved.startsWith(resolvedAllowed + path.sep) || resolved === resolvedAllowed;
  });
}

/**
 * Generates a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Rate limiter helper for tracking attempts by IP
 * Used for brute-force protection on sensitive endpoints
 */
const attemptMap = new Map<string, { count: number; firstAttempt: number }>();

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = attemptMap.get(identifier);
  
  // Clean up old entries periodically
  if (attemptMap.size > 10000) {
    for (const [key, value] of attemptMap.entries()) {
      if (now - value.firstAttempt > windowMs) {
        attemptMap.delete(key);
      }
    }
  }
  
  if (!record || now - record.firstAttempt > windowMs) {
    // First attempt or window expired
    attemptMap.set(identifier, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs };
  }
  
  if (record.count >= maxAttempts) {
    const resetIn = windowMs - (now - record.firstAttempt);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: maxAttempts - record.count, 
    resetIn: windowMs - (now - record.firstAttempt) 
  };
}

/**
 * Middleware to require rate limit check
 */
export function rateLimitMiddleware(
  maxAttempts: number = 5,
  windowMs: number = 60000,
  keyGenerator: (req: Request) => string = (req) => req.ip || 'unknown'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const result = checkRateLimit(key, maxAttempts, windowMs);
    
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString());
    
    if (!result.allowed) {
      logger.warn(`[SECURITY] Rate limit exceeded for ${key}`);
      return res.status(429).json({ 
        error: 'Too many attempts',
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil(result.resetIn / 1000)
      });
    }
    
    next();
  };
}
