import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema } from "@shared/schema";
import { z } from "zod";
import { executeCode } from "./executor";
import { log } from "./index";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

const wsClients = new Map<string, Set<WebSocket>>();

function broadcastToProject(projectId: string, data: any) {
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
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "vibe-platform-secret-key-change-in-prod",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
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

  app.use("/api", apiLimiter);

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
      return res.status(201).json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
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
      return res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
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

  // --- PROJECTS ---
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    const projectList = await storage.getProjects(req.session.userId!);
    return res.json(projectList);
  });

  app.post("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertProjectSchema.parse(req.body);
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
      const file = await storage.createFile(req.params.projectId, data);
      return res.status(201).json(file);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create file" });
    }
  });

  app.patch("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ message: "Content must be a string" });
    }
    const file = await storage.updateFileContent(req.params.id, content);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    return res.json(file);
  });

  app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const deleted = await storage.deleteFile(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "File not found" });
    }
    return res.json({ message: "File deleted" });
  });

  // --- RUNS ---
  app.post("/api/projects/:projectId/run", requireAuth, runLimiter, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    const run = await storage.createRun(req.session.userId!, {
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

    try {
      const result = await executeCode(code, language, (message, type) => {
        broadcastToProject(project.id, {
          type: "run_log",
          runId: run.id,
          message,
          logType: type,
          timestamp: Date.now(),
        });
      });

      await storage.updateRun(run.id, {
        status: result.exitCode === 0 ? "completed" : "failed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        finishedAt: new Date(),
      });

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        status: result.exitCode === 0 ? "completed" : "failed",
        exitCode: result.exitCode,
      });
    } catch (error: any) {
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
    }
  });

  app.get("/api/projects/:projectId/runs", requireAuth, async (req: Request, res: Response) => {
    const runList = await storage.getRunsByProject(req.params.projectId);
    return res.json(runList);
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
    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    try {
      const result = await executeCode(code, language);
      return res.json({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Execution failed" });
    }
  });

  // --- WebSocket ---
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      ws.close(1008, "projectId required");
      return;
    }

    if (!wsClients.has(projectId)) {
      wsClients.set(projectId, new Set());
    }
    wsClients.get(projectId)!.add(ws);

    log(`WebSocket connected for project ${projectId}`, "ws");

    ws.on("close", () => {
      wsClients.get(projectId)?.delete(ws);
      if (wsClients.get(projectId)?.size === 0) {
        wsClients.delete(projectId);
      }
    });

    ws.on("error", () => {
      wsClients.get(projectId)?.delete(ws);
    });
  });

  await storage.seedDemoProject();
  log("Demo project seeded", "seed");

  return httpServer;
}
