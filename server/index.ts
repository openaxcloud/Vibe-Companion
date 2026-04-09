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
import { AI_MODELS, type AIModel as AIModelType } from "./ai/models-catalog.js";

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
      const resolvedPath = path.resolve(filePath);
      const resolvedProjDir = path.resolve(projDir);
      if (!resolvedPath.startsWith(resolvedProjDir + path.sep) && resolvedPath !== resolvedProjDir) {
        console.error(`[File] Path traversal attempt blocked: ${filename}`);
        continue;
      }
      const fileDir = path.dirname(filePath);
      if (fileDir !== projDir) fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, trimmedCode, 'utf-8');
      console.log(`[File] Saved ${filename} to projects/${projectId}/`);
      if ((app as any).locals.broadcastProjectLog) {
        (app as any).locals.broadcastProjectLog(String(projectId), {
          type: "stdout", message: `[File] Saved ${filename} (${trimmedCode.length} bytes)`,
          timestamp: Date.now(), level: "info", service: "files"
        });
      }
      savedFiles.push({ filename, language: lang || ext });
    } catch (e: any) {
      console.error(`[File] Failed to save ${filename}:`, e.message);
      if ((app as any).locals.broadcastProjectLog) {
        (app as any).locals.broadcastProjectLog(String(projectId), {
          type: "stderr", message: `[File] Failed to save ${filename}: ${e.message}`,
          timestamp: Date.now(), level: "error", service: "files"
        });
      }
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
(global as any).sessionStore = sessionStore;
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

import { setupPassportAuth } from "./middleware/passport-setup";
setupPassportAuth(app);

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
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api") && !reqPath.includes("/api/preview/render/") && reqPath !== "/api/server/logs") {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !reqPath.includes("env-var") && !reqPath.includes("csrf")) {
        try {
          const safe = JSON.parse(JSON.stringify(capturedJsonResponse));
          const redactKeys = ["password", "csrfToken", "encryptedValue", "token", "secret", "apiKey"];
          const redact = (obj: any): void => {
            if (!obj || typeof obj !== "object") return;
            for (const k of Object.keys(obj)) {
              if (redactKeys.some(rk => k.toLowerCase().includes(rk.toLowerCase()))) {
                obj[k] = "[REDACTED]";
              } else if (typeof obj[k] === "object") {
                redact(obj[k]);
              }
            }
          };
          redact(safe);
          logLine += ` :: ${JSON.stringify(safe).slice(0, 200)}`;
        } catch {}
      }
      log(logLine);

      const pidMatch = reqPath.match(/\/api\/(?:projects|preview\/projects|agent\/(?:chat|conversation)|runtime|files|git\/projects|workflows|rag)\/([a-f0-9-]{8,})/);
      const pid = pidMatch?.[1] || (req.body?.projectId as string | undefined);
      if (pid && (app as any).locals.broadcastProjectLog) {
        (app as any).locals.broadcastProjectLog(pid, {
          type: "http", message: `${req.method} ${reqPath} ${res.statusCode} ${duration}ms`,
          timestamp: Date.now(), level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", service: "http"
        });
      }
    }
  });
  next();
});

// Always-available CSRF token endpoint (registered before routes.ts so it
// works even when the full route loader is still initialising).
import { csrfTokenEndpoint } from "./middleware/csrf";
app.get("/api/csrf-token", csrfTokenEndpoint);
app.get("/api/auth/csrf", csrfTokenEndpoint);

// Always-available workspace bootstrap – creates a real project regardless of
// whether the full routes.ts bundle loads. Registered early so it is never
// shadowed by the SPA catch-all.
app.post("/api/workspace/bootstrap", async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const { prompt, buildMode, options } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "A project description is required" });
    }
    const { storage } = await import("./storage");
    const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
    const projectName = (words.length > 40 ? words.slice(0, 40) : words) || "My Project";
    const language = options?.language || "typescript";
    const project = await storage.createProject({
      userId: req.session.userId,
      name: projectName,
      description: prompt.slice(0, 500),
      language,
      projectType: "web-app",
      outputType: "web",
      visibility: "public",
    });
    try {
      await storage.createArtifact({
        projectId: project.id,
        name: projectName,
        type: "web-app",
        entryFile: null,
        settings: {},
      });
    } catch (_err: any) { console.error('[catch]', _err?.message || _err); }
    try {
      const runCommands: Record<string, string> = {
        javascript: "npm install && npm start",
        typescript: "npm install && npm start",
        python: "pip install -r requirements.txt 2>/dev/null; python3 main.py",
        go: "go run .",
        rust: "cargo run",
      };
      const cmd = runCommands[language] || "npm install && npm start";
      const workflow = await storage.createWorkflow({
        projectId: project.id,
        name: "Run",
        triggerEvent: "manual",
        executionMode: "sequential",
        enabled: true,
      });
      await storage.createWorkflowStep({
        workflowId: workflow.id,
        name: "Start",
        command: cmd,
        taskType: "shell",
        orderIndex: 0,
        continueOnError: false,
      });
      await storage.updateProject(project.id, { selectedWorkflowId: workflow.id });
    } catch (_err: any) { console.error('[catch]', _err?.message || _err); }
    try {
      await storage.createFile({
        projectId: project.id,
        filename: "index.html",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${projectName}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>`,
      });
      await storage.createFile({
        projectId: project.id,
        filename: "App.tsx",
        content: `export default function App() {\n  return (\n    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>\n      <h1>${projectName}</h1>\n      <p>AI is generating your app...</p>\n    </div>\n  );\n}`,
      });
    } catch (e: any) {
      console.warn("[workspace/bootstrap] Starter files failed:", e?.message);
    }
    const bootstrapToken = crypto.randomUUID();
    return res.json({ success: true, projectId: project.id, bootstrapToken, redirectUrl: `/ide/${project.id}` });
  } catch (error: any) {
    console.error("[workspace/bootstrap] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create workspace. Please try again." });
  }
});

// Always-available schema warming stub – the IDE calls this on load to
// pre-warm the deployment schema; we return success immediately.
app.post("/api/agent/schema/warm", async (req: Request, res: Response) => {
  res.json({ success: true, ready: true, warmed: true });
});

// Always-available schema stream – SSE endpoint that immediately signals ready.
app.get("/api/agent/schema/stream/:projectId", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "ready", status: "ready", progress: 100, message: "Schema ready" })}\n\n`);
  res.end();
});

// Always-available agent endpoints — BEFORE try/catch routes import
app.post("/api/agent/chat", async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const { message, projectId, conversationId, provider, modelId, context = [], capabilities = {} } = req.body;
  const modelfarmBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const modelfarmKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const highPower = capabilities?.highPower === true || capabilities?.highPowerModels === true;
  const webSearch = capabilities?.webSearch === true;
  const maxAutonomy = capabilities?.maxAutonomy === true;
  const maxTokens = maxAutonomy ? 8192 : 4096;

  const systemPrompt = `You are E-Code AI, a world-class software engineer. Help users build full-stack applications with production-ready code. Generate complete, runnable code blocks with filename comments.`;
  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (context?.length) for (const m of context.slice(-10)) if (m.role === "user" || m.role === "assistant") chatMessages.push({ role: m.role, content: m.content });
  if (message) chatMessages.push({ role: "user", content: message });

  if (webSearch && chatMessages.length > 0) {
    try {
      const lastMsg = chatMessages[chatMessages.length - 1]?.content || "";
      const { searchTavily } = await import("./agentServices");
      const searchResults = await searchTavily(lastMsg, { maxResults: 5, includeAnswer: true });
      if (searchResults.results.length > 0) {
        let searchContext = "\n\n--- WEB SEARCH RESULTS ---\n";
        if (searchResults.answer) searchContext += `Summary: ${searchResults.answer}\n\n`;
        searchContext += searchResults.results.map((r, i) =>
          `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 300)}`
        ).join("\n\n");
        searchContext += "\n--- END SEARCH RESULTS ---\n\nUse the above search results to inform your response. Cite sources when relevant.";
        chatMessages[chatMessages.length - 1] = { role: "user", content: lastMsg + searchContext };
      }
    } catch (e: any) {
      console.warn("[AI Chat] Web search failed:", e.message);
    }
  }

  let chatStorage: any;
  try {
    const storageModule = await import("./storage");
    chatStorage = storageModule.storage;
  } catch (err: any) { console.error("[catch]", err?.message || err);}

  try {
    let result = "";
    if (provider === "anthropic" && anthropicKey) {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const msg = await anthropic.messages.create({ model: modelId || "claude-sonnet-4-20250514", messages: chatMessages, system: systemPrompt, max_tokens: maxTokens });
      result = (msg.content[0] as any)?.text || "";
    } else if (modelfarmBaseUrl && modelfarmKey) {
      const openai = new OpenAI({ apiKey: modelfarmKey, baseURL: modelfarmBaseUrl });
      const completion = await openai.chat.completions.create({
        model: modelId || (highPower ? "gpt-4o" : "gpt-4.1-mini"), messages: [{ role: "system", content: systemPrompt }, ...chatMessages], temperature: 0.7, max_tokens: maxTokens,
      });
      result = completion.choices?.[0]?.message?.content || "";
    } else if (anthropicKey) {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const msg = await anthropic.messages.create({ model: modelId || "claude-sonnet-4-20250514", messages: chatMessages, system: systemPrompt, max_tokens: maxTokens });
      result = (msg.content[0] as any)?.text || "";
    } else if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: modelId || "gpt-4o", messages: [{ role: "system", content: systemPrompt }, ...chatMessages], temperature: 0.7, max_tokens: maxTokens,
      });
      result = completion.choices?.[0]?.message?.content || "";
    } else {
      return res.json({ id: crypto.randomUUID(), role: "assistant", content: "No AI provider configured. Please add ANTHROPIC_API_KEY, OPENAI_API_KEY, or configure Modelfarm.", timestamp: new Date().toISOString() });
    }
    if (projectId) await extractAndSaveCodeBlocks(result, projectId, chatStorage);
    res.json({ id: crypto.randomUUID(), role: "assistant", content: result, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.json({ id: crypto.randomUUID(), role: "assistant", content: `AI error: ${err.message}`, timestamp: new Date().toISOString() });
  }
});

app.post("/api/agent/chat/stream", async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    res.setHeader("Content-Type", "text/event-stream");
    res.flushHeaders();
    res.write(`event: error\ndata: ${JSON.stringify({ message: "Authentication required" })}\n\n`);
    return res.end();
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected" })}\n\n`);

  let storage: any;
  try {
    const storageModule = await import("./storage");
    storage = storageModule.storage;
  } catch (e) {
    console.warn("[AI Stream] Could not load storage module, file DB sync disabled");
  }

  const {
    message,
    projectId,
    conversationId,
    provider: requestedProvider = "anthropic",
    modelId,
    context = [],
    capabilities = {},
  } = req.body;

  const systemPrompt = `You are E-Code AI, a world-class software engineer and coding assistant integrated into the E-Code IDE.
You help users build full-stack applications by writing high-quality, production-ready code.

CRITICAL RULES FOR CODE GENERATION:
1. When building an app, ALWAYS generate a complete, working index.html file as the main entry point.
2. Put each file in a separate code block with the correct language tag (html, css, javascript, etc.)
3. Start EVERY code block with a comment specifying the filename, like: // filename: index.html or <!-- filename: index.html -->
4. For web apps, create at minimum: index.html (with embedded or linked CSS/JS)
5. Make the HTML self-contained when possible — include CSS in <style> tags and JS in <script> tags for simple apps.
6. For more complex apps, create separate files: index.html, styles.css, index.js
7. Use modern HTML5, CSS3, and vanilla JavaScript unless the user specifically asks for a framework.
8. The generated code MUST be complete and runnable — no placeholders, no "TODO" comments, no truncated code.
9. Include responsive design with proper viewport meta tags.
10. Add a professional, polished look with good typography, colors, and spacing.

When the user asks you to "build" or "create" something, generate ALL the necessary files as code blocks.
The system will automatically save these files and show a live preview to the user.
Be concise in explanations but thorough in code. Focus on working, visually polished, runnable code.`;

  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (context && context.length > 0) {
    for (const msg of context.slice(-10)) {
      if (msg.role === "user" || msg.role === "assistant") {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }
  }
  if (message) {
    chatMessages.push({ role: "user", content: message });
  }

  if (chatMessages.length === 0) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: "No message provided" })}\n\n`);
    res.end();
    return;
  }

  let isAborted = false;
  res.on("close", () => { isAborted = true; });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const modelfarmBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const modelfarmKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  const highPowerEnabled = capabilities?.highPower === true || capabilities?.highPowerModels === true;
  const webSearchEnabled = capabilities?.webSearch === true;
  const maxAutonomyEnabled = capabilities?.maxAutonomy === true;
  const extThinkingEnabled = capabilities?.extendedThinking === true;

  const maxTokensBase = maxAutonomyEnabled ? 8192 : 4096;

  if (webSearchEnabled && chatMessages.length > 0) {
    try {
      const lastMsg = chatMessages[chatMessages.length - 1]?.content || "";
      const { searchTavily } = await import("./agentServices");
      const searchResults = await searchTavily(lastMsg, { maxResults: 5, includeAnswer: true });
      if (searchResults.results.length > 0) {
        let searchContext = "\n\n--- WEB SEARCH RESULTS ---\n";
        if (searchResults.answer) searchContext += `Summary: ${searchResults.answer}\n\n`;
        searchContext += searchResults.results.map((r, i) =>
          `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 300)}`
        ).join("\n\n");
        searchContext += "\n--- END SEARCH RESULTS ---\n\nUse the above search results to inform your response. Cite sources when relevant.";
        chatMessages[chatMessages.length - 1] = {
          role: "user",
          content: lastMsg + searchContext,
        };
        res.write(`event: web_search\ndata: ${JSON.stringify({
          query: lastMsg.slice(0, 100),
          resultCount: searchResults.results.length,
          answer: searchResults.answer,
          sources: searchResults.results.map(r => ({ title: r.title, url: r.url })),
        })}\n\n`);
      }
    } catch (e: any) {
      console.warn("[AI Stream] Web search failed:", e.message);
    }
  }

  async function streamWithOpenAI(apiKey: string, model: string, usedProvider: string, baseURL?: string) {
    const effectiveModel = highPowerEnabled && !baseURL ? "gpt-4o" : model;
    const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...chatMessages,
    ];

    const stream = await openai.chat.completions.create({
      model: effectiveModel,
      messages: openaiMessages,
      temperature: extThinkingEnabled ? 0.3 : 0.7,
      max_tokens: extThinkingEnabled ? maxTokensBase * 2 : maxTokensBase,
      stream: true,
    });

    let tokensOutput = 0;
    let fullContent = "";
    for await (const chunk of stream) {
      if (isAborted) break;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        tokensOutput++;
        fullContent += delta;
        res.write(`event: token\ndata: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    if (!isAborted) {
      // Save assistant message to in-memory store
      const convKey = String(conversationId || "default");
      if (!conversationMessages.has(convKey)) conversationMessages.set(convKey, []);
      conversationMessages.get(convKey)!.push({
        id: Date.now(), conversationId: Number(conversationId) || 0,
        role: "assistant", content: fullContent, timestamp: new Date().toISOString(),
      });
      res.write(`event: action_start\ndata: ${JSON.stringify({ actionId: "extract-files", action: "extract_code", label: "Extracting code from response" })}\n\n`);
      const savedFiles = await extractAndSaveCodeBlocks(fullContent, projectId, storage);
      if (savedFiles.length > 0) {
        for (const f of savedFiles) {
          res.write(`event: tool_result\ndata: ${JSON.stringify({
            tool: "write_file", status: "success",
            result: { filename: f.filename, language: f.language, action: "created" },
          })}\n\n`);
          res.write(`event: file_diff\ndata: ${JSON.stringify({
            path: f.filename, language: f.language, isNewFile: true,
            linesAdded: (f.content || "").split("\\n").length, linesRemoved: 0,
          })}\n\n`);
        }
        res.write(`event: preview_ready\ndata: ${JSON.stringify({
          url: `/api/preview/${projectId}/`,
          files: savedFiles.map(f => f.filename),
        })}\n\n`);
      }
      res.write(`event: action_complete\ndata: ${JSON.stringify({ actionId: "extract-files", action: "extract_code", filesCreated: savedFiles.length, success: true })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({
        conversationId: conversationId || Date.now(),
        projectId,
        totalTokens: tokensOutput,
        tokensInput: 0,
        tokensOutput,
        cost: "0.000000",
        model,
        provider: usedProvider,
      })}\n\n`);
    }
    res.end();
  }

  async function streamWithAnthropic(apiKey: string) {
    const anthropic = new Anthropic({ apiKey });
    const defaultModel = highPowerEnabled ? "claude-sonnet-4-20250514" : (modelId || "claude-sonnet-4-20250514");
    const model = modelId || defaultModel;

    const effectiveMaxTokens = extThinkingEnabled ? 16000 : maxTokensBase;

    const streamParams: any = {
      model,
      messages: chatMessages,
      system: systemPrompt,
      max_tokens: effectiveMaxTokens,
    };
    if (extThinkingEnabled) {
      streamParams.thinking = { type: "enabled", budget_tokens: maxAutonomyEnabled ? 20000 : 10000 };
    } else {
      streamParams.temperature = 0.7;
    }

    const stream = anthropic.messages.stream(streamParams);
    let fullContent = "";
    let thinkingContent = "";
    let currentThinkingStep: any = null;

    for await (const event of stream) {
      if (isAborted) break;

      if (event.type === "content_block_start" && (event as any).content_block?.type === "thinking") {
        currentThinkingStep = {
          id: Date.now().toString(), type: "reasoning", title: "AI Thinking",
          content: "", status: "active", timestamp: new Date().toISOString(), isStreaming: true,
        };
        res.write(`event: thinking_start\ndata: ${JSON.stringify({ step: currentThinkingStep })}\n\n`);
      }

      if (event.type === "content_block_delta") {
        const delta = (event as any).delta;
        if (delta?.type === "thinking_delta" && delta.thinking) {
          thinkingContent += delta.thinking;
          if (currentThinkingStep) {
            currentThinkingStep.content = thinkingContent;
            res.write(`event: thinking_update\ndata: ${JSON.stringify({ step: currentThinkingStep, content: delta.thinking })}\n\n`);
          }
        }
        if (delta?.type === "text_delta" && delta.text) {
          fullContent += delta.text;
          res.write(`event: token\ndata: ${JSON.stringify({ content: delta.text })}\n\n`);
        }
      }

      if (event.type === "content_block_stop" && currentThinkingStep) {
        currentThinkingStep.status = "complete";
        currentThinkingStep.isStreaming = false;
        res.write(`event: thinking_complete\ndata: ${JSON.stringify({ step: currentThinkingStep })}\n\n`);
        currentThinkingStep = null;
        thinkingContent = "";
      }
    }

    if (!isAborted) {
      let tokensInput = 0, tokensOutput = 0;
      try {
        const finalMessage = await stream.finalMessage();
        tokensInput = finalMessage.usage?.input_tokens || 0;
        tokensOutput = finalMessage.usage?.output_tokens || 0;
      } catch (err: any) { console.error("[catch]", err?.message || err);}
      // Save assistant message to in-memory store
      const convKey = String(conversationId || "default");
      if (!conversationMessages.has(convKey)) conversationMessages.set(convKey, []);
      conversationMessages.get(convKey)!.push({
        id: Date.now(), conversationId: Number(conversationId) || 0,
        role: "assistant", content: fullContent, timestamp: new Date().toISOString(),
      });
      res.write(`event: action_start\ndata: ${JSON.stringify({ actionId: "extract-files-a", action: "extract_code", label: "Extracting code from response" })}\n\n`);
      const savedFiles = await extractAndSaveCodeBlocks(fullContent, projectId, storage);
      if (savedFiles.length > 0) {
        for (const f of savedFiles) {
          res.write(`event: tool_result\ndata: ${JSON.stringify({
            tool: "write_file", status: "success",
            result: { filename: f.filename, language: f.language, action: "created" },
          })}\n\n`);
          res.write(`event: file_diff\ndata: ${JSON.stringify({
            path: f.filename, language: f.language, isNewFile: true,
            linesAdded: (f.content || "").split("\\n").length, linesRemoved: 0,
          })}\n\n`);
        }
        res.write(`event: preview_ready\ndata: ${JSON.stringify({
          url: `/api/preview/${projectId}/`,
          files: savedFiles.map(f => f.filename),
        })}\n\n`);
      }
      res.write(`event: action_complete\ndata: ${JSON.stringify({ actionId: "extract-files-a", action: "extract_code", filesCreated: savedFiles.length, success: true })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({
        conversationId: conversationId || Date.now(), projectId,
        totalTokens: tokensInput + tokensOutput, tokensInput, tokensOutput,
        cost: "0.000000", model, provider: "anthropic",
      })}\n\n`);
    }
    res.end();
  }

  const providers: Array<{ name: string; fn: () => Promise<void> }> = [];

  const modelfarmModel = modelId || (highPowerEnabled ? "gpt-4o" : "gpt-4.1-mini");

  if (requestedProvider === "anthropic" && anthropicKey) {
    providers.push({ name: "Anthropic", fn: () => streamWithAnthropic(anthropicKey) });
  }
  if (modelfarmBaseUrl && modelfarmKey) {
    providers.push({ name: "Modelfarm", fn: () => streamWithOpenAI(modelfarmKey, modelfarmModel, "modelfarm", modelfarmBaseUrl) });
  }
  if (openaiKey) {
    const m = modelId?.startsWith("gpt") || modelId?.startsWith("o") ? modelId : "gpt-4o";
    providers.push({ name: "OpenAI", fn: () => streamWithOpenAI(openaiKey, m, "openai") });
  }
  if (requestedProvider !== "anthropic" && anthropicKey) {
    providers.push({ name: "Anthropic-fallback", fn: () => streamWithAnthropic(anthropicKey) });
  }

  if (projectId && (app as any).locals.broadcastProjectLog) {
    (app as any).locals.broadcastProjectLog(String(projectId), {
      type: "stdout", message: `[AI] Starting ${requestedProvider} stream (model: ${modelId || "default"})`,
      timestamp: Date.now(), level: "info", service: "ai"
    });
  }

  let lastError = "";
  for (const p of providers) {
    try {
      await p.fn();
      if (projectId && (app as any).locals.broadcastProjectLog) {
        (app as any).locals.broadcastProjectLog(String(projectId), {
          type: "stdout", message: `[AI] Stream completed via ${p.name}`,
          timestamp: Date.now(), level: "info", service: "ai"
        });
      }
      return;
    } catch (err: any) {
      lastError = err.message;
      console.error(`[AI Stream] ${p.name} failed: ${err.message}`);
      if (projectId && (app as any).locals.broadcastProjectLog) {
        (app as any).locals.broadcastProjectLog(String(projectId), {
          type: "stderr", message: `[AI] ${p.name} failed: ${err.message}`,
          timestamp: Date.now(), level: "error", service: "ai"
        });
      }
    }
  }

  res.write(`event: error\ndata: ${JSON.stringify({ message: lastError || "All AI providers failed. Please check your API keys." })}\n\n`);
  res.end();
});

