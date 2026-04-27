// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rate-limiter';
import { type IStorage } from '../storage';
import { aiPlanGenerator } from '../services/ai-plan-generator.service';
import { createLogger } from '../utils/logger';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

const logger = createLogger('AgentPlanRouter');

/**
 * Sanitize user prompts to prevent injection attacks
 * Removes potentially dangerous patterns while preserving useful input
 */
function sanitizePrompt(prompt: string): string {
  if (!prompt) return '';
  
  // Remove excessive whitespace but preserve newlines
  let sanitized = prompt.trim().replace(/\s+/g, ' ').replace(/\n\s+/g, '\n');
  
  // Limit length to prevent abuse (5000 chars max)
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
    logger.warn('Prompt truncated to 5000 characters');
  }
  
  // Remove potentially dangerous script injection attempts
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // event handlers like onclick=
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

/**
 * Agent Plan Router
 * REAL AI-powered plan generation with streaming
 * Uses OpenAI GPT-5 for intelligent task breakdown
 * 
 * Features:
 * - Rate limiting (10 requests/min per user)
 * - Prompt sanitization for security
 * - SSE heartbeat to prevent proxy drops
 * - Database persistence for memory retention
 */
export class AgentPlanRouter {
  router: Router;
  storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * POST /api/agent/plan/stream
     * Stream real-time plan generation from AI
     * Uses Server-Sent Events (SSE) for streaming
     */
    this.router.post(
      '/stream',
      ensureAuthenticated,
      createRateLimitMiddleware('ai'),
      async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Validate request body
        const schema = z.object({
          projectId: z.string(),
          goal: z.string().min(1),
          context: z.object({
            projectType: z.string().optional(),
            existingFiles: z.array(z.string()).optional(),
            technologies: z.array(z.string()).optional(),
            constraints: z.array(z.string()).optional()
          }).optional()
        });

        const { projectId, goal: rawGoal, context } = schema.parse(req.body);
        
        // Sanitize prompt for security
        const goal = sanitizePrompt(rawGoal);
        
        if (!goal || goal.length < 5) {
          return res.status(400).json({ error: 'Goal must be at least 5 characters after sanitization' });
        }

        // Verify project access
        const project = await this.storage.getProject(projectId);
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
        
        // Cleanup on client disconnect
        req.on('close', () => {
          clearInterval(heartbeatInterval);
          logger.info(`Client disconnected from plan stream: projectId=${projectId}`);
        });

        // Stream plan generation
        let completePlan: any = null;

        for await (const event of aiPlanGenerator.generatePlan(userId, projectId, goal, context)) {
          // Send SSE event
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          
          // Save complete plan when received
          if (event.type === 'plan') {
            completePlan = event.data;
          }
        }

        // Save plan to database
        if (completePlan) {
          const conversationId = await aiPlanGenerator.savePlan(userId, projectId, completePlan);
          
          // Send final event with conversation ID
          res.write(`data: ${JSON.stringify({
            type: 'saved',
            data: {
              conversationId,
              planId: completePlan.id
            }
          })}\n\n`);
        }

        // Cleanup heartbeat
        clearInterval(heartbeatInterval);
        
        // Close connection
        res.write('data: {"type":"done"}\n\n');
        res.end();

      } catch (error: any) {
        logger.error('Stream error:', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          projectId: req.body?.projectId
        });
        
        // Send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          data: {
            message: error.message || 'Failed to generate plan',
            code: error.code
          }
        })}\n\n`);
        
        res.end();
      }
    });

    /**
     * POST /api/agent/plan/generate
     * Generate plan and return complete result (non-streaming)
     * For backward compatibility with existing frontend
     */
    this.router.post(
      '/generate',
      ensureAuthenticated,
      createRateLimitMiddleware('ai'),
      async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Support both 'goal' and 'prompt' field names
        const rawGoal = req.body.goal || req.body.prompt;
        const context = req.body.context || {};
        const projectId = req.body.projectId;

        if (!rawGoal) {
          return res.status(400).json({ error: 'goal or prompt is required' });
        }
        
        // Sanitize prompt for security
        const goal = sanitizePrompt(rawGoal);
        
        if (!goal || goal.length < 5) {
          return res.status(400).json({ error: 'Goal must be at least 5 characters after sanitization' });
        }

        if (!projectId) {
          return res.status(400).json({ error: 'projectId is required' });
        }

        // Verify project access
        const project = await this.storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        if (String(project.ownerId) !== String(userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Collect all streamed data
        let fullResponse = '';
        let plan: any = null;

        for await (const event of aiPlanGenerator.generatePlan(userId, projectId, goal, context)) {
          if (event.type === 'chunk') {
            fullResponse += event.data.content;
          } else if (event.type === 'plan') {
            plan = event.data;
          } else if (event.type === 'error') {
            return res.status(500).json({
              success: false,
              error: event.data.message || 'Failed to generate plan'
            });
          }
        }

        if (!plan) {
          return res.status(500).json({
            success: false,
            error: 'No plan generated'
          });
        }

        // Save plan to database
        const conversationId = await aiPlanGenerator.savePlan(userId, projectId, plan);
        
        // Telemetry logging
        logger.info('Plan generated successfully', {
          userId,
          projectId,
          conversationId,
          taskCount: plan.tasks?.length || 0,
          planId: plan.id
        });

        res.json({
          success: true,
          plan,
          conversationId
        });

      } catch (error: any) {
        logger.error('Generate error:', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          projectId: req.body?.projectId
        });
        
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to generate plan'
        });
      }
    });

    /**
     * GET /api/agent/plan/:conversationId
     * Get a saved plan from database
     */
    this.router.get('/:conversationId', ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const conversationId = parseInt(req.params.conversationId);

        if (isNaN(conversationId)) {
          return res.status(400).json({ error: 'Invalid conversation ID' });
        }

        const conversation = await this.storage.getAiConversation(conversationId);
        
        if (!conversation) {
          return res.status(404).json({ error: 'Plan not found' });
        }

        if (String(conversation.userId) !== String(userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
          success: true,
          conversation
        });

      } catch (error: any) {
        logger.error('Get plan error:', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          conversationId: req.params?.conversationId
        });
        
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to get plan'
        });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}

export default function createAgentPlanRouter(storage: IStorage): Router {
  const planRouter = new AgentPlanRouter(storage);
  return planRouter.getRouter();
}
