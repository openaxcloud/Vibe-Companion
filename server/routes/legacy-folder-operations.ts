// AUTO-EXTRACTED from server/routes.ts (lines 11168-11220)
// Original section: folder-operations
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


export async function registerFolderOperationsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- FOLDER OPERATIONS ---
  app.post("/api/projects/:id/storage/buckets/:bucketId/folders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const { folderPath } = req.body;
      if (!folderPath || typeof folderPath !== "string") return res.status(400).json({ error: "folderPath is required", code: "INVALID_INPUT" });
      const safePath = sanitizeFolderPath(folderPath.trim());
      if (!safePath) return res.status(400).json({ error: "Invalid folder path", code: "INVALID_INPUT" });
      const folder = await storage.createFolder(req.params.bucketId, safePath);
      res.json(folder);
    } catch {
      res.status(500).json({ error: "Failed to create folder", code: "INTERNAL_ERROR" });
    }
  });

  async function handleFolderDelete(req: Request, res: Response, folderPath: string) {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      if (!folderPath || typeof folderPath !== "string") return res.status(400).json({ error: "folderPath is required", code: "INVALID_INPUT" });
      const safePath = sanitizeFolderPath(folderPath);
      if (!safePath) return res.status(400).json({ error: "Invalid folder path", code: "INVALID_INPUT" });
      const deleted = await storage.deleteFolder(req.params.bucketId, safePath);
      if (!deleted) return res.status(404).json({ error: "Folder not found", code: "OBJECT_NOT_FOUND" });
      res.json({ message: "Folder deleted" });
    } catch {
      res.status(500).json({ error: "Failed to delete folder", code: "INTERNAL_ERROR" });
    }
  }

  app.delete("/api/projects/:id/storage/buckets/:bucketId/folders/*folderPath", requireAuth, async (req: Request, res: Response) => {
    const folderPath = (req.params as Record<string, string>).folderPath || "";
    return handleFolderDelete(req, res, folderPath);
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/folders/delete", requireAuth, async (req: Request, res: Response) => {
    return handleFolderDelete(req, res, req.body.folderPath);
  });

  app.get("/api/projects/:id/storage/buckets/:bucketId/folders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible", code: "FORBIDDEN" });
      const folderPath = sanitizeFolderPath(qstr(req.query.path) || "");
      const allObjects = await storage.getObjectsByFolder(req.params.bucketId, folderPath);
      const foldersOnly = allObjects.filter(obj => obj.mimeType === "application/x-directory");
      res.json(foldersOnly);
    } catch {
      res.status(500).json({ error: "Failed to list folders", code: "INTERNAL_ERROR" });
    }
  });

}
