/**
 * Centralized Logger - Fortune 500 Standard
 * 
 * Features:
 * - Request correlation IDs
 * - Structured JSON logging
 * - Performance metrics
 * - Security event logging
 * - Multi-transport support
 * - Log level management
 */

import winston from 'winston';
import 'winston-daily-rotate-file';
import { getRequestContext, getRequestId, getCorrelationId } from './request-context';
import { EventEmitter } from 'events';

const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const LOG_COLORS = {
  fatal: 'magenta',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'gray',
};

winston.addColors(LOG_COLORS);

interface LogMeta {
  service: string;
  requestId?: string;
  correlationId?: string;
  userId?: number;
  sessionId?: string;
  duration?: number;
  category?: 'security' | 'performance' | 'business' | 'system' | 'audit';
  [key: string]: unknown;
}

interface LogEntry {
  level: keyof typeof LOG_LEVELS;
  message: string;
  timestamp: string;
  service: string;
  requestId?: string;
  correlationId?: string;
  userId?: number;
  sessionId?: string;
  category?: string;
  duration?: number;
  details?: unknown;
  stack?: string;
  environment: string;
}

class CentralizedLogAggregator extends EventEmitter {
  private buffer: LogEntry[] = [];
  private maxEntries = 10000;
  private flushInterval: NodeJS.Timeout | null = null;
  private counters = {
    fatal: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
    trace: 0,
  };
  private alertThresholds = {
    errorRate: 0.1,
    fatalCount: 1,
  };

  constructor() {
    super();
    this.startAutoFlush();
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000);
  }

  record(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer = this.buffer.slice(-this.maxEntries);
    }

    const level = entry.level as keyof typeof this.counters;
    if (level in this.counters) {
      this.counters[level]++;
    }

    this.emit('log', entry);
    
    if (entry.level === 'fatal' || entry.level === 'error') {
      this.emit('alert', entry);
    }
  }

  private checkAlerts(): void {
    const total = Object.values(this.counters).reduce((sum, val) => sum + val, 0);
    if (total === 0) return;

    const errorRate = (this.counters.error + this.counters.fatal) / total;
    if (errorRate > this.alertThresholds.errorRate) {
      this.emit('high-error-rate', { rate: errorRate, threshold: this.alertThresholds.errorRate });
    }
  }

  getRecent(options: { limit?: number; level?: string; service?: string; since?: number } = {}): LogEntry[] {
    let logs = [...this.buffer];

    if (options.since) {
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= options.since!);
    }

    if (options.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    if (options.service) {
      logs = logs.filter(log => log.service === options.service);
    }

    return logs.slice(-(options.limit || 100)).reverse();
  }

  search(query: string, options: { limit?: number; caseSensitive?: boolean } = {}): LogEntry[] {
    const searchTerm = options.caseSensitive ? query : query.toLowerCase();
    return this.buffer
      .filter(log => {
        const message = options.caseSensitive ? log.message : log.message.toLowerCase();
        return message.includes(searchTerm);
      })
      .slice(-(options.limit || 100))
      .reverse();
  }

  getByRequestId(requestId: string): LogEntry[] {
    return this.buffer.filter(log => log.requestId === requestId);
  }

  getByCorrelationId(correlationId: string): LogEntry[] {
    return this.buffer.filter(log => log.correlationId === correlationId);
  }

  getStats(): { total: number; byLevel: { fatal: number; error: number; warn: number; info: number; debug: number; trace: number }; byService: Record<string, number> } {
    const byService: Record<string, number> = {};
    this.buffer.forEach(log => {
      byService[log.service] = (byService[log.service] || 0) + 1;
    });

    return {
      total: Object.values(this.counters).reduce((sum, val) => sum + val, 0),
      byLevel: { ...this.counters },
      byService,
    };
  }

  getErrorSummary(since?: number): { message: string; count: number; lastOccurrence: string }[] {
    const errors = this.buffer.filter(log => 
      (log.level === 'error' || log.level === 'fatal') &&
      (!since || new Date(log.timestamp).getTime() >= since)
    );

    const summary: Record<string, { count: number; lastOccurrence: string }> = {};
    errors.forEach(log => {
      const key = log.message.substring(0, 100);
      if (!summary[key]) {
        summary[key] = { count: 0, lastOccurrence: log.timestamp };
      }
      summary[key].count++;
      if (log.timestamp > summary[key].lastOccurrence) {
        summary[key].lastOccurrence = log.timestamp;
      }
    });

    return Object.entries(summary)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  clear(): void {
    this.buffer = [];
    this.counters = { fatal: 0, error: 0, warn: 0, info: 0, debug: 0, trace: 0 };
  }

  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'service', 'requestId', 'message'];
      const rows = this.buffer.map(log => 
        [log.timestamp, log.level, log.service, log.requestId || '', log.message.replace(/,/g, ';')]
      );
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    return JSON.stringify(this.buffer, null, 2);
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

