// AUTO-EXTRACTED from server/routes.ts (lines 6398-6793)
// Original section: runs
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


async function getIntegrationEnvVars(projectId: string): Promise<Record<string, string>> {
  const integrations = await storage.getProjectIntegrations(projectId);
  const envVars: Record<string, string> = {};
  for (const pi of integrations) {
    if ((pi.status === "connected" || pi.status === "unverified") && pi.config) {
      for (const [k, v] of Object.entries(pi.config)) {
        if (v) envVars[k] = v;
      }
    }
  }
  return envVars;
}

export async function registerRunsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- RUNS ---
  app.post("/api/projects/:projectId/run", requireAuth, runLimiter, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const userCheck = checkUserRateLimit(userId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { code, language, fileName } = req.body;
    if (code === undefined || code === null || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    const quotaCheck = await storage.incrementExecution(userId);
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: "Daily execution limit reached. Upgrade to Pro for more." });
    }

    try {
      await acquireExecutionSlot(userId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();

    let resolvedCode = code;
    let resolvedLanguage = language;
    let configRunCommand: string | undefined;

    try {
      const { config: replitConfig } = await resolveRunCommand(
        project.id, language, code,
        { id: project.id, name: project.name, language: project.language, userId: project.userId }
      );

      const preSteps: string[] = [];
      if (replitConfig.compile) {
        const compileCmd = Array.isArray(replitConfig.compile)
          ? replitConfig.compile.join(" ") : replitConfig.compile;
        preSteps.push(compileCmd);
      }
      if (replitConfig.build) {
        const buildCmd = Array.isArray(replitConfig.build)
          ? replitConfig.build.join(" ") : replitConfig.build;
        preSteps.push(buildCmd);
      }

      if (replitConfig.run) {
        let runCmd: string;
        if (Array.isArray(replitConfig.run)) {
          runCmd = replitConfig.run.map(arg =>
            /["\s\\$`!#&|;()<>]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg
          ).join(" ");
        } else {
          runCmd = replitConfig.run;
        }
        if (preSteps.length > 0) {
          runCmd = preSteps.join(" && ") + " && " + runCmd;
        }
        configRunCommand = runCmd;
        resolvedCode = runCmd;
        resolvedLanguage = "bash";
      } else if (preSteps.length > 0) {
        configRunCommand = preSteps.join(" && ");
      }
    } catch {}

    if (configRunCommand && resolvedLanguage !== "bash") {
      try {
        const buildResult = await executeCode(configRunCommand, "bash");
        if (buildResult.exitCode !== 0) {
          broadcastToProject(project.id, {
            type: "run_log",
            message: `Build/compile step failed: ${buildResult.stderr?.slice(0, 500) || "Unknown error"}`,
            logType: "error",
            timestamp: Date.now(),
          });
        }
      } catch {}
    }

    const run = await storage.createRun(userId, {
      projectId: project.id,
      language: resolvedLanguage,
      code: resolvedCode,
    });

    const commandLabel = configRunCommand || (fileName ? `run ${fileName}` : `run ${language}`);
    const consoleRun = await storage.createConsoleRun({
      projectId: project.id,
      command: commandLabel,
    });

    broadcastToProject(project.id, {
      type: "run_status",
      runId: run.id,
      consoleRunId: consoleRun.id,
      status: "running",
    });

    res.status(202).json({ runId: run.id, consoleRunId: consoleRun.id, status: "running" });

    const codeHash = crypto.createHash("sha256").update(resolvedCode).digest("hex").slice(0, 16);

    const projectEnvVarsList = await storage.getProjectEnvVars(project.id);
    const envVarsMap: Record<string, string> = {};
    for (const ev of projectEnvVarsList) {
      envVarsMap[ev.key] = decrypt(ev.encryptedValue);
    }
    const integrationEnvVars = await getIntegrationEnvVars(project.id);
    Object.assign(envVarsMap, integrationEnvVars);

    const linkedAccountVars = await storage.getAccountEnvVarLinks(project.id);
    for (const link of linkedAccountVars) {
      if (!(link.key in envVarsMap)) {
        envVarsMap[link.key] = decrypt(link.encryptedValue);
      }
    }

    envVarsMap["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
    const user = await storage.getUser(userId);
    envVarsMap["REPLIT_USER"] = user?.displayName || user?.email || userId;

    try {
      const { envVars: configEnvVars } = await resolveRunCommand(
        project.id, resolvedLanguage, resolvedCode,
        { id: project.id, name: project.name, language: project.language, userId: project.userId }
      );
      for (const [k, v] of Object.entries(configEnvVars)) {
        if (!(k in envVarsMap)) {
          envVarsMap[k] = v;
        }
      }
    } catch {}

    const consoleLogBuffer: { id: number; text: string; type: "info" | "error" | "success" }[] = [];
    let logIdCounter = 0;
    let lastFlushLen = 0;
    const LOG_FLUSH_INTERVAL = 3000;

    const flushLogs = () => {
      if (consoleLogBuffer.length > lastFlushLen) {
        lastFlushLen = consoleLogBuffer.length;
        storage.updateConsoleRun(consoleRun.id, {
          logs: consoleLogBuffer.slice(0, 5000),
        }).catch(() => {});
      }
    };
    const flushTimer = setInterval(flushLogs, LOG_FLUSH_INTERVAL);

    try {
      const result = await executionPool.submit(userId, project.id, resolvedCode, resolvedLanguage, (message, type) => {
        consoleLogBuffer.push({ id: logIdCounter++, text: message, type });
        broadcastToProject(project.id, {
          type: "run_log",
          runId: run.id,
          message,
          logType: type,
          timestamp: Date.now(),
        });
      }, envVarsMap);
      clearInterval(flushTimer);

      const durationMs = Date.now() - startTime;
      const failed = result.exitCode !== 0;
      recordExecution(userId, clientIp, durationMs, failed);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: failed ? "failed" : "completed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        finishedAt: new Date(),
      });

      const exitMsg = failed
        ? `\x1b[31m✗ Process failed with code ${result.exitCode}\x1b[0m`
        : `\x1b[32m✓ Process exited with code ${result.exitCode}\x1b[0m`;
      consoleLogBuffer.push({ id: logIdCounter++, text: exitMsg, type: failed ? "error" : "success" });

      storage.updateConsoleRun(consoleRun.id, {
        status: failed ? "failed" : "completed",
        exitCode: result.exitCode,
        logs: consoleLogBuffer.slice(0, 5000),
        finishedAt: new Date(),
      }).catch(() => {});

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        consoleRunId: consoleRun.id,
        status: failed ? "failed" : "completed",
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      clearInterval(flushTimer);
      const durationMs = Date.now() - startTime;
      recordExecution(userId, clientIp, durationMs, true);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: 1,
        durationMs,
        securityViolation: null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: "failed",
        stderr: error.message,
        exitCode: 1,
        finishedAt: new Date(),
      });

      consoleLogBuffer.push({ id: logIdCounter++, text: error.message, type: "error" });
      consoleLogBuffer.push({ id: logIdCounter++, text: `\x1b[31m✗ Process failed with code 1\x1b[0m`, type: "error" });

      storage.updateConsoleRun(consoleRun.id, {
        status: "failed",
        exitCode: 1,
        logs: consoleLogBuffer.slice(0, 5000),
        finishedAt: new Date(),
      }).catch(() => {});

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        consoleRunId: consoleRun.id,
        status: "failed",
        exitCode: 1,
      });
    } finally {
      releaseExecutionSlot(userId);
    }
  });

  app.post("/api/projects/:projectId/debug-run", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId!) return res.status(403).json({ message: "Access denied" });

    const files = await storage.getFiles(project.id);
    if (!files || files.length === 0) return res.status(400).json({ message: "No files in project" });

    const inspectPort = getInspectPort(project.id);
    const fn = (f: any) => f.filename || f.name || '';
    const entryFile = files.find((f: any) => ["index.js","main.js","app.js","server.js","index.ts","main.ts","app.ts","server.ts","index.mjs","index.cjs"].includes(fn(f)))
      || files.find((f: any) => fn(f).endsWith(".ts") && !fn(f).endsWith(".d.ts") && !f.isDirectory)
      || files.find((f: any) => fn(f).endsWith(".js") && !f.isDirectory)
      || files.find((f: any) => fn(f).endsWith(".py") && !f.isDirectory);

    if (!entryFile) return res.status(400).json({ message: "No debuggable file found (JS, TS, or Python)" });

    const entryFilename = fn(entryFile);
    const isTS = entryFilename.endsWith(".ts") || entryFilename.endsWith(".tsx");
    const isPython = entryFilename.endsWith(".py");

    const sandboxDir = `/tmp/sandbox/${project.id}`;
    try {
      const { mkdir: mkdirP, writeFile: writeF } = await import("fs/promises");
      await mkdirP(sandboxDir, { recursive: true });
      for (const f of files) {
        if (f.content !== null && f.content !== undefined) {
          const fName = fn(f);
          const filePath = `${sandboxDir}/${fName}`;
          const dir = filePath.substring(0, filePath.lastIndexOf("/"));
          if (dir !== sandboxDir) await mkdirP(dir, { recursive: true });
          await writeF(filePath, f.content);
        }
      }
    } catch (e: any) {
      return res.status(500).json({ message: `Failed to prepare sandbox: ${e.message}` });
    }

    killInteractiveProcess(project.id);

    const { spawn } = await import("child_process");
    let proc;
    if (isPython) {
      proc = spawn("python3", ["-u", entryFilename], {
        cwd: sandboxDir,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else if (isTS) {
      proc = spawn("node", [`--inspect=0.0.0.0:${inspectPort}`, "--import", "tsx/esm", entryFilename], {
        cwd: sandboxDir,
        env: { ...process.env, NODE_ENV: "development" },
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      proc = spawn("node", [`--inspect=0.0.0.0:${inspectPort}`, entryFilename], {
        cwd: sandboxDir,
        env: { ...process.env, NODE_ENV: "development" },
        stdio: ["pipe", "pipe", "pipe"],
      });
    }

    proc.on("close", () => {
      log(`Debug process exited for project ${project.id}`, "debugger");
    });

    res.json({ status: "started", inspectPort, entryFile: entryFilename });
  });

  app.get("/api/projects/:projectId/runs", requireAuth, async (req: Request, res: Response) => {
    const runList = await storage.getRunsByProject(req.params.projectId);
    return res.json(runList);
  });

  app.get("/api/projects/:projectId/console-runs", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
    const limit = parseInt(qstr(req.query.limit)) || 50;
    const runs = await storage.getConsoleRunsByProject(project.id, limit);
    return res.json(runs);
  });

  app.post("/api/projects/:projectId/console-runs", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
    const { command } = req.body;
    if (!command) return res.status(400).json({ message: "command is required" });
    const run = await storage.createConsoleRun({ projectId: project.id, command });
    return res.status(201).json(run);
  });

  app.patch("/api/console-runs/:id", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const run = await storage.getConsoleRun(req.params.id);
    if (!run) return res.status(404).json({ message: "Console run not found" });
    const project = await storage.getProject(run.projectId);
    if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(403).json({ message: "Access denied" });
    const { status, logs, exitCode, finishedAt } = req.body;
    const validStatuses = ["running", "completed", "failed"];
    const updates: any = {};
    if (status !== undefined && validStatuses.includes(status)) updates.status = status;
    if (logs !== undefined && Array.isArray(logs)) updates.logs = logs.slice(0, 5000);
    if (exitCode !== undefined && typeof exitCode === "number") updates.exitCode = exitCode;
    if (finishedAt !== undefined) updates.finishedAt = new Date(finishedAt);
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid fields to update" });
    const updated = await storage.updateConsoleRun(run.id, updates);
    return res.json(updated);
  });

  app.post("/api/projects/:projectId/stop", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
    const cancelled = executionPool.cancelProjectExecution(project.id);
    return res.json({ stopped: cancelled });
  });

  app.delete("/api/projects/:projectId/console-runs", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
    const excludeRunId = qstr(req.query.excludeRunId) || undefined;
    await storage.clearConsoleRuns(project.id, excludeRunId);
    return res.json({ success: true });
  });

  app.get("/api/execution-metrics", requireAuth, async (req: Request, res: Response) => {
    const metrics = getExecutionMetrics(req.session.userId!);
    return res.json(metrics);
  });

  app.get("/api/projects/:projectId/poll", requireAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !project.isDemo && !await verifyProjectAccess(projectId, req.session.userId!)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const since = parseInt(qstr(req.query.since)) || 0;
    const broadcasts = recentBroadcasts.get(projectId) || [];
    const newMessages = broadcasts
      .filter(b => b.timestamp > since)
      .map(b => b.data);
    return res.json({ messages: newMessages, timestamp: Date.now() });
  });

}
