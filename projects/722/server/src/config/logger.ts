import winston, { format, Logger } from 'winston';

const { combine, timestamp, printf, colorize, errors, splat, json } = format;

interface SerializedError {
  message: string;
  name?: string;
  stack?: string;
  code?: string | number;
  [key: string]: unknown;
}

interface LogMeta {
  [key: string]: unknown;
  error?: Error | SerializedError | unknown;
  req?: {
    method?: string;
    url?: string;
    path?: string;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    ip?: string;
    correlationId?: string;
  };
}

/**
 * Safely serializes an error object to a plain JSON-friendly structure.
 */
const serializeError = (error: unknown): SerializedError | unknown => {
  if (!error || typeof error !== 'object') {
    return error as unknown;
  }

  const err = error as Error & {
    code?: string | number;
    [key: string]: unknown;
  };

  const serialized: SerializedError = {
    message: err.message,
    name: err.name,
    stack: err.stack,
  };

  if (err.code !== undefined) {
    serialized.code = err.code;
  }

  // Include any enumerable custom properties
  Object.keys(err).forEach((key) => {
    if (!(key in serialized)) {
      serialized[key] = (err as Record<string, unknown>)[key];
    }
  });

  return serialized;
};

/**
 * Custom printf format for console logs.
 */
const consolePrintf = printf(({ level, message, timestamp: ts, ...meta }) => {
  const parts: string[] = [];

  parts.push(`undefined`);
  parts.push(level);

  if (typeof message === 'string') {
    parts.push(message);
  } else {
    parts.push(JSON.stringify(message));
  }

  const metaCopy: Record<string, unknown> = { ...meta };

  // Normalize error field if present
  if (metaCopy.error) {
    metaCopy.error = serializeError(metaCopy.error);
  }

  // Clean up Winston internal fields if any
  delete (metaCopy as Record<string, unknown>)['level'];
  delete (metaCopy as Record<string, unknown>)['timestamp'];

  if (Object.keys(metaCopy).length > 0) {
    parts.push(JSON.stringify(metaCopy));
  }

  return parts.join(' | ');
});

/**
 * Base format for all logs.
 */
const baseFormat = combine(
  errors({ stack: true }),
  splat(),
  timestamp()
);

/**
 * Console-specific format with colors and human-readable output.
 */
const consoleFormat = combine(
  colorize({ all: true }),
  consolePrintf
);

/**
 * JSON format for error logs or structured logging (can be used by file/HTTP transports).
 */
const jsonFormat = combine(
  errors({ stack: true }),
  splat(),
  timestamp(),
  format((info) => {
    const meta: LogMeta = info as unknown as LogMeta;

    if (meta.error) {
      meta.error = serializeError(meta.error);
    }

    return info;
  })(),
  json()
);

/**
 * Winston logger instance configured for application-wide use.
 */
const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'app-server',
    env: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

/**
 * Creates a child logger with request-specific metadata for HTTP request logging.
 */
export const createRequestLogger = (req: {
  method?: string;
  url?: string;
  path?: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  ip?: string;
}) => {
  const correlationId =
    (req.headers && (req.headers['x-correlation-id'] as string)) ||
    (req.headers && (req.headers['x-request-id'] as string));

  return logger.child({
    req: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        // Avoid logging extremely sensitive headers
        'user-agent': req.headers?.['user-agent'],
        'x-forwarded-for': req.headers?.['x-forwarded-for'],
        'x-correlation-id': correlationId,
      },
      ip: req.ip,
      correlationId,
    },
  });
};

/**
 * Structured error logging helper.
 */
export const logError = (
  error: unknown,
  message?: string,
  meta: Record<string, unknown> = {}
): void => {
  logger.error(message || (error instanceof Error ? error.message : 'Unknown error'), {
    ...meta,
    error,
  });
};

/**
 * Expose JSON format for transports that may want structured logs.
 */
export const loggerJsonFormat = jsonFormat;

export default logger;