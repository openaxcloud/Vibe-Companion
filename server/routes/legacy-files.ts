// AUTO-EXTRACTED from server/routes.ts (lines 5577-6026)
// Original section: files
// Extracted by scripts/batch-extract-routes.cjs

function sanitizeProjectName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, 200);
  const sanitized = trimmed.replace(/[<>"'`;{}]/g, "");
  if (!sanitized || sanitized.length === 0) return null;
  return sanitized;
}

// Auto-extracted route file forgot to copy several helpers from
// routes.ts. Adding them locally so /api/projects/:id/files endpoints
// don't ReferenceError at runtime. Bodies copied verbatim from
// server/routes.ts:765-794.
async function verifyProjectWriteAccess(projectId: string, userId: string | number): Promise<boolean> {
  try {
    const collaborators = await storage.getProjectCollaborators(projectId);
    const uid = String(userId);
    return collaborators.some((c: any) => String(c.userId) === uid && (c.role === 'editor' || c.role === 'admin' || c.role === 'owner'));
  } catch {
    return false;
  }
}

async function isProjectCollaborator(projectId: string | number, userId: string | number): Promise<{ allowed: boolean; role?: string }> {
  try {
    const collaborators = await storage.getProjectCollaborators(String(projectId));
    const uid = String(userId);
    const collab = collaborators.find((c: any) => String(c.userId) === uid);
    return collab ? { allowed: true, role: collab.role } : { allowed: false };
  } catch {
    return { allowed: false };
  }
}

function sanitizePath(p: string): string | null {
  if (!p || typeof p !== "string") return null;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return null;
  if (p.includes("..") || p.includes("\\")) return null;
  const normalized = pathPosix.normalize(decoded).replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized || normalized.startsWith("/")) return null;
  return normalized;
}

function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") return "";
  return input.slice(0, maxLength);
}

