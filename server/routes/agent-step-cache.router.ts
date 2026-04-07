/**
 * Agent Step Cache Router
 * 
 * API endpoints for managing agent intermediate step cache:
 * - Get cached steps for a project
 * - Invalidate specific steps for partial regeneration
 * - Get cache metrics and statistics
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { Router, Request, Response, NextFunction } from 'express';
import { agentStepCacheService, StepType } from '../services/agent-step-cache.service';
import { createLogger } from '../utils/logger';
import { z } from 'zod';

const logger = createLogger('AgentStepCacheRouter');
const router = Router();

/**
 * Authentication middleware - require authenticated user
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Validation schemas
 */
const invalidateSchema = z.object({
  stepTypes: z.array(z.enum(['SPECIFICATION', 'ARCHITECTURE_PLAN', 'FILE_LAYOUT', 'INITIAL_SCAFFOLD'])).optional(),
  reason: z.string().optional()
});

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/agent/step-cache/:projectId
 * Get all cached steps for a project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const steps = await agentStepCacheService.getProjectSteps(projectId);
    
    res.json({
      projectId,
      steps: steps.map(step => ({
        id: step.id,
        stepType: step.stepType,
        version: step.version,
        provider: step.provider,
        model: step.model,
        tokensUsed: step.tokensUsed,
        cost: step.cost,
        hitCount: step.hitCount,
        createdAt: step.createdAt,
        lastAccessedAt: step.lastAccessedAt,
        metadata: step.metadata
      })),
      count: steps.length
    });
  } catch (error: any) {
    logger.error('Failed to get project steps:', error);
    res.status(500).json({ error: 'Failed to get cached steps' });
  }
});

/**
 * GET /api/agent/step-cache/:projectId/latest
 * Get the latest version of each step type for a project
 * Useful for understanding what can be reused vs regenerated
 */
router.get('/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const latestSteps = await agentStepCacheService.getLatestSteps(projectId);
    
    const response: Record<string, any> = {};
    latestSteps.forEach((step, stepType) => {
      response[stepType] = {
        version: step.version,
        provider: step.provider,
        model: step.model,
        tokensUsed: step.tokensUsed,
        cost: step.cost,
        hitCount: step.hitCount,
        createdAt: step.createdAt,
        contentPreview: getContentPreview(step.content, stepType)
      };
    });

    res.json({
      projectId,
      latestSteps: response,
      availableStepTypes: Array.from(latestSteps.keys())
    });
  } catch (error: any) {
    logger.error('Failed to get latest steps:', error);
    res.status(500).json({ error: 'Failed to get latest steps' });
  }
});

/**
 * GET /api/agent/step-cache/:projectId/:stepType
 * Get the content of a specific step type
 */
router.get('/:projectId/:stepType', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const stepType = req.params.stepType.toUpperCase() as StepType;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const validStepTypes = ['SPECIFICATION', 'ARCHITECTURE_PLAN', 'FILE_LAYOUT', 'INITIAL_SCAFFOLD'];
    if (!validStepTypes.includes(stepType)) {
      return res.status(400).json({ 
        error: 'Invalid step type',
        validTypes: validStepTypes
      });
    }

    const latestSteps = await agentStepCacheService.getLatestSteps(projectId);
    const step = latestSteps.get(stepType);

    if (!step) {
      return res.status(404).json({ 
        error: 'Step not found',
        stepType,
        projectId
      });
    }

    res.json({
      id: step.id,
      stepType: step.stepType,
      version: step.version,
      content: step.content,
      provider: step.provider,
      model: step.model,
      tokensUsed: step.tokensUsed,
      cost: step.cost,
      hitCount: step.hitCount,
      createdAt: step.createdAt,
      metadata: step.metadata
    });
  } catch (error: any) {
    logger.error('Failed to get step:', error);
    res.status(500).json({ error: 'Failed to get step' });
  }
});

/**
 * POST /api/agent/step-cache/:projectId/invalidate
 * Invalidate cached steps for partial regeneration
 * Body: { stepTypes?: string[], reason?: string }
 */
router.post('/:projectId/invalidate', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { stepTypes, reason } = req.body;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const validStepTypes = ['SPECIFICATION', 'ARCHITECTURE_PLAN', 'FILE_LAYOUT', 'INITIAL_SCAFFOLD'];
    
    let typesToInvalidate: StepType[] | undefined;
    if (stepTypes && Array.isArray(stepTypes)) {
      typesToInvalidate = stepTypes
        .map((t: string) => t.toUpperCase())
        .filter((t: string) => validStepTypes.includes(t)) as StepType[];
    }

    const invalidatedCount = await agentStepCacheService.invalidateSteps(
      projectId,
      typesToInvalidate,
      reason
    );

    logger.info(`Invalidated ${invalidatedCount} cache entries for project ${projectId}`, {
      projectId,
      stepTypes: typesToInvalidate,
      reason
    });

    res.json({
      success: true,
      invalidatedCount,
      stepTypes: typesToInvalidate || 'all',
      reason
    });
  } catch (error: any) {
    logger.error('Failed to invalidate steps:', error);
    res.status(500).json({ error: 'Failed to invalidate steps' });
  }
});

/**
 * GET /api/agent/step-cache/metrics
 * Get cache performance metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = agentStepCacheService.getMetrics();
    
    res.json({
      ...metrics,
      hitRateFormatted: `${metrics.hitRate.toFixed(2)}%`,
      costSavedFormatted: `$${metrics.costSaved.toFixed(4)}`,
      tokensSavedFormatted: metrics.tokensSaved.toLocaleString()
    });
  } catch (error: any) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * POST /api/agent/step-cache/metrics/reset
 * Reset cache metrics (for testing/monitoring)
 */
router.post('/metrics/reset', async (_req: Request, res: Response) => {
  try {
    agentStepCacheService.resetMetrics();
    res.json({ success: true, message: 'Metrics reset' });
  } catch (error: any) {
    logger.error('Failed to reset metrics:', error);
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

/**
 * Helper function to generate content preview
 */
function getContentPreview(content: any, stepType: string): string {
  if (!content) return 'No content';
  
  switch (stepType) {
    case 'SPECIFICATION':
      return content.specification?.title || content.specification?.description?.substring(0, 100) || 'Specification available';
    case 'ARCHITECTURE_PLAN':
      return `${content.architecturePlan?.structure?.length || 0} components, ${content.architecturePlan?.apiEndpoints?.length || 0} endpoints`;
    case 'FILE_LAYOUT':
      return `${content.fileLayout?.files?.length || 0} files, ${content.fileLayout?.directories?.length || 0} directories`;
    case 'INITIAL_SCAFFOLD':
      return `${content.initialScaffold?.files?.length || 0} files, ${content.initialScaffold?.commands?.length || 0} commands`;
    default:
      return 'Content available';
  }
}

export default router;
