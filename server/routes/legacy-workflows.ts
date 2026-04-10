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

}
