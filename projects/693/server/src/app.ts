import express, { Application, NextFunction, Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import createHttpError, { HttpError } from "http-errors";
import dotenv from "dotenv";
import routes from "./routes";

dotenv.config();

const app: Application = express();

const isProduction = process.env.NODE_ENV === "production";

// CORS configuration
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Stripe-Signature",
  ],
};

// Trust proxy (for rate limiting, secure cookies, etc.)
app.set("trust proxy", 1);

// Stripe webhook: raw body parser BEFORE general body parsers
const stripeWebhookPath = "/webhooks/stripe";
app.post(
  stripeWebhookPath,
  express.raw({ type: "application/json" }),
  (req: Request, res: Response, next: NextFunction) => {
    (req as any).rawBody = (req as any).body;
    next();
  }
);

// Global middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(cookieParser());

// Logging
if (!isProduction) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// JSON and URL-encoded body parser (excluding Stripe webhook route)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl === stripeWebhookPath) {
    return next();
  }
  express.json({ limit: "10mb" })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
  });
});

// Routes registration
app.use("/api", routes);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

// 404 handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(createHttpError(404, `Not Found - undefined`));
});

// Centralized error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: HttpError | Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode =
      (err as HttpError).status ||
      (err as any).statusCode ||
      (err as any).status_code ||
      500;

    const response: {
      message: string;
      status: number;
      stack?: string;
      details?: unknown;
      path?: string;
    } = {
      message: err.message || "Internal Server Error",
      status: statusCode,
      path: req.originalUrl,
    };

    if (!isProduction) {
      response.stack = err.stack;
      if ((err as any).details) {
        response.details = (err as any).details;
      }
    }

    res.status(statusCode).json(response);
  }
);

export default app;