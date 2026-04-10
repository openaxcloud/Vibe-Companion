// AUTO-EXTRACTED from server/routes.ts (lines 2239-2305)
// Original section: replit-oauth
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


export async function registerReplitOauthRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- REPLIT OAUTH ---
  app.get("/api/auth/replit", (req: Request, res: Response) => {
    const clientId = process.env.REPLIT_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "E-Code Auth not configured" });
    const redirectUri = `${getAppUrl()}/api/auth/replit/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    if (req.query.prompt) req.session.pendingPrompt = String(req.query.prompt);
    if (req.query.outputType) req.session.pendingOutputType = String(req.query.outputType);
    const url = `https://replit.com/auth_with_repl_site?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid profile email")}&state=${state}`;
    return res.redirect(url);
  });

  app.get("/api/auth/replit/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code) return res.redirect("/auth?error=no_code");
      const savedState = req.session.oauthState;
      delete req.session.oauthState;
      if (!state || !savedState || state !== savedState) return res.redirect("/auth?error=invalid_state");
      const clientId = process.env.REPLIT_CLIENT_ID;
      const clientSecret = process.env.REPLIT_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.redirect("/auth?error=not_configured");
      const redirectUri = `${getAppUrl()}/api/auth/replit/callback`;
      const tokenRes = await fetch("https://replit.com/api/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`,
      });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) return res.redirect("/auth?error=token_failed");
      const userRes = await fetch("https://replit.com/api/v1/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
      });
      const replitUser = await userRes.json() as { id: number; username: string; email?: string; profileImageUrl?: string; firstName?: string; lastName?: string };
      const replitId = String(replitUser.id);
      let user = await storage.getUserByReplitId(replitId);
      if (!user) {
        const email = replitUser.email || `replit-${replitId}@users.replit.com`;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { replitId, avatarUrl: replitUser.profileImageUrl || existing.avatarUrl || undefined });
          user = (await storage.getUser(existing.id))!;
        } else {
          const displayName = [replitUser.firstName, replitUser.lastName].filter(Boolean).join(" ") || replitUser.username || email.split("@")[0];
          user = await storage.createUser({ email, password: "", displayName, replitId, avatarUrl: replitUser.profileImageUrl, emailVerified: true });
        }
      }
      if (user.isBanned) return res.redirect("/auth?error=banned");
      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "replit", req.headers["user-agent"] || null);
      const pendingPrompt = req.session.pendingPrompt;
      const pendingOutputType = req.session.pendingOutputType;
      delete req.session.pendingPrompt;
      delete req.session.pendingOutputType;
      let redirectUrl = "/dashboard";
      if (pendingPrompt) {
        redirectUrl += `?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${encodeURIComponent(pendingOutputType || "web")}`;
      }
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect("/auth?error=replit_failed");
    }
  });

}
