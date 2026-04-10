// AUTO-EXTRACTED from server/routes.ts (lines 6794-6869)
// Original section: demo
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


export async function registerDemoRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- DEMO ---
  app.get("/api/demo/project", async (_req: Request, res: Response) => {
    const project = await storage.getDemoProject();
    if (!project) {
      return res.status(404).json({ message: "No demo project available" });
    }
    const fileList = await storage.getFiles(project.id);
    return res.json({ project, files: fileList });
  });

  app.post("/api/demo/run", runLimiter, async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const demoUserId = `demo-${clientIp}`;
    const userCheck = checkUserRateLimit(demoUserId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const { code, language } = req.body;
    if (code === undefined || code === null || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    try {
      await acquireExecutionSlot(demoUserId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);
    const demoEnvVars: Record<string, string> = {
      REPLIT_DOMAINS: process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost",
    };
    try {
      const result = await executeCode(code, language, undefined, undefined, undefined, demoEnvVars);
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, result.exitCode !== 0);

      storage.createExecutionLog({
        userId: null,
        projectId: null,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      return res.json({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, true);
      return res.status(500).json({ message: "Execution failed" });
    } finally {
      releaseExecutionSlot(demoUserId);
    }
  });

}
