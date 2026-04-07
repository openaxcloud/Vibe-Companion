import http, { Server } from "http";
import process from "process";
import { AddressInfo } from "net";
import { createApp } from "./app";
import { connectToDatabase, disconnectFromDatabase } from "./db";
import { loadEnv } from "./config/env";

interface ShutdownOptions {
  server: Server;
  signals: string[];
  timeoutMs: number;
}

const DEFAULT_PORT = 3000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"];

function normalizePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function startServer(): Promise<Server> {
  loadEnv();

  const port = normalizePort(process.env.PORT, DEFAULT_PORT);

  await connectToDatabase();

  const app = createApp();

  const server = http.createServer(app);

  server.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    const boundPort = address?.port ?? port;
    // eslint-disable-next-line no-console
    console.log(`[server] HTTP server listening on port undefined`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind = typeof port === "string" ? `Pipe undefined` : `Port undefined`;

    switch (error.code) {
      case "EACCES":
        // eslint-disable-next-line no-console
        console.error(`[server] undefined requires elevated privileges`);
        process.exit(1);
        break;
      case "EADDRINUSE":
        // eslint-disable-next-line no-console
        console.error(`[server] undefined is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  return server;
}

function setupGracefulShutdown(options: ShutdownOptions): void {
  const { server, signals, timeoutMs } = options;

  let isShuttingDown = false;

  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // eslint-disable-next-line no-console
    console.log(`[server] Received undefined, starting graceful shutdown...`);

    const shutdownTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error("[server] Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);

    shutdownTimer.unref();

    server.close(async (closeError?: Error) => {
      if (closeError) {
        // eslint-disable-next-line no-console
        console.error("[server] Error during server close:", closeError);
      }

      try {
        await disconnectFromDatabase();
      } catch (dbError) {
        // eslint-disable-next-line no-console
        console.error("[server] Error during database disconnect:", dbError);
      } finally {
        clearTimeout(shutdownTimer);
        // eslint-disable-next-line no-console
        console.log("[server] Shutdown complete, exiting process");
        process.exit(0);
      }
    });
  };

  signals.forEach((signal) => {
    process.on(signal as NodeJS.Signals, () => shutdown(signal));
  });

  process.on("uncaughtException", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("[server] Uncaught exception:", err);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[server] Unhandled rejection:", reason);
    shutdown("unhandledRejection");
  });
}

(async () => {
  try {
    const server = await startServer();
    setupGracefulShutdown({
      server,
      signals: SHUTDOWN_SIGNALS,
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[server] Failed to start server:", error);
    process.exit(1);
  }
})();