// AUTO-EXTRACTED from server/routes.ts (lines 2374-2619)
// Original section: profile-account
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


export async function registerProfileAccountRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // NOTE: /api/user/profile, /api/user/password, /api/user/account,
  // /api/user/export, /api/user/preferences were removed from this file.
  // They are now owned by user-settings.router (mounted at /api/user via MainRouter).
  // Keeping them here caused route shadowing because legacy routes were registered
  // before MainRouter, and Express uses first-match-wins semantics.

  app.get("/api/user/agent-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const prefs = await storage.getUserPreferences(req.session.userId!);
      res.json({ agentToolsConfig: prefs?.agentToolsConfig ?? {} });
    } catch {
      res.status(500).json({ message: "Failed to get agent preferences" });
    }
  });

  app.put("/api/user/agent-preferences", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ creditAlertThreshold: z.number().min(0).max(100).optional(), agentToolsConfig: z.record(z.any()).optional() });
      const data = schema.parse(req.body);
      const updated = await storage.updateUserPreferences(req.session.userId!, data);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid preferences" });
      res.status(500).json({ message: "Failed to update agent preferences" });
    }
  });

  app.get("/api/user/pane-layout/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = String(req.params.projectId);
      const layout = await storage.getPaneLayout(req.session.userId!, projectId);
      res.json(layout);
    } catch { res.status(500).json({ message: "Failed to load pane layout" }); }
  });

  const paneNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
    z.object({
      id: z.string(),
      type: z.enum(["leaf", "split"]),
      tabs: z.array(z.string()).optional(),
      activeTab: z.string().nullable().optional(),
      direction: z.enum(["horizontal", "vertical"]).optional(),
      sizes: z.array(z.number()).optional(),
      children: z.array(paneNodeSchema).optional(),
    })
  );

  const paneLayoutSchema = z.object({
    root: paneNodeSchema,
    floatingPanes: z.array(z.object({
      id: z.string(),
      tabs: z.array(z.string()),
      activeTab: z.string().nullable(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      zIndex: z.number(),
    })),
    maximizedPaneId: z.string().nullable(),
    activePaneId: z.string(),
  });

  app.put("/api/user/pane-layout/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = String(req.params.projectId);
      const layout = paneLayoutSchema.parse(req.body);
      await storage.savePaneLayout(req.session.userId!, projectId, layout);
      res.json({ ok: true });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
        return res.status(400).json({ message: "Invalid pane layout data" });
      }
      res.status(500).json({ message: "Failed to save pane layout" });
    }
  });

  // NOTE: /api/user/export (second copy removed) — owned by user-settings.router.

}
