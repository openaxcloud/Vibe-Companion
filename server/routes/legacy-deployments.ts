// AUTO-EXTRACTED from server/routes.ts (lines 4074-4584)
// Original section: deployments
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


export async function registerDeploymentsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- DEPLOYMENTS ---
  app.use(createDeploymentRouter());

  const deployConfigSchema = z.object({
    deploymentType: z.enum(["autoscale", "static", "reserved-vm", "scheduled"]).default("static"),
    buildCommand: z.string().max(1000).optional(),
    runCommand: z.string().max(1000).optional(),
    machineConfig: z.object({ cpu: z.number().min(0.25).max(16), ram: z.number().min(128).max(65536) }).optional(),
    maxMachines: z.number().int().min(1).max(20).optional(),
    cronExpression: z.string().max(100).optional(),
    scheduleDescription: z.string().max(500).optional(),
    jobTimeout: z.number().int().min(1).max(86400).optional(),
    publicDirectory: z.string().max(200).optional(),
    appType: z.enum(["web_server", "background_worker"]).optional(),
    deploymentSecrets: z.record(z.string().max(10000)).optional(),
    portMapping: z.number().int().min(1).max(65535).optional(),
    isPrivate: z.boolean().optional(),
    showBadge: z.boolean().optional(),
    enableFeedback: z.boolean().optional(),
    responseHeaders: z.array(z.object({ path: z.string(), name: z.string(), value: z.string() })).optional(),
    rewrites: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    createProductionDb: z.boolean().optional(),
    seedProductionDb: z.boolean().optional(),
  });

  app.get("/api/projects/:id/collaborators", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const collaborators = await storage.getProjectCollaborators(req.params.id);
      res.json(collaborators);
    } catch (err) {
      res.status(500).json({ message: "Failed to get collaborators" });
    }
  });

  app.delete("/api/projects/:id/collaborators/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(403).json({ message: "Only the project owner can remove collaborators" });
      await storage.removeProjectCollaborator(req.params.id, req.params.userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  app.post("/api/projects/:id/invite-link", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(403).json({ message: "Only the project owner can create invite links" });
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const link = await storage.createProjectInviteLink({
        projectId: req.params.id,
        token,
        createdBy: req.session.userId,
        role: ["viewer", "editor"].includes(req.body.role) ? req.body.role : "editor",
        maxUses: (typeof req.body.maxUses === "number" && Number.isInteger(req.body.maxUses) && req.body.maxUses > 0) ? req.body.maxUses : null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });
      res.json({ ...link, url: `/invite/${token}` });
    } catch (err: any) {
      log(`Error creating invite link: ${err.message}`, "routes");
      res.status(500).json({ message: "Failed to create invite link" });
    }
  });

  app.get("/api/projects/:id/invite-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
      const links = await storage.getProjectInviteLinks(req.params.id);
      res.json(links);
    } catch (err) {
      res.status(500).json({ message: "Failed to get invite links" });
    }
  });

  app.delete("/api/projects/:id/invite-links/:linkId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
      await storage.deactivateProjectInviteLink(req.params.linkId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to deactivate invite link" });
    }
  });

  app.post("/api/invite/:token/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const link = await storage.getProjectInviteLink(req.params.token);
      if (!link || !link.isActive) return res.status(404).json({ message: "Invite link not found or expired" });
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "Invite link has expired" });
      if (link.maxUses && link.useCount >= link.maxUses) return res.status(410).json({ message: "Invite link has reached its maximum uses" });

      const project = await storage.getProject(link.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.userId === req.session.userId) return res.json({ projectId: link.projectId, alreadyOwner: true });

      await storage.addProjectCollaborator({
        projectId: link.projectId,
        userId: req.session.userId || "",
        role: link.role || "editor",
        addedBy: link.createdBy,
      });
      await storage.useProjectInviteLink(req.params.token);
      res.json({ projectId: link.projectId, role: link.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get("/api/invite/:token", async (req: Request, res: Response) => {
    try {
      const link = await storage.getProjectInviteLink(req.params.token);
      if (!link || !link.isActive) return res.status(404).json({ message: "Invite link not found" });
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "Invite link has expired" });
      if (link.maxUses && link.useCount >= link.maxUses) return res.status(410).json({ message: "Invite link has reached its maximum uses" });
      const project = await storage.getProject(link.projectId);
      res.json({ projectId: link.projectId, projectName: project?.name, role: link.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to get invite info" });
    }
  });

  app.post("/api/projects/:id/deploy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      if (projectFiles.length === 0) return res.status(400).json({ message: "No files to deploy" });
      const existingDeps = await storage.getProjectDeployments(project.id);
      const version = existingDeps.length > 0 ? Math.max(...existingDeps.map(d => d.version)) + 1 : 1;

      const deployConfig = deployConfigSchema.parse(req.body || {});
      const deploymentType = deployConfig.deploymentType || "static";

      if (deploymentType === "autoscale" || deploymentType === "reserved-vm") {
        const { validatePortForDeployment } = await import("./portDetection");
        const portConfigsList = await storage.getPortConfigs(project.id);
        const validation = await validatePortForDeployment(portConfigsList, deploymentType);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
      }

      if (deployConfig.isPrivate === true) {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota || quota.plan !== "team") {
          return res.status(403).json({ message: "Private deployments require a Teams plan" });
        }
      }

      const insertData: InsertDeployment = {
        projectId: project.id,
        userId: req.session.userId!,
        version,
        deploymentType,
        buildCommand: deployConfig.buildCommand,
        runCommand: deployConfig.runCommand,
        machineConfig: deployConfig.machineConfig,
        maxMachines: deployConfig.maxMachines,
        cronExpression: deployConfig.cronExpression,
        scheduleDescription: deployConfig.scheduleDescription,
        jobTimeout: deployConfig.jobTimeout,
        publicDirectory: deployConfig.publicDirectory,
        appType: deployConfig.appType,
        deploymentSecrets: deployConfig.deploymentSecrets,
        portMapping: deployConfig.portMapping,
        isPrivate: deployConfig.isPrivate,
        showBadge: deployConfig.showBadge,
        enableFeedback: deployConfig.enableFeedback,
        responseHeaders: deployConfig.responseHeaders,
        rewrites: deployConfig.rewrites,
      };

      const deployment = await storage.createDeployment(insertData);
      import("./workflowExecutor").then(({ fireTrigger }) => fireTrigger(project.id, "on-deploy")).catch(() => {});
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);

      const build = await buildAndDeploy(
        project.id,
        project.name,
        project.language,
        projectFiles.map(f => ({ filename: f.filename, content: f.content })),
        req.session.userId!,
        deployment.id,
        version,
        (line) => {
          log(line, "deploy");
          broadcastToProject(project.id, { type: "deploy_log", line });
        },
        {
          deploymentType,
          buildCommand: deployConfig.buildCommand,
          runCommand: deployConfig.runCommand,
          machineConfig: deployConfig.machineConfig,
          maxMachines: deployConfig.maxMachines,
          cronExpression: deployConfig.cronExpression,
          scheduleDescription: deployConfig.scheduleDescription,
          jobTimeout: deployConfig.jobTimeout,
          publicDirectory: deployConfig.publicDirectory,
          appType: deployConfig.appType,
          deploymentSecrets: deployConfig.deploymentSecrets,
          portMapping: deployConfig.portMapping,
          isPrivate: deployConfig.isPrivate,
          showBadge: deployConfig.showBadge,
          enableFeedback: deployConfig.enableFeedback,
          responseHeaders: deployConfig.responseHeaders,
          rewrites: deployConfig.rewrites,
          createProductionDatabase: deployConfig.createProductionDb,
          seedProductionData: deployConfig.seedProductionDb,
        },
      );

      const deployUrl = build.url;
      if (build.status === "live") {
        await storage.demotePreviousLiveDeployments(project.id, deployment.id);
        await storage.updateProject(project.id, { isPublished: true, publishedSlug: slug });
      }
      await storage.updateDeployment(deployment.id, {
        status: build.status,
        buildLog: build.buildLog,
        url: deployUrl,
        finishedAt: new Date(),
        deploymentType,
        processPort: build.processPort || undefined,
        responseHeaders: build.config?.responseHeaders,
        rewrites: build.config?.rewrites,
      });
      await storage.trackEvent(req.session.userId!, "project_deployed", { projectId: project.id, version, deploymentType });
      if (build.status === "live") {
        createCheckpoint(project.id, req.session.userId!, "deployment", `Deployment v${version} successful`).catch(() => {});
        triggerBackupAsync(project.id, "deploy");
        createAndBroadcastNotification(req.session.userId!, {
          category: "deployment",
          title: "Deployment successful",
          message: `${project.name} v${version} is now live`,
          actionUrl: `/project/${project.id}`,
          metadata: { projectId: project.id, version, url: deployUrl },
        }).catch(() => {});
      } else if (build.status === "failed") {
        createAndBroadcastNotification(req.session.userId!, {
          category: "deployment",
          title: "Deployment failed",
          message: `${project.name} v${version} deployment failed`,
          actionUrl: `/project/${project.id}`,
          metadata: { projectId: project.id, version },
        }).catch(() => {});
      }
      return res.json({ deployment: { ...deployment, version, status: build.status, buildLog: build.buildLog, url: deployUrl, deploymentType, processPort: build.processPort }, slug, url: deployUrl, version });
    } catch (err: any) {
      log(`Deploy error: ${err.message}`, "deploy");
      return res.status(500).json({ message: "Deployment failed" });
    }
  });

  app.post("/api/projects/:id/deploy/rollback", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const { version } = z.object({ version: z.number().int().min(0) }).parse(req.body);
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const result = await rollbackDeployment(project.id, slug, version, (line) => {
        broadcastToProject(project.id, { type: "deploy_log", line });
      });
      if (!result.success) return res.status(400).json({ message: result.message });

      const deps = await storage.getProjectDeployments(project.id);
      const targetDep = deps.find(d => d.version === version);
      if (targetDep) {
        await storage.demotePreviousLiveDeployments(project.id, targetDep.id);
        await storage.updateDeployment(targetDep.id, {
          status: "live",
          processPort: result.processPort || undefined,
        });
      }

      broadcastToProject(project.id, { type: "deploy_status", status: "live", version });
      return res.json({ success: true, message: result.message, version, processPort: result.processPort });
    } catch {
      return res.status(500).json({ message: "Rollback failed" });
    }
  });

  app.get("/api/projects/:id/deploy/versions", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const versions = await listDeploymentVersions(slug);
      return res.json({ versions, slug });
    } catch {
      return res.status(500).json({ message: "Failed to fetch versions" });
    }
  });

  app.delete("/api/projects/:id/deploy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      await teardownDeployment(slug, project.id);
      await storage.updateProject(project.id, { isPublished: false, publishedSlug: undefined });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Teardown failed" });
    }
  });

  app.get("/api/projects/:id/deployments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const deps = await storage.getProjectDeployments(req.params.id);
      return res.json(deps);
    } catch {
      return res.status(500).json({ message: "Failed to fetch deployments" });
    }
  });

  app.get("/api/projects/:id/deploy/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const days = parseInt(qstr(req.query.days)) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const summary = await storage.getDeploymentAnalyticsSummary(project.id, since);
      return res.json(summary);
    } catch {
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });


  app.post("/api/deploy/schedule-to-cron", requireAuth, async (req: Request, res: Response) => {
    try {
      const { description } = z.object({ description: z.string().min(1).max(500) }).parse(req.body);
      const anthropic = new Anthropic({ apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY, baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Convert this natural language schedule description to a cron expression (5-field format: minute hour day-of-month month day-of-week). Only respond with the cron expression, nothing else.\n\nDescription: "${description}"`
        }],
      });
      const firstBlock = message.content[0];
      const cronText = (firstBlock.type === "text" ? firstBlock.text : "").trim();
      const cronMatch = cronText.match(/^[\d\*\/\-\,\s]+$/);
      const cronExpression = cronMatch ? cronText : "0 * * * *";
      return res.json({ cronExpression, description });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to convert schedule", cronExpression: "0 * * * *" });
    }
  });

  const deploySettingsSchema = z.object({
    isPrivate: z.boolean().optional(),
    showBadge: z.boolean().optional(),
    enableFeedback: z.boolean().optional(),
    responseHeaders: z.array(z.object({ path: z.string(), name: z.string(), value: z.string() })).optional(),
    rewrites: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  });

  app.patch("/api/projects/:id/deploy/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const deps = await storage.getProjectDeployments(project.id);
      const liveDep = deps.find(d => d.status === "live");
      if (!liveDep) return res.status(404).json({ message: "No active deployment" });

      const body = deploySettingsSchema.parse(req.body);

      if (body.isPrivate === true) {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota || quota.plan !== "team") {
          return res.status(403).json({ message: "Private deployments require a Teams plan" });
        }
      }

      const updates: Record<string, unknown> = {};
      if (body.isPrivate !== undefined) updates.isPrivate = body.isPrivate;
      if (body.showBadge !== undefined) updates.showBadge = body.showBadge;
      if (body.enableFeedback !== undefined) updates.enableFeedback = body.enableFeedback;
      if (body.responseHeaders !== undefined) updates.responseHeaders = body.responseHeaders;
      if (body.rewrites !== undefined) updates.rewrites = body.rewrites;
      const updated = await storage.updateDeployment(liveDep.id, updates);
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/projects/:id/deploy/health", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const health = await performHealthCheck(project.id);
      const deps = await storage.getProjectDeployments(project.id);
      const latestDep = deps[0];
      if (latestDep && health.lastCheck) {
        await storage.updateDeployment(latestDep.id, {
          lastHealthCheck: health.lastCheck,
          healthStatus: health.status,
        });
      }
      return res.json(health);
    } catch {
      return res.status(500).json({ message: "Health check failed" });
    }
  });

  app.get("/api/projects/:id/deploy/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const logs = getProcessLogs(project.id);
      return res.json({ logs });
    } catch {
      return res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/projects/:id/deploy/process", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const info = getProcessInfo(project.id);
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const liveUrl = info ? `/deployed/${slug}/` : null;
      return res.json({
        process: info ? {
          projectId: info.projectId,
          port: info.port,
          status: info.status,
          startedAt: new Date(info.startedAt || Date.now()).toISOString(),
          restartCount: info.restartCount,
          resourceLimits: {
            maxMemoryMB: info.resourceLimits?.maxMemoryMb || 512,
            maxCpuPercent: info.resourceLimits?.maxCpuPercent || 100,
          },
          resourceUsage: info.resourceUsage || null,
          healthStatus: info.healthStatus,
          pid: info.pid,
          uptime: info.uptime,
        } : null,
        liveUrl,
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch process status" });
    }
  });

  app.post("/api/projects/:id/deploy/stop", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      await stopManagedProcess(project.id);
      const deps = await storage.getProjectDeployments(project.id);
      if (deps[0]) {
        await storage.updateDeployment(deps[0].id, { status: "stopped", healthStatus: "unknown" });
      }
      broadcastToProject(project.id, { type: "deploy_status", status: "stopped" });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Stop failed" });
    }
  });

  app.post("/api/projects/:id/deploy/restart", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const managed = await restartManagedProcess(project.id);
      if (!managed) return res.status(400).json({ message: "No running process to restart" });
      broadcastToProject(project.id, { type: "deploy_status", status: managed.status, port: managed.port });
      setProcessLogCallback(project.id, (line) => {
        broadcastToProject(project.id, { type: "deploy_log", line });
      });
      return res.json({ success: true, port: managed.port, status: managed.status });
    } catch {
      return res.status(500).json({ message: "Restart failed" });
    }
  });

  app.post("/api/projects/:id/deploy/stream-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });

      const existingLogs = getProcessLogs(project.id);
      if (existingLogs.length > 0) {
        for (const line of existingLogs) {
          broadcastToProject(project.id, { type: "deploy_log", line });
        }
      }

      setProcessLogCallback(project.id, (line) => {
        broadcastToProject(project.id, { type: "deploy_log", line });
      });
      return res.json({ streaming: true, bufferedLines: existingLogs.length });
    } catch {
      return res.status(500).json({ message: "Failed to start log streaming" });
    }
  });

}
