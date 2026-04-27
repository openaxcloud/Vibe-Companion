// AUTO-EXTRACTED from server/routes.ts (lines 7348-7747)
// Original section: github-sync
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


export async function registerGithubSyncRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- GitHub Sync Routes ---

  app.post("/api/projects/:projectId/git/connect-github", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { repoFullName } = req.body;
    if (!repoFullName || typeof repoFullName !== "string" || !repoFullName.includes("/")) {
      return res.status(400).json({ message: "Valid repository name (owner/repo) is required" });
    }

    try {
      const [owner, repo] = repoFullName.split("/");
      await github.getRepo(owner, repo);
      await storage.updateProject(req.params.projectId, { githubRepo: repoFullName });
      return res.json({ success: true, githubRepo: repoFullName });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to connect repository" });
    }
  });

  app.delete("/api/projects/:projectId/git/connect-github", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    await storage.updateProject(req.params.projectId, { githubRepo: "" });
    return res.json({ success: true });
  });

  app.get("/api/projects/:projectId/git/github-status", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.json({ connected: false, githubRepo: null, ahead: 0, behind: 0 });
    }

    let ahead = 0;
    let behind = 0;
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();
      const currentBranch = await gitService.getCurrentBranch(req.params.projectId) || "main";
      const status = await gitService.getRemoteStatus(req.params.projectId, url, { httpTransport, branch: currentBranch } as any);
      ahead = status.ahead;
      behind = status.behind;
    } catch {
    }

    return res.json({ connected: true, githubRepo, ahead, behind });
  });

  app.post("/api/projects/:projectId/git/push", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.status(400).json({ message: "No GitHub repository connected" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();

      const currentBranch = await gitService.getCurrentBranch(req.params.projectId) || "main";
      const result = await gitService.pushToRemote(req.params.projectId, url, {
        httpTransport,
        branch: currentBranch,
      } as any);

      if (!result.ok) {
        return res.status(500).json({ message: result.error || "Push failed" });
      }

      await persistRepoState(req.params.projectId, "commit");
      return res.json({ success: true, filesPushed: dbFiles.length, filesDeleted: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Push failed";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/pull", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.status(400).json({ message: "No GitHub repository connected" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", "Before git pull").catch(() => {});

      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const currentBranch = await gitService.getCurrentBranch(req.params.projectId) || "main";
      const result = await gitService.pullFromRemoteWithConflicts(req.params.projectId, url, {
        httpTransport,
        authorName,
        authorEmail,
        branch: currentBranch,
      } as any);

      if (!result.ok && result.conflicts && result.conflicts.length > 0) {
        await storage.saveMergeState({
          projectId: req.params.projectId,
          branch: currentBranch,
          localOid: result.localOid || "",
          remoteOid: result.remoteOid || "",
          conflicts: result.conflicts,
          resolutions: [],
          status: "in_progress",
        });
        return res.status(409).json({
          message: "Merge conflicts detected",
          conflicts: result.conflicts,
        });
      }

      if (!result.ok) {
        return res.status(500).json({ message: result.error || "Pull failed" });
      }

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of result.files) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await persistRepoState(req.params.projectId, "commit");
      return res.json({ success: true, filesPulled: result.files.length, skipped: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Pull failed";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/resolve-conflicts", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { resolvedFiles } = req.body;
    if (!Array.isArray(resolvedFiles) || resolvedFiles.length === 0) {
      return res.status(400).json({ message: "resolvedFiles array is required" });
    }

    try {
      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const result = await gitService.resolveConflicts(
        req.params.projectId,
        resolvedFiles,
        authorName,
        authorEmail,
      );

      const updatedFiles = gitService.getWorkingTreeFiles(req.params.projectId);
      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of updatedFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await storage.deleteMergeState(req.params.projectId);
      await persistRepoState(req.params.projectId, "commit");
      return res.json({ success: true, sha: result.sha });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Conflict resolution failed";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:projectId/git/merge-status", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const mergeState = await storage.getMergeState(req.params.projectId);
      if (!mergeState) {
        return res.json({ status: "none" });
      }
      return res.json({
        status: mergeState.status,
        conflicts: mergeState.conflicts,
        resolutions: mergeState.resolutions,
        branch: mergeState.branch,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get merge status";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/resolve-conflict", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { path: filePath, resolvedContent } = req.body;
    if (!filePath || resolvedContent === undefined) {
      return res.status(400).json({ message: "path and resolvedContent are required" });
    }
    try {
      const mergeState = await storage.getMergeState(req.params.projectId);
      if (!mergeState) {
        return res.status(404).json({ message: "No active merge state" });
      }
      const isValidFile = mergeState.conflicts.some(c => c.filename === filePath);
      if (!isValidFile) {
        return res.status(400).json({ message: "File is not in the active conflict list" });
      }
      const updated = await storage.updateMergeResolution(req.params.projectId, {
        filename: filePath,
        resolvedContent,
      });
      if (!updated) {
        return res.status(404).json({ message: "No active merge state" });
      }
      return res.json({ success: true, resolutions: updated.resolutions });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resolve conflict";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/complete-merge", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const mergeState = await storage.getMergeState(req.params.projectId);
      if (!mergeState) {
        return res.status(400).json({ message: "No active merge in progress" });
      }
      const conflictFilenames = new Set(mergeState.conflicts.map(c => c.filename));
      const resolvedFilenames = new Set(mergeState.resolutions.map(r => r.filename));
      const unresolvedFiles = [...conflictFilenames].filter(f => !resolvedFilenames.has(f));
      if (unresolvedFiles.length > 0) {
        return res.status(400).json({ message: `Not all conflicts resolved. Remaining: ${unresolvedFiles.join(", ")}` });
      }

      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const resolvedFiles = mergeState.resolutions.map(r => ({
        filename: r.filename,
        content: r.resolvedContent,
      }));

      const result = await gitService.resolveConflicts(
        req.params.projectId,
        resolvedFiles,
        authorName,
        authorEmail,
      );

      const updatedFiles = gitService.getWorkingTreeFiles(req.params.projectId);
      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of updatedFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await storage.deleteMergeState(req.params.projectId);
      await persistRepoState(req.params.projectId);
      return res.json({ success: true, sha: result.sha });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete merge";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/abort-merge", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const mergeState = await storage.getMergeState(req.params.projectId);
      if (!mergeState) {
        return res.status(400).json({ message: "No active merge to abort" });
      }

      const dir = gitService.getProjectDir(req.params.projectId);
      const fsModule = await import("fs");
      const pathModule = await import("path");
      const mergeHeadPath = pathModule.default.join(dir, ".git", "MERGE_HEAD");
      const mergeMsgPath = pathModule.default.join(dir, ".git", "MERGE_MSG");
      if (fsModule.default.existsSync(mergeHeadPath)) fsModule.default.unlinkSync(mergeHeadPath);
      if (fsModule.default.existsSync(mergeMsgPath)) fsModule.default.unlinkSync(mergeMsgPath);

      try {
        const git = (await import("isomorphic-git")).default;
        const currentBranch = await gitService.getCurrentBranch(req.params.projectId) || "main";
        await git.checkout({ fs: fsModule.default, dir, ref: currentBranch, force: true });
      } catch {}

      await storage.deleteMergeState(req.params.projectId);
      return res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to abort merge";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:projectId/git/state-hash", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }

    try {
      const hash = await gitService.getGitStateHash(req.params.projectId);
      return res.json({ hash });
    } catch {
      return res.json({ hash: "unknown" });
    }
  });

  app.post("/api/projects/:projectId/git/clone", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { owner, repo } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ message: "owner and repo are required" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const url = `https://github.com/${owner}/${repo}.git`;
      const httpTransport = github.createGitHttpTransport();

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before cloning ${owner}/${repo}`).catch(() => {});

      const clonedFiles = await gitService.cloneRepo(req.params.projectId, url, {
        httpTransport,
      } as any);

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of clonedFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      const repoFullName = `${owner}/${repo}`;
      await storage.updateProject(req.params.projectId, { githubRepo: repoFullName });
      await persistRepoState(req.params.projectId, "commit");

      return res.json({ success: true, filesCloned: clonedFiles.length, githubRepo: repoFullName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Clone failed";
      return res.status(500).json({ message });
    }
  });

}
