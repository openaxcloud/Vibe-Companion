// AUTO-EXTRACTED from server/routes.ts (lines 7815-8312)
// Original section: workspace-runner
// Extracted by scripts/batch-extract-routes.cjs

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


export async function registerWorkspaceRunnerRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- WORKSPACE / RUNNER ---
  app.get("/api/runner/status", async (req: Request, res: Response) => {
    const runnerMode = process.env.RUNNER_MODE || "local";
    if (runnerMode === "local") {
      return res.json({ online: true, baseUrl: `http://localhost:${process.env.PORT || 5000}`, localMode: true });
    }
    const online = await runnerClient.ping();
    return res.json({ online, baseUrl: runnerClient.getBaseUrl() });
  });

  app.post("/api/workspaces/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }

    const runnerMode = process.env.RUNNER_MODE || "local";
    if (runnerMode === "local") {
      return res.json({
        workspaceId: `local-${project.id}`,
        runnerUrl: `http://localhost:${process.env.PORT || 5000}`,
        token: null,
        online: true,
        localMode: true,
      });
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      const [systemModules, systemDeps] = await Promise.all([
        storage.getSystemModules(project.id),
        storage.getSystemDeps(project.id),
      ]);
      await runnerClient.startWorkspace(workspace.id);
      if (systemModules.length > 0 || systemDeps.length > 0) {
        try {
          await runnerClient.configureWorkspaceEnv(workspace.id, {
            systemModules: systemModules.map(m => ({ name: m.name, version: m.version })),
            systemDeps: systemDeps.map(d => d.name),
          });
        } catch (configErr: any) {
          log(`Runner env config warning: ${configErr.message}`, "runner");
        }
      }
      await storage.updateWorkspaceStatus(workspace.id, "running");
      const { startPortScanning, autoDetectPorts } = await import("./portDetection");
      autoDetectPorts(project.id).catch(() => {});
      startPortScanning(project.id);
      return res.json({ status: "running", systemModules: systemModules.length, systemDeps: systemDeps.length });
    } catch (err: any) {
      log(`Runner start error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.post("/api/workspaces/:projectId/stop", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      const { stopPortScanning } = await import("./portDetection");
      stopPortScanning(project.id);
      await runnerClient.stopWorkspace(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, "stopped");
      return res.json({ status: "stopped" });
    } catch (err: any) {
      log(`Runner stop error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.get("/api/workspaces/:projectId/status", requireAuth, async (req: Request, res: Response) => {
    const runnerMode = process.env.RUNNER_MODE || "local";
    if (runnerMode === "local") {
      return res.json({ status: "running", localMode: true });
    }
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host = req.headers.host || "localhost:5000";
    const sessionId = qstr(req.query.sessionId) || "default";
    const wsUrl = `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(sessionId)}`;
    return res.json({ wsUrl, workspaceId: project.id });
  });

  app.get("/api/workspaces/:projectId/terminal-sessions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const sessionsList = listTerminalSessions(project.id, req.session.userId!);
    return res.json({ sessions: sessionsList });
  });

  app.post("/api/workspaces/:projectId/terminal-sessions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const sessionId = req.body.sessionId || `shell-${Date.now()}`;

    try {
      const projectEnvVarsList = await storage.getProjectEnvVars(project.id);
      const envVarsMap: Record<string, string> = {};
      for (const ev of projectEnvVarsList) {
        envVarsMap[ev.key] = decrypt(ev.encryptedValue);
      }
      const linkedAccountVars = await storage.getAccountEnvVarLinks(project.id);
      for (const link of linkedAccountVars) {
        if (!(link.key in envVarsMap)) {
          envVarsMap[link.key] = decrypt(link.encryptedValue);
        }
      }
      envVarsMap["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
      const termUser = await storage.getUser(req.session.userId!);
      envVarsMap["REPLIT_USER"] = termUser?.displayName || termUser?.email || req.session.userId!;

      const wsDir = await materializeTerminalFiles(project.id, () => storage.getFiles(project.id));
      createTerminalSession(project.id, req.session.userId!, sessionId, wsDir, envVarsMap);
    } catch (err: any) {
      log(`Failed to pre-create terminal session: ${err.message}`, "terminal");
    }

    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host = req.headers.host || "localhost:5000";
    const wsUrl = `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(sessionId)}`;
    return res.json({ sessionId, wsUrl });
  });

  app.put("/api/workspaces/:projectId/terminal-sessions/:sessionId/select", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const found = setSessionSelected(project.id, req.session.userId!, req.params.sessionId);
    if (!found) {
      return res.status(404).json({ message: "Terminal session not found" });
    }
    return res.json({ success: true });
  });

  app.delete("/api/workspaces/:projectId/terminal-sessions/:sessionId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    destroyTerminalSession(project.id, req.session.userId!, req.params.sessionId);
    return res.json({ success: true });
  });

  app.post("/api/workspaces/:projectId/sync-from-terminal", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const wsFiles = listWorkspaceFiles(project.id);
      if (wsFiles.length === 0) return res.json({ synced: 0 });
      const dbFiles = await storage.getFiles(project.id);
      const dbMap = new Map(dbFiles.map(f => [f.filename, f]));
      let synced = 0;
      for (const wf of wsFiles) {
        const existing = dbMap.get(wf.filename);
        if (existing) {
          if (existing.content !== wf.content) {
            await storage.updateFileContent(existing.id, wf.content);
            synced++;
          }
        } else {
          await storage.createFile(project.id, { filename: wf.filename, content: wf.content });
          synced++;
        }
      }
      return res.json({ synced, total: wsFiles.length });
    } catch (err: any) {
      return res.status(500).json({ message: "Sync failed" });
    }
  });

  const getWorkspaceForProject = async (req: Request, res: Response): Promise<{ project: any; workspace: any } | null> => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
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
      const path = qstr(req.query.path) || "/";
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
      const path = qstr(req.query.path);
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
      import("./workflowExecutor").then(({ fireTrigger }) => fireTrigger(req.params.projectId, "on-save")).catch(() => {});
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
      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before deleting ${path}`).catch(() => {});
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not initialized" });
    }
    const isMobile = project.projectType === "mobile-app";
    const rawPort = parseInt(qstr(req.query.port));
    const defaultPort = isMobile ? 8081 : 3000;
    const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : defaultPort;
    const isLocalMode = !process.env.RUNNER_BASE_URL || (process.env.RUNNER_MODE || "local") === "local";
    const url = isLocalMode ? `/api/preview/projects/${project.id}/preview/` : runnerClient.previewUrl(workspace.id, port);
    const appDomain = process.env.APP_DOMAIN;
    const devUrl = appDomain ? `${req.protocol}://${project.id}.dev.${appDomain}` : null;
    let expoGoUrl: string | null = null;
    if (isMobile) {
      const expoPort = 8081;
      const expoPreviewUrl = runnerClient.previewUrl(workspace.id, expoPort);
      try {
        const parsed = new URL(expoPreviewUrl);
        expoGoUrl = `exp://${parsed.host}${parsed.pathname}`;
      } catch {
        expoGoUrl = expoPreviewUrl.replace(/^https?:\/\//, "exp://");
      }
    }
    return res.json({ previewUrl: url, workspaceId: workspace.id, port, devUrl, expoGoUrl });
  });

  app.get("/api/projects/:id/dev-url", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const devUrl = `${project.id}.dev.${process.env.APP_DOMAIN || "e-code.ai"}`;
    const fullDevUrl = `${req.protocol}://${devUrl}`;
    return res.json({ devUrl, fullDevUrl, devUrlPublic: project.devUrlPublic });
  });

  async function getProjectExtensions(projectId: string): Promise<string[]> {
    try {
      const files = await storage.getFiles(projectId);
      const extFile = files.find(f => f.filename === ".ecode/extensions.json");
      if (extFile) {
        const parsed = JSON.parse(extFile.content || "[]");
        if (Array.isArray(parsed) && parsed.every(e => typeof e === "string")) return parsed;
      }
    } catch {}
    return [];
  }

  async function saveProjectExtensions(projectId: string, extensions: string[]): Promise<void> {
    const files = await storage.getFiles(projectId);
    const extFile = files.find(f => f.filename === ".ecode/extensions.json");
    const content = JSON.stringify(extensions, null, 2);
    if (extFile) {
      await storage.updateFileContent(extFile.id, content);
    } else {
      await storage.createFile(projectId, { filename: ".ecode/extensions.json", content });
    }
  }

  app.get("/api/projects/:id/extensions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const extensions = await getProjectExtensions(project.id);
    return res.json(extensions);
  });

  app.post("/api/projects/:id/extensions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { extensionId } = req.body;
    if (!extensionId || typeof extensionId !== "string") return res.status(400).json({ message: "extensionId required" });
    const current = await getProjectExtensions(project.id);
    if (!current.includes(extensionId)) {
      current.push(extensionId);
      await saveProjectExtensions(project.id, current);
    }
    return res.json({ message: "Extension installed", extensions: current });
  });

  app.delete("/api/projects/:id/extensions/:extId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const current = await getProjectExtensions(project.id);
    const updated = current.filter(e => e !== req.params.extId);
    await saveProjectExtensions(project.id, updated);
    return res.json({ message: "Extension removed" });
  });

  app.get("/api/workspaces/:projectId/preview-proxy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) {
        return res.status(404).json({ message: "Project not found" });
      }
      const workspace = await storage.getWorkspaceByProject(project.id);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not initialized" });
      }
      const rawPort = parseInt(qstr(req.query.port));
      const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
      const subpath = qstr(req.query.path) || "/";
      const result = await runnerClient.fetchPreviewContent(workspace.id, port, subpath);
      const isHtml = result.contentType.includes("text/html");
      if (isHtml) {
        let html = result.body.toString("utf-8");
        const erudaCdn = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";
        const snippet = `<script src="${erudaCdn}"></script><script>if(typeof eruda!=='undefined'){eruda.init();eruda.show();}</script>`;
        if (!html.includes("eruda")) {
          const bodyIdx = html.lastIndexOf("</body>");
          if (bodyIdx !== -1) {
            html = html.slice(0, bodyIdx) + snippet + html.slice(bodyIdx);
          } else {
            html += snippet;
          }
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(result.status).send(html);
      }
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      }
      return res.status(result.status).send(result.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Preview proxy failed";
      return res.status(502).json({ message });
    }
  });

  app.get("/api/workspaces/:projectId/preview-proxy/{*path}", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params[0];
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) {
        return res.status(404).json({ message: "Project not found" });
      }
      const workspace = await storage.getWorkspaceByProject(project.id);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not initialized" });
      }
      const rawPort = parseInt(qstr(req.query.port));
      const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
      const rawPath = req.params.path;
      const subpath = "/" + (Array.isArray(rawPath) ? rawPath.join("/") : rawPath || "");
      const result = await runnerClient.fetchPreviewContent(workspace.id, port, subpath);
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      }
      return res.status(result.status).send(result.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Preview proxy failed";
      return res.status(502).json({ message });
    }
  });

}
