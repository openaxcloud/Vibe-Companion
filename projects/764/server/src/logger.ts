import pino, { Logger, LoggerOptions } from 'pino';
import pinoHttp, { Options as PinoHttpOptions, HttpLogger } from 'pino-http';

type NodeEnv = 'development' | 'production' | 'test';

const env = (process.env.NODE_ENV as NodeEnv) || 'development';
const isDev = env === 'development';
const isTest = env === 'test';

const baseLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    env,
    service: process.env.SERVICE_NAME || 'app',
  },
  redact: {
    paths: ['req.headers.authorization', 'headers.authorization', 'password', '*.password'],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const transport =
  isDev && !isTest
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined;

export const logger: Logger = pino({
  ...baseLoggerOptions,
  transport,
});

const httpLoggerOptions: PinoHttpOptions = {
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/favicon.ico',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req(req) {
      return {
        id: (req as any).id,
        method: req.method,
        url: req.url,
        remoteAddress: req.socket?.remoteAddress,
        remotePort: req.socket?.remotePort,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    if (res.statusCode >= 300) {
      return 'info';
    }
    return 'debug';
  },
  customSuccessMessage(req, res) {
    if (res.statusCode >= 400) {
      return 'request completed with client error';
    }
    if (res.statusCode >= 500) {
      return 'request completed with server error';
    }
    return 'request completed successfully';
  },
  customErrorMessage(_req, res, err) {
    return `request errored with status code undefined: undefined`;
  },
};

export const httpLogger: HttpLogger = pinoHttp(httpLoggerOptions);

export default logger;