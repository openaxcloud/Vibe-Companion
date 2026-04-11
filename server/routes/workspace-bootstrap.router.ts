/**
 * Workspace Bootstrap Router (auxiliary routes only)
 * 
 * POST /api/workspace/bootstrap is handled by legacy-projects.ts
 * This file provides auxiliary GET endpoints:
 * - GET /bootstrap/:token/status — polling endpoint for workspace readiness
 * - GET /bootstrap/metrics — bootstrap optimization metrics
 * - GET /bootstrap/fast-check — fast model recommendation status
 */

import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { getJwtSecret } from '../utils/secrets-manager';
import jwt from 'jsonwebtoken';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { fastBootstrap } from '../services/fast-bootstrap.service';

const logger = createLogger('workspace-bootstrap');
const router = Router();

interface BootstrapTokenPayload {
  type?: 'agent_bootstrap';
  projectId: string;
  conversationId: string;
  sessionId: string;
  userId: number;
  timestamp: number;
}

function verifyBootstrapToken(token: string): BootstrapTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as BootstrapTokenPayload;
    const ageMs = Date.now() - decoded.timestamp;
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      logger.warn('[Bootstrap Token] Token expired', { ageMs, maxAgeMs });
      return null;
    }
    return decoded;
  } catch (error) {
    logger.error('[Bootstrap Token] Verification failed:', error);
    return null;
  }
}

router.get('/bootstrap/:token/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const payload = verifyBootstrapToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired bootstrap token'
      });
    }

    const { projectId, sessionId } = payload;

    const [session] = await db.select()
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    res.json({
      success: true,
      status: session?.isActive ? 'ready' : 'provisioning',
      projectId,
      sessionId,
      workspaceUrl: `/ws/agent?projectId=${projectId}&sessionId=${sessionId}`
    });

  } catch (error: any) {
    logger.error('[Bootstrap Status] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/bootstrap/metrics', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const stats = fastBootstrap.getCacheStats();

    res.json({
      success: true,
      metrics: {
        fastModels: stats.fastModels,
        usage: stats.usage,
        optimization: {
          fastModelRecommendationsEnabled: true,
          parallelExecutionEnabled: true,
          backgroundNpmInstallEnabled: true,
          note: 'Fast model recommendations may not always be used due to provider availability'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Bootstrap Metrics] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

router.get('/bootstrap/fast-check', async (req: Request, res: Response) => {
  try {
    const stats = fastBootstrap.getCacheStats();

    const availableModels = aiProviderManager.getAvailableModels();
    const availableFastModels = stats.fastModels.filter(fm =>
      availableModels.some(am => am.id === fm.id)
    );

    const hasFastModels = availableFastModels.length > 0;

    res.json({
      success: true,
      ready: hasFastModels,
      fastModels: stats.fastModels,
      availableFastModels: availableFastModels.map(m => m.id),
      effectiveness: stats.usage.effectivenessRate,
      message: hasFastModels
        ? `Fast model recommendations active - ${availableFastModels.length} fast model(s) available`
        : 'No fast models currently available - recommendations will fall back to other models'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      ready: false,
      error: 'Fast bootstrap check failed'
    });
  }
});

export default router;
