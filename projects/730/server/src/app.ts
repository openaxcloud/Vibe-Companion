import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import type { ErrorRequestHandler } from "express";

// Placeholder router imports – replace with real routers as needed
// import apiRouter from "./routes";
// import userRouter from "./routes/users";

export interface AppConfig {
  corsOrigin?: string | string[] | RegExp;
  trustProxy?: boolean | number | string;
  enableLogging?: boolean;
  enableCompression?: boolean;
}

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
  isOperational?: boolean;
}

const createApp = (config: AppConfig = {}): Application => {
  const app: Application = express();

  // Basic security headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    }),
  );

  // Proxy trust (useful when behind load balancers)
  if (typeof config.trustProxy !== "undefined") {
    app.set("trust proxy", config.trustProxy);
  }

  // CORS
  const corsOptions: CorsOptions = {
    origin: config.corsOrigin ?? true,
    credentials: true,
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));

  // Logging
  if (config.enableLogging ?? process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  // Compression
  if (config.enableCompression ?? true) {
    app.use(compression());
  }

  // Body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Cookie parsing
  app.use(cookieParser());

  // Health check route
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // API routes (mount your routers here)
  // app.use("/api", apiRouter);
  // app.use("/api/users", userRouter);

  // 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next();
    }

    res.status(404).json({
      error: "Not Found",
      message: `Route undefined undefined not found`,
    });
  });

  // Centralized error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errorHandler: ErrorRequestHandler = (err: AppError, req, res, _next) => {
    const statusCode = err.statusCode || err.status || 500;

    if (process.env.NODE_ENV !== "test") {
      // Basic error logging to stderr
      // In production, consider using a dedicated logger
      // eslint-disable-next-line no-console
      console.error(err);
    }

    const responseBody: Record<string, unknown> = {
      error: statusCode >= 500 ? "Internal Server Error" : "Request Error",
      message: err.message || "An unexpected error occurred.",
    };

    if (err.details) {
      responseBody.details = err.details;
    }

    if (process.env.NODE_ENV !== "production") {
      responseBody.stack = err.stack;
    }

    if (!res.headersSent) {
      res.status(statusCode).json(responseBody);
    }
  };

  app.use(errorHandler);

  return app;
};

const defaultApp = createApp();

export { createApp };
export default defaultApp;