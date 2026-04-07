import express, { Application, RequestHandler } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import type { ErrorRequestHandler } from "express";

const {
  NODE_ENV,
  CORS_ALLOWED_ORIGIN,
  JSON_BODY_LIMIT,
  URLENCODED_BODY_LIMIT,
} = process.env;

const isProduction = NODE_ENV === "production";

const app: Application = express();

if (isProduction) {
  app.set("trust proxy", 1);
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigin = CORS_ALLOWED_ORIGIN || "";
    if (!origin) {
      return callback(null, true);
    }
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(helmet());

if (!isProduction) {
  app.use(morgan("dev"));
}

app.use(compression());

app.use(cookieParser());

app.use(
  express.json({
    limit: JSON_BODY_LIMIT || "1mb",
  }) as RequestHandler
);

app.use(
  express.urlencoded({
    extended: true,
    limit: URLENCODED_BODY_LIMIT || "1mb",
  }) as RequestHandler
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot undefined undefined`,
  });
};

app.use(notFoundHandler);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    typeof err.status === "number"
      ? err.status
      : typeof err.statusCode === "number"
      ? err.statusCode
      : 500;

  const response: Record<string, unknown> = {
    error: statusCode === 500 ? "Internal Server Error" : "Error",
    message:
      err.message ||
      (statusCode === 500
        ? "An unexpected error occurred."
        : "A request error occurred."),
  };

  if (!isProduction) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

app.use(errorHandler);

export default app;