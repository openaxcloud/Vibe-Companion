import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema } from "@shared/schema";
import { z } from "zod";
import { executeCode } from "./executor";
import { getOrCreateTerminal, resizeTerminal } from "./terminal";
import { log } from "./index";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail } from "./email";
import {
  checkUserRateLimit,
  checkIpRateLimit,
  acquireExecutionSlot,
  releaseExecutionSlot,
  recordExecution,
  getExecutionMetrics,
  getSystemMetrics,
  getClientIp,
} from "./rateLimiter";
import { PLAN_LIMITS } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { diffArrays } from "diff";
import multer from "multer";
import * as runnerClient from "./runnerClient";
import * as github from "./github";
import { posix as pathPosix } from "path";
import { getTemplateById, getAllTemplates } from "./templates";

function sanitizePath(p: string): string | null {
  if (!p || typeof p !== "string") return null;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return null;
  if (p.includes("..") || p.includes("\\")) return null;
  const normalized = pathPosix.normalize(decoded).replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized || normalized.startsWith("/")) return null;
  return normalized;
}

function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") return "";
  return input.slice(0, maxLength);
}

function sanitizeProjectName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, 200);
  const sanitized = trimmed.replace(/[<>"'`;{}]/g, "");
  if (!sanitized || sanitized.length === 0) return null;
  return sanitized;
}

function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  const trimmed = filename.trim().slice(0, 500);
  if (/[<>"'`;{}|&$!]/.test(trimmed)) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return sanitizePath(trimmed);
}

function validateRunnerPath(p: string): boolean {
  if (!p || typeof p !== "string") return false;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return false;
  const normalized = pathPosix.normalize(decoded);
  if (normalized.includes("..")) return false;
  return true;
}

const MAX_AGENT_ITERATIONS = 10;
const MAX_PROMPT_LENGTH = 50000;
const MAX_MESSAGE_CONTENT_LENGTH = 100000;
const MAX_MESSAGES_COUNT = 50;
const MAX_AI_FILENAME_LENGTH = 255;

const FORBIDDEN_FILENAME_PATTERNS = [
  /\.\./,
  /\\/,
  /^\/+/,
  /[\x00-\x1f\x7f]/,
  /^\.+$/,
  /[<>:"|?*]/,
  /^\s|\s$/,
  /\.(env|pem|key|crt|cer|p12|pfx|jks)$/i,
  /^\.git\//,
  /^\.ssh\//,
  /^node_modules\//,
  /^__pycache__\//,
];

function sanitizeAIFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  if (filename.length > MAX_AI_FILENAME_LENGTH) return null;

  const trimmed = filename.trim();
  if (!trimmed) return null;

  for (const pattern of FORBIDDEN_FILENAME_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }

  const sanitized = sanitizePath(trimmed);
  if (!sanitized) return null;

  const parts = sanitized.split("/");
  for (const part of parts) {
    if (part.startsWith(".") && part !== ".gitignore" && part !== ".eslintrc" && part !== ".prettierrc") {
      return null;
    }
  }

  return sanitized;
}

function validateAIMessages(messages: any[]): string | null {
  if (!Array.isArray(messages)) return "messages must be an array";
  if (messages.length === 0) return "messages array cannot be empty";
  if (messages.length > MAX_MESSAGES_COUNT) return `Too many messages (max ${MAX_MESSAGES_COUNT})`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") return `Invalid message at index ${i}`;
    if (!msg.role || !["user", "assistant"].includes(msg.role)) {
      return `Invalid role at message index ${i}`;
    }
    if (typeof msg.content !== "string") return `Message content must be a string at index ${i}`;
    if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return `Message at index ${i} exceeds maximum length (${MAX_MESSAGE_CONTENT_LENGTH} chars)`;
    }
  }
  return null;
}

function sanitizeAIFileContent(content: string): string {
  if (typeof content !== "string") return "";
  const maxFileSize = 500000;
  if (content.length > maxFileSize) {
    content = content.slice(0, maxFileSize);
  }
  return content;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

const CSRF_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/github",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/send-verification",
  "/api/csrf-token",
  "/api/demo/run",
  "/api/demo/project",
  "/api/ai/chat",
  "/api/ai/complete",
  "/api/billing/webhook",
  "/api/analytics/track",
];

function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const fullPath = req.originalUrl?.split("?")[0] || req.path;
  if (CSRF_EXEMPT_PATHS.some(p => fullPath === p || req.path === p)) {
    return next();
  }
  const token = req.headers["x-csrf-token"] as string;
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}

const wsClients = new Map<string, Set<WebSocket>>();
const wsConnectionsByIp = new Map<string, Set<WebSocket>>();
const WS_MAX_CONNECTIONS_PER_IP = 5;
const WS_MESSAGE_RATE_LIMIT = 30;
const WS_MESSAGE_RATE_WINDOW_MS = 10000;

interface WsMessageTracker {
  timestamps: number[];
}
const wsMessageTrackers = new WeakMap<WebSocket, WsMessageTracker>();

function checkWsMessageRate(ws: WebSocket): boolean {
  let tracker = wsMessageTrackers.get(ws);
  if (!tracker) {
    tracker = { timestamps: [] };
    wsMessageTrackers.set(ws, tracker);
  }
  const now = Date.now();
  tracker.timestamps = tracker.timestamps.filter(t => now - t < WS_MESSAGE_RATE_WINDOW_MS);
  if (tracker.timestamps.length >= WS_MESSAGE_RATE_LIMIT) {
    return false;
  }
  tracker.timestamps.push(now);
  return true;
}

const recentBroadcasts = new Map<string, { data: any; timestamp: number }[]>();
const MAX_RECENT_BROADCASTS = 50;

