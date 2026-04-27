// AUTO-EXTRACTED from server/routes.ts (lines 12516-12616)
// Original section: publishing-analytics
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


export async function registerPublishingAnalyticsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== PUBLISHING ANALYTICS & LOGS =====================
  app.get("/api/projects/:id/publishing/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const since = req.query.since ? new Date(qstr(req.query.since)) : undefined;
      const data = await storage.getDeploymentAnalyticsAggregated(project.id, since);
      res.json(data);
    } catch (err: any) {
      log(`[publishing] Failed to load analytics: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });

  app.get("/api/projects/:id/publishing/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const options: { errorsOnly?: boolean; search?: string; since?: Date; until?: Date; limit?: number } = {};
      if (qstr(req.query.errorsOnly) === "true") options.errorsOnly = true;
      if (req.query.search) options.search = qstr(req.query.search);
      if (req.query.since) options.since = new Date(qstr(req.query.since));
      if (req.query.until) options.until = new Date(qstr(req.query.until));
      if (req.query.limit) options.limit = parseInt(qstr(req.query.limit));
      const logs = await storage.getDeploymentLogs(project.id, options);
      res.json(logs);
    } catch (err: any) {
      log(`[publishing] Failed to load logs: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load logs" });
    }
  });

  app.get("/api/projects/:id/publishing/resources", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const since = req.query.since ? new Date(qstr(req.query.since)) : undefined;
      const snapshots = await storage.getResourceSnapshots(project.id, since);
      const realMetrics = getRealMetrics();
      res.json({ snapshots, current: realMetrics });
    } catch (err: any) {
      log(`[publishing] Failed to load resources: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load resources" });
    }
  });

  app.get("/api/projects/:id/publishing/overview", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const deployments = await storage.getProjectDeployments(project.id);
      const liveDeployment = deployments.find(d => d.status === "live");
      const slug = project.publishedSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + String(project.id).slice(0, 8);
      const processStatus = liveDeployment ? getProcessStatus(project.id) : null;
      const latestDeployment = deployments.length > 0 ? deployments.reduce((a, b) => (a.version > b.version ? a : b)) : null;
      const configSource = liveDeployment || latestDeployment;
      res.json({
        isPublished: project.isPublished,
        slug,
        url: liveDeployment?.url || `/deployed/${slug}/`,
        deploymentType: liveDeployment?.deploymentType || configSource?.deploymentType || "static",
        status: liveDeployment?.status || "none",
        version: liveDeployment?.version || 0,
        createdAt: liveDeployment?.createdAt,
        healthStatus: processStatus?.healthStatus || liveDeployment?.healthStatus || "unknown",
        processStatus: processStatus?.status || null,
        config: configSource ? {
          buildCommand: configSource.buildCommand || "",
          runCommand: configSource.runCommand || "",
          machineConfig: configSource.machineConfig || { cpu: 0.5, ram: 512 },
          maxMachines: configSource.maxMachines || 1,
          cronExpression: configSource.cronExpression || "",
          scheduleDescription: configSource.scheduleDescription || "",
          jobTimeout: configSource.jobTimeout || 300,
          publicDirectory: configSource.publicDirectory || "dist",
          appType: configSource.appType || "web_server",
          deploymentSecretKeys: Object.keys(configSource.deploymentSecrets || {}),
          portMapping: configSource.portMapping || 3000,
          isPrivate: configSource.isPrivate || false,
          showBadge: configSource.showBadge ?? true,
          enableFeedback: configSource.enableFeedback || false,
        } : null,
        history: deployments.slice(0, 10).map(d => ({
          id: d.id,
          version: d.version,
          status: d.status,
          deploymentType: d.deploymentType,
          createdAt: d.createdAt,
          finishedAt: d.finishedAt,
        })),
      });
    } catch (err: any) {
      log(`[publishing] Failed to load overview: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load overview" });
    }
  });

}
