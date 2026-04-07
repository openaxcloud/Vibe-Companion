// @ts-nocheck
/**
 * Autonomous Mode API Routes
 * 
 * Endpoints for controlling autonomous agent execution:
 * - Enable/disable autonomous mode
 * - Get autonomous actions
 * - Generate execution plans
 * - Configure risk thresholds
 */

import { Router, Request, Response, NextFunction } from 'express';
import { autonomousEngine } from '../services/agent-autonomous-engine.service';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();
const logger = createLogger('AutonomousRouter');

// All routes require authentication
router.use(ensureAuthenticated);

/**
 * Middleware to verify session ownership
 * Loads the agent session and verifies it belongs to the authenticated user
 */
async function ensureSessionOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.body.sessionId || req.params.sessionId;
    const userId = req.user!.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Query session with ownership check
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      logger.warn(`Session ownership check failed: sessionId=${sessionId}, userId=${userId}`);
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Attach verified session to request for downstream use
    (req as any).agentSession = session;
    next();
  } catch (error: any) {
    logger.error('Error in session ownership check:', error);
    res.status(500).json({ error: 'Failed to verify session ownership' });
  }
}

/**
 * POST /api/agent/autonomous/enable
 * Enable autonomous mode for a session
 */
router.post('/enable', ensureSessionOwnership, async (req, res) => {
  try {
    const { sessionId, riskThreshold = 'medium' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    const validThresholds = ['low', 'medium', 'high', 'critical'];
    if (!validThresholds.includes(riskThreshold)) {
      return res.status(400).json({ 
        error: 'Invalid risk threshold',
        validValues: validThresholds
      });
    }
    
    await autonomousEngine.enableAutonomousMode(sessionId, riskThreshold);
    
    logger.info(`Autonomous mode enabled for session ${sessionId} by user ${req.user?.id}`);
    
    res.json({
      success: true,
      sessionId,
      autonomousMode: true,
      riskThreshold,
      message: `Autonomous mode enabled with ${riskThreshold} risk threshold`
    });
  } catch (error: any) {
    logger.error('Error enabling autonomous mode:', error);
    res.status(500).json({ error: error.message || 'Failed to enable autonomous mode' });
  }
});

/**
 * POST /api/agent/autonomous/disable
 * Disable autonomous mode for a session
 */
router.post('/disable', ensureSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    await autonomousEngine.disableAutonomousMode(sessionId);
    
    logger.info(`Autonomous mode disabled for session ${sessionId} by user ${req.user?.id}`);
    
    res.json({
      success: true,
      sessionId,
      autonomousMode: false,
      message: 'Autonomous mode disabled - all actions will require approval'
    });
  } catch (error: any) {
    logger.error('Error disabling autonomous mode:', error);
    res.status(500).json({ error: error.message || 'Failed to disable autonomous mode' });
  }
});

/**
 * POST /api/agent/autonomous/assess-risk
 * Assess risk of a specific action without executing it
 */
router.post('/assess-risk', async (req, res) => {
  try {
    // Support both legacy format (actionType, actionData) and new format (action object)
    let actionType: string;
    let actionData: any;
    
    if (req.body.action) {
      // New format: { action: { tool: 'file_read', parameters: {...} } }
      actionType = req.body.action.tool;
      actionData = req.body.action.parameters || {};
    } else {
      // Legacy format: { actionType: '...', actionData: {...} }
      actionType = req.body.actionType;
      actionData = req.body.actionData || {};
    }
    
    if (!actionType) {
      return res.status(400).json({ error: 'action.tool or actionType is required' });
    }
    
    const riskAssessment = await autonomousEngine.assessRisk(
      actionType,
      actionData
    );
    
    res.json({
      riskScore: riskAssessment.score,
      autoApprove: riskAssessment.autoApprove,
      reasoning: riskAssessment.reasoning
    });
  } catch (error: any) {
    logger.error('Error assessing risk:', error);
    res.status(500).json({ error: error.message || 'Failed to assess risk' });
  }
});

/**
 * POST /api/agent/autonomous/execute
 * Execute an action with risk assessment (admin only for now)
 */
router.post('/execute', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, actionType, actionData } = req.body;
    
    if (!sessionId || !actionType) {
      return res.status(400).json({ error: 'sessionId and actionType are required' });
    }
    
    const action = await autonomousEngine.executeAction(
      sessionId,
      actionType,
      actionData || {},
      req.user!.id
    );
    
    logger.info(`Action executed: ${actionType} for session ${sessionId}, risk: ${action.riskAssessment.score}`);
    
    res.json({
      success: true,
      action
    });
  } catch (error: any) {
    logger.error('Error executing action:', error);
    res.status(500).json({ error: error.message || 'Failed to execute action' });
  }
});

/**
 * GET /api/agent/autonomous/actions/:sessionId
 * Get autonomous actions for a session
 */
