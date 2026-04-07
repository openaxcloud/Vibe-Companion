/**
 * Request Debouncer Service
 * Debounces user requests to reduce unnecessary AI calls
 * Batches similar requests within 300ms window
 */

export interface DebouncedRequest {
  operation: string;
  parameters: Record<string, any>;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class RequestDebouncerService {
  private readonly DEBOUNCE_MS = 300;
  private readonly pendingRequests: Map<string, {
    requests: DebouncedRequest[];
    timer: NodeJS.Timeout;
  }> = new Map();

  /**
   * Debounce a request
   * Returns a promise that resolves when the debounced operation completes
   */
  async debounce<T>(
    key: string,
    operation: string,
    parameters: Record<string, any>,
    executor: (batched: DebouncedRequest[]) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: DebouncedRequest = {
        operation,
        parameters,
        resolve,
        reject,
      };

      const existing = this.pendingRequests.get(key);

      if (existing) {
        // Add to existing batch
        existing.requests.push(request);
        
        // Reset timer
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => {
          this.executeBatch(key, executor);
        }, this.DEBOUNCE_MS);
      } else {
        // Create new batch
        const timer = setTimeout(() => {
          this.executeBatch(key, executor);
        }, this.DEBOUNCE_MS);

        this.pendingRequests.set(key, {
          requests: [request],
          timer,
        });
      }
    });
  }

  /**
   * Execute batched requests
   */
  private async executeBatch<T>(
    key: string,
    executor: (batched: DebouncedRequest[]) => Promise<T>
  ): Promise<void> {
    const batch = this.pendingRequests.get(key);
    
    if (!batch) {
      return;
    }

    // Remove from pending
    this.pendingRequests.delete(key);

    try {
      // Execute batch
      const result = await executor(batch.requests);
      
      // Resolve all requests with same result
      batch.requests.forEach(req => req.resolve(result));
    } catch (error) {
      // Reject all requests with same error
      batch.requests.forEach(req => req.reject(error as Error));
    }
  }

  /**
   * Get pending requests count
   */
  getPendingCount(): number {
    let count = 0;
    this.pendingRequests.forEach(batch => {
      count += batch.requests.length;
    });
    return count;
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    this.pendingRequests.forEach(batch => {
      clearTimeout(batch.timer);
      batch.requests.forEach(req => {
        req.reject(new Error('Debouncer cleared'));
      });
    });
    this.pendingRequests.clear();
  }

  /**
   * Generate debounce key from parameters
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    // Create stable hash from parameters
    const sorted = Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

    return `${prefix}:${JSON.stringify(sorted)}`;
  }
}

export const requestDebouncer = new RequestDebouncerService();
