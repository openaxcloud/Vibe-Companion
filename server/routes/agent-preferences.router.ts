import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { AgentPreferencesService } from '../services/agent-preferences.service';
import { AI_MODELS, type AiModel } from '@shared/schema';
import type { IStorage } from '../storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('agent-preferences');

/**
 * Agent Preferences Router Factory
 * User-facing routes for managing AI agent preferences
 * Mounted at /api/agent
 */
export default function createAgentPreferencesRouter(storage: IStorage): Router {
  const router = Router();

  router.use(ensureAuthenticated);

  router.get('/models', async (req, res) => {
    try {
      const preferencesService = new AgentPreferencesService(storage);
      const models = preferencesService.getAvailableModels();
      const highPowerModels = preferencesService.getHighPowerModels();
      const extendedThinkingModels = preferencesService.getExtendedThinkingModels();
      
      res.json({ 
        models,
        highPowerModels,
        extendedThinkingModels
      });
    } catch (error: any) {
      logger.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  router.get('/preferences', async (req, res) => {
    try {
      const userId = req.user!.id;
      const preferencesService = new AgentPreferencesService(storage);
      
      const preferences = await preferencesService.getUserPreferences(userId);
      
      if (!preferences) {
        return res.json({
          extendedThinking: false,
          highPowerMode: false,
          autoWebSearch: true,
          preferredModel: 'claude-sonnet-4-20250514',
          customInstructions: null,
          improvePromptEnabled: false,
          progressTabEnabled: false,
          pauseResumeEnabled: false,
          autoCheckpoints: true,
        });
      }

      res.json(preferences);
    } catch (error: any) {
      logger.error('Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  router.put('/preferences', async (req, res) => {
    try {
      const userId = req.user!.id;
      const preferencesService = new AgentPreferencesService(storage);
      const updates = req.body;

      if (updates.preferredModel && !AI_MODELS.includes(updates.preferredModel)) {
        return res.status(400).json({
          error: `Invalid model: ${updates.preferredModel}`,
          validModels: AI_MODELS,
        });
      }

      const updated = await preferencesService.updateUserPreferences(userId, updates);
      logger.info(`Preferences updated for user ${userId}`);
      res.json(updated);
    } catch (error: any) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({ error: error.message || 'Failed to update preferences' });
    }
  });

  router.post('/recommend-model', async (req, res) => {
    try {
      const preferencesService = new AgentPreferencesService(storage);
      const { requiresExtendedThinking, highPowerMode, complexity, speedPriority } = req.body;

      const recommended = preferencesService.getRecommendedModel({
        requiresExtendedThinking,
        highPowerMode,
        complexity,
        speedPriority,
      });

      const models = preferencesService.getAvailableModels();
      const modelInfo = models.find(m => m.id === recommended);

      res.json({
        recommended,
        modelInfo,
        reasoning: `Selected ${recommended} based on: complexity=${complexity || 'medium'}, speedPriority=${speedPriority || 'balanced'}, extendedThinking=${requiresExtendedThinking || false}, highPower=${highPowerMode || false}`,
      });
    } catch (error: any) {
      logger.error('Error recommending model:', error);
      res.status(500).json({ error: 'Failed to recommend model' });
    }
  });

  router.get('/effective-model', async (req, res) => {
    try {
      const userId = req.user!.id;
      const preferencesService = new AgentPreferencesService(storage);
      
      const preferences = await preferencesService.getUserPreferences(userId);
      const taskComplexity = (req.query.complexity as 'simple' | 'medium' | 'complex') || 'medium';
      
      const effectiveModel = preferencesService.getEffectiveModel({
        preferredModel: preferences?.preferredModel as AiModel | undefined,
        extendedThinking: preferences?.extendedThinking ?? undefined,
        highPowerMode: preferences?.highPowerMode ?? undefined,
        taskComplexity,
      });
      
      const models = preferencesService.getAvailableModels();
      const modelInfo = models.find(m => m.id === effectiveModel);
      
      res.json({
        effectiveModel,
        modelInfo,
        settings: {
          extendedThinking: preferences?.extendedThinking || false,
          highPowerMode: preferences?.highPowerMode || false,
          autoWebSearch: preferences?.autoWebSearch ?? true,
        }
      });
    } catch (error: any) {
      logger.error('Error getting effective model:', error);
      res.status(500).json({ error: 'Failed to get effective model' });
    }
  });

  router.post('/conversation', async (req, res) => {
    try {
      const { projectId } = req.body;
      const userId = req.user!.id;

      const { aiConversations } = await import('@shared/schema');
      const { eq, and, desc } = await import('drizzle-orm');
      const { db } = await import('../db');

      if (projectId) {
        const existingConversation = await db
          .select()
          .from(aiConversations)
          .where(
            and(
              eq(aiConversations.userId, userId),
              eq(aiConversations.projectId, projectId)
            )
          )
          .orderBy(desc(aiConversations.createdAt))
          .limit(1);

        if (existingConversation.length > 0) {
          return res.json(existingConversation[0]);
        }
      }

      const newConversation = await db
        .insert(aiConversations)
        .values({
          userId,
          projectId: projectId || 0,
          messages: [],
          model: 'claude-sonnet-4-20250514',
          agentMode: 'build',
        })
        .returning();

      res.json(newConversation[0]);
    } catch (error: any) {
      logger.error('Error managing conversation:', error);
      res.status(500).json({ error: 'Failed to manage conversation' });
    }
  });

  return router;
}
