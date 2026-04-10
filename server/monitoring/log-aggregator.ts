import { EventEmitter } from 'events';

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service: string;
  timestamp: number;
  details?: unknown[];
}

class LogAggregator extends EventEmitter {
  private buffer: LogEntry[] = [];
  private maxEntries = 500;
  private counters = {
    info: 0,
    warn: 0,
    error: 0,
    debug: 0,
  };

  record(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }

    this.counters[entry.level]++;
    this.emit('log', entry);
  }

  getRecent(limit = 100): LogEntry[] {
    return this.buffer.slice(-limit).reverse();
  }

  getStats() {
    const total = Object.values(this.counters).reduce((sum, value) => sum + value, 0);
    return {
      total,
      ...this.counters,
    };
  }

  clear(): void {
    this.buffer = [];
    this.counters = { info: 0, warn: 0, error: 0, debug: 0 };
  }
}

export const logAggregator = new LogAggregator();
