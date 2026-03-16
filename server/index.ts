import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import crypto from "crypto";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";
import { createServer } from "http";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, isStripeConfigured } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { startAutoMetricsCollector } from "./metricsCollector";
import { getAllManagedProcesses, performHealthCheck } from "./deploymentEngine";
import { renewExpiringCertificates } from "./domainManager";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false,
    hsts: false,
  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer.");
        return res.status(500).json({ error: "Webhook processing error" });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error instanceof Error ? error.message : error);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/slack/events/") || req.path === "/api/stripe/webhook") {
    return next();
  }
  express.json({
    verify: (r, _res, buf) => {
      r.rawBody = buf;
    },
  })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/slack/events/") || req.path === "/api/stripe/webhook") {
    return next();
  }
  express.urlencoded({ extended: false })(req, res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !path.includes("env-var") && !path.includes("csrf")) {
        const safe = JSON.parse(JSON.stringify(capturedJsonResponse));
        const redactKeys = ["password", "csrfToken", "encryptedValue", "token", "secret", "apiKey"];
        function redact(obj: any) {
          if (!obj || typeof obj !== "object") return;
          for (const k of Object.keys(obj)) {
            if (redactKeys.some(rk => k.toLowerCase().includes(rk.toLowerCase()))) {
              obj[k] = "[REDACTED]";
            } else if (typeof obj[k] === "object") {
              redact(obj[k]);
            }
          }
        }
        redact(safe);
        logLine += ` :: ${JSON.stringify(safe)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not set, skipping Stripe initialization", "stripe");
    return;
  }

  const configured = await isStripeConfigured();
  if (!configured) {
    log("Stripe not configured, skipping initialization. Connect Stripe integration to enable payments.", "stripe");
    return;
  }

  try {
    log("Initializing Stripe schema...", "stripe");
    await runMigrations({ databaseUrl });
    log("Stripe schema ready", "stripe");

    const stripeSync = await getStripeSync();

    log("Setting up managed webhook...", "stripe");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhook = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    log(`Webhook configured: ${webhook?.url || "setup complete"}`, "stripe");

    log("Syncing Stripe data...", "stripe");
    stripeSync
      .syncBackfill()
      .then(() => {
        log("Stripe data synced", "stripe");
      })
      .catch((err: unknown) => {
        console.error("Error syncing Stripe data:", err);
      });
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

(async () => {
  await initStripe();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  await storage.migrateExistingEnvVarsToEncrypted();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  storage.purgeFileVersionsOlderThan(30).then(count => {
    if (count > 0) log(`Purged ${count} file versions older than 30 days`, "cleanup");
  }).catch(err => {
    console.warn("[cleanup] Failed to purge old file versions:", err?.message || err);
  });
  setInterval(() => {
    storage.purgeFileVersionsOlderThan(30).then(count => {
      if (count > 0) log(`Purged ${count} file versions older than 30 days`, "cleanup");
    }).catch(err => {
      console.warn("[cleanup] Failed to purge old file versions:", err?.message || err);
    });
  }, 24 * 60 * 60 * 1000);

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      startAutoMetricsCollector(
        () => Array.from(getAllManagedProcesses().keys()),
        (projectId, metricType, value, metadata) =>
          storage.recordMonitoringMetric(projectId, metricType, value, metadata),
        async (projectId) => {
          const result = await performHealthCheck(projectId);
          return { healthy: result.healthy, status: result.status };
        },
        60000,
      );

      setInterval(async () => {
        try {
          await renewExpiringCertificates(30);
        } catch (err: any) {
          log(`[ssl-renewal] Certificate renewal check failed: ${err.message}`);
        }
      }, 12 * 60 * 60 * 1000);
    },
  );
})();
