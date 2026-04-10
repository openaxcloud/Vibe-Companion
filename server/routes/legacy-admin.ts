// AUTO-EXTRACTED from server/routes.ts (lines 2824-2959)
// Original section: admin
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


export async function registerAdminRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- ADMIN ---
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    next();
  };

  app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      const metrics = getSystemMetrics();
      return res.json({ ...summary, system: metrics });
    } catch {
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(qstr(req.query.limit)) || 50;
      const offset = parseInt(qstr(req.query.offset)) || 0;
      const { users: userList, total } = await storage.getAllUsers(limit, offset);
      const safeUsers = userList.map(u => ({
        id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl,
        emailVerified: u.emailVerified, isAdmin: u.isAdmin, createdAt: u.createdAt,
        isBanned: u.isBanned, bannedAt: u.bannedAt, banReason: u.banReason,
      }));
      return res.json({ users: safeUsers, total, limit, offset });
    } catch {
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().optional(),
        emailVerified: z.boolean().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAdmin, csrfProtection, async (req: Request, res: Response) => {
    try {
      const { password } = z.object({ password: z.string().min(6).max(128) }).parse(req.body);
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.updateUser(req.params.id, { password: hashedPassword });
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ success: true, message: "Password updated" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.put("/api/admin/users/:id/plan", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { plan } = z.object({ plan: z.enum(["free", "pro", "team"]) }).parse(req.body);
      const quota = await storage.updateUserPlan(req.params.id, plan);
      return res.json(quota);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "Cannot delete yourself" });
      await storage.deleteUser(req.params.id);
      return res.json({ message: "User deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/:id/ban", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "Cannot ban yourself" });
      const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
      const user = await storage.banUser(req.params.id, reason);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, isBanned: user.isBanned, bannedAt: user.bannedAt, banReason: user.banReason });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.post("/api/admin/users/:id/unban", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.unbanUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, isBanned: user.isBanned });
    } catch {
      return res.status(500).json({ message: "Failed to unban user" });
    }
  });

  app.get("/api/admin/users/:id/activity", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(qstr(req.query.limit)) || 50;
      const history = await storage.getLoginHistory(req.params.id, limit);
      return res.json(history);
    } catch {
      return res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  app.get("/api/admin/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const event = qstr(req.query.event) || undefined;
      const limit = parseInt(qstr(req.query.limit)) || 100;
      const events = await storage.getAnalytics({ event, limit });
      return res.json(events);
    } catch {
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/execution-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getExecutionLogs({ limit: 100 });
      return res.json(logs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch execution logs" });
    }
  });

}
