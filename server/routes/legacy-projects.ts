// AUTO-EXTRACTED from server/routes.ts (lines 5021-5576)
// Original section: projects
// Extracted by scripts/batch-extract-routes.cjs

function sanitizeProjectName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, 200);
  const sanitized = trimmed.replace(/[<>"'`;{}]/g, "");
  if (!sanitized || sanitized.length === 0) return null;
  return sanitized;
}

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing, insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS } from "@shared/schema";
import { decrypt, encrypt } from "../encryption";
import { z } from "zod";
import { executeCode, sendStdinToProcess, killInteractiveProcess, resolveRunCommand } from "../executor";
import { getProjectConfig, parseReplitConfig, serializeReplitConfig, getEnvironmentMetadata, type ReplitConfig } from "../configParser";
import { parseReplitNix, serializeReplitNix } from "../nixParser";
import { executionPool } from "../executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity, materializeProjectFiles as materializeTerminalFiles, getProjectWorkspaceDir, invalidateProjectWorkspace, syncFileToWorkspace, deleteFileFromWorkspace, renameFileInWorkspace, listWorkspaceFiles, destroyProjectTerminals } from "../terminal";
import { createDebugSession, connectToInspector, handleDebugCommand, getDebugSession, cleanupSession, getInspectPort } from "../debugger";
import { log } from "../index";
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
import bcrypt from "bcrypt";
import crypto from "crypto";


