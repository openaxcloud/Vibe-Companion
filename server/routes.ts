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
import Anthropic from "@anthropic-ai/sdk";
import * as runnerClient from "./runnerClient";

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
      const file = await storage.updateFileContent(req.params.id, content);
      return res.json(file);
    }
    if (typeof filename === "string" && filename.trim()) {
      const file = await storage.renameFile(req.params.id, filename.trim());
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
    return res.json({ message: "File deleted" });
  });

  app.patch("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, language } = req.body;
    const updated = await storage.updateProject(req.params.id, { name, language });
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
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
      if (!path) return res.status(400).json({ message: "path required" });
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
      if (!path) return res.status(400).json({ message: "path required" });
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
      if (!path) return res.status(400).json({ message: "path required" });
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
      if (!path) return res.status(400).json({ message: "path required" });
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
      if (!oldPath || !newPath) return res.status(400).json({ message: "oldPath and newPath required" });
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

  app.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { messages, context } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }

      const systemPrompt = `You are an expert coding assistant embedded in an IDE. You help users write, debug, and improve code. Be concise and provide working code snippets. ${context ? `\n\nCurrent context:\nLanguage: ${context.language}\nFilename: ${context.filename}\nCode:\n\`\`\`\n${context.code}\n\`\`\`` : ""}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        max_tokens: 4096,
      });

      stream.on("text", (text) => {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      await stream.finalMessage();

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

  // --- WebSocket ---
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

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
