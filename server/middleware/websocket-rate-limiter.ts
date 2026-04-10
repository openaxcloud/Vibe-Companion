/**
 * WebSocket Rate Limiter
 * Prevents abuse of WebSocket connections with configurable rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class WebSocketRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxConnections: number;
  private readonly windowMs: number;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(maxConnections: number = 10, windowMs: number = 60000) {
    this.maxConnections = maxConnections;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a connection attempt should be allowed
   * @param identifier - Unique identifier for the client (IP, userId, etc.)
   * @returns true if allowed, false if rate limited
   */
  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First connection or window expired - allow and create new entry
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    // Check if under limit
    if (entry.count < this.maxConnections) {
      entry.count++;
      return true;
    }

    // Rate limited
    return false;
  }

  /**
   * Reset the rate limit for a specific identifier
   * @param identifier - Unique identifier to reset
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Get current connection count for an identifier
   * @param identifier - Unique identifier
   * @returns Current connection count
   */
  getCount(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return 0;
    }
    return entry.count;
  }

  /**
   * Get time until rate limit resets for an identifier
   * @param identifier - Unique identifier
   * @returns Milliseconds until reset, or 0 if not limited
   */
  getTimeUntilReset(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    if (now > entry.resetTime) {
      return 0;
    }

    return entry.resetTime - now;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [identifier, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        toDelete.push(identifier);
      }
    }

    for (const identifier of toDelete) {
      this.limits.delete(identifier);
    }
  }

  /**
   * Get statistics about current rate limiting
   */
  getStats(): {
    totalEntries: number;
    activelyLimited: number;
    averageConnections: number;
  } {
    const now = Date.now();
    let activelyLimited = 0;
    let totalConnections = 0;
    let activeEntries = 0;

    for (const entry of this.limits.values()) {
      if (now <= entry.resetTime) {
        activeEntries++;
        totalConnections += entry.count;
        if (entry.count >= this.maxConnections) {
          activelyLimited++;
        }
      }
    }

    return {
      totalEntries: this.limits.size,
      activelyLimited,
      averageConnections: activeEntries > 0 ? totalConnections / activeEntries : 0
    };
  }

  /**
   * Cleanup and stop the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Global rate limiter instance for WebSocket connections
// Default: 10 connections per user per minute
export const wsRateLimiter = new WebSocketRateLimiter(
  parseInt(process.env.WS_MAX_CONNECTIONS_PER_MINUTE || '10'),
  60000 // 1 minute window
);

// Additional rate limiter for connection attempts per IP
// Prevents DoS attacks from single IPs
export const ipRateLimiter = new WebSocketRateLimiter(
  parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP || '50'),
  60000 // 1 minute window
);
