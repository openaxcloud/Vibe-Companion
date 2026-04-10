/**
 * Centralized SSE Headers Utility
 * Fortune 500 Production-Grade - Cross-Origin Security for SSE
 * 
 * This utility provides consistent, secure SSE header handling across
 * all streaming endpoints. It enforces STRICT origin validation to prevent
 * cross-origin data exfiltration attacks.
 * 
 * SECURITY: Returns null for invalid origins - callers MUST handle with 403
 * 
 * Date: December 26, 2025
 * Status: Production-ready
 */

import { Response, Request } from 'express';
import { createLogger } from './logger';

const logger = createLogger('sse-headers');

// Replit origin patterns (always allowed — platform-internal)
const REPLIT_ORIGIN_PATTERNS = [
  /^https:\/\/[a-f0-9-]+\.replit\.dev$/,
  /^https:\/\/[a-f0-9-]+-\d+-[a-z0-9]+\.riker\.replit\.dev$/,
  /^https:\/\/[a-z0-9-]+\.repl\.co$/,
  /^https:\/\/[a-z0-9-]+\.replit\.app$/,
];

/**
 * Get validated allowed origins list
 */
function getAllowedOrigins(): string[] {
  const origins = [
    'https://e-code.ai',
    'https://www.e-code.ai',
    'http://localhost:5000',
    'http://localhost:3000',
  ];
  
  if (process.env.APP_URL) {
    origins.push(process.env.APP_URL);
  }
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  
  if (process.env.REPLIT_DEV_URL) {
    origins.push(process.env.REPLIT_DEV_URL);
  }
  
  return origins;
}

/**
 * Validate origin against allowed list
 * @returns origin string if valid, null if invalid/missing
 */
export function validateSSEOrigin(req?: Request): string | null {
  const origin = req?.headers?.origin as string | undefined;
  
  if (!origin) {
    // No Origin header = same-origin request (safe by definition, always allow)
    return 'http://localhost:5000';
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Always allow Replit platform origins (not restricted to dev mode)
  if (REPLIT_ORIGIN_PATTERNS.some(pattern => pattern.test(origin))) {
    return origin;
  }
  
  logger.warn('[SSE] Rejected invalid origin', { origin, allowedOrigins });
  return null;
}

/**
 * Get allowed origin for SSE response headers
 * STRICT: Returns 'null' for invalid origins (CORS will block)
 */
export function getSSEAllowedOrigin(req?: Request): string {
  const validatedOrigin = validateSSEOrigin(req);
  return validatedOrigin || 'null';
}

/**
 * Validate SSE origin and reject with 403 if invalid
 * MUST be called at the start of every SSE endpoint
 * @returns true if origin is valid and headers are set, false if rejected (403 sent)
 */
export function validateAndSetSSEHeaders(res: Response, req: Request): boolean {
  const validatedOrigin = validateSSEOrigin(req);
  
  if (!validatedOrigin) {
    logger.warn('[SSE] Rejected SSE connection from invalid origin', {
      origin: req.headers.origin,
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', validatedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Accel-Buffering', 'no');
  
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  
  return true;
}

/**
 * Set SSE headers with Fortune 500-grade security
 * @deprecated REMOVED - Use validateAndSetSSEHeaders() for proper 403 rejection
 * @throws Error if called - forces migration to secure validateAndSetSSEHeaders()
 */
export function setSSEHeaders(_res: Response, _req?: Request): void {
  throw new Error(
    'setSSEHeaders is deprecated and disabled. Use validateAndSetSSEHeaders() instead for Fortune 500 security compliance.'
  );
}

/**
 * Full SSE setup with cleanup handling
 * @deprecated Use validateAndSetSSEHeaders() + custom cleanup instead
 * @throws Error if called - forces migration to secure validateAndSetSSEHeaders()
 */
export function setupSSE(_res: Response, _req?: Request): (cleanupFn?: () => void) => void {
  throw new Error(
    'setupSSE is deprecated and disabled. Use validateAndSetSSEHeaders() instead for Fortune 500 security compliance.'
  );
}

/**
 * Send SSE event with proper formatting
 */
export function sendSSE(res: Response, event: string, data: any): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