function broadcastToProject(projectId: string, data: any) {
  if (!recentBroadcasts.has(projectId)) {
    recentBroadcasts.set(projectId, []);
  }
  const broadcasts = recentBroadcasts.get(projectId)!;
  broadcasts.push({ data, timestamp: Date.now() });
  if (broadcasts.length > MAX_RECENT_BROADCASTS) {
    broadcasts.splice(0, broadcasts.length - MAX_RECENT_BROADCASTS);
  }

  const clients = wsClients.get(projectId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = connectPgSimple(session);
  const sessionMiddleware = session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: (() => {
      const s = process.env.SESSION_SECRET;
      if (!s && process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET is required in production");
      }
      return s || "dev-only-fallback-" + Date.now();
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
  app.use(sessionMiddleware);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { message: "Too many attempts. Try again later." },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { message: "Rate limit exceeded." },
  });

  const runLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: "Too many executions. Please wait." },
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req: Request) => req.session?.userId || "anonymous",
    message: { message: "Too many AI requests. Please wait a moment." },
    validate: { xForwardedForHeader: false, ip: false },
  });

  const aiGenerateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req: Request) => req.session?.userId || "anonymous",
    message: { message: "Too many project generation requests. Please wait." },
    validate: { xForwardedForHeader: false, ip: false },
  });

  app.use("/api", apiLimiter);

  const serverStartTime = Date.now();
  const errorBuffer: Array<{ timestamp: string; method: string; path: string; status: number; message: string }> = [];
  const MAX_ERROR_BUFFER = 100;

  app.get("/api/health", async (_req: Request, res: Response) => {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const mem = process.memoryUsage();
    let dbStatus = "connected";
    try {
      const { db } = await import("./db");
      await db.execute("SELECT 1");
    } catch {
      dbStatus = "disconnected";
    }
    const system = getSystemMetrics();
    res.json({
      status: dbStatus === "connected" ? "healthy" : "degraded",
      uptime,
      database: dbStatus,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      execution: {
        activeSandboxes: system.globalConcurrent,
        maxConcurrent: system.maxConcurrent,
        queueLength: system.globalQueueLength,
        activeUsers: system.totalActiveUsers,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/metrics", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.json({ execution: getSystemMetrics(), errorCount: 0 });
    }
    const system = getSystemMetrics();
    res.json({
      execution: system,
      recentErrors: errorBuffer.slice(-20),
      errorCount: errorBuffer.length,
    });
  });

  app.get("/api/csrf-token", (req: Request, res: Response) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    return res.json({ csrfToken: req.session.csrfToken });
  });

  app.use("/api", csrfProtection);

  // --- AUTH ---
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        displayName: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        displayName: data.displayName || data.email.split("@")[0],
      });

      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      return res.status(201).json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        csrfToken: req.session.csrfToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });
      const data = schema.parse(req.body);

      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      return res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        csrfToken: req.session.csrfToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      isAdmin: user.isAdmin,
      githubId: user.githubId,
    });
  });

  // --- USAGE & QUOTAS ---
  app.get("/api/user/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const quota = await storage.getUserQuota(userId);
      const plan = (quota.plan as keyof typeof PLAN_LIMITS) || "free";
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const projectList = await storage.getProjects(userId);
      res.json({
        plan: quota.plan,
        daily: {
          executions: { used: quota.dailyExecutionsUsed, limit: limits.dailyExecutions },
          aiCalls: { used: quota.dailyAiCallsUsed, limit: limits.dailyAiCalls },
        },
        storage: { usedMb: Math.round(quota.storageBytes / 1024 / 1024 * 100) / 100, limitMb: limits.storageMb },
        projects: { count: projectList.length, limit: limits.maxProjects },
        totals: { executions: quota.totalExecutions, aiCalls: quota.totalAiCalls },
        resetsAt: new Date(new Date(quota.lastResetAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  const STRIPE_PRICES: Record<string, string> = {
    pro: process.env.STRIPE_PRO_PRICE_ID || "",
    team: process.env.STRIPE_TEAM_PRICE_ID || "",
  };

  let stripe: any = null;
  try {
    const Stripe = require("stripe");
    if (process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
  } catch {}

  app.post("/api/billing/checkout", requireAuth, async (req: Request, res: Response) => {
    const { plan } = req.body;
    if (!plan || !["pro", "team"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }
    if (!stripe || !STRIPE_PRICES[plan]) {
      return res.json({ url: null, message: "Stripe is not configured yet. Connect Stripe to enable payments." });
    }
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const quota = await storage.getUserQuota(user.id);
      let customerId = quota.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
        customerId = customer.id;
        await storage.updateUserPlan(user.id, quota.plan, customerId);
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: STRIPE_PRICES[plan], quantity: 1 }],
        success_url: `${req.protocol}://${req.get("host")}/dashboard?billing=success`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing?billing=cancelled`,
        metadata: { userId: user.id, plan },
      });
      return res.json({ url: session.url });
    } catch (err: any) {
      log("Stripe checkout error:", err.message);
      return res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req: Request, res: Response) => {
    if (!stripe) return res.json({ url: null, message: "Stripe is not configured yet." });
    try {
      const quota = await storage.getUserQuota(req.session.userId!);
      if (!quota.stripeCustomerId) return res.json({ url: null, message: "No billing account found." });
      const session = await stripe.billingPortal.sessions.create({
        customer: quota.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/settings`,
      });
      return res.json({ url: session.url });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  app.get("/api/billing/status", requireAuth, async (req: Request, res: Response) => {
    const quota = await storage.getUserQuota(req.session.userId!);
    return res.json({
      plan: quota.plan,
      status: quota.stripeSubscriptionId ? "active" : "none",
      stripeCustomerId: quota.stripeCustomerId || null,
      subscriptionId: quota.stripeSubscriptionId || null,
    });
  });

  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!stripe) return res.status(200).send("OK");
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) return res.status(200).send("OK");
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          const plan = session.metadata?.plan;
          if (userId && plan) {
            await storage.updateUserPlan(userId, plan, session.customer, session.subscription);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const customer = await stripe.customers.retrieve(sub.customer);
          const userId = customer.metadata?.userId;
          if (userId) {
            await storage.updateUserPlan(userId, "free", undefined, undefined);
          }
          break;
        }
      }
      return res.status(200).send("OK");
    } catch (err: any) {
      log("Webhook error:", err.message);
      return res.status(400).send("Webhook Error");
    }
  });

  // --- GITHUB OAUTH ---
  app.post("/api/auth/github", async (req: Request, res: Response) => {
    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser || !ghUser.id) {
        return res.status(401).json({ message: "GitHub not connected. Please connect GitHub integration first." });
      }
      const githubId = String(ghUser.id);
      let user = await storage.getUserByGithubId(githubId);
      if (!user) {
        const email = ghUser.email || `github-${githubId}@users.noreply.github.com`;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { githubId, avatarUrl: ghUser.avatar_url });
          user = (await storage.getUser(existing.id))!;
        } else {
          user = await storage.createUser({
            email,
            password: "",
            displayName: ghUser.login || ghUser.name || email.split("@")[0],
            githubId,
            avatarUrl: ghUser.avatar_url,
            emailVerified: true,
          });
        }
      }
      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      await storage.trackEvent(user.id, "login", { method: "github" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, csrfToken: req.session.csrfToken });
    } catch (err: any) {
      return res.status(500).json({ message: "GitHub authentication failed: " + (err.message || "Unknown error") });
    }
  });

  // --- PASSWORD RESET ---
  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(email, token);
      log(`[auth] Password reset requested for ${email}`, "info");
      return res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      await storage.usePasswordResetToken(token);
      return res.json({ message: "Password reset successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // --- EMAIL VERIFICATION ---
  app.post("/api/auth/send-verification", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createEmailVerification(user.id, token, expiresAt);
      await sendVerificationEmail(user.email, token);
      log(`[auth] Email verification requested for ${user.email}`, "info");
      return res.json({ message: "Verification email sent" });
    } catch {
      return res.status(500).json({ message: "Failed to send verification" });
    }
  });

  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const success = await storage.verifyEmail(token);
      if (!success) return res.status(400).json({ message: "Invalid or expired verification token" });
      return res.json({ message: "Email verified successfully" });
    } catch {
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  // --- PROFILE & ACCOUNT MANAGEMENT ---
  app.put("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().min(1).max(50).optional(),
        avatarUrl: z.string().url().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.session.userId!, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/user/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }).parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.password) {
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      return res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.delete("/api/user/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { confirmation } = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).parse(req.body);
      const userId = req.session.userId!;
      await storage.deleteUser(userId);
      req.session.destroy(() => {});
      return res.json({ message: "Account deleted" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Type 'DELETE MY ACCOUNT' to confirm" });
      return res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/user/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const projectsList = await storage.getProjects(userId);
      const allData: any = { user: { id: user?.id, email: user?.email, displayName: user?.displayName, createdAt: user?.createdAt }, projects: [] };
      for (const p of projectsList) {
        const pFiles = await storage.getFiles(p.id);
        allData.projects.push({ ...p, files: pFiles.map(f => ({ filename: f.filename, content: f.content })) });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="replit-export-${userId}.json"`);
      return res.json(allData);
    } catch {
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

  // --- TEAMS ---
  app.get("/api/teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const userTeams = await storage.getUserTeams(req.session.userId!);
      return res.json(userTeams);
    } catch {
      return res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = z.object({ name: z.string().min(1).max(50), slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/) }).parse(req.body);
      const existing = await storage.getTeamBySlug(data.slug);
      if (existing) return res.status(409).json({ message: "Team slug already taken" });
      const team = await storage.createTeam({ name: data.name, slug: data.slug, ownerId: req.session.userId! });
      await storage.trackEvent(req.session.userId!, "team_created", { teamId: team.id });
      return res.status(201).json(team);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.get("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const isMember = members.some(m => m.userId === req.session.userId);
      if (!isMember) return res.status(403).json({ message: "Not a team member" });
      return res.json({ ...team, members });
    } catch {
      return res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.put("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      const data = z.object({ name: z.string().min(1).max(50).optional(), avatarUrl: z.string().url().optional() }).parse(req.body);
      const updated = await storage.updateTeam(team.id, data);
      return res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteTeam(team.id);
      return res.json({ message: "Team deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete team" });
    }
  });

  app.post("/api/teams/:id/invite", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const requester = members.find(m => m.userId === req.session.userId);
      if (!requester || !["owner", "admin"].includes(requester.role)) return res.status(403).json({ message: "Not authorized to invite" });
      const { email, role } = z.object({ email: z.string().email(), role: z.enum(["member", "admin"]).default("member") }).parse(req.body);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invite = await storage.createTeamInvite(team.id, email, role, req.session.userId!, token, expiresAt);
      const inviter = await storage.getUser(req.session.userId!);
      await sendTeamInviteEmail(email, team.name, inviter?.displayName || inviter?.email || "Someone", token);
      log(`[teams] Invite for ${email} to team ${team.name}: /invite/${token}`, "info");
      return res.status(201).json(invite);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to send invite" });
    }
  });

  app.get("/api/teams/:id/invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const invites = await storage.getTeamInvites(req.params.id);
      return res.json(invites);
    } catch {
      return res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.post("/api/teams/accept-invite", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const invite = await storage.acceptTeamInvite(token);
      if (!invite) return res.status(400).json({ message: "Invalid or expired invite" });
      await storage.addTeamMember({ teamId: invite.teamId, userId: req.session.userId!, role: invite.role });
      return res.json({ message: "Joined team successfully", teamId: invite.teamId });
    } catch {
      return res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.delete("/api/teams/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const requester = members.find(m => m.userId === req.session.userId);
      if (!requester || !["owner", "admin"].includes(requester.role)) return res.status(403).json({ message: "Not authorized" });
      if (req.params.userId === team.ownerId) return res.status(400).json({ message: "Cannot remove team owner" });
      await storage.removeTeamMember(team.id, req.params.userId);
      return res.json({ message: "Member removed" });
    } catch {
      return res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.put("/api/teams/:id/members/:userId/role", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      const { role } = z.object({ role: z.enum(["member", "admin"]) }).parse(req.body);
      const member = await storage.updateTeamMemberRole(team.id, req.params.userId, role);
      return res.json(member);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update role" });
    }
  });

  // --- ADMIN ---
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    next();
  };

  app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      const metrics = getSystemMetrics();
      return res.json({ ...summary, system: metrics });
    } catch {
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const { users: userList, total } = await storage.getAllUsers(limit, offset);
      const safeUsers = userList.map(u => ({
        id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl,
        emailVerified: u.emailVerified, isAdmin: u.isAdmin, createdAt: u.createdAt,
      }));
      return res.json({ users: safeUsers, total, limit, offset });
    } catch {
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().optional(),
        emailVerified: z.boolean().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.put("/api/admin/users/:id/plan", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { plan } = z.object({ plan: z.enum(["free", "pro", "team"]) }).parse(req.body);
      const quota = await storage.updateUserPlan(req.params.id, plan);
      return res.json(quota);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "Cannot delete yourself" });
      await storage.deleteUser(req.params.id);
      return res.json({ message: "User deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const event = req.query.event as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getAnalytics({ event, limit });
      return res.json(events);
    } catch {
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/execution-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getExecutionLogs({ limit: 100 });
      return res.json(logs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch execution logs" });
    }
  });

  // --- ANALYTICS TRACKING ---
  app.post("/api/analytics/track", async (req: Request, res: Response) => {
    try {
      const { event, properties } = z.object({
        event: z.string(),
        properties: z.record(z.any()).optional(),
      }).parse(req.body);
      await storage.trackEvent(req.session.userId || null, event, properties);
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: "Invalid event" });
    }
  });

  // --- PACKAGE MANAGEMENT ---
  app.get("/api/projects/:id/packages", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const files = await storage.getFiles(req.params.id);
      const pkgFile = files.find(f => f.filename === "package.json");
      const reqFile = files.find(f => f.filename === "requirements.txt");
      const pyprojectFile = files.find(f => f.filename === "pyproject.toml");
      let packages: { name: string; version: string; dev?: boolean }[] = [];
      let packageManager: "npm" | "pip" | "none" = "none";
      if (pkgFile) {
        packageManager = "npm";
        try {
          const pkg = JSON.parse(pkgFile.content || "{}");
          if (pkg.dependencies) Object.entries(pkg.dependencies).forEach(([name, version]) => packages.push({ name, version: String(version) }));
          if (pkg.devDependencies) Object.entries(pkg.devDependencies).forEach(([name, version]) => packages.push({ name, version: String(version), dev: true }));
        } catch {}
      } else if (reqFile) {
        packageManager = "pip";
        const lines = (reqFile.content || "").split("\n").filter(l => l.trim() && !l.startsWith("#"));
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9_-]+)(?:([=<>!~]+)(.+))?$/);
          if (match) packages.push({ name: match[1], version: match[3] || "latest" });
        }
      } else if (pyprojectFile) {
        packageManager = "pip";
      }
      return res.json({ packages, packageManager, language: project.language });
    } catch {
      return res.status(500).json({ message: "Failed to get packages" });
    }
  });

  app.post("/api/projects/:id/packages/add", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { name, dev } = z.object({ name: z.string().min(1).max(200), dev: z.boolean().optional() }).parse(req.body);
      const files = await storage.getFiles(req.params.id);
      if (project.language === "python" || project.language === "python3") {
        let reqFile = files.find(f => f.filename === "requirements.txt");
        if (!reqFile) {
          reqFile = await storage.createFile(project.id, { projectId: project.id, filename: "requirements.txt", content: name + "\n" });
        } else {
          const lines = (reqFile.content || "").split("\n");
          if (!lines.some(l => l.trim().startsWith(name))) {
            await storage.updateFileContent(reqFile.id, (reqFile.content || "").trimEnd() + "\n" + name + "\n");
          }
        }
        return res.json({ success: true, command: `pip install ${name}` });
      } else {
        let pkgFile = files.find(f => f.filename === "package.json");
        if (!pkgFile) {
          const pkg = { name: project.name, version: "1.0.0", dependencies: { [name]: "latest" } };
          pkgFile = await storage.createFile(project.id, { projectId: project.id, filename: "package.json", content: JSON.stringify(pkg, null, 2) });
        } else {
          try {
            const pkg = JSON.parse(pkgFile.content || "{}");
            const section = dev ? "devDependencies" : "dependencies";
            if (!pkg[section]) pkg[section] = {};
            pkg[section][name] = "latest";
            await storage.updateFileContent(pkgFile.id, JSON.stringify(pkg, null, 2));
          } catch {}
        }
        return res.json({ success: true, command: `npm install ${dev ? "--save-dev " : ""}${name}` });
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to add package" });
    }
  });

  app.post("/api/projects/:id/packages/remove", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      const files = await storage.getFiles(req.params.id);
      if (project.language === "python" || project.language === "python3") {
        const reqFile = files.find(f => f.filename === "requirements.txt");
        if (reqFile) {
          const lines = (reqFile.content || "").split("\n").filter(l => !l.trim().startsWith(name));
          await storage.updateFileContent(reqFile.id, lines.join("\n"));
        }
        return res.json({ success: true, command: `pip uninstall -y ${name}` });
      } else {
        const pkgFile = files.find(f => f.filename === "package.json");
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile.content || "{}");
            if (pkg.dependencies) delete pkg.dependencies[name];
            if (pkg.devDependencies) delete pkg.devDependencies[name];
            await storage.updateFileContent(pkgFile.id, JSON.stringify(pkg, null, 2));
          } catch {}
        }
        return res.json({ success: true, command: `npm uninstall ${name}` });
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to remove package" });
    }
  });

  // --- FORK PROJECT ---
  app.post("/api/projects/:id/fork", requireAuth, async (req: Request, res: Response) => {
    try {
      const sourceProject = await storage.getProject(req.params.id);
      if (!sourceProject) return res.status(404).json({ message: "Project not found" });
      const isOwner = sourceProject.userId === req.session.userId;
      const isPublished = sourceProject.isPublished;
      if (!isOwner && !isPublished) return res.status(403).json({ message: "Cannot fork a private project" });
      const sourceFiles = await storage.getFiles(sourceProject.id);
      const userProjects = await storage.getUserProjects(req.session.userId!);
      const currentUser = await storage.getUser(req.session.userId!);
      const limits = PLAN_LIMITS[(currentUser?.plan as keyof typeof PLAN_LIMITS) || "free"];
      if (userProjects.length >= limits.maxProjects) return res.status(403).json({ message: "Project limit reached" });
      const rawName = req.body.name || `${sourceProject.name} (fork)`;
      const forkName = sanitizeInput(rawName, 100);
      const newProject = await storage.createProject(req.session.userId!, {
        name: forkName,
        language: sourceProject.language,
      });
      for (const file of sourceFiles) {
        await storage.createFile(newProject.id, {
          filename: file.filename,
          content: file.content,
        });
      }
      await storage.trackEvent(req.session.userId!, "project_forked", { sourceProjectId: sourceProject.id, newProjectId: newProject.id });
      return res.json(newProject);
    } catch {
      return res.status(500).json({ message: "Failed to fork project" });
    }
  });

  // --- DEPLOYMENTS ---
  app.post("/api/projects/:id/deploy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const deployment = await storage.createDeployment({ projectId: project.id, userId: req.session.userId! });
      const projectFiles = await storage.getFiles(project.id);
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const url = `/shared/${project.id}`;
      await storage.updateProject(project.id, { isPublished: true, publishedSlug: slug });
      let buildLog = `[deploy] Building ${project.name}...\n`;
      buildLog += `[deploy] Found ${projectFiles.length} files\n`;
      buildLog += `[deploy] Language: ${project.language}\n`;
      buildLog += `[deploy] Deploying to ${url}\n`;
      buildLog += `[deploy] ✓ Deployment complete\n`;
      await storage.updateDeployment(deployment.id, { status: "live", buildLog, url, finishedAt: new Date() });
      await storage.trackEvent(req.session.userId!, "project_deployed", { projectId: project.id });
      return res.json({ deployment: { ...deployment, status: "live", buildLog, url }, slug, url });
    } catch {
      return res.status(500).json({ message: "Deployment failed" });
    }
  });

  app.get("/api/projects/:id/deployments", requireAuth, async (req: Request, res: Response) => {
    try {
      const deps = await storage.getProjectDeployments(req.params.id);
      return res.json(deps);
    } catch {
      return res.status(500).json({ message: "Failed to fetch deployments" });
    }
  });

  // --- VERSION HISTORY ---
  app.post("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      const { message } = z.object({ message: z.string().min(1).max(200) }).parse(req.body);
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      const snapshot: Record<string, string> = {};
      projectFiles.forEach(f => { snapshot[f.filename] = f.content; });
      const existingCommits = await storage.getCommits(project.id, "main");
      const parentCommitId = existingCommits.length > 0 ? existingCommits[0].id : undefined;
      const commit = await storage.createCommit({
        projectId: project.id, branchName: "main", message,
        authorId: req.session.userId!, parentCommitId: parentCommitId || null, snapshot,
      });
      let branch = await storage.getBranch(project.id, "main");
      if (!branch) {
        branch = await storage.createBranch({ projectId: project.id, name: "main", headCommitId: commit.id, isDefault: true });
      } else {
        await storage.updateBranchHead(branch.id, commit.id);
      }
      await storage.trackEvent(req.session.userId!, "commit_created", { projectId: project.id, commitId: commit.id });
      return res.status(201).json(commit);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create commit" });
    }
  });

  app.get("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      const branch = (req.query.branch as string) || "main";
      const commitList = await storage.getCommits(req.params.id, branch);
      return res.json(commitList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commits" });
    }
  });

  app.get("/api/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit) return res.status(404).json({ message: "Commit not found" });
      return res.json(commit);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commit" });
    }
  });

  app.post("/api/projects/:id/restore/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit || commit.projectId !== project.id) return res.status(404).json({ message: "Commit not found" });
      const currentFiles = await storage.getFiles(project.id);
      for (const f of currentFiles) { await storage.deleteFile(f.id); }
      const snapshot = commit.snapshot as Record<string, string>;
      for (const [filename, content] of Object.entries(snapshot)) {
        await storage.createFile(project.id, { filename, content });
      }
      return res.json({ message: "Restored to commit", commitId: commit.id });
    } catch {
      return res.status(500).json({ message: "Failed to restore" });
    }
  });

  app.get("/api/projects/:id/branches", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchList = await storage.getBranches(req.params.id);
      return res.json(branchList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // --- METRICS (for error boundary reporting) ---
  app.get("/api/metrics", (_req: Request, res: Response) => {
    return res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/github/user", requireAuth, async (_req: Request, res: Response) => {
    try {
      const user = await github.getAuthenticatedUser();
      if (!user) return res.json({ connected: false });
      return res.json({ connected: true, user });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.get("/api/github/repos", requireAuth, async (_req: Request, res: Response) => {
    try {
      const repos = await github.listUserRepos();
      return res.json(repos);
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to fetch repos" });
    }
  });

  app.post("/api/github/import", requireAuth, async (req: Request, res: Response) => {
    const { owner, repo, name } = req.body;
    if (!owner || !repo) return res.status(400).json({ message: "owner and repo required" });
    try {
      const projectCheck = await storage.checkProjectLimit(req.session.userId!);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached` });
      }
      const contents = await github.getRepoContents(owner, repo);
      const repoInfo = await github.getRepo(owner, repo);
      const lang = repoInfo.language === "Python" ? "python" : repoInfo.language === "TypeScript" ? "typescript" : "javascript";
      const project = await storage.createProject(req.session.userId!, {
        name: (name || repo).slice(0, 50),
        language: lang,
      });
      const importFiles = contents.filter((c: any) => c.type === "file").slice(0, 20);
      for (const item of importFiles) {
        try {
          const content = await github.getFileContent(owner, repo, item.path);
          await storage.createFile(project.id, { filename: item.path, content: content.slice(0, 500000) });
        } catch {}
      }
      const files = await storage.getFiles(project.id);
      return res.status(201).json({ project, files });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to import from GitHub" });
    }
  });

  app.post("/api/github/export", requireAuth, async (req: Request, res: Response) => {
    const { projectId, repoName, isPrivate } = req.body;
    if (!projectId || !repoName) return res.status(400).json({ message: "projectId and repoName required" });
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });
      const newRepo = await github.createRepo(repoName, `Exported from IDE: ${project.name}`, isPrivate !== false);
      const files = await storage.getFiles(projectId);
      for (const file of files) {
        if (file.content && !file.content.startsWith("data:")) {
          try {
            await github.pushFile(ghUser.login, newRepo.name, file.filename, file.content, `Add ${file.filename}`);
          } catch {}
        }
      }
      return res.json({ repo: newRepo, url: newRepo.html_url });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to export to GitHub" });
    }
  });

  // --- PROJECTS ---
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    const projectList = await storage.getProjects(req.session.userId!);
    return res.json(projectList);
  });

  app.post("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectCheck = await storage.checkProjectLimit(req.session.userId!);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.` });
      }
      const data = insertProjectSchema.parse(req.body);
      if (data.name) {
        const safeName = sanitizeProjectName(data.name);
        if (!safeName) {
          return res.status(400).json({ message: "Invalid project name" });
        }
        data.name = safeName;
      }
      const project = await storage.createProject(req.session.userId!, data);
      return res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/templates", (_req: Request, res: Response) => {
    return res.json(getAllTemplates());
  });

  app.post("/api/projects/from-template", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const projectCheck = await storage.checkProjectLimit(userId);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.` });
      }
      const schema = z.object({
        templateId: z.string(),
        name: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const template = getTemplateById(data.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const projectName = data.name ? (sanitizeProjectName(data.name) || template.name) : template.name;
      const project = await storage.createProjectFromTemplate(userId, {
        name: projectName,
        language: template.language,
        files: template.files,
      });
      return res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create project from template" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.json(project);
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const deleted = await storage.deleteProject(req.params.id, req.session.userId!);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json({ message: "Project deleted" });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, async (req: Request, res: Response) => {
    const projectLimit = await storage.checkProjectLimit(req.session.userId!);
    if (!projectLimit.allowed) {
      return res.status(403).json({ message: `Project limit reached (${projectLimit.current}/${projectLimit.limit}). Upgrade to Pro for more.` });
    }
    const project = await storage.duplicateProject(req.params.id, req.session.userId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.status(201).json(project);
  });

  // --- FILES ---
  app.get("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }
    const fileList = await storage.getFiles(req.params.projectId);
    return res.json(fileList);
  });

  app.post("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const data = insertFileSchema.parse(req.body);
      const safeName = sanitizeFilename(data.filename);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      if (data.content) {
        data.content = sanitizeInput(data.content, 500000);
      }
      const file = await storage.createFile(req.params.projectId, { ...data, filename: safeName });
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      return res.status(201).json(file);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create file" });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 5 },
  });

  app.post("/api/projects/:projectId/upload", requireAuth, upload.array("files", 5), async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const prefix = (req.body.path || "").replace(/^\/+|\/+$/g, "");
    const created = [];
    for (const f of files) {
      const rawName = f.originalname.replace(/[^a-zA-Z0-9._\-\/]/g, "_").slice(0, 100);
      const filename = prefix ? `${prefix}/${rawName}` : rawName;
      const safeName = sanitizeFilename(filename);
      if (!safeName) continue;
      const isBinary = !f.mimetype.startsWith("text/") && !f.mimetype.includes("json") && !f.mimetype.includes("javascript") && !f.mimetype.includes("xml") && !f.mimetype.includes("css") && !f.mimetype.includes("html") && !f.mimetype.includes("svg");
      const content = isBinary
        ? `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
        : f.buffer.toString("utf-8");
      try {
        const file = await storage.createFile(req.params.projectId, { filename: safeName, content });
        created.push(file);
      } catch {}
    }
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.status(201).json({ files: created, count: created.length });
  });

  app.patch("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, filename } = req.body;
    if (typeof content === "string") {
      const sanitizedContent = sanitizeInput(content, 500000);
      const file = await storage.updateFileContent(req.params.id, sanitizedContent);
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      return res.json(file);
    }
    if (typeof filename === "string" && filename.trim()) {
      const safeName = sanitizeFilename(filename.trim());
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const file = await storage.renameFile(req.params.id, safeName);
      return res.json(file);
    }
    return res.status(400).json({ message: "content or filename required" });
  });

  app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteFile(req.params.id);
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.json({ message: "File deleted" });
  });

  app.patch("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, language } = req.body;
    let safeName = name;
    if (typeof name === "string") {
      safeName = sanitizeProjectName(name);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid project name" });
      }
    }
    const updated = await storage.updateProject(req.params.id, { name: safeName, language });
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
  });

  // --- ENV VARS ---
  app.get("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVars = await storage.getProjectEnvVars(req.params.projectId);
    return res.json(envVars);
  });

  app.post("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { key, value } = req.body;
    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      return res.status(400).json({ message: "key and value are required" });
    }
    const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!sanitizedKey || sanitizedKey.length > 100) {
      return res.status(400).json({ message: "Invalid key name" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    try {
      const envVar = await storage.createProjectEnvVar(req.params.projectId, sanitizedKey, value);
      return res.status(201).json(envVar);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: `Variable "${sanitizedKey}" already exists` });
      }
      return res.status(500).json({ message: "Failed to create env var" });
    }
  });

  app.patch("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    const { value } = req.body;
    if (!value || typeof value !== "string") {
      return res.status(400).json({ message: "value is required" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    const updated = await storage.updateProjectEnvVar(req.params.id, value);
    return res.json(updated);
  });

  app.delete("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    await storage.deleteProjectEnvVar(req.params.id);
    return res.json({ message: "Env var deleted" });
  });

  // --- RUNS ---
  app.post("/api/projects/:projectId/run", requireAuth, runLimiter, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const userCheck = checkUserRateLimit(userId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    const quotaCheck = await storage.incrementExecution(userId);
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: "Daily execution limit reached. Upgrade to Pro for more." });
    }

    try {
      await acquireExecutionSlot(userId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();

    const run = await storage.createRun(userId, {
      projectId: project.id,
      language,
      code,
    });

    broadcastToProject(project.id, {
      type: "run_status",
      runId: run.id,
      status: "running",
    });

    res.status(202).json({ runId: run.id, status: "running" });

    const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);

    const projectEnvVarsList = await storage.getProjectEnvVars(project.id);
    const envVarsMap: Record<string, string> = {};
    for (const ev of projectEnvVarsList) {
      envVarsMap[ev.key] = ev.encryptedValue;
    }

    try {
      const result = await executeCode(code, language, (message, type) => {
        broadcastToProject(project.id, {
          type: "run_log",
          runId: run.id,
          message,
          logType: type,
          timestamp: Date.now(),
        });
      }, undefined, undefined, envVarsMap);

      const durationMs = Date.now() - startTime;
      const failed = result.exitCode !== 0;
      recordExecution(userId, clientIp, durationMs, failed);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: failed ? "failed" : "completed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        finishedAt: new Date(),
      });

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        status: failed ? "failed" : "completed",
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      recordExecution(userId, clientIp, durationMs, true);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: 1,
        durationMs,
        securityViolation: null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: "failed",
        stderr: error.message,
        exitCode: 1,
        finishedAt: new Date(),
      });

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        status: "failed",
        exitCode: 1,
      });
    } finally {
      releaseExecutionSlot(userId);
    }
  });

  app.get("/api/projects/:projectId/runs", requireAuth, async (req: Request, res: Response) => {
    const runList = await storage.getRunsByProject(req.params.projectId);
    return res.json(runList);
  });

  app.get("/api/execution-metrics", requireAuth, async (req: Request, res: Response) => {
    const metrics = getExecutionMetrics(req.session.userId!);
    return res.json(metrics);
  });

  app.get("/api/projects/:projectId/poll", requireAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !project.isDemo && !project.isPublished) {
      return res.status(403).json({ message: "Access denied" });
    }
    const since = parseInt(req.query.since as string) || 0;
    const broadcasts = recentBroadcasts.get(projectId) || [];
    const newMessages = broadcasts
      .filter(b => b.timestamp > since)
      .map(b => b.data);
    return res.json({ messages: newMessages, timestamp: Date.now() });
  });

  // --- DEMO ---
  app.get("/api/demo/project", async (_req: Request, res: Response) => {
    const project = await storage.getDemoProject();
    if (!project) {
      return res.status(404).json({ message: "No demo project available" });
    }
    const fileList = await storage.getFiles(project.id);
    return res.json({ project, files: fileList });
  });

  app.post("/api/demo/run", runLimiter, async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const demoUserId = `demo-${clientIp}`;
    const userCheck = checkUserRateLimit(demoUserId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    try {
      await acquireExecutionSlot(demoUserId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);
    try {
      const result = await executeCode(code, language);
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, result.exitCode !== 0);

      storage.createExecutionLog({
        userId: null,
        projectId: null,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      return res.json({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, true);
      return res.status(500).json({ message: "Execution failed" });
    } finally {
      releaseExecutionSlot(demoUserId);
    }
  });

  // --- PUBLISH / SHARE ---
  app.post("/api/projects/:id/publish", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.publishProject(req.params.id, req.session.userId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json(project);
  });

  app.get("/api/shared/:id", async (req: Request, res: Response) => {
    const result = await storage.getPublishedProject(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Project not found or not published" });
    }
    return res.json(result);
  });

  // --- GIT VERSION CONTROL ---
  app.get("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = req.query.branch as string | undefined;
    const commitList = await storage.getCommits(req.params.projectId, branchName);
    return res.json(commitList);
  });

  app.get("/api/projects/:projectId/git/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const commit = await storage.getCommit(req.params.commitId);
    if (!commit || commit.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Commit not found" });
    }
    return res.json(commit);
  });

  app.post("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { message, branchName = "main" } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Commit message is required" });
    }

    let branch = await storage.getBranch(req.params.projectId, branchName);
    if (!branch) {
      branch = await storage.createBranch({
        projectId: req.params.projectId,
        name: branchName,
        isDefault: branchName === "main",
      });
    }

    const projectFiles = await storage.getFiles(req.params.projectId);
    const snapshot: Record<string, string> = {};
    for (const f of projectFiles) {
      snapshot[f.filename] = f.content;
    }

    const commit = await storage.createCommit({
      projectId: req.params.projectId,
      branchName,
      message: message.trim(),
      authorId: req.session.userId!,
      parentCommitId: branch.headCommitId || undefined,
      snapshot,
    });

    await storage.updateBranchHead(branch.id, commit.id);
    return res.status(201).json(commit);
  });

  app.get("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchList = await storage.getBranches(req.params.projectId);
    return res.json(branchList);
  });

  app.post("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { name, fromBranch = "main" } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    const existing = await storage.getBranch(req.params.projectId, name.trim());
    if (existing) {
      return res.status(409).json({ message: "Branch already exists" });
    }

    const sourceBranch = await storage.getBranch(req.params.projectId, fromBranch);
    const branch = await storage.createBranch({
      projectId: req.params.projectId,
      name: name.trim(),
      headCommitId: sourceBranch?.headCommitId || undefined,
      isDefault: false,
    });
    return res.status(201).json(branch);
  });

  app.delete("/api/projects/:projectId/git/branches/:branchId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchList = await storage.getBranches(req.params.projectId);
    const branch = branchList.find(b => b.id === req.params.branchId);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    if (branch.isDefault) {
      return res.status(400).json({ message: "Cannot delete the default branch" });
    }
    await storage.deleteBranch(branch.id);
    return res.json({ success: true });
  });

  app.post("/api/projects/:projectId/git/checkout", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { commitId, branchName } = req.body;

    let snapshot: Record<string, string> | null = null;

    if (commitId) {
      const commit = await storage.getCommit(commitId);
      if (!commit || commit.projectId !== req.params.projectId) {
        return res.status(404).json({ message: "Commit not found" });
      }
      snapshot = commit.snapshot as Record<string, string>;
    } else if (branchName) {
      const branch = await storage.getBranch(req.params.projectId, branchName);
      if (!branch || !branch.headCommitId) {
        return res.status(404).json({ message: "Branch not found or has no commits" });
      }
      const commit = await storage.getCommit(branch.headCommitId);
      if (!commit) {
        return res.status(404).json({ message: "Head commit not found" });
      }
      snapshot = commit.snapshot as Record<string, string>;
    }

    if (!snapshot) {
      return res.status(400).json({ message: "commitId or branchName is required" });
    }

    const currentFiles = await storage.getFiles(req.params.projectId);
    for (const f of currentFiles) {
      await storage.deleteFile(f.id);
    }
    for (const [filename, content] of Object.entries(snapshot)) {
      await storage.createFile(req.params.projectId, { filename, content });
    }

    return res.json({ success: true, filesRestored: Object.keys(snapshot).length });
  });

  app.get("/api/projects/:projectId/git/diff", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = (req.query.branch as string) || "main";
    const branch = await storage.getBranch(req.params.projectId, branchName);

    const currentFiles = await storage.getFiles(req.params.projectId);
    const currentSnapshot: Record<string, string> = {};
    for (const f of currentFiles) {
      currentSnapshot[f.filename] = f.content;
    }

    let lastSnapshot: Record<string, string> = {};
    if (branch?.headCommitId) {
      const lastCommit = await storage.getCommit(branch.headCommitId);
      if (lastCommit) {
        lastSnapshot = lastCommit.snapshot as Record<string, string>;
      }
    }

    const changes: Array<{ filename: string; status: "added" | "modified" | "deleted"; oldContent?: string; newContent?: string }> = [];

    for (const [filename, content] of Object.entries(currentSnapshot)) {
      if (!(filename in lastSnapshot)) {
        changes.push({ filename, status: "added", newContent: content });
      } else if (lastSnapshot[filename] !== content) {
        changes.push({ filename, status: "modified", oldContent: lastSnapshot[filename], newContent: content });
      }
    }
    for (const filename of Object.keys(lastSnapshot)) {
      if (!(filename in currentSnapshot)) {
        changes.push({ filename, status: "deleted", oldContent: lastSnapshot[filename] });
      }
    }

    return res.json({ branch: branchName, changes, hasCommits: !!branch?.headCommitId });
  });

  app.get("/api/projects/:projectId/git/blame/:filename", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = (req.query.branch as string) || "main";
    const filename = decodeURIComponent(req.params.filename);

    const currentFile = (await storage.getFiles(req.params.projectId)).find(f => f.filename === filename);
    if (!currentFile) {
      return res.status(404).json({ message: "File not found" });
    }

    const currentLines = currentFile.content.split("\n");
    const numLines = currentLines.length;
    const uncommittedInfo = { commitId: null as string | null, message: "Uncommitted", author: "You", date: new Date().toISOString() };

    const allCommits = await storage.getCommits(req.params.projectId, branchName);
    const commitsSorted = [...allCommits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const relevantCommits = commitsSorted.filter(c => filename in (c.snapshot as Record<string, string>));

    if (relevantCommits.length === 0) {
      return res.json({ filename, blame: currentLines.map((_, i) => ({ line: i + 1, ...uncommittedInfo })) });
    }

    type LineInfo = { commitId: string | null; message: string; author: string; date: string };
    const attribution: LineInfo[] = new Array(numLines).fill(null).map(() => ({ ...uncommittedInfo }));

    function mapLinesToPrev(newerLines: string[], olderLines: string[]): Map<number, number> {
      const diff = diffArrays(olderLines, newerLines);
      const mapping = new Map<number, number>();
      let oldIdx = 0;
      let newIdx = 0;
      for (const part of diff) {
        const count = part.count || part.value.length;
        if (part.removed) {
          oldIdx += count;
        } else if (part.added) {
          newIdx += count;
        } else {
          for (let j = 0; j < count; j++) {
            mapping.set(newIdx + j, oldIdx + j);
          }
          oldIdx += count;
          newIdx += count;
        }
      }
      return mapping;
    }

    const latestSnap = (relevantCommits[0].snapshot as Record<string, string>)[filename] || "";
    const latestCommitLines = latestSnap.split("\n");
    const currentToLatest = mapLinesToPrev(currentLines, latestCommitLines);

    let lineOrigin: Array<{ lineIdx: number; origIdx: number }> = [];
    for (let i = 0; i < numLines; i++) {
      const mappedIdx = currentToLatest.get(i);
      if (mappedIdx !== undefined) {
        lineOrigin.push({ lineIdx: mappedIdx, origIdx: i });
      }
    }

    const chronological = [...relevantCommits].reverse();
    const versionLines: string[][] = chronological.map(c => {
      const snap = c.snapshot as Record<string, string>;
      return (snap[filename] || "").split("\n");
    });

    const lastVersionIdx = versionLines.length - 1;
    const lineCommitIdx: number[] = new Array(latestCommitLines.length).fill(lastVersionIdx);

    let linePositions: number[] = Array.from({ length: latestCommitLines.length }, (_, i) => i);

    for (let vi = lastVersionIdx; vi >= 1; vi--) {
      const newerLines = versionLines[vi];
      const olderLines = versionLines[vi - 1];
      const mapping = mapLinesToPrev(newerLines, olderLines);

      const newPositions: number[] = new Array(linePositions.length).fill(-1);

      for (let li = 0; li < linePositions.length; li++) {
        if (lineCommitIdx[li] !== vi) continue;
        const posInNewer = linePositions[li];
        if (posInNewer === -1) continue;
        const olderIdx = mapping.get(posInNewer);
        if (olderIdx !== undefined) {
          lineCommitIdx[li] = vi - 1;
          newPositions[li] = olderIdx;
        }
      }

      for (let li = 0; li < linePositions.length; li++) {
        if (newPositions[li] !== -1) {
          linePositions[li] = newPositions[li];
        }
      }
    }

    for (const { lineIdx, origIdx } of lineOrigin) {
      if (lineIdx < lineCommitIdx.length) {
        const ci = lineCommitIdx[lineIdx];
        const commit = chronological[ci];
        attribution[origIdx] = {
          commitId: commit.id,
          message: commit.message,
          author: commit.authorId,
          date: new Date(commit.createdAt).toISOString(),
        };
      }
    }

    return res.json({
      filename,
      blame: attribution.map((info, i) => ({ line: i + 1, ...info })),
    });
  });

  // --- WORKSPACE / RUNNER ---
  app.get("/api/runner/status", requireAuth, async (_req: Request, res: Response) => {
    const online = await runnerClient.ping();
    return res.json({ online, baseUrl: runnerClient.getBaseUrl() });
  });

  app.post("/api/workspaces/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }

    const online = await runnerClient.ping();
    if (!online) {
      return res.json({ workspaceId: null, runnerUrl: runnerClient.getBaseUrl(), token: null, online: false });
    }

    let workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      workspace = await storage.createWorkspace({ projectId: project.id, ownerUserId: req.session.userId! });
      try {
        await runnerClient.createWorkspace(workspace.id, project.language);
      } catch (err: any) {
        log(`Runner createWorkspace error: ${err.message}`, "runner");
        await storage.updateWorkspaceStatus(workspace.id, "error");
        return res.json({ workspaceId: workspace.id, runnerUrl: runnerClient.getBaseUrl(), token: null, online: true, error: "Failed to provision workspace on runner" });
      }
    }

    let token: string | null = null;
    try {
      token = runnerClient.generateToken(workspace.id, req.session.userId!);
    } catch (err: any) {
      log(`Token generation error: ${err.message}`, "runner");
      return res.json({ workspaceId: workspace.id, runnerUrl: runnerClient.getBaseUrl(), token: null, online: true, error: "JWT secret not configured" });
    }

    const ttl = parseInt(process.env.WORKSPACE_TOKEN_TTL_MIN || "15", 10);
    await storage.createWorkspaceSession({
      workspaceId: workspace.id,
      userId: req.session.userId!,
      expiresAt: new Date(Date.now() + ttl * 60 * 1000),
    });

    await storage.touchWorkspace(workspace.id);

    return res.json({
      workspaceId: workspace.id,
      runnerUrl: runnerClient.getBaseUrl(),
      token,
      online: true,
    });
  });

  app.post("/api/workspaces/:projectId/start", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      await runnerClient.startWorkspace(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, "running");
      return res.json({ status: "running" });
    } catch (err: any) {
      log(`Runner start error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.post("/api/workspaces/:projectId/stop", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      await runnerClient.stopWorkspace(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, "stopped");
      return res.json({ status: "stopped" });
    } catch (err: any) {
      log(`Runner stop error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.get("/api/workspaces/:projectId/status", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.json({ status: "none" });
    }
    try {
      const status = await runnerClient.getWorkspaceStatus(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, status);
      return res.json({ status, workspaceId: workspace.id });
    } catch {
      return res.json({ status: workspace.statusCache || "offline", workspaceId: workspace.id });
    }
  });

  app.get("/api/workspaces/:projectId/terminal-url", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host = req.headers.host || "localhost:5000";
    const wsUrl = `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(project.id)}`;
    return res.json({ wsUrl, workspaceId: project.id });
  });

  const getWorkspaceForProject = async (req: Request, res: Response): Promise<{ project: any; workspace: any } | null> => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      res.status(404).json({ message: "Project not found" });
      return null;
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      res.status(404).json({ message: "Workspace not initialized" });
      return null;
    }
    return { project, workspace };
  };

  app.get("/api/workspaces/:projectId/fs", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const path = (req.query.path as string) || "/";
      const entries = await runnerClient.fsList(ctx.workspace.id, path);
      return res.json(entries);
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.get("/api/workspaces/:projectId/fs/read", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const path = req.query.path as string;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      const content = await runnerClient.fsRead(ctx.workspace.id, path);
      return res.json({ content });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/write", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path, content } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await runnerClient.fsWrite(ctx.workspace.id, path, content ?? "");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/mkdir", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await runnerClient.fsMkdir(ctx.workspace.id, path);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.delete("/api/workspaces/:projectId/fs/rm", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await runnerClient.fsRm(ctx.workspace.id, path);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/rename", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath || !validateRunnerPath(oldPath) || !validateRunnerPath(newPath)) {
        return res.status(400).json({ message: "Invalid path" });
      }
      await runnerClient.fsRename(ctx.workspace.id, oldPath, newPath);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.get("/api/workspaces/:projectId/preview-url", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not initialized" });
    }
    const rawPort = parseInt(req.query.port as string);
    const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
    const url = runnerClient.previewUrl(workspace.id, port);
    return res.json({ previewUrl: url, workspaceId: workspace.id, port });
  });

  // --- AI ASSISTANT ---
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const gemini = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
    },
  });

  app.post("/api/projects/generate", requireAuth, aiGenerateLimiter, async (req: Request, res: Response) => {
    try {
      const { prompt, model: requestedModel } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
        return res.status(400).json({ message: "Please provide a project description (at least 3 characters)" });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ message: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
      }

      const genProjectLimit = await storage.checkProjectLimit(req.session.userId!);
      if (!genProjectLimit.allowed) {
        return res.status(403).json({ message: `Project limit reached (${genProjectLimit.current}/${genProjectLimit.limit}). Upgrade to Pro for more.` });
      }

      const systemPrompt = `You are a senior software engineer. Given a project description, generate a project specification as JSON.

Return ONLY valid JSON (no markdown, no code blocks, no explanation) with this structure:
{
  "name": "project-name-slug",
  "language": "javascript",
  "files": [
    { "filename": "index.js", "content": "// code" }
  ]
}

Rules:
- name: short kebab-case slug (max 30 chars)
- language: one of javascript, typescript, python
- files: generate 1-3 concise, working files. Keep code SHORT but functional.
- For web apps: put everything in a single HTML file with inline CSS/JS when possible
- IMPORTANT: Keep total response under 3000 tokens. Prefer fewer, smaller files.
- Do NOT add any text before or after the JSON object`;

      let text = "";

      if (requestedModel === "gemini") {
        const geminiResponse = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\nUser request: " + prompt.trim() }] },
          ],
          config: { maxOutputTokens: 16384 },
        });
        text = geminiResponse.text || "";
      } else if (requestedModel === "gpt") {
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt.trim() },
          ],
          max_completion_tokens: 16384,
        });
        text = gptResponse.choices[0]?.message?.content || "";
      } else {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          system: systemPrompt,
          messages: [{ role: "user", content: prompt.trim() }],
          max_tokens: 16384,
        });
        text = message.content[0].type === "text" ? message.content[0].text : "";
      }
      let spec: { name: string; language: string; files: { filename: string; content: string }[] };

      log(`AI generate raw response (first 500 chars): ${text.slice(0, 500)}`, "ai");

      let jsonStr = text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      try {
        spec = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        log(`AI JSON parse error: ${parseErr.message}. Attempting truncated recovery...`, "ai");
        try {
          let recovered = jsonStr;
          if (!recovered.endsWith("}")) {
            const lastFileEnd = recovered.lastIndexOf("}");
            if (lastFileEnd > 0) {
              recovered = recovered.slice(0, lastFileEnd + 1);
              let openBrackets = (recovered.match(/\[/g) || []).length;
              let closeBrackets = (recovered.match(/\]/g) || []).length;
              while (closeBrackets < openBrackets) { recovered += "]"; closeBrackets++; }
              let openBraces = (recovered.match(/\{/g) || []).length;
              let closeBraces = (recovered.match(/\}/g) || []).length;
              while (closeBraces < openBraces) { recovered += "}"; closeBraces++; }
            }
          }
          spec = JSON.parse(recovered);
          log(`Truncated JSON recovery succeeded`, "ai");
        } catch {
          log(`Recovery also failed. Raw text (first 500): ${text.slice(0, 500)}`, "ai");
          return res.status(500).json({ message: "AI generated invalid project structure. Please try again." });
        }
      }

      if (!spec.name || !spec.language || !spec.files?.length) {
        return res.status(500).json({ message: "AI generated incomplete project. Please try again." });
      }

      const validLangs = ["javascript", "typescript", "python"];
      if (!validLangs.includes(spec.language)) spec.language = "javascript";

      const project = await storage.createProject(req.session.userId!, {
        name: spec.name.slice(0, 50),
        language: spec.language,
      });

      for (const file of spec.files.slice(0, 10)) {
        const safeFilename = sanitizeAIFilename(file.filename);
        if (!safeFilename) continue;
        const safeContent = sanitizeAIFileContent(file.content || "");
        await storage.createFile(project.id, {
          filename: safeFilename,
          content: safeContent,
        });
      }

      const files = await storage.getFiles(project.id);

      const conversation = await storage.createConversation({
        projectId: project.id,
        userId: req.session.userId!,
        title: prompt.slice(0, 100),
        model: requestedModel || "gpt",
      });
      await storage.addMessage({
        conversationId: conversation.id,
        role: "user",
        content: prompt,
      });
      const fileList = files.map(f => f.filename).join(", ");
      await storage.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: `I've created your project **${spec.name}** with the following files: ${fileList}.\n\nThe project is set up and ready to go! You can run it or ask me to make any changes.`,
        model: requestedModel || "gpt",
        fileOps: files.map(f => ({ type: "created" as const, filename: f.filename })),
      });

      return res.json({ project, files });
    } catch (error: any) {
      log(`AI project generation error: ${error.message}`, "ai");
      return res.status(500).json({ message: "Failed to generate project. Please try again." });
    }
  });

  app.get("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      return res.json({ conversation: null, messages: [] });
    }
    const msgs = await storage.getMessages(conversation.id);
    return res.json({ conversation, messages: msgs });
  });

  app.post("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const existing = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (existing) {
      return res.json(existing);
    }
    const { title, model } = req.body;
    const conversation = await storage.createConversation({
      projectId: req.params.projectId,
      userId: req.session.userId!,
      title: title || "",
      model: model || "gpt",
    });
    return res.status(201).json(conversation);
  });

  app.post("/api/ai/conversations/:projectId/messages", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    let conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      conversation = await storage.createConversation({
        projectId: req.params.projectId,
        userId: req.session.userId!,
        model: req.body.model || "gpt",
      });
    }
    const { role, content, model: msgModel, fileOps } = req.body;
    if (!role || !content) {
      return res.status(400).json({ message: "role and content required" });
    }
    const msg = await storage.addMessage({
      conversationId: conversation.id,
      role,
      content: typeof content === "string" ? content.slice(0, 100000) : "",
      model: msgModel || null,
      fileOps: fileOps || null,
    });
    return res.status(201).json(msg);
  });

  app.delete("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (conversation) {
      await storage.deleteConversation(conversation.id);
    }
    return res.json({ message: "Conversation cleared" });
  });

  app.post("/api/ai/complete", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { code, cursorOffset, language } = req.body;
      if (!code || typeof cursorOffset !== "number") {
        return res.status(400).json({ message: "code and cursorOffset required" });
      }
      const quota = await storage.incrementAiCall(req.session.userId!);
      if (!quota.allowed) {
        return res.json({ completion: "" });
      }
      const before = code.slice(Math.max(0, cursorOffset - 1500), cursorOffset);
      const after = code.slice(cursorOffset, cursorOffset + 500);
      const prompt = `You are a code completion engine. Given the code context, output ONLY the completion text (no explanation, no markdown). If there is nothing to suggest, respond with an empty string.\n\nLanguage: ${language || "javascript"}\nCode before cursor:\n${before}\n[CURSOR]\nCode after cursor:\n${after}`;
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.1,
      });
      const completion = result.choices[0]?.message?.content?.trim() || "";
      return res.json({ completion });
    } catch (err: any) {
      console.error("AI complete error:", err.message);
      return res.json({ completion: "" });
    }
  });

  app.post("/api/ai/chat", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, context, model } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }

      if (context) {
        if (typeof context.code === "string" && context.code.length > MAX_MESSAGE_CONTENT_LENGTH) {
          return res.status(400).json({ message: "Context code too large" });
        }
      }

      const systemPrompt = `You are an expert coding assistant embedded in Replit IDE. You help users write, debug, and improve code.

Rules:
- Always provide COMPLETE, WORKING code — never truncate, abbreviate, or use "..." to skip sections.
- When showing code, use markdown code blocks with the language tag and filename as a comment on the first line.
- If the user asks to build or create something, provide the full implementation, not just snippets.
- Include all imports, all functions, and all necessary code for the file to work standalone.
- When modifying existing code, show the COMPLETE updated file, not just the changed parts.${context ? `\n\nCurrent context:\nLanguage: ${context.language}\nFilename: ${context.filename}\nCode:\n\`\`\`\n${context.code}\n\`\`\`` : ""}`;

      const chatAiQuota = await storage.incrementAiCall(req.session.userId!);
      if (!chatAiQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached. Upgrade to Pro for more." });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (model === "gemini") {
        const geminiContents = [
          { role: "user" as const, parts: [{ text: systemPrompt }] },
          { role: "model" as const, parts: [{ text: "Understood. I'm ready to help." }] },
          ...messages.map((m: any) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        const stream = await gemini.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: geminiContents,
          config: { maxOutputTokens: 16384 },
        });

        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (model === "gpt") {
        const gptMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: gptMessages,
          stream: true,
          max_completion_tokens: 16384,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          max_tokens: 16384,
        });

        stream.on("text", (text) => {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        });

        await stream.finalMessage();
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI chat error: ${error.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  const executeToolCall = async (
    toolName: string,
    toolInput: { filename: string; content: string },
    projectId: string,
    existingFiles: any[],
    res: Response
  ) => {
    try {
      if (toolName === "create_file" || toolName === "edit_file") {
        const safeName = sanitizeAIFilename(toolInput.filename);
        if (!safeName) {
          log(`AI agent: blocked invalid filename "${toolInput.filename}"`, "ai");
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid or forbidden filename" })}\n\n`);
          return;
        }
        const safeContent = sanitizeAIFileContent(toolInput.content);
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (existingFile) {
          const file = await storage.updateFileContent(existingFile.id, safeContent);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file })}\n\n`);
        } else {
          const file = await storage.createFile(projectId, { filename: safeName, content: safeContent });
          existingFiles.push(file);
          res.write(`data: ${JSON.stringify({ type: "file_created", file })}\n\n`);
        }
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", message: `Failed to ${toolName}: ${err.message}` })}\n\n`);
    }
  };

  app.post("/api/ai/agent", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, projectId, model: requestedModel } = req.body;
      if (!messages || !Array.isArray(messages) || !projectId) {
        return res.status(400).json({ message: "messages array and projectId required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }

      if (typeof projectId !== "string" || projectId.length > 100) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const agentAiQuota = await storage.incrementAiCall(req.session.userId!);
      if (!agentAiQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached. Upgrade to Pro for more." });
      }

      const existingFiles = await storage.getFiles(projectId);
      const fileList = existingFiles.map(f => `- ${f.filename}`).join("\n");

      const agentSystemPrompt = `You are an AI coding agent inside Replit IDE. You can create and edit files in the user's project.

Current project: "${project.name}" (${project.language})
Existing files:
${fileList || "(no files yet)"}

When the user asks you to build something, create files, or make changes:
1. Think about what files need to be created or modified
2. Use the provided tools to create or update files
3. Explain what you're doing as you work

Always write complete, working code. Never use placeholders or TODOs.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (requestedModel === "gemini") {
        const geminiTools = [{
          functionDeclarations: [
            {
              name: "create_file",
              description: "Create a new file in the project with the given filename and content",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename (e.g. 'index.js', 'styles.css')" },
                  content: { type: Type.STRING, description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "edit_file",
              description: "Replace the entire content of an existing file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename of the existing file to edit" },
                  content: { type: Type.STRING, description: "The new full file content" },
                },
                required: ["filename", "content"],
              },
            },
          ],
        }];

        let geminiContents: any[] = [
          { role: "user", parts: [{ text: agentSystemPrompt }] },
          { role: "model", parts: [{ text: "I understand. I'm ready to help with your project." }] },
          ...messages.map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: geminiContents,
            config: { maxOutputTokens: 16384, tools: geminiTools },
          });

          const candidate = response.candidates?.[0];
          if (!candidate?.content?.parts) { continueLoop = false; break; }

          const parts = candidate.content.parts;
          let hasToolCall = false;
          const toolResponseParts: any[] = [];

          for (const part of parts) {
            if (part.text) {
              res.write(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`);
            }
            if (part.functionCall) {
              hasToolCall = true;
              const fn = part.functionCall;
              const toolInput = fn.args as { filename: string; content: string };

              res.write(`data: ${JSON.stringify({ type: "tool_use", name: fn.name, input: { filename: toolInput.filename } })}\n\n`);

              await executeToolCall(fn.name!, toolInput, projectId, existingFiles, res);

              toolResponseParts.push({
                functionResponse: {
                  name: fn.name,
                  response: { result: "Done" },
                },
              });
            }
          }

          if (hasToolCall) {
            geminiContents = [
              ...geminiContents,
              { role: "model", parts },
              { role: "user", parts: toolResponseParts },
            ];
          } else {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      } else if (requestedModel === "gpt") {
        const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          {
            type: "function",
            function: {
              name: "create_file",
              description: "Create a new file in the project with the given filename and content",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename (e.g. 'index.js', 'styles.css')" },
                  content: { type: "string", description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_file",
              description: "Replace the entire content of an existing file",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename of the existing file to edit" },
                  content: { type: "string", description: "The new full file content" },
                },
                required: ["filename", "content"],
              },
            },
          },
        ];

        let gptMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: agentSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: gptMessages,
            tools: openaiTools,
            max_completion_tokens: 16384,
          });

          const choice = response.choices[0];
          const message = choice.message;

          if (message.content) {
            res.write(`data: ${JSON.stringify({ type: "text", content: message.content })}\n\n`);
          }

          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== "function") continue;
              const fn = toolCall.function;
              const toolInput = JSON.parse(fn.arguments) as { filename: string; content: string };

              res.write(`data: ${JSON.stringify({ type: "tool_use", name: fn.name, input: { filename: toolInput.filename } })}\n\n`);

              await executeToolCall(fn.name, toolInput, projectId, existingFiles, res);

              toolResultMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: "Done",
              });
            }

            gptMessages = [
              ...gptMessages,
              { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any,
              ...toolResultMessages,
            ];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      } else {
        const tools: Anthropic.Messages.Tool[] = [
          {
            name: "create_file",
            description: "Create a new file in the project with the given filename and content",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename (e.g. 'index.js', 'styles.css')" },
                content: { type: "string", description: "The full file content" },
              },
              required: ["filename", "content"],
            },
          },
          {
            name: "edit_file",
            description: "Replace the entire content of an existing file",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename of the existing file to edit" },
                content: { type: "string", description: "The new full file content" },
              },
              required: ["filename", "content"],
            },
          },
        ];

        let currentMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            system: agentSystemPrompt,
            messages: currentMessages,
            max_tokens: 4096,
            tools,
          });

          for (const block of response.content) {
            if (block.type === "text") {
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              const input = block.input as { filename: string; content: string };

              res.write(`data: ${JSON.stringify({ type: "tool_use", name: block.name, input: { filename: input.filename } })}\n\n`);

              await executeToolCall(block.name, input, projectId, existingFiles, res);
            }
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: any[] = response.content
              .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
              .map((b) => ({
                type: "tool_result" as const,
                tool_use_id: b.id,
                content: "Done",
              }));

            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content as any },
              { role: "user" as const, content: toolResults as any },
            ];
          } else {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI agent error: ${error.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI agent error" });
      }
    }
  });

  // --- WebSocket ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      errorBuffer.push({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: err.status || 500,
        message: err.message || "Unknown error",
      });
      if (errorBuffer.length > MAX_ERROR_BUFFER) errorBuffer.shift();
    }
    next(err);
  });

  const wss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: any, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    if (pathname === "/ws") {
      sessionMiddleware(req, {} as any, () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then((project) => {
          if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    } else if (pathname === "/ws/terminal") {
      sessionMiddleware(req, {} as any, () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then((project) => {
          if (!project || project.userId !== req.session.userId) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          terminalWss.handleUpgrade(req, socket, head, (ws) => {
            terminalWss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    }
  });

  wss.on("connection", (ws: WebSocket & { isAlive?: boolean }, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      ws.close(1008, "projectId required");
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress || "unknown";

    if (!wsConnectionsByIp.has(clientIp)) {
      wsConnectionsByIp.set(clientIp, new Set());
    }
    const ipConnections = wsConnectionsByIp.get(clientIp)!;
    Array.from(ipConnections).forEach(existingWs => {
      if ((existingWs as any).readyState !== WebSocket.OPEN) {
        ipConnections.delete(existingWs);
      }
    });
    if (ipConnections.size >= WS_MAX_CONNECTIONS_PER_IP) {
      ws.close(1013, "Too many connections");
      log(`WebSocket connection rejected for IP ${clientIp}: limit reached`, "ws");
      return;
    }
    ipConnections.add(ws);

    if (!wsClients.has(projectId)) {
      wsClients.set(projectId, new Set());
    }
    wsClients.get(projectId)!.add(ws);
    ws.isAlive = true;

    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));

    log(`WebSocket connected for project ${projectId} (IP: ${clientIp}, connections: ${ipConnections.size})`, "ws");

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (rawData) => {
      if (!checkWsMessageRate(ws)) {
        ws.send(JSON.stringify({ type: "error", message: "Message rate limit exceeded" }));
        return;
      }
      try {
        const data = JSON.parse(rawData.toString());
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.get(projectId)?.delete(ws);
      if (wsClients.get(projectId)?.size === 0) {
        wsClients.delete(projectId);
      }
      wsConnectionsByIp.get(clientIp)?.delete(ws);
      if (wsConnectionsByIp.get(clientIp)?.size === 0) {
        wsConnectionsByIp.delete(clientIp);
      }
    });

    ws.on("error", () => {
      wsClients.get(projectId)?.delete(ws);
      wsConnectionsByIp.get(clientIp)?.delete(ws);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  terminalWss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");
    const userId = (req as any).session?.userId;

    if (!projectId || !userId) {
      ws.close(1008, "Missing projectId or auth");
      return;
    }

    log(`Terminal WebSocket connected for project ${projectId}`, "terminal");

    try {
      const projectEnvVarsList = await storage.getProjectEnvVars(projectId);
      const envVarsMap: Record<string, string> = {};
      for (const ev of projectEnvVarsList) {
        envVarsMap[ev.key] = ev.encryptedValue;
      }
      const term = getOrCreateTerminal(projectId, userId, envVarsMap);

      const dataHandler = term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "output", data }));
        }
      });

      ws.on("message", (rawData) => {
        try {
          const msg = JSON.parse(rawData.toString());
          if (msg.type === "input" && typeof msg.data === "string") {
            term.write(msg.data);
          } else if (msg.type === "resize" && msg.cols && msg.rows) {
            resizeTerminal(projectId, userId, msg.cols, msg.rows);
          }
        } catch {}
      });

      ws.on("close", () => {
        dataHandler.dispose();
        log(`Terminal WebSocket disconnected for project ${projectId}`, "terminal");
      });

      ws.on("error", () => {
        dataHandler.dispose();
      });
    } catch (err: any) {
      log(`Terminal error: ${err.message}`, "terminal");
      ws.send(JSON.stringify({ type: "error", message: "Failed to start terminal" }));
      ws.close(1011, "Terminal error");
    }
  });

  await storage.seedDemoProject();
  log("Demo project seeded", "seed");

  return httpServer;
}
