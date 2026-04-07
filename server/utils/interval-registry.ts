/**
 * Centralized Interval Registry - Fortune 500 Standard
 * 
 * Prevents memory leaks by tracking all setInterval calls
 * and providing cleanup on graceful shutdown.
 */

import { createLogger } from './logger';

const logger = createLogger('interval-registry');

interface RegisteredInterval {
  id: NodeJS.Timeout;
  name: string;
  intervalMs: number;
  createdAt: Date;
  service: string;
}

class IntervalRegistry {
  private intervals: Map<string, RegisteredInterval> = new Map();
  private static instance: IntervalRegistry;

  private constructor() {}

  static getInstance(): IntervalRegistry {
    if (!IntervalRegistry.instance) {
      IntervalRegistry.instance = new IntervalRegistry();
    }
    return IntervalRegistry.instance;
  }

  /**
   * Register a new interval with automatic tracking
   */
  register(
    name: string,
    callback: () => void,
    intervalMs: number,
    service: string = 'unknown'
  ): NodeJS.Timeout {
    const key = `${service}:${name}`;
    
    // Clear existing interval with same name if exists
    if (this.intervals.has(key)) {
      this.unregister(key);
    }

    const id = setInterval(callback, intervalMs);
    
    this.intervals.set(key, {
      id,
      name,
      intervalMs,
      createdAt: new Date(),
      service
    });

    logger.debug(`Registered interval: ${key} (${intervalMs}ms)`);
    return id;
  }

  /**
   * Unregister and clear a specific interval
   */
  unregister(key: string): boolean {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval.id);
      this.intervals.delete(key);
      logger.debug(`Unregistered interval: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all registered intervals (for graceful shutdown)
   */
  clearAll(): void {
    const count = this.intervals.size;
    for (const [key, interval] of this.intervals) {
      clearInterval(interval.id);
      logger.debug(`Cleared interval: ${key}`);
    }
    this.intervals.clear();
    logger.info(`Cleared ${count} intervals on shutdown`);
  }

  /**
   * Get statistics about registered intervals
   */
  getStats(): { total: number; byService: Record<string, number> } {
    const byService: Record<string, number> = {};
    
    for (const interval of this.intervals.values()) {
      byService[interval.service] = (byService[interval.service] || 0) + 1;
    }

    return {
      total: this.intervals.size,
      byService
    };
  }

  /**
   * List all registered intervals
   */
  list(): Array<{ key: string; name: string; service: string; intervalMs: number }> {
    return Array.from(this.intervals.entries()).map(([key, interval]) => ({
      key,
      name: interval.name,
      service: interval.service,
      intervalMs: interval.intervalMs
    }));
  }
}

export const intervalRegistry = IntervalRegistry.getInstance();

/**
 * Safe setInterval wrapper that auto-registers with the registry
 */
export function safeSetInterval(
  callback: () => void,
  intervalMs: number,
  name: string,
  service: string = 'unknown'
): NodeJS.Timeout {
  return intervalRegistry.register(name, callback, intervalMs, service);
}
