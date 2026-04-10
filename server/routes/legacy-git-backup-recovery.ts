// AUTO-EXTRACTED from server/routes.ts (lines 7748-7814)
// Original section: git-backup-recovery
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


export async function registerGitBackupRecoveryRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- GIT BACKUP & RECOVERY ---
  app.get("/api/projects/:id/git/backup-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const status = await getBackupStatus(project.id);
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to get backup status" });
    }
  });

  app.post("/api/projects/:id/git/backup", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const backup = await createBackup(project.id, "manual");
      if (!backup) return res.status(400).json({ message: "No git state to backup" });
      return res.status(201).json({ id: backup.id, version: backup.version, sizeBytes: backup.sizeBytes, trigger: backup.triggerType, createdAt: backup.createdAt });
    } catch (err) {
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to create backup" });
    }
  });

  app.post("/api/projects/:id/git/backup/restore", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { version } = z.object({ version: z.number().optional() }).parse(req.body);
      const success = await restoreFromBackup(project.id, version);
      if (!success) return res.status(404).json({ message: "No backup found to restore" });
      await persistRepoState(project.id);
      return res.json({ success: true, message: "Repository restored from backup" });
    } catch (err) {
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to restore from backup" });
    }
  });

  app.get("/api/projects/:id/git/backups", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const backups = await storage.getGitBackups(project.id);
      return res.json(backups.map(b => ({
        id: b.id,
        version: b.version,
        sizeBytes: b.sizeBytes,
        trigger: b.triggerType,
        createdAt: b.createdAt,
      })));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to list backups" });
    }
  });

  app.get("/api/admin/git/stale-backups", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { maxAgeHours } = z.object({ maxAgeHours: z.coerce.number().default(24) }).parse(req.query);
      const stale = await storage.getStaleBackupProjects(maxAgeHours);
      return res.json({ staleProjects: stale, count: stale.length });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to check stale backups" });
    }
  });

}
