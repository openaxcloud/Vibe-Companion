/**
 * DEPRECATED surface — maintained for backwards compatibility only.
 * All routes here are thin proxies to the canonical UUID-based workflow storage.
 * Prefer /api/projects/:id/workflows/* (project-workflows.router.ts) for new code.
 *
 * This router is mounted at /api/workflows and no longer maintains a separate
 * integer-ID data model. All reads/writes go through the canonical `storage` module.
 *
 * SECURITY: every route requires authentication; write/run routes also verify
 * project ownership before operating on the underlying data.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { executeWorkflow, stopWorkflow } from '../workflowExecutor';
import { createLogger } from '../utils/logger';

const logger = createLogger('workflows-router');

const workflowsRouter = Router();

// ---------------------------------------------------------------------------
// Auth + ownership helpers
// ---------------------------------------------------------------------------

async function verifyWorkflowAccess(workflowId: string, userId: number): Promise<{ workflow: any; ok: boolean }> {
  const workflow = await storage.getWorkflow(workflowId);
  if (!workflow) return { workflow: null, ok: false };
  const project = await storage.getProject(workflow.projectId);
  if (!project) return { workflow, ok: false };
  if (String(project.ownerId) === String(userId)) return { workflow, ok: true };
  try {
    const collabs = await storage.getProjectCollaborators(workflow.projectId);
    const hasAccess = collabs.some((c: any) => String(c.userId) === String(userId));
    return { workflow, ok: hasAccess };
  } catch {
    return { workflow, ok: false };
  }
}

async function verifyProjectAccess(projectId: string, userId: number): Promise<boolean> {
  try {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (String(project.ownerId) === String(userId)) return true;
    const collabs = await storage.getProjectCollaborators(projectId);
    return collabs.some((c: any) => String(c.userId) === String(userId));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shape normalizer: canonical workflow+steps → legacy tasks-style response
// ---------------------------------------------------------------------------
function toTaskShape(workflow: any, steps: any[]) {
  return {
    ...workflow,
    tasks: steps.map(s => ({
      id: s.id,
      orderIndex: s.orderIndex,
      taskType: s.taskType === 'install_packages' ? 'packages' : s.taskType === 'run_workflow' ? 'workflow' : 'shell',
      command: s.command,
      targetWorkflowId: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// GET / — list workflows (auth required)
// ---------------------------------------------------------------------------
workflowsRouter.get('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (projectId) {
      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const workflows = await storage.getWorkflows(projectId);
      const withTasks = await Promise.all(workflows.map(async (w) => {
        const steps = await storage.getWorkflowSteps(w.id);
        return toTaskShape(w, steps);
      }));
      return res.json(withTasks);
    }
    res.json([]);
  } catch (error) {
    logger.error('Failed to get workflows:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — single workflow (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.get('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const steps = await storage.getWorkflowSteps(workflow.id);
    res.json(toTaskShape(workflow, steps));
  } catch (error) {
    logger.error('Failed to get workflow:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// ---------------------------------------------------------------------------
// POST / — create workflow (auth + project ownership required)
// ---------------------------------------------------------------------------
const createWorkflowSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(255),
  executionMode: z.enum(['sequential', 'parallel']).default('sequential'),
  tasks: z.array(z.object({
    taskType: z.enum(['shell', 'packages', 'workflow']),
    command: z.string().nullable().optional(),
    orderIndex: z.number().optional(),
  })).default([]),
});

workflowsRouter.post('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = createWorkflowSchema.parse(req.body);
    if (!await verifyProjectAccess(data.projectId, req.session.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const workflow = await storage.createWorkflow({
      projectId: data.projectId,
      name: data.name,
      triggerEvent: 'manual',
      executionMode: data.executionMode,
    });
    for (let i = 0; i < data.tasks.length; i++) {
      const t = data.tasks[i];
      await storage.createWorkflowStep({
        workflowId: workflow.id,
        name: `Step ${i + 1}`,
        command: t.command ?? 'echo hello',
        taskType: t.taskType === 'packages' ? 'install_packages' : t.taskType === 'workflow' ? 'run_workflow' : 'shell',
        orderIndex: t.orderIndex ?? i,
        continueOnError: false,
      });
    }
    const steps = await storage.getWorkflowSteps(workflow.id);
    res.status(201).json(toTaskShape(workflow, steps));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid workflow data', details: error.errors });
    logger.error('Failed to create workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — update workflow (auth + ownership required)
// ---------------------------------------------------------------------------
const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  executionMode: z.enum(['sequential', 'parallel']).optional(),
  enabled: z.boolean().optional(),
  tasks: z.array(z.object({
    taskType: z.enum(['shell', 'packages', 'workflow']),
    command: z.string().nullable().optional(),
    orderIndex: z.number(),
  })).optional(),
});

workflowsRouter.patch('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const data = updateWorkflowSchema.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.executionMode !== undefined) updates.executionMode = data.executionMode;
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    const updated = await storage.updateWorkflow(req.params.id, updates);
    if (data.tasks) {
      const existing = await storage.getWorkflowSteps(req.params.id);
      for (const s of existing) await storage.deleteWorkflowStep(s.id);
      for (let i = 0; i < data.tasks.length; i++) {
        const t = data.tasks[i];
        await storage.createWorkflowStep({
          workflowId: req.params.id,
          name: `Step ${i + 1}`,
          command: t.command ?? 'echo hello',
          taskType: t.taskType === 'packages' ? 'install_packages' : t.taskType === 'workflow' ? 'run_workflow' : 'shell',
          orderIndex: t.orderIndex,
          continueOnError: false,
        });
      }
    }
    const steps = await storage.getWorkflowSteps(req.params.id);
    res.json(toTaskShape(updated, steps));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid workflow data', details: error.errors });
    logger.error('Failed to update workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete workflow (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.delete('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    await storage.deleteWorkflow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/run — run workflow (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.post('/:id/run', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const result = await executeWorkflow(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Failed to run workflow:', error);
    res.status(500).json({ error: 'Failed to run workflow' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/stop — stop workflow (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.post('/:id/stop', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const stopped = stopWorkflow(req.params.id);
    res.json({ success: true, stopped });
  } catch (error) {
    logger.error('Failed to stop workflow:', error);
    res.status(500).json({ error: 'Failed to stop workflow' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/runs — run history (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.get('/:id/runs', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const runs = await storage.getWorkflowRuns(req.params.id);
    res.json(runs);
  } catch (error) {
    logger.error('Failed to get runs:', error);
    res.status(500).json({ error: 'Failed to get runs' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/steps — add step (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.post('/:id/steps', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    const { name, command, taskType, orderIndex } = req.body;
    const step = await storage.createWorkflowStep({
      workflowId: req.params.id,
      name: name || 'New Step',
      command: command || 'echo hello',
      taskType: taskType || 'shell',
      orderIndex: orderIndex ?? 0,
      continueOnError: false,
    });
    res.status(201).json(step);
  } catch (error) {
    logger.error('Failed to add step:', error);
    res.status(500).json({ error: 'Failed to add step' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/set-run-button — mark as project run button (auth + ownership required)
// ---------------------------------------------------------------------------
workflowsRouter.post('/:id/set-run-button', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { workflow, ok } = await verifyWorkflowAccess(req.params.id, req.session.userId!);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    await storage.updateProject(workflow.projectId, { selectedWorkflowId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to set run button:', error);
    res.status(500).json({ error: 'Failed to set run button' });
  }
});

export { workflowsRouter };
export default workflowsRouter;
