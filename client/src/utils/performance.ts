import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from 'web-vitals';

// Long Task Entry interface for performance monitoring
interface LongTaskEntry extends PerformanceEntry {
  duration: number;
  startTime: number;
  name: string;
}

// Performance monitoring configuration
interface PerformanceConfig {
  enableReporting: boolean;
  reportingUrl?: string;
  sampleRate: number;
  enableDetailedLogging: boolean;
  longTaskThreshold: number;
  resourceTimingBufferSize: number;
}

// Performance metrics storage
interface PerformanceMetrics {
  webVitals: {
    cls?: number;
    fcp?: number;
    inp?: number;
    lcp?: number;
    ttfb?: number;
  };
  customMarks: Map<string, number>;
  customMeasures: Map<string, number>;
  resourceTimings: PerformanceResourceTiming[];
  longTasks: LongTaskEntry[];
  errors: Error[];
}

// Performance thresholds
interface PerformanceThresholds {
  cls: { good: number; needsImprovement: number };
  fcp: { good: number; needsImprovement: number };
  inp: { good: number; needsImprovement: number };
  lcp: { good: number; needsImprovement: number };
  ttfb: { good: number; needsImprovement: number };
  [key: string]: { good: number; needsImprovement: number } | undefined;
}

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private observer: PerformanceObserver | null = null;
  private longTaskObserver: PerformanceObserver | null = null;
  private reportingQueue: any[] = [];
  private reportingTimer: number | null = null;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      enableReporting: true,
      reportingUrl: '/api/monitoring/performance',
      sampleRate: 1.0,
      enableDetailedLogging: false,
      longTaskThreshold: 50,
      resourceTimingBufferSize: 250,
      ...config,
    };

    this.metrics = {
      webVitals: {},
      customMarks: new Map(),
      customMeasures: new Map(),
      resourceTimings: [],
      longTasks: [],
      errors: [],
    };

    this.thresholds = {
      cls: { good: 0.1, needsImprovement: 0.25 },
      fcp: { good: 1800, needsImprovement: 3000 },
      inp: { good: 200, needsImprovement: 500 },
      lcp: { good: 2500, needsImprovement: 4000 },
      ttfb: { good: 800, needsImprovement: 1800 },
    };

    this.initialize();
  }

  private initialize(): void {
    // Initialize Web Vitals monitoring
    this.initializeWebVitals();

    // Initialize resource timing observer
    this.initializeResourceTiming();

    // Initialize long task observer
    this.initializeLongTaskObserver();

    // Set up error tracking
    this.initializeErrorTracking();

    // Set up navigation timing
    this.trackNavigationTiming();

    // Set up visibility change tracking
    this.trackVisibilityChanges();

    // Set up network connection monitoring
    this.trackNetworkConnection();
  }

  private initializeWebVitals(): void {
    // Should we sample this user?
    if (Math.random() > this.config.sampleRate) return;

    const reportMetric = (metric: Metric) => {
      const metricKey = metric.name.toLowerCase() as keyof PerformanceMetrics['webVitals'];
      if (metricKey in this.metrics.webVitals) {
        this.metrics.webVitals[metricKey] = metric.value;
      }

      this.queueReport({
        type: 'web-vital',
        metric: metric.name,
        value: metric.value,
        rating: this.getRating(metric.name, metric.value),
        timestamp: Date.now(),
      });
    };

    onCLS(reportMetric);
    onFCP(reportMetric);
    onINP(reportMetric);
    onLCP(reportMetric);
    onTTFB(reportMetric);
  }

  private initializeResourceTiming(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        
        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.metrics.resourceTimings.push(entry);
            
            // Track slow resources
            if (entry.duration > 1000) {
              this.queueReport({
                type: 'slow-resource',
                url: entry.name,
                duration: entry.duration,
                size: entry.transferSize || 0,
                timestamp: Date.now(),
              });
            }
          }
        });

        // Keep only the most recent entries
        if (this.metrics.resourceTimings.length > this.config.resourceTimingBufferSize) {
          this.metrics.resourceTimings = this.metrics.resourceTimings.slice(-this.config.resourceTimingBufferSize);
        }
      });

      this.observer.observe({ entryTypes: ['resource', 'navigation'] });
    } catch (error) {
      console.error('[Performance] Failed to initialize resource timing:', error);
    }
  }

  private initializeLongTaskObserver(): void {
    if (!('PerformanceObserver' in window) || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      return;
    }

    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as LongTaskEntry[];
        
        entries.forEach((entry) => {
          if (entry.duration > this.config.longTaskThreshold) {
            this.metrics.longTasks.push(entry);
            
            this.queueReport({
              type: 'long-task',
              duration: entry.duration,
              startTime: entry.startTime,
              timestamp: Date.now(),
            });
          }
        });
      });

      this.longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.error('[Performance] Failed to initialize long task observer:', error);
    }
  }

  private initializeErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.metrics.errors.push(event.error || new Error(event.message));
      
      this.queueReport({
        type: 'error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.metrics.errors.push(new Error(event.reason));
      
      this.queueReport({
        type: 'unhandled-rejection',
        reason: event.reason,
        timestamp: Date.now(),
      });
    });
  }

  private trackNavigationTiming(): void {
    if (!performance.getEntriesByType) return;

    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    
    if (navigationEntries.length > 0) {
      const navigation = navigationEntries[0];
      
      this.queueReport({
        type: 'navigation',
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domComplete: navigation.domComplete - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        timestamp: Date.now(),
      });
    }
  }

  private trackVisibilityChanges(): void {
    let hiddenTime = 0;
    let visibleTime = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenTime = Date.now();
        const activeTime = hiddenTime - visibleTime;
        
        this.queueReport({
          type: 'visibility',
          state: 'hidden',
          activeTime,
          timestamp: hiddenTime,
        });
      } else {
        visibleTime = Date.now();
        const inactiveTime = visibleTime - hiddenTime;
        
        this.queueReport({
          type: 'visibility',
          state: 'visible',
          inactiveTime,
          timestamp: visibleTime,
        });
      }
    });
  }

  private trackNetworkConnection(): void {
    if (!('connection' in navigator)) return;

    const connection = (navigator as any).connection;
    
    const reportConnection = () => {
      this.queueReport({
        type: 'network',
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        timestamp: Date.now(),
      });
    };

    connection.addEventListener('change', reportConnection);
    reportConnection(); // Report initial state
  }

  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[metric.toLowerCase()];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  // Public API methods
  public mark(name: string): void {
    const timestamp = performance.now();
    performance.mark(name);
    this.metrics.customMarks.set(name, timestamp);
  }

  public measure(name: string, startMark?: string, endMark?: string): void {
    try {
      performance.measure(name, startMark, endMark);
      const measures = performance.getEntriesByName(name, 'measure');
      
      if (measures.length > 0) {
        const measure = measures[measures.length - 1];
        this.metrics.customMeasures.set(name, measure.duration);

        this.queueReport({
          type: 'custom-measure',
          name,
          duration: measure.duration,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`[Performance] Failed to measure ${name}:`, error);
    }
  }

  public startTimer(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.metrics.customMeasures.set(name, duration);

      this.queueReport({
        type: 'timer',
        name,
        duration,
        timestamp: Date.now(),
      });
    };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getWebVitals(): PerformanceMetrics['webVitals'] {
    return { ...this.metrics.webVitals };
  }

  public clearMetrics(): void {
    this.metrics.customMarks.clear();
    this.metrics.customMeasures.clear();
    this.metrics.resourceTimings = [];
    this.metrics.longTasks = [];
    this.metrics.errors = [];
  }

  private queueReport(data: any): void {
    if (!this.config.enableReporting) return;

    this.reportingQueue.push({
      ...data,
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });

    // Batch reports to reduce network overhead
    if (this.reportingTimer) {
      clearTimeout(this.reportingTimer);
    }

    this.reportingTimer = window.setTimeout(() => {
      this.flushReports();
    }, 5000); // Send reports every 5 seconds
  }

  private async flushReports(): Promise<void> {
    if (this.reportingQueue.length === 0) return;

    const reports = [...this.reportingQueue];
    this.reportingQueue = [];

    try {
      if (this.config.reportingUrl) {
        await fetch(this.config.reportingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reports,
            sessionId: this.getSessionId(),
            timestamp: Date.now(),
          }),
        });
      }
    } catch (error) {
      console.error('[Performance] Failed to send reports:', error);
      // Re-queue reports for retry
      this.reportingQueue.unshift(...reports);
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('perf-session-id');
    
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('perf-session-id', sessionId);
    }
    
    return sessionId;
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    if (this.reportingTimer) {
      clearTimeout(this.reportingTimer);
      this.flushReports();
    }
  }
}

// Create and export singleton instance
const performanceMonitor = new PerformanceMonitor({
  enableReporting: process.env.NODE_ENV === 'production',
  enableDetailedLogging: process.env.NODE_ENV === 'development',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // Sample 10% of production users
});

// Export utility functions
export const markPerformance = (name: string) => performanceMonitor.mark(name);
export const measurePerformance = (name: string, startMark?: string, endMark?: string) => 
  performanceMonitor.measure(name, startMark, endMark);
export const startTimer = (name: string) => performanceMonitor.startTimer(name);
export const getPerformanceMetrics = () => performanceMonitor.getMetrics();
export const getWebVitals = () => performanceMonitor.getWebVitals();

export default performanceMonitor;