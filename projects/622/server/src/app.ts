import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import { apiRouter } from "./routes";
import { authenticate } from "./middleware/authenticate";
import { AppError } from "./utils/AppError";
import { globalErrorHandler } from "./middleware/errorHandler";

dotenv.config();

const app: Application = express();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const allowedOrigins = (process.env.CORS_ORIGINS || CLIENT_ORIGIN)
      .split(",")
      .map((o) => o.trim());

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  exposedHeaders: ["Set-Cookie"],
};

app.disable("x-powered-by");

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
app.use(cookieParser());

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

app.use("/api", apiRouter);

app.use("/api/protected", authenticate, (req: Request, res: Response) => {
  res.status(200).json({
    message: "Protected route accessed successfully",
  });
});

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route undefined not found`, 404));
});

app.use(globalErrorHandler);

export default app;