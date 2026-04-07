import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import session from "express-session";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

const conversationMessages = new Map<string, Array<{id: number, conversationId: number, role: string, content: string, timestamp: string}>>();

const extractedFilesCache = new Map<string, string[]>();

function extractFilenameFromComment(code: string): string | null {
  const firstLine = code.trim().split('\n')[0];
  const patterns = [
    /(?:\/\/|#|\/\*|<!--)\s*(?:filename|file|path):\s*(\S+)/i,
    /(?:\/\/|#|\/\*|<!--)\s*(\S+\.\w{1,5})\s*(?:\*\/|-->)?$/i,
  ];
  for (const p of patterns) {
    const m = firstLine.match(p);
    if (m && m[1] && m[1].includes('.')) return m[1];
  }
  return null;
}

async function extractAndSaveCodeBlocks(content: string, projectId: string | number | undefined, storageRef?: any) {
  if (!content || !projectId) return [];
  const projDir = path.join(process.cwd(), 'projects', String(projectId));
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  const extMap: Record<string, string> = {
    javascript: 'js', typescript: 'ts', python: 'py', html: 'html',
    css: 'css', json: 'json', jsx: 'jsx', tsx: 'tsx', sql: 'sql',
    bash: 'sh', shell: 'sh', yaml: 'yaml', yml: 'yml', xml: 'xml',
    java: 'java', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs',
    ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt',
    markdown: 'md', md: 'md', scss: 'scss', sass: 'sass', less: 'less',
  };
  let fileIndex = 0;
  const savedFiles: Array<{filename: string; language: string}> = [];
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    const code = match[2];
    if (!code || code.trim().length < 5) continue;
    const ext = extMap[lang] || lang || 'txt';
    let filename = extractFilenameFromComment(code);
    if (!filename) {
      filename = `file${fileIndex > 0 ? fileIndex : ''}.${ext}`;
      if (ext === 'html') filename = fileIndex === 0 ? 'index.html' : `page${fileIndex}.html`;
      else if (ext === 'js') filename = fileIndex === 0 ? 'index.js' : `script${fileIndex}.js`;
      else if (ext === 'ts') filename = fileIndex === 0 ? 'index.ts' : `module${fileIndex}.ts`;
      else if (ext === 'py') filename = fileIndex === 0 ? 'main.py' : `script${fileIndex}.py`;
      else if (ext === 'css') filename = fileIndex === 0 ? 'styles.css' : `styles${fileIndex}.css`;
      else if (ext === 'json') filename = fileIndex === 0 ? 'package.json' : `config${fileIndex}.json`;
    }
    const trimmedCode = code.trim();
    try {
      fs.mkdirSync(projDir, { recursive: true });
      const filePath = filename.includes('/') ? path.join(projDir, ...filename.split('/')) : path.join(projDir, filename);
      const fileDir = path.dirname(filePath);
      if (fileDir !== projDir) fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, trimmedCode, 'utf-8');
      console.log(`[File] Saved ${filename} to projects/${projectId}/`);
      savedFiles.push({ filename, language: lang || ext });
    } catch (e: any) {
      console.error(`[File] Failed to save ${filename}:`, e.message);
    }
    if (storageRef) {
      try {
        const existing = await storageRef.getFileByPath(projectId, filename);
        if (existing) {
          await storageRef.updateFile(existing.id, { content: trimmedCode });
        } else {
          await storageRef.createFile({ projectId: String(projectId), filename, content: trimmedCode });
        }
      } catch (e: any) {
        console.error(`[File] DB save failed for ${filename}:`, e.message);
      }
    }
    fileIndex++;
  }
  extractedFilesCache.set(String(projectId), savedFiles.map(f => f.filename));
  return savedFiles;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error?.message || error);
  console.error(error?.stack || "");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[ERROR] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

