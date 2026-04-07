/**
 * Secure origin validation for WebSocket connections
 * Prevents cross-site WebSocket hijacking attacks
 */

/**
 * Parse allowed origins from environment variables
 * Returns null if no valid origins are configured (fail-closed security)
 */
export function getAllowedOrigins(): string[] | null {
  const sources = [
    process.env.ALLOWED_ORIGINS || '',
    process.env.REPLIT_DOMAINS || '',
    // Auto-detect Replit dev/prod URLs from well-known env vars
    process.env.REPLIT_DEV_URL ? new URL(process.env.REPLIT_DEV_URL).hostname : '',
    process.env.REPL_SLUG && process.env.REPL_OWNER 
      ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : '',
  ].join(',');

  const origins = sources.split(',').map(o => o.trim()).filter(o => o.length > 0);
  
  if (origins.length === 0) {
    console.warn('[SECURITY] No allowed origins configured - WebSocket connections will be rejected');
    return null;
  }
  
  // Normalize origins to lowercase for comparison
  return origins.map(o => o.toLowerCase());
}

/**
 * Extract hostname from origin string
 * Handles various formats: https://example.com, http://localhost:3000, etc.
 */
function extractHostname(origin: string): string | null {
  try {
    // Handle cases where origin is just a hostname without protocol
    if (!origin.startsWith('http://') && !origin.startsWith('https://') && !origin.startsWith('ws://') && !origin.startsWith('wss://')) {
      return origin.toLowerCase();
    }
    
    const url = new URL(origin);
    // Include port if present for strict matching
    return url.host.toLowerCase(); // host includes port (hostname:port)
  } catch (error) {
    console.error('[SECURITY] Failed to parse origin:', origin, error);
    return null;
  }
}

/**
 * Validate if a request origin is allowed
 * Uses strict hostname matching to prevent bypass attacks
 * 
 * @param requestOrigin - Origin header from the request
 * @param requestHost - Host header from the request (fallback)
 * @returns true if origin is allowed, false otherwise
 */
export function isOriginAllowed(requestOrigin: string | undefined, requestHost: string | undefined): boolean {
  // Use origin header if available, otherwise use host header
  const origin = requestOrigin || requestHost;
  if (!origin) {
    console.warn('[SECURITY] Origin validation failed: No origin or host header present');
    return false;
  }

  const requestHostname = extractHostname(origin);
  if (!requestHostname) {
    console.warn('[SECURITY] Origin validation failed: Could not parse origin:', origin);
    return false;
  }

  // Same-host check: if the Origin matches the Host header, it's a same-origin request — always allow
  if (requestHost) {
    const hostHostname = extractHostname(requestHost);
    if (hostHostname && requestHostname === hostHostname) {
      return true;
    }
  }

  const allowedOrigins = getAllowedOrigins();

  // SECURITY: Fail-closed - if no origins configured, reject all connections
  if (!allowedOrigins || allowedOrigins.length === 0) {
    console.warn('[SECURITY] Origin validation failed: No allowed origins configured');
    return false;
  }
  
  // Check if request hostname matches any allowed origin
  // Uses strict matching - no substring attacks possible
  for (const allowed of allowedOrigins) {
    const allowedHostname = extractHostname(allowed);
    if (!allowedHostname) continue;
    
    // Exact match required
    if (requestHostname === allowedHostname) {
      return true;
    }
    
    // Also allow if allowed origin is just the hostname part
    // e.g., allowed="example.com" matches "https://example.com"
    if (requestHostname.endsWith(`:${allowed}`) || requestHostname === allowed) {
      return true;
    }
  }
  
  console.warn(`[SECURITY] Origin validation failed: ${requestHostname} not in allowlist:`, allowedOrigins);
  return false;
}

/**
 * Validate allowed origins configuration at boot time
 * Throws error if configuration is invalid
 */
export function validateOriginConfig(): void {
  const origins = getAllowedOrigins();
  
  if (!origins || origins.length === 0) {
    throw new Error(
      'SECURITY ERROR: No allowed origins configured. ' +
      'Set ALLOWED_ORIGINS or REPLIT_DOMAINS environment variable to enable WebSocket connections. ' +
      'Example: ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000'
    );
  }
}
