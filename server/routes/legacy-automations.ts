// AUTO-EXTRACTED from server/routes.ts (lines 11791-12085)
// Original section: automations
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


export async function registerAutomationsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- AUTOMATIONS ---
  app.get("/api/projects/:id/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const list = await storage.getAutomations(req.params.id);
      const sanitized = list.map(a => ({
        ...a,
        slackBotToken: a.slackBotToken ? "****" + a.slackBotToken.slice(-4) : null,
        slackSigningSecret: a.slackSigningSecret ? "****" + a.slackSigningSecret.slice(-4) : null,
        telegramBotToken: a.telegramBotToken ? "****" + a.telegramBotToken.slice(-4) : null,
      }));
      res.json(sanitized);
    } catch {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/projects/:id/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, type, cronExpression, script, language, slackBotToken, slackSigningSecret, telegramBotToken } = req.body;
      if (!name || !type) return res.status(400).json({ message: "Name and type are required" });

      const data: Parameters<typeof storage.createAutomation>[0] = {
        projectId: req.params.id, name, type, script: script || "", language: language || "javascript",
      };
      if (type === "cron" && cronExpression) {
        const { validateCronExpression } = await import("./automationScheduler");
        if (!validateCronExpression(cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
        data.cronExpression = cronExpression;
      }
      if (type === "webhook") {
        const { generateWebhookToken } = await import("./automationScheduler");
        data.webhookToken = generateWebhookToken();
      }
      if (type === "slack") {
        if (!slackBotToken || !slackSigningSecret) return res.status(400).json({ message: "Slack bot token and signing secret are required" });
        data.slackBotToken = slackBotToken;
        data.slackSigningSecret = slackSigningSecret;
      }
      if (type === "telegram") {
        if (!telegramBotToken) return res.status(400).json({ message: "Telegram bot token is required" });
        data.telegramBotToken = telegramBotToken;
      }

      const automation = await storage.createAutomation(data);

      if (type === "cron" && cronExpression && automation.enabled) {
        const { scheduleAutomation } = await import("./automationScheduler");
        scheduleAutomation(automation.id, cronExpression);
      }
      if (type === "slack" && automation.enabled && automation.slackBotToken && automation.slackSigningSecret) {
        const { startSlackBot } = await import("./slackBot");
        startSlackBot(automation.id, automation.slackBotToken, automation.slackSigningSecret).catch(err =>
          log(`Failed to start Slack bot: ${err.message}`, "automation"));
      }
      if (type === "telegram" && automation.enabled && automation.telegramBotToken) {
        const { startTelegramBot } = await import("./telegramBot");
        startTelegramBot(automation.id, automation.telegramBotToken).catch(err =>
          log(`Failed to start Telegram bot: ${err.message}`, "automation"));
      }

      res.status(201).json(automation);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create automation" });
    }
  });

  app.patch("/api/automations/:automationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.script !== undefined) updates.script = req.body.script;
      if (req.body.language !== undefined) updates.language = req.body.language;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
      if (req.body.cronExpression !== undefined) {
        const { validateCronExpression } = await import("./automationScheduler");
        if (!validateCronExpression(req.body.cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
        updates.cronExpression = req.body.cronExpression;
      }
      if (req.body.slackBotToken !== undefined) updates.slackBotToken = req.body.slackBotToken;
      if (req.body.slackSigningSecret !== undefined) updates.slackSigningSecret = req.body.slackSigningSecret;
      if (req.body.telegramBotToken !== undefined) updates.telegramBotToken = req.body.telegramBotToken;

      const updated = await storage.updateAutomation(req.params.automationId, updates);

      const { scheduleAutomation, unscheduleAutomation, stopBotAutomation } = await import("./automationScheduler");
      if (updated && updated.type === "cron") {
        if (updated.enabled && updated.cronExpression) {
          scheduleAutomation(updated.id, updated.cronExpression);
        } else {
          unscheduleAutomation(updated.id);
        }
      }
      if (updated && updated.type === "slack") {
        const { startSlackBot, stopSlackBot } = await import("./slackBot");
        if (updated.enabled && updated.slackBotToken && updated.slackSigningSecret) {
          await startSlackBot(updated.id, updated.slackBotToken, updated.slackSigningSecret);
        } else {
          await stopSlackBot(updated.id);
        }
      }
      if (updated && updated.type === "telegram") {
        const { startTelegramBot, stopTelegramBot } = await import("./telegramBot");
        if (updated.enabled && updated.telegramBotToken) {
          await startTelegramBot(updated.id, updated.telegramBotToken);
        } else {
          await stopTelegramBot(updated.id);
        }
      }

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });

  app.get("/api/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const projects = await storage.getProjects(userId);
      const allAutomations: any[] = [];
      for (const p of projects.slice(0, 20)) {
        const autos = await storage.getAutomations(p.id);
        allAutomations.push(...autos);
      }
      res.json(allAutomations);
    } catch {
      res.json([]);
    }
  });

  app.delete("/api/automations/:automationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { unscheduleAutomation, stopBotAutomation } = await import("./automationScheduler");
      unscheduleAutomation(req.params.automationId);
      await stopBotAutomation(req.params.automationId);

      await storage.deleteAutomation(req.params.automationId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });

  app.post("/api/automations/:automationId/trigger", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      broadcastToProject(automation.projectId, {
        type: "automation_started",
        automationId: automation.id,
        name: automation.name,
        triggeredBy: "manual",
      });

      const { executeAutomation } = await import("./automationScheduler");
      let triggeredBy = "manual";
      let eventPayload: string | undefined;

      if (req.body.testMessage && (automation.type === "slack" || automation.type === "telegram")) {
        triggeredBy = `${automation.type}-test`;
        if (automation.type === "slack") {
          eventPayload = JSON.stringify({
            type: "slack_message",
            text: req.body.testMessage,
            user: "test-user",
            channel: "test-channel",
            ts: String(Date.now()),
          });
        } else {
          eventPayload = JSON.stringify({
            type: "telegram_message",
            messageId: Date.now(),
            text: req.body.testMessage,
            from: { id: 0, firstName: "Test", lastName: "User", username: "test_user" },
            chat: { id: 0, type: "private", title: undefined },
            date: Math.floor(Date.now() / 1000),
          });
        }
      }

      const result = await executeAutomation(req.params.automationId, triggeredBy, eventPayload);

      broadcastToProject(automation.projectId, {
        type: "automation_completed",
        automationId: automation.id,
        name: automation.name,
        success: result.success,
        runId: result.runId,
      });

      if (result.runId) {
        const run = await storage.getAutomationRuns(automation.id, 1);
        if (run[0]) {
          broadcastToProject(automation.projectId, {
            type: "automation_log",
            automationId: automation.id,
            runId: result.runId,
            stdout: run[0].stdout || "",
            stderr: run[0].stderr || "",
            exitCode: run[0].exitCode,
            durationMs: run[0].durationMs,
          });
        }
      }

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to trigger automation" });
    }
  });

  app.get("/api/automations/:automationId/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const runs = await storage.getAutomationRuns(req.params.automationId);
      res.json(runs);
    } catch {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.all("/api/webhooks/automation/:token", async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomationByWebhookToken(req.params.token);
      if (!automation) return res.status(404).json({ message: "Webhook not found" });
      if (!automation.enabled) return res.status(403).json({ message: "Automation is disabled" });

      const { executeAutomation } = await import("./automationScheduler");
      const result = await executeAutomation(automation.id, "webhook");
      res.json(result);
    } catch {
      res.status(500).json({ message: "Webhook execution failed" });
    }
  });

  app.post("/api/automations/test-slack", requireAuth, async (req: Request, res: Response) => {
    try {
      const { botToken, signingSecret } = req.body;
      if (!botToken || !signingSecret) return res.status(400).json({ message: "Bot token and signing secret are required" });
      const { testSlackConnection } = await import("./slackBot");
      const result = await testSlackConnection(botToken, signingSecret);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to test Slack connection" });
    }
  });

  app.post("/api/automations/test-telegram", requireAuth, async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      if (!botToken) return res.status(400).json({ message: "Bot token is required" });
      const { testTelegramConnection } = await import("./telegramBot");
      const result = await testTelegramConnection(botToken);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to test Telegram connection" });
    }
  });

  app.get("/api/automations/:automationId/bot-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      let status = automation.botStatus || "disconnected";
      if (automation.type === "slack") {
        const { getSlackBotStatus } = await import("./slackBot");
        status = getSlackBotStatus(automation.id);
      } else if (automation.type === "telegram") {
        const { getTelegramBotStatus } = await import("./telegramBot");
        status = getTelegramBotStatus(automation.id);
      }

      res.json({ status });
    } catch {
      res.status(500).json({ message: "Failed to get bot status" });
    }
  });

}