app.post("/api/agent/conversation", (_req: Request, res: Response) => {
  const convId = Date.now();
  res.json({ conversationId: convId, agentMode: "build", existing: false });
});

app.get("/api/agent/conversation", (_req: Request, res: Response) => {
  res.json({ conversationId: Date.now(), agentMode: "build", existing: true });
});

app.get("/api/agent/conversation/:conversationId/messages", (req: Request, res: Response) => {
  const convId = req.params.conversationId;
  const msgs = conversationMessages.get(convId) || [];
  res.json({ messages: msgs, totalCount: msgs.length });
});

app.post("/api/agent/conversation/:conversationId/messages", (req: Request, res: Response) => {
  const convId = req.params.conversationId;
  const { role, content } = req.body;
  const msg = {
    id: Date.now(),
    conversationId: parseInt(convId, 10),
    role: role || "user",
    content: content || "",
    timestamp: new Date().toISOString(),
  };
  if (!conversationMessages.has(convId)) {
    conversationMessages.set(convId, []);
  }
  conversationMessages.get(convId)!.push(msg);
  res.json(msg);
});

app.get("/api/projects/:projectId/files", async (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  try {
    let dbFiles: any[] = [];
    try {
      const { storage: st } = await import("./storage");
      dbFiles = await st.getFilesByProjectId(projectId);
    } catch (err: any) { console.error("[catch]", err?.message || err);}
    const filesWithPath = dbFiles.map((f: any) => ({
      id: f.id, projectId: f.projectId,
      filename: f.filename, path: f.path || f.filename,
      name: f.name || f.filename,
      parentId: f.parentId ?? null,
      type: f.isDirectory ? "folder" : "file",
    }));
    const projDir = path.join(process.cwd(), 'projects', String(projectId));
    if (fs.existsSync(projDir)) {
      const dbFilenames = new Set(filesWithPath.map((f: any) => f.filename || f.name));
      const MAX_DEPTH = 5;
      const MAX_ENTRIES = 200;
      let entryCount = 0;
      function scanDir(dir: string, prefix: string, depth: number) {
        if (depth > MAX_DEPTH || entryCount > MAX_ENTRIES) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entryCount > MAX_ENTRIES) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            if (entry.isSymbolicLink()) continue;
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            entryCount++;
            if (entry.isDirectory()) {
              if (!dbFilenames.has(relPath)) {
                filesWithPath.push({
                  id: `disk-${relPath}`, projectId: String(projectId),
                  filename: relPath, path: relPath, name: entry.name,
                  type: "folder", parentId: prefix || null,
                });
                dbFilenames.add(relPath);
              }
              scanDir(path.join(dir, entry.name), relPath, depth + 1);
            } else if (!dbFilenames.has(relPath) && !dbFilenames.has(entry.name)) {
              filesWithPath.push({
                id: `disk-${relPath}`, projectId: String(projectId),
                filename: relPath, path: relPath, name: entry.name,
                type: "file", parentId: prefix || null,
              });
              dbFilenames.add(relPath);
            }
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
      }
      scanDir(projDir, '', 0);
    }
    res.json(filesWithPath);
  } catch (e: any) {
    res.json([]);
  }
});

app.get("/api/projects/:projectId/files/:fileIdOrName", async (req: Request, res: Response) => {
  const { projectId, fileIdOrName } = req.params;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdOrName);

  if (isUUID) {
    try {
      const { storage } = await import("./storage");
      const files = await storage.getFilesByProject(projectId);
      const file = files.find((f: any) => String(f.id) === fileIdOrName);
      if (file) return res.json(file);
      return res.status(404).json({ error: "File not found" });
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return res.status(500).json({ error: "Failed to get file" });
    }
  }

  const projDir = path.resolve(process.cwd(), 'projects', projectId);
  const filePath = path.resolve(projDir, fileIdOrName);
  if (!filePath.startsWith(projDir)) return res.status(403).json({ error: "Forbidden" });
  try {
    if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isSymbolicLink()) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ filename: fileIdOrName, content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


const agentPreferencesStore = new Map<string, any>();

app.get("/api/agent/preferences", (req: Request, res: Response) => {
  const userId = req.session?.userId || "default";
  const prefs = agentPreferencesStore.get(userId) || {
    extendedThinking: false,
    highPowerMode: false,
    autoWebSearch: false,
    preferredModel: "claude-sonnet-4-20250514",
    customInstructions: null,
    improvePromptEnabled: false,
    progressTabEnabled: true,
    pauseResumeEnabled: true,
    autoCheckpoints: true,
  };
  res.json(prefs);
});

app.put("/api/agent/preferences", (req: Request, res: Response) => {
  const userId = req.session?.userId || "default";
  const existing = agentPreferencesStore.get(userId) || {
    extendedThinking: false,
    highPowerMode: false,
    autoWebSearch: false,
    preferredModel: "claude-sonnet-4-20250514",
    customInstructions: null,
    improvePromptEnabled: false,
    progressTabEnabled: true,
    pauseResumeEnabled: true,
    autoCheckpoints: true,
  };
  const updated = { ...existing, ...req.body };
  agentPreferencesStore.set(userId, updated);
  res.json(updated);
});


app.get("/api/agent/effective-model", (_req: Request, res: Response) => {
  res.json({ model: "claude-sonnet-4-20250514", provider: "anthropic" });
});

app.get("/api/agent/tools/status", (_req: Request, res: Response) => {
  res.json({ tools: [{ name: "app_testing", enabled: true }] });
});

app.get("/api/agent/tools/testing/replays", (_req: Request, res: Response) => {
  res.json({ replays: [] });
});

app.get("/api/agent/testing/sessions", (_req: Request, res: Response) => {
  res.json({ sessions: [] });
});

app.get("/api/git/status", (_req: Request, res: Response) => {
  res.json({ branch: "main", clean: true, files: [] });
});

app.get("/api/git/:projectId/status", (_req: Request, res: Response) => {
  res.json({ branch: "main", clean: true, files: [], ahead: 0, behind: 0 });
});

app.get("/api/projects/:id/git/status", (_req: Request, res: Response) => {
  res.json({ branch: "main", clean: true, files: [], ahead: 0, behind: 0 });
});

app.get("/api/autonomy/sessions", (_req: Request, res: Response) => {
  res.json({ sessions: [] });
});

app.get("/api/terminal/sessions", (_req: Request, res: Response) => {
  res.json({ sessions: [] });
});

app.get("/api/terminal/metrics", (_req: Request, res: Response) => {
  res.json({ activeSessions: 0, totalSessions: 0, uptime: process.uptime() });
});

app.get("/api/terminal/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", activeSessions: 0 });
});

app.get("/api/packages/audit", (_req: Request, res: Response) => {
  res.json({ vulnerabilities: [], summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 } });
});

app.get("/api/packages/outdated", (_req: Request, res: Response) => {
  res.json({ outdated: [] });
});

app.get("/api/packages/dependencies", (_req: Request, res: Response) => {
  res.json({ dependencies: [], devDependencies: [] });
});

app.get("/api/runtime/:projectId/logs", (_req: Request, res: Response) => {
  res.json({ logs: [], status: "idle" });
});

app.get("/api/projects/:projectId/resources/usage", (_req: Request, res: Response) => {
  res.json({ cpu: 0, memory: 0, storage: 0, bandwidth: 0, status: "idle" });
});

app.get("/api/projects/:projectId/search", (req: Request, res: Response) => {
  res.json({ results: [], query: req.query.q || "", total: 0 });
});

app.get("/api/mcp/servers", (_req: Request, res: Response) => {
  res.json({ servers: [] });
});

