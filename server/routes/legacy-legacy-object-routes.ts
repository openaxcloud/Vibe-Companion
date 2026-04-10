// AUTO-EXTRACTED from server/routes.ts (lines 11221-11320)
// Original section: legacy-object-routes
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


export async function registerLegacyObjectRoutesRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- LEGACY OBJECT ROUTES (backwards compat) ---
  app.get("/api/projects/:id/storage/objects", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const objects = await storage.getStorageObjects(req.params.id);
      res.json(objects);
    } catch {
      res.status(500).json({ error: "Failed to fetch objects", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/objects", requireAuth, storageUpload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "No file uploaded", code: "INVALID_INPUT" });
      if (file.size === 0) return res.status(400).json({ error: "Empty file (0 bytes) cannot be uploaded", code: "INVALID_INPUT" });
      if (!await validateFileSizeForPlan(req, res, [file])) return;

      const projectId = req.params.id;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found", code: "NOT_FOUND" });
      const defaultBucket = await storage.getOrCreateDefaultBucket(projectId, project.userId);

      const currentUsage = await storage.getProjectStorageUsage(projectId);
      if (currentUsage.totalBytes + file.size > currentUsage.planLimit) {
        const { unlink } = await import("fs/promises");
        try { await unlink(file.path); } catch {}
        return res.status(413).json({ error: "Storage quota exceeded", code: "STORAGE_LIMIT_EXCEEDED" });
      }

      const { mkdir, rename } = await import("fs/promises");
      const storageDir = path.join(BUCKET_STORAGE_DIR, defaultBucket.id);
      await mkdir(storageDir, { recursive: true });
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
      const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
      await rename(file.path, storagePath);

      const obj = await storage.createStorageObject({
        projectId, bucketId: defaultBucket.id, folderPath: "",
        filename: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, storagePath,
      });
      res.json(obj);
    } catch {
      res.status(500).json({ error: "Upload failed", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/objects/:objId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.projectId !== req.params.id) return res.status(404).json({ error: "Object not found", code: "NOT_FOUND" });
      const { createReadStream } = await import("fs");
      const { stat } = await import("fs/promises");
      try { await stat(obj.storagePath); } catch { return res.status(404).json({ error: "File not found on disk", code: "NOT_FOUND" }); }
      res.setHeader("Content-Type", obj.mimeType);
      const encodedFilename = encodeURIComponent(obj.filename).replace(/'/g, "%27");
      res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      storage.trackBandwidth(req.params.id, obj.sizeBytes).catch(() => {});
      createReadStream(obj.storagePath).pipe(res);
    } catch {
      res.status(500).json({ error: "Download failed", code: "INTERNAL_ERROR" });
    }
  });

  app.delete("/api/projects/:id/storage/objects/:objId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.projectId !== req.params.id) return res.status(404).json({ error: "Object not found", code: "NOT_FOUND" });
      try { const { unlink } = await import("fs/promises"); await unlink(obj.storagePath); } catch {}
      const deleted = await storage.deleteStorageObject(req.params.objId);
      if (!deleted) return res.status(404).json({ error: "Object not found", code: "NOT_FOUND" });
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ error: "Failed to delete object", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const usage = await storage.getProjectStorageUsage(req.params.id);
      res.json(usage);
    } catch {
      res.status(500).json({ error: "Failed to fetch usage", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/bandwidth", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const bandwidth = await storage.getProjectBandwidth(req.params.id);
      res.json(bandwidth);
    } catch {
      res.status(500).json({ error: "Failed to fetch bandwidth", code: "INTERNAL_ERROR" });
    }
  });

}
