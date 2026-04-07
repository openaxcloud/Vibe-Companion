import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import path from "path";
import { storage } from "./storage";
import { incrementRequests, incrementErrors, recordResponseTime } from "./metricsCollector";
import { MainRouter } from "./routes/index";

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId || (req as any).user) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

function qstr(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return String(val[0] ?? '');
  return '';
}

const wsClients = new Map<string, Set<WebSocket>>();
const wsUserClients = new Map<string, Set<WebSocket>>();
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

function broadcastToUser(userId: string, data: any) {
  const clients = wsUserClients.get(userId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

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
  const { mkdir } = await import("fs/promises");
  const persistentStorageDir = path.join(process.cwd(), ".storage", "objects");
  const persistentStorageTmp = path.join(process.cwd(), ".storage", "tmp");
  const feedbackUploadsDir = path.join(process.cwd(), "uploads", "feedback");
  await mkdir(persistentStorageDir, { recursive: true });
  await mkdir(persistentStorageTmp, { recursive: true });
  await mkdir(feedbackUploadsDir, { recursive: true });

  app.post("/api/client-error", (req: Request, res: Response) => {
    console.error('[CLIENT ERROR]', JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  });

  interface LogEntry { type: string; message: string; timestamp: number; level?: string; service?: string; content?: string }
  const consoleRuntimeLogClients = new Set<WebSocket>();
  const consoleServerLogClients = new Set<WebSocket>();
  const consoleRuntimeLogBuffer: LogEntry[] = [];
  const consoleServerLogBuffer: LogEntry[] = [];
  const CONSOLE_MAX_LOG_BUFFER = 500;

  function broadcastConsoleRuntimeLog(entry: LogEntry) {
    consoleRuntimeLogBuffer.push(entry);
    if (consoleRuntimeLogBuffer.length > CONSOLE_MAX_LOG_BUFFER) consoleRuntimeLogBuffer.shift();
    const msg = JSON.stringify({ type: "log", log: entry });
    consoleRuntimeLogClients.forEach(ws => { try { if (ws.readyState === WebSocket.OPEN) ws.send(msg); } catch (err: any) { console.error("[catch]", err?.message || err); } });
  }

  function broadcastConsoleServerLog(entry: LogEntry) {
    consoleServerLogBuffer.push(entry);
    if (consoleServerLogBuffer.length > CONSOLE_MAX_LOG_BUFFER) consoleServerLogBuffer.shift();
    const msg = JSON.stringify({ type: "log", log: entry });
    consoleServerLogClients.forEach(ws => { try { if (ws.readyState === WebSocket.OPEN) ws.send(msg); } catch (err: any) { console.error("[catch]", err?.message || err); } });
  }

  const origConsoleLog = console.log;
  const origConsoleError = console.error;
  const origConsoleWarn = console.warn;
  const fmtArgs = (args: any[]) => args.map((a: any) => {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch (err: any) { return String(a); }
  }).join(" ");
  console.log = (...args: any[]) => {
    origConsoleLog.apply(console, args);
    const msg = fmtArgs(args);
    broadcastConsoleServerLog({ type: "stdout", message: msg, content: msg, timestamp: Date.now(), level: "info", service: "server" });
  };
  console.error = (...args: any[]) => {
    origConsoleError.apply(console, args);
    const msg = fmtArgs(args);
    broadcastConsoleServerLog({ type: "stderr", message: msg, content: msg, timestamp: Date.now(), level: "error", service: "server" });
  };
  console.warn = (...args: any[]) => {
    origConsoleWarn.apply(console, args);
    const msg = fmtArgs(args);
    broadcastConsoleServerLog({ type: "stdout", message: msg, content: msg, timestamp: Date.now(), level: "warn", service: "server" });
  };

  const consoleLogWss = new WebSocketServer({ noServer: true });
  consoleLogWss.on("connection", (ws: WebSocket, _req: any, pathname: string) => {
    const isRuntime = pathname === "/api/runtime/logs/ws";
    const clients = isRuntime ? consoleRuntimeLogClients : consoleServerLogClients;
    const buffer = isRuntime ? consoleRuntimeLogBuffer : consoleServerLogBuffer;
    clients.add(ws);
    try { ws.send(JSON.stringify({ type: "connected", message: "Connected to log stream", timestamp: Date.now() })); } catch (err: any) { console.error("[catch]", err?.message || err); }
    if (buffer.length > 0) {
      try { ws.send(JSON.stringify({ type: "initial", logs: buffer.slice(-100) })); } catch (err: any) { console.error("[catch]", err?.message || err); }
    }
    ws.on("message", (raw: any) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "ping") { ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() })); }
      } catch (err: any) {
        console.error("[ws/console-log] Message handler error:", err?.message || err);
      }
    });
    ws.on("close", () => { clients.delete(ws); });
    ws.on("error", (err) => { console.error("[ws/console-log] Connection error:", err?.message || err); clients.delete(ws); });
  });

  const previewWss = new WebSocketServer({ noServer: true });
  const previewClients = new Map<string, { ws: WebSocket; projectId?: string }>();
  previewWss.on("connection", (ws: WebSocket) => {
    const cid = crypto.randomUUID();
    previewClients.set(cid, { ws });
    ws.on("message", (raw: any) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "subscribe" && data.projectId) {
          const c = previewClients.get(cid);
          if (c) c.projectId = String(data.projectId);
          ws.send(JSON.stringify({ type: "preview:status", projectId: data.projectId, status: "idle", logs: [] }));
        }
        if (data.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch (err: any) {
        console.error("[ws/preview] Message handler error:", err?.message || err);
      }
    });
    ws.on("close", () => previewClients.delete(cid));
    ws.on("error", (err) => { console.error("[ws/preview] Connection error:", err?.message || err); previewClients.delete(cid); });
  });

  const PgStore = connectPgSimple(session);
  const sessionMiddleware = session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "session",
      pruneSessionInterval: 60 * 15,
    }),
    secret: (() => {
      const s = process.env.SESSION_SECRET;
      if (!s && process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET is required in production");
      }
      return s || crypto.randomBytes(32).toString("hex");
    })(),
    resave: false,
    saveUninitialized: false,
    name: "ecode.sid",
    proxy: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || !!process.env.REPL_ID,
      sameSite: (process.env.NODE_ENV === "production" || !!process.env.REPL_ID) ? "none" as const : "lax" as const,
    },
  });

  httpServer.prependListener("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/runtime/logs/ws" || url.pathname === "/api/server/logs/ws") {
      (request as any).__consoleLogsHandled = true;
      sessionMiddleware(request, {} as any, () => {
        if (!request.session?.userId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        consoleLogWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          consoleLogWss.emit("connection", ws, request, url.pathname);
        });
      });
    } else if (url.pathname === "/ws/preview") {
      (request as any).__consoleLogsHandled = true;
      sessionMiddleware(request, {} as any, () => {
        if (!request.session?.userId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        previewWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          previewWss.emit("connection", ws, request);
        });
      });
    }
  });

  broadcastConsoleServerLog({
    type: "stdout",
    message: "E-Code IDE server started successfully",
    content: "E-Code IDE server started successfully",
    timestamp: Date.now(),
    level: "info",
    service: "system"
  });

  import("./workflowExecutor").then(({ setBroadcastFn }) => {
    setBroadcastFn(broadcastToProject);
  }).catch((err: any) => { console.error("[catch]", err?.message || err); });

  import("./deploymentEngine").then(({ setProcessBroadcastFn }) => {
    setProcessBroadcastFn(broadcastToProject);
  }).catch((err: any) => { console.error("[catch]", err?.message || err); });

  app.use(compression());

  app.use((req, res, next) => {
    incrementRequests();
    const start = Date.now();
    res.on("finish", () => {
      recordResponseTime(Date.now() - start);
      if (res.statusCode >= 400) incrementErrors();
    });
    next();
  });

  const mainRouter = new MainRouter(storage);
  await mainRouter.registerRoutes(app);

  const mainWss = new WebSocketServer({ noServer: true });
  mainWss.on("connection", (ws: WebSocket, req: any) => {
    const projectId = req.__projectId;
    if (!projectId) { ws.close(); return; }
    if (!wsClients.has(projectId)) wsClients.set(projectId, new Set());
    wsClients.get(projectId)!.add(ws);

    const userId = req.session?.userId;
    if (userId) {
      if (!wsUserClients.has(userId)) wsUserClients.set(userId, new Set());
      wsUserClients.get(userId)!.add(ws);
    }

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
    if (!wsConnectionsByIp.has(ip)) wsConnectionsByIp.set(ip, new Set());
    wsConnectionsByIp.get(ip)!.add(ws);

    const recent = recentBroadcasts.get(projectId);
    if (recent && recent.length > 0) {
      const cutoff = Date.now() - 60000;
      const recentMsgs = recent.filter(b => b.timestamp > cutoff);
      for (const b of recentMsgs) {
        try { ws.send(JSON.stringify(b.data)); } catch (err: any) { console.error("[catch]", err?.message || err); }
      }
    }

    ws.on("message", (raw: any) => {
      if (!checkWsMessageRate(ws)) return;
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch (err: any) {
        console.error("[ws/main] Message handler error:", err?.message || err);
      }
    });

    ws.on("close", () => {
      wsClients.get(projectId)?.delete(ws);
      if (wsClients.get(projectId)?.size === 0) wsClients.delete(projectId);
      if (userId) {
        wsUserClients.get(userId)?.delete(ws);
        if (wsUserClients.get(userId)?.size === 0) wsUserClients.delete(userId);
      }
      wsConnectionsByIp.get(ip)?.delete(ws);
      if (wsConnectionsByIp.get(ip)?.size === 0) wsConnectionsByIp.delete(ip);
    });

    ws.on("error", (err) => {
      console.error("[ws/main] Connection error:", err?.message || err);
      wsClients.get(projectId)?.delete(ws);
    });
  });

  httpServer.on("upgrade", (request: any, socket: any, head: any) => {
    if ((request as any).__consoleLogsHandled) return;
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/ws") {
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      const ip = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket?.remoteAddress || "unknown";
      const ipConns = wsConnectionsByIp.get(ip);
      if (ipConns && ipConns.size >= WS_MAX_CONNECTIONS_PER_IP) {
        socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
        socket.destroy();
        return;
      }
      sessionMiddleware(request, {} as any, () => {
        request.__projectId = projectId;
        mainWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          mainWss.emit("connection", ws, request);
        });
      });
    }
  });

  app.get("/uploads/feedback/:projectId/:filename", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
    const { projectId, filename } = req.params;
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (/[\/\\]|\.\./.test(filename)) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    const filepath = path.join(feedbackUploadsDir, projectId, filename);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(filepath);
  });

  // Simple preview route for HTML/CSS/JS projects
  app.get('/preview/:projectId/{*filepath}', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const filepath = (req.params as any).filepath || 'index.html';
      
      // Get all project files
      const files = await storage.getFilesByProject(projectId);
      
      // Find the requested file
      const file = files.find(f => f.name === filepath && !f.isFolder);
      
      if (!file) {
        // Try to find index.html as default
        const indexFile = files.find(f => f.name === 'index.html' && !f.isFolder);
        if (indexFile) {
          res.type('html').send(indexFile.content || '');
          return;
        }
        return res.status(404).send('File not found');
      }
      
      // Set appropriate content type
      const ext = path.extname(filepath).toLowerCase();
      switch (ext) {
        case '.html':
          res.type('text/html');
          break;
        case '.css':
          res.type('text/css');
          break;
        case '.js':
          res.type('application/javascript');
          break;
        default:
          res.type('text/plain');
      }
      
      res.send(file.content || '');
    } catch (error) {
      console.error('Error serving preview:', error);
      res.status(500).send('Error loading preview');
    }
  });
  
  // Secrets Routes
  app.get('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userSecrets = await storage.getSecretsByUser(userId);
      
      // Don't send the actual values for security
      const sanitizedSecrets = userSecrets.map(secret => ({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      }));
      
      res.json(sanitizedSecrets);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      res.status(500).json({ error: 'Failed to fetch secrets' });
    }
  });
  
  app.post('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { key, value, description, projectId } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      // Validate key format (uppercase, underscores only)
      if (!/^[A-Z_]+$/.test(key)) {
        return res.status(400).json({ error: 'Key must contain only uppercase letters and underscores' });
      }
      
      const secret = await storage.createSecret({
        userId,
        key,
        value,
        description,
        projectId
      });
      
      // Return without the value for security
      res.json({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      });
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        return res.status(409).json({ error: 'A secret with this key already exists' });
      }
      console.error('Error creating secret:', error);
      res.status(500).json({ error: 'Failed to create secret' });
    }
  });
  
  app.put('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      const { value, description } = req.body;
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      const updated = await storage.updateSecret(secretId, {
        value,
        description
      });
      
      // Return without the value for security
      res.json({
        id: updated.id,
        key: updated.key,
        description: updated.description,
        projectId: updated.projectId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      });
    } catch (error) {
      console.error('Error updating secret:', error);
      res.status(500).json({ error: 'Failed to update secret' });
    }
  });
  
  app.delete('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      await storage.deleteSecret(secretId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting secret:', error);
      res.status(500).json({ error: 'Failed to delete secret' });
    }
  });
  
  // Get secret value (for server-side use only)
  app.get('/api/secrets/:id/value', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      res.json({ value: secret.value });
    } catch (error) {
      console.error('Error fetching secret value:', error);
      res.status(500).json({ error: 'Failed to fetch secret value' });
    }
  });

  // Serve project static files for preview
  app.get("/api/preview/:projectId/", async (req: Request, res: Response) => {
    return serveProjectFile(req, res, req.params.projectId, "index.html");
  });
  app.get("/api/preview/:projectId/{*filePath}", async (req: Request, res: Response) => {
    const filePath = (req.params as any).filePath || "index.html";
    return serveProjectFile(req, res, req.params.projectId, filePath);
  });

  async function serveProjectFile(req: Request, res: Response, projectId: string, filePath: string) {
    try {
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).send("Project not found");
      if (project.visibility === "private") {
        const sessionUserId = req.session?.userId;
        if (!sessionUserId) {
          return res.status(403).send("Access denied: this project is private");
        }
        if (sessionUserId !== project.userId) {
          const isGuest = await storage.isProjectGuest(project.id, sessionUserId);
          if (!isGuest) {
            if (project.teamId) {
              const teams = await storage.getUserTeams(sessionUserId);
              if (!teams.some(t => t.id === project.teamId)) {
                return res.status(403).send("Access denied: this project is private");
              }
            } else {
              return res.status(403).send("Access denied: this project is private");
            }
          }
        }
      }
      const files = await storage.getFilesByProject(projectId);
      const targetFile = files.find(f => f.filename === filePath || f.filename === `/${filePath}`);
      if (!targetFile || !targetFile.content) {
        const indexFile = files.find(f => f.filename === "index.html");
        if (indexFile && indexFile.content) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(indexFile.content);
        }
        return res.status(404).send("File not found");
      }
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const mimeTypes: Record<string, string> = {
        html: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "application/javascript; charset=utf-8",
        json: "application/json; charset=utf-8",
        png: "image/png",
        jpg: "image/jpeg",
        svg: "image/svg+xml",
      };
      const contentType = mimeTypes[ext] || "text/plain; charset=utf-8";
      res.setHeader("Content-Type", contentType);
      return res.send(targetFile.content);
    } catch (err: any) {
      console.error("[preview] Error serving file:", err.message);
      return res.status(500).send("Internal error");
    }
  }

  return httpServer;
}
