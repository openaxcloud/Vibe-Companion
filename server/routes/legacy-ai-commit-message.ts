// AUTO-EXTRACTED from server/routes.ts (lines 9638-9698)
// Original section: ai-commit-message
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


export async function registerAiCommitMessageRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ============ AI COMMIT MESSAGE ============
  app.post("/api/projects/:id/git/generate-commit-message", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const files = await storage.getFiles(req.params.id);
      const branch = req.body.branch || "main";

      await ensureRepoWithPersistence(req.params.id, files.map(f => ({ filename: f.filename, content: f.content })));
      const diff = await gitService.getDiff(req.params.id, branch);

      let changesSummary = "";
      if (diff.hasCommits && diff.changes.length > 0) {
        const added = diff.changes.filter(c => c.status === "added").map(c => c.filename);
        const deleted = diff.changes.filter(c => c.status === "deleted").map(c => c.filename);
        const modified = diff.changes.filter(c => c.status === "modified").map(c => c.filename);

        if (added.length) changesSummary += `Added: ${added.join(", ")}\n`;
        if (deleted.length) changesSummary += `Deleted: ${deleted.join(", ")}\n`;
        if (modified.length) {
          changesSummary += `Modified: ${modified.join(", ")}\n`;
          for (const change of diff.changes.filter(c => c.status === "modified").slice(0, 5)) {
            const oldLines = (change.oldContent || "").split("\n");
            const newLines = (change.newContent || "").split("\n");
            const addedLines = newLines.filter((l) => !oldLines.includes(l)).slice(0, 5);
            const removedLines = oldLines.filter((l) => !newLines.includes(l)).slice(0, 5);
            if (addedLines.length || removedLines.length) {
              changesSummary += `\n${change.filename}:\n`;
              removedLines.forEach((l) => { changesSummary += `- ${l.trim().slice(0, 100)}\n`; });
              addedLines.forEach((l) => { changesSummary += `+ ${l.trim().slice(0, 100)}\n`; });
            }
          }
        }
      } else if (!diff.hasCommits) {
        changesSummary = `Initial commit with files: ${files.map((f) => f.filename).join(", ")}`;
      }

      if (!changesSummary.trim()) {
        return res.json({ message: "Update project files" });
      }

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY! });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Generate a concise git commit message (max 72 chars first line, optional body) for these changes:\n\n${changesSummary.slice(0, 2000)}\n\nRespond with ONLY the commit message, no quotes or explanation.`
        }],
      });

      const message = response.content[0].type === "text" ? response.content[0].text.trim() : "Update project files";
      res.json({ message });
    } catch (err: any) {
      log(`AI commit message error: ${err.message}`, "ai");
      res.json({ message: "Update project files" });
    }
  });

}
