// AUTO-EXTRACTED from server/routes.ts (lines 11321-11402)
// Original section: generated-file-download
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


export async function registerGeneratedFileDownloadRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- GENERATED FILE DOWNLOAD ---
  app.get("/api/projects/:id/generated-files/:fileId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const entry = await loadGeneratedFileMeta(req.params.id, req.params.fileId);
      if (!entry) {
        return res.status(404).json({ message: "File not found" });
      }

      const { createReadStream } = await import("fs");
      const { stat } = await import("fs/promises");

      try {
        await stat(entry.storagePath);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Type", entry.mimeType);
      const encodedFilename = encodeURIComponent(entry.filename).replace(/'/g, "%27");
      res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      createReadStream(entry.storagePath).pipe(res);
    } catch {
      res.status(500).json({ message: "Download failed" });
    }
  });

  app.post("/api/projects/:id/generate-file", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { format, filename, title, sections } = req.body;

      if (!format || !["pdf", "docx", "xlsx", "csv", "pptx"].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Use pdf, docx, xlsx, csv, or pptx." });
      }
      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ message: "Filename is required" });
      }
      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ message: "At least one section is required" });
      }

      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeName || safeName.startsWith(".")) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const fileBuffer = await generateFile({ format, filename: safeName, title, sections });

      const fs = await import("fs");
      const { mkdir } = await import("fs/promises");
      const generatedDir = path.join(process.cwd(), ".storage", "generated", req.params.id);
      await mkdir(generatedDir, { recursive: true });
      const storagePath = path.join(generatedDir, `${Date.now()}_${safeName}`);
      fs.writeFileSync(storagePath, fileBuffer);

      const fileId = crypto.randomUUID();
      const mimeType = getMimeType(format);
      await persistGeneratedFileMeta(fileId, {
        projectId: req.params.id,
        filename: safeName,
        storagePath,
        mimeType,
        size: fileBuffer.length,
      });

      const downloadUrl = `/api/projects/${req.params.id}/generated-files/${fileId}/download`;

      res.json({
        filename: safeName,
        format,
        downloadUrl,
        mimeType,
        size: fileBuffer.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "File generation failed" });
    }
  });

}
