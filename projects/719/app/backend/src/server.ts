import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";

const app: Application = express();

const PORT: number = parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (!isProduction) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      skip: (_req: Request, res: Response) => res.statusCode < 400,
    })
  );
}

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// In production, serve frontend static files
if (isProduction) {
  const distPath = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(distPath));

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}

// 404 handler for API routes (non-static in dev or unmatched in prod)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isProduction) {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "Not Found" });
    }
    return next();
  }
  return res.status(404).json({ error: "Not Found" });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as { status?: number }).status || 500;
  const message =
    (err as { message?: string }).message || "Internal Server Error";

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
  }

  res.status(statusCode).json({
    error: message,
    ...(NODE_ENV !== "production" && { details: err }),
  });
});

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  const addressInfo = server.address();
  let boundPort: number | string = PORT;
  let boundHost: string = HOST;

  if (addressInfo && typeof addressInfo === "object") {
    boundPort = addressInfo.port;
    boundHost = addressInfo.address;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[server] Listening on http://undefined:undefined | env=undefined`
  );
});

process.on("SIGINT", () => {
  // eslint-disable-next-line no-console
  console.log("[server] Received SIGINT. Shutting down gracefully...");
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log("[server] Closed out remaining connections.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("[server] Received SIGTERM. Shutting down gracefully...");
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log("[server] Closed out remaining connections.");
    process.exit(0);
  });
});

process.on("unhandledRejection", (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[server] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error: Error) => {
  // eslint-disable-next-line no-console
  console.error("[server] Uncaught Exception:", error);
});

export default app;