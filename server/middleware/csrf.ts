/**
 * Custom CSRF Protection Middleware
 * Provides protection against Cross-Site Request Forgery attacks
 *
 * Token is stored IN the session so the session gets persisted (Set-Cookie sent).
 * Without session persistence, every request gets a fresh session ID and token
 * verification always fails.
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paths to exclude from CSRF protection (webhooks and anonymous endpoints)
const EXCLUDED_PATHS = [
  '/api/webhooks/stripe',
  '/api/webhooks/github',
  '/api/logs/ingest',
];

// Base allowed origins for login/register endpoints
const BASE_ORIGINS = [
  process.env.APP_URL || 'http://localhost:5000',
  'https://e-code.ai',
  'http://localhost:5000',
  'http://localhost:3000',
];

function getAllowedOrigins(): string[] {
  const origins = [...BASE_ORIGINS];

  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.REPLIT_DEV_URL) {
    origins.push(process.env.REPLIT_DEV_URL);
    const urlWithoutPort = process.env.REPLIT_DEV_URL.replace(/:5000$/, '');
    if (urlWithoutPort !== process.env.REPLIT_DEV_URL) {
      origins.push(urlWithoutPort);
    }
  }
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(',').forEach(domain => {
      const trimmed = domain.trim();
      if (trimmed) origins.push(`https://${trimmed}`);
    });
  }
  if (process.env.REPL_ID) {
    origins.push(`https://${process.env.REPL_ID}.replit.dev`);
  }

  return [...new Set(origins)];
}

const ALLOWED_ORIGINS = getAllowedOrigins();

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const originHostPort = `${originUrl.protocol}//${originUrl.host}`;

    if (ALLOWED_ORIGINS.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return originHostPort === `${allowedUrl.protocol}//${allowedUrl.host}`;
      } catch {
        return origin === allowed;
      }
    })) {
      return true;
    }
  } catch {
    return false;
  }

  if (process.env.NODE_ENV === 'development') {
    const replitPatterns = [
      /^https:\/\/[a-z0-9-]+\.replit\.dev$/,
      /^https:\/\/[a-z0-9-]+-\d+-[a-z0-9]+\.riker\.replit\.dev$/,
      /^https:\/\/[a-z0-9-]+\.repl\.co$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/localhost(:\d+)?$/,
    ];
    if (replitPatterns.some(p => p.test(origin))) return true;
  }

  return false;
}

/** Generate a cryptographically secure CSRF token */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the CSRF token for the current session.
 * Stores the token IN req.session so the session is saved (and Set-Cookie is sent).
 * Falls back to generating a new token if none exists.
 */
function getOrCreateSessionToken(req: Request): string {
  const sess = req.session as any;
  if (!sess.csrfToken) {
    sess.csrfToken = generateCSRFToken();
  }
  return sess.csrfToken;
}

/**
 * CSRF Protection Middleware
 *
 * For GET/HEAD/OPTIONS — provides the token in a response header (no validation).
 * For POST/PUT/PATCH/DELETE — validates the submitted X-CSRF-Token header.
 *
 * Token is session-stored so the session cookie is always established.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    console.warn('⚠️  SECURITY WARNING: CSRF protection bypassed in development mode');
    return next();
  }

  const fullPath = req.originalUrl.split('?')[0];
  if (EXCLUDED_PATHS.some(ex => fullPath === ex || fullPath.startsWith(ex + '/'))) {
    return next();
  }

  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }

  // Generate/retrieve token (stored in session → forces session save → cookie sent)
  const token = getOrCreateSessionToken(req);

  // Always advertise the current token so the client can grab it from any response
  res.setHeader('X-CSRF-Token', token);

  // Safe methods: just provide the token
  if (!PROTECTED_METHODS.includes(req.method)) {
    return next();
  }

  // Validate submitted token for state-changing requests
  const provided = (req.headers['x-csrf-token'] as string)
    || req.body?._csrf
    || (req.query?._csrf as string);

  if (!provided) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'This request requires a valid CSRF token',
    });
  }

  // Timing-safe comparison
  const storedToken = (req.session as any).csrfToken as string | undefined;
  if (!storedToken) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'No CSRF token found in session',
    });
  }

  try {
    const providedBuf = Buffer.from(provided);
    const storedBuf = Buffer.from(storedToken);
    if (providedBuf.length !== storedBuf.length || !crypto.timingSafeEqual(providedBuf, storedBuf)) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Invalid or expired CSRF token',
      });
    }
  } catch {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid CSRF token format',
    });
  }

  next();
}

/**
 * Endpoint to get a CSRF token.
 * Stores the token in the session (which forces the session cookie to be set).
 */
export function csrfTokenEndpoint(req: Request, res: Response) {
  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }

  const token = getOrCreateSessionToken(req);

  // Explicitly save the session so the Set-Cookie header is sent before we respond.
  req.session.save((err) => {
    if (err) {
      console.error('[CSRF] Session save error:', err);
    }
    res.setHeader('X-CSRF-Token', token);
    res.json({ csrfToken: token });
  });
}

// ---------------------------------------------------------------------------
// Legacy export kept for any callers that imported csrfService directly
// ---------------------------------------------------------------------------
export const csrfService = {
  generate: (sessionId: string) => generateCSRFToken(),
  verify: (_sessionId: string, _token: string) => false, // Always use session-based now
  getToken: (_sessionId: string) => null,
  deleteToken: (_sessionId: string) => {},
  getStats: () => ({ activeTokens: 0, oldestToken: null }),
};
