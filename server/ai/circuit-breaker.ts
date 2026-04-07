/**
 * Circuit Breaker Pattern Implementation for AI Providers
 * Fortune 500 Production-Grade - 99.9% Uptime Target
 * 
 * Features:
 * - Automatic failure detection and recovery
 * - Exponential backoff with jitter
 * - Provider health monitoring
 * - Graceful degradation
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening the circuit
   * @default 5
   */
  failureThreshold: number;
  
  /**
   * Time in ms to wait before attempting recovery (half-open state)
   * @default 30000 (30 seconds)
   */
  resetTimeout: number;
  
  /**
   * Time window in ms for counting failures
   * @default 60000 (1 minute)
   */
  windowSize: number;
  
  /**
   * Number of successful requests needed to close circuit from half-open
   * @default 3
   */
  successThreshold: number;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries: number;
  
  /**
   * Initial delay in ms before first retry
   * @default 1000 (1 second)
   */
  initialDelay: number;
  
  /**
   * Maximum delay in ms between retries
   * @default 30000 (30 seconds)
   */
  maxDelay: number;
  
  /**
   * Exponential backoff multiplier
   * @default 2
   */
  backoffMultiplier: number;
  
  /**
   * Add random jitter to prevent thundering herd
   * @default true
   */
  useJitter: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = []; // Timestamps of failures
  private successCount: number = 0;
  private nextAttemptTime: number = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 30000,
      windowSize: config.windowSize ?? 60000,
      successThreshold: config.successThreshold ?? 3,
      debug: config.debug ?? false
    };
  }

  /**
   * Execute an async operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const currentState = this.getState();
    
    if (currentState === 'OPEN') {
      this.log('Circuit is OPEN, request rejected');
      if (fallback) {
        this.log('Executing fallback');
        return fallback();
      }
      throw new Error(`Circuit breaker ${this.name} is OPEN`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute an async generator with circuit breaker protection
   */
  async *executeStream<T>(
    operation: () => AsyncGenerator<T>,
    fallback?: () => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    const currentState = this.getState();
    
    if (currentState === 'OPEN') {
      this.log('Circuit is OPEN, stream request rejected');
      if (fallback) {
        this.log('Executing fallback stream');
        yield* fallback();
        return;
      }
      throw new Error(`Circuit breaker ${this.name} is OPEN`);
    }

    try {
      let hasError = false;
      try {
        for await (const chunk of operation()) {
          yield chunk;
        }
      } catch (error) {
        hasError = true;
        this.onFailure();
        throw error;
      }
      
      if (!hasError) {
        this.onSuccess();
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  private getState(): CircuitState {
    if (this.state === 'OPEN') {
      // Check if we should transition to half-open
      if (Date.now() >= this.nextAttemptTime) {
        this.log('Transitioning from OPEN to HALF_OPEN');
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    
    return this.state;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      this.log(`Success in HALF_OPEN state (${this.successCount}/${this.config.successThreshold})`);
      
      if (this.successCount >= this.config.successThreshold) {
        this.log('Closing circuit after successful recovery');
        this.close();
      }
    } else if (this.state === 'CLOSED') {
      // Clear old failures
      this.clearOldFailures();
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.clearOldFailures();
    
    if (this.state === 'HALF_OPEN') {
      this.log('Failure in HALF_OPEN state, reopening circuit');
      this.open();
    } else if (this.state === 'CLOSED') {
      const recentFailures = this.failures.length;
      this.log(`Failure recorded (${recentFailures}/${this.config.failureThreshold})`);
      
      if (recentFailures >= this.config.failureThreshold) {
        this.log('Failure threshold reached, opening circuit');
        this.open();
      }
    }
  }

  /**
   * Open the circuit (stop requests)
   */
  private open(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    this.successCount = 0;
    this.log(`Circuit OPEN until ${new Date(this.nextAttemptTime).toISOString()}`);
  }

  /**
   * Close the circuit (resume normal operation)
   */
  private close(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.successCount = 0;
    this.log('Circuit CLOSED - normal operation resumed');
  }

  /**
   * Remove failures outside the time window
   */
  private clearOldFailures(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.failures = this.failures.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.getState(),
      failures: this.failures.length,
      failureThreshold: this.config.failureThreshold,
      nextAttemptTime: this.state === 'OPEN' ? new Date(this.nextAttemptTime).toISOString() : null,
      successCount: this.successCount,
      successThreshold: this.config.successThreshold
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.close();
    this.log('Circuit manually reset');
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.config.debug || process.env.NODE_ENV === 'development') {
      logger.debug(`[${this.name}] ${message}`);
    }
  }
}

/**
 * Retry executor with exponential backoff
 */
export class RetryExecutor {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      useJitter: config.useJitter ?? true
    };
  }

  /**
   * Execute operation with exponential backoff retry
   */
  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry this error
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        logger.info(`[RetryExecutor] Attempt ${attempt + 1}/${this.config.maxRetries + 1} failed, retrying in ${delay}ms...`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute async generator with retry on error
   */
  async *executeStream<T>(
    operation: () => AsyncGenerator<T>,
    shouldRetry?: (error: any) => boolean
  ): AsyncGenerator<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        yield* operation();
        return; // Success, exit
      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry this error
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        logger.info(`[RetryExecutor] Stream attempt ${attempt + 1}/${this.config.maxRetries + 1} failed, retrying in ${delay}ms...`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxDelay
    );
    
    if (!this.config.useJitter) {
      return exponentialDelay;
    }
    
    // Add jitter: random value between 0 and calculated delay
    // This prevents thundering herd problem
    return Math.floor(Math.random() * exponentialDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Retry on network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  
  // Retry on 429 (Rate Limit) and 503 (Service Unavailable)
  if (error.status === 429 || error.status === 503) {
    return true;
  }
  
  // Retry on 500-level errors (server issues)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Don't retry on 4xx client errors (except 429)
  if (error.status >= 400 && error.status < 500) {
    return false;
  }
  
  return true;
}
