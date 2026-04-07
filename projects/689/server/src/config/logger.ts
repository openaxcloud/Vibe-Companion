import winston, { format, Logger } from "winston";

type LogLevel = "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";

interface LoggerConfig {
  level: LogLevel;
  environment: string;
  serviceName: string;
}

const ENV = process.env.NODE_ENV || "development";
const SERVICE_NAME = process.env.SERVICE_NAME || "app";

const getLogLevel = (env: string): LogLevel => {
  switch (env) {
    case "production":
      return "info";
    case "test":
      return "warn";
    default:
      return "debug";
  }
};

const loggerConfig: LoggerConfig = {
  level: getLogLevel(ENV),
  environment: ENV,
  serviceName: SERVICE_NAME,
};

const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
  format.metadata({ fillExcept: ["timestamp", "level", "message", "service", "environment"] })
);

const consoleTransport = new winston.transports.Console({
  level: loggerConfig.level,
  handleExceptions: true,
});

const logger: Logger = winston.createLogger({
  level: loggerConfig.level,
  format: logFormat,
  defaultMeta: {
    service: loggerConfig.serviceName,
    environment: loggerConfig.environment,
  },
  transports: [consoleTransport],
  exitOnError: false,
});

if (ENV === "development") {
  logger.add(
    new winston.transports.Console({
      level: loggerConfig.level,
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` undefined` : "";
          return `[undefined] undefined: undefinedundefined`;
        })
      ),
    })
  );
}

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled Rejection", { reason });
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", { error });
});

export { logger };
export type { Logger };