// AUTO-EXTRACTED from server/routes.ts (lines 2374-2619)
// Original section: profile-account
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


export async function registerProfileAccountRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- PROFILE & ACCOUNT MANAGEMENT ---
  app.put("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().min(1).max(50).optional(),
        avatarUrl: z.string().url().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.session.userId!, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/user/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }).parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.password) {
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      return res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.delete("/api/user/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { confirmation } = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).parse(req.body);
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      console.log(`[AUDIT] Account deletion requested by user ${userId} (${user?.email || "unknown"}) at ${new Date().toISOString()}`);
      await storage.deleteUser(userId);
      console.log(`[AUDIT] Account deleted: user ${userId} (${user?.email || "unknown"})`);
      req.session.destroy(() => {});
      return res.json({ message: "Account deleted" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Type 'DELETE MY ACCOUNT' to confirm" });
      return res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/user/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const projectsList = await storage.getProjects(userId);
      const allData: any = { user: { id: user?.id, email: user?.email, displayName: user?.displayName, createdAt: user?.createdAt }, projects: [] };
      const fileResults = await Promise.all(projectsList.map(p => storage.getFiles(p.id)));
      for (let i = 0; i < projectsList.length; i++) {
        const p = projectsList[i];
        const pFiles = fileResults[i];
        allData.projects.push({ ...p, files: pFiles.map(f => ({ filename: f.filename, content: f.content })) });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="ecode-export-${userId}.json"`);
      return res.json(allData);
    } catch {
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.get("/api/user/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const prefs = await storage.getUserPreferences(req.session.userId!);
      res.json(prefs);
    } catch { res.status(500).json({ message: "Failed to load preferences" }); }
  });

  app.put("/api/user/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const customThemeSchema = z.object({
        name: z.string(),
        colors: z.object({
          background: z.string(),
          text: z.string(),
          accent: z.string(),
          panel: z.string(),
          border: z.string(),
        }),
      });
      const schema = z.object({
        fontSize: z.number().int().min(10).max(24).optional(),
        tabSize: z.number().int().min(1).max(8).optional(),
        wordWrap: z.boolean().optional(),
        theme: z.string().optional(),
        activeThemeId: z.string().nullable().optional(),
        agentToolsConfig: z.object({
          liteMode: z.boolean().optional(),
          webSearch: z.boolean().optional(),
          appTesting: z.boolean().optional(),
          codeOptimizations: z.boolean().optional(),
          architect: z.boolean().optional(),
        }).optional(),
        keyboardShortcuts: z.record(z.string().nullable()).optional(),
        autoCloseBrackets: z.boolean().optional(),
        indentationDetection: z.boolean().optional(),
        formatPastedText: z.boolean().optional(),
        indentationChar: z.enum(["spaces", "tabs"]).optional(),
        indentationSize: z.number().int().refine(v => [2, 4, 8].includes(v)).optional(),
        minimap: z.boolean().optional(),
        multiselectModifier: z.enum(["Alt", "Ctrl", "Meta"]).optional(),
        filetreeGitStatus: z.boolean().optional(),
        semanticTokens: z.boolean().optional(),
        aiCodeCompletion: z.boolean().optional(),
        acceptSuggestionOnCommit: z.boolean().optional(),
        shellBell: z.boolean().optional(),
        automaticPreview: z.boolean().optional(),
        forwardPorts: z.boolean().optional(),
        agentAudioNotification: z.boolean().optional(),
        agentPushNotification: z.boolean().optional(),
        accessibleTerminal: z.boolean().optional(),
        customTheme: customThemeSchema.nullable().optional(),
        communityTheme: z.string().nullable().optional(),
        keyboardMode: z.boolean().optional(),
        keyboardModePromptDismissed: z.boolean().optional(),
      });
      const prefs = schema.parse(req.body);
      const updated = await storage.updateUserPreferences(req.session.userId!, prefs);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid preferences" });
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  app.get("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, username: user.username, bio: (user as any).bio || null });
    } catch {
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  app.put("/api/user/profile", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ displayName: z.string().min(1).max(100).optional(), bio: z.string().max(500).optional(), avatarUrl: z.string().url().optional() });
      const data = schema.parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { bio, ...updateData } = data;
      const updated = await storage.updateUser(user.id, updateData);
      res.json({ id: updated?.id, email: updated?.email, displayName: updated?.displayName, avatarUrl: updated?.avatarUrl });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid profile data" });
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/user/agent-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const prefs = await storage.getUserPreferences(req.session.userId!);
      res.json({ agentToolsConfig: prefs?.agentToolsConfig ?? {} });
    } catch {
      res.status(500).json({ message: "Failed to get agent preferences" });
    }
  });

  app.put("/api/user/agent-preferences", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ creditAlertThreshold: z.number().min(0).max(100).optional(), agentToolsConfig: z.record(z.any()).optional() });
      const data = schema.parse(req.body);
      const updated = await storage.updateUserPreferences(req.session.userId!, data);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid preferences" });
      res.status(500).json({ message: "Failed to update agent preferences" });
    }
  });

  app.get("/api/user/pane-layout/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = String(req.params.projectId);
      const layout = await storage.getPaneLayout(req.session.userId!, projectId);
      res.json(layout);
    } catch { res.status(500).json({ message: "Failed to load pane layout" }); }
  });

  const paneNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
    z.object({
      id: z.string(),
      type: z.enum(["leaf", "split"]),
      tabs: z.array(z.string()).optional(),
      activeTab: z.string().nullable().optional(),
      direction: z.enum(["horizontal", "vertical"]).optional(),
      sizes: z.array(z.number()).optional(),
      children: z.array(paneNodeSchema).optional(),
    })
  );

  const paneLayoutSchema = z.object({
    root: paneNodeSchema,
    floatingPanes: z.array(z.object({
      id: z.string(),
      tabs: z.array(z.string()),
      activeTab: z.string().nullable(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      zIndex: z.number(),
    })),
    maximizedPaneId: z.string().nullable(),
    activePaneId: z.string(),
  });

  app.put("/api/user/pane-layout/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = String(req.params.projectId);
      const layout = paneLayoutSchema.parse(req.body);
      await storage.savePaneLayout(req.session.userId!, projectId, layout);
      res.json({ ok: true });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
        return res.status(400).json({ message: "Invalid pane layout data" });
      }
      res.status(500).json({ message: "Failed to save pane layout" });
    }
  });

  app.get("/api/user/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      const projects = await storage.getProjects(user.id);
      res.json({
        user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, createdAt: user.createdAt },
        projects: projects.map(p => ({ id: p.id, name: p.name, language: p.language, createdAt: p.createdAt })),
        exportedAt: new Date().toISOString(),
      });
    } catch { res.json({ user: null, projects: [], exportedAt: new Date().toISOString() }); }
  });

}
