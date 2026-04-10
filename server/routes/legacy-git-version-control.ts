// AUTO-EXTRACTED from server/routes.ts (lines 7046-7347)
// Original section: git-version-control
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


export async function registerGitVersionControlRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- GIT VERSION CONTROL (Real Git via isomorphic-git) ---

  app.get("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const branchName = qstr(req.query.branch) || undefined;
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const logs = await gitService.getLog(req.params.projectId, branchName);
      const commitList = logs.map(entry => ({
        id: entry.sha,
        projectId: req.params.projectId,
        branchName: branchName || "main",
        message: entry.message,
        authorId: entry.author,
        parentCommitId: entry.parentSha,
        createdAt: entry.date,
      }));
      return res.json(commitList);
    } catch (err: any) {
      return res.json([]);
    }
  });

  app.get("/api/projects/:projectId/git/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const logs = await gitService.getLog(req.params.projectId, undefined, 200);
      const entry = logs.find(l => l.sha === req.params.commitId);
      if (!entry) {
        return res.status(404).json({ message: "Commit not found" });
      }
      return res.json({
        id: entry.sha,
        projectId: req.params.projectId,
        branchName: "main",
        message: entry.message,
        authorId: entry.author,
        parentCommitId: entry.parentSha,
        createdAt: entry.date,
      });
    } catch {
      return res.status(404).json({ message: "Commit not found" });
    }
  });

  app.post("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const activeMerge = await storage.getMergeState(req.params.projectId);
    if (activeMerge) {
      return res.status(409).json({ message: "Cannot commit while a merge is in progress. Resolve all conflicts first." });
    }
    const { message, branchName = "main", files: selectedFiles } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Commit message is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      if (branchName && branchName !== "main") {
        try {
          await gitService.checkoutBranch(req.params.projectId, branchName);
        } catch {
          await gitService.createBranch(req.params.projectId, branchName);
          await gitService.checkoutBranch(req.params.projectId, branchName);
        }
      }

      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const validFiles = Array.isArray(selectedFiles) ? selectedFiles.filter((f: unknown) => typeof f === "string") : undefined;
      const result = await gitService.addAndCommit(req.params.projectId, message.trim(), authorName, authorEmail, validFiles);
      import("./workflowExecutor").then(({ fireTrigger }) => fireTrigger(req.params.projectId, "on-commit")).catch(() => {});

      const snapshot: Record<string, string> = {};
      for (const f of dbFiles) {
        snapshot[f.filename] = f.content;
      }
      let branch = await storage.getBranch(req.params.projectId, branchName);
      if (!branch) {
        branch = await storage.createBranch({
          projectId: req.params.projectId,
          name: branchName,
          isDefault: branchName === "main",
        });
      }
      const dbCommit = await storage.createCommit({
        projectId: req.params.projectId,
        branchName,
        message: message.trim(),
        authorId: req.session.userId!,
        parentCommitId: branch.headCommitId || undefined,
        snapshot,
      });
      await storage.updateBranchHead(branch.id, dbCommit.id);
      await persistRepoState(req.params.projectId, "commit");

      return res.status(201).json({
        id: result.sha,
        dbId: dbCommit.id,
        projectId: req.params.projectId,
        branchName,
        message: message.trim(),
        authorId: req.session.userId!,
        sha: result.sha,
        createdAt: result.date,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Commit failed";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const gitBranches = await gitService.listBranches(req.params.projectId);
      const branchList: Array<Record<string, unknown>> = [];
      for (const b of gitBranches) {
        let headCommitId: string | null = null;
        try {
          const commits = await gitService.getLog(req.params.projectId, b.name, 1);
          if (commits.length > 0) headCommitId = commits[0].sha;
        } catch {}
        branchList.push({
          id: `git-branch-${b.name}`,
          projectId: req.params.projectId,
          name: b.name,
          headCommitId,
          isDefault: b.name === "main",
          current: b.current,
          createdAt: new Date().toISOString(),
        });
      }
      return res.json(branchList);
    } catch {
      return res.json([]);
    }
  });

  app.post("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const activeMerge = await storage.getMergeState(req.params.projectId);
    if (activeMerge) {
      return res.status(409).json({ message: "Cannot create branches while a merge is in progress." });
    }
    const { name, fromBranch = "main" } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      await gitService.createBranch(req.params.projectId, name.trim(), fromBranch);
      await persistRepoState(req.params.projectId, "commit");
      return res.status(201).json({
        id: `git-branch-${name.trim()}`,
        projectId: req.params.projectId,
        name: name.trim(),
        headCommitId: null,
        isDefault: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to create branch";
      if (errMsg.includes("already exists")) {
        return res.status(409).json({ message: "Branch already exists" });
      }
      return res.status(500).json({ message: errMsg });
    }
  });

  app.delete("/api/projects/:projectId/git/branches/:branchId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
      return res.status(404).json({ message: "Project not found" });
    }

    const branchName = req.params.branchId.replace(/^git-branch-/, "");
    if (branchName === "main") {
      return res.status(400).json({ message: "Cannot delete the default branch" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      await gitService.deleteBranch(req.params.projectId, branchName);
      await persistRepoState(req.params.projectId, "commit");
      return res.json({ success: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete branch";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.post("/api/projects/:projectId/git/checkout", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const activeMerge = await storage.getMergeState(req.params.projectId);
    if (activeMerge) {
      return res.status(409).json({ message: "Cannot checkout while a merge is in progress. Complete or abort the merge first." });
    }
    const { commitId, branchName } = req.body;

    if (!commitId && !branchName) {
      return res.status(400).json({ message: "commitId or branchName is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before git checkout ${commitId ? commitId.slice(0, 7) : branchName}`).catch(() => {});

      if (commitId) {
        await gitService.checkoutCommit(req.params.projectId, commitId);
      } else if (branchName) {
        await gitService.checkoutBranch(req.params.projectId, branchName);
      }

      const workingFiles = gitService.getWorkingTreeFiles(req.params.projectId);

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of workingFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await persistRepoState(req.params.projectId, "commit");
      return res.json({ success: true, filesRestored: workingFiles.length });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.get("/api/projects/:projectId/git/diff", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = qstr(req.query.branch) || "main";

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const diff = await gitService.getDiff(req.params.projectId, branchName);
      return res.json(diff);
    } catch {
      return res.json({ branch: branchName, changes: [], hasCommits: false });
    }
  });

  app.get("/api/projects/:projectId/git/blame/:filename", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = qstr(req.query.branch) || "main";
    const filename = decodeURIComponent(req.params.filename);

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const blame = await gitService.getBlame(req.params.projectId, filename, branchName);
      if (blame.length === 0) {
        return res.status(404).json({ message: "File not found" });
      }
      return res.json({ filename, blame });
    } catch {
      return res.status(404).json({ message: "File not found" });
    }
  });

}
