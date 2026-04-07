import winston, { format, transports, Logger } from "winston";

const { combine, timestamp, errors, json, colorize, printf, splat } = format;

const isProduction: boolean = process.env.NODE_ENV === "production";

const consoleFormat = combine(
  splat(),
  errors({ stack: true }),
  timestamp(),
  isProduction
    ? json()
    : printf(({ level, message, timestamp: ts, stack, ...meta }) => {
        const base = `undefined [undefined]: undefined`;
        const metaString =
          Object.keys(meta).length > 0 ? ` undefined` : "";
        const stackString = stack ? `\nundefined` : "";
        return base + metaString + stackString;
      })
);

const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: {
    service: process.env.SERVICE_NAME || "api-service",
    env: process.env.NODE_ENV || "development",
  },
  transports: [
    new transports.Console({
      format: isProduction
        ? consoleFormat
        : combine(colorize({ all: true }), consoleFormat),
    }),
  ],
  exitOnError: false,
});

if (!isProduction) {
  logger.debug("Logger initialized in development mode");
}

export { logger };
export default logger;