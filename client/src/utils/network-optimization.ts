// Network optimization utilities for improved performance
import { handleUnauthorized } from '@/lib/auth-redirect';

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  cache?: RequestCache;
  credentials?: RequestCredentials;
}

interface BatchRequest {
  id: string;
  config: RequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

interface CachedResponse {
  data: any;
  timestamp: number;
  etag?: string;
}

// Request deduplication and batching manager
class NetworkOptimizer {
  private pendingRequests = new Map<string, Promise<any>>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: number | null = null;
  private responseCache = new Map<string, CachedResponse>();
  private requestStats = new Map<string, { count: number; totalTime: number }>();
  
  // Configuration
  private config = {
    batchDelay: 50, // ms to wait before sending batch
    maxBatchSize: 10,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enableDeduplication: true,
    enableBatching: true,
    enableCache: true,
    enableOptimisticUpdates: true,
    connectionAware: true,
  };

  constructor(config?: Partial<typeof NetworkOptimizer.prototype.config>) {
    this.config = { ...this.config, ...config };
    
    // Monitor connection changes
    if (this.config.connectionAware && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      connection?.addEventListener('change', () => this.onConnectionChange());
    }
  }

  // Request deduplication
  async request<T = any>(config: RequestConfig): Promise<T> {
    const requestKey = this.getRequestKey(config);
    
    // Check for pending request (deduplication)
    if (this.config.enableDeduplication && this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }
    
    // Check cache
    if (this.config.enableCache && config.method === 'GET') {
      const cached = this.getFromCache(requestKey);
      if (cached) {
        return Promise.resolve(cached);
      }
    }
    
    // Create request promise
    const requestPromise = this.executeRequest<T>(config);
    
    // Store for deduplication
    if (this.config.enableDeduplication) {
      this.pendingRequests.set(requestKey, requestPromise);
      
      // Clean up after completion
      requestPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }
    
    return requestPromise;
  }

  // Batch multiple requests
  async batchRequests<T = any>(configs: RequestConfig[]): Promise<T[]> {
    if (!this.config.enableBatching || configs.length === 1) {
      return Promise.all(configs.map(config => this.request<T>(config)));
    }
    
    return new Promise((resolve, reject) => {
      const batchId = `batch-${Date.now()}-${Math.random()}`;
      const results: T[] = new Array(configs.length);
      let completed = 0;
      
      configs.forEach((config, index) => {
        const request: BatchRequest = {
          id: `${batchId}-${index}`,
          config,
          resolve: (value) => {
            results[index] = value;
            completed++;
            if (completed === configs.length) {
              resolve(results);
            }
          },
          reject,
          timestamp: Date.now(),
        };
        
        this.addToBatch(request);
      });
    });
  }

  private addToBatch(request: BatchRequest): void {
    this.batchQueue.push(request);
    
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = window.setTimeout(() => {
        this.flushBatch();
      }, this.config.batchDelay);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.batchQueue.length === 0) return;
    
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    // Group requests by endpoint
    const grouped = this.groupRequestsByEndpoint(batch);
    
    // Execute grouped requests
    for (const [endpoint, requests] of grouped.entries()) {
      if (requests.length === 1) {
        // Single request, execute normally
        this.executeBatchRequest(requests[0]);
      } else {
        // Multiple requests to same endpoint, combine if possible
        this.executeCombinedRequests(endpoint, requests);
      }
    }
  }

  private groupRequestsByEndpoint(requests: BatchRequest[]): Map<string, BatchRequest[]> {
    const grouped = new Map<string, BatchRequest[]>();
    
    for (const request of requests) {
      const endpoint = new URL(request.config.url).pathname;
      if (!grouped.has(endpoint)) {
        grouped.set(endpoint, []);
      }
      grouped.get(endpoint)!.push(request);
    }
    
    return grouped;
  }

