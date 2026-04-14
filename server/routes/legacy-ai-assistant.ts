// AUTO-EXTRACTED from server/routes.ts (lines 8371-13215)
// Original section: ai-assistant
// DO NOT manually edit this file - it was extracted by scripts/extract-routes-section.js

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "../storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS, AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing } from "@shared/schema";
import { decrypt, encrypt } from "../encryption";
import { z } from "zod";
import { executeCode, sendStdinToProcess, killInteractiveProcess, resolveRunCommand } from "../executor";
import { getProjectConfig, parseReplitConfig, serializeReplitConfig, getEnvironmentMetadata, type ReplitConfig } from "../configParser";
import { parseReplitNix, serializeReplitNix } from "../nixParser";
import { executionPool } from "../executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity, materializeProjectFiles as materializeTerminalFiles, getProjectWorkspaceDir, invalidateProjectWorkspace, syncFileToWorkspace, deleteFileFromWorkspace, renameFileInWorkspace, listWorkspaceFiles, destroyProjectTerminals } from "../terminal";
import { createDebugSession, connectToInspector, handleDebugCommand, getDebugSession, cleanupSession, getInspectPort } from "../debugger";
import { log } from "../index";
import { previewEvents } from "../preview/preview-websocket";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail, isEmailConfigured } from "../email";
import { buildAndDeploy, buildAndDeployMultiArtifact, createDeploymentRouter, rollbackDeployment, listDeploymentVersions, teardownDeployment, performHealthCheck, getProcessLogs, getProcessStatus, stopManagedProcess, restartManagedProcess, shutdownAllProcesses, cleanupProjectProcesses, setProcessLogCallback } from "../deploymentEngine";
import { getProcessInfo } from "../processManager";
import type { DeploymentType } from "../deploymentEngine";
import { incrementRequests, incrementErrors, recordResponseTime, getAndResetCounters, getRealMetrics } from "../metricsCollector";
import { DEFAULT_SHORTCUTS, isValidShortcutValue, findConflict, mergeWithDefaults } from "@shared/keyboardShortcuts";
import { createCheckpoint, restoreCheckpoint, getCheckpointDiff } from "../checkpointService";
import { triggerBackupAsync, createBackup, restoreFromBackup, getBackupStatus, verifyBackupIntegrity } from "../gitBackupService";
import { addDomain, verifyDomain, removeDomain, getProjectDomains, getDomainById, getACMEChallengeResponse } from "../domainManager";
import { checkUserRateLimit, checkIpRateLimit, acquireExecutionSlot, releaseExecutionSlot, recordExecution, getExecutionMetrics, getSystemMetrics, getClientIp } from "../rateLimiter";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, Type, type FunctionDeclaration, type Tool, type Content } from "@google/genai";
import { diffArrays } from "diff";
import multer from "multer";
import * as runnerClient from "../runnerClient";
import * as github from "../github";
import * as gitService from "../git";
import { getConnectorKey, getSupportedConnectors, getConnectorOperations, executeConnectorOperation, getConnectorDescription } from "../connectors";
import path_ from "path";
import { posix as pathPosix } from "path";
import { generateImageBuffer, editImages } from "../replit_integrations/image/client";
import { registerImageRoutes } from "../replit_integrations/image";
import { searchBraveImages, BRAVE_CREDIT_COST, generateSpeech, AVAILABLE_VOICES, TTS_CREDIT_COST, generateNanoBananaImage, NANOBANANA_CREDIT_COST, generateDalleImage, DALLE_CREDIT_COST, searchTavily, TAVILY_CREDIT_COST } from "../agentServices";
import { generateFile, getMimeType, type FileGenerationInput, type FileSection } from "../fileGeneration";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import { importFromGitHub, importFromZip, importFromFigma, importFromVercel, importFromBolt, importFromLovable, validateImportSource, startAsyncImport, startAsyncZipImport, getImportJob, validateZipBuffer, fetchFigmaDesignContext } from "../importService";
import { handleLSPConnection } from "../lspBridge";
import { getTemplateById, getAllTemplates } from "../templates";
import { generateEcodeContent, getEcodeFilename, buildProjectStructureTree, detectDependencies, detectDependenciesFromPackageJson, parseUserPreferences, parseProjectContext, updateEcodeStructureSection, buildEcodePromptContext, shouldAutoUpdate } from "../ecodeTemplates";
import { addCollaborator, removeCollaborator, getCollaborators, updateActiveFile, broadcastToCollaborators, broadcastPresence, getOrCreateFileDoc, initializeFileDoc, getFileDocContent, broadcastBinaryToCollaborators, setFilePersister, type CollabMessage, Y } from "../collaboration";
import { validateAIMessages, sanitizeAIFilename, sanitizeAIFileContent, resolveTopAgentMode, MAX_AGENT_ITERATIONS, MAX_PROMPT_LENGTH, MAX_GENERATED_FILES, MAX_MESSAGE_CONTENT_LENGTH, MAX_MESSAGES_COUNT, MAX_AI_FILENAME_LENGTH, FORBIDDEN_FILENAME_PATTERNS } from "./ai-helpers";



export interface RouteContext {
  app: Express;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  csrfProtection: (req: Request, res: Response, next: NextFunction) => void;
  authLimiter: any;
  apiLimiter: any;
  aiLimiter: any;
  aiGenerateLimiter: any;
  runLimiter: any;
  checkoutLimiter: any;
  errorBuffer: Array<{ timestamp: string; method: string; path: string; status: number; message: string }>;
  MAX_ERROR_BUFFER: number;
  serverStartTime: number;
  broadcastToProject: (projectId: string, data: any) => void;
  broadcastToUser: (userId: string, data: any) => void;
  wsClients: Map<string, Set<WebSocket>>;
  wsUserClients: Map<string, Set<WebSocket>>;
  verifyProjectAccess: (projectId: string, userId: string) => Promise<boolean>;
  verifyRecaptcha: (token: string | undefined) => Promise<boolean>;
  qstr: (val: unknown) => string;
  safeError: (err: any, fallback: string) => string;
  sanitizeAIFileContent: (content: string) => string;
  validateExternalUrl: (urlStr: string, allowedDomainSuffixes?: string[]) => { valid: boolean; url?: URL; error?: string };
  getAppUrl: () => string;
  generateCsrfToken: () => string;
  sessionMiddleware: any;
  httpServer: Server;
}