function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  const trimmed = filename.trim().slice(0, 500);
  if (/[<>"'`;{}|&$!]/.test(trimmed)) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return sanitizePath(trimmed);
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


export async function registerFilesRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- FILES ---
  app.get("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (String(project.userId) !== String(req.session.userId) && !project.isDemo && !await verifyProjectAccess(req.params.projectId, req.session.userId!)) {
      const collab = await isProjectCollaborator(project.id, req.session.userId!);
      if (!collab.allowed) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    const fileList = await storage.getFiles(req.params.projectId);
    return res.json(fileList);
  });

  app.post("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.projectId, req.session.userId!))) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const data = insertFileSchema.parse(req.body);
      const safeName = sanitizeFilename(data.filename);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      if (data.content) {
        data.content = sanitizeInput(data.content, 500000);
      }
      const file = await storage.createFile(req.params.projectId, { ...data, filename: safeName });
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      if (data.content) syncFileToWorkspace(req.params.projectId, safeName, data.content);
      return res.status(201).json(file);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("[POST /api/projects/:projectId/files]", error?.message, error?.stack);
      return res.status(500).json({ message: "Failed to create file", detail: error?.message });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.projectFiles, files: UPLOAD_LIMITS.maxProjectFiles },
  });

  app.post("/api/projects/:projectId/upload", requireAuth, upload.array("files", 10), async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.projectId, req.session.userId!))) {
      return res.status(403).json({ message: "Access denied" });
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const prefix = (req.body.path || "").replace(/^\/+|\/+$/g, "");
    const created = [];
    for (const f of files) {
      const rawName = f.originalname.replace(/[^a-zA-Z0-9._\-\/]/g, "_").slice(0, 100);
      const filename = prefix ? `${prefix}/${rawName}` : rawName;
      const safeName = sanitizeFilename(filename);
      if (!safeName) continue;
      const isBinary = !f.mimetype.startsWith("text/") && !f.mimetype.includes("json") && !f.mimetype.includes("javascript") && !f.mimetype.includes("xml") && !f.mimetype.includes("css") && !f.mimetype.includes("html") && !f.mimetype.includes("svg");
      const content = isBinary
        ? `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
        : f.buffer.toString("utf-8");
      try {
        const file = await storage.createFile(req.params.projectId, { filename: safeName, content, isBinary, mimeType: f.mimetype });
        created.push(file);
      } catch {}
    }
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.status(201).json({ files: created, count: created.length });
  });

  app.patch("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(existingFile.projectId, req.session.userId!))) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, filename } = req.body;
    if (typeof content === "string") {
      let sanitizedContent = sanitizeInput(content, 500000);

      try {
        const { projectExtensions } = await import("@shared/schema");
        const { eq, and } = await import("drizzle-orm");
        const { db: dbConn } = await import("../db");
        const prettierExt = await dbConn.query.projectExtensions.findFirst({
          where: and(eq(projectExtensions.projectId, String(project.id)), eq(projectExtensions.extensionId, 'prettier'), eq(projectExtensions.enabled, true))
        });
        if (prettierExt) {
          const extPath = require('path').extname(existingFile.filename || '').toLowerCase();
          const fmtExts = ['.js','.jsx','.ts','.tsx','.css','.scss','.less','.html','.json','.md','.yaml','.yml','.vue','.svelte'];
          if (fmtExts.includes(extPath)) {
            const fsP = require('fs/promises');
            const pathMod = require('path');
            const wsDir = pathMod.join(process.cwd(), 'project-workspaces', String(project.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
            const prettierBin = pathMod.join(wsDir, 'node_modules', '.bin', 'prettier');
            try {
              await fsP.access(prettierBin);
              const tmpFile = pathMod.join(wsDir, `.fmt-tmp-${Date.now()}${extPath}`);
              await fsP.writeFile(tmpFile, sanitizedContent, 'utf-8');
              const { spawn: spawnFmt } = require('child_process');
              await new Promise<void>((resolve) => {
                const p = spawnFmt(prettierBin, ['--write', tmpFile], { cwd: wsDir, timeout: 10000 });
                p.on('close', () => resolve());
                p.on('error', () => resolve());
              });
              const formatted = await fsP.readFile(tmpFile, 'utf-8');
              await fsP.unlink(tmpFile).catch(() => {});
              if (formatted && formatted.length > 0) sanitizedContent = formatted;
            } catch {}
          }
        }
      } catch {}

      const oldContent = existingFile.content;
      const file = await storage.updateFileContent(req.params.id, sanitizedContent);
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      syncFileToWorkspace(project.id, existingFile.filename, sanitizedContent);
      import("./workflowExecutor").then(({ fireTrigger }) => fireTrigger(project.id, "on-save")).catch(() => {});
      if (sanitizedContent !== oldContent && !sanitizedContent.startsWith("data:")) {
        (async () => {
          try {
            const versionNum = await storage.getLatestFileVersionNumber(existingFile.id);
            await storage.createFileVersion({
              fileId: existingFile.id, projectId: existingFile.projectId, content: sanitizedContent,
              versionNumber: versionNum + 1, byteSize: Buffer.byteLength(sanitizedContent, "utf-8"),
            });
            storage.deleteOldFileVersions(existingFile.id, 200).catch(() => {});
          } catch {}
        })();
      }
      const response: any = { ...file };
      if (sanitizedContent !== content) {
        response.formatted = true;
        response.content = sanitizedContent;
      }

      return res.json(response);
    }
    if (typeof filename === "string" && filename.trim()) {
      const safeName = sanitizeFilename(filename.trim());
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const file = await storage.renameFile(req.params.id, safeName);
      renameFileInWorkspace(project.id, existingFile.filename, safeName);
      return res.json(file);
    }
    return res.status(400).json({ message: "content or filename required" });
  });

  app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(existingFile.projectId, req.session.userId!))) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteFile(req.params.id);
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    deleteFileFromWorkspace(project.id, existingFile.filename);
    return res.json({ message: "File deleted" });
  });

  app.post("/api/files/batch-delete", requireAuth, async (req: Request, res: Response) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array required" });
    }
    if (ids.length > 500) {
      return res.status(400).json({ message: "Too many files (max 500)" });
    }
    const validFiles: { id: string; projectId: string; filename: string }[] = [];
    let projectId: string | null = null;
    for (const id of ids) {
      const existingFile = await storage.getFile(String(id));
      if (!existingFile) {
        return res.status(404).json({ message: `File ${id} not found` });
      }
      if (projectId === null) {
        projectId = existingFile.projectId;
        const project = await storage.getProject(projectId);
        if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(projectId, req.session.userId!))) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (existingFile.projectId !== projectId) {
        return res.status(400).json({ message: "All files must belong to the same project" });
      }
      validFiles.push({ id: String(id), projectId: existingFile.projectId, filename: existingFile.filename });
    }
    const { db: dbConn } = await import("../db");
    const { eq, inArray } = await import("drizzle-orm");
    const { files } = await import("@shared/schema");
    await dbConn.delete(files).where(inArray(files.id, validFiles.map(f => f.id)));
    for (const f of validFiles) {
      deleteFileFromWorkspace(f.projectId, f.filename);
    }
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.json({ message: `Deleted ${validFiles.length} files`, deleted: validFiles.length });
  });

  app.patch("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, language, devUrlPublic } = req.body;
    let safeName = name;
    if (typeof name === "string") {
      safeName = sanitizeProjectName(name);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid project name" });
      }
    }
    const updateData: any = { name: safeName, language };
    if (typeof devUrlPublic === "boolean") updateData.devUrlPublic = devUrlPublic;
    const updated = await storage.updateProject(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
  });

  app.get("/api/projects/:id/artifacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const collab = await isProjectCollaborator(project.id, req.session.userId!);
      if (!collab.allowed) return res.status(403).json({ message: "Access denied" });
      const artifactList = await storage.getArtifacts(req.params.id);
      return res.json(artifactList);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/artifacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { name, type, entryFile, settings } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "name is required" });
      const validTypes = ARTIFACT_TYPES as readonly string[];
      const artifactType = (type && validTypes.includes(type)) ? type : "web-app";
      const artifact = await storage.createArtifact({
        projectId: req.params.id,
        name: name.slice(0, 100),
        type: artifactType,
        entryFile: entryFile || null,
        settings: settings || {},
      });
      return res.status(201).json(artifact);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/projects/:id/artifacts/:artifactId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const collab = await isProjectCollaborator(project.id, req.session.userId!);
      if (!collab.allowed) return res.status(403).json({ message: "Access denied" });
      const artifact = await storage.getArtifact(req.params.artifactId);
      if (!artifact || artifact.projectId !== req.params.id) return res.status(404).json({ message: "Artifact not found" });
      return res.json(artifact);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/projects/:id/artifacts/:artifactId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const existing = await storage.getArtifact(req.params.artifactId);
      if (!existing || existing.projectId !== req.params.id) return res.status(404).json({ message: "Artifact not found" });
      const { name, type, entryFile, settings } = req.body;
      const updates: any = {};
      if (typeof name === "string") updates.name = name.slice(0, 100);
      if (typeof type === "string") {
        const validTypes = ARTIFACT_TYPES as readonly string[];
        if (validTypes.includes(type)) updates.type = type;
      }
      if (typeof entryFile === "string" || entryFile === null) updates.entryFile = entryFile;
      if (settings && typeof settings === "object") updates.settings = settings;
      const updated = await storage.updateArtifact(req.params.artifactId, updates);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id/artifacts/:artifactId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const existing = await storage.getArtifact(req.params.artifactId);
      if (!existing || existing.projectId !== req.params.id) return res.status(404).json({ message: "Artifact not found" });
      await storage.deleteArtifact(req.params.artifactId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/projects/:id/spotlight", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const collab = await isProjectCollaborator(project.id, req.session.userId!);
    if (!collab.allowed) {
      return res.status(403).json({ message: "Access denied" });
    }
    const invites = collab.role === "owner" ? await storage.getProjectInvites(project.id) : [];
    const owner = await storage.getUser(project.userId);
    return res.json({
      project,
      invites,
      owner: owner ? { id: owner.id, email: owner.email, displayName: owner.displayName, avatarUrl: owner.avatarUrl } : null,
      currentUserRole: collab.role,
    });
  });

  app.patch("/api/projects/:id/spotlight", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const collab = await isProjectCollaborator(project.id, req.session.userId!);
    if (!collab.allowed || collab.role === "viewer") {
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, description, coverImageUrl, isPublic } = req.body;
    const updates: any = {};
    if (typeof name === "string") {
      const safeName = sanitizeProjectName(name);
      if (!safeName) return res.status(400).json({ message: "Invalid project name" });
      updates.name = safeName;
    }
    if (typeof description === "string") updates.description = description.slice(0, 2000);
    if (typeof coverImageUrl === "string" || coverImageUrl === null) updates.coverImageUrl = coverImageUrl;
    if (typeof isPublic === "boolean" && collab.role === "owner") updates.isPublic = isPublic;
    const updated = await storage.updateProject(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    return res.json(updated);
  });

  app.post("/api/projects/:id/spotlight/invites", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    let { email, role } = req.body;
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ message: "Email or username is required" });
    }
    const identifier = email.trim();
    let resolvedEmail = identifier;
    if (!identifier.includes("@")) {
      const user = await storage.getUserByDisplayName(identifier);
      if (!user) {
        return res.status(404).json({ message: `User "${identifier}" not found` });
      }
      resolvedEmail = user.email;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const validRoles = ["viewer", "editor"];
    const safeRole = validRoles.includes(role) ? role : "viewer";
    try {
      const invite = await storage.createProjectInvite({
        projectId: project.id,
        email: resolvedEmail.toLowerCase().trim(),
        role: safeRole,
        invitedBy: req.session.userId!,
      });
      return res.json(invite);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: "This user has already been invited" });
      }
      throw err;
    }
  });

  const coverUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  app.post("/api/projects/:id/spotlight/cover", requireAuth, coverUpload.single("cover"), async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const collab = await isProjectCollaborator(project.id, req.session.userId!);
    if (!collab.allowed || collab.role === "viewer") {
      return res.status(403).json({ message: "Access denied" });
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const ext = file.originalname.split(".").pop() || "png";
    const filename = `.cover.${ext}`;
    const content = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const existingFiles = await storage.getFiles(project.id);
    const oldCovers = existingFiles.filter(f => f.filename.startsWith(".cover."));
    for (const old of oldCovers) {
      await storage.deleteFile(old.id);
    }
    await storage.createFile(project.id, { filename, content, isBinary: true, mimeType: file.mimetype });
    const coverUrl = `/api/projects/${project.id}/spotlight/cover-image`;
    const updated = await storage.updateProject(req.params.id, { coverImageUrl: coverUrl });
    if (!updated) return res.status(404).json({ message: "Project not found" });
    return res.json({ coverImageUrl: coverUrl });
  });

  app.get("/api/projects/:id/spotlight/cover-image", async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.isPublic && !project.isPublished) {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const collab = await isProjectCollaborator(project.id, req.session.userId);
      if (!collab.allowed) return res.status(403).json({ message: "Access denied" });
    }
    const projectFiles = await storage.getFiles(req.params.id);
    const coverFile = projectFiles.find(f => f.filename.startsWith(".cover."));
    if (!coverFile || !coverFile.content) {
      return res.status(404).json({ message: "No cover image" });
    }
    const match = coverFile.content.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(404).json({ message: "Invalid cover data" });
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buffer);
  });

  app.patch("/api/projects/:id/spotlight/invites/:inviteId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { role } = req.body;
    const validRoles = ["viewer", "editor"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'viewer' or 'editor'" });
    }
    const updated = await storage.updateProjectInvite(req.params.inviteId, project.id, { role });
    if (!updated) return res.status(404).json({ message: "Invite not found" });
    return res.json(updated);
  });

  app.post("/api/projects/:id/spotlight/invites/:inviteId/accept", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const invite = await storage.getProjectInviteByIdAndProject(req.params.inviteId, req.params.id);
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.email !== user.email.toLowerCase()) {
      return res.status(403).json({ message: "This invite is not for you" });
    }
    if (invite.status === "accepted") {
      const project = await storage.getProject(invite.projectId);
      return res.json({ ...invite, projectName: project?.name });
    }
    const updated = await storage.updateProjectInvite(invite.id, invite.projectId, { status: "accepted" });
    const project = await storage.getProject(invite.projectId);
    return res.json({ ...updated, projectName: project?.name });
  });

  app.post("/api/invites/:id/accept", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const pending = await storage.getPendingInvitesForEmail(user.email.toLowerCase());
    const invite = pending.find(i => i.id === req.params.id);
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    const updated = await storage.updateProjectInvite(invite.id, invite.projectId, { status: "accepted" });
    const project = await storage.getProject(invite.projectId);
    return res.json({ ...updated, projectId: invite.projectId, projectName: project?.name });
  });

  app.get("/api/invites/pending", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const invites = await storage.getPendingInvitesWithProjects(user.email);
    return res.json(invites);
  });

  app.post("/api/invites/:id/decline", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const pending = await storage.getPendingInvitesForEmail(user.email.toLowerCase());
    const invite = pending.find(i => i.id === req.params.id);
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    const deleted = await storage.deleteProjectInvite(invite.id, invite.projectId);
    if (!deleted) return res.status(404).json({ message: "Failed to decline invite" });
    return res.json({ success: true });
  });

  app.delete("/api/projects/:id/spotlight/invites/:inviteId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const deleted = await storage.deleteProjectInvite(req.params.inviteId, project.id);
    if (!deleted) return res.status(404).json({ message: "Invite not found" });
    return res.json({ success: true });
  });

}
