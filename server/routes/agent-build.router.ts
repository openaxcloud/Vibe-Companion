// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rate-limiter';
import { type IStorage } from '../storage';
import { getBuildExecutor } from '../services/build-executor.service';
import { createLogger } from '../utils/logger';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

const logger = createLogger('AgentBuildRouter');

/**
 * Agent Build Router
 * Handles build execution with real-time SSE progress streaming
 * 
 * Routes:
 * - POST /api/agent/build/execute - Start build execution
 * - GET /api/agent/build/:id/stream - SSE progress stream
 * - POST /api/agent/build/:id/cancel - Cancel running build
 * - GET /api/agent/build/:id - Get build status
 */
export class AgentBuildRouter {
  router: Router;
  storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * POST /api/agent/build/execute
     * Start build execution from an approved plan
     */
    this.router.post(
      '/execute',
      ensureAuthenticated,
      createRateLimitMiddleware('ai'),
      async (req: Request, res: Response) => {
        try {
          const userId = req.user!.id;

          // Validate request body
          const schema = z.object({
            projectId: z.string(),
            conversationId: z.number().optional(),
            planId: z.string(),
            plan: z.object({
              id: z.string(),
              goal: z.string(),
              summary: z.string(),
              totalTasks: z.number(),
              estimatedTime: z.string(),
              technologies: z.array(z.string()),
              tasks: z.array(z.any()),
              riskAssessment: z.object({
                level: z.enum(['low', 'medium', 'high']),
                factors: z.array(z.string()),
              }),
              createdAt: z.coerce.date(),
            }),
          });

          const { projectId, conversationId, planId, plan } = schema.parse(req.body);

          // Verify project access
          const project = await this.storage.getProject(projectId);
          if (!project) {
            return res.status(404).json({ error: 'Project not found' });
          }
          if (String(project.ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Create build execution record FIRST
          // Database partial unique index enforces single active build per project
          // (idx_single_active_build_per_project on project_id WHERE status IN ('running', 'pending'))
          // This will throw unique constraint violation if another build is already running
          let buildExecution;
          try {
            buildExecution = await this.storage.createBuildExecution({
              projectId,
              conversationId,
              planId,
              totalTasks: plan.totalTasks,
              metadata: {
                approvedBy: userId,
                estimatedTime: plan.estimatedTime,
                technologies: plan.technologies,
                riskLevel: plan.riskAssessment.level,
              },
            });
          } catch (error: any) {
            // Check if error is unique constraint violation
            if (error.code === '23505' || error.message?.includes('unique constraint')) {
              // Another build is already running - find and return it
              const existingBuilds = await this.storage.getBuildExecutionsByProject(projectId);
              const runningBuild = existingBuilds.find(b => b.status === 'running' || b.status === 'pending');
              return res.status(409).json({
                error: 'Another build is already running for this project',
                buildId: runningBuild?.id,
              });
            }
            throw error;
          }

          const buildId = buildExecution.id;

          // Start build execution asynchronously (don't await - run in background)
          const buildExecutor = getBuildExecutor(this.storage);
          buildExecutor.executeBuild(projectId, conversationId, plan, userId, buildId)
            .then(() => {
              logger.info('Build execution completed', { buildId, projectId });
            })
            .catch(error => {
              logger.error('Build execution failed:', { 
                error: error.message,
                projectId,
                planId,
                buildId,
              });
            });

          // Return buildId immediately (build continues in background)
          res.json({
            success: true,
            buildId,
            status: 'pending',
            message: 'Build execution started',
          });

        } catch (error: any) {
          logger.error('Execute build error:', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            projectId: req.body?.projectId,
          });

          res.status(500).json({
            success: false,
            error: error.message || 'Failed to start build execution',
          });
        }
      }
    );

    /**
     * GET /api/agent/build/:id/stream
     * Stream real-time build progress via Server-Sent Events (SSE)
     */
    this.router.get(
      '/:id/stream',
      ensureAuthenticated,
      async (req: Request, res: Response) => {
        try {
          const userId = req.user!.id;
          const buildId = req.params.id;

          // Get build execution
          const buildExecution = await this.storage.getBuildExecution(buildId);
          if (!buildExecution) {
            return res.status(404).json({ error: 'Build not found' });
          }

          // Verify project access
          const project = await this.storage.getProject(buildExecution.projectId);
          if (!project) {
            return res.status(404).json({ error: 'Project not found' });
          }
          if (String(project.ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Set SSE headers with CORS security - reject invalid origins with 403
          if (!validateAndSetSSEHeaders(res, req)) {
            return;
          }

          // Setup heartbeat to prevent proxy drops (every 15 seconds)
          const heartbeatInterval = setInterval(() => {
            try {
              res.write(': heartbeat\n\n');
            } catch (error) {
              clearInterval(heartbeatInterval);
            }
          }, 15000);

          // Subscribe to build events
          const buildExecutor = getBuildExecutor(this.storage);
          const unsubscribe = buildExecutor.onEvent(buildId, (event) => {
            try {
              res.write(`event: ${event.type}\n`);
              res.write(`data: ${JSON.stringify(event.data)}\n\n`);
            } catch (error) {
              logger.error('Error writing SSE event:', error);
            }
          });

          // Send initial state
          res.write(`event: init\n`);
          res.write(`data: ${JSON.stringify({
            buildId: buildExecution.id,
            status: buildExecution.status,
            progress: buildExecution.progress || 0,
            currentTaskIndex: buildExecution.currentTaskIndex || 0,
            totalTasks: buildExecution.totalTasks,
          })}\n\n`);

          // If build is already completed/failed, send final event and close
          if (buildExecution.status === 'completed' || buildExecution.status === 'failed') {
            res.write(`event: ${buildExecution.status === 'completed' ? 'complete' : 'error'}\n`);
            res.write(`data: ${JSON.stringify({
              status: buildExecution.status,
              error: buildExecution.error,
              executionLog: buildExecution.executionLog,
            })}\n\n`);
            
            clearInterval(heartbeatInterval);
            unsubscribe();
            res.end();
            return;
          }

          // Cleanup on client disconnect
          req.on('close', () => {
            clearInterval(heartbeatInterval);
            unsubscribe();
            logger.info(`Client disconnected from build stream: buildId=${buildId}`);
          });

        } catch (error: any) {
          logger.error('Build stream error:', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            buildId: req.params?.id,
          });

          res.status(500).json({
            success: false,
            error: error.message || 'Failed to stream build progress',
          });
        }
      }
    );

    /**
     * POST /api/agent/build/:id/cancel
     * Cancel a running build
     */
    this.router.post(
      '/:id/cancel',
      ensureAuthenticated,
      async (req: Request, res: Response) => {
        try {
          const userId = req.user!.id;
          const buildId = req.params.id;

          // Get build execution
          const buildExecution = await this.storage.getBuildExecution(buildId);
          if (!buildExecution) {
            return res.status(404).json({ error: 'Build not found' });
          }

          // Verify project access
          const project = await this.storage.getProject(buildExecution.projectId);
          if (!project) {
            return res.status(404).json({ error: 'Project not found' });
          }
          if (String(project.ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Check if build is cancellable
          if (buildExecution.status !== 'running' && buildExecution.status !== 'pending') {
            return res.status(400).json({ 
              error: `Cannot cancel build in ${buildExecution.status} state`,
            });
          }

          // Cancel build
          const buildExecutor = getBuildExecutor(this.storage);
          await buildExecutor.cancelBuild(buildId);

          res.json({
            success: true,
            buildId,
            status: 'cancelled',
            message: 'Build cancelled successfully',
          });

        } catch (error: any) {
          logger.error('Cancel build error:', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            buildId: req.params?.id,
          });

          res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel build',
          });
        }
      }
    );

    /**
     * GET /api/agent/build/:id
     * Get build execution status and details
     */
    this.router.get(
      '/:id',
      ensureAuthenticated,
      async (req: Request, res: Response) => {
        try {
          const userId = req.user!.id;
          const buildId = req.params.id;

          // Get build execution
          const buildExecution = await this.storage.getBuildExecution(buildId);
          if (!buildExecution) {
            return res.status(404).json({ error: 'Build not found' });
          }

          // Verify project access
          const project = await this.storage.getProject(buildExecution.projectId);
          if (!project) {
            return res.status(404).json({ error: 'Project not found' });
          }
          if (String(project.ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
          }

          res.json({
            success: true,
            build: buildExecution,
          });

        } catch (error: any) {
          logger.error('Get build error:', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            buildId: req.params?.id,
          });

          res.status(500).json({
            success: false,
            error: error.message || 'Failed to get build status',
          });
        }
      }
    );
  }

  getRouter(): Router {
    return this.router;
  }
}

export default function createAgentBuildRouter(storage: IStorage): Router {
  const buildRouter = new AgentBuildRouter(storage);
  return buildRouter.getRouter();
}
