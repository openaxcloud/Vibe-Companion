/* eslint-disable no-console */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  prefix: process.env.LOG_PREFIX || '',
  enableTimestamp: true,
};

const formatTimestamp = (): string => {
  return new Date().toISOString();
};

const shouldLog = (currentLevel: LogLevel, messageLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[currentLevel];
};

const buildPrefix = (options: Required<LoggerOptions>): string => {
  const parts: string[] = [];

  if (options.enableTimestamp) {
    parts.push(formatTimestamp());
  }

  if (options.prefix) {
    parts.push(options.prefix);
  }

  return parts.length ? `[undefined]` : '';
};

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setLevel: (level: LogLevel) => void;
  setPrefix: (prefix: string) => void;
  setOptions: (options: Partial<LoggerOptions>) => void;
  getOptions: () => Readonly<Required<LoggerOptions>>;
}

class ConsoleLogger implements Logger {
  private options: Required<LoggerOptions>;

  constructor(options?: LoggerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  debug = (...args: unknown[]): void => {
    if (!shouldLog(this.options.level, 'debug')) return;
    const prefix = buildPrefix(this.options);
    if (prefix) {
      console.debug(prefix, ...args);
    } else {
      console.debug(...args);
    }
  };

  info = (...args: unknown[]): void => {
    if (!shouldLog(this.options.level, 'info')) return;
    const prefix = buildPrefix(this.options);
    if (prefix) {
      console.info(prefix, ...args);
    } else {
      console.info(...args);
    }
  };

  warn = (...args: unknown[]): void => {
    if (!shouldLog(this.options.level, 'warn')) return;
    const prefix = buildPrefix(this.options);
    if (prefix) {
      console.warn(prefix, ...args);
    } else {
      console.warn(...args);
    }
  };

  error = (...args: unknown[]): void => {
    if (!shouldLog(this.options.level, 'error')) return;
    const prefix = buildPrefix(this.options);
    if (prefix) {
      console.error(prefix, ...args);
    } else {
      console.error(...args);
    }
  };

  setLevel = (level: LogLevel): void => {
    this.options = { ...this.options, level };
  };

  setPrefix = (prefix: string): void => {
    this.options = { ...this.options, prefix };
  };

  setOptions = (options: Partial<LoggerOptions>): void => {
    this.options = { ...this.options, ...options };
  };

  getOptions = (): Readonly<Required<LoggerOptions>> => {
    return { ...this.options };
  };
}

const defaultLogger = new ConsoleLogger();

export const logger: Logger = defaultLogger;

export const createLogger = (options?: LoggerOptions): Logger => {
  return new ConsoleLogger(options);
};