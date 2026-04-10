// AUTO-EXTRACTED from server/routes.ts (lines 10717-10772)
// Original section: app-storage-objects
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


export async function registerAppStorageObjectsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- APP STORAGE: OBJECTS ---
  const PERSISTENT_STORAGE_DIR = path.join(process.cwd(), ".storage", "objects");
  const BUCKET_STORAGE_DIR = path.join(process.cwd(), ".storage", "buckets");
  const STORAGE_UPLOAD_TEMP = path.join(process.cwd(), ".storage", "tmp");
  function getUploadLimitForPlan(plan: string): number {
    const planKey = plan as keyof typeof UPLOAD_LIMITS.objectStorageByPlan;
    return UPLOAD_LIMITS.objectStorageByPlan[planKey] || UPLOAD_LIMITS.objectStorageByPlan.free;
  }

  const maxUploadLimit = Math.max(...Object.values(UPLOAD_LIMITS.objectStorageByPlan));
  const storageUpload = multer({ dest: STORAGE_UPLOAD_TEMP, limits: { fileSize: maxUploadLimit } });
  const storageMultiUpload = multer({ dest: STORAGE_UPLOAD_TEMP, limits: { fileSize: maxUploadLimit, files: 50 } });

  async function getProjectUploadLimit(projectId: string): Promise<number> {
    const project = await storage.getProject(projectId);
    if (!project) return UPLOAD_LIMITS.objectStorageByPlan.free;
    const user = await storage.getUser(project.userId);
    if (!user) return UPLOAD_LIMITS.objectStorageByPlan.free;
    return getUploadLimitForPlan((user as any).plan || "free");
  }

  async function validateFileSizeForPlan(req: Request, res: Response, files: Express.Multer.File[]): Promise<boolean> {
    const limit = await getProjectUploadLimit(req.params.id);
    const oversized = files.filter(f => f.size > limit);
    if (oversized.length > 0) {
      const { unlink } = await import("fs/promises");
      for (const f of files) {
        try { await unlink(f.path); } catch {}
      }
      res.status(413).json({
        error: `File size exceeds plan limit of ${Math.round(limit / 1024 / 1024)}MB`,
        code: "FILE_TOO_LARGE",
        maxBytes: limit,
      });
      return false;
    }
    return true;
  }

  function sanitizeFolderPath(fp: string): string {
    const normalized = path.posix.normalize(fp).replace(/\\/g, "/");
    if (normalized.startsWith("/") || normalized.includes("..")) return "";
    return normalized.replace(/^\.\//, "").replace(/\/$/, "");
  }

  async function verifyBucketAccess(bucketId: string, projectId: string): Promise<boolean> {
    const buckets = await storage.listProjectBuckets(projectId);
    return buckets.some(b => b.id === bucketId);
  }

  async function verifyBucketOwnership(bucketId: string, userId: string): Promise<boolean> {
    const bucket = await storage.getBucket(bucketId);
    if (!bucket) return false;
    return bucket.ownerUserId === userId;
  }

}
