// @ts-nocheck
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { redisCache } from './redis-cache';
import { config } from '../config/environment';

const logger = createLogger('database-query-optimizer');

interface QueryRecord {
  text: string;
  duration: number;
  startedAt: number;
  rows?: number;
  error?: string;
  fingerprint: string;
}

interface Recommendation {
  table: string;
  column?: string;
  reason: string;
  queryFingerprint: string;
}

const normalizeWhitespace = (query: string) =>
  query.replace(/\s+/g, ' ').trim();

const hashFingerprint = (query: string) =>
  Buffer.from(normalizeWhitespace(query)).toString('base64');

export class DatabaseQueryOptimizer extends EventEmitter {
  private slowQueries: QueryRecord[] = [];
  private recommendations: Map<string, Recommendation> = new Map();
  private instrumentedClients = new WeakSet<any>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    lastHitKey: '',
    lastMissKey: '',
  };

  constructor() {
    super();
  }

  instrument<T extends (...args: any[]) => any>(client: T): T {
    if (this.instrumentedClients.has(client)) {
      return client;
    }

    const handler: ProxyHandler<any> = {
      apply: (target, thisArg, argArray) => {
        const { text, values } = this.extractQuery(argArray);
        const start = process.hrtime.bigint();

        try {
          const result = Reflect.apply(target, thisArg, argArray);
          if (result && typeof result.then === 'function') {
            return result
              .then((rows: any) => {
                const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
                this.handleQuery(text, duration, rows?.length, values);
                return rows;
              })
              .catch((error: any) => {
                const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
                this.handleQuery(text, duration, undefined, values, error);
                throw error;
              });
          }

          const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
          this.handleQuery(text, duration, Array.isArray(result) ? result.length : undefined, values);
          return result;
        } catch (error) {
          const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
          this.handleQuery(text, duration, undefined, values, error);
          throw error;
        }
      },
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return new Proxy(value, handler);
        }
        return value;
      },
    };

    const proxy = new Proxy(client, handler);
    this.instrumentedClients.add(client);
    this.instrumentedClients.add(proxy);
    return proxy as T;
  }

  async withCache<T>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    if (!redisCache.isEnabled() || !redisCache.isHealthy()) {
      return callback();
    }

    const cached = await redisCache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      this.cacheStats.hits++;
      this.cacheStats.lastHitKey = key;
      this.emit('cache-hit', { key });
      return cached;
    }

    this.cacheStats.misses++;
    this.cacheStats.lastMissKey = key;
    const fresh = await callback();
    await redisCache.set(key, fresh, ttlSeconds);
    this.emit('cache-miss', { key });
    return fresh;
  }

  getSlowQueries(limit = 50): QueryRecord[] {
    return this.slowQueries.slice(-limit).reverse();
  }

  getRecommendations(): Recommendation[] {
    return Array.from(this.recommendations.values());
  }

  getCacheStats() {
    return { ...this.cacheStats, redisEnabled: redisCache.isEnabled(), redisHealthy: redisCache.isHealthy() };
  }

  private handleQuery(text: string, duration: number, rows?: number, values?: any[], error?: any) {
    if (!text) return;
    const fingerprint = hashFingerprint(text);

    if (duration >= config.database.slowQueryThresholdMs) {
      const record: QueryRecord = {
        text: normalizeWhitespace(text),
        duration: Number(duration.toFixed(2)),
        rows,
        startedAt: Date.now(),
        fingerprint,
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
      };
      this.slowQueries.push(record);
      if (this.slowQueries.length > 200) {
        this.slowQueries.shift();
      }

      logger.warn('Slow query detected', { duration: record.duration, query: record.text });
      this.emit('slow-query', record);
      this.generateRecommendation(record, values);
    }
  }

  private generateRecommendation(record: QueryRecord, values?: any[]) {
    const tableMatch = record.text.match(/from\s+([\w".]+)/i);
    const whereMatch = record.text.match(/where\s+([^;]+)/i);

    if (!tableMatch) {
      return;
    }

    const table = tableMatch[1].replace(/"/g, '');
    const columns: string[] = [];

    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.match(/([\w.]+)\s*=|\bIN\s*\(([^)]+)\)/gi) || [];
      columnMatches.forEach((match) => {
        const column = match.split('=')[0].replace(/\bIN\s*\($/i, '').trim();
        if (column && !columns.includes(column)) {
          columns.push(column);
        }
      });
    }

    const recommendation: Recommendation = {
      table,
      column: columns[0],
      reason: columns.length
        ? `Consider adding an index on ${columns[0]} for faster filtering on table ${table}`
        : `Review query plan for table ${table}; consider composite indexes or denormalization` ,
      queryFingerprint: record.fingerprint,
    };

    this.recommendations.set(record.fingerprint, recommendation);
  }

  private extractQuery(args: any[]): { text: string; values?: any[] } {
    if (!args || args.length === 0) {
      return { text: '' };
    }

    const [first, ...rest] = args;

    if (typeof first === 'string') {
      return { text: first, values: rest };
    }

    if (Array.isArray(first)) {
      const strings = first as string[];
      const params = rest;
      let text = '';
      for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < params.length) {
          text += `$${i + 1}`;
        }
      }
      return { text, values: params };
    }

    if (first && typeof first.text === 'string') {
      return { text: first.text, values: first.values };
    }

    return { text: '' };
  }
}

export const databaseQueryOptimizer = new DatabaseQueryOptimizer();
