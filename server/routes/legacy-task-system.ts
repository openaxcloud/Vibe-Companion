// AUTO-EXTRACTED from server/routes.ts (lines 13555-13924)
// Original section: task-system
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
import { resolveTopAgentMode } from "./ai-helpers";
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


export async function registerTaskSystemRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== TASK SYSTEM ROUTES =====================
  const { executeTask, acceptAndExecuteTask, bulkAcceptTasks, cancelTask } = await import("./taskExecutor");
  const { mergeTaskToMain, getTaskDiff, resolveConflict } = await import("./mergeEngine");

  const taskBroadcast = (projectId: string, type: string, data: any) => {
    broadcastToProject(projectId, { type: `task_${type}`, ...data });
  };

  const taskExecutorOptions = (projectId: string) => ({
    onTaskUpdate: (task: any) => taskBroadcast(projectId, "update", { task }),
    onStepUpdate: (taskId: string, step: any) => taskBroadcast(projectId, "step_update", { taskId, step }),
    onMessage: (taskId: string, role: string, content: string) => taskBroadcast(projectId, "message", { taskId, role, content }),
  });

  app.get("/api/projects/:id/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const taskList = await storage.getProjectTasks(project.id);
      res.json(taskList);
    } catch { res.status(500).json({ message: "Failed to load tasks" }); }
  });

  app.post("/api/projects/:id/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, description, plan, dependsOn, priority } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const task = await storage.createTask({
        projectId: project.id,
        userId: req.session.userId!,
        title,
        description: description || "",
        plan: plan || [],
        dependsOn: dependsOn || [],
        priority: priority || 0,
      });
      if (plan && plan.length > 0) {
        for (let i = 0; i < plan.length; i++) {
          await storage.createTaskStep({
            taskId: task.id,
            sortOrder: i,
            title: plan[i],
          });
        }
      }
      taskBroadcast(project.id, "created", { task });
      res.status(201).json(task);
    } catch { res.status(500).json({ message: "Failed to create task" }); }
  });

  app.get("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const steps = await storage.getTaskSteps(task.id);
      const diff = task.status === "ready" ? await getTaskDiff(task.id) : [];
      res.json({ ...task, steps, diff });
    } catch { res.status(500).json({ message: "Failed to load task" }); }
  });

  app.patch("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, description, plan, status, priority } = req.body;
      const updated = await storage.updateTask(task.id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      });
      if (updated) taskBroadcast(task.projectId, "update", { task: updated });
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update task" }); }
  });

  app.delete("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status === "active") cancelTask(task.id);
      await storage.deleteTask(task.id);
      taskBroadcast(task.projectId, "deleted", { taskId: task.id });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const result = await acceptAndExecuteTask(task.id, req.session.userId!, taskExecutorOptions(task.projectId));
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to accept task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/apply", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status !== "ready") return res.status(400).json({ message: "Task is not ready for apply" });
      await storage.updateTask(task.id, { status: "applying" });
      taskBroadcast(task.projectId, "update", { task: { ...task, status: "applying" } });
      const mergeResult = await mergeTaskToMain(task.id, task.projectId);
      if (mergeResult.error) {
        await storage.updateTask(task.id, { status: "ready", errorMessage: mergeResult.error });
        const failedTask = await storage.getTask(task.id);
        if (failedTask) taskBroadcast(task.projectId, "update", { task: failedTask });
        return res.status(500).json({ message: mergeResult.error });
      }
      if (!mergeResult.success || mergeResult.conflicts.length > 0) {
        await storage.updateTask(task.id, { status: "ready", errorMessage: `${mergeResult.conflicts.length} file(s) have conflicts` });
        const conflictTask = await storage.getTask(task.id);
        if (conflictTask) taskBroadcast(task.projectId, "update", { task: conflictTask });
        return res.json({ success: false, conflicts: mergeResult.conflicts, appliedFiles: mergeResult.appliedFiles });
      }
      await storage.updateTask(task.id, { status: "done", completedAt: new Date() });
      const doneTask = await storage.getTask(task.id);
      if (doneTask) taskBroadcast(task.projectId, "update", { task: doneTask });
      broadcastToProject(task.projectId, { type: "files_changed" });
      const { success: _s, ...mergeRest } = mergeResult;
      res.json({ success: true, ...mergeRest });
    } catch { res.status(500).json({ message: "Failed to apply task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/dismiss", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status === "active") cancelTask(task.id);
      await storage.updateTask(task.id, { status: "done", result: "dismissed" });
      const dismissed = await storage.getTask(task.id);
      if (dismissed) taskBroadcast(task.projectId, "update", { task: dismissed });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to dismiss task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/resolve-conflict", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { filename, resolution, manualContent } = req.body;
      if (!filename || !resolution) return res.status(400).json({ message: "filename and resolution are required" });
      const result = await resolveConflict(task.id, task.projectId, filename, resolution, manualContent);
      if (result.success) {
        broadcastToProject(task.projectId, { type: "files_changed" });
        taskBroadcast(task.projectId, "update", { task });
      }
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to resolve conflict" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/resolve-all-conflicts", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { resolutions } = req.body;
      if (!resolutions || !Array.isArray(resolutions)) return res.status(400).json({ message: "resolutions array is required" });
      const results = [];
      for (const r of resolutions) {
        const result = await resolveConflict(task.id, task.projectId, r.filename, r.resolution, r.manualContent);
        results.push({ filename: r.filename, ...result });
      }
      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        await storage.updateTask(task.id, { status: "done", completedAt: new Date(), errorMessage: "" });
        const doneTask = await storage.getTask(task.id);
        if (doneTask) taskBroadcast(task.projectId, "update", { task: doneTask });
        broadcastToProject(task.projectId, { type: "files_changed" });
      }
      res.json({ success: allSuccess, results });
    } catch { res.status(500).json({ message: "Failed to resolve conflicts" }); }
  });

  app.get("/api/projects/:id/tasks/:taskId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const messages = await storage.getTaskMessages(task.id);
      res.json(messages);
    } catch { res.status(500).json({ message: "Failed to load messages" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const msg = await storage.addTaskMessage({ taskId: task.id, role: "user", content });
      taskBroadcast(task.projectId, "message", { taskId: task.id, role: "user", content });
      res.status(201).json(msg);
    } catch { res.status(500).json({ message: "Failed to add message" }); }
  });

  app.post("/api/projects/:id/tasks/propose", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { prompt, model } = req.body;
      if (!prompt) return res.status(400).json({ message: "Prompt is required" });

      // Resolve agent mode to pick the right model for task decomposition
      const quota = await storage.getUserQuota(req.session.userId!);
      const proposeResolved = resolveTopAgentMode(req.body, quota.plan || "free");

      const projectFiles = await storage.getFiles(project.id);
      const fileList = projectFiles.map(f => f.filename).join(", ");
      const systemPrompt = `You are a task decomposition agent. Break the user's request into discrete, parallel tasks.
Each task should be independent and executable in isolation against a copy of the project files.
The project has these files: ${fileList}
Language: ${project.language}

Return a JSON array of tasks, each with: title (string), description (string), plan (string[] of step descriptions), dependsOn (string[] of task indices like "0", "1" for tasks that must complete first).

Example format:
[
  {"title": "Add user model", "description": "Create user schema", "plan": ["Create user table schema", "Add validation"], "dependsOn": []},
  {"title": "Add user API", "description": "REST endpoints for users", "plan": ["Create GET /users", "Create POST /users"], "dependsOn": ["0"]}
]

Respond ONLY with the JSON array, no other text.`;

      const proposeModelId = proposeResolved.modelId;
      const proposeSelectedModel = model || "claude";
      const proposeProviderMap: Record<string, string> = { gemini: "google", gpt: "openai", claude: "anthropic", perplexity: "perplexity", mistral: "mistral" };
      const proposeProvider = proposeProviderMap[proposeSelectedModel] || "anthropic";

      let responseText = "";
      try {
        if (proposeProvider === "anthropic") {
          const proposeAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY! });
          const result = await proposeAnthropic.messages.create({
            model: proposeModelId,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
          });
          responseText = result.content.map((b: any) => b.type === "text" ? b.text : "").join("");
        } else {
          const proposeOpenai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY! });
          const result = await proposeOpenai.chat.completions.create({
            model: proposeModelId,
            max_tokens: 4096,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
          });
          responseText = result.choices[0]?.message?.content || "";
        }
      } catch (proposeErr: any) {
        // Fallback: try the other provider
        try {
          if (proposeProvider === "anthropic") {
            const fallbackOpenai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY! });
            const result = await fallbackOpenai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 4096,
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
            });
            responseText = result.choices[0]?.message?.content || "";
          } else {
            const fallbackAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY! });
            const result = await fallbackAnthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: "user", content: prompt }],
            });
            responseText = result.content.map((b: any) => b.type === "text" ? b.text : "").join("");
          }
        } catch {
          return res.status(500).json({ message: "AI service unavailable" });
        }
      }

      let proposedTasks: any[] = [];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) proposedTasks = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      const createdTasks = [];
      const idMap = new Map<string, string>();
      for (let i = 0; i < proposedTasks.length; i++) {
        const pt = proposedTasks[i];
        const deps = (pt.dependsOn || []).map((d: string) => idMap.get(d)).filter(Boolean) as string[];
        const task = await storage.createTask({
          projectId: project.id,
          userId: req.session.userId!,
          title: pt.title || `Task ${i + 1}`,
          description: pt.description || "",
          plan: pt.plan || [],
          dependsOn: deps,
          priority: i,
        });
        idMap.set(String(i), task.id);
        if (pt.plan && pt.plan.length > 0) {
          for (let j = 0; j < pt.plan.length; j++) {
            await storage.createTaskStep({
              taskId: task.id,
              sortOrder: j,
              title: pt.plan[j],
            });
          }
        }
        createdTasks.push(task);
      }

      taskBroadcast(project.id, "proposed", { tasks: createdTasks });
      res.json({ tasks: createdTasks });
    } catch (err: any) { res.status(500).json({ message: "Failed to propose tasks" }); }
  });

  app.post("/api/projects/:id/tasks/discard-proposed", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { taskIds } = req.body;
      if (!taskIds || !Array.isArray(taskIds)) return res.status(400).json({ message: "taskIds array is required" });
      let deleted = 0;
      for (const tid of taskIds) {
        const t = await storage.getTask(tid);
        if (t && t.projectId === project.id && t.status === "draft") {
          await storage.deleteTask(tid);
          deleted++;
        }
      }
      taskBroadcast(project.id, "discarded", { taskIds, deleted });
      res.json({ success: true, deleted });
    } catch { res.status(500).json({ message: "Failed to discard tasks" }); }
  });

  app.post("/api/projects/:id/tasks/bulk-accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { taskIds } = req.body;
      if (!taskIds || !Array.isArray(taskIds)) return res.status(400).json({ message: "taskIds array is required" });
      const validatedIds: string[] = [];
      for (const tid of taskIds) {
        const t = await storage.getTask(tid);
        if (t && t.projectId === project.id) validatedIds.push(tid);
      }
      const result = await bulkAcceptTasks(validatedIds, req.session.userId!, taskExecutorOptions(project.id));
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to bulk accept tasks" }); }
  });

}
