// AUTO-EXTRACTED from server/routes.ts (lines 16606-16675)
// Original section: ai-credential-configs
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


export async function registerAiCredentialConfigsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- AI CREDENTIAL CONFIGS ---
  app.get("/api/projects/:projectId/ai-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const configs = await storage.getAiCredentialConfigs(projectId);
      const envVars = await storage.getProjectEnvVars(projectId);
      const providers = ["openai", "anthropic", "google", "openrouter", "perplexity", "mistral"];
      const result = providers.map(p => {
        const cfg = configs.find(c => c.provider === p);
        const secretKey = BYOK_SECRET_KEYS[p];
        const hasSecretKey = secretKey ? envVars.some(ev => ev.key === secretKey) : false;
        return { provider: p, mode: cfg?.mode || "managed", hasApiKey: !!cfg?.apiKey || hasSecretKey, configured: !!cfg };
      });
      return res.json(result);
    } catch {
      return res.status(500).json({ message: "Failed to fetch AI credential configs" });
    }
  });

  app.put("/api/projects/:projectId/ai-credentials/:provider", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
      const validProviders = ["openai", "anthropic", "google", "openrouter", "perplexity", "mistral"];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      const { mode, apiKey } = z.object({
        mode: z.enum(["managed", "byok"]),
        apiKey: z.string().optional(),
      }).parse(req.body);
      if (mode === "byok" && apiKey) {
        const config = await storage.upsertAiCredentialConfig(projectId, provider, mode, apiKey);
        return res.json({ provider: config.provider, mode: config.mode, hasApiKey: !!config.apiKey });
      }
      const config = await storage.upsertAiCredentialConfig(projectId, provider, mode);
      return res.json({ provider: config.provider, mode: config.mode, hasApiKey: !!config.apiKey });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid request body" });
      return res.status(500).json({ message: "Failed to update AI credential config" });
    }
  });

  app.post("/api/projects/:projectId/ai-credentials/:provider/approve-managed", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
      const validProviders = ["openai", "anthropic", "google", "openrouter", "perplexity", "mistral"];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      const config = await storage.upsertAiCredentialConfig(projectId, provider, "managed");
      return res.json({ provider: config.provider, mode: config.mode, approved: true });
    } catch {
      return res.status(500).json({ message: "Failed to approve managed credentials" });
    }
  });

}
