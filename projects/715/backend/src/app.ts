import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import createError, { HttpError } from "http-errors";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app: Application = express();

const isProduction = process.env.NODE_ENV === "production";

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (!allowedOrigins.length || allowedOrigins.includes("*")) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
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
app.use(
  helmet.crossOriginResourcePolicy({
    policy: "cross-origin",
  })
);

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", rateLimiter);

app.use(cors(corsOptions));
app.use(hpp());
app.use(compression());
app.use(cookieParser());

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

if (!isProduction) {
  app.use(
    morgan("dev", {
      skip: (req: Request) =>
        req.path === "/health" || req.path === "/ready",
    })
  );
} else {
  app.use(
    morgan("combined", {
      skip: (req: Request) =>
        req.path === "/health" || req.path === "/ready",
    })
  );
}

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/ready", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ready" });
});

// Placeholder API router: replace with your actual route imports
const apiRouter = express.Router();

apiRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
  });
});

app.use("/api", apiRouter);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createError(404, "Not Found"));
});

app.use(
  (
    err: HttpError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const status = err.status || 500;
    const response: {
      status: number;
      message: string;
      stack?: string;
      details?: unknown;
    } = {
      status,
      message:
        status === 500 && isProduction
          ? "Internal Server Error"
          : err.message || "An error occurred",
    };

    if (!isProduction) {
      response.stack = err.stack;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any).details) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.details = (err as any).details;
      }
    }

    res.status(status).json(response);
  }
);

export default app;