export const centralizedAggregator = new CentralizedLogAggregator();

const winstonLogger = winston.createLogger({
  levels: LOG_LEVELS,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      const ctx = getRequestContext();
      if (ctx) {
        info.requestId = ctx.requestId;
        info.correlationId = ctx.correlationId;
        info.userId = ctx.userId;
        info.sessionId = ctx.sessionId;
        if (ctx.startTime) {
          info.duration = Date.now() - ctx.startTime;
        }
      }
      return info;
    })(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ecode-platform',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ level, message, timestamp, service, requestId, duration, ...rest }) => {
          let msg = `${timestamp} [${service}] ${level}: ${message}`;
          if (requestId && typeof requestId === 'string') msg += ` [req:${requestId.substring(0, 8)}]`;
          if (duration) msg += ` (${duration}ms)`;
          const meta = Object.keys(rest).filter(k => !['environment', 'version', 'splat'].includes(k));
          if (meta.length > 0) {
            const metaObj: Record<string, unknown> = {};
            meta.forEach(k => metaObj[k] = rest[k]);
            msg += ` ${JSON.stringify(metaObj)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  winstonLogger.add(new winston.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '50m',
    maxFiles: '30d',
    zippedArchive: true,
  }));

  winstonLogger.add(new winston.transports.DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '14d',
    zippedArchive: true,
  }));

  winstonLogger.add(new winston.transports.DailyRotateFile({
    filename: 'logs/security-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    maxSize: '50m',
    maxFiles: '90d',
    zippedArchive: true,
  }));
}

export interface CentralizedLogger {
  fatal: (message: string, meta?: Partial<LogMeta>) => void;
  error: (message: string, meta?: Partial<LogMeta>) => void;
  warn: (message: string, meta?: Partial<LogMeta>) => void;
  info: (message: string, meta?: Partial<LogMeta>) => void;
  debug: (message: string, meta?: Partial<LogMeta>) => void;
  trace: (message: string, meta?: Partial<LogMeta>) => void;
  security: (message: string, meta?: Partial<LogMeta>) => void;
  performance: (message: string, duration: number, meta?: Partial<LogMeta>) => void;
  audit: (action: string, resource: string, meta?: Partial<LogMeta>) => void;
  child: (defaultMeta: Partial<LogMeta>) => CentralizedLogger;
}

// Logger cache to prevent unnecessary object creation per service
const loggerCache = new Map<string, CentralizedLogger>();

function recordToAggregator(level: keyof typeof LOG_LEVELS, message: string, service: string, meta?: Partial<LogMeta>): void {
  const ctx = getRequestContext();
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service,
    requestId: ctx?.requestId || meta?.requestId as string,
    correlationId: ctx?.correlationId || meta?.correlationId as string,
    userId: ctx?.userId || meta?.userId,
    sessionId: ctx?.sessionId || meta?.sessionId,
    category: meta?.category,
    duration: meta?.duration,
    details: meta,
    environment: process.env.NODE_ENV || 'development',
  };
  centralizedAggregator.record(entry);
}

export function createCentralizedLogger(service: string): CentralizedLogger {
  // Return cached logger if exists (prevents memory growth)
  const cached = loggerCache.get(service);
  if (cached) {
    return cached;
  }

  const log = (level: keyof typeof LOG_LEVELS, message: string, meta?: Partial<LogMeta>) => {
    const fullMeta = { service, ...meta };
    (winstonLogger as any)[level](message, fullMeta);
    recordToAggregator(level, message, service, fullMeta);
  };

  const logger: CentralizedLogger = {
    fatal: (message, meta) => log('fatal', message, meta),
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    trace: (message, meta) => log('trace', message, meta),
    
    security: (message, meta) => log('warn', message, { ...meta, category: 'security' }),
    
    performance: (message, duration, meta) => log('info', message, { 
      ...meta, 
      category: 'performance',
      duration,
    }),
    
    audit: (action, resource, meta) => log('info', `AUDIT: ${action} on ${resource}`, { 
      ...meta, 
      category: 'audit',
    }),
    
    child: (defaultMeta) => {
      const childService = defaultMeta.service || `${service}:child`;
      const childLogger = createCentralizedLogger(childService);
      const originalLog = (level: keyof typeof LOG_LEVELS) => (message: string, meta?: Partial<LogMeta>) => {
        log(level, message, { ...defaultMeta, ...meta });
      };
      return {
        fatal: originalLog('fatal'),
        error: originalLog('error'),
        warn: originalLog('warn'),
        info: originalLog('info'),
        debug: originalLog('debug'),
        trace: originalLog('trace'),
        security: childLogger.security,
        performance: childLogger.performance,
        audit: childLogger.audit,
        child: childLogger.child,
      };
    },
  };

  // Cache the logger
  loggerCache.set(service, logger);
  return logger;
}

export { winstonLogger };
