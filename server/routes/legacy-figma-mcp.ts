// AUTO-EXTRACTED from server/routes.ts (lines 14340-14689)
// Original section: figma-mcp
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


export async function registerFigmaMcpRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- FIGMA MCP INTEGRATION ---
  const figmaConnections = new Map<string, { connected: boolean; username: string; accessToken: string; refreshToken?: string; plan: string; callsUsed: number; callsLimit: number; callsRemaining: number; connectedAt: number }>();
  const figmaOAuthStates = new Map<string, { userId: string; ts: number }>();

  const FIGMA_RATE_LIMITS: Record<string, { calls: number; period: string }> = {
    free: { calls: 6, period: "month" },
    starter: { calls: 200, period: "day" },
    pro: { calls: 200, period: "day" },
    dev: { calls: 200, period: "day" },
    enterprise: { calls: 600, period: "day" },
  };

  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of figmaOAuthStates.entries()) {
      if (now - val.ts > 10 * 60 * 1000) figmaOAuthStates.delete(key);
    }
  }, 60 * 1000);

  app.get("/api/figma/connection", requireAuth, (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const conn = figmaConnections.get(userId);
    if (!conn || !conn.connected) {
      return res.json({ connected: false });
    }
    return res.json({
      connected: true,
      username: conn.username,
      plan: conn.plan,
      callsUsed: conn.callsUsed,
      callsLimit: conn.callsLimit,
      callsRemaining: conn.callsRemaining,
    });
  });

  app.get("/api/figma/oauth/authorize", requireAuth, (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const clientId = process.env.FIGMA_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({ message: "Figma OAuth is not configured. Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET environment variables." });
    }
    const nonce = crypto.randomUUID();
    figmaOAuthStates.set(nonce, { userId, ts: Date.now() });
    const redirectUri = `${req.protocol}://${req.get("host")}/api/figma/oauth/callback`;
    const figmaAuthUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=files:read&state=${nonce}&response_type=code`;
    return res.redirect(figmaAuthUrl);
  });

  app.get("/api/figma/oauth/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.status(400).send("<html><body><script>window.close();</script><p>Missing authorization code. You can close this window.</p></body></html>");
      }

      const stateData = figmaOAuthStates.get(state as string);
      if (!stateData) {
        return res.status(400).send("<html><body><script>window.close();</script><p>Invalid or expired OAuth state. Please try again.</p></body></html>");
      }
      figmaOAuthStates.delete(state as string);

      if (Date.now() - stateData.ts > 10 * 60 * 1000) {
        return res.status(400).send("<html><body><script>window.close();</script><p>OAuth state expired. Please try again.</p></body></html>");
      }

      const userId = stateData.userId;
      const clientId = process.env.FIGMA_CLIENT_ID;
      const clientSecret = process.env.FIGMA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).send("<html><body><script>window.close();</script><p>Figma OAuth is not configured on this server.</p></body></html>");
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/figma/oauth/callback`;

      const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code as string,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "Unknown error");
        return res.status(400).send(`<html><body><script>window.close();</script><p>Figma token exchange failed: ${errText}. You can close this window.</p></body></html>`);
      }

      const tokenData = await tokenRes.json() as any;
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      if (!accessToken) {
        return res.status(400).send("<html><body><script>window.close();</script><p>No access token received from Figma. You can close this window.</p></body></html>");
      }

      let username = "Figma User";
      try {
        const meRes = await fetch("https://api.figma.com/v1/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5000),
        });
        if (meRes.ok) {
          const meData = await meRes.json() as any;
          username = meData.handle || meData.email || "Figma User";
        }
      } catch {}

      const userQuota = await storage.getUserQuota(userId);
      const plan = userQuota?.plan || "free";
      const rateLimit = FIGMA_RATE_LIMITS[plan] || FIGMA_RATE_LIMITS.free;

      figmaConnections.set(userId, {
        connected: true,
        username,
        accessToken,
        refreshToken,
        plan,
        callsUsed: 0,
        callsLimit: rateLimit.calls,
        callsRemaining: rateLimit.calls,
        connectedAt: Date.now(),
      });

      const origin = `${req.protocol}://${req.get("host")}`;
      return res.send(`<html><body><script>window.opener && window.opener.postMessage({type:'figma-connected'},'${origin}');window.close();</script><p>Connected to Figma! You can close this window.</p></body></html>`);
    } catch (err: any) {
      return res.status(500).send(`<html><body><script>window.close();</script><p>Failed to connect. You can close this window.</p></body></html>`);
    }
  });

  app.post("/api/figma/disconnect", requireAuth, (req: Request, res: Response) => {
    const userId = req.session.userId!;
    figmaConnections.delete(userId);
    return res.json({ success: true });
  });

  app.get("/api/figma/rate-limit", requireAuth, (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const conn = figmaConnections.get(userId);
    if (!conn || !conn.connected) {
      return res.json({ connected: false });
    }
    return res.json({
      plan: conn.plan,
      callsUsed: conn.callsUsed,
      callsLimit: conn.callsLimit,
      callsRemaining: conn.callsRemaining,
      rateLimits: FIGMA_RATE_LIMITS,
    });
  });

  app.get("/api/mcp/directory", requireAuth, (_req: Request, res: Response) => {
    const directory = [
      {
        id: "figma",
        name: "Figma",
        description: "Explore layers, extract design data, capture screenshots, and generate code from Figma files",
        icon: "figma",
        category: "Design",
        guideUrl: "https://modelcontextprotocol.io/integrations/figma",
        capabilities: ["getDesignContext", "getScreenshot", "getMetadata", "getVariableDefs", "generateDiagram", "getCodeConnectMap", "getCodeConnectSuggestions"],
        oauthSupported: true,
        rateLimits: FIGMA_RATE_LIMITS,
      },
      {
        id: "file-search",
        name: "File Search",
        description: "Search and find files in the project using grep and glob patterns",
        icon: "search",
        category: "Built-in",
        capabilities: ["grep_files", "find_files"],
        oauthSupported: false,
      },
      {
        id: "web-fetch",
        name: "Web Fetch",
        description: "Fetch content from URLs for analysis and reference",
        icon: "globe",
        category: "Built-in",
        capabilities: ["fetch_url"],
        oauthSupported: false,
      },
      {
        id: "database-query",
        name: "Database Query",
        description: "Execute read-only SQL queries against the project database",
        icon: "database",
        category: "Built-in",
        capabilities: ["query_database"],
        oauthSupported: false,
      },
    ];
    return res.json(directory);
  });

  app.post("/api/themes", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertThemeSchema.parse(req.body);
      const theme = await storage.createTheme(req.session.userId!, data);
      return res.status(201).json(theme);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/themes", requireAuth, async (req: Request, res: Response) => {
    try {
      const userThemes = await storage.getUserThemes(req.session.userId!);
      return res.json(userThemes);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/installed", requireAuth, async (req: Request, res: Response) => {
    try {
      const installed = await storage.getInstalledThemes(req.session.userId!);
      return res.json(installed);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/explore", async (req: Request, res: Response) => {
    try {
      const { search, baseScheme, authorId, color } = req.query;
      const results = await storage.exploreThemes({
        search: search as string,
        baseScheme: baseScheme as string,
        authorId: authorId as string,
        color: color as string,
      });
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/:id", async (req: Request, res: Response) => {
    try {
      const theme = await storage.getTheme(req.params.id);
      if (!theme) return res.status(404).json({ message: "Theme not found" });
      if (!theme.isPublished && String(theme.userId) !== String(req.session.userId)) {
        return res.status(404).json({ message: "Theme not found" });
      }
      return res.json(theme);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/themes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertThemeSchema.partial().parse(req.body);
      const theme = await storage.updateTheme(req.params.id, req.session.userId!, data);
      if (!theme) return res.status(404).json({ message: "Theme not found or not owned by you" });
      return res.json(theme);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/themes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTheme(req.params.id, req.session.userId!);
      if (!deleted) return res.status(404).json({ message: "Theme not found or not owned by you" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/themes/:id/publish", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getTheme(req.params.id);
      if (!existing || String(existing.userId) !== String(req.session.userId)) {
        return res.status(404).json({ message: "Theme not found or not owned by you" });
      }
      if (!existing.title.trim() || !existing.description.trim()) {
        return res.status(400).json({ message: "Title and description are required to publish a theme" });
      }
      const theme = await storage.publishTheme(req.params.id, req.session.userId!);
      if (!theme) return res.status(404).json({ message: "Theme not found or not owned by you" });
      return res.json(theme);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/themes/:id/unpublish", requireAuth, async (req: Request, res: Response) => {
    try {
      const theme = await storage.unpublishTheme(req.params.id, req.session.userId!);
      if (!theme) return res.status(404).json({ message: "Theme not found or not owned by you" });
      return res.json(theme);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/:id/preview", async (req: Request, res: Response) => {
    try {
      const theme = await storage.getTheme(req.params.id);
      if (!theme) return res.status(404).json({ message: "Theme not found" });
      if (!theme.isPublished && String(theme.userId) !== String(req.session.userId)) {
        return res.status(404).json({ message: "Theme not found" });
      }
      return res.json({
        id: theme.id,
        title: theme.title,
        description: theme.description,
        baseScheme: theme.baseScheme,
        globalColors: theme.globalColors,
        syntaxColors: theme.syntaxColors,
        installCount: theme.installCount,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/themes/:id/install", requireAuth, async (req: Request, res: Response) => {
    try {
      const theme = await storage.getTheme(req.params.id);
      if (!theme) return res.status(404).json({ message: "Theme not found" });
      if (!theme.isPublished && String(theme.userId) !== String(req.session.userId)) {
        return res.status(403).json({ message: "Cannot install an unpublished theme" });
      }
      const installed = await storage.installTheme(req.session.userId!, req.params.id);
      return res.json(installed);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/themes/:id/uninstall", requireAuth, async (req: Request, res: Response) => {
    try {
      const removed = await storage.uninstallTheme(req.session.userId!, req.params.id);
      if (!removed) return res.status(404).json({ message: "Theme not installed" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

}
