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
import { log } from "./index";
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
import * as runnerClient from "./runnerClient";
import { posix as pathPosix } from "path";

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
  "/api/csrf-token",
  "/api/demo/run",
  "/api/demo/project",
  "/api/ai/chat",
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
    secret: process.env.SESSION_SECRET || "vibe-platform-secret-key-change-in-prod",
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

    try {
      const result = await executeCode(code, language, (message, type) => {
        broadcastToProject(project.id, {
          type: "run_log",
          runId: run.id,
          message,
          logType: type,
          timestamp: Date.now(),
        });
      }, undefined, undefined);

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
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not initialized" });
    }
    try {
      const token = runnerClient.generateToken(workspace.id, req.session.userId!);
      const wsUrl = runnerClient.terminalWsUrl(workspace.id, token);
      return res.json({ wsUrl, workspaceId: workspace.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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

  await storage.seedDemoProject();
  log("Demo project seeded", "seed");

  return httpServer;
}
