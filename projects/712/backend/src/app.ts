import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import path from "path";
import createError, { HttpError } from "http-errors";
import dotenv from "dotenv";
import routes from "./routes";

dotenv.config();

export interface AppConfig {
  enableRequestLogging?: boolean;
  trustProxy?: boolean | number | string | (number | string)[];
}

export interface ErrorResponseBody {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
}

const createApp = (config: AppConfig = {}): Application => {
  const app: Application = express();

  const {
    enableRequestLogging = process.env.NODE_ENV !== "test",
    trustProxy = process.env.TRUST_PROXY
      ? process.env.TRUST_PROXY === "true"
        ? true
        : process.env.TRUST_PROXY === "false"
        ? false
        : process.env.TRUST_PROXY
      : false,
  } = config;

  if (trustProxy) {
    app.set("trust proxy", trustProxy);
  }

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGINS || "*")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      if (allowedOrigins.includes("*") || !origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(createError(403, "CORS: Origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  };

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  if (enableRequestLogging) {
    const format =
      process.env.NODE_ENV === "production"
        ? "combined"
        : "dev";
    app.use(morgan(format));
  }

  app.use(
    "/public",
    express.static(path.join(__dirname, "..", "..", "public"))
  );

  routes(app);

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || "development",
    });
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    next(createError(404, `Route not found: undefined undefined`));
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      err: HttpError | Error,
      req: Request,
      res: Response<ErrorResponseBody>,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      next: NextFunction
    ) => {
      const isHttpError = (error: unknown): error is HttpError => {
        return (
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof (error as HttpError).status === "number"
        );
      };

      const status = isHttpError(err) ? err.status : 500;
      const isProduction = process.env.NODE_ENV === "production";

      const body: ErrorResponseBody = {
        status,
        message:
          (isHttpError(err) && err.message) ||
          (!isProduction ? err.message : "Internal Server Error"),
      };

      if (!isProduction) {
        body.stack = err.stack;
        if (isHttpError(err) && err.expose && (err as any).details) {
          body.details = (err as any).details;
        }
        if ((err as any).code && typeof (err as any).code === "string") {
          body.code = (err as any).code;
        }
      }

      res.status(status).json(body);
    }
  );

  return app;
};

export default createApp;