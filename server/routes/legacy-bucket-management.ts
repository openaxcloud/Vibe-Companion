// AUTO-EXTRACTED from server/routes.ts (lines 10773-10896)
// Original section: bucket-management
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


export async function registerBucketManagementRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- BUCKET MANAGEMENT ---
  app.post("/api/projects/:id/storage/buckets", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) return res.status(400).json({ error: "Bucket name is required", code: "INVALID_INPUT" });
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
      const bucket = await storage.createBucket(name.trim(), project.userId);
      await storage.grantBucketAccess(bucket.id, req.params.id);
      res.json(bucket);
    } catch {
      res.status(500).json({ error: "Failed to create bucket", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/buckets", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const buckets = await storage.listProjectBuckets(req.params.id);
      res.json(buckets);
    } catch {
      res.status(500).json({ error: "Failed to list buckets", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/buckets/owned", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const allBuckets = await storage.listBuckets(req.session.userId!);
      const projectBuckets = await storage.listProjectBuckets(req.params.id);
      const projectBucketIds = new Set(projectBuckets.map(b => b.id));
      const unlinked = allBuckets.filter(b => !projectBucketIds.has(b.id));
      res.json(unlinked);
    } catch {
      res.status(500).json({ error: "Failed to list owned buckets", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/projects/:id/storage/buckets/:bucketId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketAccess(req.params.bucketId, req.params.id)) return res.status(403).json({ error: "Bucket not accessible to this project", code: "FORBIDDEN" });
      const bucket = await storage.getBucket(req.params.bucketId);
      if (!bucket) return res.status(404).json({ error: "Bucket not found", code: "BUCKET_NOT_FOUND" });
      const accessList = await storage.getBucketAccessList(bucket.id);
      res.json({ ...bucket, accessList });
    } catch {
      res.status(500).json({ error: "Failed to get bucket", code: "INTERNAL_ERROR" });
    }
  });

  app.delete("/api/projects/:id/storage/buckets/:bucketId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketOwnership(req.params.bucketId, req.session.userId!)) return res.status(403).json({ error: "Only bucket owner can delete", code: "FORBIDDEN" });
      await storage.deleteBucket(req.params.bucketId);
      res.json({ message: "Bucket deleted" });
    } catch {
      res.status(500).json({ error: "Failed to delete bucket", code: "INTERNAL_ERROR" });
    }
  });

  app.put("/api/projects/:id/storage/buckets/:bucketId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketOwnership(req.params.bucketId, req.session.userId!)) return res.status(403).json({ error: "Only bucket owner can rename", code: "FORBIDDEN" });
      const { name } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "Name is required", code: "INVALID_INPUT" });
      const bucket = await storage.renameBucket(req.params.bucketId, name.trim());
      if (!bucket) return res.status(404).json({ error: "Bucket not found", code: "BUCKET_NOT_FOUND" });
      res.json(bucket);
    } catch {
      res.status(500).json({ error: "Failed to rename bucket", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/grant", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      if (!await verifyBucketOwnership(req.params.bucketId, req.session.userId!)) return res.status(403).json({ error: "Only bucket owner can grant access", code: "FORBIDDEN" });
      const { projectId } = req.body;
      if (!projectId) return res.status(400).json({ error: "projectId is required", code: "INVALID_INPUT" });
      const access = await storage.grantBucketAccess(req.params.bucketId, projectId);
      res.json(access);
    } catch {
      res.status(500).json({ error: "Failed to grant access", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/:bucketId/revoke", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const { projectId: targetProjectId } = req.body;
      if (!targetProjectId) return res.status(400).json({ error: "projectId is required", code: "INVALID_INPUT" });
      if (targetProjectId === req.params.id) {
        await storage.revokeBucketAccess(req.params.bucketId, targetProjectId);
        return res.json({ message: "Access revoked" });
      }
      if (!await verifyBucketOwnership(req.params.bucketId, req.session.userId!)) {
        return res.status(403).json({ error: "Only bucket owner can revoke other projects' access", code: "FORBIDDEN" });
      }
      await storage.revokeBucketAccess(req.params.bucketId, targetProjectId);
      res.json({ message: "Access revoked" });
    } catch {
      res.status(500).json({ error: "Failed to revoke access", code: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/projects/:id/storage/buckets/add-existing", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      const { bucketId } = req.body;
      if (!bucketId) return res.status(400).json({ error: "bucketId is required", code: "INVALID_INPUT" });
      const bucket = await storage.getBucket(bucketId);
      if (!bucket) return res.status(404).json({ error: "Bucket not found", code: "BUCKET_NOT_FOUND" });
      if (bucket.ownerUserId !== req.session.userId!) return res.status(403).json({ error: "Only bucket owner can add it to projects", code: "FORBIDDEN" });
      const access = await storage.grantBucketAccess(bucketId, req.params.id);
      res.json({ bucket, access });
    } catch {
      res.status(500).json({ error: "Failed to add bucket", code: "INTERNAL_ERROR" });
    }
  });

}