export async function registerProjectsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- PROJECTS ---
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    const projectList = await storage.getProjects(req.session.userId!);
    return res.json(projectList);
  });

  async function createDefaultWorkflow(projectId: string, language: string): Promise<void> {
    try {
      const runCommands: Record<string, string> = {
        javascript: "npm install && npm start",
        typescript: "npm install && npm start",
        python: "pip install -r requirements.txt 2>/dev/null; python3 main.py",
        go: "go run .",
        rust: "cargo run",
        java: "javac Main.java && java Main",
        cpp: "g++ -o main main.cpp && ./main",
        ruby: "ruby main.rb",
        bash: "bash main.sh",
      };
      const cmd = runCommands[language] || "npm install && npm start";
      const workflow = await storage.createWorkflow({
        projectId,
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
      await storage.updateProject(projectId, { selectedWorkflowId: workflow.id });
    } catch (err) {
      console.error("[createDefaultWorkflow] Error:", err);
    }
  }

  app.post("/api/workspace/bootstrap", requireAuth, async (req: Request, res: Response) => {
    try {
      const { prompt, buildMode, options } = req.body;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ success: false, error: "A project description is required" });
      }
      const projectCheck = await storage.checkProjectLimit(req.session.userId!);
      if (!projectCheck.allowed) {
        return res.status(429).json({ success: false, error: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.` });
      }
      const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
      let projectName = words.length > 40 ? words.slice(0, 40) : words;
      projectName = sanitizeProjectName(projectName) || "My Project";
      const language = options?.language || "typescript";
      const project = await storage.createProject(req.session.userId!, {
        name: projectName,
        language,
        projectType: options?.framework === "react" ? "web-app" : "web-app",
        outputType: "web",
        visibility: "public",
      });
      await storage.createArtifact({
        projectId: project.id,
        name: projectName,
        type: "web-app",
        entryFile: null,
        settings: {},
      });
      await createDefaultWorkflow(project.id, language);
      const bootstrapToken = crypto.randomUUID();
      if (buildMode) {
        await storage.trackEvent(req.session.userId!, "workspace_bootstrap", {
          projectId: project.id,
          buildMode,
          prompt: prompt.slice(0, 200),
        });
      }
      return res.json({ success: true, projectId: project.id, bootstrapToken });
    } catch (error: any) {
      console.error("[workspace/bootstrap] Error:", error);
      return res.status(500).json({ success: false, error: "Failed to create workspace. Please try again." });
    }
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
      if (data.visibility === "team") {
        return res.status(400).json({ message: "Team visibility requires creating a project within a team. Use team project creation instead." });
      }
      if (data.visibility === "private") {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota.plan || quota.plan === "free") {
          return res.status(403).json({ message: "Private projects require a Pro or Team plan. Upgrade to unlock private projects." });
        }
      }
      if (!data.visibility) data.visibility = "public";
      const project = await storage.createProject(req.session.userId!, data);
      const validTypes = ARTIFACT_TYPES as readonly string[];
      const artifactType = (req.body.artifactType && validTypes.includes(req.body.artifactType)) ? req.body.artifactType : "web-app";
      await storage.createArtifact({
        projectId: project.id,
        name: data.name,
        type: artifactType,
        entryFile: null,
        settings: {},
      });
      await createDefaultWorkflow(project.id, data.language || "javascript");
      const updatedProject = await storage.getProject(project.id);
      return res.status(201).json(updatedProject || project);
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

  app.get("/api/marketplace/templates", (req: Request, res: Response) => {
    try {
      let templates = getAllTemplates();
      const { query, category, featured, official, community, sortBy, page, limit: limitStr } = req.query;
      if (query && typeof query === "string") {
        const q = query.toLowerCase();
        templates = templates.filter((t: any) => t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
      }
      if (category && category !== "all") {
        templates = templates.filter((t: any) => t.category === category || t.language === category);
      }
      if (featured === "true") templates = templates.filter((t: any) => t.featured);
      if (official === "true") templates = templates.filter((t: any) => !t.community);
      if (community === "true") templates = templates.filter((t: any) => t.community);
      const total = templates.length;
      const pg = parseInt(String(page || "1"), 10);
      const lim = parseInt(String(limitStr || "20"), 10);
      const paginated = templates.slice((pg - 1) * lim, pg * lim);
      return res.json({ templates: paginated, total, page: pg, totalPages: Math.ceil(total / lim) });
    } catch { return res.json({ templates: [], total: 0, page: 1, totalPages: 0 }); }
  });

  app.get("/api/marketplace/trending", (_req: Request, res: Response) => {
    try {
      const templates = getAllTemplates();
      const trending = templates.slice(0, parseInt(String(_req.query.limit || "5"), 10));
      return res.json(trending);
    } catch { return res.json([]); }
  });

  app.get("/api/marketplace/categories", (_req: Request, res: Response) => {
    try {
      const templates = getAllTemplates();
      const cats = [...new Set(templates.map((t: any) => t.category || t.language || "other"))];
      return res.json(cats.map(c => ({ id: c, name: String(c).charAt(0).toUpperCase() + String(c).slice(1), count: templates.filter((t: any) => (t.category || t.language) === c).length })));
    } catch { return res.json([]); }
  });

  app.get("/api/marketplace/tags", (_req: Request, res: Response) => {
    try {
      const templates = getAllTemplates();
      const tagSet = new Set<string>();
      templates.forEach((t: any) => { if (t.tags) t.tags.forEach((tag: string) => tagSet.add(tag)); });
      return res.json([...tagSet]);
    } catch { return res.json([]); }
  });

  app.post("/api/marketplace/template/:id/track", (req: Request, res: Response) => {
    return res.json({ success: true });
  });

  app.get("/api/qrcode", requireAuth, async (req: Request, res: Response) => {
    try {
      const { data } = req.query;
      if (!data || typeof data !== "string") {
        return res.status(400).json({ message: "Missing 'data' query parameter" });
      }
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(data, {
        width: 256,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      return res.json({ qrDataUrl: dataUrl });
    } catch (err) {
      return res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.get("/api/artifact-templates", async (req: Request, res: Response) => {
    try {
      const outputType = qstr(req.query.outputType) || undefined;
      const templates = await storage.getArtifactTemplates(outputType);
      return res.json(templates);
    } catch {
      return res.status(500).json({ message: "Failed to fetch artifact templates" });
    }
  });

  app.get("/api/plan-configs", async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getAllPlanConfigs();
      return res.json(configs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch plan configs" });
    }
  });

  app.get("/badge", (req: Request, res: Response) => {
    req.params.caption = "Open in E-Code";
    return badgeHandler(req, res);
  });

  app.get("/badge/:caption", (req: Request, res: Response) => {
    return badgeHandler(req, res);
  });

  function badgeHandler(req: Request, res: Response) {
    const caption = req.params.caption || "Open in E-Code";
    const sanitizedCaption = caption.replace(/[<>&"']/g, "").slice(0, 100);
    const width = Math.max(160, sanitizedCaption.length * 8 + 80);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32" viewBox="0 0 ${width} 32" fill="none">
      <rect width="${width}" height="32" rx="6" fill="#0E1525"/>
      <rect x="0.5" y="0.5" width="${width - 1}" height="31" rx="5.5" stroke="#2B3245"/>
      <g transform="translate(10, 6)">
        <path d="M3.5 2.75C3.5 2.335 3.835 2 4.25 2H7.75C8.165 2 8.5 2.335 8.5 2.75V6H4.25C3.835 6 3.5 5.665 3.5 5.25V2.75Z" fill="#F26522"/>
        <path d="M8.5 6H12.75C13.165 6 13.5 6.335 13.5 6.75V9.25C13.5 9.665 13.165 10 12.75 10H8.5V6Z" fill="#F26522"/>
        <path d="M3.5 10.75C3.5 10.335 3.835 10 4.25 10H8.5V14H4.25C3.835 14 3.5 13.665 3.5 13.25V10.75Z" fill="#F26522"/>
      </g>
      <text x="34" y="20.5" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500">${sanitizedCaption}</text>
    </svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(svg);
  }

  app.get("/api/landing-stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getLandingStats();
      return res.json(stats);
    } catch {
      return res.status(500).json({ message: "Failed to fetch landing stats" });
    }
  });

  app.get("/api/ai-suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const languages = await storage.getUserRecentLanguages(userId);
      const languageSuggestions: Record<string, { chat: string[]; agent: string[] }> = {
        python: {
          chat: ["Explain this Python code", "Add type hints to this code", "Convert to async/await", "Optimize with list comprehensions"],
          agent: ["Build a Flask REST API", "Create a data analysis script", "Add pytest unit tests", "Build a CLI tool with Click"],
        },
        javascript: {
          chat: ["Explain this JavaScript code", "Convert to TypeScript", "Add JSDoc comments", "Optimize array operations"],
          agent: ["Build a React component", "Create an Express API endpoint", "Add Jest unit tests", "Build a Node.js CLI tool"],
        },
        typescript: {
          chat: ["Explain this TypeScript code", "Improve type definitions", "Add generics", "Fix type errors"],
          agent: ["Build a typed React component", "Create a typed API endpoint", "Add Vitest unit tests", "Refactor with utility types"],
        },
        go: {
          chat: ["Explain this Go code", "Add error handling", "Optimize goroutines", "Add Go doc comments"],
          agent: ["Build an HTTP handler", "Create a CLI with Cobra", "Add table-driven tests", "Build a concurrent worker"],
        },
        rust: {
          chat: ["Explain this Rust code", "Fix borrow checker issues", "Add error handling with Result", "Optimize with iterators"],
          agent: ["Build a CLI with Clap", "Create a REST API with Actix", "Add unit tests", "Implement a custom trait"],
        },
      };

      if (languages.length > 0) {
        const primaryLang = languages[0].toLowerCase();
        const suggestions = languageSuggestions[primaryLang];
        if (suggestions) {
          return res.json({
            personalized: true,
            primaryLanguage: primaryLang,
            languages,
            chat: suggestions.chat.map(label => ({ label, category: "Suggested" })),
            agent: suggestions.agent.map(label => ({ label, category: "Suggested" })),
          });
        }
      }

      return res.json({
        personalized: false,
        languages,
        chat: [
          { label: "Explain this code", category: "Understand" },
          { label: "Find bugs and fix them", category: "Debug" },
          { label: "Add error handling", category: "Improve" },
          { label: "Optimize performance", category: "Optimize" },
        ],
        agent: [
          { label: "Build a login form with validation", category: "UI" },
          { label: "Add a REST API endpoint", category: "Backend" },
          { label: "Create a utility functions file", category: "Utils" },
          { label: "Refactor this code for performance", category: "Refactor" },
        ],
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch AI suggestions" });
    }
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
        visibility: z.enum(["public", "private", "team"]).optional(),
      });
      const data = schema.parse(req.body);
      if (data.visibility === "team") {
        return res.status(400).json({ message: "Team visibility requires creating a project within a team." });
      }
      if (data.visibility === "private") {
        const quota = await storage.getUserQuota(userId);
        if (!quota.plan || quota.plan === "free") {
          return res.status(403).json({ message: "Private projects require a Pro or Team plan. Upgrade to unlock private projects." });
        }
      }
      const template = getTemplateById(data.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const projectName = data.name ? (sanitizeProjectName(data.name) || template.name) : template.name;
      const project = await storage.createProjectFromTemplate(userId, {
        name: projectName,
        language: template.language,
        projectType: template.projectType,
        files: template.files,
        visibility: data.visibility || "public",
      });

      if (template.projectType === "slides" && template.slidesData) {
        await storage.createSlidesData({
          projectId: project.id,
          slides: template.slidesData.slides,
          theme: template.slidesData.theme,
        });
      }

      if (template.projectType === "video" && template.videoData) {
        await storage.createVideoData({
          projectId: project.id,
          scenes: template.videoData.scenes,
          audioTracks: template.videoData.audioTracks || [],
          resolution: template.videoData.resolution,
          fps: template.videoData.fps,
        });
      }

      await createDefaultWorkflow(project.id, template.language);
      const updatedProject = await storage.getProject(project.id);
      return res.status(201).json(updatedProject || project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("[from-template] Error:", error?.message || error, error?.stack?.substring(0, 300));
      return res.status(500).json({ message: "Failed to create project from template" });
    }
  });

  async function isProjectCollaborator(projectId: string, userId: string): Promise<{ allowed: boolean; role: "owner" | "editor" | "viewer" | null }> {
    const proj = await storage.getProject(projectId);
    if (!proj) return { allowed: false, role: null };
    if (proj.userId === userId) return { allowed: true, role: "owner" };
    const usr = await storage.getUser(userId);
    if (!usr) return { allowed: false, role: null };
    const invite = await storage.getAcceptedInviteForProject(projectId, usr.email.toLowerCase());
    if (invite) return { allowed: true, role: invite.role as "editor" | "viewer" };
    const guest = await storage.getProjectGuestByUserId(projectId, userId);
    if (guest) return { allowed: true, role: guest.role as "editor" | "viewer" };
    if (proj.teamId) {
      const teams = await storage.getUserTeams(userId);
      if (teams.some(t => t.id === proj.teamId)) return { allowed: true, role: "editor" };
    }
    return { allowed: false, role: null };
  }

  app.get("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!)) {
      const collab = await isProjectCollaborator(project.id, req.session.userId!);
      if (!collab.allowed) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    // Auto-start workspace in background if project has files but no running workspace
    import("./localWorkspaceManager").then(async (localWS) => {
      try {
        const existing = localWS.getLocalWorkspace(project.id);
        if (!existing || existing.status === "stopped" || existing.status === "error") {
          const files = await storage.getFiles(project.id);
          const hasPackageJson = files.some(f => f.filename === "package.json");
          const hasPyMain = files.some(f => f.filename === "main.py" || f.filename === "app.py");
          if (files.length > 0 && (hasPackageJson || hasPyMain)) {
            localWS.startLocalWorkspace(project.id, () => storage.getFiles(project.id)).catch(() => {});
          }
        }
      } catch {}
    }).catch(() => {});
    return res.json(project);
  });

  app.get("/api/projects/:id/poll", requireAuth, async (req: Request, res: Response) => {
    return res.json({ messages: [], timestamp: Date.now() });
  });

  app.get("/api/projects/:id/git/diff", requireAuth, async (req: Request, res: Response) => {
    const branch = (req.query.branch as string) || 'main';
    return res.json({ branch, changes: [], hasCommits: false });
  });

  app.get("/api/projects/:id/git/merge-status", requireAuth, async (req: Request, res: Response) => {
    return res.json({ status: 'none' });
  });

  app.get("/api/workspaces/:id/status", requireAuth, async (_req: Request, res: Response) => {
    return res.json({ status: 'none' });
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const deleted = await storage.softDeleteProject(req.params.id, req.session.userId!);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    await cleanupProjectProcesses(req.params.id);
    destroyProjectTerminals(req.params.id);
    invalidateProjectWorkspace(req.params.id);
    return res.json({ message: "Project moved to trash" });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, async (req: Request, res: Response) => {
    const sourceProject = await storage.getProject(req.params.id);
    if (!sourceProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (sourceProject.userId !== req.session.userId && !sourceProject.isDemo && !await verifyProjectAccess(sourceProject.id, req.session.userId!)) {
      return res.status(403).json({ message: "Access denied" });
    }
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

  app.get("/api/projects/:id/ecode", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (project.userId !== req.session.userId && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const projectFiles = await storage.getFiles(project.id);
    const ecodeFile = projectFiles.find(f => f.filename === "ecode.md");
    return res.json({ exists: !!ecodeFile, fileId: ecodeFile?.id || null });
  });

  app.post("/api/projects/:id/ecode/generate", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const projectFiles = await storage.getFiles(project.id);
    const existing = projectFiles.find(f => f.filename === "ecode.md");
    if (existing) {
      return res.json({ file: existing, regenerated: false });
    }
    let content = generateEcodeContent(project.name, project.language);
    const filenames = projectFiles.map(f => f.filename);
    const pkgFile = projectFiles.find(f => f.filename === "package.json");
    content = updateEcodeStructureSection(content, filenames, pkgFile?.content || undefined);
    const file = await storage.createFile(project.id, { filename: "ecode.md", content });
    return res.status(201).json({ file, regenerated: true });
  });

  app.post("/api/projects/:id/ecode/refresh", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const projectFiles = await storage.getFiles(project.id);
      const ecodeFile = projectFiles.find(f => f.filename === "ecode.md");
      if (!ecodeFile) {
        let content = generateEcodeContent(project.name, project.language);
        const filenames = projectFiles.map(f => f.filename);
        const pkgFile = projectFiles.find(f => f.filename === "package.json");
        content = updateEcodeStructureSection(content, filenames, pkgFile?.content || undefined);
        const file = await storage.createFile(project.id, { filename: "ecode.md", content });
        return res.status(201).json({ file, created: true, refreshed: true });
      }
      const filenames = projectFiles.map(f => f.filename);
      const pkgFile = projectFiles.find(f => f.filename === "package.json");
      const updatedContent = updateEcodeStructureSection(
        ecodeFile.content || "",
        filenames,
        pkgFile?.content || undefined
      );
      const updated = await storage.updateFileContent(ecodeFile.id, updatedContent);
      return res.json({ file: updated || { ...ecodeFile, content: updatedContent }, created: false, refreshed: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to refresh ecode.md" });
    }
  });

  app.get("/api/projects/:id/ecode/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const projectFiles = await storage.getFiles(project.id);
      const ecodeFile = projectFiles.find(f => f.filename === "ecode.md");
      if (!ecodeFile || !ecodeFile.content) {
        return res.json({ preferences: [], context: "", hasEcode: false });
      }
      const preferences = parseUserPreferences(ecodeFile.content);
      const context = parseProjectContext(ecodeFile.content);
      return res.json({ preferences, context, hasEcode: true });
    } catch {
      return res.json({ preferences: [], context: "", hasEcode: false });
    }
  });

}