export async function registerAiAssistantRoutes(app: Express, ctx: RouteContext): Promise<void> {
  const {
    requireAuth,
    csrfProtection,
    authLimiter,
    apiLimiter,
    aiLimiter,
    aiGenerateLimiter,
    runLimiter,
    checkoutLimiter,
    errorBuffer,
    MAX_ERROR_BUFFER,
    serverStartTime,
    broadcastToProject,
    broadcastToUser,
    wsClients,
    wsUserClients,
    verifyProjectAccess,
    verifyRecaptcha,
    qstr,
    safeError,
    sanitizeAIFileContent,
    validateExternalUrl,
    getAppUrl,
    generateCsrfToken,
    sessionMiddleware,
    httpServer,
  } = ctx;
  const path = path_;

  // --- AI ASSISTANT (direct provider keys, no ModelFarm proxy) ---
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  });

  const anthropicDirect = anthropic;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  });

  const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  });

  const geminiDirect = gemini;

  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY || "",
    baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://replit.com",
      "X-Title": "E-Code IDE",
    },
  });

  const perplexityClient = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY || "",
    baseURL: "https://api.perplexity.ai",
  });

  const mistralClient = new OpenAI({
    apiKey: process.env.MISTRAL_API_KEY || "",
    baseURL: "https://api.mistral.ai/v1",
  });

  const OPENROUTER_PRIVACY_BODY = {
    provider: {
      data_collection: "deny",
      allow_fallbacks: false,
    },
    transforms: ["middle-out"],
  };

  const OPENROUTER_REQUEST_OPTS = {
    headers: { "X-OpenRouter-Privacy": "1" },
  };


  function validateExternalAIKey(model: string): string | null {
    if (model === "perplexity" && !process.env.PERPLEXITY_API_KEY) {
      return "Perplexity API key not configured. Add PERPLEXITY_API_KEY in your project's Integrations panel.";
    }
    if (model === "mistral" && !process.env.MISTRAL_API_KEY) {
      return "Mistral API key not configured. Add MISTRAL_API_KEY in your project's Integrations panel.";
    }
    return null;
  }

  function formatPerplexityCitations(response: any): string {
    if (!response?.citations || !Array.isArray(response.citations) || response.citations.length === 0) return "";
    return "\n\n---\n**Sources:**\n" + response.citations.map((url: string, i: number) => `${i + 1}. ${url}`).join("\n");
  }

  function formatOpenRouterError(error: any): string {
    if (!error) return "OpenRouter request failed";
    const status = error.status || error.statusCode;
    const msg = error.message || "";
    if (status === 402 || msg.includes("insufficient")) return "OpenRouter: Insufficient credits or model requires payment";
    if (status === 429 || msg.includes("rate")) return "OpenRouter: Rate limit exceeded — please wait and try again";
    if (status === 404 || msg.includes("not found") || msg.includes("No available")) return "OpenRouter: Model is unavailable — it may be offline, incompatible with privacy settings, or require a paid endpoint";
    if (status === 403 || msg.includes("privacy") || msg.includes("data_collection")) return "OpenRouter: Model unavailable due to privacy policy conflict — this model does not support privacy-safe requests";
    if (status === 503 || msg.includes("overloaded")) return "OpenRouter: Model is temporarily overloaded — try a different model or retry later";
    return `OpenRouter error: ${msg.substring(0, 200)}`;
  }

  const geminiDefault = process.env.GEMINI_API_KEY ? geminiDirect : gemini;

  async function resolveProviderClients(projectId: string | undefined, provider: string, userId?: string, modelId?: string): Promise<{ anthropicClient: Anthropic; openaiClient: OpenAI; geminiClient: GoogleGenAI; credMode: string }> {
    const useDirectAnthropic = modelId && modelId.includes("opus");
    return { anthropicClient: useDirectAnthropic ? anthropicDirect : anthropic, openaiClient: openai, geminiClient: geminiDefault, credMode: "managed" };
  }

  app.post("/api/projects/generate", requireAuth, aiGenerateLimiter, async (req: Request, res: Response) => {
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const emit = (event: string, data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
    };
    try {
      const { prompt, model: requestedModel, outputType: reqOutputType } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
        emit("error", { message: "Please provide a project description (at least 3 characters)" });
        return res.end();
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        emit("error", { message: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
        return res.end();
      }
      const genKeyError = validateExternalAIKey(requestedModel);
      if (genKeyError) {
        emit("error", { message: genKeyError });
        return res.end();
      }

      const genProjectLimit = await storage.checkProjectLimit(req.session.userId!);
      if (!genProjectLimit.allowed) {
        emit("error", { message: `Project limit reached (${genProjectLimit.current}/${genProjectLimit.limit}). Upgrade to Pro for more.` });
        return res.end();
      }

      emit("progress", { step: "generating_code", message: "Generating project with AI..." });

      const validOutputTypes = ["web", "mobile", "slides", "animation", "design", "data-visualization", "automation", "3d-game", "document", "spreadsheet"];
      const outputType = validOutputTypes.includes(reqOutputType) ? reqOutputType : "web";
      emit("progress", { step: "creating_project", message: "Setting up project..." });

      const outputTypeInstructions: Record<string, string> = {
        "web": "Generate a beautiful, modern web app. Use Tailwind CSS via CDN (<script src=\"https://cdn.tailwindcss.com\"></script>) for styling. Design should look professional with dark mode, gradients, shadows, rounded corners, hover effects, animations, responsive layout. Include Lucide icons via CDN. Use modern HTML5 and ES6+ JavaScript. The app should look like a polished SaaS product.",
        "mobile": "Generate a React Native/Expo mobile app with TypeScript. Use React Native components (View, Text, TouchableOpacity, FlatList, etc.) — NOT HTML. Use StyleSheet.create() for styles. Use Expo Router for navigation (file-based routing in app/ directory). Include app.json with Expo config, package.json with expo/react-native dependencies, babel.config.js, tsconfig.json, and app/_layout.tsx. Set projectType to 'mobile-app'. Place pages in app/ directory.",
        "slides": "Generate an HTML-based slide presentation using Reveal.js (include CDN). Create multiple slides with navigation, transitions, and speaker notes. Include a title slide and content slides.",
        "animation": "Generate a Canvas/CSS/SVG animation with controls (play/pause/speed). Use requestAnimationFrame for smooth rendering. Include interactive controls to adjust animation parameters.",
        "design": "Generate a design tool/canvas with interactive elements. Include color pickers, drawing tools (pen, shapes, text), canvas element, and export functionality. Use Canvas API or SVG.",
        "data-visualization": "Generate a data visualization dashboard using Chart.js (include CDN: https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js). Include: multiple chart types (bar, line, pie, doughnut, scatter, area), KPI cards with key metrics and trend indicators, interactive filters (date range, dropdowns, search input), auto-refresh with configurable interval (5s/30s/1m/5m), light/dark mode toggle using CSS custom properties and data-theme attribute, CSV export per chart and for the full dashboard, PDF export using html2canvas + jsPDF (include CDNs), and an AI analysis summary section. Use responsive grid layout. Include real sample data.",
        "automation": "Generate a Node.js automation script. Include file processing, scheduling (cron-like with setInterval), logging, and error handling. Make it a complete working script with clear console output.",
        "3d-game": "Generate a 3D game using Three.js (include CDN). Include camera controls, basic physics/collision detection, a game loop with requestAnimationFrame, scoring, and keyboard/mouse input handling.",
        "document": "Generate a rich text editor or Markdown editor. Include a toolbar with formatting options (bold, italic, headers, lists), live preview panel, and export to HTML functionality. Use contentEditable or textarea with parsing.",
        "spreadsheet": "Generate an interactive data grid/spreadsheet. Include formula support (basic SUM, AVG, COUNT), sorting, filtering, cell editing, and CSV import/export. Use an HTML table with contentEditable cells.",
      };

      const formatInstruction = outputTypeInstructions[outputType] || outputTypeInstructions["web"];

      const systemPrompt = `You are a senior software engineer and UI designer. Given a project description and output format, generate a BEAUTIFUL, production-quality project specification as JSON.

Return ONLY valid JSON (no markdown, no code blocks, no explanation) with this structure:
{
  "name": "project-name-slug",
  "language": "javascript",
  "projectType": "web-app",
  "files": [
    { "filename": "index.js", "content": "// code" }
  ]
}

Rules:
- name: short kebab-case slug (max 30 chars)
- language: one of javascript, typescript, python
- projectType: "web-app" for most output types, "mobile-app" for mobile output type
- files: generate 2-30 complete, polished files with BEAUTIFUL design
- Do NOT add any text before or after the JSON object

DESIGN QUALITY REQUIREMENTS (CRITICAL):
- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) for ALL styling
- Design must look PROFESSIONAL and MODERN — like a top-tier SaaS product
- Use a cohesive color palette with subtle gradients (e.g. bg-gradient-to-br from-slate-900 to-slate-800)
- Add proper spacing, rounded corners (rounded-xl, rounded-2xl), and shadows (shadow-lg, shadow-xl)
- Use modern typography: font-sans, proper text sizing hierarchy (text-4xl for titles, text-lg for body)
- Include hover states and transitions (transition-all duration-200, hover:scale-105, hover:shadow-lg)
- Add subtle animations where appropriate (animate-pulse for loading, animate-fade-in for content)
- Use cards with bg-white/10 backdrop-blur-sm for glassmorphism effects on dark backgrounds
- Include proper empty states, loading states, and micro-interactions
- Make everything responsive with Tailwind responsive prefixes (sm:, md:, lg:)
- Add icons using Lucide CDN (<script src="https://unpkg.com/lucide@latest"></script>) or inline SVGs
- Use dark mode by default with rich dark backgrounds (slate-900, gray-900, zinc-900)
- NEVER use plain unstyled HTML or basic inline styles — everything must look polished
- Include a beautiful header/navbar with the app name and navigation
- Add a footer with subtle branding

OUTPUT FORMAT: ${outputType}
${formatInstruction}`;

      emit("progress", { step: "generating_code", message: "Generating code with AI..." });
      let text = "";

      if (requestedModel === "gemini") {
        const geminiResponse = await geminiDefault.models.generateContent({
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
      } else if (requestedModel === "perplexity") {
        const pplxResponse = await perplexityClient.chat.completions.create({
          model: "sonar-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt.trim() },
          ],
          max_tokens: 16384,
        });
        text = pplxResponse.choices[0]?.message?.content || "";
      } else if (requestedModel === "mistral") {
        const mistralResponse = await mistralClient.chat.completions.create({
          model: "mistral-large-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt.trim() },
          ],
          max_tokens: 16384,
        });
        text = mistralResponse.choices[0]?.message?.content || "";
      } else {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          system: systemPrompt,
          messages: [{ role: "user", content: prompt.trim() }],
          max_tokens: 16384,
        });
        text = message.content[0].type === "text" ? message.content[0].text : "";
      }
      let spec: { name: string; language: string; projectType?: string; files: { filename: string; content: string }[] };

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

      function sanitizeJsonString(str: string): string {
        return str.replace(/[\x00-\x1F\x7F]/g, (ch) => {
          switch (ch) {
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\b': return '\\b';
            case '\f': return '\\f';
            default: return '';
          }
        });
      }

      function repairAndParseJson(raw: string): any {
        try { return JSON.parse(raw); } catch {}

        let fixed = raw;
        fixed = fixed.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '');
        const first = fixed.indexOf('{');
        const last = fixed.lastIndexOf('}');
        if (first !== -1 && last > first) fixed = fixed.slice(first, last + 1);
        try { return JSON.parse(fixed); } catch {}

        const sanitized = fixed.replace(
          /"(?:[^"\\]|\\.)*"/g,
          (match) => {
            try { JSON.parse(match); return match; } catch {}
            let inner = match.slice(1, -1);
            inner = inner.replace(/\\/g, '\\\\');
            inner = inner.replace(/"/g, '\\"');
            inner = inner.replace(/\n/g, '\\n');
            inner = inner.replace(/\r/g, '\\r');
            inner = inner.replace(/\t/g, '\\t');
            return '"' + inner + '"';
          }
        );
        try { return JSON.parse(sanitized); } catch {}

        const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/);
        const langMatch = raw.match(/"language"\s*:\s*"([^"]+)"/);
        const filesRegex = /"filename"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        const files: { filename: string; content: string }[] = [];
        let m;
        while ((m = filesRegex.exec(raw)) !== null) {
          try {
            files.push({ filename: m[1], content: JSON.parse('"' + m[2] + '"') });
          } catch {
            files.push({ filename: m[1], content: m[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"') });
          }
        }
        if (nameMatch && langMatch && files.length > 0) {
          return { name: nameMatch[1], language: langMatch[1], files };
        }

        return null;
      }

      try {
        spec = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        log(`AI JSON parse error: ${parseErr.message}. Attempting recovery...`, "ai");
        const recovered = repairAndParseJson(jsonStr);
        if (recovered && recovered.name && recovered.files?.length) {
          spec = recovered;
          log(`JSON recovery succeeded via repair`, "ai");
        } else {
          log(`Recovery failed. Raw text (first 500): ${text.slice(0, 500)}`, "ai");
          emit("error", { message: "AI generated invalid project structure. Please try again." });
          return res.end();
        }
      }

      if (!spec.name || !spec.language || !spec.files?.length) {
        emit("error", { message: "AI generated incomplete project. Please try again." });
        return res.end();
      }

      const validLangs = ["javascript", "typescript", "python"];
      if (!validLangs.includes(spec.language)) spec.language = "javascript";

      emit("progress", { step: "saving_files", message: "Saving project files..." });
      const detectedProjectType = "web-app";

      emit("progress", { step: "creating_project", message: "Creating project..." });
      const project = await storage.createProject(req.session.userId!, {
        name: spec.name.slice(0, 50),
        language: spec.language,
        visibility: "private" as const,
        projectType: detectedProjectType,
        outputType: outputType as any,
      });

      const categoryToArtifactType: Record<string, string> = {
        web: "web-app", mobile: "mobile-app", slides: "slides", animation: "animation",
        design: "design", "data-visualization": "data-viz", automation: "automation",
        "3d-game": "3d-game", document: "document", spreadsheet: "spreadsheet",
      };
      const artifactType = categoryToArtifactType[outputType] || "web-app";
      await storage.createArtifact({
        projectId: project.id,
        name: spec.name.slice(0, 50),
        type: artifactType,
        entryFile: null,
        settings: {},
      });

      emit("progress", { step: "saving_files", message: `Saving ${Math.min(spec.files.length, MAX_GENERATED_FILES)} files...` });
      for (const file of spec.files.slice(0, MAX_GENERATED_FILES)) {
        const safeFilename = sanitizeAIFilename(file.filename);
        if (!safeFilename || safeFilename === "ecode.md") continue;
        const safeContent = sanitizeAIFileContent(file.content || "");
        await storage.createFile(project.id, {
          filename: safeFilename,
          content: safeContent,
        });
      }

      const files = await storage.getFiles(project.id);

      const agentConvModel = requestedModel || "claude";
      const conversation = await storage.createConversation({
        projectId: project.id,
        userId: req.session.userId!,
        title: prompt.slice(0, 100),
        model: agentConvModel,
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
        model: agentConvModel,
        fileOps: files.map(f => ({ type: "created" as const, filename: f.filename })),
      });

      createCheckpoint(project.id, req.session.userId!, "feature_complete", `AI generated project: ${spec.name}`).catch(() => {});

      // Auto-start workspace in background
      emit("progress", { step: "starting_workspace", message: "Starting dev server..." });
      import("./localWorkspaceManager").then(async (localWS) => {
        try {
          const hasPackageJson = files.some(f => f.filename === "package.json");
          const hasPyMain = files.some(f => f.filename === "main.py" || f.filename === "app.py");
          if (hasPackageJson || hasPyMain) {
            await localWS.startLocalWorkspace(project.id, () => storage.getFiles(project.id));
          }
        } catch {}
      }).catch(() => {});

      emit("done", { project, files });
      return res.end();
    } catch (error: any) {
      log(`AI project generation error: ${error.message}`, "ai");
      emit("error", { message: "Failed to generate project. Please try again." });
      return res.end();
    }
  });

  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.post("/api/ai/transcribe", requireAuth, audioUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No audio file provided" });

      const file = new File([req.file.buffer], req.file.originalname || "recording.webm", {
        type: req.file.mimetype || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "en",
      });

      res.json({ text: transcription.text });
    } catch (err: any) {
      log(`Transcription error: ${err.message}`, "ai");
      res.status(500).json({ error: "Transcription failed: " + safeError(err, "unknown error") });
    }
  });

  app.post("/api/ai/tts", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { text, voice = "alloy" } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 4096) {
        return res.status(400).json({ error: "Text too long (max 4096 characters)" });
      }
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const selectedVoice = validVoices.includes(voice) ? voice : "alloy";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice: selectedVoice, format: "pcm16" },
        messages: [
          { role: "system", content: "You are a helpful assistant. Read the following text aloud naturally." },
          { role: "user", content: text },
        ],
        stream: true,
      });

      let transcript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.audio?.transcript) {
          transcript += delta.audio.transcript;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}\n\n`);
        }

        if (delta?.audio?.data) {
          res.write(`data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done", transcript })}\n\n`);
      res.end();
    } catch (err: any) {
      log(`TTS error: ${err.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "TTS failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "TTS failed: " + safeError(err, "unknown error") });
      }
    }
  });

  app.post("/api/ai/chat-audio", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages: chatMessages, voice = "alloy", model: reqModel } = req.body;
      if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
        return res.status(400).json({ error: "Messages are required" });
      }
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const selectedVoice = validVoices.includes(voice) ? voice : "alloy";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice: selectedVoice, format: "pcm16" },
        messages: chatMessages.map((m: any) => ({ role: m.role, content: m.content })),
        stream: true,
      });

      let transcript = "";
      let allAudioChunks: string[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.audio?.transcript) {
          transcript += delta.audio.transcript;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}\n\n`);
        }

        if (delta?.audio?.data) {
          allAudioChunks.push(delta.audio.data);
          res.write(`data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done", transcript })}\n\n`);
      res.end();
    } catch (err: any) {
      log(`Chat audio error: ${err.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Audio response failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Audio response failed: " + safeError(err, "unknown error") });
      }
    }
  });

  app.post("/api/ai/generate-image", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (prompt.length > 4000) {
        return res.status(400).json({ error: "Prompt too long (max 4000 characters)" });
      }
      const validSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"] as const;
      type ImageSize = typeof validSizes[number];
      const imageSize: ImageSize = (validSizes as readonly string[]).includes(size) ? (size as ImageSize) : "1024x1024";

      const imageQuota = await storage.incrementAiCall(req.session.userId!);
      if (!imageQuota.allowed) {
        return res.status(429).json({ error: "Daily AI call limit reached. Upgrade to Pro for more." });
      }
      const imgCreditResult = await storage.deductMonthlyCreditsFromRoute(req.session.userId!, SERVICE_CREDIT_COSTS["dalle-3-image"] || 20, "service-image-gen", "dalle-3");
      if (!imgCreditResult.allowed) {
        return res.status(429).json({ error: "Credit limit reached. Add a payment method to enable overage billing." });
      }

      const imageBuffer = await generateImageBuffer(prompt, imageSize);
      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(502).json({ error: "Image generation returned empty result" });
      }
      const base64 = imageBuffer.toString("base64");
      res.json({ image: `data:image/png;base64,${base64}` });
    } catch (err: any) {
      log(`Image generation error: ${err.message}`, "ai");
      res.status(500).json({ error: "Image generation failed: " + safeError(err, "unknown error") });
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
    let convModel = model || "claude";
    if (!model) {
      try {
        const usr = await storage.getUser(req.session.userId!);
        if (usr?.preferredAiModel) {
          const pm = usr.preferredAiModel;
          convModel = pm.startsWith("gpt") || pm.startsWith("o3") || pm.startsWith("o4") ? "gpt" :
            pm.startsWith("claude") ? "claude" : pm.startsWith("gemini") ? "gemini" : "claude";
        }
      } catch {}
    }
    const conversation = await storage.createConversation({
      projectId: req.params.projectId,
      userId: req.session.userId!,
      title: title || "",
      model: convModel,
    });
    return res.status(201).json(conversation);
  });

  app.post("/api/ai/conversations/:projectId/messages", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { role, content, model: msgModel, fileOps, conversationId: reqConvId } = req.body;
    if (!role || !content) {
      return res.status(400).json({ message: "role and content required" });
    }
    const forceNew = req.body.newConversation === true;
    let conversation: any = null;
    if (reqConvId && !forceNew) {
      conversation = await storage.getConversationById(reqConvId);
      if (!conversation || conversation.userId !== req.session.userId) {
        conversation = null;
      }
    }
    if (!conversation && !forceNew) {
      conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    }
    if (!conversation) {
      let fallbackModel = msgModel || "claude";
      if (!msgModel) {
        try {
          const usr = await storage.getUser(req.session.userId!);
          if (usr?.preferredAiModel) {
            const pm = usr.preferredAiModel;
            fallbackModel = pm.startsWith("gpt") || pm.startsWith("o3") || pm.startsWith("o4") ? "gpt" :
              pm.startsWith("claude") ? "claude" :
              pm.startsWith("gemini") ? "gemini" : "claude";
          }
        } catch {}
      }
      conversation = await storage.createConversation({
        projectId: req.params.projectId,
        userId: req.session.userId!,
        model: fallbackModel,
      });
    }
    const msg = await storage.addMessage({
      conversationId: conversation.id,
      role,
      content: typeof content === "string" ? content.slice(0, 100000) : "",
      model: msgModel || null,
      fileOps: fileOps || null,
    });
    if (role === "user" && (!conversation.title || conversation.title === "")) {
      const titleText = typeof content === "string" ? content.slice(0, 100).split("\n")[0] : "Untitled";
      await storage.updateConversation(conversation.id, { title: titleText });
    }
    return res.status(201).json({ ...msg, conversationId: conversation.id });
  });

  app.get("/api/ai/conversations/:projectId/load/:conversationId", requireAuth, async (req: Request, res: Response) => {
    const conv = await storage.getConversationById(req.params.conversationId);
    if (!conv || conv.userId !== req.session.userId) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const msgs = await storage.getMessages(conv.id);
    return res.json({ conversation: conv, messages: msgs });
  });

  app.delete("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    return res.json({ message: "New conversation started" });
  });

  app.get("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const messages = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json(messages);
  });

  app.post("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, attachments } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "content required" });
    }
    let conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      conversation = await storage.createConversation({
        projectId: req.params.projectId,
        userId: req.session.userId!,
        model: "gpt",
      });
    }
    const existing = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    const position = existing.length;
    const msg = await storage.createQueuedMessage({
      conversationId: conversation.id,
      projectId: req.params.projectId,
      userId: req.session.userId!,
      content: content.slice(0, 100000),
      attachments: attachments || null,
      position,
    });
    return res.status(201).json(msg);
  });

  app.patch("/api/ai/queue/:projectId/:messageId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, attachments } = req.body;
    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (attachments !== undefined) updates.attachments = attachments;
    const msg = await storage.updateQueuedMessage(req.params.messageId, req.params.projectId, req.session.userId!, updates);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    return res.json(msg);
  });

  app.put("/api/ai/queue/:projectId/reorder", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: "updates array required" });
    }
    await storage.reorderQueuedMessages(updates, req.params.projectId, req.session.userId!);
    const messages = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json(messages);
  });

  app.delete("/api/ai/queue/:projectId/:messageId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteQueuedMessage(req.params.messageId, req.params.projectId, req.session.userId!);
    return res.json({ message: "Deleted" });
  });

  app.delete("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.clearQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json({ message: "Queue cleared" });
  });

  app.post("/api/ai/queue/:projectId/dequeue", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const msg = await storage.dequeueNextMessage(req.params.projectId, req.session.userId!);
    if (!msg) return res.json({ message: null });
    return res.json(msg);
  });

  function parsePlanFromResponse(content: string): { title: string; tasks: { title: string; description: string; complexity: string; dependsOn: number[] }[] } | null {
    const validComplexities = ["simple", "medium", "complex"];

    function validateParsed(parsed: Record<string, unknown>): { title: string; tasks: { title: string; description: string; complexity: string; dependsOn: number[] }[] } | null {
      if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) return null;
      return {
        title: typeof parsed.title === "string" ? parsed.title : "Untitled Plan",
        tasks: parsed.tasks.map((t: Record<string, unknown>, i: number) => ({
          title: typeof t.title === "string" ? t.title : `Task ${i + 1}`,
          description: typeof t.description === "string" ? t.description : "",
          complexity: typeof t.complexity === "string" && validComplexities.includes(t.complexity) ? t.complexity : "medium",
          dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.filter((d): d is number => typeof d === "number") : [],
        })),
      };
    }

    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        const result = validateParsed(parsed);
        if (result) return result;
      }
    } catch {}

    try {
      const rawJsonMatch = content.match(/\{[\s\S]*"tasks"\s*:\s*\[[\s\S]*\]\s*[\s\S]*\}/);
      if (rawJsonMatch) {
        const parsed = JSON.parse(rawJsonMatch[0]);
        return validateParsed(parsed);
      }
    } catch {}

    return null;
  }

  app.post("/api/ai/plan", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, projectId, model: requestedModel } = req.body;
      if (!messages || !Array.isArray(messages) || !projectId) {
        return res.status(400).json({ message: "messages array and projectId required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }
      const planKeyError = validateExternalAIKey(requestedModel);
      if (planKeyError) {
        return res.status(400).json({ message: planKeyError });
      }

      if (typeof projectId !== "string" || projectId.length > 100) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const planQuota = await storage.incrementAiCall(req.session.userId!);
      if (!planQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached. Upgrade to Pro for more." });
      }

      const existingFiles = await storage.getFiles(projectId);
      const fileList = existingFiles.map(f => `- ${f.filename}`).join("\n");

      const planSystemPrompt = `You are a senior software architect and project planner embedded in E-Code IDE. Your role is to help users plan, brainstorm, and create structured task lists for their projects.

Current project: "${project.name}" (${project.language})
Existing files:
${fileList || "(no files yet)"}

IMPORTANT RULES:
- NEVER generate code, file modifications, or implementation details
- Focus on architecture, planning, trade-off analysis, risk assessment, and roadmap generation
- Always produce a structured task list as part of your response
- Support follow-up refinement (e.g., "add authentication to the plan", "split task 3")

You MUST respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing a "tasks" array. Each task object must have:
- "title": short task name
- "description": 1-3 sentence explanation of what to do
- "complexity": one of "simple", "medium", "complex"
- "dependsOn": array of task indices (0-based) this task depends on, or empty array

Before the JSON block, provide a brief analysis/overview in plain text (2-4 paragraphs max). After the JSON block, you may add brief closing remarks.

Example format:
Here's my analysis of your request...

\`\`\`json
{
  "title": "Plan Title",
  "tasks": [
    {"title": "Setup project structure", "description": "Create the folder layout and config files", "complexity": "simple", "dependsOn": []},
    {"title": "Build data layer", "description": "Set up database schema and ORM", "complexity": "medium", "dependsOn": [0]}
  ]
}
\`\`\`

Any closing remarks...`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullContent = "";

      if (requestedModel === "gemini") {
        const geminiContents = [
          { role: "user" as const, parts: [{ text: planSystemPrompt }] },
          { role: "model" as const, parts: [{ text: "Understood. I'll help plan and architect your project with structured task lists." }] },
          ...messages.map((m: { role: string; content: string }) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        const stream = await geminiDefault.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: geminiContents,
          config: { maxOutputTokens: 16384 },
        });

        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (requestedModel === "gpt") {
        const gptMessages = [
          { role: "system" as const, content: planSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
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
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (requestedModel === "openrouter") {
        const orPlanModelId = req.body.openrouterModel || "meta-llama/llama-3.3-70b-instruct";

        const orMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: planSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const stream = await openrouter.chat.completions.create({
          model: orPlanModelId,
          messages: orMessages,
          stream: true,
          max_tokens: 16384,
          ...OPENROUTER_PRIVACY_BODY,
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & Record<string, unknown>, OPENROUTER_REQUEST_OPTS);

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (requestedModel === "perplexity") {
        const pplxPlanMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: planSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];
        const stream = await perplexityClient.chat.completions.create({
          model: "sonar-pro",
          messages: pplxPlanMessages,
          stream: true,
          max_tokens: 16384,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (requestedModel === "mistral") {
        const mistralPlanMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: planSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];
        const stream = await mistralClient.chat.completions.create({
          model: "mistral-large-latest",
          messages: mistralPlanMessages,
          stream: true,
          max_tokens: 16384,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          system: planSystemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          max_tokens: 16384,
        });

        stream.on("text", (text) => {
          fullContent += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        });

        await stream.finalMessage();
      }

      const userId = req.session.userId!;
      const planData = parsePlanFromResponse(fullContent);
      if (planData) {
        const { plan, createdTasks } = await storage.replacePlanAtomically({
          projectId,
          userId,
          title: planData.title,
          model: requestedModel || "claude",
          tasks: planData.tasks.map(t => ({ title: t.title, description: t.description, dependsOn: t.dependsOn.map(String) })),
          userMessage: messages[messages.length - 1]?.content || "",
          assistantMessage: fullContent,
        });

        res.write(`data: ${JSON.stringify({
          type: "plan_created",
          plan: { id: plan.id, title: plan.title, status: plan.status, model: plan.model },
          tasks: createdTasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            dependsOn: t.dependsOn,
            status: t.status,
            sortOrder: t.sortOrder,
          })),
        })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      log(`AI plan error: ${errMsg}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  app.get("/api/ai/plans/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const plan = await storage.getLatestPlan(req.params.projectId, req.session.userId!);
      if (!plan) {
        return res.json({ plan: null, tasks: [], messages: [] });
      }
      const tasks = await storage.getPlanTasks(plan.id);

      let planMessages: { id: string; role: string; content: string; model: string | null }[] = [];
      const conv = await storage.getPlanConversation(req.params.projectId, req.session.userId!);
      if (conv) {
        const msgs = await storage.getMessages(conv.id);
        planMessages = msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model,
        }));
      }

      return res.json({ plan, tasks, messages: planMessages });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.put("/api/ai/plans/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const plan = await storage.getLatestPlan(req.params.projectId, req.session.userId!);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const { title, status } = req.body;
      const updateData: Partial<{ title: string; status: string }> = {};
      if (typeof title === "string") updateData.title = title;
      if (typeof status === "string") updateData.status = status;

      const updatedPlan = await storage.updatePlan(plan.id, updateData);
      return res.json({ plan: updatedPlan });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.put("/api/ai/plans/:planId/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const plan = await storage.getPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const project = await storage.getProject(plan.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const planTasks = await storage.getPlanTasks(plan.id);
      const taskBelongsToPlan = planTasks.some(t => t.id === req.params.taskId);
      if (!taskBelongsToPlan) {
        return res.status(404).json({ message: "Task not found in this plan" });
      }

      const { status } = req.body;
      if (typeof status !== "string") return res.status(400).json({ message: "status required" });

      const task = await storage.updatePlanTask(req.params.taskId, { status });
      if (!task) return res.status(404).json({ message: "Task not found" });

      return res.json({ task });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.post("/api/ai/plans/:planId/approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const plan = await storage.getPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const project = await storage.getProject(plan.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updatedPlan = await storage.updatePlan(plan.id, { status: "approved" });
      const tasks = await storage.getPlanTasks(plan.id);

      return res.json({ plan: updatedPlan, tasks });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.delete("/api/ai/plans/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const plan = await storage.getLatestPlan(req.params.projectId, req.session.userId!);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      await storage.deletePlan(plan.id);

      const conv = await storage.getPlanConversation(req.params.projectId, req.session.userId!);
      if (conv) {
        await storage.deleteConversation(conv.id);
      }

      return res.json({ message: "Plan deleted" });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.post("/api/ai/complete", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { code, cursorOffset, language } = req.body;
      if (!code || typeof cursorOffset !== "number") {
        return res.status(400).json({ message: "code and cursorOffset required" });
      }
      const { openaiClient: completeOaiClient, credMode: completeCredMode } = await resolveProviderClients(req.body.projectId, "openai", req.session.userId!);
      if (completeCredMode === "managed") {
        const completePreCheck = await storage.checkCreditsAvailable(req.session.userId!, 1);
        if (!completePreCheck.allowed) {
          return res.json({ completion: "" });
        }
      }
      const before = code.slice(Math.max(0, cursorOffset - 1500), cursorOffset);
      const after = code.slice(cursorOffset, cursorOffset + 500);
      const prompt = `You are a code completion engine. Given the code context, output ONLY the completion text (no explanation, no markdown). If there is nothing to suggest, respond with an empty string.\n\nLanguage: ${language || "javascript"}\nCode before cursor:\n${before}\n[CURSOR]\nCode after cursor:\n${after}`;
      const result = await completeOaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.1,
      });
      const completion = result.choices[0]?.message?.content?.trim() || "";
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;
      const completeTokenCredits = calculateTokenCredits("gpt-4o-mini", inputTokens, outputTokens);
      const completeEstCost = completeTokenCredits;
      const effectiveCompleteCredMode = completeCredMode;
      if (effectiveCompleteCredMode === "managed") {
        storage.deductMonthlyCreditsFromRoute(req.session.userId!, completeTokenCredits, "ai-complete", "gpt-4o-mini").catch(() => {});
      }
      storage.logAiUsage({
        userId: req.session.userId!,
        projectId: req.body.projectId || null,
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens,
        outputTokens,
        estimatedCost: completeEstCost,
        credentialMode: effectiveCompleteCredMode,
        endpoint: "/api/ai/complete",
      }).catch(() => {});
      return res.json({ completion });
    } catch (err: any) {
      console.error("AI complete error:", err.message);
      return res.json({ completion: "" });
    }
  });

  let openrouterModelsCache: { data: any[]; timestamp: number } | null = null;
  const OPENROUTER_CACHE_TTL = 10 * 60 * 1000;

  app.get("/api/ai/openrouter/models", requireAuth, async (_req: Request, res: Response) => {
    try {
      if (openrouterModelsCache && (Date.now() - openrouterModelsCache.timestamp) < OPENROUTER_CACHE_TTL) {
        return res.json({ models: openrouterModelsCache.data });
      }

      const openrouterBaseUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
      const modelsRes = await fetch(`${openrouterBaseUrl}/models`, {
        headers: {
          "HTTP-Referer": "https://replit.com",
          "X-Title": "E-Code IDE",
          "X-OpenRouter-Privacy": "1",
          ...(openrouter.apiKey ? { "Authorization": `Bearer ${openrouter.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!modelsRes.ok) {
        return res.status(502).json({ message: "Failed to fetch OpenRouter models" });
      }

      interface OpenRouterApiModel {
        id: string;
        name?: string;
        description?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        top_provider?: { max_completion_tokens?: number };
        architecture?: { modality?: string };
      }

      interface OpenRouterModelsResponse {
        data?: OpenRouterApiModel[];
      }

      const PRIVACY_COMPATIBLE_PROVIDERS = new Set([
        "openai", "anthropic", "google", "meta-llama", "mistralai",
        "microsoft", "deepseek", "qwen", "cohere", "databricks",
        "nvidia", "amazon", "x-ai",
      ]);

      function isProviderPrivacyCompatible(modelId: string): boolean {
        const provider = modelId.split("/")[0];
        return PRIVACY_COMPATIBLE_PROVIDERS.has(provider);
      }

      const body: OpenRouterModelsResponse = await modelsRes.json();
      const allModels = body.data || [];

      const models = allModels
        .filter((m) => {
          if (!m.id) return false;
          const modality = m.architecture?.modality || "";
          if (!modality.includes("text")) return false;
          if (!isProviderPrivacyCompatible(m.id)) return false;
          return true;
        })
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description || "",
          context_length: m.context_length || 0,
          pricing: {
            prompt: m.pricing?.prompt || "0",
            completion: m.pricing?.completion || "0",
          },
          top_provider: m.top_provider?.max_completion_tokens || null,
          architecture: m.architecture?.modality || null,
        }));

      openrouterModelsCache = { data: models, timestamp: Date.now() };
      return res.json({ models });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to fetch models";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.post("/api/ai/chat", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, context, model, agentMode: reqMode } = req.body;
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

      const chatQuota = await storage.getUserQuota(req.session.userId!);
      const resolved = resolveTopAgentMode(req.body, chatQuota.plan || "free");
      let chatMode = resolved.effectiveAgentMode;
      const selectedModel = model || "claude";
      const modelId = resolved.modelId;

      let skillsContext = "";
      let chatMobileContext = "";
      let ecodeContext = "";
      if (req.body.projectId && typeof req.body.projectId === "string") {
        try {
          const chatProject = await storage.getProject(req.body.projectId);
          if (chatProject && await verifyProjectAccess(chatProject.id, req.session.userId!)) {
            const activeSkills = await storage.getActiveSkills(chatProject.id);
            if (activeSkills.length > 0) {
              skillsContext = "\n\n## Project Skills\nThe following skills define project-specific patterns and conventions. Follow them when applicable:\n\n" +
                activeSkills.map(s => `### ${s.name}\n${s.description ? s.description + "\n" : ""}${s.content}`).join("\n\n");
            }
            if (chatProject.projectType === "mobile-app") {
              chatMobileContext = `\n\nIMPORTANT: This is a React Native/Expo mobile app project. Follow these rules:
- Use React Native components (View, Text, TouchableOpacity, ScrollView, FlatList, TextInput, Image, Pressable, ActivityIndicator, Switch, Modal) — NOT HTML elements
- Use StyleSheet.create() for styles — NOT CSS, className, or web CSS properties
- Use Expo Router for navigation: file-based routing in the app/ directory
- Use @expo/vector-icons for icons — NOT lucide-react or web icon libs
- Import from "react-native" and "expo-*" packages, not web libraries
- Use "react-native-web" compatible APIs so the app runs via Expo Web preview
- Place pages in app/ directory, components in components/, contexts in contexts/`;
            }
            const chatFiles = await storage.getFiles(chatProject.id);
            let ecodeFile = chatFiles.find(f => f.filename === "ecode.md");
            if (!ecodeFile) {
              const ecodeContent = generateEcodeContent(chatProject.name, chatProject.language);
              ecodeFile = await storage.createFile(chatProject.id, { filename: "ecode.md", content: ecodeContent });
            }
            if (ecodeFile && ecodeFile.content) {
              ecodeContext = buildEcodePromptContext(ecodeFile.content);
            }
          }
        } catch {}
      }

      const systemPrompt = `${resolved.systemPromptPrefix}You are an expert coding assistant embedded in E-Code IDE. You help users write, debug, and improve code.

Rules:
- Always provide COMPLETE, WORKING code — never truncate, abbreviate, or use "..." to skip sections.
- When showing code, use markdown code blocks with the language tag and filename as a comment on the first line.
- If the user asks to build or create something, provide the full implementation, not just snippets.
- Include all imports, all functions, and all necessary code for the file to work standalone.
- When modifying existing code, show the COMPLETE updated file, not just the changed parts.${chatMobileContext}${context ? `\n\nCurrent context:\nLanguage: ${context.language}\nFilename: ${context.filename}\nCode:\n\`\`\`\n${context.code}\n\`\`\`` : ""}${ecodeContext}${skillsContext}`;

      const chatProviderMap: Record<string, string> = { gemini: "google", gpt: "openai", claude: "anthropic", grok: "xai", moonshot: "moonshot", perplexity: "perplexity", mistral: "mistral" };
      const chatProvider = chatProviderMap[selectedModel] || selectedModel;
      const { anthropicClient: chatAnthropicClient, openaiClient: chatOpenaiClient, geminiClient: chatGeminiClient, credMode: chatCredMode } = await resolveProviderClients(req.body.projectId, chatProvider, req.session.userId!, modelId);

      if (chatCredMode === "managed") {
        const chatPreCheck = await storage.checkCreditsAvailable(req.session.userId!, 1);
        if (!chatPreCheck.allowed) {
          return res.status(429).json({ message: "Daily credit limit reached. Upgrade your plan for more credits." });
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const turboMaxTokens = Math.min(resolved.maxTokens, 16384);

      let chatInputTokens = 0;
      let chatOutputTokens = 0;
      let usedFallback = false;
      let actualProvider = chatProvider;
      let actualModelId = modelId;

      try {
      if (selectedModel === "gemini") {
        const geminiContents = [
          { role: "user" as const, parts: [{ text: systemPrompt }] },
          { role: "model" as const, parts: [{ text: "Understood. I'm ready to help." }] },
          ...messages.map((m: any) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        const stream = await chatGeminiClient.models.generateContentStream({
          model: modelId,
          contents: geminiContents,
          config: { maxOutputTokens: turboMaxTokens },
        });

        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            chatOutputTokens += Math.ceil(content.length / 4);
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        chatInputTokens = Math.ceil(JSON.stringify(geminiContents).length / 4);
      } else if (selectedModel === "gpt" || selectedModel === "openrouter") {
        const orModelId = selectedModel === "openrouter" ? "openai/gpt-4o" : modelId;
        const gptMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await chatOpenaiClient.chat.completions.create({
          model: orModelId,
          messages: gptMessages,
          stream: true,
          stream_options: { include_usage: true },
          max_completion_tokens: turboMaxTokens,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
          if (chunk.usage) {
            chatInputTokens = chunk.usage.prompt_tokens || 0;
            chatOutputTokens = chunk.usage.completion_tokens || 0;
          }
        }
      } else if (selectedModel === "openrouter") {
        const orModelId = req.body.openrouterModel || modelId;

        const orMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await openrouter.chat.completions.create({
          model: orModelId,
          messages: orMessages,
          stream: true,
          max_tokens: turboMaxTokens,
          ...OPENROUTER_PRIVACY_BODY,
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & Record<string, unknown>, OPENROUTER_REQUEST_OPTS);

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        if (!chatInputTokens) chatInputTokens = Math.ceil(JSON.stringify(orMessages).length / 4);
      } else if (selectedModel === "perplexity") {
        const pplxMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await chatOpenaiClient.chat.completions.create({
          model: modelId,
          messages: pplxMessages,
          stream: true,
          max_tokens: turboMaxTokens,
        });

        let pplxFullContent = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            pplxFullContent += content;
            chatOutputTokens += Math.ceil(content.length / 4);
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        chatInputTokens = Math.ceil(JSON.stringify(pplxMessages).length / 4);
      } else if (selectedModel === "mistral") {
        const mistralMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await chatOpenaiClient.chat.completions.create({
          model: modelId,
          messages: mistralMessages,
          stream: true,
          max_tokens: turboMaxTokens,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            chatOutputTokens += Math.ceil(content.length / 4);
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        chatInputTokens = Math.ceil(JSON.stringify(mistralMessages).length / 4);
      } else if (selectedModel === "moonshot") {
        const moonshotMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const moonshotClient = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY || "", baseURL: "https://api.moonshot.ai/v1" });
        const stream = await moonshotClient.chat.completions.create({
          model: modelId,
          messages: moonshotMessages,
          stream: true,
          max_tokens: turboMaxTokens,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            chatOutputTokens += Math.ceil(content.length / 4);
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        chatInputTokens = Math.ceil(JSON.stringify(moonshotMessages).length / 4);
      } else if (selectedModel === "grok") {
        const grokMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const xaiClient = new OpenAI({ apiKey: process.env.XAI_API_KEY || process.env.xAI_API_KEY || "", baseURL: "https://api.x.ai/v1" });
        const stream = await xaiClient.chat.completions.create({
          model: modelId,
          messages: grokMessages,
          stream: true,
          max_tokens: turboMaxTokens,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            chatOutputTokens += Math.ceil(content.length / 4);
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        chatInputTokens = Math.ceil(JSON.stringify(grokMessages).length / 4);
      } else {
        const stream = chatAnthropicClient.messages.stream({
          model: modelId,
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          max_tokens: turboMaxTokens,
        });

        stream.on("text", (text) => {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        });

        const finalMsg = await stream.finalMessage();
        chatInputTokens = finalMsg.usage?.input_tokens || 0;
        chatOutputTokens = finalMsg.usage?.output_tokens || 0;
      }
      } catch (providerError: any) {
        log(`Provider ${chatProvider}/${modelId} failed: ${providerError.message} — falling back to ModelFarm GPT-4.1-mini`, "ai");
        usedFallback = true;
        actualProvider = "openai";
        actualModelId = "gpt-4.1-mini";
        try {
          const fallbackClient = chatOpenaiClient;
          const fallbackMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
          ];
          const fallbackStream = await fallbackClient.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: fallbackMessages,
            stream: true,
            stream_options: { include_usage: true },
            max_completion_tokens: turboMaxTokens,
          });
          for await (const chunk of fallbackStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              chatOutputTokens += Math.ceil(content.length / 4);
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
            if (chunk.usage) {
              chatInputTokens = chunk.usage.prompt_tokens || 0;
              chatOutputTokens = chunk.usage.completion_tokens || 0;
            }
          }
        } catch (fallbackError: any) {
          log(`ModelFarm fallback also failed: ${fallbackError.message}`, "ai");
          throw fallbackError;
        }
      }

      const chatPricing = getProviderPricing(actualProvider);
      const chatEstimatedCost = Math.round((chatInputTokens * chatPricing.input / 1000 + chatOutputTokens * chatPricing.output / 1000) * 100);
      const effectiveChatCredMode = chatCredMode;
      const chatLoggedModel = usedFallback ? actualModelId : (selectedModel === "openrouter" ? "openai/gpt-4o" : modelId);
      if (effectiveChatCredMode === "managed") {
        const chatTokenCredits = Math.max(1, chatEstimatedCost);
        storage.deductMonthlyCreditsFromRoute(req.session.userId!, chatTokenCredits, "ai-chat", chatLoggedModel).catch(() => {});
      }
      storage.logAiUsage({
        userId: req.session.userId!,
        projectId: req.body.projectId || null,
        provider: chatProvider,
        model: chatLoggedModel,
        inputTokens: chatInputTokens,
        outputTokens: chatOutputTokens,
        estimatedCost: chatEstimatedCost,
        credentialMode: effectiveChatCredMode,
        endpoint: "/api/ai/chat",
      }).catch(() => {});

      const donePayload: { done: boolean; fallback?: boolean; fallbackModel?: string } = { done: true };
      if (usedFallback) { donePayload.fallback = true; donePayload.fallbackModel = actualModelId; }
      res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
      res.end();
    } catch (error: any) {
      const selectedModel = req.body?.model || "claude";
      const rawMsg = selectedModel === "openrouter" ? formatOpenRouterError(error) : error.message;
      const errorMsg = safeError(rawMsg, "AI service error");
      log(`AI chat error: ${rawMsg}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: errorMsg });
      }
    }
  });

  function convertJsonSchemaToGemini(schema: Record<string, any>): any {
    const typeMap: Record<string, any> = { string: Type.STRING, number: Type.NUMBER, boolean: Type.BOOLEAN, integer: Type.NUMBER, object: Type.OBJECT, array: Type.ARRAY };
    const result: any = { type: typeMap[schema.type] || Type.STRING };
    if (schema.properties) {
      result.properties = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        const prop = v as Record<string, any>;
        result.properties[k] = { type: typeMap[prop.type] || Type.STRING, description: prop.description || "" };
      }
    }
    if (schema.required) result.required = schema.required;
    return result;
  }

  const agentFileOpsCount = { value: 0 };

  interface GeneratedFileEntry {
    projectId: string;
    filename: string;
    storagePath: string;
    mimeType: string;
    size: number;
  }

  const generatedFileRegistry = new Map<string, GeneratedFileEntry>();

  async function persistGeneratedFileMeta(fileId: string, entry: GeneratedFileEntry): Promise<void> {
    const fs = await import("fs/promises");
    const metaPath = entry.storagePath + ".meta.json";
    await fs.writeFile(metaPath, JSON.stringify({ fileId, ...entry }), "utf-8");
    generatedFileRegistry.set(fileId, entry);
  }

  async function loadGeneratedFileMeta(projectId: string, fileId: string): Promise<GeneratedFileEntry | undefined> {
    const cached = generatedFileRegistry.get(fileId);
    if (cached && cached.projectId === projectId) return cached;

    const fs = await import("fs");
    const fsp = await import("fs/promises");
    const generatedDir = path.join(process.cwd(), ".storage", "generated", projectId);
    try {
      const files = await fsp.readdir(generatedDir);
      for (const f of files) {
        if (!f.endsWith(".meta.json")) continue;
        try {
          const raw = await fsp.readFile(path.join(generatedDir, f), "utf-8");
          const meta = JSON.parse(raw);
          if (meta.fileId === fileId && meta.projectId === projectId) {
            const entry: GeneratedFileEntry = {
              projectId: meta.projectId,
              filename: meta.filename,
              storagePath: meta.storagePath,
              mimeType: meta.mimeType,
              size: meta.size,
            };
            generatedFileRegistry.set(fileId, entry);
            return entry;
          }
        } catch {}
      }
    } catch {}
    return undefined;
  }

  interface AgentToolInput {
    filename: string;
    content: string;
    name?: string;
    description?: string;
    prompt?: string;
    size?: string;
    modification_prompt?: string;
    format?: string;
    title?: string;
    sections?: FileSection[];
  }

  // Per-project terminal output store (last 8000 chars per project)
  const terminalOutputStore = new Map<string, string>();

  const executeToolCall = async (
    toolName: string,
    toolInput: { filename: string; content: string; name?: string; description?: string; prompt?: string; size?: string; modification_prompt?: string; query?: string; url?: string; format?: string; title?: string; sections?: FileSection[]; [key: string]: any },
    projectId: string,
    existingFiles: { id: string; filename: string; content: string }[],
    res: Response,
    modifiedFiles?: Set<string>,
    mcpDefs?: { name: string; originalName: string; description: string; inputSchema: Record<string, any>; serverId: string }[],
    onToolComplete?: () => Promise<void>,
    userId?: string
  ): Promise<string> => {
    try {
      if (toolName === "brave_image_search") {
        const query = toolInput.query || toolInput.content || "";
        if (!query) return "Error: search query is required";
        const rawCount = Number(toolInput.count);
        const count = Number.isFinite(rawCount) && rawCount >= 1 ? Math.min(Math.floor(rawCount), 20) : 8;
        let results;
        try {
          results = await searchBraveImages(query, count);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Brave Image Search failed";
          res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
          return `Error: ${msg}`;
        }
        await storage.deductMonthlyCreditsFromRoute(userId!, BRAVE_CREDIT_COST, "service-brave-image", "brave-image-search");
        res.write(`data: ${JSON.stringify({ type: "image_search_results", query, results })}\n\n`);
        await storage.trackEvent(userId!, "agent_service_used", { service: "brave_image_search", projectId, query, creditCost: BRAVE_CREDIT_COST });
        if (results.length === 0) return "No image results found.";
        return "Image search results:\n" + results.map((r, i) => `${i + 1}. "${r.title}" (${r.width}x${r.height}) from ${r.sourceDomain} — ${r.imageUrl}`).join("\n");
      }
      if (toolName === "text_to_speech") {
        const text = toolInput.text || toolInput.content || "";
        if (!text) return "Error: text is required for speech generation";
        if (text.length > 5000) return "Error: text too long (max 5000 characters)";
        const voiceId = toolInput.voice_id || toolInput.voice || undefined;
        let result;
        try {
          result = await generateSpeech(text, voiceId);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Text-to-speech generation failed";
          res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
          return `Error: ${msg}`;
        }
        await storage.deductMonthlyCreditsFromRoute(userId!, TTS_CREDIT_COST, "service-tts", "elevenlabs-tts");
        const audioDataUri = `data:${result.mimeType};base64,${result.audioBase64}`;
        res.write(`data: ${JSON.stringify({ type: "tts_audio_generated", audio: audioDataUri, voiceName: result.voiceName, durationEstimate: result.durationEstimate, textLength: result.textLength, mimeType: result.mimeType })}\n\n`);
        await storage.trackEvent(userId!, "agent_service_used", { service: "elevenlabs_tts", projectId, textLength: text.length, voice: result.voiceName, creditCost: TTS_CREDIT_COST });
        return `Speech generated using voice "${result.voiceName}" (~${result.durationEstimate}s, ${result.textLength} characters)`;
      }
      if (toolName === "generate_ai_image") {
        const prompt = toolInput.prompt || toolInput.content || "";
        if (!prompt) return "Error: prompt is required for image generation";
        const sizeMap: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
          "square": "1024x1024", "1024x1024": "1024x1024",
          "landscape": "1792x1024", "1792x1024": "1792x1024", "wide": "1792x1024",
          "portrait": "1024x1792", "1024x1792": "1024x1792", "tall": "1024x1792",
        };
        const size = sizeMap[toolInput.size || ""] || "1024x1024";
        const quality = toolInput.quality === "hd" ? "hd" as const : "standard" as const;
        const style = toolInput.style === "natural" ? "natural" as const : "vivid" as const;
        let imageUrl: string;
        let revisedPrompt: string;
        let model: string;
        let creditCost: number;
        try {
          const dalleResult = await generateDalleImage(prompt, size, quality, style);
          imageUrl = dalleResult.imageUrl;
          revisedPrompt = dalleResult.revisedPrompt;
          model = "dall-e-3";
          creditCost = DALLE_CREDIT_COST;
        } catch (dalleErr: unknown) {
          try {
            const rawWidth = Number(toolInput.width);
            const rawHeight = Number(toolInput.height);
            const width = Number.isFinite(rawWidth) && rawWidth >= 64 ? Math.min(Math.floor(rawWidth), 2048) : 1024;
            const height = Number.isFinite(rawHeight) && rawHeight >= 64 ? Math.min(Math.floor(rawHeight), 2048) : 1024;
            const nbResult = await generateNanoBananaImage(prompt, width, height);
            await storage.deductMonthlyCreditsFromRoute(userId!, NANOBANANA_CREDIT_COST, "service-image", "nanobanana");
            const imageDataUri = `data:${nbResult.mimeType};base64,${nbResult.imageBase64}`;
            const filename = toolInput.filename || `ai-generated-${Date.now()}.png`;
            const safeName = sanitizeAIFilename(filename);
            if (safeName) {
              const existingFile = existingFiles.find(f => f.filename === safeName);
              if (existingFile) {
                const file = await storage.updateFileContent(existingFile.id, imageDataUri);
                res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: imageDataUri })}\n\n`);
                broadcastToProject(projectId, { type: "file_updated", filename: safeName });
                previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'update' });
              } else {
                const file = await storage.createFile(projectId, { filename: safeName, content: imageDataUri });
                existingFiles.push(file);
                res.write(`data: ${JSON.stringify({ type: "file_created", file: { ...file, isImage: true }, imageData: imageDataUri })}\n\n`);
                broadcastToProject(projectId, { type: "file_created", filename: safeName });
                previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'create' });
              }
              if (modifiedFiles) modifiedFiles.add(safeName);
            }
            res.write(`data: ${JSON.stringify({ type: "ai_image_generated", prompt, imageDataUri, width: nbResult.width, height: nbResult.height, model: nbResult.model, filename: safeName || filename })}\n\n`);
            await storage.trackEvent(userId!, "agent_service_used", { service: "nanobanana_fallback", projectId, prompt: prompt.slice(0, 200), creditCost: NANOBANANA_CREDIT_COST });
            return `AI image generated (${nbResult.width}x${nbResult.height}) using ${nbResult.model}${safeName ? ` and saved as ${safeName}` : ""}`;
          } catch (fallbackErr: unknown) {
            const dalleMsg = dalleErr instanceof Error ? dalleErr.message : "DALL-E 3 failed";
            const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : "Fallback also failed";
            const msg = `AI image generation failed: ${dalleMsg}. Fallback: ${fallbackMsg}`;
            res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
            return `Error: ${msg}`;
          }
        }
        await storage.deductMonthlyCreditsFromRoute(userId!, creditCost, "service-image", "dalle-3");
        const filename = toolInput.filename || `ai-generated-${Date.now()}.png`;
        const safeName = sanitizeAIFilename(filename);
        if (safeName) {
          const existingFile = existingFiles.find(f => f.filename === safeName);
          if (existingFile) {
            const file = await storage.updateFileContent(existingFile.id, imageUrl);
            res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: imageUrl })}\n\n`);
            broadcastToProject(projectId, { type: "file_updated", filename: safeName });
            previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'update' });
          } else {
            const file = await storage.createFile(projectId, { filename: safeName, content: imageUrl });
            existingFiles.push(file);
            res.write(`data: ${JSON.stringify({ type: "file_created", file: { ...file, isImage: true }, imageData: imageUrl })}\n\n`);
            broadcastToProject(projectId, { type: "file_created", filename: safeName });
            previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'create' });
          }
          if (modifiedFiles) modifiedFiles.add(safeName);
        }
        res.write(`data: ${JSON.stringify({ type: "ai_image_generated", prompt, imageDataUri: imageUrl, width: 1024, height: 1024, model, revisedPrompt, filename: safeName || filename })}\n\n`);
        await storage.trackEvent(userId!, "agent_service_used", { service: "dalle-3", projectId, prompt: prompt.slice(0, 200), size, quality, creditCost });
        return `AI image generated using DALL-E 3 (${size}, ${quality}, ${style})${revisedPrompt !== prompt ? ` — revised prompt: "${revisedPrompt.slice(0, 100)}..."` : ""}${safeName ? ` and saved as ${safeName}` : ""}`;
      }
      if (toolName === "tavily_search") {
        const query = toolInput.query || toolInput.content || "";
        if (!query) return "Error: search query is required";
        const depth = toolInput.depth === "advanced" ? "advanced" as const : "basic" as const;
        let tavilyResult;
        try {
          tavilyResult = await searchTavily(query, { searchDepth: depth, maxResults: 5, includeAnswer: true });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Tavily search failed";
          res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
          return `Error: ${msg}`;
        }
        await storage.deductMonthlyCreditsFromRoute(userId!, TAVILY_CREDIT_COST, "service-search", "tavily");
        res.write(`data: ${JSON.stringify({ type: "tavily_search_results", query, results: tavilyResult.results, answer: tavilyResult.answer, responseTime: tavilyResult.responseTime })}\n\n`);
        await storage.trackEvent(userId!, "agent_service_used", { service: "tavily_search", projectId, query, creditCost: TAVILY_CREDIT_COST });
        let response = "";
        if (tavilyResult.answer) response += `Answer: ${tavilyResult.answer}\n\n`;
        response += "Sources:\n" + tavilyResult.results.map((r, i) => `${i + 1}. ${r.title} (${r.url}): ${r.content.slice(0, 200)}`).join("\n");
        return response || "No results found.";
      }
      if (toolName === "web_search") {
        const query = toolInput.query || toolInput.content || "";
        if (!query) return "Error: search query is required";
        const results = await fetchSearchResults(query);
        res.write(`data: ${JSON.stringify({ type: "web_search_results", results })}\n\n`);
        if (results.length === 0) return "No search results found.";
        return "Search results:\n" + results.map((r, i) => `${i + 1}. ${r.title} (${r.url}): ${r.snippet}`).join("\n");
      }
      if (toolName === "fetch_url") {
        const url = toolInput.url || toolInput.content || "";
        if (!url) return "Error: URL is required";
        res.write(`data: ${JSON.stringify({ type: "web_fetch_result", url, status: "fetching" })}\n\n`);
        const result = await fetchUrlContent(url);
        res.write(`data: ${JSON.stringify({ type: "web_fetch_result", url: result.url, title: result.title, content: result.content.slice(0, 500), status: "done" })}\n\n`);
        return `Content from ${result.title} (${result.url}):\n\n${result.content}`;
      }
      if (toolName.startsWith("mcp__") && mcpDefs) {
        const mcpDef = mcpDefs.find(d => d.name === toolName);
        if (mcpDef) {
          const mcpClientModule = await import("./mcpClient");
          const server = await storage.getMcpServer(mcpDef.serverId);

          const mcpCallId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          const argsScan = mcpClientModule.scanToolCallArgs(toolName, toolInput);
          if (!argsScan.safe) {
            const blockedMsg = `MCP tool call blocked by security scanner: ${argsScan.reason}`;
            res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, error: blockedMsg })}\n\n`);
            return blockedMsg;
          }

          res.write(`data: ${JSON.stringify({ type: "mcp_tool_call", callId: mcpCallId, name: toolName, originalName: mcpDef.originalName, serverId: mcpDef.serverId, args: toolInput })}\n\n`);

          if (server?.serverType === "remote" && server.baseUrl) {
            try {
              const resultText = await mcpClientModule.callRemoteTool(
                server.id,
                mcpDef.originalName,
                toolInput,
                server.baseUrl,
                server.headers as Record<string, string> || {}
              );
              res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, result: resultText.slice(0, 5000) })}\n\n`);
              return resultText;
            } catch (err: any) {
              const errorMsg = `MCP remote tool call failed: ${err.message}`;
              res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, error: errorMsg })}\n\n`);
              return errorMsg;
            }
          } else {
            let client = mcpClientModule.getClient(mcpDef.serverId);
            if (!client || client.status !== "running") {
              try {
                if (server) {
                  client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
                  await storage.updateMcpServer(server.id, { status: "running" });
                }
              } catch (startErr: any) {
                const errorMsg = `Failed to start MCP server: ${startErr.message}`;
                res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, error: errorMsg })}\n\n`);
                return errorMsg;
              }
            }
            if (!client || client.status !== "running") {
              const errorMsg = "MCP server not available";
              res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, error: errorMsg })}\n\n`);
              return errorMsg;
            }
            const result = await client.callTool(mcpDef.originalName, toolInput);
            const resultText = result.content.map(c => c.text || "").join("\n");
            res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", callId: mcpCallId, name: toolName, result: resultText.slice(0, 5000) })}\n\n`);
            return resultText;
          }
        }
      }
      if (toolName === "create_skill") {
        const skillName = toolInput.name || "Untitled Skill";
        const skillContent = toolInput.content || "";
        const skillDescription = toolInput.description || "";
        const skill = await storage.createSkill({
          projectId,
          name: skillName.slice(0, 200),
          description: skillDescription.slice(0, 1000),
          content: skillContent.slice(0, 50000),
          isActive: true,
        });
        res.write(`data: ${JSON.stringify({ type: "skill_created", skill })}\n\n`);
        return "Done";
      }
      if (toolName === "generate_image") {
        const prompt = toolInput.prompt;
        const filename = toolInput.filename || "generated-image.png";
        const size = toolInput.size as "1024x1024" | "1024x1536" | "1536x1024" | "auto" || "1024x1024";
        if (!prompt) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Image prompt is required" })}\n\n`);
          return "Error: prompt required";
        }
        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename for image" })}\n\n`);
          return "Error: invalid filename";
        }
        const imageBuffer = await generateImageBuffer(prompt, size);
        const base64Content = imageBuffer.toString("base64");
        const dataUri = `data:image/png;base64,${base64Content}`;
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (existingFile) {
          const file = await storage.updateFileContent(existingFile.id, dataUri);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          broadcastToProject(projectId, { type: "file_updated", filename: safeName });
          previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'update' });
        } else {
          const file = await storage.createFile(projectId, { filename: safeName, content: dataUri });
          existingFiles.push(file);
          res.write(`data: ${JSON.stringify({ type: "file_created", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          broadcastToProject(projectId, { type: "file_created", filename: safeName });
          previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'create' });
        }
        if (modifiedFiles) modifiedFiles.add(safeName);
        return `Image generated and saved as ${safeName}`;
      }
      if (toolName === "edit_image") {
        const filename = toolInput.filename;
        const modPrompt = toolInput.modification_prompt || toolInput.prompt;
        if (!filename || !modPrompt) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Filename and modification prompt are required" })}\n\n`);
          return "Error: filename and modification_prompt required";
        }
        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename" })}\n\n`);
          return "Error: invalid filename";
        }
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (!existingFile) {
          res.write(`data: ${JSON.stringify({ type: "error", message: `File "${safeName}" not found in project` })}\n\n`);
          return "Error: file not found";
        }
        const existingContent = existingFile.content || "";
        let inputBuffer: Buffer;
        if (existingContent.startsWith("data:image/")) {
          const base64Data = existingContent.split(",")[1] || existingContent;
          inputBuffer = Buffer.from(base64Data, "base64");
        } else {
          res.write(`data: ${JSON.stringify({ type: "error", message: `File "${safeName}" is not an image` })}\n\n`);
          return "Error: file is not an image";
        }
        const fs = await import("fs");
        const os = await import("os");
        const tmpPath = path.join(os.tmpdir(), `edit-${Date.now()}-${path.basename(safeName)}`);
        fs.writeFileSync(tmpPath, inputBuffer);
        try {
          const editedBuffer = await editImages([tmpPath], modPrompt);
          const base64Content = editedBuffer.toString("base64");
          const dataUri = `data:image/png;base64,${base64Content}`;
          const file = await storage.updateFileContent(existingFile.id, dataUri);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          if (modifiedFiles) modifiedFiles.add(safeName);
          broadcastToProject(projectId, { type: "file_updated", filename: safeName });
          previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'update' });
          return `Image "${safeName}" edited successfully`;
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }
      if (toolName === "generate_file") {
        const format = toolInput.format;
        const filename = toolInput.filename;
        const title = toolInput.title;
        const sections = toolInput.sections;

        if (!format || !["pdf", "docx", "xlsx", "csv", "pptx"].includes(format)) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid format. Use pdf, docx, xlsx, csv, or pptx." })}\n\n`);
          return "Error: invalid format";
        }
        if (!filename) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Filename is required" })}\n\n`);
          return "Error: filename required";
        }
        if (!sections || !Array.isArray(sections) || sections.length === 0) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "At least one section is required" })}\n\n`);
          return "Error: sections required";
        }

        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename" })}\n\n`);
          return "Error: invalid filename";
        }

        const validFormat = format as "pdf" | "docx" | "xlsx" | "csv" | "pptx";
        const fileBuffer = await generateFile({ format: validFormat, filename: safeName, title, sections });

        const fsModule = await import("fs");
        const { mkdir } = await import("fs/promises");
        const generatedDir = path.join(process.cwd(), ".storage", "generated", projectId);
        await mkdir(generatedDir, { recursive: true });
        const storagePath = path.join(generatedDir, `${Date.now()}_${safeName}`);
        fsModule.writeFileSync(storagePath, fileBuffer);

        const fileId = crypto.randomUUID();
        const mimeType = getMimeType(validFormat);
        await persistGeneratedFileMeta(fileId, {
          projectId,
          filename: safeName,
          storagePath,
          mimeType,
          size: fileBuffer.length,
        });

        const downloadUrl = `/api/projects/${projectId}/generated-files/${fileId}/download`;
        const sizeKB = (fileBuffer.length / 1024).toFixed(1);

        res.write(`data: ${JSON.stringify({
          type: "file_generated",
          filename: safeName,
          format: validFormat,
          downloadUrl,
          mimeType,
          size: fileBuffer.length,
        })}\n\n`);

        if (modifiedFiles) modifiedFiles.add(safeName);
        return `File generated: ${safeName} (${validFormat.toUpperCase()}, ${sizeKB} KB). Download URL: ${downloadUrl}`;
      }
      if (toolName === "query_connector" || toolName === "write_connector") {
        const connectorName = (toolInput as any).connector;
        const operation = (toolInput as any).operation;
        const params = (toolInput as any).params || {};
        if (!connectorName || !operation) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "connector and operation are required" })}\n\n`);
          return "Error: connector and operation are required";
        }
        const connectorKey = getConnectorKey(connectorName) || connectorName.toLowerCase();
        const integrations = await storage.getProjectIntegrations(projectId);
        const matchedIntegration = integrations.find(i => {
          const key = getConnectorKey(i.integration.name);
          return key === connectorKey && (i.status === "connected" || i.status === "unverified");
        });
        if (!matchedIntegration) {
          return `Error: No connected ${connectorName} integration found. The user needs to connect it from the Integrations panel first.`;
        }
        const allowedType = toolName === "query_connector" ? "read" as const : "write" as const;
        const result = await executeConnectorOperation(connectorKey, operation, params, matchedIntegration.config || {}, allowedType);
        await storage.addIntegrationLog(
          matchedIntegration.id,
          result.success ? "info" : "error",
          `Agent ${toolName}: ${operation} — ${result.success ? "Success" : result.error || "Failed"}`
        );
        if (result.success) {
          res.write(`data: ${JSON.stringify({ type: "connector_result", connector: connectorName, operation, success: true })}\n\n`);
          return JSON.stringify(result.data).slice(0, 8000);
        } else {
          res.write(`data: ${JSON.stringify({ type: "connector_result", connector: connectorName, operation, success: false, error: result.error })}\n\n`);
          return `Error: ${result.error}`;
        }
      }
      if (toolName === "update_slides" || toolName === "create_slide" || toolName === "edit_slide") {
        const slidesInput = toolInput as unknown as { slides: any[]; theme?: any };
        let existing = await storage.getSlidesData(projectId);
        if (!existing) {
          existing = await storage.createSlidesData({ projectId, slides: slidesInput.slides, theme: slidesInput.theme });
        } else {
          const updatePayload: any = { slides: slidesInput.slides };
          if (slidesInput.theme) updatePayload.theme = slidesInput.theme;
          existing = await storage.updateSlidesData(projectId, updatePayload);
        }
        res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n> Updated slides data\n" })}\n\n`);
        return "";
      }
      if (toolName === "update_video" || toolName === "create_video_scene" || toolName === "edit_video_scene") {
        const videoInput = toolInput as unknown as { scenes: any[]; audioTracks?: any[] };
        let existing = await storage.getVideoData(projectId);
        if (!existing) {
          existing = await storage.createVideoData({ projectId, scenes: videoInput.scenes, audioTracks: videoInput.audioTracks || [] });
        } else {
          const updatePayload: any = { scenes: videoInput.scenes };
          if (videoInput.audioTracks) updatePayload.audioTracks = videoInput.audioTracks;
          existing = await storage.updateVideoData(projectId, updatePayload);
        }
        res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n> Updated video data\n" })}\n\n`);
        return "";
      }
      if (toolName === "execute_command") {
        const command = (toolInput.command || "").trim();
        if (!command) return "Error: command is required";
        // Block dangerous commands
        const dangerous = [
          /rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, /:(){ :|:& };:/, />\s*\/dev\/(sd|hd|vd)/,
          /chmod\s+-R\s+777\s+\//, /chown\s+-R.*\//, /shutdown/, /reboot/, /halt/,
        ];
        for (const pattern of dangerous) {
          if (pattern.test(command)) {
            return "Error: command blocked for safety";
          }
        }
        const workspaceDir = getProjectWorkspaceDir(projectId);
        // Ensure workspace directory exists
        if (!fs.existsSync(workspaceDir)) {
          try { fs.mkdirSync(workspaceDir, { recursive: true }); } catch {}
        }
        res.write(`data: ${JSON.stringify({ type: "tool_use", name: "execute_command", input: { command, label: "Running command" } })}\n\n`);
        try {
          const { exec } = await import("child_process");
          const output = await new Promise<string>((resolve) => {
            const timeout = 30000;
            const proc = exec(command, { cwd: workspaceDir, timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
              const out = [stdout, stderr].filter(Boolean).join("\n").trim();
              if (err && !out) resolve(`Error (exit ${err.code || 1}): ${err.message}`);
              else resolve(out || "(no output)");
            });
            setTimeout(() => { proc.kill(); resolve("Error: command timed out after 30s"); }, timeout + 500);
          });
          return output;
        } catch (err: any) {
          return `Error: ${err.message}`;
        }
      }
      if (toolName === "create_file" || toolName === "edit_file") {
        agentFileOpsCount.value++;
        const safeName = sanitizeAIFilename(toolInput.filename);
        if (!safeName) {
          log(`AI agent: blocked invalid filename "${toolInput.filename}"`, "ai");
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid or forbidden filename" })}\n\n`);
          return "Error: invalid filename";
        }
        const safeContent = sanitizeAIFileContent(toolInput.content);
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (existingFile) {
          const file = await storage.updateFileContent(existingFile.id, safeContent);
          syncFileToWorkspace(projectId, safeName, safeContent);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file })}\n\n`);
          previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'update' });
        } else {
          const file = await storage.createFile(projectId, { filename: safeName, content: safeContent });
          syncFileToWorkspace(projectId, safeName, safeContent);
          existingFiles.push(file as { id: string; filename: string; content: string });
          res.write(`data: ${JSON.stringify({ type: "file_created", file })}\n\n`);
          previewEvents.emit('preview:file-change', { projectId: parseInt(String(projectId), 10), filePath: safeName, changeType: 'create' });
        }
        if (modifiedFiles) modifiedFiles.add(safeName);
        if (onToolComplete) await onToolComplete();
        return "Done";
      }
      return "Unknown tool";
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", message: `Failed to ${toolName}: ${err.message}` })}\n\n`);
      return `Error: ${err.message}`;
    }
  };

  app.post("/api/ai/agent", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    log(`[Agent] POST /api/ai/agent - model=${req.body?.model}, projectId=${req.body?.projectId}, messages=${req.body?.messages?.length || 0}`, "agent");
    try {
      const { messages, projectId, model: requestedModel, optimize, agentMode: agentReqMode, webSearchEnabled } = req.body;
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
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const agentQuota = await storage.getUserQuota(req.session.userId!);
      const agentResolved = resolveTopAgentMode(req.body, agentQuota.plan || "free");
      let agentModeVal = agentResolved.effectiveAgentMode;
      const agentSelectedModel = requestedModel || "claude";
      const agentModelId = agentResolved.modelId;

      const agentProviderMap: Record<string, string> = { gemini: "google", gpt: "openai", claude: "anthropic", perplexity: "perplexity", mistral: "mistral" };
      const agentProvider = agentProviderMap[agentSelectedModel] || agentSelectedModel;
      const { anthropicClient: agentAnthropicClient, openaiClient: agentOpenaiClient, geminiClient: agentGeminiClient, credMode: agentCredMode } = await resolveProviderClients(projectId, agentProvider, req.session.userId!, agentModelId);

      if (agentCredMode === "managed") {
        const agentPreCheck = await storage.checkCreditsAvailable(req.session.userId!, 1);
        if (!agentPreCheck.allowed) {
          return res.status(429).json({ message: "Daily credit limit reached. Upgrade your plan for more credits." });
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: "status", message: "Preparing workspace..." })}\n\n`);
      const agentStartTime = Date.now();

      const existingFiles = await storage.getFiles(projectId);
      res.write(`data: ${JSON.stringify({ type: "status", message: `Loaded ${existingFiles.length} project file${existingFiles.length !== 1 ? "s" : ""}` })}\n\n`);
      const agentModifiedFiles = new Set<string>();

      let ecodeFile = existingFiles.find(f => f.filename === "ecode.md");
      let ecodeRegenerated = false;
      if (!ecodeFile) {
        const ecodeContent = generateEcodeContent(project.name, project.language);
        ecodeFile = await storage.createFile(projectId, { filename: "ecode.md", content: ecodeContent });
        ecodeRegenerated = true;
      }

      const fileList = existingFiles.filter(f => f.filename !== "ecode.md").map(f => `- ${f.filename}`).join("\n");
      const ecodeGuidelines = ecodeFile && ecodeFile.content ? buildEcodePromptContext(ecodeFile.content) : "";

      let agentSkillsContext = "";
      try {
        const activeSkills = await storage.getActiveSkills(projectId);
        if (activeSkills.length > 0) {
          agentSkillsContext = "\n\n## Project Skills\nThe following skills define project-specific patterns and conventions. Follow them when applicable:\n\n" +
            activeSkills.map(s => `### ${s.name}\n${s.description ? s.description + "\n" : ""}${s.content}`).join("\n\n");
        }
      } catch {}

      let mcpToolsContext = "";
      let mcpToolDefinitions: { name: string; originalName: string; description: string; inputSchema: Record<string, any>; serverId: string }[] = [];
      try {
        const mcpServers = await storage.getMcpServers(projectId);
        const mcpClientModule = await import("./mcpClient");
        for (const server of mcpServers) {
          if (server.serverType === "remote" && server.baseUrl) {
            const remoteClient = mcpClientModule.getRemoteClient(server.id);
            if (!remoteClient?.connected) {
              try {
                const connectResult = await mcpClientModule.connectRemoteServer(
                  server.id,
                  server.baseUrl,
                  server.headers as Record<string, string> || {}
                );
                if (connectResult.success) {
                  await storage.updateMcpServer(server.id, { status: "connected" });
                  await storage.deleteMcpToolsByServer(server.id);
                  for (const tool of connectResult.tools) {
                    await storage.createMcpTool({ serverId: server.id, name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
                  }
                } else {
                  log(`MCP remote server '${server.name}' (${server.id}) failed to connect: ${connectResult.error}`, "mcp");
                }
              } catch (startErr: any) {
                log(`MCP remote server '${server.name}' (${server.id}) error: ${startErr.message}`, "mcp");
              }
            }
          } else {
            let client = mcpClientModule.getClient(server.id);
            if (!client || client.status !== "running") {
              try {
                client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
                await storage.updateMcpServer(server.id, { status: "running" });
                const discoveredTools = await client.listTools();
                await storage.deleteMcpToolsByServer(server.id);
                for (const tool of discoveredTools) {
                  await storage.createMcpTool({ serverId: server.id, name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
                }
              } catch (startErr: any) {
                log(`MCP server '${server.name}' (${server.id}) failed to start/discover: ${startErr.message}`, "mcp");
                await storage.updateMcpServer(server.id, { status: "error" });
              }
            }
          }
        }
        const mcpProjectTools = await storage.getMcpToolsByProject(projectId);
        if (mcpProjectTools.length > 0) {
          const safeName = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
          mcpToolDefinitions = mcpProjectTools.map(t => ({
            name: `mcp__${safeName(t.serverName)}__${safeName(t.name)}`,
            originalName: t.name,
            description: `[MCP: ${t.serverName}] ${t.description}`,
            inputSchema: t.inputSchema,
            serverId: t.serverId,
          }));
          mcpToolsContext = "\n\nYou also have access to MCP tools from configured servers. Use them when relevant to the user's request.";
        }
      } catch (mcpErr: any) {
        log(`MCP initialization error: ${mcpErr.message}`, "mcp");
      }

      const isMobileProject = project.projectType === "mobile-app";
      const mobileContext = isMobileProject ? `

IMPORTANT: This is a React Native/Expo mobile app project. Follow these rules:
- Use React Native components (View, Text, TouchableOpacity, ScrollView, FlatList, TextInput, Image, Pressable, ActivityIndicator, Switch, Modal) — NOT HTML elements (div, span, button, input, etc.)
- Use StyleSheet.create() for styles — NOT CSS, className, or inline style objects with web CSS properties
- Use React Native layout (flexbox with flex, alignItems, justifyContent, gap) — NOT CSS grid, float, or display: block
- Import from "react-native" and "expo-*" packages, not web libraries like "react-dom"
- Use "react-native-web" compatible APIs so the app runs via Expo Web preview
- Use Expo Router for navigation: file-based routing in the app/ directory, Stack and Tabs layouts
- Use SafeAreaView from "react-native-safe-area-context" for safe areas
- Use @expo/vector-icons (Ionicons, MaterialIcons, FontAwesome) for icons — NOT lucide-react or web icon libs
- Include proper app.json with Expo configuration (name, slug, icon, splash, ios/android config)
- Include package.json with Expo dependencies (expo, react-native, react-native-web, react-dom, expo-router)
- Include babel.config.js with babel-preset-expo and expo-router/babel plugin
- Include tsconfig.json extending expo/tsconfig.base
- Place pages in app/ directory using Expo Router conventions (app/index.tsx, app/(tabs)/_layout.tsx, etc.)
- Place reusable components in components/ directory
- Place shared state/context in contexts/ directory
- For data persistence, use expo-secure-store or AsyncStorage
- Always add data-testid attributes to interactive and display elements` : "";

      const planUserId = req.session.userId!;
      const approvedPlanForContext = await storage.getLatestPlan(projectId, planUserId);
      let planContext = "";
      if (approvedPlanForContext && approvedPlanForContext.status === "approved") {
        const pTasks = await storage.getPlanTasks(approvedPlanForContext.id);
        if (pTasks.length > 0) {
          planContext = `\n\nAPPROVED PLAN: "${approvedPlanForContext.title}"\nTasks to implement (in order):\n` +
            pTasks.map((t, i) => `${i + 1}. [${t.status.toUpperCase()}] ${t.title}: ${t.description}`).join("\n") +
            `\n\nFollow this plan sequentially. Mark each task as complete by implementing all its requirements before moving to the next.`;
        }
      }

      const outputTypeContextMap: Record<string, string> = {
        "mobile-app": "\n\nThis project's output type is MOBILE APP (React Native/Expo). Generate React Native code with native components (View, Text, TouchableOpacity, FlatList, etc.), StyleSheet.create() for styling, Expo Router for navigation, and proper Expo config files. Preview runs via Expo Web, device testing via Expo Go QR code.",
        "mobile": "\n\nThis project's output type is MOBILE APP (React Native/Expo). Generate React Native code with native components (View, Text, TouchableOpacity, FlatList, etc.), StyleSheet.create() for styling, Expo Router for navigation, and proper Expo config files. Preview runs via Expo Web, device testing via Expo Go QR code.",
        "animation": "\n\nThis project's output type is ANIMATION. Generate scene-based React animations using CSS animations and requestAnimationFrame. Structure animations with a scene-based architecture where each scene has a duration, background, and animated elements. Use a useAnimationLoop hook that tracks time and supports play/pause/reset via postMessage. Include smooth enter/exit transitions between scenes (fade, scale, slide). Listen for 'animation-control' messages with actions: 'pause', 'play', 'reset'. Post 'animation-duration' message to parent with total duration. Templates: product promo, explainer, social media clip, brand intro.",
        "design": "\n\nThis project's output type is DESIGN. Generate design tools with canvas elements, color pickers, drawing tools (pen, shapes, text), layers, and export functionality. Use Canvas API or SVG.",
        "data-visualization": "\n\nThis project's output type is DATA VISUALIZATION. Generate dashboards using Chart.js (via CDN: https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js). Include:\n- Multiple chart types (bar, line, pie, doughnut, scatter, polar area) with real sample data\n- KPI cards showing key metrics with trend arrows and percentage changes\n- Interactive filters (date range selectors, dropdown filters, text search) that update all charts in real-time\n- Auto-refresh mechanism with configurable intervals (5s, 30s, 1m, 5m) using setInterval\n- Light/dark mode toggle using CSS custom properties (:root and [data-theme='light']) with localStorage persistence\n- CSV export buttons for individual charts and the full dashboard data\n- PDF export using html2canvas (CDN: https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js) and jsPDF (CDN: https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js)\n- An AI analysis summary section that dynamically generates insights from the data\n- Responsive grid layout that adapts to mobile screens\nUse CSS Grid for layout with auto-fit and minmax for responsiveness.",
        "automation": "\n\nThis project's output type is AUTOMATION. Generate Node.js automation scripts with file processing, scheduling (setInterval/cron patterns), logging, error handling, and clear console output.",
        "3d-game": "\n\nThis project's output type is 3D GAME. Generate Three.js games (via CDN) with camera controls, physics/collision, game loop, scoring, and keyboard/mouse input. Include a game over/restart mechanism.",
        "document": "\n\nThis project's output type is DOCUMENT. Generate rich text or Markdown editors with formatting toolbars (bold, italic, headers, lists), live preview, and export to HTML. Use contentEditable or textarea with parsing.",
        "spreadsheet": "\n\nThis project's output type is SPREADSHEET. Generate interactive data grids with formula support (SUM, AVG, COUNT), sorting, filtering, cell editing, and CSV import/export. Use HTML tables with contentEditable cells.",
      };

      const projectTypeContext = project.projectType === "slides"
        ? `\n\nThis is a SLIDES project. The user is building a presentation. You have access to the create_slide and edit_slide tools to create/modify slides. Each slide has an id, order, layout (title|content|two-column|image-full|blank), blocks array, and optional notes (speaker notes string). Block types: title, body, image, code, list. You can also set a theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, and accentColor.\n\nSlide templates available: pitch-deck, tech-talk, portfolio-slides, product-overview, team-update, educational-presentation.\n\nPresenter mode supports speaker notes, next-slide preview, and a timer. Export to PDF and PPTX is available — PPTX produces editable PowerPoint files with speaker notes preserved.`
        : project.projectType === "video"
        ? `\n\nThis is a VIDEO project. The user is creating a video composition. You have access to the create_video_scene and edit_video_scene tools to create/modify video scenes. Each scene has an id, order, duration (seconds), backgroundColor, elements array, and transition type. Element types: text, image, shape, overlay. Each element has position (x, y as %), size (width, height as %), startTime, endTime, style, and animation.`
        : (outputTypeContextMap[(project as any).outputType] || "");

      let secretNamesForPrompt = "(none configured yet)";
      try {
        const { getProjectSecretNames } = await import("../utils/secrets");
        const secretNames = await getProjectSecretNames(projectId);
        secretNamesForPrompt = secretNames.length > 0 ? secretNames.join(", ") : "(none configured yet)";
      } catch {}

      const agentSystemPrompt = `${agentResolved.systemPromptPrefix}You are an AI coding agent inside E-Code IDE. You can create and edit files in the user's project.

Current project: "${project.name}" (${project.language}, type: ${project.projectType || "web-app"}${isMobileProject ? ", mobile-app" : ""})
Existing files:
${fileList || "(no files yet)"}${mobileContext}

When the user asks you to build something, create files, or make changes:
1. Think about what files need to be created or modified
2. Use the provided tools to create or update files
3. Explain what you're doing as you work

When the user asks you to create a skill, use the create_skill tool to persist it.

When the user asks you to generate an image, use the generate_image tool. Choose an appropriate filename (e.g. 'assets/logo.png', 'images/hero.png'). Available sizes: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto.

When the user asks you to modify or refine an existing generated image, use the edit_image tool with the existing filename and a description of the changes.

When the user asks you to generate a document, report, spreadsheet, presentation, or data export, use the generate_file tool. Supported formats: pdf, docx, xlsx, pptx, csv. Structure the content using sections with types: heading (with level 1-3), paragraph, table (with headers and rows arrays), and list (with items array). Choose an appropriate filename with the correct extension.

When the user asks about data from connected services (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex), use the query_connector tool to read data or write_connector to create/update data. Available connectors and operations:
${getConnectorDescription()}

When the user asks you to find or search for images on the web (e.g. product photos, stock images, reference images), use the brave_image_search tool. Results include image URLs, thumbnails, and source attribution.

When the user asks for text-to-speech, voice narration, or audio generation from text, use the text_to_speech tool. Available voices: ${AVAILABLE_VOICES.map(v => `${v.name} (${v.description})`).join(", ")}.

When the user asks to generate an AI image (illustrations, art, hero images, concept art — NOT photos from the web), use the generate_ai_image tool with DALL-E 3. Supports size (square/landscape/portrait), quality (standard/hd), and style (vivid/natural).

When the user asks you to research a topic, find information, or answer questions requiring up-to-date knowledge, use the tavily_search tool. It provides AI-powered web search with answer synthesis and source attribution.

Always write complete, working code. Never use placeholders or TODOs.
NEVER create a single minimal file. Build the FULL application with ALL features the user asked for.

## ARCHITECTURE (CRITICAL — follow for ALL web projects):
You MUST build a COMPLETE, PRODUCTION-READY application — not a demo or prototype.
- Create a proper multi-file project structure:
  • package.json with ALL necessary dependencies
  • index.html as the entry point with proper meta tags
  • Multiple JS/TS files for different concerns (app logic, components, state, utilities, API)
  • Separate CSS file or Tailwind config if needed
- For ANY non-trivial app, create a React app using Vite:
  1. package.json with: react, react-dom, vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, lucide-react
  2. vite.config.js (or .ts) with React plugin and server host 0.0.0.0
  3. tailwind.config.js and postcss.config.js
  4. index.html with root div and script module
  5. src/main.jsx (or .tsx) mounting App
  6. src/App.jsx with router/layout
  7. src/index.css with Tailwind directives (@tailwind base/components/utilities)
  8. src/components/ with reusable UI components
  9. src/pages/ or src/views/ for different screens
- For simpler static apps (landing pages, simple tools), use a single index.html with Tailwind CDN
- ALWAYS run 'npm install' after creating package.json, then 'npm run dev' to start the server

## Command Execution & Error Recovery
You have access to execute_command to run shell commands in the project workspace.
- After creating project files, ALWAYS run 'npm install --legacy-peer-deps' to install dependencies.
- After installing dependencies, run 'npm run dev' to start the dev server so the preview updates.
- If a command fails, read the error output carefully. Use read_terminal_output to inspect the last command's output if needed.
- Fix the underlying issue (wrong package name, missing file, syntax error, etc.) and retry. You may retry up to 3 times before asking the user for help.
- After starting the dev server, the preview panel will automatically update.

## ENVIRONMENT VARIABLES & SECRETS
When you generate code that references process.env.VARIABLE_NAME or import.meta.env.VARIABLE_NAME:
1. After creating/editing files, review ALL environment variable references (process.env.XXX, import.meta.env.XXX) in the code you wrote.
2. Check if those variables are already configured in the project secrets. The following secrets are currently configured: ${secretNamesForPrompt}
3. For ANY referenced variable that is NOT in the list above, you MUST inform the user:
   - Tell them exactly which secrets they need to add (e.g., "Your project needs STRIPE_SECRET_KEY and OPENAI_API_KEY. Please add them in the Secrets panel (lock icon in the left sidebar).")
   - Explain briefly what each secret is for and where to get it
4. NEVER hardcode API keys, tokens, passwords, or sensitive values directly in code — always use environment variables.
5. You cannot read secret values (they are encrypted), but you can see their names to verify they exist.

## DESIGN QUALITY (CRITICAL — THIS IS YOUR #1 PRIORITY):
You are building apps that compete with the world's best AI-generated UIs (Replit, v0, Bolt).
Every app you generate MUST look like a PREMIUM, FORTUNE-500 SaaS product. Users will judge E-Code entirely based on how good your output looks.

MANDATORY DESIGN RULES:
1. VISUAL IDENTITY:
   - Dark mode by default with rich color palette (NOT plain gray — use deep blues, purples, gradients)
   - Primary accent color with complementary shades (e.g., indigo-500, violet-600, emerald-500)
   - Background: layered gradients (from-slate-950 via-slate-900 to-slate-950), subtle noise/grain texture
   - Cards: glass-morphism (bg-white/5 backdrop-blur-xl border border-white/10), soft glow shadows
   - Never use default browser styles — EVERY element must be intentionally designed

2. LAYOUT & SPACING:
   - Professional sidebar navigation (collapsible, icon+label, active states)
   - Proper content hierarchy with generous padding (p-6, p-8) and margins
   - CSS Grid or Flexbox for ALL layouts — no floats, no absolute positioning hacks
   - Max-width containers (max-w-7xl mx-auto) for content areas
   - Responsive: mobile-first with sm:, md:, lg:, xl: breakpoints

3. TYPOGRAPHY:
   - Import Inter or system font stack (font-sans)
   - Clear hierarchy: text-3xl/4xl font-bold for titles, text-lg for subtitles, text-sm for metadata
   - Proper line-height (leading-relaxed), letter-spacing, font-weight variation
   - Muted secondary text (text-slate-400, text-gray-500) for less important content

4. COMPONENTS (implement ALL of these that are relevant):
   - Header/Navbar with logo, navigation, user avatar, and action buttons
   - Sidebar with icon navigation, collapsible groups, active indicator
   - Data tables with sorting, filtering, pagination, and row selection
   - Forms with floating labels, validation states, error messages, and loading states
   - Modals/Dialogs with backdrop blur, enter/exit animations
   - Toast notifications (success/error/warning/info) with auto-dismiss
   - Loading skeletons (pulsing placeholders) instead of spinners where appropriate
   - Empty states with illustrations/icons and call-to-action buttons
   - Dropdown menus with search, keyboard navigation
   - Tabs with animated underline indicator
   - Tooltips, popovers, and context menus
   - Progress bars, status badges, and metric cards with trend indicators

5. ANIMATIONS & MICRO-INTERACTIONS:
   - Page transitions (fade-in, slide-up on mount)
   - Hover effects on ALL interactive elements (scale, color shift, shadow increase)
   - Smooth transitions (transition-all duration-200 ease-out)
   - Loading states with skeleton animations (animate-pulse)
   - Button press feedback (active:scale-95)
   - List items staggered entrance animation

6. ICONS: Use Lucide React (lucide-react) for React projects, or Lucide CDN for HTML projects

7. COMPLETENESS:
   - Build ALL features the user requested — not just 1 or 2
   - Include realistic sample data (names, dates, numbers, avatars, statuses)
   - Implement ALL CRUD operations if the app involves data management
   - Add search, filter, and sort functionality where appropriate
   - Include proper error handling and edge cases
   - Add keyboard shortcuts for power users (document them)
   - Include a responsive mobile layout

ABSOLUTELY FORBIDDEN:
- Plain unstyled HTML
- Default browser form elements without custom styling
- Missing features that the user explicitly asked for
- Single-file "demo" apps when a full app was requested
- Placeholder text like "Lorem ipsum" — use realistic contextual content
- Generic titles like "My App" — use the project context${projectTypeContext}${ecodeGuidelines}${webSearchEnabled ? `

## Web Search
You have access to web search tools. Use them when:
- The user asks about current information, latest versions, prices, or recent events
- You need to look up API documentation, package info, or framework details
- The user asks you to research something or find specific information online

Use \`web_search\` to search for information. Use \`fetch_url\` to read the full content of a specific URL when you need more detail than the search snippet provides.
Always cite your sources in your response when using information from web searches.` : ""}${agentSkillsContext}${mcpToolsContext}${planContext}`;

      if (ecodeRegenerated && ecodeFile) {
        res.write(`data: ${JSON.stringify({ type: "file_created", file: { id: ecodeFile.id, filename: "ecode.md", content: ecodeFile.content } })}\n\n`);
      }

      const agentTurboMaxTokens = Math.min(agentResolved.maxTokens, 16384);
      console.log(`[AI-AGENT] maxTokens resolved: ${agentResolved.maxTokens} → capped to ${agentTurboMaxTokens}, model: ${agentModelId}, topMode: ${req.body.topAgentMode}, selectedModel: ${agentSelectedModel}`);

      const userId = req.session.userId!;
      const approvedPlan = await storage.getLatestPlan(projectId, userId);
      let planTasks: { id: string; title: string; description: string; status: string; sortOrder: number }[] = [];
      let currentTaskIndex = 0;
      if (approvedPlan && approvedPlan.status === "approved") {
        const tasks = await storage.getPlanTasks(approvedPlan.id);
        planTasks = tasks.map(t => ({ id: t.id, title: t.title, description: t.description, status: t.status, sortOrder: t.sortOrder }));
        const firstPending = planTasks.findIndex(t => t.status === "pending");
        currentTaskIndex = firstPending >= 0 ? firstPending : 0;
      }

      async function advancePlanTask() {
        if (planTasks.length === 0 || !approvedPlan) return;
        if (currentTaskIndex >= planTasks.length) return;

        const task = planTasks[currentTaskIndex];
        if (task.status === "pending") {
          await storage.updatePlanTask(task.id, { status: "in-progress" });
          task.status = "in-progress";
          res.write(`data: ${JSON.stringify({ type: "task_progress", taskId: task.id, status: "in-progress", sortOrder: task.sortOrder })}\n\n`);
        }
      }

      async function completePlanTask() {
        if (planTasks.length === 0 || !approvedPlan) return;
        if (currentTaskIndex >= planTasks.length) return;

        const task = planTasks[currentTaskIndex];
        await storage.updatePlanTask(task.id, { status: "done" });
        task.status = "done";
        res.write(`data: ${JSON.stringify({ type: "task_progress", taskId: task.id, status: "done", sortOrder: task.sortOrder })}\n\n`);
        currentTaskIndex++;

        if (currentTaskIndex < planTasks.length) {
          await advancePlanTask();
        }
      }

      if (planTasks.length > 0) {
        res.write(`data: ${JSON.stringify({ type: "status", message: `Following plan: ${planTasks.length} task${planTasks.length !== 1 ? "s" : ""} to complete` })}\n\n`);
        await advancePlanTask();
      }

      res.write(`data: ${JSON.stringify({ type: "status", message: `Thinking with ${agentSelectedModel === "gemini" ? "Gemini" : agentSelectedModel === "gpt" ? "GPT-4" : "Claude"}...` })}\n\n`);

      if (agentSelectedModel === "gemini") {
        const geminiToolDeclarations: FunctionDeclaration[] = [
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
            {
              name: "create_skill",
              description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The skill name" },
                  description: { type: Type.STRING, description: "A short description of what the skill teaches" },
                  content: { type: Type.STRING, description: "The full skill content in markdown" },
                },
                required: ["name", "content"],
              },
            },
            {
              name: "generate_image",
              description: "Generate an AI image using DALL-E and save it as a project file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING, description: "A detailed description of the image to generate" },
                  filename: { type: Type.STRING, description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                  size: { type: Type.STRING, description: "Image size: '1024x1024' (square), '1024x1536' (portrait), '1536x1024' (landscape), or 'auto'" },
                },
                required: ["prompt", "filename"],
              },
            },
            {
              name: "edit_image",
              description: "Modify an existing generated image in the project using AI",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename of the existing image to edit" },
                  modification_prompt: { type: Type.STRING, description: "Description of the changes to make to the image" },
                },
                required: ["filename", "modification_prompt"],
              },
            },
            {
              name: "generate_file",
              description: "Generate a downloadable file (PDF, DOCX, XLSX, PPTX, or CSV) with structured content including headings, paragraphs, tables, and lists",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  format: { type: Type.STRING, description: "File format: 'pdf', 'docx', 'xlsx', 'pptx', or 'csv'" },
                  filename: { type: Type.STRING, description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx', 'slides.pptx')" },
                  title: { type: Type.STRING, description: "Document title (optional)" },
                  sections: {
                    type: Type.ARRAY,
                    description: "Array of content sections",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "Section type: 'heading', 'paragraph', 'table', or 'list'" },
                        content: { type: Type.STRING, description: "Text content for heading or paragraph sections" },
                        level: { type: Type.NUMBER, description: "Heading level (1-3), only for heading type" },
                        headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Column headers for table type" },
                        rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } }, description: "Data rows for table type" },
                        items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List items for list type" },
                      },
                      required: ["type"],
                    },
                  },
                },
                required: ["format", "filename", "sections"],
              },
            },
            {
              name: "query_connector",
              description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  connector: { type: Type.STRING, description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                  operation: { type: Type.STRING, description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                  params: { type: Type.OBJECT, description: "Operation-specific parameters as key-value pairs", properties: {} },
                },
                required: ["connector", "operation"],
              },
            },
            {
              name: "write_connector",
              description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  connector: { type: Type.STRING, description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                  operation: { type: Type.STRING, description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                  params: { type: Type.OBJECT, description: "Operation-specific parameters as key-value pairs", properties: {} },
                },
                required: ["connector", "operation"],
              },
            },
            {
              name: "update_slides",
              description: "Create or update the slides data for a slides project. Provide the full array of slides and optionally a theme. Each slide can include speaker notes.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  slides: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, order: { type: Type.NUMBER }, layout: { type: Type.STRING, description: "Layout: title, content, two-column, image-full, or blank" }, blocks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING, description: "Block type: title, body, image, code, or list" }, content: { type: Type.STRING } }, required: ["id", "type", "content"] } }, notes: { type: Type.STRING, description: "Optional speaker notes for presenter mode" } }, required: ["id", "order", "blocks"] }, description: "Array of slide objects" },
                  theme: { type: Type.OBJECT, properties: { primaryColor: { type: Type.STRING }, secondaryColor: { type: Type.STRING }, backgroundColor: { type: Type.STRING }, textColor: { type: Type.STRING }, fontFamily: { type: Type.STRING }, accentColor: { type: Type.STRING } }, description: "Optional theme object" },
                },
                required: ["slides"],
              },
            },
            {
              name: "edit_slide",
              description: "Edit existing slides in a slides project. Provide the updated full array of slides and optionally a theme. Each slide can include speaker notes.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  slides: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, order: { type: Type.NUMBER }, layout: { type: Type.STRING, description: "Layout: title, content, two-column, image-full, or blank" }, blocks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING, description: "Block type: title, body, image, code, or list" }, content: { type: Type.STRING } }, required: ["id", "type", "content"] } }, notes: { type: Type.STRING, description: "Optional speaker notes for presenter mode" } }, required: ["id", "order", "blocks"] }, description: "Array of slide objects" },
                  theme: { type: Type.OBJECT, properties: { primaryColor: { type: Type.STRING }, secondaryColor: { type: Type.STRING }, backgroundColor: { type: Type.STRING }, textColor: { type: Type.STRING }, fontFamily: { type: Type.STRING }, accentColor: { type: Type.STRING } }, description: "Optional theme object" },
                },
                required: ["slides"],
              },
            },
            {
              name: "create_video_scene",
              description: "Create video scenes for a video project. Provide the full array of scenes and optionally audio tracks.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, order: { type: Type.NUMBER }, duration: { type: Type.NUMBER }, backgroundColor: { type: Type.STRING }, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING }, content: { type: Type.STRING } }, required: ["id", "type"] } }, transition: { type: Type.STRING } }, required: ["id", "order", "duration"] }, description: "Array of scene objects" },
                  audioTracks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, url: { type: Type.STRING }, volume: { type: Type.NUMBER } }, required: ["id"] }, description: "Optional audio tracks" },
                },
                required: ["scenes"],
              },
            },
            {
              name: "edit_video_scene",
              description: "Edit existing video scenes in a video project. Provide the updated full array of scenes and optionally audio tracks.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, order: { type: Type.NUMBER }, duration: { type: Type.NUMBER }, backgroundColor: { type: Type.STRING }, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING }, content: { type: Type.STRING } }, required: ["id", "type"] } }, transition: { type: Type.STRING } }, required: ["id", "order", "duration"] }, description: "Array of scene objects" },
                  audioTracks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, url: { type: Type.STRING }, volume: { type: Type.NUMBER } }, required: ["id"] }, description: "Optional audio tracks" },
                },
                required: ["scenes"],
              },
            },
            {
              name: "brave_image_search",
              description: "Search the web for images using Brave Image Search. Use when the user wants to find photos, product images, stock images, or reference images from the web.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "The image search query (e.g. 'modern office interior', 'sunset landscape photo')" },
                  count: { type: Type.NUMBER, description: "Number of results to return (1-20, default 8)" },
                },
                required: ["query"],
              },
            },
            {
              name: "text_to_speech",
              description: "Generate realistic text-to-speech audio using ElevenLabs. Use when the user wants voice narration, audio content, or spoken text.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "The text to convert to speech (max 5000 characters)" },
                  voice_id: { type: Type.STRING, description: "Voice ID to use. Available voices: Rachel (calm female), Drew (male), Bella (soft female), Josh (deep male), Adam (versatile male)" },
                },
                required: ["text"],
              },
            },
            {
              name: "generate_ai_image",
              description: "Generate an AI image using DALL-E 3. Use for illustrations, concept art, hero images, and creative AI-generated visuals. Supports size (square/landscape/portrait), quality (standard/hd), style (vivid/natural).",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING, description: "A detailed description of the image to generate" },
                  filename: { type: Type.STRING, description: "Filename to save the image as (e.g. 'assets/hero.png')" },
                  size: { type: Type.STRING, description: "Image size: square, landscape, or portrait" },
                  quality: { type: Type.STRING, description: "Image quality: standard or hd" },
                  style: { type: Type.STRING, description: "Image style: vivid or natural" },
                },
                required: ["prompt"],
              },
            },
            {
              name: "tavily_search",
              description: "AI-powered web search with answer synthesis. Use for research, fact-checking, finding up-to-date information, and getting sourced answers.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "The search query" },
                  depth: { type: Type.STRING, description: "Search depth: basic (fast) or advanced (thorough)" },
                },
                required: ["query"],
              },
            },
            {
              name: "execute_command",
              description: "Execute a shell command in the project workspace directory (e.g. npm install, npm run build, python -m pip install). Use to install dependencies or run build commands.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  command: { type: Type.STRING, description: "The shell command to execute (e.g. 'npm install', 'npm run dev')" },
                },
                required: ["command"],
              },
            },
        ];
        if (webSearchEnabled) {
          geminiToolDeclarations.push(
            {
              name: "web_search",
              description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "The search query" },
                },
                required: ["query"],
              },
            },
            {
              name: "fetch_url",
              description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING, description: "The full URL to fetch (must start with http:// or https://)" },
                },
                required: ["url"],
              },
            },
          );
        }
        geminiToolDeclarations.push(
            ...mcpToolDefinitions.map(t => ({
              name: t.name,
              description: t.description,
              parameters: convertJsonSchemaToGemini(t.inputSchema),
            })),
        );
        const geminiTools = [{ functionDeclarations: geminiToolDeclarations }];

        let geminiContents: Content[] = [
          { role: "user", parts: [{ text: agentSystemPrompt }] },
          { role: "model", parts: [{ text: "I understand. I'm ready to help with your project." }] },
          ...messages.map((m: { role: string; content: string }) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await agentGeminiClient.models.generateContent({
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
              const toolInput = fn.args as any;

              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "edit_image" ? "Editing image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : fn.name === "brave_image_search" ? "Searching for images" : fn.name === "text_to_speech" ? "Generating speech" : fn.name === "generate_ai_image" ? "Generating AI image" : fn.name === "tavily_search" ? "Researching" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name!.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name!.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(fn.name!, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions, completePlanTask, req.session.userId!);

              toolResponseParts.push({
                functionResponse: {
                  name: fn.name,
                  response: { result: result || "Done" },
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
      } else if (agentSelectedModel === "gpt" || agentSelectedModel === "openrouter") {
        const agentOrModelId = agentSelectedModel === "openrouter" ? "openai/gpt-4o" : agentModelId;
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
          {
            type: "function",
            function: {
              name: "create_skill",
              description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The skill name" },
                  description: { type: "string", description: "A short description of what the skill teaches" },
                  content: { type: "string", description: "The full skill content in markdown" },
                },
                required: ["name", "content"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_image",
              description: "Generate an AI image using DALL-E and save it as a project file",
              parameters: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "A detailed description of the image to generate" },
                  filename: { type: "string", description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                  size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], description: "Image size" },
                },
                required: ["prompt", "filename"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "create_slide",
              description: "Create slides for a slides project. Provide the full array of slides and optionally a theme. Each slide can include speaker notes.",
              parameters: {
                type: "object",
                properties: {
                  slides: { type: "array", items: { type: "object" }, description: "Array of slide objects with id, order, layout (title|content|two-column|image-full|blank), blocks, and optional notes (speaker notes string)" },
                  theme: { type: "object", description: "Optional theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, accentColor" },
                },
                required: ["slides"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_slide",
              description: "Edit existing slides in a slides project. Provide the updated full array of slides and optionally a theme. Each slide can include speaker notes.",
              parameters: {
                type: "object",
                properties: {
                  slides: { type: "array", items: { type: "object" }, description: "Array of slide objects with id, order, layout (title|content|two-column|image-full|blank), blocks, and optional notes (speaker notes string)" },
                  theme: { type: "object", description: "Optional theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, accentColor" },
                },
                required: ["slides"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_image",
              description: "Modify an existing generated image in the project using AI",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename of the existing image to edit" },
                  modification_prompt: { type: "string", description: "Description of the changes to make to the image" },
                },
                required: ["filename", "modification_prompt"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_file",
              description: "Generate a downloadable file (PDF, DOCX, XLSX, PPTX, or CSV) with structured content including headings, paragraphs, tables, and lists",
              parameters: {
                type: "object",
                properties: {
                  format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv", "pptx"], description: "File format" },
                  filename: { type: "string", description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx', 'slides.pptx')" },
                  title: { type: "string", description: "Document title (optional)" },
                  sections: {
                    type: "array",
                    description: "Array of content sections",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["heading", "paragraph", "table", "list"], description: "Section type" },
                        content: { type: "string", description: "Text content for heading or paragraph sections" },
                        level: { type: "number", description: "Heading level (1-3), only for heading type" },
                        headers: { type: "array", items: { type: "string" }, description: "Column headers for table type" },
                        rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Data rows for table type" },
                        items: { type: "array", items: { type: "string" }, description: "List items for list type" },
                      },
                      required: ["type"],
                    },
                  },
                },
                required: ["format", "filename", "sections"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "query_connector",
              description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
              parameters: {
                type: "object",
                properties: {
                  connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                  operation: { type: "string", description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                  params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
                },
                required: ["connector", "operation"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "write_connector",
              description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
              parameters: {
                type: "object",
                properties: {
                  connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                  operation: { type: "string", description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                  params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
                },
                required: ["connector", "operation"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "update_slides",
              description: "Create or update the slides data for a slides project. Provide the full array of slides and optionally a theme. Each slide can include speaker notes.",
              parameters: {
                type: "object",
                properties: {
                  slides: { type: "array", items: { type: "object" }, description: "Array of slide objects with id, order, layout (title|content|two-column|image-full|blank), blocks, and optional notes (speaker notes string)" },
                  theme: { type: "object", description: "Optional theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, accentColor" },
                },
                required: ["slides"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "update_video",
              description: "Create or update the video data for a video project. Provide the full array of scenes and optionally audio tracks.",
              parameters: {
                type: "object",
                properties: {
                  scenes: { type: "array", items: { type: "object" }, description: "Array of scene objects with id, order, duration, backgroundColor, elements, transition" },
                  audioTracks: { type: "array", items: { type: "object" }, description: "Optional audio tracks with id, name, url, volume" },
                },
                required: ["scenes"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "brave_image_search",
              description: "Search the web for images using Brave Image Search. Use when the user wants to find photos, product images, stock images, or reference images from the web.",
              parameters: { type: "object", properties: { query: { type: "string", description: "The image search query" }, count: { type: "number", description: "Number of results (1-20, default 8)" } }, required: ["query"] },
            },
          },
          {
            type: "function",
            function: {
              name: "text_to_speech",
              description: "Generate realistic text-to-speech audio using ElevenLabs. Use when the user wants voice narration, audio content, or spoken text.",
              parameters: { type: "object", properties: { text: { type: "string", description: "The text to convert to speech (max 5000 characters)" }, voice_id: { type: "string", description: "Voice ID to use" } }, required: ["text"] },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_ai_image",
              description: "Generate an AI image using DALL-E 3. Use for illustrations, concept art, hero images, and creative AI-generated visuals. Supports size (square/landscape/portrait), quality (standard/hd), style (vivid/natural).",
              parameters: { type: "object", properties: { prompt: { type: "string", description: "A detailed description of the image to generate" }, filename: { type: "string", description: "Filename to save as" }, size: { type: "string", description: "Image size: square, landscape, or portrait" }, quality: { type: "string", description: "Image quality: standard or hd" }, style: { type: "string", description: "Image style: vivid or natural" } }, required: ["prompt"] },
            },
          },
          {
            type: "function",
            function: {
              name: "tavily_search",
              description: "AI-powered web search with answer synthesis. Use for research, fact-checking, finding up-to-date information, and getting sourced answers.",
              parameters: { type: "object", properties: { query: { type: "string", description: "The search query" }, depth: { type: "string", description: "Search depth: basic (fast) or advanced (thorough)" } }, required: ["query"] },
            },
          },
          {
            type: "function",
            function: {
              name: "execute_command",
              description: "Execute a shell command in the project workspace directory (e.g. npm install, npm run build, python -m pip install). Use to install dependencies or run build commands.",
              parameters: { type: "object", properties: { command: { type: "string", description: "The shell command to execute" } }, required: ["command"] },
            },
          },
          ...mcpToolDefinitions.map(t => ({
            type: "function" as const,
            function: { name: t.name, description: t.description, parameters: t.inputSchema },
          })),
        ];
        if (webSearchEnabled) {
          openaiTools.push(
            {
              type: "function",
              function: {
                name: "web_search",
                description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "The search query" },
                  },
                  required: ["query"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "fetch_url",
                description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
                parameters: {
                  type: "object",
                  properties: {
                    url: { type: "string", description: "The full URL to fetch (must start with http:// or https://)" },
                  },
                  required: ["url"],
                },
              },
            },
          );
        }

        let gptMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: agentSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await agentOpenaiClient.chat.completions.create({
            model: agentOrModelId,
            messages: gptMessages,
            tools: openaiTools,
            max_completion_tokens: agentTurboMaxTokens,
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
              const toolInput = JSON.parse(fn.arguments) as any;

              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "edit_image" ? "Editing image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : fn.name === "brave_image_search" ? "Searching for images" : fn.name === "text_to_speech" ? "Generating speech" : fn.name === "generate_ai_image" ? "Generating AI image" : fn.name === "tavily_search" ? "Researching" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions, completePlanTask, req.session.userId!);

              toolResultMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result || "Done",
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
      } else if (agentSelectedModel === "openrouter") {
        const orAgentModelId = req.body.openrouterModel || agentModelId;

        const orTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          {
            type: "function",
            function: {
              name: "create_file",
              description: "Create a new file in the project with the given filename and content",
              parameters: { type: "object", properties: { filename: { type: "string", description: "The filename" }, content: { type: "string", description: "The full file content" } }, required: ["filename", "content"] },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_file",
              description: "Replace the entire content of an existing file",
              parameters: { type: "object", properties: { filename: { type: "string", description: "The filename of the existing file to edit" }, content: { type: "string", description: "The new full file content" } }, required: ["filename", "content"] },
            },
          },
          {
            type: "function",
            function: {
              name: "create_skill",
              description: "Create a reusable skill that teaches the AI agent project-specific patterns",
              parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, content: { type: "string" } }, required: ["name", "content"] },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_image",
              description: "Generate an AI image and save it as a project file",
              parameters: { type: "object", properties: { prompt: { type: "string" }, filename: { type: "string" }, size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"] } }, required: ["prompt", "filename"] },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_image",
              description: "Modify an existing generated image in the project using AI",
              parameters: { type: "object", properties: { filename: { type: "string" }, modification_prompt: { type: "string" } }, required: ["filename", "modification_prompt"] },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_file",
              description: "Generate a downloadable file (PDF, DOCX, XLSX, PPTX, or CSV)",
              parameters: { type: "object", properties: { format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv", "pptx"] }, filename: { type: "string" }, title: { type: "string" }, sections: { type: "array", items: { type: "object" } } }, required: ["format", "filename", "sections"] },
            },
          },
          {
            type: "function",
            function: {
              name: "query_connector",
              description: "Read data from a connected external service",
              parameters: { type: "object", properties: { connector: { type: "string" }, operation: { type: "string" }, params: { type: "object" } }, required: ["connector", "operation"] },
            },
          },
          {
            type: "function",
            function: {
              name: "write_connector",
              description: "Write data to a connected external service",
              parameters: { type: "object", properties: { connector: { type: "string" }, operation: { type: "string" }, params: { type: "object" } }, required: ["connector", "operation"] },
            },
          },
          { type: "function", function: { name: "brave_image_search", description: "Search the web for images using Brave Image Search", parameters: { type: "object", properties: { query: { type: "string" }, count: { type: "number" } }, required: ["query"] } } },
          { type: "function", function: { name: "text_to_speech", description: "Generate text-to-speech audio using ElevenLabs", parameters: { type: "object", properties: { text: { type: "string" }, voice_id: { type: "string" } }, required: ["text"] } } },
          { type: "function", function: { name: "generate_ai_image", description: "Generate an AI image using DALL-E 3. Supports size (square/landscape/portrait), quality (standard/hd), style (vivid/natural).", parameters: { type: "object", properties: { prompt: { type: "string" }, filename: { type: "string" }, size: { type: "string" }, quality: { type: "string" }, style: { type: "string" } }, required: ["prompt"] } } },
          { type: "function", function: { name: "tavily_search", description: "AI-powered web search with answer synthesis and source attribution", parameters: { type: "object", properties: { query: { type: "string" }, depth: { type: "string" } }, required: ["query"] } } },
          { type: "function", function: { name: "execute_command", description: "Execute a shell command in the project workspace directory (e.g. npm install, npm run build). Use to install dependencies or run build commands.", parameters: { type: "object", properties: { command: { type: "string", description: "The shell command to execute" } }, required: ["command"] } } },
          ...mcpToolDefinitions.map(t => ({
            type: "function" as const,
            function: { name: t.name, description: t.description, parameters: t.inputSchema },
          })),
        ];
        if (webSearchEnabled) {
          orTools.push(
            { type: "function", function: { name: "web_search", description: "Search the web for current information", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
            { type: "function", function: { name: "fetch_url", description: "Fetch and read the content of a specific web page URL", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
          );
        }

        let orMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: agentSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await openrouter.chat.completions.create({
            model: orAgentModelId,
            messages: orMessages,
            tools: orTools,
            max_tokens: agentTurboMaxTokens,
            ...OPENROUTER_PRIVACY_BODY,
          } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & Record<string, unknown>, OPENROUTER_REQUEST_OPTS);

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
              const toolInput = JSON.parse(fn.arguments) as any;

              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "edit_image" ? "Editing image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : fn.name === "brave_image_search" ? "Searching for images" : fn.name === "text_to_speech" ? "Generating speech" : fn.name === "generate_ai_image" ? "Generating AI image" : fn.name === "tavily_search" ? "Researching" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions, completePlanTask, req.session.userId!);

              toolResultMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result || "Done",
              });
            }

            const assistantMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
              role: "assistant",
              content: message.content,
              tool_calls: message.tool_calls,
            };

            orMessages = [
              ...orMessages,
              assistantMsg,
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
      } else if (agentSelectedModel === "perplexity" || agentSelectedModel === "mistral") {
        const extClient = agentOpenaiClient;
        const extTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          { type: "function", function: { name: "create_file", description: "Create a new file in the project with the given filename and content", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "edit_file", description: "Replace the entire content of an existing file", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "create_skill", description: "Create a reusable skill", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, content: { type: "string" } }, required: ["name", "content"] } } },
          { type: "function", function: { name: "generate_image", description: "Generate an AI image and save it as a project file", parameters: { type: "object", properties: { prompt: { type: "string" }, filename: { type: "string" }, size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"] } }, required: ["prompt", "filename"] } } },
          { type: "function", function: { name: "generate_file", description: "Generate a downloadable file (PDF, DOCX, XLSX, PPTX, or CSV)", parameters: { type: "object", properties: { format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv", "pptx"] }, filename: { type: "string" }, title: { type: "string" }, sections: { type: "array", items: { type: "object" } } }, required: ["format", "filename", "sections"] } } },
          { type: "function", function: { name: "execute_command", description: "Execute a shell command in the project workspace directory (e.g. npm install, npm run build)", parameters: { type: "object", properties: { command: { type: "string", description: "The shell command to execute" } }, required: ["command"] } } },
          ...mcpToolDefinitions.map(t => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
        ];
        if (webSearchEnabled) {
          extTools.push(
            { type: "function", function: { name: "web_search", description: "Search the web for current information", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
            { type: "function", function: { name: "fetch_url", description: "Fetch and read the content of a specific web page URL", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
          );
        }

        let extMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: agentSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await extClient.chat.completions.create({
            model: agentModelId,
            messages: extMessages,
            tools: extTools,
            max_tokens: agentTurboMaxTokens,
          });

          const choice = response.choices[0];
          const message = choice.message;

          if (message.content) {
            res.write(`data: ${JSON.stringify({ type: "text", content: message.content })}\n\n`);
          }

          if (agentSelectedModel === "perplexity") {
            const pplxCitations = formatPerplexityCitations(response as any);
            if (pplxCitations) {
              res.write(`data: ${JSON.stringify({ type: "text", content: pplxCitations })}\n\n`);
            }
          }

          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== "function") continue;
              const fn = toolCall.function;
              const toolInput = JSON.parse(fn.arguments) as any;
              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);
              const result = await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions, completePlanTask, req.session.userId!);
              toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result || "Done" });
            }
            extMessages = [...extMessages, { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any, ...toolResultMessages];
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
          {
            name: "create_skill",
            description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
            input_schema: {
              type: "object" as const,
              properties: {
                name: { type: "string", description: "The skill name" },
                description: { type: "string", description: "A short description of what the skill teaches" },
                content: { type: "string", description: "The full skill content in markdown" },
              },
              required: ["name", "content"],
            },
          },
          {
            name: "generate_image",
            description: "Generate an AI image using DALL-E and save it as a project file",
            input_schema: {
              type: "object" as const,
              properties: {
                prompt: { type: "string", description: "A detailed description of the image to generate" },
                filename: { type: "string", description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], description: "Image size" },
              },
              required: ["prompt", "filename"],
            },
          },
          {
            name: "edit_image",
            description: "Modify an existing generated image in the project using AI",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename of the existing image to edit" },
                modification_prompt: { type: "string", description: "Description of the changes to make to the image" },
              },
              required: ["filename", "modification_prompt"],
            },
          },
          {
            name: "generate_file",
            description: "Generate a downloadable file (PDF, DOCX, XLSX, PPTX, or CSV) with structured content including headings, paragraphs, tables, and lists",
            input_schema: {
              type: "object" as const,
              properties: {
                format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv", "pptx"], description: "File format" },
                filename: { type: "string", description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx', 'slides.pptx')" },
                title: { type: "string", description: "Document title (optional)" },
                sections: {
                  type: "array",
                  description: "Array of content sections",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["heading", "paragraph", "table", "list"], description: "Section type" },
                      content: { type: "string", description: "Text content for heading or paragraph sections" },
                      level: { type: "number", description: "Heading level (1-3), only for heading type" },
                      headers: { type: "array", items: { type: "string" }, description: "Column headers for table type" },
                      rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Data rows for table type" },
                      items: { type: "array", items: { type: "string" }, description: "List items for list type" },
                    },
                    required: ["type"],
                  },
                },
              },
              required: ["format", "filename", "sections"],
            },
          },
          {
            name: "query_connector",
            description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
            input_schema: {
              type: "object" as const,
              properties: {
                connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                operation: { type: "string", description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
              },
              required: ["connector", "operation"],
            },
          },
          {
            name: "write_connector",
            description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
            input_schema: {
              type: "object" as const,
              properties: {
                connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                operation: { type: "string", description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
              },
              required: ["connector", "operation"],
            },
          },
          {
            name: "update_slides",
            description: "Create or update the slides data for a slides project. Provide the full array of slides and optionally a theme. Each slide can include speaker notes.",
            input_schema: {
              type: "object" as const,
              properties: {
                slides: { type: "array", items: { type: "object" }, description: "Array of slide objects with id, order, layout (title|content|two-column|image-full|blank), blocks, and optional notes (speaker notes string)" },
                theme: { type: "object", description: "Optional theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, accentColor" },
              },
              required: ["slides"],
            },
          },
          {
            name: "edit_slide",
            description: "Edit existing slides in a slides project. Provide the updated full array of slides and optionally a theme. Each slide can include speaker notes.",
            input_schema: {
              type: "object" as const,
              properties: {
                slides: { type: "array", items: { type: "object" }, description: "Array of slide objects with id, order, layout (title|content|two-column|image-full|blank), blocks, and optional notes (speaker notes string)" },
                theme: { type: "object", description: "Optional theme with primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, accentColor" },
              },
              required: ["slides"],
            },
          },
          {
            name: "create_video_scene",
            description: "Create video scenes for a video project. Provide the full array of scenes and optionally audio tracks.",
            input_schema: {
              type: "object" as const,
              properties: {
                scenes: { type: "array", items: { type: "object" }, description: "Array of scene objects with id, order, duration, backgroundColor, elements, transition" },
                audioTracks: { type: "array", items: { type: "object" }, description: "Optional audio tracks with id, name, url, volume" },
              },
              required: ["scenes"],
            },
          },
          {
            name: "edit_video_scene",
            description: "Edit existing video scenes in a video project. Provide the updated full array of scenes and optionally audio tracks.",
            input_schema: {
              type: "object" as const,
              properties: {
                scenes: { type: "array", items: { type: "object" }, description: "Array of scene objects with id, order, duration, backgroundColor, elements, transition" },
                audioTracks: { type: "array", items: { type: "object" }, description: "Optional audio tracks with id, name, url, volume" },
              },
              required: ["scenes"],
            },
          },
          {
            name: "brave_image_search",
            description: "Search the web for images using Brave Image Search. Use when the user wants to find photos, product images, stock images, or reference images from the web.",
            input_schema: {
              type: "object" as const,
              properties: {
                query: { type: "string", description: "The image search query" },
                count: { type: "number", description: "Number of results (1-20, default 8)" },
              },
              required: ["query"],
            },
          },
          {
            name: "text_to_speech",
            description: "Generate realistic text-to-speech audio using ElevenLabs. Use when the user wants voice narration, audio content, or spoken text.",
            input_schema: {
              type: "object" as const,
              properties: {
                text: { type: "string", description: "The text to convert to speech (max 5000 characters)" },
                voice_id: { type: "string", description: "Voice ID to use" },
              },
              required: ["text"],
            },
          },
          {
            name: "generate_ai_image",
            description: "Generate an AI image using DALL-E 3. Use for illustrations, concept art, hero images, and creative AI-generated visuals. Supports size (square/landscape/portrait), quality (standard/hd), style (vivid/natural).",
            input_schema: {
              type: "object" as const,
              properties: {
                prompt: { type: "string", description: "A detailed description of the image to generate" },
                filename: { type: "string", description: "Filename to save the image as" },
                size: { type: "string", description: "Image size: square, landscape, or portrait" },
                quality: { type: "string", description: "Image quality: standard or hd" },
                style: { type: "string", description: "Image style: vivid or natural" },
              },
              required: ["prompt"],
            },
          },
          {
            name: "tavily_search",
            description: "AI-powered web search with answer synthesis. Use for research, fact-checking, finding up-to-date information, and getting sourced answers.",
            input_schema: {
              type: "object" as const,
              properties: {
                query: { type: "string", description: "The search query" },
                depth: { type: "string", description: "Search depth: basic (fast) or advanced (thorough)" },
              },
              required: ["query"],
            },
          },
          {
            name: "execute_command",
            description: "Execute a shell command in the project workspace directory (e.g. npm install, npm run build, python -m pip install). Use to install dependencies or run build commands.",
            input_schema: {
              type: "object" as const,
              properties: {
                command: { type: "string", description: "The shell command to execute (e.g. 'npm install', 'npm run build')" },
              },
              required: ["command"],
            },
          },
          ...mcpToolDefinitions.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: { type: "object" as const, ...t.inputSchema },
          })),
        ];
        if (webSearchEnabled) {
          tools.push(
            {
              name: "web_search",
              description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
              input_schema: {
                type: "object" as const,
                properties: {
                  query: { type: "string", description: "The search query" },
                },
                required: ["query"],
              },
            },
            {
              name: "fetch_url",
              description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
              input_schema: {
                type: "object" as const,
                properties: {
                  url: { type: "string", description: "The full URL to fetch (must start with http:// or https://)" },
                },
                required: ["url"],
              },
            },
          );
        }

        let currentMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await agentAnthropicClient.messages.create({
            model: agentModelId,
            system: agentSystemPrompt,
            messages: currentMessages,
            max_tokens: agentTurboMaxTokens > 16384 ? 8192 : 4096,
            tools,
          });

          const toolResultMap = new Map<string, string>();
          for (const block of response.content) {
            if (block.type === "text") {
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              const input = block.input as any;

              const toolLabel = block.name === "generate_image" ? "Generating image" : block.name === "edit_image" ? "Editing image" : block.name === "generate_file" ? "Generating file" : block.name === "web_search" ? "Searching the web" : block.name === "fetch_url" ? "Fetching content" : block.name === "brave_image_search" ? "Searching for images" : block.name === "text_to_speech" ? "Generating speech" : block.name === "generate_ai_image" ? "Generating AI image" : block.name === "tavily_search" ? "Researching" : undefined;
              res.write(`data: ${JSON.stringify({ type: block.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: block.name, input: block.name.startsWith("mcp__") ? {} : { filename: input.filename, query: input.query, url: input.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(block.name, input, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions, completePlanTask, req.session.userId!);
              toolResultMap.set(block.id, result);
            }
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: any[] = response.content
              .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
              .map((b) => ({
                type: "tool_result" as const,
                tool_use_id: b.id,
                content: toolResultMap.get(b.id) || "Done",
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

      const userQuota = await storage.getUserQuota(req.session.userId!);
      const shouldOptimize = optimize || userQuota.codeOptimizationsEnabled;
      if (shouldOptimize && agentModifiedFiles.size > 0) {
        const updatedFiles = await storage.getFiles(projectId);
        const changedFiles = updatedFiles.filter(f => agentModifiedFiles.has(f.filename));
        const changedFileSummary = changedFiles
          .map(f => `### ${f.filename}\n\`\`\`\n${typeof f.content === "string" ? f.content.slice(0, 3000) : ""}\n\`\`\``)
          .join("\n\n");

        const optimizePrompt = `You just completed changes to the project "${project.name}". Review the modified files below for code quality, simplification opportunities, and potential issues. Provide a concise review with specific suggestions. Use markdown formatting.

Modified files:
${changedFileSummary}

Review for:
1. Code quality issues (unused variables, dead code, inconsistencies)
2. Simplification opportunities (redundant logic, verbose patterns)
3. Potential bugs or edge cases
4. Performance improvements

Be concise and actionable. Only mention real issues, not style preferences.`;

        res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n---\n\n**🔍 Code Optimization Review**\n\n" })}\n\n`);

        try {
          const reviewModelId = AGENT_MODE_MODELS.economy[agentSelectedModel] || "gpt-4o-mini";
          if (agentSelectedModel === "gemini") {
            const reviewStream = await agentGeminiClient.models.generateContentStream({
              model: reviewModelId,
              contents: [{ role: "user", parts: [{ text: optimizePrompt }] }],
              config: { maxOutputTokens: 4096 },
            });
            for await (const chunk of reviewStream) {
              const content = chunk.text || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else if (agentSelectedModel === "gpt" || agentSelectedModel === "openrouter") {
            const reviewStream = await agentOpenaiClient.chat.completions.create({
              model: reviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              stream: true,
              max_completion_tokens: 4096,
            });
            for await (const chunk of reviewStream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else if (agentSelectedModel === "openrouter") {
            const orReviewModelId = req.body.openrouterModel || reviewModelId;
            const reviewStream = await openrouter.chat.completions.create({
              model: orReviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              stream: true,
              max_tokens: 4096,
              ...OPENROUTER_PRIVACY_BODY,
            } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & Record<string, unknown>, OPENROUTER_REQUEST_OPTS);
            for await (const chunk of reviewStream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else if (agentSelectedModel === "perplexity" || agentSelectedModel === "mistral") {
            const extReviewClient = agentOpenaiClient;
            const reviewStream = await extReviewClient.chat.completions.create({
              model: reviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              stream: true,
              max_tokens: 4096,
            });
            for await (const chunk of reviewStream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else {
            const reviewStream = agentAnthropicClient.messages.stream({
              model: reviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              max_tokens: 4096,
            });
            reviewStream.on("text", (text) => {
              res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
            });
            await reviewStream.finalMessage();
          }
        } catch (reviewErr: any) {
          log(`Code optimization review error: ${reviewErr.message}`, "ai");
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n_Code optimization review could not be completed._" })}\n\n`);
        }
      }

      if (agentFileOpsCount.value > 0) {
        createCheckpoint(projectId, req.session.userId!, "feature_complete", `AI agent: ${agentFileOpsCount.value} file operation${agentFileOpsCount.value > 1 ? "s" : ""}`).catch(() => {});
        triggerBackupAsync(projectId, "agent");
        agentFileOpsCount.value = 0;
      }

      const agentPriceEntry = getProviderPricing(agentProvider);
      const agentEstInputTokens = Math.ceil(JSON.stringify(messages).length / 4);
      const agentEstOutputTokens = agentModifiedFiles.size * 200;
      const agentEstCost = Math.round((agentEstInputTokens * agentPriceEntry.input / 1000 + agentEstOutputTokens * agentPriceEntry.output / 1000) * 100);
      const effectiveAgentCredMode = agentCredMode;
      if (effectiveAgentCredMode === "managed") {
        const agentTokenCredits = Math.max(1, agentEstCost);
        storage.deductMonthlyCreditsFromRoute(req.session.userId!, agentTokenCredits, "ai-agent", agentModelId).catch(() => {});
      }
      storage.logAiUsage({
        userId: req.session.userId!,
        projectId: projectId || null,
        provider: agentProvider,
        model: agentSelectedModel === "openrouter" ? "openai/gpt-4o" : agentModelId,
        inputTokens: agentEstInputTokens,
        outputTokens: agentEstOutputTokens,
        estimatedCost: agentEstCost,
        credentialMode: effectiveAgentCredMode,
        endpoint: "/api/ai/agent",
      }).catch(() => {});

      try {
        if (agentModifiedFiles.size > 0) {
          const updatedFilesForEcode = await storage.getFiles(projectId);
          const currentFilenames = updatedFilesForEcode.map(f => f.filename);
          const previousFilenames = existingFiles.map(f => f.filename);

          if (shouldAutoUpdate(previousFilenames, currentFilenames, agentModifiedFiles)) {
            const currentEcode = updatedFilesForEcode.find(f => f.filename === "ecode.md");
            if (currentEcode && currentEcode.content) {
              const pkgFile = updatedFilesForEcode.find(f => f.filename === "package.json");
              const updatedEcodeContent = updateEcodeStructureSection(
                currentEcode.content,
                currentFilenames,
                pkgFile?.content || undefined
              );
              if (updatedEcodeContent !== currentEcode.content) {
                await storage.updateFileContent(currentEcode.id, updatedEcodeContent);
                res.write(`data: ${JSON.stringify({ type: "ecode_updated", file: { id: currentEcode.id, filename: "ecode.md", content: updatedEcodeContent } })}\n\n`);
                log(`Auto-updated ecode.md for project ${projectId} (${agentModifiedFiles.size} files changed)`, "ai");
              }
            }
          }
        }
      } catch (ecodeErr: any) {
        log(`Failed to auto-update ecode.md: ${ecodeErr.message}`, "ai");
      }

      const agentDuration = Date.now() - agentStartTime;
      const agentPricing = getProviderPricing(agentProvider);
      const agentCostCents = (agentEstInputTokens * agentPricing.input / 1000 + agentEstOutputTokens * agentPricing.output / 1000);
      const existingFileNames = new Set(existingFiles.map(f => f.filename));
      const computedFilesCreated = [...agentModifiedFiles].filter(f => !existingFileNames.has(f)).length;
      const computedFilesEdited = [...agentModifiedFiles].filter(f => existingFileNames.has(f)).length;
      res.write(`data: ${JSON.stringify({
        type: "usage_stats",
        duration: agentDuration,
        inputTokens: agentEstInputTokens,
        outputTokens: agentEstOutputTokens,
        totalTokens: agentEstInputTokens + agentEstOutputTokens,
        cost: agentCostCents > 0 ? `$${agentCostCents.toFixed(4)}` : undefined,
        model: agentModelId,
        provider: agentProvider,
        filesCreated: computedFilesCreated,
        filesEdited: computedFilesEdited,
        filesModified: agentModifiedFiles.size,
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      const agentModel = req.body?.model || "claude";
      const agentRawMsg = agentModel === "openrouter" ? formatOpenRouterError(error) : error.message;
      const agentErrorMsg = safeError(agentRawMsg, "AI agent error");
      log(`AI agent error: ${agentRawMsg}`, "ai");
      agentFileOpsCount.value = 0;
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: agentErrorMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: agentErrorMsg });
      }
    }
  });

  app.post("/api/ai/lite", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, projectId, model: requestedModel } = req.body;
      if (!messages || !Array.isArray(messages) || !projectId) {
        return res.status(400).json({ message: "messages array and projectId required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }
      const liteKeyError = validateExternalAIKey(requestedModel);
      if (liteKeyError) {
        return res.status(400).json({ message: liteKeyError });
      }

      if (typeof projectId !== "string" || projectId.length > 100) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const project = await storage.getProject(projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const liteSelectedModel = requestedModel || "claude";
      const liteProviderMap: Record<string, string> = { gemini: "google", gpt: "openai", claude: "anthropic" };
      const liteProvider = liteProviderMap[liteSelectedModel] || liteSelectedModel;
      const { anthropicClient: liteAnthropicClient, openaiClient: liteOpenaiClient, geminiClient: liteGeminiClient, credMode: liteCredMode } = await resolveProviderClients(projectId, liteProvider, req.session.userId!);

      if (liteCredMode === "managed") {
        const liteAiQuota = await storage.incrementAiCall(req.session.userId!);
        if (!liteAiQuota.allowed) {
          return res.status(429).json({ message: "Daily AI call limit reached. Upgrade to Pro for more." });
        }
        const litePreCheck = await storage.checkCreditsAvailable(req.session.userId!, 1);
        if (!litePreCheck.allowed) {
          return res.status(429).json({ message: "Daily credit limit reached" });
        }
      }

      const existingFiles = await storage.getFiles(projectId);
      const liteModifiedFiles = new Set<string>();
      const fileList = existingFiles.map(f => `- ${f.filename}`).join("\n");

      const liteSystemPrompt = `You are a fast AI coding agent in E-Code IDE. Make quick, targeted changes only.

Project: "${project.name}" (${project.language})
Files:
${fileList || "(empty)"}

Rules:
- Analyze ONLY the files relevant to the user's request
- Make targeted, minimal changes — no refactoring, no architecture review
- Skip planning explanations — go straight to implementation
- Write complete, working code for each file you touch
- Be concise in your responses

DESIGN QUALITY (for web projects):
- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) for styling
- Design must look professional: dark mode (bg-slate-900), gradients, shadows, rounded corners
- Include hover states, transitions, responsive layout, and Lucide icons via CDN
- NEVER output plain unstyled HTML — every element must look polished`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      if (requestedModel === "gemini") {
        const geminiTools: Tool[] = [{
          functionDeclarations: [
            {
              name: "create_file",
              description: "Create a new file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename" },
                  content: { type: Type.STRING, description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "edit_file",
              description: "Replace file content",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename" },
                  content: { type: Type.STRING, description: "The new content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "execute_command",
              description: "Execute a shell command in the project workspace directory",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  command: { type: Type.STRING, description: "The shell command to execute" },
                },
                required: ["command"],
              },
            },
          ],
        }];

        let geminiContents: Content[] = [
          { role: "user", parts: [{ text: liteSystemPrompt }] },
          { role: "model", parts: [{ text: "Ready." }] },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await liteGeminiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: geminiContents,
            config: { maxOutputTokens: 8192, tools: geminiTools },
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
              await executeToolCall(fn.name!, toolInput, projectId, existingFiles, res, liteModifiedFiles, undefined, undefined, req.session.userId!);
              toolResponseParts.push({ functionResponse: { name: fn.name, response: { result: "Done" } } });
            }
          }

          if (hasToolCall) {
            geminiContents = [...geminiContents, { role: "model", parts }, { role: "user", parts: toolResponseParts }];
          } else {
            continueLoop = false;
          }
        }
      } else if (requestedModel === "gpt" || requestedModel === "openrouter") {
        const liteOrModelId = requestedModel === "openrouter" ? "openai/gpt-4o" : "gpt-4o";
        const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          { type: "function", function: { name: "create_file", description: "Create a new file", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "edit_file", description: "Replace file content", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "execute_command", description: "Execute a shell command in the project workspace directory", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
        ];

        let gptMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: liteSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await liteOpenaiClient.chat.completions.create({
            model: liteOrModelId,
            messages: gptMessages,
            tools: openaiTools,
            max_completion_tokens: 8192,
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
              await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, liteModifiedFiles, undefined, undefined, req.session.userId!);
              toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: "Done" });
            }
            gptMessages = [...gptMessages, { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any, ...toolResultMessages];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }
      } else if (requestedModel === "openrouter") {
        const orLiteModelId = req.body.openrouterModel || "meta-llama/llama-3.3-70b-instruct";

        const orLiteTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          { type: "function", function: { name: "create_file", description: "Create a new file", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "edit_file", description: "Replace file content", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "execute_command", description: "Execute a shell command in the project workspace directory", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
        ];

        let orLiteMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: liteSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await openrouter.chat.completions.create({
            model: orLiteModelId,
            messages: orLiteMessages,
            tools: orLiteTools,
            max_tokens: 8192,
            ...OPENROUTER_PRIVACY_BODY,
          } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & Record<string, unknown>, OPENROUTER_REQUEST_OPTS);

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
              await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, liteModifiedFiles, undefined, undefined, req.session.userId!);
              toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: "Done" });
            }

            const liteAssistantMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
              role: "assistant",
              content: message.content,
              tool_calls: message.tool_calls,
            };

            orLiteMessages = [...orLiteMessages, liteAssistantMsg, ...toolResultMessages];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }
      } else if (requestedModel === "perplexity" || requestedModel === "mistral") {
        const extLiteClient = requestedModel === "perplexity" ? perplexityClient : mistralClient;
        const extLiteModelId = requestedModel === "perplexity" ? "sonar" : "mistral-small-latest";

        const extLiteTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          { type: "function", function: { name: "create_file", description: "Create a new file", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "edit_file", description: "Replace file content", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "execute_command", description: "Execute a shell command in the project workspace directory", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
        ];

        let extLiteMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: liteSystemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await extLiteClient.chat.completions.create({
            model: extLiteModelId,
            messages: extLiteMessages,
            tools: extLiteTools,
            max_tokens: 8192,
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
              await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, liteModifiedFiles, undefined, undefined, req.session.userId!);
              toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: "Done" });
            }
            extLiteMessages = [...extLiteMessages, { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any, ...toolResultMessages];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }
      } else {
        const tools: Anthropic.Messages.Tool[] = [
          { name: "create_file", description: "Create a new file", input_schema: { type: "object" as const, properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } },
          { name: "edit_file", description: "Replace file content", input_schema: { type: "object" as const, properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } },
          { name: "execute_command", description: "Execute a shell command in the project workspace directory", input_schema: { type: "object" as const, properties: { command: { type: "string", description: "The shell command to execute" } }, required: ["command"] } },
          { name: "read_terminal_output", description: "Read the last N lines of terminal output for the current project workspace. Use to diagnose errors from previous commands.", input_schema: { type: "object" as const, properties: { lines: { type: "number", description: "Number of lines to read (default 50, max 200)" } }, required: [] } },
        ];

        let currentMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await liteAnthropicClient.messages.create({
            model: "claude-sonnet-4-6",
            system: liteSystemPrompt,
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
              await executeToolCall(block.name, input, projectId, existingFiles, res, liteModifiedFiles, undefined, undefined, req.session.userId!);
            }
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: any[] = response.content
              .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
              .map((b) => ({ type: "tool_result" as const, tool_use_id: b.id, content: "Done" }));
            currentMessages = [...currentMessages, { role: "assistant" as const, content: response.content as any }, { role: "user" as const, content: toolResults as any }];
          } else {
            continueLoop = false;
          }
        }
      }

      const litePriceEntry = getProviderPricing(liteProvider);
      const liteEstInputTokens = Math.ceil(JSON.stringify(messages).length / 4);
      const liteEstOutputTokens = liteModifiedFiles.size * 150;
      const liteEstCost = Math.round((liteEstInputTokens * litePriceEntry.input / 1000 + liteEstOutputTokens * litePriceEntry.output / 1000) * 100);
      const effectiveLiteCredMode = liteCredMode;
      if (effectiveLiteCredMode === "managed") {
        const liteTokenCredits = Math.max(1, liteEstCost);
        storage.deductMonthlyCreditsFromRoute(req.session.userId!, liteTokenCredits, "ai-lite", requestedModel || "claude-sonnet-4-6").catch(() => {});
      }
      storage.logAiUsage({
        userId: req.session.userId!,
        projectId: projectId || null,
        provider: liteProvider,
        model: requestedModel === "openrouter" ? "openai/gpt-4o" : (requestedModel || "claude-sonnet-4-6"),
        inputTokens: liteEstInputTokens,
        outputTokens: liteEstOutputTokens,
        estimatedCost: liteEstCost,
        credentialMode: effectiveLiteCredMode,
        endpoint: "/api/ai/lite",
      }).catch(() => {});

      const liteDonePayload: { type: string } = { type: "done" };
      res.write(`data: ${JSON.stringify(liteDonePayload)}\n\n`);
      res.end();
    } catch (error: any) {
      const liteModel = req.body?.model || "claude";
      const liteRawMsg = liteModel === "openrouter" ? formatOpenRouterError(error) : error.message;
      const liteErrorMsg = safeError(liteRawMsg, "AI lite error");
      log(`AI lite error: ${liteRawMsg}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: liteErrorMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: liteErrorMsg });
      }
    }
  });

  async function fetchSearchResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey) {
      try {
        const results = await fetchTavilyResults(query, tavilyKey);
        if (results.length > 0) return results;
      } catch (err: any) {
        log(`Tavily search error, falling back: ${err.message}`, "ai");
      }
    }
    const fallbacks = [fetchGoogleResults, fetchBingResults];
    for (const engine of fallbacks) {
      try {
        const results = await engine(query);
        if (results.length > 0) return results;
      } catch (err: any) {
        log(`Search engine fallback: ${err.message}`, "ai");
      }
    }
    return [];
  }

  async function fetchTavilyResults(query: string, apiKey: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 8,
        include_answer: false,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Tavily API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] };
    return (data.results || []).map(r => ({
      title: r.title || "",
      url: r.url || "",
      snippet: (r.content || "").slice(0, 300),
    }));
  }

  async function fetchGoogleResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.google.com/search?q=${encoded}&num=8&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const blockRegex = /<div class="[^"]*(?:tF2Cxc|g)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let block;
    while ((block = blockRegex.exec(html)) !== null && results.length < 8) {
      const content = block[1];
      const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]+)"/);
      const titleMatch = content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      const snippetMatch = content.match(/<span[^>]*class="[^"]*(?:aCOpRe|st)[^"]*"[^>]*>([\s\S]*?)<\/span>/)
        || content.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : "";
        if (title && url && !url.includes("google.com")) results.push({ title, url, snippet });
      }
    }
    if (results.length === 0) {
      const linkRegex = /<a[^>]*href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null && results.length < 8) {
        const url = decodeURIComponent(linkMatch[1]);
        const title = linkMatch[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
        if (title && url && !url.includes("google.com") && title.length > 3) {
          results.push({ title, url, snippet: "" });
        }
      }
    }
    return results;
  }

  async function fetchBingResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.bing.com/search?q=${encoded}&count=8`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const blockRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let block;
    while ((block = blockRegex.exec(html)) !== null && results.length < 8) {
      const content = block[1];
      const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]+)"/);
      const titleMatch = content.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/) || content.match(/<div class="b_caption"[^>]*>([\s\S]*?)<\/div>/);
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
        const snippet = snippetMatch ? (snippetMatch[1] || snippetMatch[2] || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim() : "";
        if (title && url) results.push({ title, url, snippet });
      }
    }
    return results;
  }

  function isPrivateIP(ip: string): boolean {
    if (ip === "0.0.0.0" || ip === "::1" || ip === "::") return true;
    const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 127) return true;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
    return false;
  }

  async function resolveAndValidateHost(hostname: string): Promise<{ valid: boolean; error?: string }> {
    const dns = await import("dns");
    return new Promise((resolve) => {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
          resolve({ valid: false, error: `DNS resolution failed: ${err.message}` });
          return;
        }
        for (const addr of addresses) {
          if (isPrivateIP(addr.address)) {
            resolve({ valid: false, error: "Access to internal/private IPs is not allowed" });
            return;
          }
        }
        resolve({ valid: true });
      });
    });
  }

  async function fetchUrlContent(url: string, redirectDepth: number = 0): Promise<{ url: string; content: string; title: string }> {
    try {
      const urlCheck = validateExternalUrl(url);
      if (!urlCheck.valid) {
        return { url, content: `Error: ${urlCheck.error}`, title: url };
      }
      const parsedUrl = new URL(url);
      const dnsCheck = await resolveAndValidateHost(parsedUrl.hostname);
      if (!dnsCheck.valid) {
        return { url, content: `Error: ${dnsCheck.error}`, title: url };
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ECodeIDE/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(timeout);
      if (response.status >= 300 && response.status < 400) {
        if (redirectDepth >= 5) {
          return { url, content: "Error: Too many redirects (max 5)", title: url };
        }
        const redirectUrl = response.headers.get("location");
        if (!redirectUrl) {
          return { url, content: "Error: Redirect with no location header", title: url };
        }
        const absoluteRedirect = new URL(redirectUrl, url).toString();
        const redirectCheck = validateExternalUrl(absoluteRedirect);
        if (!redirectCheck.valid) {
          return { url, content: `Error: Redirect blocked — ${redirectCheck.error}`, title: url };
        }
        const redirectParsed = new URL(absoluteRedirect);
        const redirectDnsCheck = await resolveAndValidateHost(redirectParsed.hostname);
        if (!redirectDnsCheck.valid) {
          return { url, content: `Error: Redirect blocked — ${redirectDnsCheck.error}`, title: url };
        }
        return fetchUrlContent(absoluteRedirect, redirectDepth + 1);
      }
      if (!response.ok) {
        return { url, content: `Error: HTTP ${response.status} ${response.statusText}`, title: url };
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/") && !contentType.includes("application/json") && !contentType.includes("application/xml")) {
        return { url, content: `Error: Non-text content type (${contentType})`, title: url };
      }
      let text = await response.text();
      if (text.length > 100000) {
        text = text.slice(0, 100000) + "\n\n[Content truncated at 100KB]";
      }
      let title = url;
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 50000) {
        text = text.slice(0, 50000) + "\n\n[Content truncated]";
      }
      return { url, content: text, title };
    } catch (err: any) {
      const errMsg = err.name === "AbortError" ? "Request timed out (10s limit)" : err.message;
      log(`Fetch URL error for ${url}: ${errMsg}`, "ai");
      return { url, content: `Error fetching URL: ${errMsg}`, title: url };
    }
  }

  app.post("/api/ai/web-search", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { query, model: requestedModel } = req.body;
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ message: "Search query required (at least 2 characters)" });
      }
      if (query.length > 1000) {
        return res.status(400).json({ message: "Query too long (max 1000 characters)" });
      }
      const wsKeyError = validateExternalAIKey(requestedModel);
      if (wsKeyError) {
        return res.status(400).json({ message: wsKeyError });
      }

      const searchQuota = await storage.incrementAiCall(req.session.userId!);
      if (!searchQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached." });
      }
      const searchCreditResult = await storage.deductMonthlyCreditsFromRoute(req.session.userId!, SERVICE_CREDIT_COSTS["tavily-search"] || 2, "ai-search", "web-search");
      if (!searchCreditResult.allowed) {
        return res.status(429).json({ message: "Credit limit reached. Add a payment method to enable overage billing." });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "text", content: "🔍 **Searching the web...**\n\n" })}\n\n`);

      const searchResults = await fetchSearchResults(query.trim());

      let sourcesContext = "";
      if (searchResults.length > 0) {
        sourcesContext = "## Web Search Results\n\n" + searchResults.map((r, i) =>
          `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
        ).join("\n\n");

        res.write(`data: ${JSON.stringify({ type: "text", content: "Found " + searchResults.length + " results. Synthesizing...\n\n" })}\n\n`);
      } else {
        sourcesContext = "No web search results were found. Answer based on your knowledge.";
        res.write(`data: ${JSON.stringify({ type: "text", content: "No results found. Answering from knowledge...\n\n" })}\n\n`);
      }

      const searchPrompt = `You are a web-search AI assistant. The user searched for: "${query.trim()}"

${sourcesContext}

Based on the search results above, provide a comprehensive answer to the user's query. Cite specific sources with their URLs when referencing information. Format your response with clear sections and include a "Sources" section at the end listing the relevant URLs used.`;

      if (requestedModel === "gemini") {
        const stream = await geminiDefault.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
          config: { maxOutputTokens: 4096 },
        });
        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else if (requestedModel === "gpt") {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "system", content: "You are a helpful search assistant that synthesizes web search results into clear, cited answers." }, { role: "user", content: searchPrompt }],
          stream: true,
          max_completion_tokens: 4096,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else if (requestedModel === "perplexity") {
        const stream = await perplexityClient.chat.completions.create({
          model: "sonar-pro",
          messages: [{ role: "system", content: "You are a helpful search assistant that synthesizes web search results into clear, cited answers." }, { role: "user", content: searchPrompt }],
          stream: true,
          max_tokens: 4096,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else if (requestedModel === "mistral") {
        const stream = await mistralClient.chat.completions.create({
          model: "mistral-large-latest",
          messages: [{ role: "system", content: "You are a helpful search assistant that synthesizes web search results into clear, cited answers." }, { role: "user", content: searchPrompt }],
          stream: true,
          max_tokens: 4096,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          messages: [{ role: "user", content: searchPrompt }],
          max_tokens: 4096,
        });
        stream.on("text", (text) => {
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        });
        await stream.finalMessage();
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI web-search error: ${error.message}`, "ai");
      const wsErrorMsg = safeError(error, "Web search error");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: wsErrorMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: wsErrorMsg });
      }
    }
  });

  registerImageRoutes(app, requireAuth, aiLimiter);

  // ─── Local Workspace Preview Routes ─────────────────────────────────────────
  // These routes implement an integrated dev server manager as a replacement for
  // the external runner service (runner.e-code.ai). Active when RUNNER_MODE=local
  // or when the external runner is unreachable.
  {
    const localWS = await import("./localWorkspaceManager");

    // Helper: determine if we should use local mode
    function isLocalMode(): boolean {
      const mode = process.env.RUNNER_MODE || "local";
      return mode === "local";
    }

    // Helper: reverse-proxy an HTTP request to the local dev server
    async function proxyToLocalDevServer(
      projectId: string,
      req: Request,
      res: Response,
      subpath: string
    ): Promise<void> {
      const port = localWS.getLocalWorkspacePort(projectId);
      if (!port) {
        res.status(503).json({ message: "Dev server not running. Start it first." });
        return;
      }
      localWS.touchLocalWorkspace(projectId);

      const http = await import("http");
      const url = new URL(subpath || "/", `http://localhost:${port}`);
      // Forward query string
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      if (qs) {
        // Merge query params from original request but avoid duplicating subpath params
        const origParams = new URLSearchParams(qs);
        origParams.forEach((v, k) => url.searchParams.set(k, v));
      }

      const proxyHeaders: Record<string, string | string[] | undefined> = { ...req.headers };
      delete proxyHeaders["host"];
      proxyHeaders["host"] = `localhost:${port}`;

      const proxyReq = http.request(
        {
          hostname: "localhost",
          port,
          path: url.pathname + (url.search || ""),
          method: req.method,
          headers: proxyHeaders as any,
        },
        (proxyRes) => {
          // Forward status + headers
          const filteredHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) {
            if (!["transfer-encoding", "connection"].includes(k.toLowerCase()) && v !== undefined) {
              filteredHeaders[k] = v as string | string[];
            }
          }
          res.writeHead(proxyRes.statusCode || 200, filteredHeaders);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        if (!res.headersSent) {
          res.status(502).json({ message: `Dev server unreachable: ${err.message}` });
        }
      });

      if (req.method !== "GET" && req.method !== "HEAD") {
        req.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    }

    /**
     * GET /api/preview/url?projectId=X
     * Returns the preview status and URL for the PreviewPanel component.
     */
    app.get("/api/preview/url", requireAuth, async (req: Request, res: Response) => {
      const projectId = qstr(req.query.projectId);
      if (!projectId) return res.status(400).json({ message: "projectId required" });

      const project = await storage.getProject(projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!isLocalMode()) {
        // External runner mode — proxy to the existing workspace preview-url logic
        const workspace = await storage.getWorkspaceByProject(project.id);
        if (!workspace) {
          return res.json({ previewUrl: null, status: "stopped", message: "No workspace" });
        }
        const port = 3000;
        const url = runnerClient.previewUrl(workspace.id, port);
        return res.json({ previewUrl: url, status: workspace.statusCache || "stopped", port });
      }

      // Local mode
      const wsStatus = localWS.getLocalWorkspaceStatus(projectId);
      const port = localWS.getLocalWorkspacePort(projectId);

      if (wsStatus === "none") {
        const wsDir = localWS.getWorkspaceDir(projectId);
        let runnable = localWS.hasRunnableFiles(wsDir);
        if (!runnable) {
          const dbFiles = await storage.getFiles(projectId);
          const fname = (f: any) => f.filename || f.name || "";
          runnable = dbFiles.some((f: any) => {
            const n = fname(f);
            return n === "package.json" || n === "index.html" || n === "main.py" || n === "app.py" || n === "index.ts" || n === "index.js" || n === "main.ts" || n === "main.js" || n === "server.ts" || n === "server.js";
          });
        }
        return res.json({
          previewUrl: null,
          status: runnable ? "stopped" : "no_runnable_files",
          message: runnable ? "Dev server not started" : "No runnable files detected",
        });
      }

      const previewUrl = port ? `/api/preview/${projectId}/` : null;
      return res.json({ previewUrl, status: wsStatus, port });
    });

    /**
     * POST /api/preview/projects/:projectId/preview/start
     * Start (or get the status of) the local dev server.
     */
    app.post("/api/preview/projects/:projectId/preview/start", requireAuth, async (req: Request, res: Response) => {
      const project = await storage.getProject(req.params.projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!isLocalMode()) {
        // Fall through to external runner start
        const workspace = await storage.getWorkspaceByProject(project.id);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        try {
          await runnerClient.startWorkspace(workspace.id);
          await storage.updateWorkspaceStatus(workspace.id, "running");
          return res.json({ status: "starting" });
        } catch (err: any) {
          return res.status(502).json({ message: err.message });
        }
      }

      const existing = localWS.getLocalWorkspace(project.id);
      if (existing && (existing.status === "running" || existing.status === "starting" || existing.status === "installing")) {
        return res.json({ status: existing.status, port: existing.port });
      }

      // Get project env vars
      const projectEnvVarsList = await storage.getProjectEnvVars(project.id).catch(() => []);
      const envVarsMap: Record<string, string> = {};
      for (const ev of projectEnvVarsList) {
        try { envVarsMap[ev.key] = decrypt(ev.encryptedValue); } catch {}
      }

      const ws = await localWS.startLocalWorkspace(
        project.id,
        () => storage.getFiles(project.id),
        {
          language: project.language || undefined,
          envVars: envVarsMap,
        }
      );

      return res.json({ status: ws.status, port: ws.port });
    });

    /**
     * POST /api/preview/projects/:projectId/preview/stop
     * Stop the local dev server.
     */
    app.post("/api/preview/projects/:projectId/preview/stop", requireAuth, async (req: Request, res: Response) => {
      const project = await storage.getProject(req.params.projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!isLocalMode()) {
        const workspace = await storage.getWorkspaceByProject(project.id);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        try {
          await runnerClient.stopWorkspace(workspace.id);
          await storage.updateWorkspaceStatus(workspace.id, "stopped");
          return res.json({ status: "stopped" });
        } catch (err: any) {
          return res.status(502).json({ message: err.message });
        }
      }

      await localWS.stopLocalWorkspace(project.id);
      return res.json({ status: "stopped" });
    });

    /**
     * GET /api/preview/projects/:projectId/preview/logs
     * Return the dev server log buffer.
     */
    app.get("/api/preview/projects/:projectId/preview/logs", requireAuth, async (req: Request, res: Response) => {
      const project = await storage.getProject(req.params.projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      return res.json({ logs: localWS.getLocalWorkspaceLogs(project.id) });
    });

    /**
     * GET /api/preview/:projectId/
     * GET /api/preview/:projectId/*path
     * Reverse proxy to the local dev server.
     */
    app.get("/api/preview/:projectId", requireAuth, async (req: Request, res: Response, next) => {
      if (req.params.projectId === 'projects') return next();
      const project = await storage.getProject(req.params.projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      await proxyToLocalDevServer(project.id, req, res, "/");
    });

    app.all("/api/preview/:projectId/{*path}", requireAuth, async (req: Request, res: Response, next) => {
      if (req.params.projectId === 'projects') return next();
      const project = await storage.getProject(req.params.projectId);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const subpath = "/" + (req.params.path || "");
      await proxyToLocalDevServer(project.id, req, res, subpath);
    });

    // Store localWS reference for use in the WebSocket upgrade handler (below)
    (app as any)._localWS = localWS;
  }

}
