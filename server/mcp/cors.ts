/**
 * CORS Configuration for MCP Server
 * Allows Claude.ai and other authorized clients to connect
 */

import cors from 'cors';

// Allowed origins for MCP access
const ALLOWED_ORIGINS = [
  // Claude.ai domains
  'https://claude.ai',
  'https://www.claude.ai',
  'https://api.claude.ai',
  
  // Development
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  
  // Production domains (add your domain here)
  process.env.PRODUCTION_URL,
  process.env.MCP_ALLOWED_ORIGIN
].filter(Boolean);

// CORS configuration for MCP endpoints
export const mcpCorsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    } else if (origin.includes('ngrok.io') || origin.includes('ngrok-free.app')) {
      // Allow ngrok for testing
      return callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // Allow all origins in development
      return callback(null, true);
    } else {
      console.error(`[MCP CORS] Origin not allowed: ${origin}`);
      return callback(null, false);
    }
  },
  
  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Session-Id',
    'X-Request-Id',
    'Accept',
    'Origin'
  ],
  
  // Exposed headers (that the client can access)
  exposedHeaders: [
    'X-Session-Id',
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Cache preflight requests for 24 hours
  maxAge: 86400,
  
  // Success status for legacy browsers
  optionsSuccessStatus: 200
};

/**
 * Security headers for MCP endpoints
 */
export function mcpSecurityHeaders() {
  return (req: any, res: any, next: any) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for API endpoints
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; " +
      "script-src 'none'; " +
      "style-src 'none'; " +
      "img-src 'none'; " +
      "font-src 'none'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'none'; " +
      "form-action 'none'"
    );
    
    // Add request ID for tracking
    const crypto = require('crypto');
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    
    next();
  };
}

/**
 * Rate limiting configuration for MCP endpoints
 */
export const mcpRateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  
  // Skip rate limiting for whitelisted IPs
  skip: (req: any) => {
    const whitelist = [
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1'
    ];
    
    const clientIp = req.ip || req.connection.remoteAddress;
    return whitelist.includes(clientIp);
  }
  
  // Use default key generator (by IP) to properly handle IPv6
  // The API key logic is handled separately in authentication
};