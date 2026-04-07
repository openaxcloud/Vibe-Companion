import express from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { getStorage } from '../storage';
import { aiModelsRateLimiter } from '../middleware/custom-rate-limiter';

const preferredModelSchema = z.object({
  modelId: z.string().min(1).max(100)
});

const router = express.Router();

/**
 * GET /api/models/health
 * Health check endpoint - returns provider status (no auth required)
 */
router.get('/health', (req, res) => {
  try {
    const models = aiProviderManager.getAvailableModels();
    const providerStats = models.reduce((acc, model) => {
      acc[model.provider] = (acc[model.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      status: 'healthy',
      providers: Object.keys(providerStats).length,
      totalModels: models.length,
      providerStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[AI Models] Health check error:', error);
    res.status(500).json({ 
      success: false,
      status: 'unhealthy',
      error: error.message 
    });
  }
});

/**
 * GET /api/models
 * Get all available AI models across providers (public endpoint)
 * Rate limit: 100 req/min per IP
 */
router.get('/', aiModelsRateLimiter, (req, res) => {
  try {
    const models = aiProviderManager.getAvailableModels();
    res.json({
      success: true,
      models,
      count: models.length
    });
  } catch (error: any) {
    console.error('[AI Models] Error getting models:', error);
    res.status(500).json({ error: error.message || 'Failed to get models' });
  }
});

/**
 * GET /api/models/preferred
 * Get user's preferred AI model (public endpoint - returns default for unauthenticated users)
 */
router.get('/preferred', async (req, res) => {
  try {
    // For unauthenticated users, return a default model
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      const availableModels = aiProviderManager.getAvailableModels();
      const defaultModel = availableModels.length > 0 ? availableModels[0].id : null;
      return res.json({
        success: true,
        preferredModel: defaultModel,
        availableModels: availableModels.length
      });
    }

    const userId = req.user!.id.toString();
    const storage = getStorage();
    
    // Get user's preferred model from database
    const user = await storage.getUser(userId);
    
    // Smart fallback: Use first available model if user has no preference
    let preferredModel = user?.preferredAiModel;
    if (!preferredModel) {
      const availableModels = aiProviderManager.getAvailableModels();
      preferredModel = availableModels.length > 0 ? availableModels[0].id : null;
    }

    const LEGACY_UPGRADES: Record<string, string> = {
      'gpt-4o-mini': 'gpt-4.1',
      'gpt-4o':      'gpt-4.1',
    };
    if (preferredModel && LEGACY_UPGRADES[preferredModel]) {
      preferredModel = LEGACY_UPGRADES[preferredModel];
    }
    
    res.json({
      success: true,
      preferredModel,
      availableModels: aiProviderManager.getAvailableModels().length
    });
  } catch (error: any) {
    console.error('[AI Models] Error getting preferred model:', error);
    res.status(500).json({ error: error.message || 'Failed to get preferred model' });
  }
});

/**
 * GET /api/models/pricing (also /api/ai/models/pricing via alias mount)
 * Returns pricing for all AI models — public endpoint, no auth required
 */
router.get('/pricing', (_req, res) => {
  res.json({
    success: true,
    pricing: {
      'gpt-4.1':                    { input: 0.000002,   output: 0.000008,   creditsPerThousand: 2 },
      'gpt-4.1-mini':               { input: 0.0000004,  output: 0.0000016,  creditsPerThousand: 0.4 },
      'gpt-4.1-nano':               { input: 0.0000001,  output: 0.0000004,  creditsPerThousand: 0.1 },
      'gpt-4o':                     { input: 0.0000025,  output: 0.00001,    creditsPerThousand: 2.5 },
      'gpt-4o-mini':                { input: 0.00000015, output: 0.0000006,  creditsPerThousand: 0.15 },
      'o4-mini':                    { input: 0.0000011,  output: 0.0000044,  creditsPerThousand: 1.1 },
      'o3':                         { input: 0.00001,    output: 0.00004,    creditsPerThousand: 10 },
      'o3-mini':                    { input: 0.0000011,  output: 0.0000044,  creditsPerThousand: 1.1 },
      'o1':                         { input: 0.000015,   output: 0.00006,    creditsPerThousand: 15 },
      'gpt-4-turbo':                { input: 0.00001,    output: 0.00003,    creditsPerThousand: 10 },
      // Anthropic — confirmed real models (March 2026)
      'claude-opus-4-20250514':     { input: 0.000015,   output: 0.000075,   creditsPerThousand: 15 },
      'claude-sonnet-4-20250514':   { input: 0.000003,   output: 0.000015,   creditsPerThousand: 3 },
      'claude-3-7-sonnet-20250219': { input: 0.000003,   output: 0.000015,   creditsPerThousand: 3 },
      'claude-3-5-sonnet-20241022': { input: 0.000003,   output: 0.000015,   creditsPerThousand: 3 },
      'claude-3-5-haiku-20241022':  { input: 0.00000025, output: 0.00000125, creditsPerThousand: 0.25 },
      'claude-3-opus-20240229':     { input: 0.000015,   output: 0.000075,   creditsPerThousand: 15 },
      'claude-3-haiku-20240307':    { input: 0.00000025, output: 0.00000125, creditsPerThousand: 0.25 },
      // Gemini
      'gemini-2.5-pro':             { input: 0.00000125, output: 0.000010,   creditsPerThousand: 1.25 },
      'gemini-2.5-flash':           { input: 0.0000000375, output: 0.00000015, creditsPerThousand: 0.0375 },
      'gemini-2.0-flash':           { input: 0.0000000375, output: 0.00000015, creditsPerThousand: 0.0375 },
      'gemini-2.0-flash-lite':      { input: 0.000000019, output: 0.000000075, creditsPerThousand: 0.019 },
      'gemini-1.5-pro':             { input: 0.00000125, output: 0.000010,   creditsPerThousand: 1.25 },
      'gemini-1.5-flash':           { input: 0.000000075, output: 0.0000003, creditsPerThousand: 0.075 },
      // xAI Grok — grok-3 family (confirmed real March 2026)
      'grok-3':                     { input: 0.000003,   output: 0.000015,   creditsPerThousand: 3 },
      'grok-3-mini':                { input: 0.0000003,  output: 0.0000005,  creditsPerThousand: 0.3 },
      'grok-3-fast':                { input: 0.000005,   output: 0.000025,   creditsPerThousand: 5 },
      // Moonshot AI / Kimi
      'moonshot-v1-8k':             { input: 0.0000012,  output: 0.0000012,  creditsPerThousand: 1.2 },
      'moonshot-v1-32k':            { input: 0.0000024,  output: 0.0000024,  creditsPerThousand: 2.4 },
      'moonshot-v1-128k':           { input: 0.000006,   output: 0.000006,   creditsPerThousand: 6 },
    },
    updatedAt: new Date().toISOString()
  });
});

/**
 * POST /api/models/preferred
 * Set user's preferred AI model
 */
router.post('/preferred', ensureAuthenticated, async (req, res) => {
  try {
    const parseResult = preferredModelSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: parseResult.error.errors 
      });
    }
    
    const userId = req.user!.id.toString();
    const { modelId } = parseResult.data;
    
    // Validate model exists
    const model = aiProviderManager.getAvailableModels().find(m => m.id === modelId);
    if (!model) {
      return res.status(400).json({ error: `Invalid model: ${modelId}` });
    }
    
    const storage = getStorage();
    
    // Update user's preferred model
    await storage.updateUser(userId, {
      preferredAiModel: modelId
    });
    
    res.json({
      success: true,
      preferredModel: modelId,
      model: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        description: model.description
      }
    });
  } catch (error: any) {
    console.error('[AI Models] Error setting preferred model:', error);
    res.status(500).json({ error: error.message || 'Failed to set preferred model' });
  }
});

export default router;
