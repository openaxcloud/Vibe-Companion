import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { json, urlencoded } from "body-parser";
import { Request, Response, NextFunction } from "express";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const createApp = (): Application => {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  const corsOptions: CorsOptions = {
    origin:
      process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ||
      ["http://localhost:3000"],
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

  app.use(cors(corsOptions));

  // Logging
  if (process.env.NODE_ENV !== "test") {
    const format =
      process.env.NODE_ENV === "production"
        ? "combined"
        : "dev";
    app.use(morgan(format));
  }

  // Body parsing
  app.use(json({ limit: "10mb" }));
  app.use(
    urlencoded({
      limit: "10mb",
      extended: true,
    })
  );

  // Cookies
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // Static assets (optional, adjust as needed)
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount application routes
  app.use("/api", routes);

  // 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next();
    res.status(404).json({
      error: "Not Found",
      path: req.originalUrl,
    });
  });

  // Error handler middleware
  app.use(errorHandler);

  return app;
};

const app = createApp();

export { createApp };
export default app;