  private async executeBatchRequest(request: BatchRequest): Promise<void> {
    try {
      const result = await this.executeRequest(request.config);
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
  }

  private async executeCombinedRequests(endpoint: string, requests: BatchRequest[]): Promise<void> {
    // For GET requests to the same endpoint, we can potentially combine them
    const getRequests = requests.filter(r => r.config.method === 'GET' || !r.config.method);
    const otherRequests = requests.filter(r => r.config.method && r.config.method !== 'GET');
    
    // Execute non-GET requests individually
    for (const request of otherRequests) {
      this.executeBatchRequest(request);
    }
    
    // For GET requests, check if they can be combined
    if (getRequests.length > 1) {
      // If the endpoint supports batch fetching, combine them
      // Otherwise execute individually
      for (const request of getRequests) {
        this.executeBatchRequest(request);
      }
    } else if (getRequests.length === 1) {
      this.executeBatchRequest(getRequests[0]);
    }
  }

  private async executeRequest<T>(config: RequestConfig): Promise<T> {
    const startTime = performance.now();
    const requestKey = this.getRequestKey(config);
    
    // Adapt to connection speed
    const fetchConfig = this.adaptToConnection(config);
    
    try {
      const response = await fetch(config.url, {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        cache: fetchConfig.cache,
        credentials: config.credentials || 'same-origin',
      });
      
      if (!response.ok) {
        // Handle 401 Unauthorized - redirect to login silently
        if (response.status === 401) {
          // For auth check endpoints, just return null (expected behavior)
          if (config.url.includes('/api/auth/user') || config.url.includes('/api/user')) {
            return null as any;
          }
          // For other endpoints, trigger redirect to login
          handleUnauthorized(config.url);
          return null as any;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const endTime = performance.now();
      
      // Update stats
      this.updateRequestStats(requestKey, endTime - startTime);
      
      // Cache successful GET requests
      if (this.config.enableCache && config.method === 'GET') {
        this.addToCache(requestKey, data, response.headers.get('etag') || undefined);
      }
      
      return data;
    } catch (error) {
      const endTime = performance.now();
      this.updateRequestStats(requestKey, endTime - startTime);
      throw error;
    }
  }

  private getRequestKey(config: RequestConfig): string {
    const method = config.method || 'GET';
    
    // Handle both absolute and relative URLs
    try {
      // Try to parse as absolute URL
      const url = new URL(config.url);
      return `${method}:${url.pathname}${url.search}`;
    } catch {
      // If it fails, it's a relative URL
      // Extract pathname and search from relative URL
      const [pathname, search] = config.url.split('?');
      const searchParams = search ? `?${search}` : '';
      return `${method}:${pathname}${searchParams}`;
    }
  }

  private getFromCache(key: string): any | null {
    const cached = this.responseCache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTimeout) {
      this.responseCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private addToCache(key: string, data: any, etag?: string): void {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
    
    // Limit cache size
    if (this.responseCache.size > 100) {
      const oldest = Array.from(this.responseCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.responseCache.delete(oldest[0]);
    }
  }

  private updateRequestStats(key: string, time: number): void {
    const stats = this.requestStats.get(key) || { count: 0, totalTime: 0 };
    stats.count++;
    stats.totalTime += time;
    this.requestStats.set(key, stats);
  }

  private adaptToConnection(config: RequestConfig): RequestConfig {
    if (!this.config.connectionAware || !('connection' in navigator)) {
      return config;
    }
    
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType;
    
    // Adapt based on connection speed
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        // Aggressive caching, no prefetching
        return {
          ...config,
          cache: 'force-cache',
        };
      case '3g':
        // Normal caching
        return {
          ...config,
          cache: 'default',
        };
      case '4g':
      default:
        // Allow prefetching and normal caching
        return config;
    }
  }

  private onConnectionChange(): void {
    const connection = (navigator as any).connection;
    
    // Clear cache on significant connection change
    if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      // Keep cache in slow connections
    } else {
      // Clear old cache entries in fast connections
      const now = Date.now();
      for (const [key, cached] of this.responseCache.entries()) {
        if (now - cached.timestamp > this.config.cacheTimeout / 2) {
          this.responseCache.delete(key);
        }
      }
    }
  }

  // Optimistic updates
  optimisticUpdate<T>(
    key: string,
    updater: (current: T) => T,
    rollback?: (error: Error) => void
  ): T | undefined {
    if (!this.config.enableOptimisticUpdates) return undefined;
    
    const cached = this.getFromCache(key);
    if (!cached) return undefined;
    
    const updated = updater(cached);
    this.addToCache(key, updated);
    
    return updated;
  }

  // Clear cache
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.responseCache.clear();
      return;
    }
    
    for (const key of this.responseCache.keys()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
      }
    }
  }

  // Get statistics
  getStats(): Map<string, { count: number; averageTime: number }> {
    const stats = new Map<string, { count: number; averageTime: number }>();
    
    for (const [key, data] of this.requestStats.entries()) {
      stats.set(key, {
        count: data.count,
        averageTime: data.totalTime / data.count,
      });
    }
    
    return stats;
  }

  // Prefetch resources
  async prefetch(urls: string[]): Promise<void> {
    if (!('connection' in navigator)) {
      // Prefetch if no connection API
      urls.forEach(url => this.request({ url, method: 'GET' }));
      return;
    }
    
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType;
    const saveData = connection?.saveData;
    
    // Don't prefetch on slow connections or when save data is enabled
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      return;
    }
    
    // Prefetch in idle time
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        urls.forEach(url => this.request({ url, method: 'GET' }));
      });
    } else {
      setTimeout(() => {
        urls.forEach(url => this.request({ url, method: 'GET' }));
      }, 1000);
    }
  }
}

// Create singleton instance
const networkOptimizer = new NetworkOptimizer();

// Export utility functions
export const optimizedFetch = <T = any>(config: RequestConfig) => 
  networkOptimizer.request<T>(config);

export const batchFetch = <T = any>(configs: RequestConfig[]) => 
  networkOptimizer.batchRequests<T>(configs);

export const prefetchResources = (urls: string[]) => 
  networkOptimizer.prefetch(urls);

export const clearNetworkCache = (pattern?: string) => 
  networkOptimizer.clearCache(pattern);

export const getNetworkStats = () => 
  networkOptimizer.getStats();

export const optimisticUpdate = <T>(
  key: string,
  updater: (current: T) => T,
  rollback?: (error: Error) => void
) => networkOptimizer.optimisticUpdate(key, updater, rollback);

export default networkOptimizer;