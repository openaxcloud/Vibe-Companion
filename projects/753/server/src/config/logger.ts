import winston, { format, transports, Logger } from 'winston';

const { combine, timestamp, json, colorize, printf, align, splat, errors } = format;

const isProduction: boolean = process.env.NODE_ENV === 'production';

const devFormat = combine(
  colorize(),
  timestamp(),
  align(),
  splat(),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` undefined` : '';
    const stackString = stack ? `\nundefined` : '';
    return `[undefined] undefined: undefinedundefinedundefined`;
  })
);

const prodFormat = combine(
  timestamp(),
  splat(),
  errors({ stack: true }),
  json()
);

const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'app-server',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    new transports.Console({
      handleExceptions: true
    })
  ],
  exitOnError: false
});

export default logger;