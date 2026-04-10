// AUTO-EXTRACTED from server/routes.ts (lines 10897-11167)
// Original section: bucket-object-operations
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


export async function registerBucketObjectOperationsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;

  const storageMultiUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  // --- BUCKET OBJECT OPERATIONS ---
  app.get("/api/projects/:id/storage/buckets/:bucketId/objects", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const { prefix, match_glob, max_results, start_offset, end_offset, folder_path } = req.query;
      const fp = folder_path !== undefined ? sanitizeFolderPath(folder_path as string) : undefined;
      const objects = await storage.listObjectsFiltered(req.params.bucketId, {
        prefix: prefix as string | undefined,
        matchGlob: match_glob as string | undefined,
        maxResults: max_results ? parseInt(max_results as string) : undefined,
        startOffset: start_offset ? parseInt(start_offset as string) : undefined,
        endOffset: end_offset ? parseInt(end_offset as string) : undefined,
        folderPath: fp,
      });
      res.json(objects);
    } catch {
      res.status(500).json({ error: "Failed to list objects", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/objects/upload", requireAuth, storageMultiUpload.array("files", 20), async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const uploadedFiles = req.files as Express.Multer.File[] || [];
      if (uploadedFiles.length === 0) return res.status(400).json({ error: "No files uploaded", code: "INVALID_INPUT" });
      if (!await validateFileSizeForPlan(req, res, uploadedFiles)) return;

      const projectId = req.params.id;
      const bucketId = req.params.bucketId;
      const folderPath = sanitizeFolderPath((req.body.folderPath as string) || "");

      const currentUsage = await storage.getProjectStorageUsage(projectId);
      const totalNewSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentUsage.totalBytes + totalNewSize > currentUsage.planLimit) {
        const { unlink: unlinkFile } = await import("fs/promises");
        for (const f of uploadedFiles) { try { await unlinkFile(f.path); } catch {} }
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }

      const { mkdir, rename } = await import("fs/promises");
      const storageDir = path.join(BUCKET_STORAGE_DIR, bucketId, folderPath);
      await mkdir(storageDir, { recursive: true });
      const results = [];
      for (const file of uploadedFiles) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
        const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
        await rename(file.path, storagePath);
        const obj = await storage.createStorageObject({
          projectId, bucketId, folderPath,
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath,
        });
        results.push(obj);
      }
      res.json(results);
    } catch {
      res.status(500).json({ error: "Upload failed", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/objects/upload-folder", requireAuth, storageMultiUpload.array("files", 50), async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const uploadedFiles = req.files as Express.Multer.File[] || [];
      if (uploadedFiles.length === 0) return res.status(400).json({ error: "No files uploaded", code: "INVALID_INPUT" });
      if (!await validateFileSizeForPlan(req, res, uploadedFiles)) return;

      const projectId = req.params.id;
      const bucketId = req.params.bucketId;

      const currentUsage = await storage.getProjectStorageUsage(projectId);
      const totalNewSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentUsage.totalBytes + totalNewSize > currentUsage.planLimit) {
        const { unlink: unlinkFile } = await import("fs/promises");
        for (const f of uploadedFiles) { try { await unlinkFile(f.path); } catch {} }
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }

      const { mkdir, rename } = await import("fs/promises");
      const results = [];
      const relativePaths = req.body.relativePaths ? (Array.isArray(req.body.relativePaths) ? req.body.relativePaths : [req.body.relativePaths]) : [];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const relativePath = relativePaths[i] || file.originalname;
        const parts = relativePath.split("/");
        const filename = parts.pop() || file.originalname;
        const folderPath = sanitizeFolderPath(parts.join("/"));

        const storageDir = path.join(BUCKET_STORAGE_DIR, bucketId, folderPath);
        await mkdir(storageDir, { recursive: true });
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
        const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
        await rename(file.path, storagePath);
        const obj = await storage.createStorageObject({
          projectId, bucketId, folderPath,
          filename, mimeType: file.mimetype, sizeBytes: file.size, storagePath,
        });
        results.push(obj);
      }
      res.json(results);
    } catch {
      res.status(500).json({ error: "Folder upload failed", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/objects/upload-text", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const { objectName, contents, folderPath: fp } = req.body;
      if (!objectName || typeof contents !== "string") return res.status(400).json({ error: "objectName and contents are required", code: "INVALID_INPUT" });
      const folderPath = sanitizeFolderPath(fp || "");

      const currentUsage = await storage.getProjectStorageUsage(req.params.id);
      const sizeBytes = Buffer.byteLength(contents, "utf-8");
      if (currentUsage.totalBytes + sizeBytes > currentUsage.planLimit) {
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }

      const { mkdir, writeFile } = await import("fs/promises");
      const storageDir = path.join(BUCKET_STORAGE_DIR, req.params.bucketId, folderPath);
      await mkdir(storageDir, { recursive: true });
      const safeName = objectName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
      await writeFile(storagePath, contents, "utf-8");
      const obj = await storage.createStorageObject({
        projectId: req.params.id, bucketId: req.params.bucketId, folderPath,
        filename: objectName, mimeType: "text/plain", sizeBytes, storagePath,
      });
      res.json(obj);
    } catch {
      res.status(500).json({ error: "Text upload failed", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/objects/upload-bytes", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const { objectName, contents, folderPath: fp } = req.body;
      if (!objectName || typeof contents !== "string") return res.status(400).json({ error: "objectName and base64 contents are required", code: "INVALID_INPUT" });
      const folderPath = sanitizeFolderPath(fp || "");

      const buffer = Buffer.from(contents, "base64");
      const currentUsage = await storage.getProjectStorageUsage(req.params.id);
      if (currentUsage.totalBytes + buffer.length > currentUsage.planLimit) {
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }

      const { mkdir, writeFile } = await import("fs/promises");
      const storageDir = path.join(BUCKET_STORAGE_DIR, req.params.bucketId, folderPath);
      await mkdir(storageDir, { recursive: true });
      const safeName = objectName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
      await writeFile(storagePath, buffer);
      const obj = await storage.createStorageObject({
        projectId: req.params.id, bucketId: req.params.bucketId, folderPath,
        filename: objectName, mimeType: "application/octet-stream", sizeBytes: buffer.length, storagePath,
      });
      res.json(obj);
    } catch {
      res.status(500).json({ error: "Bytes upload failed", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/buckets/:bucketId/objects/:objId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.bucketId !== req.params.bucketId) return res.status(404).json({ error: "Object not found", code: "OBJECT_NOT_FOUND" });

      const { createReadStream } = await import("fs");
      const { stat, readFile } = await import("fs/promises");
      try { await stat(obj.storagePath); } catch { return res.status(404).json({ error: "File not found on disk", code: "OBJECT_NOT_FOUND" }); }

      const mode = qstr(req.query.mode);
      storage.trackBandwidth(req.params.id, obj.sizeBytes).catch(() => {});

      if (mode === "text") {
        const content = await readFile(obj.storagePath, "utf-8");
        res.setHeader("Content-Type", "text/plain");
        return res.send(content);
      }
      if (mode === "bytes") {
        const buffer = await readFile(obj.storagePath);
        res.setHeader("Content-Type", "application/octet-stream");
        return res.send(buffer);
      }
      if (mode === "stream") {
        res.setHeader("Content-Type", obj.mimeType);
        res.setHeader("Transfer-Encoding", "chunked");
        return createReadStream(obj.storagePath).pipe(res);
      }

      res.setHeader("Content-Type", obj.mimeType);
      const encodedFilename = encodeURIComponent(obj.filename).replace(/'/g, "%27");
      res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      createReadStream(obj.storagePath).pipe(res);
    } catch {
      res.status(500).json({ error: "Download failed", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/objects/:objId/copy", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const srcObj = await storage.getStorageObject(req.params.objId);
      if (!srcObj || srcObj.bucketId !== req.params.bucketId) return res.status(404).json({ error: "Object not found in this bucket", code: "OBJECT_NOT_FOUND" });
      const { destObjectName, destFolderPath } = req.body;
      if (!destObjectName) return res.status(400).json({ error: "destObjectName is required", code: "INVALID_INPUT" });
      const currentUsage = await storage.getProjectStorageUsage(req.params.id);
      if (currentUsage.totalBytes + srcObj.sizeBytes > currentUsage.planLimit) {
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }
      const copied = await storage.copyObject(req.params.objId, sanitizeFolderPath(destFolderPath || ""), destObjectName);
      res.json(copied);
    } catch {
      res.status(500).json({ error: "Copy failed", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/buckets/:bucketId/objects/exists/:objectName", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const folderPath = sanitizeFolderPath(qstr(req.query.folder_path) || "");
      const exists = await storage.objectExists(req.params.bucketId, folderPath, decodeURIComponent(req.params.objectName));
      res.json({ exists });
    } catch {
      res.status(500).json({ error: "Check failed", code: "INTERNAL_ERROR" });
    }
  });

  app.delete("/api/projects/:id/storage/buckets/:bucketId/objects/:objId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.bucketId !== req.params.bucketId) return res.status(404).json({ error: "Object not found", code: "OBJECT_NOT_FOUND" });
      try { const { unlink } = await import("fs/promises"); await unlink(obj.storagePath); } catch {}
      await storage.deleteStorageObject(req.params.objId);
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ error: "Failed to delete object", code: "INTERNAL_ERROR" });
    }
  });

  app.put("/api/projects/:id/storage/buckets/:bucketId/objects/:objId/move", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const srcObj = await storage.getStorageObject(req.params.objId);
      if (!srcObj || srcObj.bucketId !== req.params.bucketId) return res.status(404).json({ error: "Object not found in this bucket", code: "OBJECT_NOT_FOUND" });
      const { destFolderPath } = req.body;
      if (destFolderPath === undefined) return res.status(400).json({ error: "destFolderPath is required", code: "INVALID_INPUT" });
      const moved = await storage.moveObject(req.params.objId, sanitizeFolderPath(destFolderPath));
      if (!moved) return res.status(404).json({ error: "Object not found", code: "OBJECT_NOT_FOUND" });
      res.json(moved);
    } catch {
      res.status(500).json({ error: "Move failed", code: "INTERNAL_ERROR" });
    }
  });

}
