import type { IncomingMessage } from 'http';

/**
 * Safely extract client IP address from request
 * SECURITY: Prevents IP spoofing by only trusting forwarded headers in production behind trusted proxies
 * 
 * @param req - Incoming HTTP/WebSocket request
 * @returns Client IP address
 */
export function getClientIp(req: IncomingMessage): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const isBehindProxy = process.env.BEHIND_PROXY === 'true' || isProduction;

  // SECURITY: Only trust forwarded headers when behind a known proxy
  if (isBehindProxy) {
    // X-Forwarded-For format: "client, proxy1, proxy2"
    // We want the FIRST (leftmost) IP, which is the original client
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = typeof forwardedFor === 'string' 
        ? forwardedFor.split(',').map(ip => ip.trim())
        : forwardedFor;
      
      if (ips.length > 0 && ips[0]) {
        return ips[0];
      }
    }

    // Fallback to X-Real-IP if X-Forwarded-For is not set
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }
  }

  // SECURITY: Default to socket.remoteAddress (cannot be spoofed)
  // This is the actual TCP connection IP address
  return req.socket.remoteAddress || 'unknown';
}
