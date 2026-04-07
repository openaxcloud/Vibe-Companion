import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  name: string;
  environment: string;
  prettyPrint: boolean;
}

const ENV = process.env.NODE_ENV || 'development';

const levelFromEnv = (env: string): LogLevel => {
  const defaultLevel: LogLevel = env === 'production' ? 'info' : 'debug';
  const envLevel = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel;

  const validLevels: LogLevel[] = [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ];

  if (validLevels.includes(envLevel)) {
    return envLevel;
  }

  return defaultLevel;
};

const getLoggerConfig = (): LoggerConfig => {
  const environment = ENV;
  const level = levelFromEnv(environment);
  const prettyPrint =
    environment !== 'production' &&
    (process.env.LOG_PRETTY === 'true' || process.env.LOG_PRETTY === '1');

  const name = process.env.APP_NAME || 'app';

  return {
    level,
    name,
    environment,
    prettyPrint,
  };
};

const buildPinoOptions = (config: LoggerConfig): LoggerOptions => {
  const base = {
    pid: process.pid,
    env: config.environment,
    app: config.name,
  };

  const transport =
    config.prettyPrint && config.environment !== 'production'
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

  const messageKey = 'message';

  return {
    level: config.level,
    name: config.name,
    base,
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey,
    transport,
  };
};

const loggerConfig = getLoggerConfig();
const pinoOptions = buildPinoOptions(loggerConfig);

const logger: PinoLogger = pino(pinoOptions);

export type Logger = PinoLogger;

export { loggerConfig };

export default logger;