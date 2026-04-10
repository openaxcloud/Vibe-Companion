// AUTO-EXTRACTED from server/routes.ts (lines 4845-5020)
// Original section: metrics
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


export async function registerMetricsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


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
    const { owner, repo, name, branch, async: asyncMode } = req.body;
    if (!owner || !repo) return res.status(400).json({ message: "owner and repo required" });
    if (asyncMode) {
      const { startAsyncImport } = await import("./importService");
      const jobId = startAsyncImport("github", req.session.userId!, { owner, repo, name, branch });
      return res.status(202).json({ jobId, async: true });
    }
    try {
      const result = await importFromGitHub(req.session.userId!, owner, repo, name, branch);
      await storage.trackEvent(req.session.userId!, "github_import", { repo: `${owner}/${repo}`, fileCount: result.fileCount });
      const files = await storage.getFiles(result.project.id);

      const importedConfig = await getProjectConfig(result.project.id);
      if (importedConfig.language && importedConfig.language !== result.project.language) {
        await storage.updateProject(result.project.id, { language: importedConfig.language });
      }

      if (importedConfig.gitHubImport?.requiredFiles) {
        const filenames = files.map(f => f.filename);
        const missingFiles = importedConfig.gitHubImport.requiredFiles.filter(rf => !filenames.includes(rf));
        if (missingFiles.length > 0) {
          const warnings = result.warnings || [];
          warnings.push(`Missing required files from .replit config: ${missingFiles.join(", ")}`);
          return res.status(201).json({ project: result.project, files, warnings, fileCount: result.fileCount, jobId: result.jobId, missingRequiredFiles: missingFiles });
        }
      }

      return res.status(201).json({ project: result.project, files, warnings: result.warnings, fileCount: result.fileCount, jobId: result.jobId });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to import from GitHub" });
    }
  });

  app.post("/api/import/validate", requireAuth, async (req: Request, res: Response) => {
    const { source, input } = req.body;
    if (!source || !input) return res.status(400).json({ message: "source and input required" });
    try {
      const result = await validateImportSource(source, input);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Validation failed" });
    }
  });

  const zipUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

  app.post("/api/import/validate-zip", requireAuth, zipUpload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "ZIP file required" });
    try {
      const result = validateZipBuffer(req.file.buffer);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "ZIP validation failed" });
    }
  });

  app.get("/api/import/progress/:jobId", requireAuth, (req: Request, res: Response) => {
    const job = getImportJob(req.params.jobId, req.session.userId!);
    if (!job) return res.status(404).json({ message: "Import job not found" });
    return res.json({
      status: job.status,
      progress: job.progress,
      totalFiles: job.totalFiles,
      importedFiles: job.importedFiles,
      currentFile: job.currentFile,
      message: job.message,
      error: job.error,
      result: job.status === "complete" ? job.result : undefined,
    });
  });

  app.post("/api/import/zip", requireAuth, zipUpload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "ZIP file required" });
    const projectName = (req.body.name || "zip-import").slice(0, 50);
    const { startAsyncZipImport } = await import("./importService");
    const jobId = startAsyncZipImport(req.session.userId!, req.file.buffer, projectName);
    return res.status(202).json({ jobId, async: true });
  });

  app.post("/api/import/figma/design-context", requireAuth, async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "Figma URL required" });
    try {
      const parsed = url.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
      if (!parsed) return res.status(400).json({ message: "Invalid Figma URL format" });
      const fileKey = parsed[2];
      const nodeIdParam = new URL(url).searchParams.get("node-id") || undefined;
      const context = await fetchFigmaDesignContext(fileKey, nodeIdParam);
      return res.json({ designContext: context });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to fetch Figma design context" });
    }
  });

  app.post("/api/import/figma", requireAuth, async (req: Request, res: Response) => {
    const { url, name, provider, designContext } = req.body;
    if (!url) return res.status(400).json({ message: "Figma URL required" });
    const { startAsyncImport } = await import("./importService");
    const jobId = startAsyncImport("figma", req.session.userId!, { url, name: name || "figma-import", provider: provider || "openai", designContext });
    return res.status(202).json({ jobId, async: true });
  });

  app.post("/api/import/vercel", requireAuth, async (req: Request, res: Response) => {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ message: "Vercel URL required" });
    const { startAsyncImport } = await import("./importService");
    const jobId = startAsyncImport("vercel", req.session.userId!, { url, name });
    return res.status(202).json({ jobId, async: true });
  });

  app.post("/api/import/bolt", requireAuth, async (req: Request, res: Response) => {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ message: "GitHub repo URL required" });
    const { startAsyncImport } = await import("./importService");
    const jobId = startAsyncImport("bolt", req.session.userId!, { url, name });
    return res.status(202).json({ jobId, async: true });
  });

  app.post("/api/import/lovable", requireAuth, async (req: Request, res: Response) => {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ message: "GitHub repo URL required" });
    const { startAsyncImport } = await import("./importService");
    const jobId = startAsyncImport("lovable", req.session.userId!, { url, name });
    return res.status(202).json({ jobId, async: true });
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

}