function validateEnvironment() {
  const required: Record<string, string> = {
    DATABASE_URL: "PostgreSQL connection string",
  };
  const missing: string[] = [];
  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`  - ${key}: ${description}`);
    }
  }
  if (missing.length > 0) {
    console.error("\n[FATAL] Missing required environment variables:\n" + missing.join("\n"));
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn("[WARN] SESSION_SECRET not set, using random value (sessions won't persist across restarts)");
  }
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    console.warn("[WARN] ENCRYPTION_KEY not set, using random value");
  }
}

validateEnvironment();

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DOMAINS || process.env.REPL_SLUG);
const isDev = process.env.NODE_ENV !== "production";
log(`Environment: isReplit=${isReplit}, isDev=${isDev}, REPL_ID=${!!process.env.REPL_ID}`);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" as const },
    frameguard: false,
    hsts: false,
  })
);

app.use((_req, res, next) => {
  res.removeHeader("X-Frame-Options");
  next();
});

const allowedOrigins = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(",").map(d => `https://${d.trim()}`)
  : undefined;

app.use(cors({
  origin: isReplit ? (allowedOrigins || true) : (process.env.NODE_ENV === "production" ? false : true),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
}));

import connectPgSimple from "connect-pg-simple";
const PgSession = connectPgSimple(session);
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required — sessions require PostgreSQL");
}
const sessionStore = new PgSession({
  conString: process.env.DATABASE_URL,
  tableName: "session",
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15,
  errorLog: (err: Error) => console.error("[PgSessionStore]", err.message),
});
console.log("[Session Store] Using PostgreSQL (persistent)");
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: "ecode.sid",
    proxy: true,
    cookie: {
      secure: process.env.NODE_ENV === "production" || !!process.env.REPL_ID,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" || !!process.env.REPL_ID ? "none" as const : "lax" as const,
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    version: process.env.npm_package_version || "1.0.0",
  });
});

