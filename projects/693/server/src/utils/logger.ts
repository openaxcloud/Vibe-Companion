import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';

type Env = 'development' | 'test' | 'production';

interface LoggerConfig {
  level: string;
  env: Env;
  pretty: boolean;
}

const env = (process.env.NODE_ENV as Env) || 'development';

const baseConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
  env,
  pretty: env !== 'production',
};

const createTransport = (): DestinationStream | undefined => {
  if (!baseConfig.pretty) return undefined;

  // Use pino-pretty only in development/test for human-readable logs
  // Dynamic import to avoid bundling in production if not needed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pretty = require('pino-pretty');

  return pretty({
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    singleLine: false,
  });
};

const options: LoggerOptions = {
  level: baseConfig.level,
  base: {
    env: baseConfig.env,
    service: process.env.SERVICE_NAME || 'app',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
    bindings(bindings) {
      const { pid, hostname, ...rest } = bindings;
      return rest;
    },
  },
};

const transport = createTransport();

export const logger: Logger = pino(options, transport);

// Helper to create child loggers with component/context bindings
export const createLogger = (bindings: Record<string, unknown>): Logger => {
  return logger.child(bindings);
};

export default logger;