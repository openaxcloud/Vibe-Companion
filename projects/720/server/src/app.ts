import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import httpStatus from "http-status";
import dotenv from "dotenv";

dotenv.config();

export interface ApiError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

const app: Application = express();

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// Basic middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      skip: (_req: Request, res: Response) => res.statusCode < 400,
    })
  );
  app.use(
    morgan("dev", {
      skip: (_req: Request, res: Response) => res.statusCode >= 400,
    })
  );
}

// Health check and basic routes
app.get("/health", (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Placeholder for API routes registration
// Example:
// import apiRouter from "./routes";
// app.use("/api", apiRouter);

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  const error: ApiError = new Error(`Not found: undefined`);
  error.statusCode = httpStatus.NOT_FOUND;
  error.status = "fail";
  error.isOperational = true;
  next(error);
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const isProd = process.env.NODE_ENV === "production";

  const responseBody: Record<string, unknown> = {
    status: err.status || (statusCode >= 500 ? "error" : "fail"),
    message: err.message || httpStatus[statusCode] || "Internal Server Error",
  };

  if (!isProd) {
    responseBody.stack = err.stack;
    responseBody.path = req.originalUrl;
    responseBody.method = req.method;
  }

  res.status(statusCode).json(responseBody);
});

export default app;