router.get('/actions/:sessionId', ensureSessionOwnership, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const actions = await autonomousEngine.getAutonomousActions(sessionId, limit);
    
    res.json({
      sessionId,
      count: actions.length,
      actions
    });
  } catch (error: any) {
    logger.error('Error getting autonomous actions:', error);
    res.status(500).json({ error: error.message || 'Failed to get actions' });
  }
});

/**
 * GET /api/agent/autonomous/health
 * Health check for autonomous system
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Autonomous Agent System',
    features: [
      'risk_assessment',
      'autonomous_execution',
      'dependency_analysis',
      'parallel_execution'
    ]
  });
});

/**
 * POST /api/agent/autonomous/build
 * Build application from prompt using AI
 * Supports multi-provider model selection
 */
router.post('/build', async (req, res) => {
  try {
    const { projectId, prompt, modelId } = req.body;
    const userId = req.user!.id;
    
    if (!projectId || !prompt) {
      return res.status(400).json({ error: 'projectId and prompt are required' });
    }
    
    // Import services dynamically to avoid circular dependencies
    const { getStorage } = await import('../storage');
    const { ProjectAIAgentService } = await import('../services/project-ai-agent.service');
    const { AgentFileOperationsService } = await import('../services/agent-file-operations.service');
    
    const storage = getStorage();
    const aiService = new ProjectAIAgentService(storage);
    const fileOps = new AgentFileOperationsService();
    
    // Generate build actions using AI with optional model selection
    logger.info(`Starting autonomous build for project ${projectId} using model ${modelId || 'claude-sonnet-4-20250514'}`);
    const { actions, rejected } = await aiService.generateBuildActions(userId, projectId, prompt, modelId);
    
    // CRITICAL: Fail early if AI generated zero actions
    if (actions.length === 0 && rejected.length === 0) {
      logger.error('AI generated zero actions - possible prompt issue or model failure');
      return res.status(400).json({
        success: false,
        error: 'AI failed to generate any build actions. Please try a more specific prompt.',
        filesCreated: 0,
        filesBlockedByRisk: 0,
        filesFailed: 0,
        actionsRejected: 0,
        results: []
      });
    }
    
    // Log rejected actions
    if (rejected.length > 0) {
      logger.warn(`${rejected.length} actions rejected by security`);
    }
    
    // Execute approved actions and persist files with risk assessment
    const results = [];
    const { aiSecurityService } = await import('../services/ai-security.service');
    
    for (const action of actions) {
      try {
        // CRITICAL: Assess risk before executing
        const risk = await autonomousEngine.assessRisk(action.type, action);
        
        // SECURITY: Only execute if auto-approved (Fortune 500 requirement)
        if (!risk.autoApprove) {
          logger.warn(`Action rejected due to high risk: ${action.path} (score: ${risk.score}, reasoning: ${risk.reasoning})`);
          
          // Log rejected action for audit trail
          await aiSecurityService.logAction(
            userId,
            projectId,
            action,
            { success: false, error: `Risk too high: ${risk.reasoning}` }
          );
          
          results.push({
            success: false,
            action: action.type,
            path: action.path,
            error: `Risk assessment failed: ${risk.reasoning}`,
            riskScore: risk.score,
            autoApprove: false,
            requiresManualApproval: true
          });
          continue;
        }
        
        // Risk approved - create file via storage (inserts into files table)
        const file = await storage.createFile({
          projectId,
          name: action.path.split('/').pop() || action.path,
          path: action.path,
          content: action.content,
          isDirectory: false,
        });
        
        // Log successful action for audit trail
        await aiSecurityService.logAction(
          userId,
          projectId,
          action,
          { success: true, fileId: String(file.id) }
        );
        
        results.push({
          success: true,
          action: action.type,
          path: action.path,
          fileId: file.id,
          riskScore: risk.score,
          autoApprove: true
        });
        
        logger.info(`✅ Created file: ${action.path} (risk: ${risk.score}, auto-approved: ${risk.autoApprove})`);
      } catch (error: any) {
        logger.error(`Failed to create file ${action.path}:`, error);
        
        // Log failed action for audit trail
        await aiSecurityService.logAction(
          userId,
          projectId,
          action,
          { success: false, error: error.message }
        );
        
        results.push({
          success: false,
          action: action.type,
          path: action.path,
          error: error.message
        });
      }
    }
    
    // Calculate security metrics
    const approved = results.filter(r => r.success);
    const failedRisk = results.filter(r => !r.success && r.requiresManualApproval);
    const failedTechnical = results.filter(r => !r.success && !r.requiresManualApproval);
    
    logger.info(`Build complete: ${approved.length} created, ${failedRisk.length} blocked by risk, ${failedTechnical.length} technical failures, ${rejected.length} rejected by security`);
    
    res.json({
      success: true,
      projectId,
      filesCreated: approved.length,
      filesBlockedByRisk: failedRisk.length,
      filesFailed: failedTechnical.length,
      actionsRejected: rejected.length,
      securityCompliant: true,
      results
    });
    
  } catch (error: any) {
    logger.error('Error in autonomous build:', error);
    res.status(500).json({ error: error.message || 'Failed to build project' });
  }
});

export default router;
