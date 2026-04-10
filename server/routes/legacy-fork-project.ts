// AUTO-EXTRACTED from server/routes.ts (lines 3936-3996)
// Original section: fork-project
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


export async function registerForkProjectRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- FORK PROJECT ---
  app.post("/api/projects/:id/fork", requireAuth, async (req: Request, res: Response) => {
    try {
      const sourceProject = await storage.getProject(req.params.id);
      if (!sourceProject) return res.status(404).json({ message: "Project not found" });
      const isOwner = sourceProject.userId === req.session.userId;
      const isAccessible = sourceProject.visibility === "public" || sourceProject.isPublished || sourceProject.isPublic;
      if (!isOwner && !isAccessible) return res.status(403).json({ message: "Cannot fork a private project" });
      const sourceFiles = await storage.getFiles(sourceProject.id);
      const userProjects = await storage.getProjects(req.session.userId!);
      const forkQuota = await storage.getUserQuota(req.session.userId!);
      const forkLimits = await storage.getPlanLimits(forkQuota.plan || "free");
      if (userProjects.length >= forkLimits.maxProjects) return res.status(403).json({ message: "Project limit reached" });
      const rawName = req.body.name || `${sourceProject.name} (fork)`;
      const forkName = sanitizeInput(rawName, 100);
      const validVisibilities = ["public", "private"];
      const requestedVisibility = validVisibilities.includes(req.body.visibility) ? req.body.visibility : "public";
      if (requestedVisibility === "private") {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota.plan || quota.plan === "free") {
          return res.status(403).json({ message: "Private projects require a Pro or Team plan. Upgrade to unlock private projects." });
        }
      }
      const newProject = await storage.createProject(req.session.userId!, {
        name: forkName,
        language: sourceProject.language,
        visibility: requestedVisibility,
        outputType: "web",
        projectType: "web-app",
      });
      if (req.body.teamId) {
        const userTeams = await storage.getUserTeams(req.session.userId!);
        const isMember = userTeams.some(t => t.id === req.body.teamId);
        if (isMember) {
          await storage.updateProject(newProject.id, { teamId: req.body.teamId });
        } else {
          return res.status(403).json({ message: "You are not a member of the specified team" });
        }
      }
      for (const file of sourceFiles) {
        if (file.filename === "ecode.md") continue;
        await storage.createFile(newProject.id, {
          filename: file.filename,
          content: file.content,
        });
      }
      const sourceEcode = sourceFiles.find(f => f.filename === "ecode.md");
      if (sourceEcode) {
        const existingEcode = (await storage.getFiles(newProject.id)).find(f => f.filename === "ecode.md");
        if (existingEcode) {
          await storage.updateFileContent(existingEcode.id, sourceEcode.content);
        }
      }
      await storage.trackEvent(req.session.userId!, "project_forked", { sourceProjectId: sourceProject.id, newProjectId: newProject.id });
      storage.incrementProjectForkCount(sourceProject.id).catch(() => {});
      return res.json(newProject);
    } catch {
      return res.status(500).json({ message: "Failed to fork project" });
    }
  });

}
