/**
 * Circuit Breaker Pattern Implementation
 * Fortune 500 Standard for External Service Resilience
 *
 * Features:
 * - Automatic failure detection
 * - Configurable thresholds
 * - Half-open state for recovery testing
 * - Metrics and monitoring
 * - Fallback mechanisms
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('circuit-breaker');

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes before closing
  timeout: number; // Timeout in ms for requests
  resetTimeout: number; // Time in ms before trying half-open
  monitorInterval?: number; // Interval for health checks
}

/**
 * Circuit Breaker Statistics
 */
interface CircuitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  shortCircuits: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttemptTime: number = Date.now();
  private stats: CircuitStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeouts: 0,
    shortCircuits: 0
  };

  constructor(private options: CircuitBreakerOptions) {
    super();
    logger.info('Circuit breaker initialized', {
      name: options.name,
      failureThreshold: options.failureThreshold,
      timeout: options.timeout
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if we should try half-open
      if (Date.now() >= this.nextAttemptTime) {
        this.setState(CircuitState.HALF_OPEN);
        logger.info('Circuit breaker attempting recovery', {
          name: this.options.name
        });
      } else {
        // Circuit is still open, fail fast
        this.stats.shortCircuits++;
        this.emit('short-circuit', {
          name: this.options.name,
          state: this.state
        });

        if (fallback) {
          logger.debug('Circuit breaker using fallback', {
            name: this.options.name
          });
          return typeof fallback === 'function' ? await fallback() : fallback;
        }

        throw new Error(
          `Circuit breaker is OPEN for ${this.options.name}. Service unavailable.`
        );
      }
    }

    // Execute the function with timeout
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);

      // Use fallback if available
      if (fallback) {
        logger.debug('Circuit breaker using fallback after failure', {
          name: this.options.name,
          error: error.message
        });
        return typeof fallback === 'function' ? await fallback() : fallback;
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          this.stats.timeouts++;
          reject(new Error(`Request timeout after ${this.options.timeout}ms`));
        }, this.options.timeout)
      )
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.stats.successfulRequests++;
    this.stats.lastSuccessTime = new Date();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.setState(CircuitState.CLOSED);
        this.successCount = 0;
        logger.info('Circuit breaker recovered', {
          name: this.options.name
        });
      }
    }

    this.emit('success', {
      name: this.options.name,
      state: this.state
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.stats.failedRequests++;
    this.stats.lastFailureTime = new Date();
    this.failureCount++;
    this.successCount = 0;

    logger.warn('Circuit breaker detected failure', {
      name: this.options.name,
      error: error.message,
      failureCount: this.failureCount,
      state: this.state
    });

    if (
      this.failureCount >= this.options.failureThreshold ||
      this.state === CircuitState.HALF_OPEN
    ) {
      this.open();
    }

    this.emit('failure', {
      name: this.options.name,
      error: error.message,
      state: this.state
    });
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.setState(CircuitState.OPEN);
    this.nextAttemptTime = Date.now() + this.options.resetTimeout;

    logger.error('Circuit breaker opened', {
      name: this.options.name,
      failureCount: this.failureCount,
      nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
    });

    this.emit('open', {
      name: this.options.name,
      failureCount: this.failureCount
    });
  }

  /**
   * Set circuit state
   */
  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      logger.info('Circuit breaker state changed', {
        name: this.options.name,
        from: oldState,
        to: newState
      });

      this.emit('state-change', {
        name: this.options.name,
        from: oldState,
        to: newState
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitStats {
    return { ...this.stats };
  }

  /**
   * Get health status
   */
  getHealth(): {
    name: string;
    state: CircuitState;
    healthy: boolean;
    failureRate: number;
    stats: CircuitStats;
  } {
    const failureRate =
      this.stats.totalRequests > 0
        ? (this.stats.failedRequests / this.stats.totalRequests) * 100
        : 0;

    return {
      name: this.options.name,
      state: this.state,
      healthy: this.state !== CircuitState.OPEN,
      failureRate: parseFloat(failureRate.toFixed(2)),
      stats: this.stats
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      shortCircuits: 0
    };

    logger.info('Circuit breaker reset', {
      name: this.options.name
    });

    this.emit('reset', {
      name: this.options.name
    });
  }

  /**
   * Force open circuit
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Force close circuit
   */
  forceClose(): void {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Create or get a circuit breaker
   */
  getOrCreate(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultOptions: CircuitBreakerOptions = {
      name,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      resetTimeout: 60000,
      ...options
    };

    const breaker = new CircuitBreaker(defaultOptions);
    this.breakers.set(name, breaker);

    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get health status of all breakers
   */
  getAllHealth(): any[] {
    return Array.from(this.breakers.values()).map(breaker => breaker.getHealth());
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Convenience function to create circuit breakers for common services
 */
export function createServiceBreakers() {
  return {
    openai: circuitBreakerManager.getOrCreate('openai', {
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000
    }),
    anthropic: circuitBreakerManager.getOrCreate('anthropic', {
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000
    }),
    google: circuitBreakerManager.getOrCreate('google-ai', {
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000
    }),
    database: circuitBreakerManager.getOrCreate('database', {
      failureThreshold: 5,
      timeout: 5000,
      resetTimeout: 30000
    }),
    redis: circuitBreakerManager.getOrCreate('redis', {
      failureThreshold: 5,
      timeout: 3000,
      resetTimeout: 30000
    })
  };
}

export default {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  createServiceBreakers,
  CircuitState
};
