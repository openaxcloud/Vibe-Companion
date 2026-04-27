// AUTO-EXTRACTED from server/routes.ts (lines 11480-11744)
// Original section: integrations
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


export async function registerIntegrationsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- INTEGRATIONS ---
  app.get("/api/integrations/catalog", requireAuth, async (_req: Request, res: Response) => {
    try {
      const catalog = await storage.getIntegrationCatalog();
      res.json(catalog);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integration catalog" });
    }
  });

  app.get("/api/projects/:id/integrations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const integrations = await storage.getProjectIntegrations(req.params.id);
      res.json(integrations);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integrations" });
    }
  });

  app.post("/api/projects/:id/integrations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const schema = z.object({
        integrationId: z.string(),
        config: z.record(z.string()).default({}),
      });
      const data = schema.parse(req.body);

      const catalogEntry = (await storage.getIntegrationCatalog()).find(c => c.id === data.integrationId);
      const integrationName = catalogEntry?.name || "Unknown";

      const pi = await storage.connectIntegration(req.params.id, data.integrationId, data.config);
      await storage.addIntegrationLog(pi.id, "info", `Integration "${integrationName}" added, verifying credentials...`);

      const testResult = await testIntegrationConnection(integrationName, data.config);
      if (testResult.success) {
        await storage.updateIntegrationStatus(pi.id, "connected");
        await storage.addIntegrationLog(pi.id, "info", `Connection verified: ${testResult.message}`);
      } else if (testResult.noLiveTest) {
        await storage.updateIntegrationStatus(pi.id, "unverified");
        await storage.addIntegrationLog(pi.id, "warn", `${testResult.message}`);
      } else {
        await storage.updateIntegrationStatus(pi.id, "error");
        await storage.addIntegrationLog(pi.id, "error", `Connection test failed: ${testResult.message}`);
      }

      const updated = (await storage.getProjectIntegrations(req.params.id)).find(i => i.id === pi.id);
      res.status(201).json(updated || pi);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err.code === "23505") return res.status(409).json({ message: "Integration already connected" });
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });

  app.post("/api/projects/:id/integrations/:integrationId/test", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const integrations = await storage.getProjectIntegrations(req.params.id);
      const pi = integrations.find(i => i.id === req.params.integrationId);
      if (!pi) return res.status(404).json({ message: "Integration not found" });

      const testResult = await testIntegrationConnection(pi.integration.name, pi.config || {});
      if (testResult.success) {
        await storage.updateIntegrationStatus(pi.id, "connected");
        await storage.addIntegrationLog(pi.id, "info", `Re-test passed: ${testResult.message}`);
      } else if (testResult.noLiveTest) {
        await storage.updateIntegrationStatus(pi.id, "unverified");
        await storage.addIntegrationLog(pi.id, "warn", `${testResult.message}`);
      } else {
        await storage.updateIntegrationStatus(pi.id, "error");
        await storage.addIntegrationLog(pi.id, "error", `Re-test failed: ${testResult.message}`);
      }
      res.json({ success: testResult.success, message: testResult.message });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to test integration" });
    }
  });

  app.delete("/api/projects/:id/integrations/:integrationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });

      const integrations = await storage.getProjectIntegrations(req.params.id);
      const pi = integrations.find(i => i.id === req.params.integrationId);
      if (pi) {
        await storage.addIntegrationLog(pi.id, "info", `Integration "${pi.integration.name}" disconnected`);
      }

      const deleted = await storage.disconnectIntegration(req.params.id, req.params.integrationId);
      if (!deleted) return res.status(404).json({ message: "Integration not found" });
      res.json({ message: "Integration disconnected" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  app.get("/api/projects/:id/integrations/:integrationId/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const logs = await storage.getIntegrationLogs(req.params.id, req.params.integrationId, 50);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integration logs" });
    }
  });

  app.get("/api/user/connections", requireAuth, async (req: Request, res: Response) => {
    try {
      const connections = await storage.getUserConnections(req.session.userId!);
      res.json(connections);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get connections" });
    }
  });

  app.delete("/api/user/connections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.disconnectUserConnection(req.session.userId!, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Connection not found" });
      res.json({ message: "Connection removed" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove connection" });
    }
  });

  app.post("/api/projects/:id/integrations/oauth/start", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const { integrationId } = z.object({ integrationId: z.string() }).parse(req.body);
      const catalog = await storage.getIntegrationCatalog();
      const entry = catalog.find(c => c.id === integrationId);
      if (!entry) return res.status(404).json({ message: "Integration not found" });
      if (entry.connectorType !== "oauth" || !entry.oauthConfig) {
        return res.status(400).json({ message: "This integration does not support OAuth" });
      }

      const { randomBytes } = await import("crypto");
      const stateToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createOAuthState({
        state: stateToken,
        userId: req.session.userId!,
        projectId: req.params.id,
        integrationId,
        expiresAt,
      });

      const oauthConfig = entry.oauthConfig as { authUrl: string; tokenUrl: string; scopes: string[] };
      const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/oauth/callback`;
      const params = new URLSearchParams({
        response_type: "code",
        client_id: `replit_${entry.name.toLowerCase().replace(/\s+/g, "_")}`,
        redirect_uri: redirectUri,
        scope: oauthConfig.scopes.join(" "),
        state: stateToken,
      });
      const authUrl = `${oauthConfig.authUrl}?${params.toString()}`;

      res.json({ authUrl, state: stateToken });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to start OAuth flow" });
    }
  });

  app.get("/api/integrations/oauth/callback", async (req: Request, res: Response) => {
    try {
      const { state, code } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).send("Invalid OAuth callback: missing state");
      }

      const stateData = await storage.validateAndConsumeOAuthState(state);
      if (!stateData) {
        return res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
      }

      const catalog = await storage.getIntegrationCatalog();
      const entry = catalog.find(c => c.id === stateData.integrationId);
      if (!entry) return res.status(400).send("Integration not found");

      const oauthConfig = entry.oauthConfig as { authUrl: string; tokenUrl: string; scopes: string[] };

      let accessToken: string | undefined;
      let refreshToken: string | undefined;
      let tokenExpiresAt: Date | undefined;
      let connectionStatus = "pending";

      if (code && typeof code === "string") {
        try {
          const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/oauth/callback`;
          const tokenResponse = await fetch(oauthConfig.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              client_id: `replit_${entry.name.toLowerCase().replace(/\s+/g, "_")}`,
            }).toString(),
            signal: AbortSignal.timeout(10000),
          });
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token;
            if (tokenData.expires_in) {
              tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
            }
            if (accessToken) {
              connectionStatus = "connected";
            }
          }
        } catch {
          connectionStatus = "error";
        }
      } else {
        connectionStatus = "connected";
      }

      await storage.createUserConnection(stateData.userId, stateData.integrationId, {
        accessToken,
        refreshToken,
        tokenExpiresAt,
        status: connectionStatus,
        metadata: { connectorName: entry.name, category: entry.category },
      });

      try {
        const pi = await storage.connectIntegration(stateData.projectId, stateData.integrationId, {
          oauth_connected: "true",
          user_connection: "true",
          connected_at: new Date().toISOString(),
        });
        await storage.updateIntegrationStatus(pi.id, connectionStatus);
        await storage.addIntegrationLog(pi.id, connectionStatus === "connected" ? "info" : "warn", 
          connectionStatus === "connected" 
            ? `OAuth connection established for "${entry.name}" (account-level)` 
            : `OAuth flow completed but token exchange ${connectionStatus === "error" ? "failed" : "is pending"} for "${entry.name}"`);
      } catch (err: any) {
        if (err.code === "23505") {
          const integrations = await storage.getProjectIntegrations(stateData.projectId);
          const existing = integrations.find(i => i.integrationId === stateData.integrationId);
          if (existing) {
            await storage.updateIntegrationStatus(existing.id, connectionStatus);
          }
        }
      }

      const oauthResult = connectionStatus === "connected" ? "success" : "error";
      res.redirect(`/?project=${stateData.projectId}&oauth=${oauthResult}&connector=${encodeURIComponent(entry.name)}`);
    } catch (err: any) {
      res.status(500).send("OAuth callback failed");
    }
  });

}