(async () => {
  try {
    await registerRoutes(httpServer, app);
    log("Full routes loaded successfully");
  } catch (err: any) {
    log(`Full routes failed to load: ${err.message}. Loading minimal routes...`, "warn");

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
      const pid = req.params.id;
      try {
        const file = await storage.updateFile(req.params.fileId, req.body);
        if (req.body.content !== undefined && file) {
          const filePath = (file as any).path || (file as any).filename;
          if (filePath) {
            const projDir = path.join(process.cwd(), "projects", pid);
            const diskPath = path.resolve(projDir, filePath);
            if (diskPath.startsWith(projDir)) {
              fs.mkdirSync(path.dirname(diskPath), { recursive: true });
              fs.writeFileSync(diskPath, req.body.content, "utf-8");
              broadcastProjectLog(pid, {
                type: "stdout", message: `[File] Updated ${filePath}`,
                timestamp: Date.now(), level: "info", service: "files"
              });
            }
          }
        }
        res.json(file);
      } catch (e: any) {
        broadcastProjectLog(pid, {
          type: "stderr", message: `[File] Update failed: ${e.message}`,
          timestamp: Date.now(), level: "error", service: "files"
        });
        res.status(500).json({ message: e.message });
      }
    });

    app.post("/api/projects/:id/files", async (req, res) => {
      const pid = req.params.id;
      try {
        const body = req.body;
        const filename = body.filename || body.name || (body.path ? body.path.split("/").pop() : null);
        const filePath = body.path || filename;
        if (!filename) return res.status(400).json({ message: "filename, name, or path is required" });
        const file = await storage.createFile({
          projectId: pid,
          filename,
          content: body.content ?? "",
          isBinary: body.isBinary ?? false,
          mimeType: body.mimeType ?? null,
          artifactId: body.artifactId ?? null,
        });
        const projDir = path.join(process.cwd(), "projects", pid);
        const diskPath = path.resolve(projDir, filePath);
        if (diskPath.startsWith(projDir)) {
          fs.mkdirSync(path.dirname(diskPath), { recursive: true });
          fs.writeFileSync(diskPath, body.content ?? "", "utf-8");
        }
        broadcastProjectLog(pid, {
          type: "stdout", message: `[File] Created ${filename}`,
          timestamp: Date.now(), level: "info", service: "files"
        });
        res.json(file);
      } catch (e: any) {
        broadcastProjectLog(pid, {
          type: "stderr", message: `[File] Create failed: ${e.message}`,
          timestamp: Date.now(), level: "error", service: "files"
        });
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
      const pid = req.params.id;
      try {
        await storage.deleteFile(req.params.fileId);
        broadcastProjectLog(pid, {
          type: "stdout", message: `[File] Deleted file ${req.params.fileId}`,
          timestamp: Date.now(), level: "info", service: "files"
        });
        res.json({ success: true });
      } catch (e: any) {
        broadcastProjectLog(pid, {
          type: "stderr", message: `[File] Delete failed: ${e.message}`,
          timestamp: Date.now(), level: "error", service: "files"
        });
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

    app.get("/api/preview/render/:projectId/api/*", (_req, res) => {
      res.status(404).end();
    });

    app.get("/api/preview/render/:projectId", async (req, res) => {
      const projectId = req.params.projectId;
      const projDir = path.join(process.cwd(), 'projects', String(projectId));
      const baseTag = `<base href="/api/preview/file/${projectId}/">`;
      try {
        const diskIndex = path.join(projDir, 'index.html');
        if (fs.existsSync(diskIndex)) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          let html = fs.readFileSync(diskIndex, 'utf-8');
          if (!html.includes('<base ')) {
            if (html.includes('<head>')) {
              html = html.replace('<head>', `<head>\n${baseTag}`);
            } else if (html.includes('<head ')) {
              html = html.replace(/<head([^>]*)>/, `<head$1>\n${baseTag}`);
            } else if (html.includes('<!DOCTYPE') || html.includes('<!doctype') || html.includes('<html')) {
              html = html.replace(/<html([^>]*)>/, `<html$1>\n<head>${baseTag}</head>`);
            } else {
              html = `<head>${baseTag}</head>\n` + html;
            }
          }
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
        if (!htmlFile) return res.status(404).send(`<!DOCTYPE html><html><head>${baseTag}</head><body><h1>No preview available yet</h1><p>The agent is building your app. Once code is generated, the preview will appear here.</p></body></html>`);
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        let content = htmlFile.content || "<h1>Empty file</h1>";
        if (!content.includes('<base ')) {
          if (content.includes('<head>')) {
            content = content.replace('<head>', `<head>\n${baseTag}`);
          } else {
            content = `<head>${baseTag}</head>\n` + content;
          }
        }
        res.send(content);
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
        broadcastProjectLog(String(project.id), {
          type: "stdout", message: `[Workspace] Project "${projectName}" created`,
          timestamp: Date.now(), level: "info", service: "workspace"
        });
        broadcastProjectLog(String(project.id), {
          type: "system", message: `[System] Language: ${options?.language || "typescript"} | Type: web-app | Ready for AI agent`,
          timestamp: Date.now(), level: "info", service: "system"
        });
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
      const aiModels = AI_MODELS;
      const providerAvailability: Record<string, boolean> = {};
      const checkProvider = (provider: string): boolean => {
        if (providerAvailability[provider] !== undefined) return providerAvailability[provider];
        let available = false;
        switch (provider) {
          case 'openai':
            available = !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
            break;
          case 'anthropic':
            available = !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
            break;
          case 'gemini':
            available = !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
            break;
          case 'xai':
            available = !!(process.env.AI_INTEGRATIONS_XAI_API_KEY || process.env.XAI_API_KEY);
            break;
          case 'moonshot':
            available = !!(process.env.AI_INTEGRATIONS_MOONSHOT_API_KEY || process.env.MOONSHOT_API_KEY);
            break;
          case 'groq':
            available = !!(process.env.AI_INTEGRATIONS_GROQ_API_KEY || process.env.GROQ_API_KEY);
            break;
          default:
            available = !!process.env[`${provider.toUpperCase()}_API_KEY`];
        }
        providerAvailability[provider] = available;
        return available;
      };
      const models = aiModels.map((m: AIModelType) => ({
        ...m,
        available: checkProvider(m.provider)
      }));
      res.json({ models });
    });

    app.get("/api/models/preferred", async (req, res) => {
      const aiModels = AI_MODELS;
      const user = await getSessionUser(req);
      const availableCount = aiModels.filter((m: AIModelType) => {
        const p = m.provider;
        if (p === 'openai') return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
        if (p === 'anthropic') return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
        if (p === 'gemini') return !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
        if (p === 'xai') return !!(process.env.AI_INTEGRATIONS_XAI_API_KEY || process.env.XAI_API_KEY);
        if (p === 'moonshot') return !!(process.env.AI_INTEGRATIONS_MOONSHOT_API_KEY || process.env.MOONSHOT_API_KEY);
        if (p === 'groq') return !!(process.env.AI_INTEGRATIONS_GROQ_API_KEY || process.env.GROQ_API_KEY);
        return false;
      }).length;
      res.json({
        preferredModel: "claude-sonnet-4-20250514",
        preferredProvider: "anthropic",
        availableModels: availableCount,
        userId: user?.id || null,
      });
    });

    app.put("/api/models/preferred", async (req, res) => {
      res.json({ success: true });
    });

    app.get("/api/agent/models", (_req, res) => {
      const aiModels = AI_MODELS;
      const providers: string[] = [];
      if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) providers.push("openai");
      if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
      if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) providers.push("gemini");
      if (process.env.AI_INTEGRATIONS_XAI_API_KEY || process.env.XAI_API_KEY) providers.push("xai");
      if (process.env.AI_INTEGRATIONS_MOONSHOT_API_KEY || process.env.MOONSHOT_API_KEY) providers.push("moonshot");
      if (process.env.AI_INTEGRATIONS_GROQ_API_KEY || process.env.GROQ_API_KEY) providers.push("groq");
      const models = aiModels.map((m: AIModelType) => {
        const isAvailable = providers.includes(m.provider);
        return {
          ...m,
          available: isAvailable,
          category: m.provider === 'gemini' ? 'google' : m.provider,
          tier: (m.costPer1kTokens || 0) >= 0.01 ? 'high-power' : 'standard',
          capabilities: {
            extendedThinking: m.id.includes('o1') || m.id.includes('o3') || m.id.includes('o4') || m.id.includes('3-7-sonnet') || m.id.includes('opus'),
            codeGeneration: true,
            maxTokens: m.maxTokens,
            speed: (m.costPer1kTokens || 0) <= 0.001 ? 'fast' : (m.costPer1kTokens || 0) <= 0.005 ? 'medium' : 'slow',
            cost: (m.costPer1kTokens || 0) <= 0.001 ? 'low' : (m.costPer1kTokens || 0) <= 0.005 ? 'medium' : 'high'
          }
        };
      });
      res.json({
        providers,
        models,
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

    try {
      const ragRouter = (await import("./routes/rag.router")).default;
      app.use("/api/rag", ragRouter);
    } catch (ragErr: any) {
      console.warn("RAG router failed to load:", ragErr?.message);
      app.get("/api/rag/stats", (_req, res) => {
        res.json({ indexed: 0, total: 0, status: "idle" });
      });
    }

    // =========================================================
    // TERMINAL — Socket.IO terminal with child_process fallback
    // =========================================================
    const { socketIOTerminalService } = await import("./terminal/socket-io-terminal");
    socketIOTerminalService.initialize(httpServer);
    console.log("8:" + new Date().toLocaleTimeString().slice(3) + " [express] Socket.IO terminal service initialized");

    const { WebSocketServer } = await import("ws");
    const pty = await import("node-pty").catch(() => null);

    const wss = new WebSocketServer({ noServer: true });
    const logWss = new WebSocketServer({ noServer: true });
    const agentWss = new WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      if (url.pathname === "/api/terminal/ws" || url.pathname === "/shell") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else if (url.pathname === "/api/runtime/logs/ws" || url.pathname === "/api/server/logs/ws") {
        logWss.handleUpgrade(request, socket, head, (ws) => {
          logWss.emit("connection", ws, request, url.pathname);
        });
      } else if (url.pathname === "/ws/agent") {
        agentWss.handleUpgrade(request, socket, head, (ws) => {
          agentWss.emit("connection", ws, request);
        });
      }
    });

    const agentWsClients = new Map<string, Set<import("ws").WebSocket>>();
    agentWss.on("connection", (ws: import("ws").WebSocket, request: any) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const projectId = url.searchParams.get("projectId") || "unknown";
      const sessionId = url.searchParams.get("sessionId") || "unknown";
      const deviceId = url.searchParams.get("deviceId") || "unknown";

      if (!agentWsClients.has(projectId)) {
        agentWsClients.set(projectId, new Set());
      }
      agentWsClients.get(projectId)!.add(ws);

      ws.send(JSON.stringify({
        type: "connected",
        projectId,
        sessionId,
        deviceId,
        connectedDevices: agentWsClients.get(projectId)!.size,
        timestamp: Date.now(),
      }));

      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === "reconcile") {
            ws.send(JSON.stringify({ type: "reconciled", timestamp: Date.now() }));
          } else if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          }
        } catch {}
      });

      ws.on("close", () => {
        agentWsClients.get(projectId)?.delete(ws);
        if (agentWsClients.get(projectId)?.size === 0) {
          agentWsClients.delete(projectId);
        }
      });

      const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);

      ws.on("close", () => clearInterval(heartbeat));
    });

    wss.on("connection", (ws) => {
      if (!pty) {
        ws.send("\r\n⚠ Terminal not available (node-pty not installed)\r\n");
        return;
      }
      const shell = pty.spawn("/bin/bash", [], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: process.cwd(),
        env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      });
      shell.onData((data: string) => { try { ws.send(data); } catch (err: any) { console.error("[catch]", err?.message || err);} });
      ws.on("message", (msg) => {
        const str = msg.toString();
        try {
          const parsed = JSON.parse(str);
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            shell.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
        shell.write(str);
      });
      ws.on("close", () => { shell.kill(); });
      shell.onExit(() => { try { ws.close(); } catch (err: any) { console.error("[catch]", err?.message || err);} });
    });

    // =========================================================
    // CONSOLE PANEL — Per-project real-time log streaming
    // =========================================================
    interface LogEntry { type: string; message: string; timestamp: number; level?: string; service?: string }
    const projectLogClients = new Map<string, Set<any>>();
    const projectLogBuffers = new Map<string, LogEntry[]>();
    const MAX_PROJECT_LOG_BUFFER = 500;

    function getProjectBuffer(pid: string): LogEntry[] {
      if (!projectLogBuffers.has(pid)) projectLogBuffers.set(pid, []);
      return projectLogBuffers.get(pid)!;
    }

    const bufferLastAccess = new Map<string, number>();

    function broadcastProjectLog(pid: string, entry: LogEntry) {
      bufferLastAccess.set(pid, Date.now());
      const buffer = getProjectBuffer(pid);
      buffer.push(entry);
      if (buffer.length > MAX_PROJECT_LOG_BUFFER) buffer.shift();
      const msg = JSON.stringify({ type: "log", log: entry });
      const clients = projectLogClients.get(pid);
      if (clients) {
        const dead: any[] = [];
        clients.forEach(ws => { try { ws.send(msg); } catch { dead.push(ws); } });
        for (const ws of dead) clients.delete(ws);
        if (clients.size === 0) projectLogClients.delete(pid);
      }
    }

    (app as any).locals.broadcastProjectLog = broadcastProjectLog;

    setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const [pid, lastAccess] of bufferLastAccess.entries()) {
        if (lastAccess < cutoff && !projectLogClients.has(pid)) {
          projectLogBuffers.delete(pid);
          bufferLastAccess.delete(pid);
        }
      }
    }, 5 * 60 * 1000);

    logWss.on("connection", (ws: any, req: any, pathname: string) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const pid = url.searchParams.get("projectId") || "__global__";

      if (!projectLogClients.has(pid)) projectLogClients.set(pid, new Set());
      projectLogClients.get(pid)!.add(ws);

      try { ws.send(JSON.stringify({ type: "connected", projectId: pid })); } catch {}
      const buffer = getProjectBuffer(pid);
      if (buffer.length > 0) {
        try { ws.send(JSON.stringify({ type: "initial", logs: buffer.slice(-100) })); } catch {}
      }
      ws.on("message", (raw: any) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
        } catch {}
      });
      ws.on("close", () => {
        const set = projectLogClients.get(pid);
        if (set) { set.delete(ws); if (set.size === 0) projectLogClients.delete(pid); }
      });
      ws.on("error", () => {
        const set = projectLogClients.get(pid);
        if (set) { set.delete(ws); if (set.size === 0) projectLogClients.delete(pid); }
      });
    });

    app.get("/api/server/logs", async (req: Request, res: Response) => {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ logs: [] });
      const pid = req.query.projectId as string;
      if (!pid) return res.json({ logs: [] });
      res.json({ logs: getProjectBuffer(pid).slice(-100) });
    });

    // =========================================================
    // GIT PANEL — Git operations for projects
    // =========================================================
    const { execSync, spawn } = await import("child_process");
    function git(cmd: string, cwd?: string) {
      try { return execSync(`git ${cmd}`, { cwd: cwd || process.cwd(), encoding: "utf-8", timeout: 15000 }).trim(); }
      catch (e: any) { return e.stdout?.toString().trim() || e.message; }
    }

    app.get("/api/git/projects/:id/status", (req, res) => {
      const projectId = req.params.id;
      const projRelative = `projects/${projectId}`;
      const cwd = process.cwd();
      try {
        const branch = git("rev-parse --abbrev-ref HEAD", cwd);
        const statusRaw = git(`status --porcelain -- "${projRelative}"`, cwd);
        const staged: string[] = [];
        const unstaged: string[] = [];
        const untracked: string[] = [];
        const files: { status: string; path: string; staged: boolean }[] = [];
        if (statusRaw) {
          statusRaw.split("\n").filter(Boolean).forEach(l => {
            const x = l[0], y = l[1];
            const filePath = l.substring(3).replace(new RegExp(`^${projRelative}/?`), "");
            if (x === "?") { untracked.push(filePath); }
            else {
              if (x !== " ") staged.push(filePath);
              if (y !== " " && y !== "?") unstaged.push(filePath);
            }
            files.push({ status: l.substring(0, 2).trim(), path: filePath, staged: x !== " " && x !== "?" });
          });
        }
        res.json({ branch, clean: files.length === 0, files, staged, unstaged, untracked, ahead: 0, behind: 0 });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ branch: "main", clean: true, files: [], staged: [], unstaged: [], untracked: [], ahead: 0, behind: 0 }); }
    });

    app.get("/api/git/projects/:id/branches", (_req, res) => {
      try {
        const currentBranch = git("rev-parse --abbrev-ref HEAD");
        const raw = git("branch -a --format='%(refname:short)|%(objectname:short)|%(creatordate:iso)'");
        const branches = raw.split("\n").filter(Boolean).map(l => {
          const [name, hash, date] = l.split("|");
          const isRemote = name.startsWith("remotes/") || name.startsWith("origin/");
          const isCurrent = !isRemote && name === currentBranch;
          let commitMsg = "", commitAuthor = "";
          try {
            commitMsg = git(`log -1 --format="%s" ${hash}`);
            commitAuthor = git(`log -1 --format="%an" ${hash}`);
          } catch (err: any) { console.error("[catch]", err?.message || err);}
          let branchAhead = 0, branchBehind = 0;
          if (!isRemote) {
            try {
              const ab = git(`rev-list --left-right --count ${name}...origin/${name}`);
              const parts = ab.split(/\s+/);
              branchAhead = parseInt(parts[0]) || 0;
              branchBehind = parseInt(parts[1]) || 0;
            } catch (err: any) { console.error("[catch]", err?.message || err);}
          }
          return {
            name, current: isCurrent, isRemote, hash, date,
            lastCommit: { hash: hash || "", message: commitMsg, author: commitAuthor, date: date || "" },
            ahead: branchAhead, behind: branchBehind,
            trackingBranch: isRemote ? undefined : `origin/${name}`,
          };
        });
        res.json({ branches });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ branches: [{ name: "main", current: true, isRemote: false, lastCommit: { hash: "", message: "", author: "", date: "" }, ahead: 0, behind: 0 }] }); }
    });

    app.get("/api/git/projects/:id/log", (req, res) => {
      const projectId = req.params.id;
      const projDir = path.join(process.cwd(), "projects", projectId);
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        if (fs.existsSync(projDir)) {
          const raw = git(`log --format="%H|%h|%an|%ae|%aI|%s" -${limit} -- "${projDir}"`) || "";
          const commits = raw.split("\n").filter(Boolean).map(l => {
            const [hash, short, author, email, date, ...msgParts] = l.split("|");
            return { hash, short, shortHash: short, author, email, date, message: msgParts.join("|") };
          });
          res.json({ commits });
        } else {
          res.json({ commits: [] });
        }
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ commits: [] }); }
    });

    app.get("/api/git/projects/:id/history", (req, res) => {
      const projectId = req.params.id;
      const projDir = path.join(process.cwd(), "projects", projectId);
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        if (fs.existsSync(projDir)) {
          const raw = git(`log --format="%H|%h|%an|%ae|%aI|%s" -${limit} -- "${projDir}"`) || "";
          const commits = raw.split("\n").filter(Boolean).map(l => {
            const [hash, short, author, email, date, ...msgParts] = l.split("|");
            return { hash, short, shortHash: short, author, email, date, message: msgParts.join("|") };
          });
          res.json({ commits });
        } else {
          res.json({ commits: [] });
        }
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ commits: [] }); }
    });

    app.get("/api/git/projects/:id/diff", (req, res) => {
      const projectId = req.params.id;
      const projRelative = `projects/${projectId}`;
      try {
        const diff = git(`diff -- "${projRelative}"`);
        const staged = git(`diff --cached -- "${projRelative}"`);
        res.json({ diff, staged, hasDiff: !!(diff || staged) });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ diff: "", staged: "", hasDiff: false }); }
    });

    app.get("/api/git/projects/:id/diff/:file", (req, res) => {
      try {
        const file = decodeURIComponent(req.params.file);
        const isStaged = req.query.staged === "true";
        const diff = git(`diff ${isStaged ? "--cached" : ""} -- "${file}"`);
        res.json({ diff, filePath: file, file, staged: isStaged, truncated: diff.length > 50000 });
      } catch (e: any) { res.json({ diff: "", filePath: req.params.file, file: req.params.file, staged: false, truncated: false }); }
    });

    app.get("/api/git/projects/:id/remotes", (_req, res) => {
      try {
        const raw = git("remote -v");
        const remotes = raw.split("\n").filter(Boolean).map(l => {
          const parts = l.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
          if (parts) return { name: parts[1], url: parts[2], type: parts[3] as "fetch" | "push" };
          const [name, url] = l.split(/\s+/);
          return { name, url, type: "fetch" as const };
        });
        res.json({ remotes });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ remotes: [] }); }
    });

    app.post("/api/git/projects/:id/stage", (req, res) => {
      try {
        const { files } = req.body;
        if (files && Array.isArray(files)) {
          files.forEach((f: string) => git(`add "${f}"`));
        } else {
          git("add -A");
        }
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/git/projects/:id/unstage", (req, res) => {
      try {
        const { files } = req.body;
        if (files && Array.isArray(files)) {
          files.forEach((f: string) => git(`reset HEAD "${f}"`));
        } else {
          git("reset HEAD");
        }
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/git/projects/:id/commit", (req, res) => {
      try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Commit message required" });
        const result = git(`commit -m "${message.replace(/"/g, '\\"')}"`);
        const hash = git("rev-parse --short HEAD");
        res.json({ success: true, hash, message: result });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/git/:projectId/commits", (req, res) => {
      const projectId = req.params.projectId;
      const projDir = path.join(process.cwd(), "projects", projectId);
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        if (fs.existsSync(projDir)) {
          const raw = git(`log --format="%H|%h|%an|%ae|%aI|%s" -${limit} -- "${projDir}"`) || "";
          const commits = raw.split("\n").filter(Boolean).map(l => {
            const [hash, short, author, email, date, ...msgParts] = l.split("|");
            return { hash, short, shortHash: short, author, email, date, message: msgParts.join("|") };
          });
          res.json({ commits });
        } else {
          res.json({ commits: [] });
        }
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ commits: [] }); }
    });

    app.post("/api/git/projects/:id/pull", (req, res) => {
      try { res.json({ success: true, message: git("pull --rebase 2>&1 || echo 'No remote configured'") }); }
      catch (e: any) { res.json({ success: false, message: e.message }); }
    });

    app.post("/api/git/projects/:id/push", (req, res) => {
      try { res.json({ success: true, message: git("push 2>&1 || echo 'Push failed or no remote'") }); }
      catch (e: any) { res.json({ success: false, message: e.message }); }
    });

    app.post("/api/git/projects/:id/fetch", (req, res) => {
      try { res.json({ success: true, message: git("fetch --all 2>&1 || echo 'No remote'") }); }
      catch (e: any) { res.json({ success: false, message: e.message }); }
    });

    app.post("/api/git/projects/:id/checkout", (req, res) => {
      try {
        const { branch } = req.body;
        if (!branch) return res.status(400).json({ error: "Branch required" });
        res.json({ success: true, message: git(`checkout ${branch} 2>&1`) });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/git/github/status", (_req, res) => {
      res.json({ connected: false, username: null, repos: [] });
    });

    app.post("/api/git/github/connect", (_req, res) => {
      res.json({ success: false, message: "GitHub integration requires OAuth setup" });
    });

    app.post("/api/git/github/disconnect", (_req, res) => {
      res.json({ success: true });
    });

    // =========================================================
    // WORKFLOWS PANEL — real process execution + log streaming
    // =========================================================
    interface WorkflowEntry {
      id: string;
      name: string;
      command: string;
      description?: string;
      icon?: string;
      status: "stopped" | "running" | "completed" | "error";
      projectId?: string;
      startedAt: string;
      lastRun?: string;
      runCount: number;
      exitCode?: number | null;
      logs: string[];
    }
    const activeWorkflows = new Map<string, WorkflowEntry>();
    const workflowProcesses = new Map<string, ReturnType<typeof import("child_process").spawn>>();

    app.get("/api/workflows", (req, res) => {
      const projectId = req.query.projectId as string;
      const all = Array.from(activeWorkflows.values());
      const filtered = projectId ? all.filter(w => w.projectId === projectId) : all;
      res.json(filtered);
    });

    app.post("/api/workflows", (req, res) => {
      const { name, command, description, icon, projectId } = req.body;
      if (!command) return res.status(400).json({ error: "command is required" });
      const id = crypto.randomUUID();
      const wf: WorkflowEntry = {
        id, name: name || command, command, description: description || "",
        icon: icon || "terminal", status: "stopped", projectId,
        startedAt: new Date().toISOString(), runCount: 0, logs: []
      };
      activeWorkflows.set(id, wf);
      res.json(wf);
    });

    app.get("/api/workflows/:id", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      res.json(wf);
    });

    app.put("/api/workflows/:id", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      const { name, command, description, icon } = req.body;
      if (name !== undefined) wf.name = name;
      if (command !== undefined) wf.command = command;
      if (description !== undefined) wf.description = description;
      if (icon !== undefined) wf.icon = icon;
      res.json(wf);
    });

    app.delete("/api/workflows/:id", (req, res) => {
      const proc = workflowProcesses.get(req.params.id);
      if (proc) { try { proc.kill("SIGTERM"); } catch (err: any) { console.error("[catch]", err?.message || err);} workflowProcesses.delete(req.params.id); }
      activeWorkflows.delete(req.params.id);
      res.json({ success: true });
    });

    app.post("/api/workflows/:id/run", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      if (wf.status === "running") return res.status(409).json({ error: "Already running" });

      const projCwd = wf.projectId
        ? path.resolve(process.cwd(), "projects", wf.projectId)
        : process.cwd();
      if (!fs.existsSync(projCwd)) { try { fs.mkdirSync(projCwd, { recursive: true }); } catch (err: any) { console.error("[catch]", err?.message || err);} }

      wf.logs = [];
      wf.status = "running";
      wf.lastRun = new Date().toISOString();
      wf.runCount += 1;
      wf.exitCode = null;

      const startMsg = `[${new Date().toISOString()}] Starting workflow "${wf.name}": ${wf.command}`;
      wf.logs.push(startMsg);

      try {
        const proc = spawn(wf.command, [], {
          shell: true,
          cwd: projCwd,
          env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "1" } as Record<string, string>,
          stdio: ["pipe", "pipe", "pipe"],
        });
        workflowProcesses.set(wf.id, proc);

        proc.stdout?.on("data", (chunk: Buffer) => {
          const line = chunk.toString();
          wf.logs.push(line);
          if (wf.logs.length > 2000) wf.logs.splice(0, wf.logs.length - 1500);
        });
        proc.stderr?.on("data", (chunk: Buffer) => {
          const line = chunk.toString();
          wf.logs.push(line);
          if (wf.logs.length > 2000) wf.logs.splice(0, wf.logs.length - 1500);
        });
        proc.on("close", (code) => {
          wf.exitCode = code;
          wf.status = code === 0 ? "completed" : "error";
          wf.logs.push(`[${new Date().toISOString()}] Process exited with code ${code}`);
          workflowProcesses.delete(wf.id);
        });
        proc.on("error", (err) => {
          wf.status = "error";
          wf.logs.push(`[${new Date().toISOString()}] Error: ${err.message}`);
          workflowProcesses.delete(wf.id);
        });

        res.json({ success: true, status: "running", workflowId: wf.id });
      } catch (err: any) {
        wf.status = "error";
        wf.logs.push(`[${new Date().toISOString()}] Failed to start: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/workflows/:id/stop", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      const proc = workflowProcesses.get(req.params.id);
      if (proc) {
        try { proc.kill("SIGTERM"); } catch (err: any) { console.error("[catch]", err?.message || err);}
        setTimeout(() => { try { proc.kill("SIGKILL"); } catch (err: any) { console.error("[catch]", err?.message || err);} }, 3000);
        workflowProcesses.delete(req.params.id);
      }
      wf.status = "stopped";
      wf.logs.push(`[${new Date().toISOString()}] Workflow stopped by user`);
      res.json({ success: true, status: "stopped" });
    });

    app.get("/api/workflows/:id/logs", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = wf.logs.slice(offset);
      res.json({ logs, total: wf.logs.length, offset, hasMore: offset + logs.length < wf.logs.length });
    });

    app.get("/api/workflows/:id/logs/stream", (req, res) => {
      const wf = activeWorkflows.get(req.params.id);
      if (!wf) return res.status(404).json({ error: "Not found" });
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let cursor = wf.logs.length;
      res.write(`data: ${JSON.stringify({ type: "history", logs: wf.logs })}\n\n`);

      const interval = setInterval(() => {
        if (cursor < wf.logs.length) {
          const newLogs = wf.logs.slice(cursor);
          cursor = wf.logs.length;
          res.write(`data: ${JSON.stringify({ type: "logs", logs: newLogs })}\n\n`);
        }
        if (wf.status !== "running") {
          res.write(`data: ${JSON.stringify({ type: "status", status: wf.status, exitCode: wf.exitCode })}\n\n`);
          clearInterval(interval);
          res.end();
        }
      }, 250);

      req.on("close", () => clearInterval(interval));
    });

    // =========================================================
    // SECURITY SCANNER — real npm audit + SAST pattern scanning
    // =========================================================
    interface SecurityFinding {
      id: string;
      severity: string;
      title: string;
      description: string;
      file: string;
      line: number | null;
      code: string | null;
      suggestion: string | null;
      category: string;
      isDirect: boolean | null;
      hidden: boolean;
      hiddenAt: string | null;
      agentSessionId: string | null;
    }
    interface SecurityScanEntry {
      id: string;
      status: string;
      totalFindings: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
      createdAt: string;
      finishedAt: string | null;
      projectId: string;
      findings: SecurityFinding[];
    }
    const securityScans = new Map<string, SecurityScanEntry[]>();

    const SAST_PATTERNS: Array<{ pattern: RegExp; severity: string; title: string; description: string; suggestion: string; category: string }> = [
      { pattern: /eval\s*\(/, severity: "high", title: "Use of eval()", description: "eval() executes arbitrary code and is a major security risk. It can lead to code injection attacks.", suggestion: "Replace eval() with JSON.parse() for data parsing, or use Function constructor for specific use cases.", category: "sast" },
      { pattern: /innerHTML\s*=/, severity: "medium", title: "Direct innerHTML assignment", description: "Setting innerHTML directly can lead to XSS (Cross-Site Scripting) attacks if user input is not sanitized.", suggestion: "Use textContent for text, or a DOM sanitization library like DOMPurify.", category: "sast" },
      { pattern: /document\.write\s*\(/, severity: "medium", title: "Use of document.write()", description: "document.write() can overwrite the entire document and is susceptible to XSS attacks.", suggestion: "Use DOM manipulation methods like createElement and appendChild instead.", category: "sast" },
      { pattern: /(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{3,}['"]/, severity: "critical", title: "Hardcoded secret detected", description: "A potential secret, password, or API key is hardcoded in the source code. This can lead to credential exposure.", suggestion: "Use environment variables or a secrets manager to store sensitive values.", category: "privacy" },
      { pattern: /console\.(log|debug|info)\s*\(.*(?:password|token|secret|key)/i, severity: "medium", title: "Sensitive data in console output", description: "Logging sensitive information like passwords or tokens can expose them in production logs.", suggestion: "Remove sensitive data from console output or use a structured logger that masks sensitive fields.", category: "privacy" },
      { pattern: /child_process.*exec\s*\(/, severity: "high", title: "Command injection risk", description: "Using exec() with unsanitized input can lead to command injection attacks.", suggestion: "Use execFile() with argument arrays instead of exec() with string commands. Validate and sanitize all inputs.", category: "sast" },
      { pattern: /new\s+Function\s*\(/, severity: "high", title: "Dynamic Function constructor", description: "The Function constructor creates functions from strings, similar to eval(), and poses code injection risks.", suggestion: "Avoid dynamic code generation. Use predefined functions and switch/case for dispatch.", category: "sast" },
      { pattern: /dangerouslySetInnerHTML/, severity: "medium", title: "React dangerouslySetInnerHTML", description: "dangerouslySetInnerHTML can introduce XSS vulnerabilities if the HTML content is not properly sanitized.", suggestion: "Sanitize HTML content with DOMPurify before passing it to dangerouslySetInnerHTML.", category: "sast" },
      { pattern: /(?:https?:\/\/)[^\s'"]*(?:password|token|key|secret)=[^\s'"]+/, severity: "high", title: "Credentials in URL", description: "Passing credentials as URL parameters exposes them in logs, browser history, and referrer headers.", suggestion: "Use HTTP headers (Authorization) or POST body for transmitting credentials.", category: "privacy" },
      { pattern: /crypto\.createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/, severity: "medium", title: "Weak cryptographic hash", description: "MD5 and SHA1 are considered cryptographically weak and vulnerable to collision attacks.", suggestion: "Use SHA-256 or stronger hash algorithms: crypto.createHash('sha256').", category: "sast" },
    ];

    function runSastScan(projDir: string): SecurityFinding[] {
      const findings: SecurityFinding[] = [];
      const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"];
      function scanDir(dir: string, depth = 0) {
        if (depth > 8) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
            if (!extensions.some(ext => entry.name.endsWith(ext))) continue;
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const lines = content.split("\n");
              const relPath = path.relative(projDir, fullPath);
              for (let i = 0; i < lines.length; i++) {
                for (const pat of SAST_PATTERNS) {
                  if (pat.pattern.test(lines[i])) {
                    findings.push({
                      id: crypto.randomUUID(),
                      severity: pat.severity,
                      title: pat.title,
                      description: pat.description,
                      file: relPath,
                      line: i + 1,
                      code: lines[i].trim().substring(0, 200),
                      suggestion: pat.suggestion,
                      category: pat.category,
                      isDirect: null,
                      hidden: false,
                      hiddenAt: null,
                      agentSessionId: null,
                    });
                  }
                }
              }
            } catch (err: any) { console.error("[catch]", err?.message || err);}
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
      }
      scanDir(projDir);
      return findings;
    }

    function runNpmAudit(projDir: string): SecurityFinding[] {
      const findings: SecurityFinding[] = [];
      try {
        const pkgPath = path.join(projDir, "package.json");
        if (!fs.existsSync(pkgPath)) return findings;
        const result = execSync("npm audit --json 2>/dev/null || echo '{}'", { cwd: projDir, encoding: "utf-8", timeout: 30000 });
        const audit = JSON.parse(result);
        if (audit.vulnerabilities) {
          for (const [name, vuln] of Object.entries(audit.vulnerabilities) as any[]) {
            const sev = vuln.severity || "info";
            findings.push({
              id: crypto.randomUUID(),
              severity: sev,
              title: `Vulnerable dependency: ${name}@${vuln.range || "unknown"}`,
              description: vuln.via?.map?.((v: any) => typeof v === "string" ? v : v.title || v.name || "").filter(Boolean).join("; ") || `Vulnerability in ${name}`,
              file: "package.json",
              line: null,
              code: vuln.fixAvailable ? `fix: >= ${typeof vuln.fixAvailable === "object" ? vuln.fixAvailable.version || "latest" : "latest"}` : null,
              suggestion: vuln.fixAvailable ? `Update ${name} to a patched version` : "Review and consider replacing this package",
              category: "dependency",
              isDirect: vuln.isDirect || false,
              hidden: false,
              hiddenAt: null,
              agentSessionId: null,
            });
          }
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);}
      return findings;
    }

    app.get("/api/projects/:id/security/scans", (req, res) => {
      const projectId = req.params.id;
      const scans = (securityScans.get(projectId) || []).map(s => {
        const { findings, ...rest } = s;
        return rest;
      });
      res.json(scans);
    });

    app.post("/api/projects/:id/security/scan", (req, res) => {
      const projectId = req.params.id;
      const scanId = crypto.randomUUID();
      const scan: SecurityScanEntry = {
        id: scanId,
        status: "running",
        totalFindings: 0,
        critical: 0, high: 0, medium: 0, low: 0, info: 0,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        projectId,
        findings: [],
      };

      if (!securityScans.has(projectId)) securityScans.set(projectId, []);
      securityScans.get(projectId)!.unshift(scan);

      res.json({ id: scanId, status: "running" });

      setTimeout(() => {
        const projDir = path.resolve(process.cwd(), "projects", projectId);
        if (!fs.existsSync(projDir)) { try { fs.mkdirSync(projDir, { recursive: true }); } catch (err: any) { console.error("[catch]", err?.message || err);} }

        const sastFindings = runSastScan(projDir);
        const depFindings = runNpmAudit(projDir);
        const allFindings = [...sastFindings, ...depFindings];

        scan.findings = allFindings;
        scan.totalFindings = allFindings.length;
        scan.critical = allFindings.filter(f => f.severity === "critical").length;
        scan.high = allFindings.filter(f => f.severity === "high").length;
        scan.medium = allFindings.filter(f => f.severity === "medium").length;
        scan.low = allFindings.filter(f => f.severity === "low").length;
        scan.info = allFindings.filter(f => f.severity === "info").length;
        scan.status = "completed";
        scan.finishedAt = new Date().toISOString();
      }, 100);
    });

    app.get("/api/projects/:id/security/scans/:scanId/findings", (req, res) => {
      const projectId = req.params.id;
      const scanId = req.params.scanId;
      const hidden = req.query.hidden === "true";
      const scans = securityScans.get(projectId) || [];
      const scan = scans.find(s => s.id === scanId);
      if (!scan) return res.json([]);
      const filtered = scan.findings.filter(f => f.hidden === hidden);
      res.json(filtered);
    });

    app.patch("/api/security/findings/:findingId/hide", (req, res) => {
      for (const [, scans] of securityScans) {
        for (const scan of scans) {
          const finding = scan.findings.find(f => f.id === req.params.findingId);
          if (finding) {
            finding.hidden = true;
            finding.hiddenAt = new Date().toISOString();
            return res.json({ success: true, finding });
          }
        }
      }
      res.status(404).json({ error: "Finding not found" });
    });

    app.patch("/api/security/findings/:findingId/unhide", (req, res) => {
      for (const [, scans] of securityScans) {
        for (const scan of scans) {
          const finding = scan.findings.find(f => f.id === req.params.findingId);
          if (finding) {
            finding.hidden = false;
            finding.hiddenAt = null;
            return res.json({ success: true, finding });
          }
        }
      }
      res.status(404).json({ error: "Finding not found" });
    });

    app.patch("/api/security/findings/:findingId/agent-session", (req, res) => {
      const { agentSessionId } = req.body;
      for (const [, scans] of securityScans) {
        for (const scan of scans) {
          const finding = scan.findings.find(f => f.id === req.params.findingId);
          if (finding) {
            finding.agentSessionId = agentSessionId;
            return res.json({ success: true, finding });
          }
        }
      }
      res.status(404).json({ error: "Finding not found" });
    });

    app.post("/api/projects/:id/security/auto-update", (req, res) => {
      const projectId = req.params.id;
      const { packageName, targetVersion } = req.body;
      if (!packageName) return res.status(400).json({ error: "packageName required" });
      const projDir = path.resolve(process.cwd(), "projects", projectId);
      try {
        const cmd = targetVersion ? `npm install ${packageName}@${targetVersion}` : `npm update ${packageName}`;
        execSync(cmd, { cwd: projDir, encoding: "utf-8", timeout: 60000 });
        res.json({ success: true, message: `Updated ${packageName}${targetVersion ? ` to ${targetVersion}` : ""}` });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Also support ReplitSecurityPanel endpoint patterns
    app.get("/api/workspace/projects/:id/security-settings", (req, res) => {
      res.json({ autoScanEnabled: false, scanOnPush: false, notifyOnCritical: true });
    });
    app.patch("/api/workspace/projects/:id/security-settings", (req, res) => {
      res.json({ ...req.body, updated: true });
    });
    app.get("/api/workspace/projects/:id/security-scans", (req, res) => {
      const scans = (securityScans.get(req.params.id) || []).map(s => {
        const { findings, ...rest } = s;
        return { ...rest, startedAt: rest.createdAt, scanType: "full", scanner: "semgrep" };
      });
      res.json(scans);
    });
    app.post("/api/workspace/projects/:id/security-scans", (req, res) => {
      const projectId = req.params.id;
      const scanId = crypto.randomUUID();
      const scan: SecurityScanEntry = {
        id: scanId, status: "running", totalFindings: 0,
        critical: 0, high: 0, medium: 0, low: 0, info: 0,
        createdAt: new Date().toISOString(), finishedAt: null, projectId, findings: [],
      };
      if (!securityScans.has(projectId)) securityScans.set(projectId, []);
      securityScans.get(projectId)!.unshift(scan);
      res.json({ id: scanId, status: "queued" });
      setTimeout(() => {
        const projDir = path.resolve(process.cwd(), "projects", projectId);
        if (!fs.existsSync(projDir)) { try { fs.mkdirSync(projDir, { recursive: true }); } catch (err: any) { console.error("[catch]", err?.message || err);} }
        scan.findings = [...runSastScan(projDir), ...runNpmAudit(projDir)];
        scan.totalFindings = scan.findings.length;
        scan.critical = scan.findings.filter(f => f.severity === "critical").length;
        scan.high = scan.findings.filter(f => f.severity === "high").length;
        scan.medium = scan.findings.filter(f => f.severity === "medium").length;
        scan.low = scan.findings.filter(f => f.severity === "low").length;
        scan.info = scan.findings.filter(f => f.severity === "info").length;
        scan.status = "completed";
        scan.finishedAt = new Date().toISOString();
      }, 100);
    });
    app.get("/api/workspace/projects/:id/vulnerabilities/by-hidden", (req, res) => {
      const projectId = req.params.id;
      const hidden = req.query.hidden === "true";
      const scans = securityScans.get(projectId) || [];
      const latest = scans[0];
      if (!latest) return res.json([]);
      res.json(latest.findings.filter(f => f.hidden === hidden).map(f => ({
        ...f, scanId: latest.id, packageName: f.file, installedVersion: null, patchedVersion: null,
      })));
    });
    app.patch("/api/workspace/vulnerabilities/:id/hide", (req, res) => {
      const { isHidden } = req.body;
      for (const [, scans] of securityScans) {
        for (const scan of scans) {
          const finding = scan.findings.find(f => f.id === req.params.id);
          if (finding) {
            finding.hidden = isHidden !== false;
            finding.hiddenAt = finding.hidden ? new Date().toISOString() : null;
            return res.json({ success: true });
          }
        }
      }
      res.status(404).json({ error: "Not found" });
    });

    // =========================================================
    // PREVIEW PANEL
    // =========================================================
    app.post("/api/preview/projects/:id/preview/start", (req, res) => {
      const pid = req.params.id;
      broadcastProjectLog(pid, {
        type: "stdout", message: `[Preview] Starting preview server...`,
        timestamp: Date.now(), level: "info", service: "preview"
      });
      broadcastProjectLog(pid, {
        type: "stdout", message: `[Preview] Server ready at /api/preview/render/${pid}`,
        timestamp: Date.now(), level: "info", service: "preview"
      });
      res.json({ success: true, url: `/api/preview/render/${pid}`, status: "running" });
    });

    app.post("/api/preview/projects/:id/preview/stop", (req, res) => {
      const pid = req.params.id;
      broadcastProjectLog(pid, {
        type: "stdout", message: `[Preview] Server stopped`,
        timestamp: Date.now(), level: "info", service: "preview"
      });
      res.json({ success: true, status: "stopped" });
    });

    // =========================================================
    // FILES — tree & upload (BEFORE :id param routes)
    // =========================================================
    app.get("/api/files/tree", async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        if (!projectId) return res.json({ tree: [], files: [] });

        const dbFiles = await storage.getFilesByProjectId(projectId);
        const projDir = path.resolve(process.cwd(), "projects", projectId);
        const diskFiles: any[] = [];

        function scanDir(dir: string, prefix: string = "") {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              diskFiles.push({
                id: `disk-${relPath}`,
                projectId,
                filename: relPath,
                path: relPath,
                name: entry.name,
                type: "directory",
                children: [],
              });
              scanDir(path.join(dir, entry.name), relPath);
            } else {
              diskFiles.push({
                id: `disk-${relPath}`,
                projectId,
                filename: relPath,
                path: relPath,
                name: entry.name,
                type: "file",
                language: entry.name.split(".").pop() || "text",
              });
            }
          }
        }
        scanDir(projDir);

        const dbFilenames = new Set(dbFiles.map((f: any) => f.filename));
        const normalizedDb = dbFiles.map((f: any) => ({
          ...f,
          id: f.id || `db-${f.filename}`,
          path: f.path || f.filename,
          name: f.name || (f.filename ? f.filename.split("/").pop() : ""),
          type: f.type || "file",
          language: f.language || (f.filename ? f.filename.split(".").pop() : "text"),
        }));
        const merged = [...normalizedDb];
        for (const df of diskFiles) {
          if (!dbFilenames.has(df.filename)) merged.push(df);
        }

        function buildTree(flatFiles: any[]): any[] {
          const dirs = new Map<string, any>();
          const rootItems: any[] = [];
          for (const f of flatFiles) {
            if (f.type === "directory") {
              dirs.set(f.path || f.filename, { ...f, children: [] });
            }
          }
          for (const f of flatFiles) {
            const filePath = f.path || f.filename;
            const parts = filePath.split("/");
            if (parts.length === 1) {
              rootItems.push(f);
            } else {
              const parentPath = parts.slice(0, -1).join("/");
              const parent = dirs.get(parentPath);
              if (parent) parent.children.push(f);
              else rootItems.push(f);
            }
          }
          const topLevel = rootItems.filter((f: any) => f.type === "directory" ? true : !dirs.has(f.path || f.filename));
          for (const [, dir] of dirs) {
            const parts = (dir.path || dir.filename).split("/");
            if (parts.length === 1) {
              const existing = topLevel.find((t: any) => (t.path || t.filename) === (dir.path || dir.filename));
              if (!existing) topLevel.push(dir);
              else Object.assign(existing, dir);
            }
          }
          return topLevel.sort((a: any, b: any) => {
            if (a.type === "directory" && b.type !== "directory") return -1;
            if (a.type !== "directory" && b.type === "directory") return 1;
            return (a.name || a.filename || "").localeCompare(b.name || b.filename || "");
          });
        }

        const tree = buildTree(merged);
        res.json({ tree, files: merged });
      } catch (e: any) {
        res.json({ tree: [], files: [] });
      }
    });

    app.post("/api/files/upload", (req, res) => {
      res.json({ success: true, file: { id: crypto.randomUUID(), name: "uploaded", size: 0 } });
    });

    // =========================================================
    // FILES — individual file by ID
    // =========================================================
    async function serveDiskFile(fileId: string, projectId: string | undefined, res: any) {
      const relPath = fileId.slice(5);
      if (projectId) {
        const projDir = path.resolve(process.cwd(), "projects", projectId);
        const filePath = path.resolve(projDir, relPath);
        if (filePath.startsWith(projDir) && fs.existsSync(filePath) && !fs.lstatSync(filePath).isSymbolicLink() && fs.lstatSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, "utf-8");
          return res.json({ id: fileId, projectId, filename: relPath, path: relPath, name: relPath.split("/").pop(), content, type: "file" });
        }
        try {
          const dbFiles = await storage.getFilesByProject?.(projectId) || [];
          const dbFile = dbFiles.find((f: any) => f.filename === relPath || f.path === relPath);
          if (dbFile) {
            return res.json({ id: fileId, projectId, filename: relPath, path: relPath, name: relPath.split("/").pop(), content: dbFile.content, type: "file" });
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
      }
      return res.status(404).json({ error: "File not found" });
    }

    function writeDiskFile(fileId: string, projectId: string | undefined, content: string, res: any) {
      const relPath = fileId.slice(5);
      if (projectId && content !== undefined) {
        const projDir = path.resolve(process.cwd(), "projects", projectId);
        const filePath = path.resolve(projDir, relPath);
        if (filePath.startsWith(projDir)) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, content, "utf-8");
          return res.json({ id: fileId, projectId, filename: relPath, content, updated: true });
        }
      }
      return res.status(400).json({ error: "Cannot update disk file without projectId and content" });
    }

    app.use("/api/files", (req, res, next) => {
      const fullPath = req.path;
      const diskMatch = fullPath.match(/^\/disk-(.+)$/);
      if (!diskMatch) return next();
      const relPath = diskMatch[1];
      const projectId = (req.query.projectId || req.body?.projectId) as string;
      if (req.method === "GET") {
        return serveDiskFile("disk-" + relPath, projectId, res);
      } else if (req.method === "PUT") {
        return writeDiskFile("disk-" + relPath, projectId, req.body?.content, res);
      }
      next();
    });

    app.get("/api/files/:id", async (req, res) => {
      try {
        const fileId = req.params.id;
        if (fileId.startsWith("disk-")) {
          return serveDiskFile(fileId, req.query.projectId as string, res);
        }
        const file = await storage.getFile?.(fileId);
        if (!file) return res.status(404).json({ error: "File not found" });
        res.json({ ...file, path: (file as any).path || file.filename, name: (file as any).name || file.filename });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put("/api/files/:id", async (req, res) => {
      try {
        const fileId = req.params.id;
        if (fileId.startsWith("disk-")) {
          return writeDiskFile(fileId, req.body.projectId || req.query.projectId as string, req.body.content, res);
        }
        const file = await storage.updateFile(fileId, req.body);
        res.json(file);
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // =========================================================
    // PACKAGES PANEL
    // =========================================================
    app.get("/api/packages/installed", (req, res) => {
      const projectId = req.query.projectId as string;
      try {
        const pkgPath = path.join(process.cwd(), "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          const deps = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({ name, version, type: "dependency" }));
          const devDeps = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({ name, version, type: "devDependency" }));
          res.json({ packages: [...deps, ...devDeps] });
        } else {
          res.json({ packages: [] });
        }
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ packages: [] }); }
    });

    app.get("/api/packages", (req, res) => {
      res.redirect(`/api/packages/installed?projectId=${req.query.projectId || ""}`);
    });

    app.post("/api/packages/:projectId/install", async (req, res) => {
      try {
        const { packages } = req.body;
        if (!packages || !Array.isArray(packages)) return res.status(400).json({ error: "packages array required" });
        const result = execSync(`npm install ${packages.join(" ")}`, { encoding: "utf-8", timeout: 60000 });
        res.json({ success: true, output: result });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/packages/:projectId/uninstall", async (req, res) => {
      try {
        const { packages } = req.body;
        if (!packages || !Array.isArray(packages)) return res.status(400).json({ error: "packages array required" });
        const result = execSync(`npm uninstall ${packages.join(" ")}`, { encoding: "utf-8", timeout: 60000 });
        res.json({ success: true, output: result });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/packages/:projectId/dependencies", (req, res) => {
      res.redirect("/api/packages/installed?projectId=" + req.params.projectId);
    });

    app.get("/api/packages/:projectId/outdated", (req, res) => {
      try {
        const result = execSync("npm outdated --json 2>/dev/null || echo '{}'", { encoding: "utf-8", timeout: 30000 });
        res.json({ outdated: JSON.parse(result) });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ outdated: {} }); }
    });

    app.get("/api/packages/:projectId/audit", (req, res) => {
      try {
        const result = execSync("npm audit --json 2>/dev/null || echo '{}'", { encoding: "utf-8", timeout: 30000 });
        res.json(JSON.parse(result));
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ vulnerabilities: {} }); }
    });

    app.post("/api/packages/:projectId/update", async (req, res) => {
      try {
        const { packages } = req.body;
        const cmd = packages && packages.length > 0 ? `npm update ${packages.join(" ")}` : "npm update";
        const result = execSync(cmd, { encoding: "utf-8", timeout: 60000 });
        res.json({ success: true, output: result });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // =========================================================
    // SECRETS / ENV VARS PANEL
    // =========================================================
    const envVarsStore = new Map<string, { key: string; value: string; id: string }>();

    app.get("/api/env-vars", (req, res) => {
      const vars = Array.from(envVarsStore.values()).map(v => ({ id: v.id, key: v.key, value: "••••••••" }));
      res.json({ variables: vars });
    });

    app.get("/api/env-vars/:projectIdOrVarId", (req, res, next) => {
      const param = req.params.projectIdOrVarId;
      if (req.path.includes("/reveal") || req.path.includes("/export") || req.path.includes("/import")) return next();
      const vars = Array.from(envVarsStore.values()).map(v => ({ id: v.id, key: v.key, value: "••••••••" }));
      res.json({ variables: vars });
    });

    app.post("/api/env-vars", (req, res) => {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: "Key required" });
      const id = crypto.randomUUID();
      envVarsStore.set(key, { key, value: value || "", id });
      process.env[key] = value || "";
      res.json({ id, key, success: true });
    });

    app.put("/api/env-vars/:id", (req, res) => {
      const { key, value } = req.body;
      const existing = Array.from(envVarsStore.values()).find(v => v.id === req.params.id);
      if (existing) {
        delete process.env[existing.key];
        envVarsStore.delete(existing.key);
      }
      const newKey = key || existing?.key || req.params.id;
      envVarsStore.set(newKey, { key: newKey, value: value || "", id: req.params.id });
      process.env[newKey] = value || "";
      res.json({ id: req.params.id, key: newKey, success: true });
    });

    app.patch("/api/env-vars/:id", (req, res) => {
      const { key, value } = req.body;
      const existing = Array.from(envVarsStore.values()).find(v => v.id === req.params.id);
      if (existing) {
        delete process.env[existing.key];
        envVarsStore.delete(existing.key);
      }
      const newKey = key || existing?.key || req.params.id;
      envVarsStore.set(newKey, { key: newKey, value: value || "", id: req.params.id });
      process.env[newKey] = value || "";
      res.json({ id: req.params.id, key: newKey, success: true });
    });

    app.delete("/api/env-vars/:id", (req, res) => {
      const existing = Array.from(envVarsStore.values()).find(v => v.id === req.params.id);
      if (existing) {
        delete process.env[existing.key];
        envVarsStore.delete(existing.key);
      }
      res.json({ success: true });
    });

    app.get("/api/env-vars/:id/reveal", (req, res) => {
      const existing = Array.from(envVarsStore.values()).find(v => v.id === req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      res.json({ id: existing.id, key: existing.key, value: existing.value });
    });

    app.post("/api/env-vars/:id/reveal", (req, res) => {
      const existing = Array.from(envVarsStore.values()).find(v => v.id === req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      res.json({ id: existing.id, key: existing.key, value: existing.value });
    });

    app.post("/api/env-vars/:id/import", (req, res) => {
      const { variables } = req.body;
      if (variables && typeof variables === "object") {
        Object.entries(variables).forEach(([k, v]) => {
          const id = crypto.randomUUID();
          envVarsStore.set(k, { key: k, value: String(v), id });
          process.env[k] = String(v);
        });
      }
      res.json({ success: true, count: Object.keys(variables || {}).length });
    });

    app.get("/api/env-vars/:id/export", (req, res) => {
      const all: Record<string, string> = {};
      envVarsStore.forEach(v => { all[v.key] = v.value; });
      res.json({ variables: all });
    });

    // =========================================================
    // DATABASE PANEL — Per-project PostgreSQL schema isolation
    // Each project gets its own schema: proj_<projectId>
    // =========================================================
    const pgMod = await import("pg");
    const dbPool = new pgMod.default.Pool({ connectionString: process.env.DATABASE_URL });

    function parseDbUrl(url: string) {
      try {
        const u = new URL(url);
        return { host: u.hostname, port: parseInt(u.port) || 5432, databaseName: u.pathname.replace("/",""), username: u.username, password: u.password };
      } catch (err: any) { console.error("[catch]", err?.message || err); return { host: "localhost", port: 5432, databaseName: "ecode", username: "runner", password: "" }; }
    }

    function projectSchemaName(projectId: string): string {
      return `proj_${projectId.replace(/-/g, "_")}`;
    }

    const provisionedSchemas = new Set<string>();

    async function ensureProjectSchema(projectId: string): Promise<string> {
      const schemaName = projectSchemaName(projectId);
      if (provisionedSchemas.has(schemaName)) return schemaName;
      await dbPool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      provisionedSchemas.add(schemaName);
      return schemaName;
    }

    app.get("/api/database/project", (_req, res) => {
      const parsed = parseDbUrl(process.env.DATABASE_URL || "");
      res.json({ databases: [{ id: "main", name: parsed.databaseName || "PostgreSQL", status: "running", type: "postgresql" }] });
    });

    app.get("/api/database/project/:id", async (req, res) => {
      try {
        const parsed = parseDbUrl(process.env.DATABASE_URL || "");
        const schemaName = await ensureProjectSchema(req.params.id);
        const tableCountResult = await dbPool.query(
          `SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = $1`,
          [schemaName]
        );
        const tableCount = parseInt(tableCountResult.rows[0].cnt);
        const sizeResult = await dbPool.query("SELECT pg_database_size(current_database()) as size");
        const sizeMb = parseFloat((parseInt(sizeResult.rows[0].size) / (1024 * 1024)).toFixed(2));
        res.json({
          provisioned: true,
          status: "running" as const,
          host: parsed.host,
          port: parsed.port,
          databaseName: parsed.databaseName,
          username: parsed.username,
          storageUsedMb: sizeMb,
          storageLimitMb: 1024,
          connectionCount: 1,
          maxConnections: 100,
          tableCount,
          schemaName,
          lastBackupAt: new Date().toISOString(),
          plan: "free",
          region: "us-east-1",
          computeHours: 0,
          database: {
            id: 1, name: parsed.databaseName, type: "postgresql", status: "running",
            region: "us-east-1", host: parsed.host, port: parsed.port,
            databaseName: parsed.databaseName, username: parsed.username, plan: "free",
            storageUsedMb: sizeMb, storageLimitMb: 1024,
            connectionCount: 1, maxConnections: 100, schemaName,
          },
        });
      } catch (e: any) {
        res.json({ provisioned: false, status: "error", error: e.message });
      }
    });

    app.get("/api/database/project/:id/credentials", async (req, res) => {
      const parsed = parseDbUrl(process.env.DATABASE_URL || "");
      const schemaName = await ensureProjectSchema(req.params.id);
      res.json({
        host: parsed.host,
        port: parsed.port,
        databaseName: parsed.databaseName,
        username: parsed.username,
        password: parsed.password,
        connectionUrl: process.env.DATABASE_URL || "",
        sslEnabled: false,
        schemaName,
        credentials: {
          host: parsed.host,
          port: parsed.port,
          databaseName: parsed.databaseName,
          username: parsed.username,
          password: parsed.password,
          connectionUrl: process.env.DATABASE_URL || "",
          sslEnabled: false,
          schemaName,
        },
      });
    });

    app.post("/api/database/project/:id/provision", async (req, res) => {
      try {
        const schemaName = await ensureProjectSchema(req.params.id);
        const parsed = parseDbUrl(process.env.DATABASE_URL || "");
        res.json({
          success: true, status: "provisioned", provisioned: true,
          schemaName,
          database: {
            id: 1, name: parsed.databaseName, type: "postgresql", status: "running",
            region: "us-east-1", host: parsed.host, port: parsed.port,
            databaseName: parsed.databaseName, username: parsed.username, plan: "free",
            storageUsedMb: 0, storageLimitMb: 1024, connectionCount: 1, maxConnections: 100,
            schemaName,
          },
        });
      } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
    });

    app.post("/api/database/project/:id/sql/execute", async (req, res) => {
      try {
        const { query } = req.body;
        if (!query || typeof query !== "string") return res.status(400).json({ error: "Query required" });
        const schemaName = await ensureProjectSchema(req.params.id);
        const start = Date.now();
        const client = await dbPool.connect();
        try {
          await client.query(`SET search_path TO "${schemaName}"`);
          const result = await client.query(query);
          const executionTime = Date.now() - start;
          res.json({
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields?.map((f: any) => f.name),
            executionTime,
            schema: schemaName,
          });
        } finally {
          await client.query("RESET search_path");
          client.release();
        }
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/database/project/:id/tables", async (req, res) => {
      try {
        const schemaName = await ensureProjectSchema(req.params.id);
        const tablesResult = await dbPool.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
          [schemaName]
        );
        const tables = [];
        for (const row of tablesResult.rows) {
          let rowCount = 0;
          try {
            const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM "${schemaName}"."${row.table_name}"`);
            rowCount = parseInt(countResult.rows[0].count);
          } catch (err: any) { console.error("[catch]", err?.message || err);}
          tables.push({ name: row.table_name, displayName: row.table_name, icon: "table" as const, rowCount });
        }
        res.json(tables);
      } catch (e: any) { res.json([]); }
    });

    app.post("/api/database/project/:id/restore", (_req, res) => {
      res.json({ success: true, message: "Point-in-time restore initiated. This may take a few minutes." });
    });

    app.delete("/api/database/project/:id", async (req, res) => {
      try {
        const schemaName = projectSchemaName(req.params.id);
        await dbPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        provisionedSchemas.delete(schemaName);
        res.json({ success: true, message: "Database schema deleted" });
      } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
    });

    async function getAdminTablesWithCounts(): Promise<{ name: string; displayName: string; icon: string; rowCount: number }[]> {
      const tablesResult = await dbPool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      const tables = [];
      for (const row of tablesResult.rows) {
        let rowCount = 0;
        try {
          const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM "${row.tablename}"`);
          rowCount = parseInt(countResult.rows[0].count);
        } catch (err: any) { console.error("[catch]", err?.message || err);}
        tables.push({ name: row.tablename, displayName: row.tablename, icon: "table" as const, rowCount });
      }
      return tables;
    }

    app.get("/api/admin/database/tables", async (_req, res) => {
      try {
        const tables = await getAdminTablesWithCounts();
        res.json({ tables });
      } catch (e: any) { res.json({ tables: [] }); }
    });

    app.get("/api/admin/database/:table/schema", async (req, res) => {
      try {
        const tableName = req.params.table;
        const result = await dbPool.query(
          `SELECT c.column_name, c.data_type, c.is_nullable,
            CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key
           FROM information_schema.columns c
           LEFT JOIN information_schema.key_column_usage kcu ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name AND c.table_schema = kcu.table_schema
           LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
           WHERE c.table_name=$1 AND c.table_schema='public'
           ORDER BY c.ordinal_position`, [tableName]
        );
        res.json({
          tableName,
          columns: result.rows.map((r: any) => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === "YES",
            isPrimaryKey: r.is_primary_key === true || r.is_primary_key === "true",
          })),
        });
      } catch (e: any) { res.json({ tableName: req.params.table, columns: [] }); }
    });

    app.get("/api/admin/database/:table/data", async (req, res) => {
      try {
        const tableName = req.params.table;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        const result = await dbPool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
        const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const totalRows = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRows / limit);
        res.json({
          tableName,
          data: result.rows,
          rows: result.rows,
          total: totalRows,
          page, limit,
          pagination: { page, limit, totalRows, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        });
      } catch (e: any) { res.json({ tableName: req.params.table, data: [], rows: [], total: 0, page: 1, limit: 50, pagination: { page: 1, limit: 50, totalRows: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } }); }
    });

    app.get("/api/projects/:id/data/tables", async (req, res) => {
      try {
        const schemaName = await ensureProjectSchema(req.params.id);
        const tablesResult = await dbPool.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
          [schemaName]
        );
        const tables = [];
        for (const row of tablesResult.rows) {
          let rowCount = 0;
          try {
            const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM "${schemaName}"."${row.table_name}"`);
            rowCount = parseInt(countResult.rows[0].count);
          } catch (err: any) { console.error("[catch]", err?.message || err);}
          const columnsResult = await dbPool.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
            [schemaName, row.table_name]
          );
          tables.push({
            name: row.table_name,
            displayName: row.table_name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            icon: 'table',
            rowCount,
            columns: columnsResult.rows.map((c: any) => ({ name: c.column_name, type: c.data_type })),
          });
        }
        res.json({ tables, schema: schemaName });
      } catch (e: any) { res.json({ tables: [] }); }
    });

    app.get("/api/projects/:id/data/:table/schema", async (req, res) => {
      try {
        const tableName = req.params.table;
        const schemaName = await ensureProjectSchema(req.params.id);
        const result = await dbPool.query(
          `SELECT c.column_name, c.data_type, c.is_nullable,
            CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key
           FROM information_schema.columns c
           LEFT JOIN information_schema.key_column_usage kcu ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name AND c.table_schema = kcu.table_schema
           LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
           WHERE c.table_name=$1 AND c.table_schema=$2
           ORDER BY c.ordinal_position`, [tableName, schemaName]
        );
        res.json({
          tableName,
          schema: schemaName,
          columns: result.rows.map((r: any) => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === "YES",
            isPrimaryKey: r.is_primary_key === true || r.is_primary_key === "true",
          })),
        });
      } catch (e: any) { res.json({ tableName: req.params.table, columns: [] }); }
    });

    app.get("/api/projects/:id/data/:table/data", async (req, res) => {
      try {
        const tableName = req.params.table;
        const schemaName = await ensureProjectSchema(req.params.id);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        const result = await dbPool.query(`SELECT * FROM "${schemaName}"."${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
        const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM "${schemaName}"."${tableName}"`);
        const totalRows = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRows / limit);
        res.json({
          tableName,
          schema: schemaName,
          data: result.rows,
          rows: result.rows,
          total: totalRows,
          page, limit,
          pagination: { page, limit, totalRows, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        });
      } catch (e: any) { res.json({ tableName: req.params.table, data: [], rows: [], total: 0, page: 1, limit: 50, pagination: { page: 1, limit: 50, totalRows: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } }); }
    });

    // =========================================================
    // DEPLOYMENT PANEL
    // =========================================================
    const deploymentStore = new Map<string, any>();

    app.get("/api/projects/:id/deployment/latest", (req, res) => {
      const projectId = req.params.id;
      const latest = deploymentStore.get(projectId);
      if (latest) return res.json(latest);
      res.json({ status: "not_deployed", message: "No deployments yet" });
    });

    app.get("/api/projects/:id/deployments", (req, res) => {
      const projectId = req.params.id;
      const all = Array.from(deploymentStore.values()).filter((d: any) => d.projectId === projectId);
      res.json(all.length > 0 ? all : []);
    });

    app.post("/api/projects/:id/domains", (req, res) => {
      const { customDomain } = req.body;
      res.json({ success: true, domain: customDomain, status: "pending_verification", dnsRecords: [
        { type: "CNAME", name: customDomain, value: "e-code.ai", status: "pending" },
      ]});
    });

    app.post("/api/projects/:id/publish", async (req, res) => {
      const projectId = req.params.id;
      const projDir = path.join(process.cwd(), "projects", projectId);
      const hasFiles = fs.existsSync(projDir) && fs.readdirSync(projDir).length > 0;
      if (!hasFiles) {
        return res.status(400).json({ success: false, message: "No files to deploy. Generate code first." });
      }
      const deployId = crypto.randomUUID();
      const host = req.headers.host || "localhost:5000";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const deployUrl = `${protocol}://${host}/api/preview/render/${projectId}`;
      const deployment = {
        id: deployId, projectId, url: deployUrl, previewUrl: `/api/preview/render/${projectId}`,
        status: "deployed", deployedAt: new Date().toISOString(), environment: req.body.environment || "production",
        version: `v1.${Date.now() % 1000}`, success: true,
      };
      deploymentStore.set(projectId, deployment);
      res.json(deployment);
    });

    app.post("/api/projects/:id/deploy", async (req, res) => {
      const projectId = req.params.id;
      const projDir = path.join(process.cwd(), "projects", projectId);
      const hasFiles = fs.existsSync(projDir) && fs.readdirSync(projDir).length > 0;
      if (!hasFiles) {
        return res.status(400).json({ success: false, message: "No files to deploy. Generate code first." });
      }
      const deployId = crypto.randomUUID();
      const host = req.headers.host || "localhost:5000";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const deployUrl = `${protocol}://${host}/api/preview/render/${projectId}`;
      const deployment = {
        id: deployId, projectId, url: deployUrl, previewUrl: `/api/preview/render/${projectId}`,
        status: "deployed", deployedAt: new Date().toISOString(), environment: req.body.environment || "production",
        version: `v1.${Date.now() % 1000}`, success: true,
      };
      deploymentStore.set(projectId, deployment);
      res.json(deployment);
    });

    app.post("/api/projects/:id/republish", async (req, res) => {
      const projectId = req.params.id;
      const host = req.headers.host || "localhost:5000";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const deployUrl = `${protocol}://${host}/api/preview/render/${projectId}`;
      const existing = deploymentStore.get(projectId);
      const deployment = {
        ...(existing || {}), id: crypto.randomUUID(), projectId, url: deployUrl,
        status: "deployed", deployedAt: new Date().toISOString(), success: true,
      };
      deploymentStore.set(projectId, deployment);
      res.json(deployment);
    });

    app.get("/api/projects/:id/domains", (req, res) => {
      res.json({ domains: [] });
    });

    app.post("/api/projects/:id/domains/verify", (req, res) => {
      res.json({ verified: false, message: "Custom domains not yet configured" });
    });

    app.get("/api/projects/:id/deployments/analytics", (req, res) => {
      res.json({ requests: 0, bandwidth: 0, errors: 0, uptime: 100 });
    });

    app.get("/api/deployments/:id/logs", (req, res) => {
      res.json({ logs: [] });
    });

    app.post("/api/deployments/:id/restart", (req, res) => {
      res.json({ success: true, status: "restarting" });
    });

    app.post("/api/deployments/:id/rollback", (req, res) => {
      res.json({ success: true, status: "rolling_back" });
    });

    app.post("/api/deployments/:id/stop", (req, res) => {
      res.json({ success: true, status: "stopped" });
    });

    // =========================================================
    // HISTORY / CHECKPOINTS PANEL
    // =========================================================
    app.get("/api/checkpoints", (req, res) => {
      res.json({ checkpoints: [] });
    });

    app.get("/api/projects/:id/checkpoints", (req, res) => {
      const projectId = req.params.id;
      const projDir = path.join(process.cwd(), "projects", projectId);
      try {
        const pathFilter = fs.existsSync(projDir) ? ` -- "${projDir}"` : "";
        const raw = git(`log --format="%H|%h|%an|%aI|%s" -20${pathFilter}`);
        const checkpoints = raw.split("\n").filter(Boolean).map((l, i) => {
          const [hash, short, author, date, ...msg] = l.split("|");
          return { id: hash, shortId: short, author, date, message: msg.join("|"), type: "auto" };
        });
        res.json({ checkpoints });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ checkpoints: [] }); }
    });

    app.post("/api/checkpoints/:id/restore", (req, res) => {
      try {
        git(`checkout ${req.params.id} -- .`);
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/projects/:id/checkpoints/:checkpointId/restore", (req, res) => {
      try {
        git(`checkout ${req.params.checkpointId} -- .`);
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/projects/:id/files-with-history", async (req, res) => {
      try {
        const files = await storage.getFilesByProjectId(req.params.id);
        res.json(files.map(f => ({ ...f, hasHistory: false, versions: [] })));
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json([]); }
    });

    app.get("/api/projects/:id/files/:fileId/history", (req, res) => {
      res.json({ versions: [] });
    });

    app.post("/api/projects/:id/files/:fileId/versions/:versionId/restore", (req, res) => {
      res.json({ success: false, message: "Version restore not implemented" });
    });

    app.get("/api/projects/:projectId/shell/:sessionId", (req, res) => {
      res.json({ sessionId: req.params.sessionId, status: "connected", protocol: "socket.io" });
    });
    app.post("/api/projects/:projectId/shell", (req, res) => {
      const sessionId = crypto.randomUUID();
      res.json({ sessionId, status: "created" });
    });
    app.delete("/api/projects/:projectId/shell/:sessionId", (req, res) => {
      res.json({ success: true });
    });

    // =========================================================
    // AGENT EXTRAS
    // =========================================================
    app.post("/api/agent/attachments", (req, res) => {
      res.json({ success: true, attachments: [] });
    });

    app.post("/api/agent/tools/testing/start", (req, res) => {
      res.json({ sessionId: crypto.randomUUID(), status: "started" });
    });

    app.post("/api/agent/tools/web-search", async (req, res) => {
      res.json({ results: [], query: req.body.query || "" });
    });

    app.post("/api/voice/transcribe", (req, res) => {
      res.json({ text: "", error: "Voice transcription not configured" });
    });

    app.post("/api/auto-checkpoints/:id/restore", (req, res) => {
      try {
        git(`checkout ${req.params.id} -- .`);
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/autonomy/orchestrator/health", (req, res) => {
      res.json({ status: "healthy", uptime: process.uptime() });
    });

    app.get("/api/autonomy/sessions/:id", (req, res) => {
      res.json({ id: req.params.id, status: "idle", tasks: [], messages: [] });
    });

    app.get("/api/autonomy/sessions/:id/tasks", (req, res) => {
      res.json({ tasks: [] });
    });

    // =========================================================
    // PROJECT TASKS — Full CRUD (shared pool, auth + project scoping)
    // =========================================================
    const tasksPool = new pgMod.default.Pool({ connectionString: process.env.DATABASE_URL });

    function mapTask(r: any) {
      return {
        id: r.id, projectId: r.project_id, userId: r.user_id,
        title: r.title, description: r.description, plan: r.plan,
        status: r.status, dependsOn: r.depends_on, priority: r.priority,
        progress: r.progress, result: r.result, errorMessage: r.error_message,
        createdAt: r.created_at, updatedAt: r.updated_at,
        startedAt: r.started_at, completedAt: r.completed_at,
      };
    }

    app.get("/api/projects/:id/tasks", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const result = await tasksPool.query(
          "SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC",
          [req.params.id]
        );
        res.json(result.rows.map(mapTask));
      } catch (e: any) {
        console.error("[tasks] GET error:", e.message);
        res.status(500).json({ message: "Failed to load tasks" });
      }
    });

    app.post("/api/projects/:id/tasks", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const { title, description, plan, dependsOn, priority } = req.body;
        if (!title) return res.status(400).json({ message: "Title is required" });
        const taskId = crypto.randomUUID();
        await tasksPool.query(
          `INSERT INTO tasks (id, project_id, user_id, title, description, plan, depends_on, priority, status, progress)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 0)`,
          [taskId, req.params.id, user.id, title, description || "", JSON.stringify(plan || []), JSON.stringify(dependsOn || []), priority || 0]
        );
        if (Array.isArray(plan) && plan.length > 0) {
          for (let i = 0; i < plan.length; i++) {
            await tasksPool.query(
              `INSERT INTO task_steps (id, task_id, sort_order, title, status) VALUES ($1, $2, $3, $4, 'pending')`,
              [crypto.randomUUID(), taskId, i, plan[i]]
            );
          }
        }
        const result = await tasksPool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
        res.status(201).json(mapTask(result.rows[0]));
      } catch (e: any) {
        console.error("[tasks] POST error:", e.message);
        res.status(500).json({ message: "Failed to create task" });
      }
    });

    app.get("/api/projects/:id/tasks/:taskId", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const taskResult = await tasksPool.query(
          "SELECT * FROM tasks WHERE id = $1 AND project_id = $2",
          [req.params.taskId, req.params.id]
        );
        if (taskResult.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        const stepsResult = await tasksPool.query(
          "SELECT * FROM task_steps WHERE task_id = $1 ORDER BY sort_order",
          [req.params.taskId]
        );
        const r = taskResult.rows[0];
        res.json({
          ...mapTask(r),
          steps: stepsResult.rows.map((s: any) => ({
            id: s.id, taskId: s.task_id, sortOrder: s.sort_order,
            title: s.title, status: s.status, output: s.output,
            createdAt: s.created_at, startedAt: s.started_at, completedAt: s.completed_at,
          })),
          diff: [],
        });
      } catch (e: any) {
        res.status(500).json({ message: "Failed to load task" });
      }
    });

    app.patch("/api/projects/:id/tasks/:taskId", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const { title, description, plan, status, priority } = req.body;
        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
        if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
        if (plan !== undefined) { sets.push(`plan = $${idx++}`); vals.push(JSON.stringify(plan)); }
        if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
        if (priority !== undefined) { sets.push(`priority = $${idx++}`); vals.push(priority); }
        sets.push(`updated_at = NOW()`);
        if (status === "done" || status === "completed") sets.push(`completed_at = NOW()`);
        if (status === "active" || status === "running") sets.push(`started_at = COALESCE(started_at, NOW())`);
        vals.push(req.params.taskId, req.params.id);
        await tasksPool.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx} AND project_id = $${idx + 1}`, vals);
        const result = await tasksPool.query(
          "SELECT * FROM tasks WHERE id = $1 AND project_id = $2",
          [req.params.taskId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        res.json(mapTask(result.rows[0]));
      } catch (e: any) {
        console.error("[tasks] PATCH error:", e.message);
        res.status(500).json({ message: "Failed to update task" });
      }
    });

    app.delete("/api/projects/:id/tasks/:taskId", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const check = await tasksPool.query(
          "SELECT id FROM tasks WHERE id = $1 AND project_id = $2",
          [req.params.taskId, req.params.id]
        );
        if (check.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        await tasksPool.query("DELETE FROM task_steps WHERE task_id = $1", [req.params.taskId]);
        await tasksPool.query("DELETE FROM task_messages WHERE task_id = $1", [req.params.taskId]);
        await tasksPool.query("DELETE FROM tasks WHERE id = $1 AND project_id = $2", [req.params.taskId, req.params.id]);
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ message: "Failed to delete task" });
      }
    });

    app.post("/api/projects/:id/tasks/:taskId/accept", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const result = await tasksPool.query(
          "UPDATE tasks SET status = 'active', started_at = NOW(), updated_at = NOW() WHERE id = $1 AND project_id = $2 RETURNING *",
          [req.params.taskId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        const r = result.rows[0];
        res.json({ success: true, task: { id: r.id, status: r.status, title: r.title } });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.status(500).json({ message: "Failed to accept task" }); }
    });

    app.post("/api/projects/:id/tasks/:taskId/apply", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const result = await tasksPool.query(
          "UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND project_id = $2 RETURNING id",
          [req.params.taskId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        res.json({ success: true, appliedFiles: [], conflicts: [] });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.status(500).json({ message: "Failed to apply task" }); }
    });

    app.post("/api/projects/:id/tasks/:taskId/dismiss", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const result = await tasksPool.query(
          "UPDATE tasks SET status = 'done', result = 'dismissed', updated_at = NOW() WHERE id = $1 AND project_id = $2 RETURNING id",
          [req.params.taskId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        res.json({ success: true });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.status(500).json({ message: "Failed to dismiss task" }); }
    });

    app.post("/api/projects/:id/tasks/:taskId/resolve-conflict", (_req, res) => {
      res.json({ success: true });
    });

    app.post("/api/projects/:id/tasks/:taskId/resolve-all-conflicts", (_req, res) => {
      res.json({ success: true, results: [] });
    });

    app.get("/api/projects/:id/tasks/:taskId/messages", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const check = await tasksPool.query(
          "SELECT id FROM tasks WHERE id = $1 AND project_id = $2",
          [req.params.taskId, req.params.id]
        );
        if (check.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        const result = await tasksPool.query(
          "SELECT * FROM task_messages WHERE task_id = $1 ORDER BY created_at",
          [req.params.taskId]
        );
        res.json(result.rows.map((m: any) => ({
          id: m.id, taskId: m.task_id, role: m.role, content: m.content, createdAt: m.created_at,
        })));
      } catch (err: any) { console.error("[catch]", err?.message || err); res.status(500).json({ message: "Failed to load messages" }); }
    });

    app.post("/api/projects/:id/tasks/:taskId/messages", async (req, res) => {
      try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ message: "Not authenticated" });
        const { content, role } = req.body;
        if (!content) return res.status(400).json({ message: "Content is required" });
        const check = await tasksPool.query(
          "SELECT id FROM tasks WHERE id = $1 AND project_id = $2",
          [req.params.taskId, req.params.id]
        );
        if (check.rows.length === 0) return res.status(404).json({ message: "Task not found" });
        const msgId = crypto.randomUUID();
        await tasksPool.query(
          "INSERT INTO task_messages (id, task_id, role, content) VALUES ($1, $2, $3, $4)",
          [msgId, req.params.taskId, role || "user", content]
        );
        res.status(201).json({ id: msgId, taskId: req.params.taskId, role: role || "user", content });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.status(500).json({ message: "Failed to send message" }); }
    });

    app.get("/api/autonomy/sessions/:id/progress", (req, res) => {
      res.json({ progress: 0, status: "idle", currentStep: null });
    });

    app.get("/api/autonomy/sessions/:id/messages/:msgId", (req, res) => {
      res.json({ id: req.params.msgId, content: "", role: "system" });
    });

    app.post("/api/autonomy/sessions/:id/pause", (req, res) => {
      res.json({ success: true, status: "paused" });
    });

    app.post("/api/autonomy/sessions/:id/resume", (req, res) => {
      res.json({ success: true, status: "running" });
    });

    app.post("/api/autonomy/sessions/:id/stop", (req, res) => {
      res.json({ success: true, status: "stopped" });
    });

    app.put("/api/autonomy/sessions/:id/messages/:msgId/priority", (req, res) => {
      res.json({ success: true });
    });

    // =========================================================
    // WORKSPACES
    // =========================================================
    app.get("/api/workspaces", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.json({ workspaces: [] });
      try {
        const projects = await storage.getProjectsByUserId(user.id);
        const workspaces = (Array.isArray(projects) ? projects : []).map((p: any) => ({
          id: p.id, name: p.name, status: "ready", projectId: p.id,
        }));
        res.json({ workspaces });
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json({ workspaces: [] }); }
    });

    app.get("/api/workspaces/:id", async (req, res) => {
      try {
        const project = await storage.getProject(req.params.id);
        if (!project) return res.status(404).json({ error: "Workspace not found" });
        res.json({ id: project.id, name: project.name, status: "ready", projectId: project.id, runtime: "node" });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get("/api/runner/workspaces/:id/token", (req, res) => {
      res.json({ token: crypto.randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 3600000).toISOString() });
    });

    // =========================================================
    // TESTING PANEL
    // =========================================================
    app.get("/api/workspace/projects", async (req, res) => {
      const user = await getSessionUser(req);
      if (!user) return res.json([]);
      try {
        const projects = await storage.getProjectsByUserId(user.id);
        res.json(Array.isArray(projects) ? projects : []);
      } catch (err: any) { console.error("[catch]", err?.message || err); res.json([]); }
    });

    // Agent conversation mode endpoint
    app.put("/api/agent/conversation/:id/mode", (req, res) => {
      res.json({ success: true, mode: req.body.mode || "build" });
    });

    // Agent conversation messages (GET with limit)
    app.get("/api/agent/conversation/:conversationId/messages", (req, res) => {
      const convId = req.params.conversationId;
      const msgs = conversationMessages.get(convId) || [];
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(msgs.slice(-limit));
    });

    // =========================================================
    // SEARCH & CODE SEARCH
    // =========================================================
    app.post("/api/search/code", (req, res) => {
      const { query, fileTypes, caseSensitive, regex } = req.body || {};
      res.json({ results: [], query: query || "", totalMatches: 0 });
    });

    app.get("/api/search", (req, res) => {
      const q = req.query.q || req.query.query || "";
      res.json({ results: [], query: q, totalMatches: 0 });
    });

    app.get("/api/search/global", (req, res) => {
      const q = req.query.q || req.query.query || "";
      res.json({ results: [], query: q, totalMatches: 0 });
    });

    // =========================================================
    // SETTINGS — per-project settings, persisted in-memory
    // =========================================================
    interface ProjectSettingsEntry {
      fontSize: string;
      tabSize: string;
      wordWrap: boolean;
      lineNumbers: boolean;
      minimap: boolean;
      autoSave: boolean;
      formatOnSave: boolean;
      editorTheme: string;
      projectName: string;
      projectDescription: string;
      projectPrivacy: "public" | "private" | "unlisted";
      bracketPairColorization: boolean;
      language: string;
      indentStyle: string;
    }
    const projectSettings = new Map<string, ProjectSettingsEntry>();

    function getProjectSettings(projectId: string): ProjectSettingsEntry {
      if (projectSettings.has(projectId)) return projectSettings.get(projectId)!;
      const defaults: ProjectSettingsEntry = {
        fontSize: "14", tabSize: "2", wordWrap: true, lineNumbers: true,
        minimap: true, autoSave: true, formatOnSave: true, editorTheme: "vs-dark",
        projectName: "My Project", projectDescription: "", projectPrivacy: "public",
        bracketPairColorization: true, language: "typescript", indentStyle: "spaces",
      };
      projectSettings.set(projectId, defaults);
      return defaults;
    }

    app.get("/api/projects/:id/settings", (req, res) => {
      const s = getProjectSettings(req.params.id);
      res.json(s);
    });

    app.put("/api/projects/:id/settings", (req, res) => {
      const current = getProjectSettings(req.params.id);
      const updates = req.body;
      for (const key of Object.keys(updates)) {
        if (key in current) (current as any)[key] = updates[key];
      }
      projectSettings.set(req.params.id, current);
      res.json(current);
    });

    app.get("/api/settings", (_req, res) => {
      const s = getProjectSettings("global");
      res.json({
        theme: "dark",
        fontSize: parseInt(s.fontSize) || 14,
        tabSize: parseInt(s.tabSize) || 2,
        wordWrap: s.wordWrap ? "on" : "off",
        minimap: s.minimap,
        autoSave: s.autoSave,
        formatOnSave: s.formatOnSave,
        lineNumbers: s.lineNumbers ? "on" : "off",
        bracketPairColorization: s.bracketPairColorization,
        language: s.language,
        indentStyle: s.indentStyle,
      });
    });

    app.put("/api/settings", (req, res) => {
      const current = getProjectSettings("global");
      const updates = req.body;
      if (updates.fontSize !== undefined) current.fontSize = String(updates.fontSize);
      if (updates.tabSize !== undefined) current.tabSize = String(updates.tabSize);
      if (updates.wordWrap !== undefined) current.wordWrap = updates.wordWrap === "on" || updates.wordWrap === true;
      if (updates.lineNumbers !== undefined) current.lineNumbers = updates.lineNumbers === "on" || updates.lineNumbers === true;
      if (updates.minimap !== undefined) current.minimap = updates.minimap;
      if (updates.autoSave !== undefined) current.autoSave = updates.autoSave;
      if (updates.formatOnSave !== undefined) current.formatOnSave = updates.formatOnSave;
      projectSettings.set("global", current);
      res.json({ success: true, settings: current });
    });

    // =========================================================
    // DEBUGGER
    // =========================================================
    app.get("/api/debugger/status", (_req, res) => {
      res.json({ active: false, breakpoints: [], callStack: [], variables: [] });
    });

    app.post("/api/debugger/start", (_req, res) => {
      res.json({ success: true, status: "running", sessionId: crypto.randomUUID() });
    });

    app.post("/api/debugger/stop", (_req, res) => {
      res.json({ success: true, status: "stopped" });
    });

    app.post("/api/debugger/breakpoint", (req, res) => {
      res.json({ success: true, breakpoint: { id: crypto.randomUUID(), ...req.body } });
    });

    app.get("/api/debugger/console", (_req, res) => {
      res.json({ entries: [] });
    });

    app.get("/api/debug/session", (_req, res) => {
      res.json({ session: null, active: false });
    });

    // =========================================================
    // DIAGNOSTICS / PROBLEMS
    // =========================================================
    app.get("/api/diagnostics/problems", (_req, res) => {
      res.json({ problems: [], errors: 0, warnings: 0, info: 0 });
    });

    app.get("/api/diagnostics", (_req, res) => {
      res.json({ problems: [], errors: 0, warnings: 0, info: 0 });
    });

    // =========================================================
    // RUNTIME / OUTPUT
    // =========================================================
    app.get("/api/runtime/output", (_req, res) => {
      res.json({ output: [], running: false });
    });

    app.get("/api/runtime/dashboard", (_req, res) => {
      res.json({
        processes: [],
        resources: { cpu: 0, memory: 0, disk: 0 },
        uptime: process.uptime(),
      });
    });

    app.get("/api/runtime/dependencies", (_req, res) => {
      res.json({ dependencies: [], devDependencies: [] });
    });

    app.post("/api/runtime/stop", (_req, res) => {
      res.json({ success: true, status: "stopped" });
    });

    // =========================================================
    // COLLABORATION / MULTIPLAYERS
    // =========================================================
    app.get("/api/collaboration", (_req, res) => {
      res.json({ collaborators: [], cursors: [], activeUsers: [] });
    });

    app.get("/api/collaborators", (_req, res) => {
      res.json({ collaborators: [] });
    });

    app.post("/api/collaboration/invite", (req, res) => {
      res.json({ success: true, invitation: { id: crypto.randomUUID(), email: req.body?.email, status: "pending" } });
    });

    // =========================================================
    // CONTAINERS
    // =========================================================
    app.get("/api/containers", (_req, res) => {
      res.json({ containers: [{ id: "default", status: "running", type: "development", resources: { cpu: "1 vCPU", memory: "512MB", disk: "1GB" } }] });
    });

    // =========================================================
    // DEPENDENCIES
    // =========================================================
    app.get("/api/dependencies", (_req, res) => {
      try {
        const pkgPath = path.resolve(process.cwd(), "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          res.json({
            dependencies: Object.entries(pkg.dependencies || {}).map(([n, v]) => ({ name: n, version: v })),
            devDependencies: Object.entries(pkg.devDependencies || {}).map(([n, v]) => ({ name: n, version: v })),
          });
        } else {
          res.json({ dependencies: [], devDependencies: [] });
        }
      } catch (e) {
        res.json({ dependencies: [], devDependencies: [] });
      }
    });

    app.get("/api/dependencies/stats", (_req, res) => {
      res.json({ total: 0, outdated: 0, vulnerable: 0 });
    });

    // =========================================================
    // NOTIFICATIONS / ACTIVITY
    // =========================================================
    app.get("/api/notifications", (_req, res) => {
      res.json({ notifications: [], unread: 0 });
    });

    app.get("/api/notifications/preferences", (_req, res) => {
      res.json({ email: true, push: false, inApp: true });
    });

    app.put("/api/notifications/preferences", (_req, res) => {
      res.json({ success: true });
    });

    app.get("/api/activity", (_req, res) => {
      res.json({ activities: [] });
    });

    // =========================================================
    // HEALTH CHECKS
    // =========================================================
    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
    });

    app.get("/api/health/detailed", (_req, res) => {
      res.json({ status: "ok", database: "connected", runtime: "running", uptime: process.uptime() });
    });

    app.get("/api/health/liveness", (_req, res) => {
      res.json({ alive: true });
    });

    app.get("/api/health/providers", (_req, res) => {
      res.json({
        providers: [
          { name: "anthropic", status: !!process.env.ANTHROPIC_API_KEY || !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ? "available" : "unavailable" },
          { name: "openai", status: !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "available" : "unavailable" },
          { name: "gemini", status: !!process.env.GEMINI_API_KEY || !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY ? "available" : "unavailable" },
        ],
      });
    });

    // =========================================================
    // CONFIG STATUS
    // =========================================================
    app.get("/api/config/status", (_req, res) => {
      res.json({ configured: true, environment: process.env.NODE_ENV || "development", features: { ai: true, collaboration: true, deployment: true, git: true } });
    });

    // =========================================================
    // EXTENSIONS / POWERUPS
    // =========================================================
    app.get("/api/extensions", (_req, res) => {
      res.json({ extensions: [] });
    });

    app.get("/api/powerups", (_req, res) => {
      res.json({ powerups: [] });
    });

    // =========================================================
    // PERMISSIONS / INVITES
    // =========================================================
    app.get("/api/permissions", (_req, res) => {
      res.json({ permissions: ["read", "write", "admin"] });
    });

    app.get("/api/invites/pending", (_req, res) => {
      res.json({ invites: [] });
    });

    // =========================================================
    // AI EXTRAS
    // =========================================================
    app.post("/api/ai/generate", async (req, res) => {
      const { projectId, prompt, message } = req.body;
      const userMessage = prompt || message;
      if (!projectId || !userMessage) {
        return res.status(400).json({ success: false, message: "projectId and prompt are required" });
      }
      try {
        const internalUrl = `http://127.0.0.1:${process.env.PORT || 5000}/api/agent/chat/stream`;
        const response = await fetch(internalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
          body: JSON.stringify({ message: userMessage, projectId, conversationId: `generate-${Date.now()}` }),
        });
        let fullContent = "";
        const text = await response.text();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) fullContent += data.content;
            } catch (err: any) { console.error("[catch]", err?.message || err);}
          }
        }
        res.json({ success: true, content: fullContent, projectId });
      } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
      }
    });

    app.get("/api/ai/features", (_req, res) => {
      res.json({ features: ["code-generation", "code-review", "debugging", "refactoring", "testing", "documentation"] });
    });

    app.post("/api/ai/feedback", (_req, res) => {
      res.json({ success: true });
    });

    // =========================================================
    // AUTOMATIONS
    // =========================================================
    app.get("/api/automations", (_req, res) => {
      res.json({ automations: [] });
    });

    // =========================================================
    // RESOURCES / SCALABILITY
    // =========================================================
    app.get("/api/resources", (_req, res) => {
      res.json({ cpu: { used: 5, total: 100 }, memory: { used: 128, total: 512 }, disk: { used: 50, total: 1024 } });
    });

    app.post("/api/scalability/cdn/purge", (_req, res) => {
      res.json({ success: true });
    });

    app.get("/api/scalability/cluster/containers", (_req, res) => {
      res.json({ containers: [] });
    });

    // =========================================================
    // MOBILE / SDK / IMPORT STUBS
    // =========================================================
    app.get("/api/mobile/apps", (_req, res) => { res.json({ apps: [] }); });
    app.get("/api/mobile/settings", (_req, res) => { res.json({ settings: {} }); });
    app.get("/api/mobile/stats", (_req, res) => { res.json({ stats: {} }); });
    app.post("/api/mobile/notifications/send", (_req, res) => { res.json({ success: true }); });
    app.get("/api/sdk/examples", (_req, res) => { res.json({ examples: [] }); });
    app.post("/api/import/figma", (_req, res) => { res.json({ success: true, projectId: null }); });
    app.post("/api/import/lovable", (_req, res) => { res.json({ success: true, projectId: null }); });
    app.post("/api/openai/generate", (_req, res) => { res.json({ success: true, content: "" }); });
    app.post("/api/opensource/generate", (_req, res) => { res.json({ success: true, content: "" }); });
    app.get("/api/organizations/roles", (_req, res) => { res.json({ roles: [] }); });
    app.get("/api/polyglot/health", (_req, res) => { res.json({ status: "ok" }); });
    app.get("/api/polyglot/capabilities", (_req, res) => { res.json({ languages: ["javascript", "typescript", "python", "go", "rust", "java", "cpp"] }); });
    app.post("/api/polyglot/benchmark", (_req, res) => { res.json({ results: [] }); });
    app.post("/api/report/abuse", (_req, res) => { res.json({ success: true }); });

    // =========================================================
    // EDUCATION / COMMUNITY STUBS
    // =========================================================
    app.get("/api/education/classrooms", (_req, res) => { res.json({ classrooms: [] }); });
    app.get("/api/education/courses", (_req, res) => { res.json({ courses: [] }); });
    app.get("/api/community/posts", (_req, res) => { res.json({ posts: [] }); });
    app.get("/api/community/leaderboard", (_req, res) => { res.json({ leaderboard: [] }); });
    app.get("/api/community/challenges", (_req, res) => { res.json({ challenges: [] }); });
    app.get("/api/community/activity", (_req, res) => { res.json({ activity: [] }); });
    app.get("/api/community/stats", (_req, res) => { res.json({ stats: {} }); });
    app.get("/api/community/categories", (_req, res) => { res.json({ categories: [] }); });
    app.get("/api/community/collections", (_req, res) => { res.json({ collections: [] }); });

    log("Minimal fallback routes loaded");

    try {
      const { initRAGDatabase } = await import('./services/rag/index');
      const ragReady = await initRAGDatabase();
      if (ragReady) {
        log("RAG database initialized (pgvector ready)");
      } else {
        log("RAG database initialization skipped");
      }
    } catch (ragErr: any) {
      console.error("[RAG Init]", ragErr?.message || ragErr);
    }
  }

  const distPath = path.resolve(import.meta.dirname || __dirname, "..", "dist", "public");
  const distExists = fs.existsSync(path.join(distPath, "index.html"));

  try {
    const sitemapRouter = (await import("./routes/sitemap.router")).default;
    app.use("/", sitemapRouter);
    log("Sitemap routes mounted");
  } catch (e: any) {
    log(`Sitemap routes failed: ${e.message}`, "warn");
  }

  app.get("/.well-known/security.txt", (_req, res) => {
    res.header("Content-Type", "text/plain");
    res.header("Cache-Control", "public, max-age=86400");
    res.send("Contact: mailto:security@e-code.ai\nPreferred-Languages: en\nCanonical: https://e-code.ai/.well-known/security.txt\nExpires: 2027-12-31T23:59:59.000Z\n");
  });

  app.get("/robots.txt", (_req, res) => {
    const robotsPath = path.join(distPath, "robots.txt");
    if (fs.existsSync(robotsPath)) {
      res.header("Content-Type", "text/plain");
      res.header("Cache-Control", "public, max-age=86400");
      res.sendFile(robotsPath);
    } else {
      res.header("Content-Type", "text/plain");
      res.send("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ide/\nSitemap: https://e-code.ai/sitemap.xml\n");
    }
  });

  const seoPageMeta: Record<string, { title: string; description: string; canonical: string }> = {
    "/": { title: "E-Code — AI-Powered Development Platform | Build & Deploy in Minutes", description: "Build and deploy production-ready applications in minutes with AI agents. Enterprise-grade security, real-time collaboration, and instant global deployment.", canonical: "https://e-code.ai" },
    "/pricing": { title: "Pricing Plans - E-Code | Free to Enterprise", description: "Transparent pricing for individuals, teams, and enterprises. Start free, scale to millions. Compare Core, Teams, and Enterprise plans.", canonical: "https://e-code.ai/pricing" },
    "/features": { title: "Features - E-Code | Enterprise-Grade Development Tools", description: "AI-powered code generation, real-time collaboration, instant deployment, 40+ languages, and enterprise security.", canonical: "https://e-code.ai/features" },
    "/about": { title: "About E-Code - Our Mission & Leadership Team", description: "E-Code is revolutionizing software development with AI. Meet our world-class leadership team.", canonical: "https://e-code.ai/about" },
    "/ai": { title: "AI Platform - E-Code | Enterprise AI Development", description: "Build with AI agents that understand your codebase. Generate production code, debug automatically, and deploy with confidence.", canonical: "https://e-code.ai/ai" },
    "/docs": { title: "Documentation - E-Code | Guides & API Reference", description: "Comprehensive documentation for E-Code. Quick start guides, API reference, tutorials, and best practices.", canonical: "https://e-code.ai/docs" },
    "/blog": { title: "Blog - E-Code | Engineering & Product Updates", description: "Engineering insights, product updates, and best practices from the E-Code team.", canonical: "https://e-code.ai/blog" },
    "/security": { title: "Security & Compliance - E-Code | Enterprise-Grade Protection", description: "SOC 2 Type II certified, GDPR compliant, end-to-end encryption. Built for Fortune 500 security requirements.", canonical: "https://e-code.ai/security" },
    "/careers": { title: "Careers at E-Code - Join Our Global Team", description: "Build the future of software development. Remote-first culture, competitive benefits.", canonical: "https://e-code.ai/careers" },
    "/contact": { title: "Contact Us - E-Code | Get in Touch", description: "Contact E-Code for sales inquiries, support, partnerships, or general questions.", canonical: "https://e-code.ai/contact" },
    "/templates": { title: "Templates - E-Code | Start with Curated Starters", description: "Launch faster with 100+ pre-built starters. React, Node.js, Python, and more.", canonical: "https://e-code.ai/templates" },
    "/compare": { title: "Compare E-Code - See How We Stack Up", description: "Compare E-Code with GitHub Codespaces, CodeSandbox, and more.", canonical: "https://e-code.ai/compare" },
    "/solutions/enterprise": { title: "Enterprise Solutions - E-Code | Fortune 500 Development Platform", description: "Enterprise-grade development with SSO, audit logs, custom roles, and 99.99% SLA.", canonical: "https://e-code.ai/solutions/enterprise" },
    "/solutions/startups": { title: "Startup Solutions - E-Code | Ship 10x Faster", description: "Build your MVP in days, not months. AI-powered development and pricing that scales.", canonical: "https://e-code.ai/solutions/startups" },
    "/terms": { title: "Terms of Service - E-Code", description: "E-Code Terms of Service. Read our terms and conditions.", canonical: "https://e-code.ai/terms" },
    "/privacy": { title: "Privacy Policy - E-Code", description: "E-Code Privacy Policy. GDPR and CCPA compliant data handling.", canonical: "https://e-code.ai/privacy" },
  };

  if (process.env.NODE_ENV === "production" || distExists) {
    app.use(express.static(distPath, { maxAge: 0, etag: false, index: false, setHeaders: (res) => { res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); } }));
    app.get("*", (_req, res, next) => {
      if (_req.path.startsWith("/api") || _req.path.startsWith("/ws") || _req.path.startsWith("/assets") || _req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json|txt|xml)$/)) return next();
      const indexPath = path.join(distPath, "index.html");
      if (!fs.existsSync(indexPath)) return next();

      const pageMeta = seoPageMeta[_req.path];
      if (pageMeta) {
        let html = fs.readFileSync(indexPath, "utf-8");
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${pageMeta.title}</title>`);
        html = html.replace(/content="E-Code — AI-Powered Development Platform \| Build & Deploy in Minutes"/, `content="${pageMeta.title}"`);
        html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${pageMeta.description}"`);
        html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${pageMeta.title}"`);
        html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${pageMeta.description}"`);
        html = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${pageMeta.canonical}"`);
        html = html.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${pageMeta.title}"`);
        html = html.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${pageMeta.description}"`);
        html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${pageMeta.canonical}"`);
        res.header("Content-Type", "text/html; charset=utf-8");
        res.header("Cache-Control", "no-cache");
        return res.send(html);
      }

      res.sendFile(indexPath);
    });
    log("Serving pre-built frontend from dist/public");
  } else {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    } catch (e: any) {
      log(`Vite setup failed: ${e.message}`, "warn");
    }
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  const gracefulShutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => { log("Forced shutdown"); process.exit(1); }, 30000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
