// AUTO-EXTRACTED from server/routes.ts (lines 4654-4844)
// Original section: version-history
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


export async function registerVersionHistoryRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- VERSION HISTORY ---
  app.post("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      const { message } = z.object({ message: z.string().min(1).max(200) }).parse(req.body);
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      const snapshot: Record<string, string> = {};
      projectFiles.forEach(f => { snapshot[f.filename] = f.content; });
      const existingCommits = await storage.getCommits(project.id, "main");
      const parentCommitId = existingCommits.length > 0 ? existingCommits[0].id : undefined;
      const commit = await storage.createCommit({
        projectId: project.id, branchName: "main", message,
        authorId: req.session.userId!, parentCommitId: parentCommitId || null, snapshot,
      });
      let branch = await storage.getBranch(project.id, "main");
      if (!branch) {
        branch = await storage.createBranch({ projectId: project.id, name: "main", headCommitId: commit.id, isDefault: true });
      } else {
        await storage.updateBranchHead(branch.id, commit.id);
      }
      await storage.trackEvent(req.session.userId!, "commit_created", { projectId: project.id, commitId: commit.id });
      return res.status(201).json(commit);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create commit" });
    }
  });

  app.get("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const branch = qstr(req.query.branch) || "main";
      const commitList = await storage.getCommits(req.params.id, branch);
      return res.json(commitList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commits" });
    }
  });

  app.get("/api/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit) return res.status(404).json({ message: "Commit not found" });
      return res.json(commit);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commit" });
    }
  });

  app.post("/api/projects/:id/restore/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit || commit.projectId !== project.id) return res.status(404).json({ message: "Commit not found" });
      await createCheckpoint(project.id, req.session.userId!, "pre_risky_op", `Before restoring to commit ${commit.id.slice(0, 7)}`).catch(() => {});
      const currentFiles = await storage.getFiles(project.id);
      for (const f of currentFiles) { await storage.deleteFile(f.id); }
      const snapshot = commit.snapshot as Record<string, string>;
      for (const [filename, content] of Object.entries(snapshot)) {
        await storage.createFile(project.id, { filename, content });
      }
      return res.json({ message: "Restored to commit", commitId: commit.id });
    } catch {
      return res.status(500).json({ message: "Failed to restore" });
    }
  });

  app.get("/api/projects/:id/files/:fileId/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const file = await storage.getFile(req.params.fileId);
      if (!file || file.projectId !== project.id) return res.status(404).json({ message: "File not found" });
      const page = Math.max(1, parseInt(qstr(req.query.page)) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(qstr(req.query.pageSize)) || 50));
      const totalVersions = await storage.getFileVersionCount(file.id);
      const offset = (page - 1) * pageSize;
      const versions = await storage.getFileVersions(file.id, pageSize, offset);
      return res.json({
        versions,
        pagination: { page, pageSize, totalVersions, totalPages: Math.ceil(totalVersions / pageSize), hasMore: offset + pageSize < totalVersions },
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch file history" });
    }
  });

  app.get("/api/projects/:id/files/:fileId/history/:versionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const file = await storage.getFile(req.params.fileId);
      if (!file || file.projectId !== project.id) return res.status(404).json({ message: "File not found" });
      const version = await storage.getFileVersion(req.params.versionId);
      if (!version || version.fileId !== file.id) return res.status(404).json({ message: "Version not found" });
      return res.json(version);
    } catch {
      return res.status(500).json({ message: "Failed to fetch file version" });
    }
  });

  app.post("/api/projects/:id/files/:fileId/restore/:versionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const file = await storage.getFile(req.params.fileId);
      if (!file || file.projectId !== project.id) return res.status(404).json({ message: "File not found" });
      const version = await storage.getFileVersion(req.params.versionId);
      if (!version || version.fileId !== file.id) return res.status(404).json({ message: "Version not found" });
      const currentVersionNum = await storage.getLatestFileVersionNumber(file.id);
      await storage.createFileVersion({
        fileId: file.id, projectId: project.id, content: file.content,
        versionNumber: currentVersionNum + 1, byteSize: Buffer.byteLength(file.content, "utf-8"),
      });
      const updated = await storage.updateFileContent(file.id, version.content);
      await storage.createFileVersion({
        fileId: file.id, projectId: project.id, content: version.content,
        versionNumber: currentVersionNum + 2, byteSize: Buffer.byteLength(version.content, "utf-8"),
      });
      storage.deleteOldFileVersions(file.id, 200).catch(() => {});
      return res.json({ file: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to restore file" });
    }
  });

  app.get("/api/projects/:id/file-history/:filename", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !project.isDemo && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const filename = decodeURIComponent(req.params.filename);
      const projectFiles = await storage.getFiles(project.id);
      const file = projectFiles.find(f => f.filename === filename);
      if (!file) return res.json({ entries: [], pagination: { page: 1, pageSize: 50, totalVersions: 0, totalPages: 0, hasMore: false } });
      const page = Math.max(1, parseInt(qstr(req.query.page)) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(qstr(req.query.pageSize)) || 50));
      const totalVersions = await storage.getFileVersionCount(file.id);
      const offset = (page - 1) * pageSize;
      const versions = await storage.getFileVersions(file.id, pageSize, offset);
      const entries = versions.map(v => ({
        commitId: v.id, message: `Version ${v.versionNumber}`, authorId: project.userId, authorName: "Auto-save",
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt), content: v.content,
      }));
      return res.json({
        entries,
        pagination: { page, pageSize, totalVersions, totalPages: Math.ceil(totalVersions / pageSize), hasMore: offset + pageSize < totalVersions },
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch file history" });
    }
  });

  app.post("/api/projects/:id/file-history/restore", requireAuth, async (req: Request, res: Response) => {
    try {
      const { filename, content, commitId } = z.object({ filename: z.string(), content: z.string(), commitId: z.string().optional() }).parse(req.body);
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      const file = projectFiles.find(f => f.filename === filename);
      if (!file) return res.status(404).json({ message: "File not found" });
      const currentVersionNum = await storage.getLatestFileVersionNumber(file.id);
      await storage.createFileVersion({
        fileId: file.id, projectId: project.id, content: file.content,
        versionNumber: currentVersionNum + 1, byteSize: Buffer.byteLength(file.content, "utf-8"),
      });
      const updated = await storage.updateFileContent(file.id, content);
      await storage.createFileVersion({
        fileId: file.id, projectId: project.id, content: content,
        versionNumber: currentVersionNum + 2, byteSize: Buffer.byteLength(content, "utf-8"),
      });
      storage.deleteOldFileVersions(file.id, 200).catch(() => {});
      return res.json({ file: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to restore file" });
    }
  });

  app.get("/api/projects/:id/branches", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const branchList = await storage.getBranches(req.params.id);
      return res.json(branchList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

}