app.get("/api/ready", async (_req, res) => {
  try {
    const { storage } = await import("./storage");
    await storage.getUser("0").catch(() => null);
    res.status(200).json({ ready: true });
  } catch (err: any) { console.error("[catch]", err?.message || err);
    res.status(503).json({ ready: false, reason: "Database unavailable" });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/slack/events/") || req.path === "/api/stripe/webhook" || req.path.startsWith("/deployed/")) {
    return next();
  }
  express.json({
    limit: "50mb",
    verify: (r: any, _res, buf) => {
      r.rawBody = buf;
    },
  })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/slack/events/") || req.path === "/api/stripe/webhook" || req.path.startsWith("/deployed/")) {
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
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const httpServer = createServer(app);
  const server = await registerRoutes(httpServer, app);

    const { storage } = await import("./storage");

    async function getSessionUser(req: Request): Promise<any | null> {
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const { password: _, ...safeUser } = user;
          return safeUser;
        }
      }
      return null;
    }

    app.get("/api/csrf-token", (req, res) => {
      const token = crypto.randomBytes(32).toString("hex");
      req.session.csrfToken = token;
      res.setHeader("X-CSRF-Token", token);
      res.json({ csrfToken: token });
    });

    app.get("/api/me", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json(user);
    });

    app.get("/api/auth/me", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json(user);
    });

    app.get("/api/auth/session", async (req, res) => {
      const user = await getSessionUser(req);
      res.json({ authenticated: !!user, user: user || null });
    });

    app.post("/api/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password required" });
        const user = await storage.getUserByEmail(email);
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: "Invalid credentials" });
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });
        req.session.userId = user.id;
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
        const { password: _, ...safeUser } = user;
        res.json({ ...safeUser, csrfToken: req.session.csrfToken });
      } catch (e: any) {
        console.error("[auth/fallback] Login error:", e?.message || e);
        res.status(500).json({ message: "Login failed" });
      }
    });

    app.post("/api/login", (req, res) => res.redirect(307, "/api/auth/login"));

    app.post("/api/auth/register", async (req, res) => {
      try {
        const { email, password, username, displayName, name } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password required" });
        const existing = await storage.getUserByEmail(email);
        if (existing) return res.status(409).json({ message: "Email already registered" });
        const bcrypt = await import("bcryptjs");
        const hashed = await bcrypt.hash(password, 10);
        const user = await storage.createUser({
          email, password: hashed, username: username || email.split("@")[0], name: name || displayName || "",
        });
        req.session.userId = user.id;
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
      } catch (e: any) {
        console.error("[auth/fallback] Register error:", e?.message || e);
        res.status(500).json({ message: "Registration failed" });
      }
    });

    app.post("/api/register", (req, res) => res.redirect(307, "/api/auth/register"));

    app.post("/api/auth/logout", (req, res) => {
      req.session.destroy(() => {
        res.clearCookie("ecode.sid");
        res.json({ success: true });
      });
    });

    app.post("/api/logout", (req, res) => {
      req.session.destroy(() => {
        res.clearCookie("ecode.sid");
        res.json({ success: true });
      });
    });

    app.get("/api/projects", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.json({ projects: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } });
      try {
        const projects = await storage.getProjectsByUserId(user.id);
        res.json(projects);
      } catch (e: any) {
        res.json({ projects: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } });
      }
    });

    app.get("/api/projects/:id", async (req, res) => {
      try {
        const project = await storage.getProject(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });
        res.json(project);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });


    app.post("/api/projects", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      try {
        const project = await storage.createProject({ ...req.body, userId: user.id });
        res.json(project);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });

    app.put("/api/projects/:id/files/:fileId", async (req, res) => {
      try {
        const file = await storage.updateFile(req.params.fileId, req.body);
        res.json(file);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });

    app.post("/api/projects/:id/files", async (req, res) => {
      try {
        const body = req.body;
        const filename = body.filename || body.name || (body.path ? body.path.split("/").pop() : null);
        if (!filename) return res.status(400).json({ message: "filename, name, or path is required" });
        const file = await storage.createFile({
          projectId: req.params.id,
          filename,
          content: body.content ?? "",
          isBinary: body.isBinary ?? false,
          mimeType: body.mimeType ?? null,
          artifactId: body.artifactId ?? null,
        });
        res.json(file);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });

    app.post("/api/projects/:id/files/content", async (req, res) => {
      try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ message: "filename is required" });
        const file = await storage.getFileByPath(req.params.id, filename);
        if (!file) return res.status(404).json({ message: "File not found" });
        res.json({ ...file, path: file.filename });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });

    app.delete("/api/projects/:id/files/:fileId", async (req, res) => {
      try {
        await storage.deleteFile(req.params.fileId);
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    });

    app.get("/api/projects/:id/poll", (_req, res) => {
      res.json({ status: "idle", events: [] });
    });

    app.get("/api/projects/:id/git/diff", (_req, res) => {
      res.json({ branch: "main", changes: [], hasCommits: false });
    });

    app.get("/api/projects/:id/git/merge-status", (_req, res) => {
      res.json({ status: "none" });
    });

    app.get("/api/workspaces/:id/status", (_req, res) => {
      res.json({ status: "ready", projectId: _req.params.id });
    });

    app.get("/api/templates", async (_req, res) => {
      try {
        const templates = await storage.getTemplates?.() || [];
        res.json(templates);
      } catch (err: any) { console.error("[catch]", err?.message || err);
        res.json([]);
      }
    });

    app.post("/api/logs/ingest", (_req, res) => {
      res.json({ success: true });
    });

    app.post("/api/monitoring/performance", (_req, res) => {
      res.json({ success: true });
    });

    app.post("/api/monitoring/performance-budget", (_req, res) => {
      res.json({ success: true });
    });

    app.get("/api/monitoring/health", (_req, res) => {
      res.json({ status: "healthy" });
    });

    app.get("/api/user/preferences", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json({ theme: "dark", fontSize: 14, tabSize: 2 });
    });

    app.get("/api/notifications", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json([]);
    });

    app.get("/api/admin/stats", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json({ totalUsers: 1, totalProjects: 80, activeUsers: 1 });
    });

    app.get("/api/marketplace/templates", async (_req, res) => {
      try {
        const templates = await storage.getTemplates?.() || [];
        res.json(templates);
      } catch (err: any) { console.error("[catch]", err?.message || err);
        res.json([]);
      }
    });

    app.get("/api/agent/conversation/:projectId", (req, res) => {
      res.json({ conversationId: null, projectId: req.params.projectId, messages: [], agentMode: "build", status: "ready" });
    });

    app.get("/api/preview/url", async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        if (!projectId) return res.json({ previewUrl: null, status: "no_runnable_files" });
        const projDir = path.join(process.cwd(), 'projects', String(projectId));
        const diskIndex = path.join(projDir, 'index.html');
        if (fs.existsSync(diskIndex)) {
          return res.json({ previewUrl: `/api/preview/render/${projectId}`, status: "running" });
        }
        const files = await storage.getFilesByProjectId(projectId);
        const htmlFile = files.find((f: any) => f.filename?.endsWith(".html") || f.filename === "index.html");
        if (!htmlFile) return res.json({ previewUrl: null, status: "building" });
        return res.json({ previewUrl: `/api/preview/render/${projectId}`, status: "running" });
      } catch (e: any) {
        res.json({ previewUrl: null, status: "error" });
      }
    });

    app.get("/api/preview/render/:projectId", async (req, res) => {
      const projectId = req.params.projectId;
      const projDir = path.join(process.cwd(), 'projects', String(projectId));
      try {
        const diskIndex = path.join(projDir, 'index.html');
        if (fs.existsSync(diskIndex)) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          let html = fs.readFileSync(diskIndex, 'utf-8');
          const cssFiles = ['styles.css', 'style.css', 'main.css', 'app.css'];
          for (const cssName of cssFiles) {
            const cssPath = path.join(projDir, cssName);
            if (fs.existsSync(cssPath) && !html.includes(cssName)) {
              const cssTag = `<link rel="stylesheet" href="/api/preview/file/${projectId}/${cssName}">`;
              if (html.includes('</head>')) {
                html = html.replace('</head>', `${cssTag}\n</head>`);
              } else if (html.includes('<body')) {
                html = html.replace(/<body([^>]*)>/, `<head>${cssTag}</head>\n<body$1>`);
              } else {
                html = cssTag + '\n' + html;
              }
            }
          }
          const jsFiles = ['index.js', 'script.js', 'app.js', 'main.js'];
          for (const jsName of jsFiles) {
            const jsPath = path.join(projDir, jsName);
            if (fs.existsSync(jsPath) && !html.includes(jsName)) {
              const jsTag = `<script src="/api/preview/file/${projectId}/${jsName}"></script>`;
              if (html.includes('</body>')) {
                html = html.replace('</body>', `${jsTag}\n</body>`);
              } else if (html.includes('</html>')) {
                html = html.replace('</html>', `${jsTag}\n</html>`);
              } else {
                html = html + '\n' + jsTag;
              }
            }
          }
          return res.send(html);
        }
        const files = await storage.getFilesByProjectId(projectId);
        const htmlFile = files.find((f: any) => f.filename === "index.html" || f.filename?.endsWith(".html"));
        if (!htmlFile) return res.status(404).send("<h1>No preview available yet</h1><p>The agent is building your app. Once code is generated, the preview will appear here.</p>");
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(htmlFile.content || "<h1>Empty file</h1>");
      } catch (e: any) {
        res.status(500).send(`<h1>Error: ${e.message}</h1>`);
      }
    });

    app.use("/api/preview/file", (req, res, next) => {
      const urlPath = req.path;
      const parts = urlPath.split('/').filter(Boolean);
      if (parts.length < 2) return next();
      const projectId = parts[0];
      const filePath = parts.slice(1).join('/');
      const fullPath = path.resolve(process.cwd(), 'projects', projectId, filePath);
      const projDir = path.resolve(process.cwd(), 'projects', projectId);
      if (!fullPath.startsWith(projDir)) return res.status(403).send("Forbidden");
      if (!fs.existsSync(fullPath)) return res.status(404).send("File not found");
      const ext = path.extname(fullPath).slice(1);
      const mimeTypes: Record<string, string> = {
        js: 'application/javascript', ts: 'application/javascript',
        css: 'text/css', html: 'text/html', json: 'application/json',
        svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
        gif: 'image/gif', ico: 'image/x-icon', woff: 'font/woff',
        woff2: 'font/woff2', ttf: 'font/ttf',
      };
      res.setHeader("Content-Type", mimeTypes[ext] || "text/plain");
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(fullPath);
    });

    app.post("/api/workspace/bootstrap", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ success: false, error: "Authentication required" });
      try {
        const { prompt, buildMode, options } = req.body;
        if (!prompt?.trim()) return res.status(400).json({ success: false, error: "A project description is required" });
        const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
        const projectName = words.length > 40 ? words.slice(0, 40) : words || "My Project";
        const project = await storage.createProject({
          name: projectName,
          userId: user.id,
          language: options?.language || "typescript",
          projectType: "web-app",
          outputType: "web",
          visibility: "public",
        });
        const bootstrapToken = crypto.randomUUID();
        res.json({ success: true, projectId: project.id, bootstrapToken, status: "ready" });
      } catch (e: any) {
        console.error("[workspace/bootstrap fallback] Error:", e);
        res.status(500).json({ success: false, error: "Failed to create workspace. Please try again." });
      }
    });

    app.post("/api/agent/schema/warm", (_req, res) => {
      res.json({ success: true, warmed: true });
    });

    app.get("/api/models", (_req, res) => {
      const models: Array<{id: string; name: string; provider: string; description: string; maxTokens: number; supportsStreaming: boolean; costPer1kTokens: number; available: boolean}> = [];
      if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
        models.push(
          { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", description: "Latest Claude Sonnet — fast, intelligent, great for coding", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.003, available: true },
          { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic", description: "Fast and affordable for quick tasks", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.001, available: true },
        );
      }
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
        models.push(
          { id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "OpenAI's most capable model", maxTokens: 4096, supportsStreaming: true, costPer1kTokens: 0.005, available: true },
          { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", description: "Fast and affordable GPT-4 class model", maxTokens: 4096, supportsStreaming: true, costPer1kTokens: 0.00015, available: true },
        );
      }
      if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
        models.push(
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", description: "Google's fast multimodal model", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.00025, available: true },
          { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", description: "Google's most capable model", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.00125, available: true },
        );
      }
      res.json({ models });
    });

    app.get("/api/models/preferred", async (req, res) => {
      const user = await getSessionUser(req);
      res.json({
        preferredModel: "claude-sonnet-4-20250514",
        preferredProvider: "anthropic",
        availableModels: 6,
        userId: user?.id || null,
      });
    });

    app.put("/api/models/preferred", async (req, res) => {
      res.json({ success: true });
    });

    app.get("/api/agent/models", (_req, res) => {
      const providers: string[] = [];
      if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) providers.push("openai");
      if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) providers.push("gemini");
      res.json({
        providers,
        defaultModel: "claude-sonnet-4-20250514",
        defaultProvider: providers.includes("anthropic") ? "anthropic" : providers[0] || "none",
      });
    });

    app.put("/api/agent/preferences", async (_req, res) => {
      res.json({ success: true });
    });

    app.get("/api/runner/status", (_req, res) => {
      res.json({
        status: "ready",
        runtime: "node",
        version: process.version,
        uptime: process.uptime(),
      });
    });

    const activeExecutions = new Map<string, { pid?: number; startedAt: number; projectId: string }>();

    app.post("/api/runtime/start", (req, res) => {
      const execId = crypto.randomUUID();
      const projectId = req.body?.projectId || "default";
      activeExecutions.set(execId, { startedAt: Date.now(), projectId });
      broadcastRuntimeLog({ type: "system", message: `Runtime started (execution: ${execId.slice(0,8)})`, timestamp: Date.now() });
      broadcastServerLog({ type: "system", message: `Runtime started for project ${projectId}`, timestamp: Date.now(), level: "info", service: "runtime" });
      res.json({
        success: true,
        status: "running",
        message: "Runtime started",
        executionId: execId,
        port: 3000,
      });
    });

    app.post("/api/runtime/stop", (req, res) => {
      const execId = req.body?.executionId;
      if (execId && activeExecutions.has(execId)) {
        const exec = activeExecutions.get(execId)!;
        const duration = Date.now() - exec.startedAt;
        activeExecutions.delete(execId);
        broadcastRuntimeLog({ type: "exit", message: `Process exited (ran for ${(duration / 1000).toFixed(1)}s)`, timestamp: Date.now() });
      }
      res.json({ success: true, status: "stopped" });
    });

    app.get("/api/runtime/status", (_req, res) => {
      res.json({ status: activeExecutions.size > 0 ? "running" : "ready", runtime: "node", activeExecutions: activeExecutions.size });
    });

    app.get("/api/usage/current", async (req, res) => {
      const user = await getSessionUser(req);
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysRemaining = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      res.json({
        credits: {
          remaining: 1000,
          used: 0,
          total: 1000,
          percentUsed: 0,
        },
        currentPeriod: {
          startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          endDate: endOfMonth.toISOString(),
          daysRemaining,
        },
        breakdown: {
          agentMessages: 0,
          thinkingTokens: 0,
          highPowerUsage: 0,
          webSearches: 0,
        },
        tier: "free",
        userId: user?.id || null,
      });
    });

    app.get("/api/usage/history", (_req, res) => {
      res.json([]);
    });

    app.get("/api/usage/alerts", (_req, res) => {
      res.json([]);
    });

    app.get("/api/usage/budgets", (_req, res) => {
      res.json([]);
    });

    app.post("/api/usage/alerts", (_req, res) => {
      res.json({ success: true });
    });

    app.post("/api/usage/budgets", (_req, res) => {
      res.json({ success: true });
    });

    app.get("/api/storage/stats", (_req, res) => {
      res.json({
        totalSize: 5368709120,
        usedSize: 0,
        fileCount: 0,
        folderCount: 0,
        bandwidth: { used: 0, limit: 107374182400 },
      });
    });

    app.get("/api/storage/list", (_req, res) => {
      res.json({ files: [], folders: [] });
    });

    app.get("/api/autonomy/sessions", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      res.json([]);
    });

    app.post("/api/autonomy/sessions", async (req, res) => {
      res.json({ id: crypto.randomUUID(), status: "created" });
    });

    app.get("/api/integrations/status", (_req, res) => {
      res.json({
        github: { connected: false },
        vercel: { connected: false },
        netlify: { connected: false },
        supabase: { connected: false },
      });
    });

    app.get("/api/settings/ai", (_req, res) => {
      const providers = [];
      if (process.env.ANTHROPIC_API_KEY) providers.push({ id: "anthropic", name: "Anthropic", configured: true });
      if (process.env.OPENAI_API_KEY) providers.push({ id: "openai", name: "OpenAI", configured: true });
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) providers.push({ id: "gemini", name: "Google Gemini", configured: true });
      res.json({ providers, defaultProvider: providers[0]?.id || null });
    });

    app.get("/api/rag/stats", (_req, res) => {
      res.json({ indexed: 0, total: 0, status: "idle" });
    });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
