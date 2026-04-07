import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  cors?: CorsOptions;
  trustProxy?: boolean | number | string;
  jsonLimit?: string;
  urlencodedLimit?: string;
}

const createApp = (config: AppConfig = {}): Application => {
  const app: Application = express();

  // Basic app configuration
  if (config.trustProxy !== undefined) {
    app.set("trust proxy", config.trustProxy);
  }

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    })
  );

  // CORS
  const corsOptions: CorsOptions =
    config.cors ||
    ({
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    } as CorsOptions);

  app.use(cors(corsOptions));

  // Logging
  if (process.env.NODE_ENV !== "test") {
    const format =
      process.env.NODE_ENV === "production"
        ? "combined"
        : "dev";
    app.use(morgan(format));
  }

  // Compression
  app.use(compression());

  // Body parsers
  app.use(express.json({ limit: config.jsonLimit || "1mb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: config.urlencodedLimit || "1mb",
    })
  );
  app.use(cookieParser());

  // Static files (if needed for frontend or assets)
  const publicDir = path.join(__dirname, "..", "..", "public");
  app.use(express.static(publicDir));

  // Health check route
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // TODO: Import and mount your actual routers here
  // Example:
  // import apiRouter from "./routes";
  // app.use("/api", apiRouter);

  // 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next();
    }
    res.status(404).json({
      message: "Not Found",
      path: req.originalUrl,
    });
  });

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    // Basic error normalization
    const isProd = process.env.NODE_ENV === "production";

    let status = 500;
    let message = "Internal Server Error";
    let details: unknown;

    if (err && typeof err === "object") {
      const anyErr = err as any;
      if (typeof anyErr.status === "number") {
        status = anyErr.status;
      } else if (typeof anyErr.statusCode === "number") {
        status = anyErr.statusCode;
      }

      if (typeof anyErr.message === "string") {
        message = anyErr.message;
      }

      if (!isProd && anyErr.stack) {
        details = { stack: anyErr.stack };
      }
    }

    if (!isProd && !details) {
      details = { error: String(err) };
    }

    if (res.headersSent) {
      return;
    }

    res.status(status).json({
      message,
      ...(details ? { details } : {}),
    });
  });

  return app;
};

const app = createApp();

export { createApp };
export default app;