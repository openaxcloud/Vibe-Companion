// AUTO-EXTRACTED from server/routes.ts (lines 16491-16605)
// Original section: deployment-feedback
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


export async function registerDeploymentFeedbackRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- DEPLOYMENT FEEDBACK ---
  const FEEDBACK_ALLOWED_MIMES = new Set([
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "text/plain",
  ]);
  const feedbackUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 3 },
    fileFilter: (_req, file, cb) => {
      cb(null, FEEDBACK_ALLOWED_MIMES.has(file.mimetype));
    },
  });

  app.post("/api/feedback/:projectId", feedbackUpload.array("files", 3), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { content, visitorName, visitorEmail, pageUrl } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }
      if (content.length > 5000) {
        return res.status(400).json({ message: "Content is too long (max 5000 characters)" });
      }
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const deps = await storage.getProjectDeployments(projectId);
      const liveDep = deps.find(d => d.status === "live" && d.enableFeedback);
      if (!liveDep) {
        return res.status(403).json({ message: "Feedback is not enabled for this project" });
      }
      const attachments: string[] = [];
      const uploadedFiles = req.files as Express.Multer.File[] | undefined;
      if (uploadedFiles && uploadedFiles.length > 0) {
        const fs = await import("fs");
        const path = await import("path");
        const uploadDir = path.join(process.cwd(), "uploads", "feedback", projectId);
        await fs.promises.mkdir(uploadDir, { recursive: true });
        for (const file of uploadedFiles) {
          const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const filepath = path.join(uploadDir, filename);
          await fs.promises.writeFile(filepath, file.buffer);
          attachments.push(`/uploads/feedback/${projectId}/${filename}`);
        }
      }
      const feedback = await storage.createDeploymentFeedback({
        projectId,
        deploymentId: liveDep.id,
        content: content.trim(),
        visitorName: visitorName || null,
        visitorEmail: visitorEmail || null,
        pageUrl: pageUrl || null,
        attachments,
      });
      return res.status(201).json(feedback);
    } catch (err) {
      return res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.get("/api/projects/:projectId/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const status = qstr(req.query.status) || undefined;
      const feedback = await storage.getDeploymentFeedback(projectId, status);
      return res.json(feedback);
    } catch {
      return res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.patch("/api/projects/:projectId/feedback/:feedbackId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projectId, feedbackId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { status } = req.body;
      if (!status || !["open", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'open' or 'resolved'" });
      }
      const updated = await storage.updateDeploymentFeedbackStatus(feedbackId, projectId, status);
      if (!updated) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "Failed to update feedback" });
    }
  });

  app.delete("/api/projects/:projectId/feedback/:feedbackId", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const feedbackId = Array.isArray(req.params.feedbackId) ? req.params.feedbackId[0] : req.params.feedbackId;
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const deleted = await storage.deleteDeploymentFeedback(feedbackId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      return res.json({ message: "Feedback deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete feedback" });
    }
  });

}
