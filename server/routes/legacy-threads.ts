// AUTO-EXTRACTED from server/routes.ts (lines 12617-12703)
// Original section: threads
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


export async function registerThreadsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== THREADS ROUTES =====================
  app.get("/api/projects/:id/threads", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const threads = await storage.getCodeThreads(project.id);
      const threadsWithCounts = await Promise.all(threads.map(async (t) => {
        const comments = await storage.getThreadComments(t.id);
        const author = await storage.getUser(t.userId);
        return { ...t, commentCount: comments.length, authorName: author?.displayName || author?.email || "User" };
      }));
      res.json(threadsWithCounts);
    } catch { res.status(500).json({ message: "Failed to load threads" }); }
  });

  app.post("/api/projects/:id/threads", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, filename, lineNumber } = req.body;
      if (!title || !filename) return res.status(400).json({ message: "Title and filename are required" });
      const thread = await storage.createCodeThread({ projectId: project.id, userId: req.session.userId!, title, filename, lineNumber: lineNumber || null });
      res.status(201).json(thread);
    } catch { res.status(500).json({ message: "Failed to create thread" }); }
  });

  app.patch("/api/projects/:id/threads/:threadId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const data: any = {};
      if (req.body.status) data.status = req.body.status;
      if (req.body.status === "resolved") data.resolvedAt = new Date();
      if (req.body.status === "open") data.resolvedAt = null;
      const updated = await storage.updateCodeThread(req.params.threadId, data);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update thread" }); }
  });

  app.delete("/api/projects/:id/threads/:threadId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      await storage.deleteCodeThread(req.params.threadId);
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete thread" }); }
  });

  app.get("/api/projects/:id/threads/:threadId/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const comments = await storage.getThreadComments(req.params.threadId);
      const commentsWithAuthors = await Promise.all(comments.map(async (c) => {
        const author = await storage.getUser(c.userId);
        return { ...c, authorName: author?.displayName || author?.email || "User" };
      }));
      res.json(commentsWithAuthors);
    } catch { res.status(500).json({ message: "Failed to load comments" }); }
  });

  app.post("/api/projects/:id/threads/:threadId/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const comment = await storage.createThreadComment({ threadId: req.params.threadId, userId: req.session.userId!, content });
      const author = await storage.getUser(req.session.userId!);
      res.status(201).json({ ...comment, authorName: author?.displayName || author?.email || "User" });
    } catch { res.status(500).json({ message: "Failed to add comment" }); }
  });

}
