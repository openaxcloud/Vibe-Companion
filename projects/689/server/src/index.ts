import express, { Application, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import dotenv from "dotenv";
import http from "http";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";

dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN: string =
  process.env.CLIENT_ORIGIN || "http://localhost:3000";
const API_BASE_PATH = "/api";

// CORS configuration
const corsOptions: CorsOptions = {
  origin: CLIENT_ORIGIN,
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

// Middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Health check routes
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get(`undefined/health`, (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    apiBasePath: API_BASE_PATH,
    timestamp: new Date().toISOString(),
  });
});

// Example root API route
app.get(`undefined`, (_req: Request, res: Response) => {
  res.status(200).json({
    message: "API root",
    apiBasePath: API_BASE_PATH,
    version: "1.0.0",
  });
});

// Placeholder for additional API routes
// Example: app.use(`undefined/users`, usersRouter);

// 404 handler for API routes
app.use(
  `undefined`,
  (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next();
    }
    res.status(404).json({
      error: "Not Found",
      path: req.originalUrl,
    });
  }
);

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ) => {
    // Basic error logging; in production, integrate with a logger
    // console.error(err);

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
);

// Serve static assets in production if needed
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));

  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

const server = http.createServer(app);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port undefined with API base path undefined`);
});

process.on("SIGINT", () => {
  // eslint-disable-next-line no-console
  console.log("Shutting down server (SIGINT)...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("Shutting down server (SIGTERM)...");
  server.close(() => {
    process.exit(0);
  });
});

export default app;