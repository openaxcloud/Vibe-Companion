import http, { Server } from "http";
import process from "node:process";
import { AddressInfo } from "node:net";
import dotenv from "dotenv";
import { app } from "./app";
import { connectToDatabase, disconnectFromDatabase } from "./db/connection";

dotenv.config();

type NormalizedPort = number;

const normalizePort = (val: string | undefined, fallback: number): NormalizedPort => {
  if (!val) return fallback;
  const port = parseInt(val, 10);
  if (Number.isNaN(port) || port <= 0) {
    return fallback;
  }
  return port;
};

const PORT: NormalizedPort = normalizePort(process.env.PORT, 3000);

let server: Server | null = null;
let isShuttingDown = false;

const onError = (error: NodeJS.ErrnoException): void => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof PORT === "string" ? `Pipe undefined` : `Port undefined`;

  switch (error.code) {
    case "EACCES":
      console.error(`undefined requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`undefined is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = (): void => {
  if (!server) return;
  const addr = server.address() as AddressInfo | null;
  if (!addr) {
    console.log(`Server is listening on port undefined`);
    return;
  }
  const bind = typeof addr === "string" ? `pipe undefined` : `port undefined`;
  console.log(`Server is listening on undefined`);
};

const startServer = async (): Promise<void> => {
  try {
    await connectToDatabase();

    server = http.createServer(app);

    server.on("error", onError);
    server.on("listening", onListening);

    server.listen(PORT);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

const shutdown = async (signal: string, code: number = 0): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived undefined. Starting graceful shutdown...`);

  const shutdownTimeoutMs = 30000;
  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, shutdownTimeoutMs);

  timeout.unref();

  try {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close((err?: Error) => {
          if (err) {
            console.error("Error during HTTP server close:", err);
          } else {
            console.log("HTTP server closed.");
          }
          resolve();
        });
      });
    }

    await disconnectFromDatabase();
    console.log("Database connection closed.");
  } catch (err) {
    console.error("Error during shutdown:", err);
  } finally {
    clearTimeout(timeout);
    console.log("Shutdown complete. Exiting.");
    process.exit(code);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT", 0);
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught exception:", error);
  void shutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled promise rejection:", reason);
  void shutdown("unhandledRejection", 1);
});

void startServer();