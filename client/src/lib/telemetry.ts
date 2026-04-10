/**
 * Frontend Telemetry SDK - Fortune 500 Standard
 * 
 * Features:
 * - Automatic error capture
 * - User action tracking
 * - Performance metrics
 * - Network request logging
 * - Session management
 * - Batched log shipping
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type LogCategory = 'error' | 'action' | 'navigation' | 'performance' | 'network';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  source: string;
  category?: LogCategory;
  url?: string;
  userAgent?: string;
  sessionId?: string;
  userId?: number;
  stack?: string;
  metadata?: Record<string, unknown>;
}

interface TelemetryConfig {
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  sampleRate: number;
  enabled: boolean;
  debug: boolean;
}

// Production: 30s flush interval to reduce rate limit hits (2 req/min vs 12 req/min)
// Development: 5s for faster debugging feedback
const isProduction = typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('127.0.0.1');

const defaultConfig: TelemetryConfig = {
  endpoint: '/api/logs/ingest',
  batchSize: isProduction ? 25 : 10,
  flushInterval: isProduction ? 30000 : 5000,
  maxRetries: 3,
  sampleRate: 1.0, // Keep 100% - errors/warnings must never be dropped
  enabled: true,
  debug: false,
};

class FrontendTelemetry {
  private config: TelemetryConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private userId?: number;
  private isInitialized = false;
  private originalConsole: Partial<Console> = {};

  constructor() {
    this.config = { ...defaultConfig };
    this.sessionId = this.generateSessionId();
  }

  init(options: Partial<TelemetryConfig> = {}): void {
    if (this.isInitialized) return;

    this.config = { ...this.config, ...options };
    
    if (!this.config.enabled) return;

    this.setupErrorHandlers();
    this.setupConsoleInterceptors();
    this.setupPerformanceObserver();
    this.setupNetworkInterceptor();
    this.startFlushTimer();
    
    this.isInitialized = true;
    
    this.info('Telemetry initialized', { 
      category: 'action',
      metadata: { sessionId: this.sessionId } 
    });
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  setUserId(userId: number): void {
    this.userId = userId;
    this.info('User identified', { 
      category: 'action',
      metadata: { userId } 
    });
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private log(level: LogLevel, message: string, options: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>> = {}): void {
    if (!this.config.enabled || !this.shouldSample()) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      source: 'frontend',
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      userId: this.userId,
      ...options,
    };

    this.buffer.push(entry);

    if (this.config.debug) {
      console.log('[Telemetry]', entry);
    }

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  error(message: string, options?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>): void {
    this.log('error', message, { category: 'error', ...options });
  }

  warn(message: string, options?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>): void {
    this.log('warn', message, options);
  }

  info(message: string, options?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>): void {
    this.log('info', message, options);
  }

  debug(message: string, options?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>): void {
    this.log('debug', message, options);
  }

  trackAction(action: string, metadata?: Record<string, unknown>): void {
    this.info(`Action: ${action}`, { category: 'action', metadata });
  }

  trackNavigation(from: string, to: string): void {
    this.info(`Navigation: ${from} -> ${to}`, { 
      category: 'navigation',
      metadata: { from, to } 
    });
  }

  trackPerformance(metric: string, value: number, metadata?: Record<string, unknown>): void {
    this.info(`Performance: ${metric} = ${value}ms`, { 
      category: 'performance',
      metadata: { metric, value, ...metadata } 
    });
  }

  trackNetwork(url: string, method: string, status: number, duration: number): void {
    const level: LogLevel = status >= 400 ? 'error' : 'info';
    this.log(level, `Network: ${method} ${url} ${status}`, {
      category: 'network',
      metadata: { url, method, status, duration },
    });
  }

  private setupErrorHandlers(): void {
    window.addEventListener('error', (event) => {
      this.error(`Uncaught error: ${event.message}`, {
        stack: event.error?.stack,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || String(event.reason);
      this.error(`Unhandled promise rejection: ${message}`, {
        stack: event.reason?.stack,
      });
    });
  }

  private setupConsoleInterceptors(): void {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    
    // Patterns to suppress from telemetry (dev-only noise)
    const suppressPatterns = [
      '[vite] failed to connect to websocket',
      'localhost:5173',
      'localhost:24678',
      '[AnimationMonitor] Optimizing',
      '[AnimationMonitor] High frame drops',
      'WebSocket handshake',
    ];
    
    const shouldSuppress = (message: string): boolean => {
      return suppressPatterns.some(pattern => message.includes(pattern));
    };
    
    levels.forEach((level) => {
      this.originalConsole[level] = console[level];
      console[level] = (...args: unknown[]) => {
        this.originalConsole[level]?.apply(console, args);
        
        if (level === 'error' || level === 'warn') {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          
          // Skip dev-only noise from telemetry
          if (shouldSuppress(message)) {
            return;
          }
          
          this.log(level, `Console ${level}: ${message}`);
        }
      };
    });
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint') {
            this.trackPerformance('LCP', entry.startTime);
          } else if (entry.entryType === 'first-input') {
            const fid = entry as PerformanceEventTiming;
            this.trackPerformance('FID', fid.processingStart - fid.startTime);
          } else if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            this.trackPerformance('CLS', (entry as any).value * 1000);
          }
        });
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      observer.observe({ type: 'first-input', buffered: true });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // PerformanceObserver not supported for some entry types
    }
  }

  private setupNetworkInterceptor(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const method = (args[1]?.method || 'GET').toUpperCase();

      try {
        const response = await originalFetch.apply(window, args);
        const duration = performance.now() - startTime;
        
        if (!url.includes('/api/logs')) {
          this.trackNetwork(url, method, response.status, duration);
        }
        
        return response;
      } catch (error: any) {
        const duration = performance.now() - startTime;
        this.trackNetwork(url, method, 0, duration);
        this.error(`Network error: ${method} ${url}`, {
          metadata: { error: error.message },
        });
        throw error;
      }
    };
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    window.addEventListener('beforeunload', () => {
      this.flush(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      }
    });
  }

  async flush(useBeacon = false): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    const payload = JSON.stringify({
      logs,
      sessionId: this.sessionId,
      pageUrl: window.location.href,
    });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(this.config.endpoint, payload);
      return;
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });

      if (!response.ok) {
        this.buffer.unshift(...logs);
      }
    } catch (error) {
      this.buffer.unshift(...logs);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    Object.entries(this.originalConsole).forEach(([level, fn]) => {
      if (fn) {
        (console as any)[level] = fn;
      }
    });

    this.flush(true);
    this.isInitialized = false;
  }
}

export const telemetry = new FrontendTelemetry();

export function initTelemetry(options?: Partial<TelemetryConfig>): void {
  telemetry.init(options);
}

export function setTelemetryUser(userId: number): void {
  telemetry.setUserId(userId);
}

export function trackAction(action: string, metadata?: Record<string, unknown>): void {
  telemetry.trackAction(action, metadata);
}

export function trackNavigation(from: string, to: string): void {
  telemetry.trackNavigation(from, to);
}

export function trackPerformance(metric: string, value: number, metadata?: Record<string, unknown>): void {
  telemetry.trackPerformance(metric, value, metadata);
}

export function logError(message: string, error?: Error, metadata?: Record<string, unknown>): void {
  telemetry.error(message, {
    stack: error?.stack,
    metadata: { errorName: error?.name, ...metadata },
  });
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  telemetry.info(message, { metadata });
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  telemetry.warn(message, { metadata });
}

export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  telemetry.debug(message, { metadata });
}
