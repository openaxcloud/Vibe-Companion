// AUTO-EXTRACTED from server/routes.ts (lines 12704-12780)
// Original section: skills
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


export async function registerSkillsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== SKILLS ROUTES =====================
  app.get("/api/skills/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const skillsList = await storage.getSkills(project.id);
      res.json(skillsList);
    } catch { res.status(500).json({ message: "Failed to load skills" }); }
  });

  app.post("/api/skills/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, description, content } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "Name is required" });
      const skill = await storage.createSkill({
        projectId: project.id,
        name: name.slice(0, 200),
        description: (description || "").slice(0, 1000),
        content: (content || "").slice(0, 50000),
        isActive: true,
      });
      res.status(201).json(skill);
    } catch { res.status(500).json({ message: "Failed to create skill" }); }
  });

  app.put("/api/skills/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) return res.status(404).json({ message: "Skill not found" });
      const project = await storage.getProject(skill.projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, description, content, isActive } = req.body;
      const updateData: Partial<{ name: string; description: string; content: string; isActive: boolean }> = {};
      if (name !== undefined) updateData.name = String(name).slice(0, 200);
      if (description !== undefined) updateData.description = String(description).slice(0, 1000);
      if (content !== undefined) updateData.content = String(content).slice(0, 50000);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      const updated = await storage.updateSkill(req.params.id, updateData);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update skill" }); }
  });

  app.delete("/api/skills/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) return res.status(404).json({ message: "Skill not found" });
      const project = await storage.getProject(skill.projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      await storage.deleteSkill(req.params.id);
      res.json({ message: "Skill deleted" });
    } catch { res.status(500).json({ message: "Failed to delete skill" }); }
  });

  app.post("/api/skills/:projectId/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { filename, content } = req.body;
      if (!filename || !content) return res.status(400).json({ message: "filename and content required" });
      if (!String(filename).endsWith(".md")) return res.status(400).json({ message: "Only .md files are supported" });
      const name = String(filename).replace(/\.md$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const skill = await storage.createSkill({
        projectId: project.id,
        name: name.slice(0, 200),
        description: `Imported from ${filename}`,
        content: String(content).slice(0, 50000),
        isActive: true,
      });
      res.status(201).json(skill);
    } catch { res.status(500).json({ message: "Failed to upload skill" }); }
  });

}
