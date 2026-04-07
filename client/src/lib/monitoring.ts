/**
 * Production Monitoring Service
 * Provides enterprise-grade monitoring, error tracking, and performance metrics
 * Essential for Fortune 500 production standards
 */

interface ErrorEvent {
  message: string;
  stack?: string;
  type: 'error' | 'unhandledRejection';
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  tags?: Record<string, string>;
}

interface UserAction {
  action: string;
  category: string;
  label?: string;
  value?: number;
  timestamp: number;
  userId?: number;
  sessionId?: string;
}

class MonitoringService {
  private errorQueue: ErrorEvent[] = [];
  private metricsQueue: PerformanceMetric[] = [];
  private actionsQueue: UserAction[] = [];
  private flushInterval: number = 30000; // 30 seconds
  private maxQueueSize: number = 100;
  private sessionId: string;
  private userId?: number;
  private isInitialized: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;
    
    // Set up error handlers
    this.setupErrorHandlers();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
    
    // Set up periodic flush
    this.setupPeriodicFlush();
    
    // Monitor page visibility
    this.setupVisibilityMonitoring();
    
    this.isInitialized = true;
  }

  private setupErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        type: 'error',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      this.captureError({
        message: error?.message || String(error),
        stack: error?.stack,
        type: 'unhandledRejection',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.userId,
        sessionId: this.sessionId,
        metadata: {
          promise: String(event.promise)
        }
      });
      
      // Prevent default browser behavior
      event.preventDefault();
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor navigation timing
    if ('performance' in window && 'getEntriesByType' in window.performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigationTiming) {
            this.trackMetric('page_load_time', navigationTiming.loadEventEnd - navigationTiming.fetchStart, 'ms');
            this.trackMetric('dom_content_loaded', navigationTiming.domContentLoadedEventEnd - navigationTiming.fetchStart, 'ms');
            this.trackMetric('first_byte_time', navigationTiming.responseStart - navigationTiming.fetchStart, 'ms');
          }
        }, 0);
      });
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.trackMetric('long_task', entry.duration, 'ms', {
                name: entry.name,
                startTime: String(entry.startTime)
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long task monitoring not supported');
      }
    }

    // Monitor resource timing
    this.monitorResourceTiming();
  }

  private monitorResourceTiming() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.duration > 1000) { // Resources taking more than 1s
              this.trackMetric('slow_resource', resourceEntry.duration, 'ms', {
                name: resourceEntry.name,
                type: resourceEntry.initiatorType
              });
            }
          }
        });
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Resource timing monitoring not supported');
      }
    }
  }

  private setupVisibilityMonitoring() {
    let hiddenTime: number | null = null;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else if (hiddenTime) {
        const hiddenDuration = Date.now() - hiddenTime;
        this.trackMetric('page_hidden_duration', hiddenDuration, 'ms');
        hiddenTime = null;
      }
    });

    // Track when user leaves
    window.addEventListener('beforeunload', () => {
      this.flush(true); // Force flush on page unload
    });
  }

  private setupPeriodicFlush() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  
  public setUser(userId: number) {
    this.userId = userId;
  }

  public captureError(error: Error | ErrorEvent | string, metadata?: Record<string, any>) {
    const errorEvent: ErrorEvent = typeof error === 'string' 
      ? {
          message: error,
          type: 'error',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.userId,
          sessionId: this.sessionId,
          metadata
        }
      : 'message' in error && 'timestamp' in error
      ? error as ErrorEvent
      : {
          message: error.message,
          stack: error.stack,
          type: 'error',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.userId,
          sessionId: this.sessionId,
          metadata
        };

    this.errorQueue.push(errorEvent);
    
    // Flush immediately for critical errors
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public trackMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count' = 'count', tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    this.metricsQueue.push(metric);
    
    if (this.metricsQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public trackAction(action: string, category: string, label?: string, value?: number) {
    const userAction: UserAction = {
      action,
      category,
      label,
      value,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.actionsQueue.push(userAction);
    
    if (this.actionsQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public measurePerformance<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.trackMetric(`function_${name}`, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackMetric(`function_${name}_error`, duration, 'ms');
      throw error;
    }
  }

  public async measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.trackMetric(`async_function_${name}`, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackMetric(`async_function_${name}_error`, duration, 'ms');
      throw error;
    }
  }

  private async flush(force: boolean = false) {
    if (!force && this.errorQueue.length === 0 && this.metricsQueue.length === 0 && this.actionsQueue.length === 0) {
      return;
    }

    const payload = {
      errors: [...this.errorQueue],
      metrics: [...this.metricsQueue],
      actions: [...this.actionsQueue],
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    // Clear queues
    this.errorQueue = [];
    this.metricsQueue = [];
    this.actionsQueue = [];

    try {
      // Use beacon API for reliability on page unload
      if (force && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/monitoring/events', JSON.stringify(payload));
      } else {
        await fetch('/api/monitoring/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Failed to send monitoring data:', error);
      // Re-queue data if send failed (with limit to prevent memory issues)
      if (this.errorQueue.length + payload.errors.length < this.maxQueueSize * 2) {
        this.errorQueue.push(...payload.errors);
      }
      if (this.metricsQueue.length + payload.metrics.length < this.maxQueueSize * 2) {
        this.metricsQueue.push(...payload.metrics);
      }
    }
  }

  // Health check
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/monitoring/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const monitoring = new MonitoringService();

// Export types
export type { ErrorEvent, PerformanceMetric, UserAction };