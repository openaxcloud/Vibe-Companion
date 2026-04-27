// AUTO-EXTRACTED from server/routes.ts (lines 6110-6247)
// Original section: env-vars
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


export async function registerEnvVarsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- ENV VARS ---
  async function getEnvVarAccessLevel(projectId: string, userId: string | undefined): Promise<"owner" | "collaborator" | "readonly" | "none"> {
    const project = await storage.getProject(projectId);
    if (!project) return "none";
    if (!userId) return "none";
    if (String(project.userId) === String(userId)) return "owner";
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      const teamMatch = teams.find(t => t.id === project.teamId);
      if (teamMatch) {
        if (teamMatch.role === "owner" || teamMatch.role === "admin" || teamMatch.role === "member") {
          return "collaborator";
        }
        return "readonly";
      }
    }
    if (project.visibility === "public") return "readonly";
    return "none";
  }

  app.get("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const userId = req.session.userId!;
    const accessLevel = await getEnvVarAccessLevel(req.params.projectId, userId);
    if (accessLevel === "none") {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVars = await storage.getProjectEnvVars(req.params.projectId);
    if (accessLevel === "readonly") {
      return res.json(envVars.map(ev => ({
        id: ev.id,
        projectId: ev.projectId,
        key: ev.key,
        encryptedValue: "••••••••",
        createdAt: ev.createdAt,
      })));
    }
    const decrypted = envVars.map(ev => ({
      ...ev,
      encryptedValue: decrypt(ev.encryptedValue),
    }));
    return res.json(decrypted);
  });

  app.post("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { key, value } = req.body;
    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      return res.status(400).json({ message: "key and value are required" });
    }
    const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!sanitizedKey || sanitizedKey.length > 100) {
      return res.status(400).json({ message: "Invalid key name" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    try {
      const envVar = await storage.createProjectEnvVar(req.params.projectId, sanitizedKey, value);
      return res.status(201).json({ ...envVar, encryptedValue: value });
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: `Variable "${sanitizedKey}" already exists` });
      }
      return res.status(500).json({ message: "Failed to create env var" });
    }
  });

  app.patch("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    const { value } = req.body;
    if (!value || typeof value !== "string") {
      return res.status(400).json({ message: "value is required" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    const updated = await storage.updateProjectEnvVar(req.params.id, value);
    return res.json(updated ? { ...updated, encryptedValue: value } : updated);
  });

  app.delete("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    await storage.deleteProjectEnvVar(req.params.id);
    return res.json({ message: "Env var deleted" });
  });

  app.put("/api/projects/:projectId/env-vars/bulk", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { vars } = req.body;
    if (!vars || typeof vars !== "object") {
      return res.status(400).json({ message: "vars object is required" });
    }
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value !== "string") {
        return res.status(400).json({ message: `Invalid value for key "${key}"` });
      }
      const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (!sanitizedKey || sanitizedKey.length > 100) {
        return res.status(400).json({ message: `Invalid key name: "${key}"` });
      }
    }
    try {
      const sanitizedVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(vars)) {
        sanitizedVars[key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "")] = value as string;
      }
      const results = await storage.bulkUpsertProjectEnvVars(req.params.projectId, sanitizedVars);
      const decrypted = results.map(ev => ({ ...ev, encryptedValue: decrypt(ev.encryptedValue) }));
      return res.json(decrypted);
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to bulk update env vars" });
    }
  });

}
