import util from "node:util";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  child: (context: Record<string, unknown>) => Logger;
}

type InternalLogMethod = (message?: unknown, ...optionalParams: unknown[]) => void;

interface LoggerConfig {
  level: LogLevel;
  serviceName?: string;
}

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const envLogLevel = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
const defaultLevel: LogLevel = LOG_LEVELS.includes(envLogLevel) ? envLogLevel : "info";

const config: LoggerConfig = {
  level: defaultLevel,
  serviceName: process.env.SERVICE_NAME || process.env.npm_package_name || "backend-service",
};

function shouldLog(targetLevel: LogLevel, currentLevel: LogLevel): boolean {
  return LOG_LEVELS.indexOf(targetLevel) >= LOG_LEVELS.indexOf(currentLevel);
}

function getConsoleMethod(level: LogLevel): InternalLogMethod {
  switch (level) {
    case "debug":
      return console.debug ? console.debug.bind(console) : console.log.bind(console);
    case "info":
      return console.info ? console.info.bind(console) : console.log.bind(console);
    case "warn":
      return console.warn.bind(console);
    case "error":
      return console.error.bind(console);
    default:
      return console.log.bind(console);
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMeta(meta: unknown): unknown {
  if (meta === undefined || meta === null) return undefined;
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    };
  }
  if (typeof meta === "object") {
    return meta;
  }
  return { value: meta };
}

function createLogger(
  baseConfig: LoggerConfig,
  baseContext: Record<string, unknown> = {}
): Logger {
  const log =
    (level: LogLevel) =>
    (message: string, meta?: unknown): void => {
      if (!shouldLog(level, baseConfig.level)) {
        return;
      }

      const consoleMethod = getConsoleMethod(level);

      const payload: Record<string, unknown> = {
        timestamp: formatTimestamp(),
        level,
        service: baseConfig.serviceName,
        message,
        ...baseContext,
      };

      const formattedMeta = formatMeta(meta);
      if (formattedMeta !== undefined) {
        payload.meta = formattedMeta;
      }

      // Log as a single JSON line for easy parsing
      consoleMethod(JSON.stringify(payload));
    };

  const child = (context: Record<string, unknown>): Logger => {
    const mergedContext = { ...baseContext, ...context };
    return createLogger(baseConfig, mergedContext);
  };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child,
  };
}

export const logger: Logger = createLogger(config);

export function setLogLevel(level: LogLevel): void {
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(`Invalid log level: undefined`);
  }
  (config as { level: LogLevel }).level = level;
}

export function logErrorWithContext(
  error: unknown,
  message = "Unhandled error",
  context?: Record<string, unknown>
): void {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : util.inspect(error));

  if (context) {
    logger.child(context).error(message, err);
  } else {
    logger.error(message, err);
  }
}