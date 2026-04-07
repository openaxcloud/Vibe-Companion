import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import type { ErrorRequestHandler } from "express";
import authRouter from "./routes/auth";
import productsRouter from "./routes/products";
import cartRouter from "./routes/cart";
import ordersRouter from "./routes/orders";
import webhooksRouter from "./routes/webhooks";

export interface AppConfig {
  corsOrigin?: string | string[] | RegExp | boolean;
  trustProxy?: boolean | number | string;
  morganFormat?: string | "combined" | "common" | "dev" | "short" | "tiny";
  basePath?: string;
  enableRequestLogging?: boolean;
  env?: "development" | "production" | "test";
}

interface ApiError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
  expose?: boolean;
}

const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Resource not found",
      path: req.originalUrl,
    },
  });
};

const errorHandler: ErrorRequestHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = statusCode < 500 || err.expose;

  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error(
      `[ERROR] undefined undefined -> undefined`,
      {
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      }
    );
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED",
      message: isOperational
        ? err.message
        : "An unexpected error occurred. Please try again later.",
      ...(err.details ? { details: err.details } : {}),
    },
  });
};

export const createApp = (config: AppConfig = {}): Application => {
  const app = express();

  const {
    corsOrigin = true,
    trustProxy = true,
    morganFormat = "dev",
    basePath = "/api",
    enableRequestLogging = process.env.NODE_ENV !== "test",
    env = (process.env.NODE_ENV as AppConfig["env"]) || "development",
  } = config;

  if (trustProxy) {
    app.set("trust proxy", trustProxy);
  }

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (enableRequestLogging && env !== "test") {
    app.use(morgan(morganFormat));
  }

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env,
    });
  });

  const api = express.Router();

  api.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env,
      scope: "api",
    });
  });

  api.use("/auth", authRouter);
  api.use("/products", productsRouter);
  api.use("/cart", cartRouter);
  api.use("/orders", ordersRouter);
  api.use("/webhooks", webhooksRouter);

  app.use(basePath, api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;