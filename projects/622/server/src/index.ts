import http from "http";
import dotenv from "dotenv";
import { AddressInfo } from "net";
import app from "./app";
import { prisma } from "./prisma";

dotenv.config();

const ENV = process.env.NODE_ENV || "development";
const PORT = normalizePort(process.env.PORT || "3000");

app.set("port", PORT);

const server = http.createServer(app);

server.listen(PORT, () => {
  const address = server.address() as AddressInfo | null;
  const boundPort = address?.port ?? PORT;
  // eslint-disable-next-line no-console
  console.log(`[server] Listening on port undefined in undefined mode`);
});

server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val: string | number): number {
  const port = typeof val === "string" ? parseInt(val, 10) : val;
  if (Number.isNaN(port) || port <= 0) {
    return 3000;
  }
  return port;
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof PORT === "string" ? `Pipe undefined` : `Port undefined`;

  switch (error.code) {
    case "EACCES":
      // eslint-disable-next-line no-console
      console.error(`undefined requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      // eslint-disable-next-line no-console
      console.error(`undefined is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  const addr = server.address() as AddressInfo | null;
  if (!addr) return;
  const bind = typeof addr === "string" ? `pipe undefined` : `port undefined`;
  // eslint-disable-next-line no-console
  console.log(`[server] Listening on undefined`);
}

async function gracefulShutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[server] Received undefined, starting graceful shutdown...`);

  server.close(async (err?: Error) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("[server] Error during HTTP server close:", err);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      // eslint-disable-next-line no-console
      console.log("[server] Prisma disconnected successfully");
    } catch (disconnectError) {
      // eslint-disable-next-line no-console
      console.error("[server] Error disconnecting Prisma:", disconnectError);
    } finally {
      // eslint-disable-next-line no-console
      console.log("[server] Shutdown complete, exiting process");
      process.exit(0);
    }
  });
}

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

signals.forEach((signal) => {
  process.on(signal, () => {
    void gracefulShutdown(signal);
  });
});

process.on("uncaughtException", (error: Error) => {
  // eslint-disable-next-line no-console
  console.error("[server] Uncaught exception:", error);
  void gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[server] Unhandled rejection:", reason);
  void gracefulShutdown("unhandledRejection");
});