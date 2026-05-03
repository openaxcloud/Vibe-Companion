/**
 * Canonical project-scoped workflow router.
 *
 * All endpoints are under /api/projects/:id/workflows* (and related project paths).
 * This is the single authoritative surface for workflow CRUD, execution, and status.
 * Legacy non-project-scoped routes (/api/workflows/*) remain in legacy-workflows.ts
 * for backwards-compatibility only and are NOT the canonical write path.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { log } from "../index";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const workflowUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  triggerEvent: z.string().optional(),
  executionMode: z.enum(["sequential", "parallel"]).optional(),
  enabled: z.boolean().optional(),
  steps: z.array(z.object({
    name: z.string().min(1).max(100).optional(),
    command: z.string().min(1).optional(),
    taskType: z.enum(["shell", "install_packages", "run_workflow"]).optional(),
    continueOnError: z.boolean().optional(),
  })).optional(),
});

export const workflowCreateSchema = z.object({
  name: z.string().min(1).max(100),
  triggerEvent: z.string().optional(),
  executionMode: z.enum(["sequential", "parallel"]).optional(),
  steps: z.array(z.object({
    name: z.string().min(1).max(100).optional(),
    command: z.string().min(1).optional(),
    taskType: z.enum(["shell", "install_packages", "run_workflow"]).optional(),
    continueOnError: z.boolean().optional(),
  })).optional(),
});

export const fromTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
});

export const selectedWorkflowSchema = z.object({
  workflowId: z.string().uuid().nullable().optional(),
});

export const executeCommandSchema = z.object({
  command: z.string().min(1).max(4096),
  name: z.string().max(200).optional(),
  workflowId: z.string().max(200).optional(),
});

export const stopCommandSchema = z.object({
  workflowId: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Simple per-user/per-project rate limiter for run and stop operations
// ---------------------------------------------------------------------------

const _runRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRunRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _runRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    _runRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Shared state for system-command (non-canonical) execution within this module
// ---------------------------------------------------------------------------

const runningCommandProcesses = new Map<string, {
  process: any;
  command: string;
  name: string;
  startedAt: number;
}>();

// ---------------------------------------------------------------------------
// Factory — needs broadcastToProject and requireAuth from route registration ctx
// ---------------------------------------------------------------------------

export function createProjectWorkflowsRouter(ctx: {
  requireAuth: any;
  verifyProjectAccess: (projectId: string, userId: number) => Promise<boolean>;
  broadcastToProject: (projectId: string, data: any) => void;
}) {
  const { requireAuth, verifyProjectAccess, broadcastToProject } = ctx;
  const router = Router();

  // -------------------------------------------------------------------------
  // List workflows for a project
  // -------------------------------------------------------------------------
  router.get("/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
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

  // -------------------------------------------------------------------------
  // Create a new workflow
  // -------------------------------------------------------------------------
  router.post("/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = workflowCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      }
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { name, triggerEvent, executionMode, steps } = parsed.data;
      const workflow = await storage.createWorkflow({
        projectId: req.params.id,
        name,
        triggerEvent: triggerEvent ?? "manual",
        executionMode: executionMode ?? "sequential",
      });
      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          await storage.createWorkflowStep({
            workflowId: workflow.id,
            name: steps[i].name ?? `Step ${i + 1}`,
            command: steps[i].command ?? "echo 'hello'",
            taskType: steps[i].taskType ?? "shell",
            orderIndex: i,
            continueOnError: steps[i].continueOnError ?? false,
          });
        }
      }
      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Create a workflow from a built-in template
  // -------------------------------------------------------------------------
  router.post("/:id/workflows/from-template", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = fromTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { templateName } = parsed.data;
      const { WORKFLOW_TEMPLATES } = await import("../workflowExecutor");
      const template = WORKFLOW_TEMPLATES.find(t => t.name === templateName);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const workflow = await storage.createWorkflow({
        projectId: req.params.id,
        name: template.name,
        triggerEvent: template.triggerEvent,
      });
      for (let i = 0; i < template.steps.length; i++) {
        const s = template.steps[i];
        await storage.createWorkflowStep({
          workflowId: workflow.id,
          name: s.name,
          command: s.command,
          taskType: s.taskType ?? "shell",
          orderIndex: i,
        });
      }
      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create from template" });
    }
  });

  // -------------------------------------------------------------------------
  // Update workflow (name, trigger, mode, enabled) + optional steps replacement
  // -------------------------------------------------------------------------
  router.patch("/:id/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = workflowUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      }
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (workflow.projectId !== req.params.id) {
        return res.status(403).json({ message: "Workflow does not belong to this project" });
      }

      const body = parsed.data;
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.triggerEvent !== undefined) updates.triggerEvent = body.triggerEvent;
      if (body.executionMode !== undefined) updates.executionMode = body.executionMode;
      if (body.enabled !== undefined) updates.enabled = body.enabled;

      const updated = await storage.updateWorkflow(req.params.workflowId, updates);

      if (body.steps) {
        const existingSteps = await storage.getWorkflowSteps(req.params.workflowId);
        for (const s of existingSteps) await storage.deleteWorkflowStep(s.id);
        for (let i = 0; i < body.steps.length; i++) {
          const s = body.steps[i];
          await storage.createWorkflowStep({
            workflowId: req.params.workflowId,
            name: s.name ?? `Step ${i + 1}`,
            command: s.command ?? "echo 'hello'",
            taskType: s.taskType ?? "shell",
            orderIndex: i,
            continueOnError: s.continueOnError ?? false,
          });
        }
      }

      const steps = await storage.getWorkflowSteps(req.params.workflowId);
      res.json({ ...updated, steps });
    } catch {
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Delete a workflow
  // -------------------------------------------------------------------------
  router.delete("/:id/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (workflow.projectId !== req.params.id) {
        return res.status(403).json({ message: "Workflow does not belong to this project" });
      }
      await storage.deleteWorkflow(req.params.workflowId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Run a specific workflow by ID
  // -------------------------------------------------------------------------
  router.post("/:id/workflows/:workflowId/run", requireAuth, async (req: Request, res: Response) => {
    try {
      const rlKey = `run:${req.session.userId}:${req.params.id}`;
      if (!checkRunRateLimit(rlKey, 10, 60_000)) {
        return res.status(429).json({ message: "Too many workflow run requests. Please wait a moment before trying again." });
      }
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (workflow.projectId !== req.params.id) {
        return res.status(403).json({ message: "Workflow does not belong to this project" });
      }

      const { executeWorkflow } = await import("../workflowExecutor");

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
        status: result.status ?? (result.success ? "completed" : "failed"),
      });

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to run workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Stop a running canonical workflow
  // -------------------------------------------------------------------------
  router.post("/:id/workflows/:workflowId/stop", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (workflow.projectId !== req.params.id) {
        return res.status(403).json({ message: "Workflow does not belong to this project" });
      }

      const { stopWorkflow } = await import("../workflowExecutor");
      const stopped = stopWorkflow(req.params.workflowId);
      broadcastToProject(req.params.id, {
        type: "workflow_status",
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: "stopped",
      });
      res.json({ success: true, stopped, message: stopped ? "Workflow stopped" : "No running workflow found" });
    } catch {
      res.status(500).json({ message: "Failed to stop workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Aggregated run history for all workflows in a project
  // -------------------------------------------------------------------------
  router.get("/:id/workflow-runs", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflows = await storage.getWorkflows(req.params.id);
      const allRuns: any[] = [];
      for (const wf of workflows) {
        const runs = await storage.getWorkflowRuns(wf.id, 20);
        allRuns.push(...runs.map(r => ({ ...r, workflowId: wf.id, workflowName: wf.name })));
      }
      allRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      res.json({ runs: allRuns.slice(0, 50) });
    } catch {
      res.status(500).json({ message: "Failed to fetch workflow runs" });
    }
  });

  // -------------------------------------------------------------------------
  // Set the "Run" button workflow for a project
  // -------------------------------------------------------------------------
  router.put("/:id/selected-workflow", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = selectedWorkflowSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const workflowId = parsed.data.workflowId;
      if (workflowId) {
        const wf = await storage.getWorkflow(workflowId);
        if (!wf || wf.projectId !== req.params.id) {
          return res.status(400).json({ message: "Workflow not found or does not belong to this project" });
        }
      }
      await storage.updateProject(req.params.id, { selectedWorkflowId: workflowId || null });
      res.json({ success: true, selectedWorkflowId: workflowId || null });
    } catch {
      res.status(500).json({ message: "Failed to update selected workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Run the project's currently selected workflow (Run button)
  // -------------------------------------------------------------------------
  router.post("/:id/run-workflow", requireAuth, async (req: Request, res: Response) => {
    try {
      const rlKey = `run:${req.session.userId}:${req.params.id}`;
      if (!checkRunRateLimit(rlKey, 10, 60_000)) {
        return res.status(429).json({ message: "Too many workflow run requests. Please wait a moment before trying again." });
      }
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const project = await storage.getProject(req.params.id);
      if (!project?.selectedWorkflowId) {
        return res.status(400).json({ message: "No workflow assigned to Run button" });
      }
      const workflow = await storage.getWorkflow(project.selectedWorkflowId);
      if (!workflow || workflow.projectId !== req.params.id) {
        return res.status(404).json({ message: "Selected workflow not found or does not belong to this project" });
      }

      const { executeWorkflow } = await import("../workflowExecutor");

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
        status: result.status ?? (result.success ? "completed" : "failed"),
      });

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to run workflow" });
    }
  });

  // -------------------------------------------------------------------------
  // Execute an arbitrary shell command (system workflow / Run button)
  // -------------------------------------------------------------------------
  router.post("/:id/workflows/execute-command", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = executeCommandSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      const projectId = req.params.id;
      const rlKey = `cmd:${req.session.userId}:${projectId}`;
      if (!checkRunRateLimit(rlKey, 10, 60_000)) {
        return res.status(429).json({ message: "Too many command execution requests. Please wait a moment before trying again." });
      }
      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { command, name, workflowId } = parsed.data;

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

      const { fetchAllProjectSecrets } = await import("../utils/secrets");
      const envObj = await fetchAllProjectSecrets(projectId);

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
        for (const line of text.split("\n").filter((l: string) => l.length > 0)) {
          broadcastToProject(projectId, { type: "workflow_log", workflowId: wfId, workflowName: wfName, message: line, logType: "info", timestamp: Date.now() });
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        for (const line of text.split("\n").filter((l: string) => l.length > 0)) {
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
        return res.json({ success: true, runId, workflowId: wfId, status: "running", message: `${wfName} started` });
      }

      const timeout = setTimeout(() => {
        if (!finished) {
          try { proc.kill("SIGKILL"); } catch {}
          if (!res.headersSent) {
            res.json({ success: false, runId, workflowId: wfId, status: "timeout", message: "Command timed out after 120s" });
          }
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
    } catch (err: any) {
      log(`Workflow execute-command error: ${err.message}`, "workflow");
      res.status(500).json({ message: "Failed to execute command: " + (err.message || "Unknown error") });
    }
  });

  // -------------------------------------------------------------------------
  // Stop a running system-command process (system workflow / Run button)
  // -------------------------------------------------------------------------
  router.post("/:id/workflows/stop-command", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = stopCommandSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });
      const projectId = req.params.id;
      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { workflowId } = parsed.data;

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
    } catch {
      res.status(500).json({ message: "Failed to stop command" });
    }
  });

  // -------------------------------------------------------------------------
  // List currently running system-command processes for a project
  // -------------------------------------------------------------------------
  router.get("/:id/workflows/running", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }
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

  return router;
}
