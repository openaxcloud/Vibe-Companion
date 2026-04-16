/**
 * Workspace Bootstrap Router
 * 
 * POST /bootstrap — creates project + workspace, returns { success, projectId, bootstrapToken }
 * GET /bootstrap/:token/status — polling endpoint for workspace readiness
 * GET /bootstrap/metrics — bootstrap optimization metrics
 * GET /bootstrap/fast-check — fast model recommendation status
 */

import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { db } from '../db';
import { agentSessions, type User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { getJwtSecret } from '../utils/secrets-manager';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { fastBootstrap } from '../services/fast-bootstrap.service';
import { storage } from '../storage';
import { z } from 'zod';
import { memoryBankService } from '../services/memory-bank.service';

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

function sanitizeProjectName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, 200);
  const sanitized = trimmed.replace(/[<>"'`;{}]/g, "");
  if (!sanitized || sanitized.length === 0) return null;
  return sanitized;
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

const bootstrapRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  buildMode: z.enum(['design-first', 'full-app', 'continue-planning']).default('full-app'),
  options: z.object({
    language: z.enum(['typescript', 'javascript', 'python', 'rust', 'go']).default('typescript'),
    framework: z.enum(['react', 'vue', 'svelte', 'express', 'fastapi']).default('react'),
    autoStart: z.boolean().default(true),
    visibility: z.enum(['public', 'private', 'unlisted']).default('public'),
    designFirst: z.boolean().default(false)
  }).default({
    language: 'typescript',
    framework: 'react',
    autoStart: true,
    visibility: 'public',
    designFirst: false
  })
});

router.post('/bootstrap', csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as User)?.id || (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const parsed = bootstrapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "A project description is required" });
    }

    const { prompt, buildMode, options } = parsed.data;

    const projectCheck = await storage.checkProjectLimit(userId);
    if (!projectCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.`
      });
    }

    const words = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
    let projectName = words.length > 40 ? words.slice(0, 40) : words;
    projectName = sanitizeProjectName(projectName) || "My Project";

    const language = options?.language || "typescript";

    const project = await storage.createProject(userId, {
      name: projectName,
      language,
      projectType: "web-app",
      outputType: "web",
      visibility: options?.visibility || "public",
      bootstrapPrompt: prompt,
    });

    await storage.createArtifact({
      projectId: project.id,
      name: projectName,
      type: "web-app",
      entryFile: null,
      settings: {},
    });

    const bootstrapToken = crypto.randomUUID();

    if (buildMode) {
      await storage.trackEvent(userId, "workspace_bootstrap", {
        projectId: project.id,
        buildMode,
        prompt: prompt.slice(0, 200),
      });
    }

    logger.info(`[Bootstrap] Project created: ${project.id} for user ${userId}`);

    (async () => {
      try {
        const { autoProvisionProjectDatabase } = await import('../utils/project-db-provision');
        await autoProvisionProjectDatabase(String(project.id), String(userId));
        logger.info(`[Bootstrap] Database auto-provisioned for project ${project.id}`);
      } catch (dbErr: any) {
        logger.warn(`[Bootstrap] DB auto-provision failed for project ${project.id}: ${dbErr.message}`);
      }
    })();

    (async () => {
      try {
        const projectPath = `${process.cwd()}/project-workspaces/${project.id}`;
        memoryBankService.setProjectBasePath(project.id, projectPath);
        await memoryBankService.initializeWithAI(project.id, prompt, {
          language: options?.language || 'typescript',
          framework: options?.framework || 'react',
          buildMode: buildMode || 'full-app',
        });
        logger.info(`[Bootstrap] Memory Bank initialized for project ${project.id}`);
      } catch (mbErr: any) {
        logger.warn(`[Bootstrap] Memory Bank init failed for project ${project.id}: ${mbErr.message}`);
        try {
          await memoryBankService.initialize(project.id, prompt);
          logger.info(`[Bootstrap] Memory Bank fallback (template) initialized for project ${project.id}`);
        } catch {}
      }
    })();

    return res.json({ success: true, projectId: project.id, bootstrapToken });
  } catch (error: any) {
    logger.error("[Bootstrap] Error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request data" });
    }
    return res.status(500).json({ success: false, error: "Failed to create workspace. Please try again." });
  }
});

router.get('/bootstrap-prompt/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as User)?.id || (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ prompt: null });
    }
    const projectId = req.params.projectId;
    const project = await storage.getProject(projectId);
    if (!project || String(project.userId) !== String(userId)) {
      return res.json({ prompt: null });
    }
    const prompt = project.bootstrapPrompt || null;
    if (prompt) {
      await storage.updateProject(projectId, { bootstrapPrompt: null } as any);
      logger.info(`[Bootstrap] Prompt consumed for project ${projectId}`);
    }
    return res.json({ prompt });
  } catch (error: any) {
    logger.error("[Bootstrap] Prompt fetch error:", error);
    return res.json({ prompt: null });
  }
});

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
