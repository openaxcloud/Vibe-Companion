// AUTO-EXTRACTED from server/routes.ts (lines 12086-12381)
// Original section: workflows
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


export async function registerWorkflowsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- WORKFLOWS ---
  app.get("/api/projects/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const list = await storage.getWorkflows(req.params.id);
      const withSteps = await Promise.all(list.map(async (w) => {
        const steps = await storage.getWorkflowSteps(w.id);
        return { ...w, steps };
      }));
      res.json(withSteps);
    } catch {
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/projects/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, triggerEvent, executionMode, steps } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const workflow = await storage.createWorkflow({ projectId: req.params.id, name, triggerEvent: triggerEvent || "manual", executionMode: executionMode || "sequential" });

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          await storage.createWorkflowStep({ workflowId: workflow.id, name: steps[i].name || `Step ${i + 1}`, command: steps[i].command || "echo 'hello'", taskType: steps[i].taskType || "shell", orderIndex: i, continueOnError: steps[i].continueOnError || false });
        }
      }

      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  app.post("/api/projects/:id/workflows/from-template", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { templateName } = req.body;
      const { WORKFLOW_TEMPLATES } = await import("./workflowExecutor");
      const template = WORKFLOW_TEMPLATES.find(t => t.name === templateName);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const workflow = await storage.createWorkflow({ projectId: req.params.id, name: template.name, triggerEvent: template.triggerEvent });
      for (let i = 0; i < template.steps.length; i++) {
        const s = template.steps[i] as any;
        await storage.createWorkflowStep({ workflowId: workflow.id, name: s.name, command: s.command, taskType: s.taskType || "shell", orderIndex: i });
      }

      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create from template" });
    }
  });

  app.patch("/api/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.triggerEvent !== undefined) updates.triggerEvent = req.body.triggerEvent;
      if (req.body.executionMode !== undefined) updates.executionMode = req.body.executionMode;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

      const updated = await storage.updateWorkflow(req.params.workflowId, updates);
      const steps = await storage.getWorkflowSteps(req.params.workflowId);
      res.json({ ...updated, steps });
    } catch {
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      await storage.deleteWorkflow(req.params.workflowId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  app.post("/api/workflows/:workflowId/steps", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { name, command, taskType, orderIndex, continueOnError } = req.body;
      const step = await storage.createWorkflowStep({ workflowId: req.params.workflowId, name: name || "New Step", command: command || "echo 'hello'", taskType: taskType || "shell", orderIndex: orderIndex ?? 0, continueOnError: continueOnError || false });
      res.status(201).json(step);
    } catch {
      res.status(500).json({ message: "Failed to create step" });
    }
  });

  app.patch("/api/workflow-steps/:stepId", requireAuth, async (req: Request, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.stepId);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const workflow = await storage.getWorkflow(step.workflowId);
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.command !== undefined) updates.command = req.body.command;
      if (req.body.taskType !== undefined) updates.taskType = req.body.taskType;
      if (req.body.orderIndex !== undefined) updates.orderIndex = req.body.orderIndex;
      if (req.body.continueOnError !== undefined) updates.continueOnError = req.body.continueOnError;

      const updated = await storage.updateWorkflowStep(req.params.stepId, updates);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  app.delete("/api/workflow-steps/:stepId", requireAuth, async (req: Request, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.stepId);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const workflow = await storage.getWorkflow(step.workflowId);
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      await storage.deleteWorkflowStep(req.params.stepId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete step" });
    }
  });

  app.post("/api/workflows/:workflowId/run", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { executeWorkflow } = await import("./workflowExecutor");

      broadcastToProject(workflow.projectId, {
        type: "workflow_status",
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: "running",
      });

      const onLog = (message: string, logType: "info" | "error" | "success") => {
        broadcastToProject(workflow.projectId, {
          type: "workflow_log",
          workflowId: workflow.id,
          workflowName: workflow.name,
          message,
          logType,
          timestamp: Date.now(),
        });
      };

      const result = await executeWorkflow(req.params.workflowId, undefined, onLog);

      broadcastToProject(workflow.projectId, {
        type: "workflow_status",
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: result.success ? "completed" : "failed",
      });

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to run workflow" });
    }
  });

  app.put("/api/workflows/:workflowId/steps/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { updates } = req.body;
      if (!Array.isArray(updates)) return res.status(400).json({ message: "updates array required" });

      const existingSteps = await storage.getWorkflowSteps(req.params.workflowId);
      const validIds = new Set(existingSteps.map(s => s.id));
      const sanitizedUpdates = updates.filter((u: any) => validIds.has(u.id));
      if (sanitizedUpdates.length === 0) return res.status(400).json({ message: "No valid step IDs" });

      await storage.bulkUpdateStepOrder(sanitizedUpdates);
      const steps = await storage.getWorkflowSteps(req.params.workflowId);
      res.json(steps);
    } catch {
      res.status(500).json({ message: "Failed to reorder steps" });
    }
  });

  app.put("/api/projects/:id/selected-workflow", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { workflowId } = req.body;
      if (workflowId) {
        const wf = await storage.getWorkflow(workflowId);
        if (!wf || wf.projectId !== req.params.id) return res.status(400).json({ message: "Workflow not found or does not belong to this project" });
      }
      await storage.updateProject(req.params.id, { selectedWorkflowId: workflowId || null } as any);
      res.json({ success: true, selectedWorkflowId: workflowId || null });
    } catch {
      res.status(500).json({ message: "Failed to update selected workflow" });
    }
  });

  app.post("/api/projects/:id/run-workflow", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const project = await storage.getProject(req.params.id);
      if (!project?.selectedWorkflowId) return res.status(400).json({ message: "No workflow assigned to Run button" });

      const workflow = await storage.getWorkflow(project.selectedWorkflowId);
      if (!workflow || workflow.projectId !== req.params.id) return res.status(404).json({ message: "Selected workflow not found or does not belong to this project" });

      const { executeWorkflow } = await import("./workflowExecutor");

      broadcastToProject(project.id, {
        type: "workflow_status",
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: "running",
      });

      const onLog = (message: string, logType: "info" | "error" | "success") => {
        broadcastToProject(project.id, {
          type: "workflow_log",
          workflowId: workflow.id,
          workflowName: workflow.name,
          message,
          logType,
          timestamp: Date.now(),
        });
      };

      const result = await executeWorkflow(project.selectedWorkflowId, undefined, onLog);

      broadcastToProject(project.id, {
        type: "workflow_status",
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: result.success ? "completed" : "failed",
      });

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to run workflow" });
    }
  });

  app.get("/api/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const projectId = qstr(req.query.projectId);
      if (projectId) {
        if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });
        const wfs = await storage.getWorkflows(projectId);
        return res.json(wfs);
      }
      const projects = await storage.getProjects(userId);
      const allWorkflows: any[] = [];
      for (const p of projects.slice(0, 20)) {
        const wfs = await storage.getWorkflows(p.id);
        allWorkflows.push(...wfs);
      }
      res.json(allWorkflows);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/workflows/:workflowId/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const runs = await storage.getWorkflowRuns(req.params.workflowId);
      res.json(runs);
    } catch {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.get("/api/workflow-templates", requireAuth, async (_req: Request, res: Response) => {
    const { WORKFLOW_TEMPLATES } = await import("./workflowExecutor");
    res.json(WORKFLOW_TEMPLATES);
  });

  const runningCommandProcesses = new Map<string, { process: any; command: string; name: string; startedAt: number }>();

  app.post("/api/projects/:id/workflows/execute-command", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const { command, name, workflowId } = req.body;
      if (!command || typeof command !== "string") return res.status(400).json({ message: "command is required" });

      const { spawn } = await import("child_process");
      const { materializeProjectFiles, getProjectWorkspaceDir } = await import("../terminal");
      const fsMod = await import("fs");

      const wsDir = getProjectWorkspaceDir(projectId);
      if (!fsMod.existsSync(wsDir)) {
        broadcastToProject(projectId, { type: "workflow_log", workflowId: workflowId || "cmd", workflowName: name || command, message: "Materializing project files...", logType: "info", timestamp: Date.now() });
        await materializeProjectFiles(projectId, () => storage.getFiles(projectId));
      }

      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const wfName = name || command;
      const wfId = workflowId || `cmd-${runId}`;

      const existingProc = runningCommandProcesses.get(`${projectId}:${wfId}`);
      if (existingProc) {
        try { existingProc.process.kill("SIGTERM"); } catch {}
        runningCommandProcesses.delete(`${projectId}:${wfId}`);
      }

      broadcastToProject(projectId, { type: "workflow_status", workflowId: wfId, workflowName: wfName, status: "running" });
      broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: `\x1b[36m$ ${command}\x1b[0m`, logType: "info", timestamp: Date.now() });

      const isLongRunning = /\b(dev|start|serve|watch|preview)\b/.test(command);

      const envVars = await storage.getProjectEnvVars(projectId);
      const envObj: Record<string, string> = {};
      for (const ev of envVars) {
        try {
          envObj[ev.key] = ev.encryptedValue ? decrypt(ev.encryptedValue) : ev.value || "";
        } catch {
          envObj[ev.key] = ev.value || "";
        }
      }

      const safeEnv: Record<string, string> = {
        HOME: wsDir,
        PATH: `${wsDir}/node_modules/.bin:/usr/local/bin:/usr/bin:/bin`,
        NODE_ENV: "development",
        LANG: "en_US.UTF-8",
        TERM: "xterm-256color",
        SHELL: "/bin/bash",
        TMPDIR: `${wsDir}/.tmp`,
        NODE_PATH: `${wsDir}/node_modules`,
        npm_config_prefix: wsDir,
      };
      if (process.env.NVM_DIR) safeEnv.NVM_DIR = process.env.NVM_DIR;
      if (process.env.NIX_PATH) safeEnv.NIX_PATH = process.env.NIX_PATH;
      for (const [k, v] of Object.entries(envObj)) { safeEnv[k] = v; }

      const proc = spawn("bash", ["-c", command], {
        cwd: wsDir,
        env: safeEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });

      runningCommandProcesses.set(`${projectId}:${wfId}`, { process: proc, command, name: wfName, startedAt: Date.now() });

      let stdout = "";
      let stderr = "";
      let finished = false;

      proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        const lines = text.split("\n").filter((l: string) => l.length > 0);
        for (const line of lines) {
          broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: line, logType: "info", timestamp: Date.now() });
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        const lines = text.split("\n").filter((l: string) => l.length > 0);
        for (const line of lines) {
          broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: line, logType: "error", timestamp: Date.now() });
        }
      });

      proc.on("close", (exitCode: number | null) => {
        finished = true;
        runningCommandProcesses.delete(`${projectId}:${wfId}`);
        const success = exitCode === 0;
        broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: `\x1b[${success ? "32" : "31"}m━━━ ${wfName} ${success ? "completed successfully" : `exited with code ${exitCode}`} ━━━\x1b[0m`, logType: success ? "success" : "error", timestamp: Date.now() });
        broadcastToProject(projectId, { type: "workflow_status", workflowId: wfId, workflowName: wfName, status: success ? "completed" : "failed", exitCode });
      });

      proc.on("error", (err: any) => {
        finished = true;
        runningCommandProcesses.delete(`${projectId}:${wfId}`);
        broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: `Process error: ${err.message}`, logType: "error", timestamp: Date.now() });
        broadcastToProject(projectId, { type: "workflow_status", workflowId: wfId, workflowName: wfName, status: "failed" });
      });

      if (isLongRunning) {
        res.json({ success: true, runId, workflowId: wfId, status: "running", message: `${wfName} started` });
      } else {
        const timeout = setTimeout(() => {
          if (!finished) {
            try { proc.kill("SIGKILL"); } catch {}
            res.json({ success: false, runId, workflowId: wfId, status: "timeout", message: "Command timed out after 120s" });
          }
        }, 120000);

        proc.on("close", (exitCode: number | null) => {
          clearTimeout(timeout);
          if (!res.headersSent) {
            res.json({ success: exitCode === 0, runId, workflowId: wfId, status: exitCode === 0 ? "completed" : "failed", exitCode, stdout: stdout.slice(-4096), stderr: stderr.slice(-4096) });
          }
        });

        proc.on("error", (err: any) => {
          clearTimeout(timeout);
          if (!res.headersSent) {
            res.json({ success: false, runId, workflowId: wfId, status: "failed", message: err.message });
          }
        });
      }
    } catch (err: any) {
      log(`Workflow execute-command error: ${err.message}`, "workflow");
      res.status(500).json({ message: "Failed to execute command: " + (err.message || "Unknown error") });
    }
  });

  app.post("/api/projects/:id/workflows/stop-command", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const { workflowId } = req.body;
      if (!workflowId) return res.status(400).json({ message: "workflowId is required" });

      const key = `${projectId}:${workflowId}`;
      const entry = runningCommandProcesses.get(key);
      if (!entry) return res.json({ success: true, message: "No running process found" });

      try { entry.process.kill("SIGTERM"); } catch {}
      setTimeout(() => {
        try { if (!entry.process.killed) entry.process.kill("SIGKILL"); } catch {}
      }, 3000);
      runningCommandProcesses.delete(key);

      broadcastToProject(projectId, { type: "workflow_status", workflowId, workflowName: entry.name, status: "stopped" });
      res.json({ success: true, message: "Process stopped" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to stop command" });
    }
  });

  app.get("/api/projects/:id/workflows/running", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const running: any[] = [];
      for (const [key, entry] of runningCommandProcesses.entries()) {
        if (key.startsWith(`${projectId}:`)) {
          running.push({ workflowId: key.split(":")[1], command: entry.command, name: entry.name, startedAt: entry.startedAt, durationMs: Date.now() - entry.startedAt });
        }
      }
      res.json(running);
    } catch {
      res.json([]);
    }
  });

}
