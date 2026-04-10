// @ts-nocheck
import { Router } from 'express';
import { openSourceModelsProvider, OPENSOURCE_MODELS } from '../ai/opensource-models-provider';
import { aiBillingService } from '../services/ai-billing-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('opensource-models');
const router = Router();

// Get available open-source models
router.get('/models', async (req, res) => {
  try {
    const models = openSourceModelsProvider.getAvailableModels();
    res.json({
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        provider: model.provider,
        tier: model.tier,
        contextWindow: model.contextWindow,
        capabilities: model.capabilities,
        pricing: {
          input: model.inputPrice,
          output: model.outputPrice,
          currency: 'USD',
          unit: '1M tokens'
        },
        available: model.available
      }))
    });
  } catch (error: any) {
    logger.error('Failed to get open-source models:', error);
    res.status(500).json({ error: 'Failed to retrieve models' });
  }
});

// Generate completion with open-source model
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      model = 'mixtral-8x7b', 
      messages, 
      temperature = 0.7, 
      max_tokens = 2048,
      stream = false 
    } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    
    // Check if model exists
    const modelConfig = OPENSOURCE_MODELS[model as keyof typeof OPENSOURCE_MODELS];
    if (!modelConfig) {
      return res.status(400).json({ 
        error: `Model ${model} not found`,
        availableModels: Object.keys(OPENSOURCE_MODELS)
      });
    }
    
    // Check if model is configured
    if (!openSourceModelsProvider.isConfigured(model)) {
      return res.status(503).json({ 
        error: `Model ${model} requires API key configuration`,
        provider: modelConfig.provider,
        requiredKey: `${modelConfig.provider.toUpperCase()}_API_KEY`
      });
    }
    
    // Generate response
    const startTime = Date.now();
    const response = await openSourceModelsProvider.generateChat(messages, {
      model,
      temperature,
      max_tokens
    });
    const duration = Date.now() - startTime;
    
    // Track usage for billing
    if (userId) {
      const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
      const outputTokens = Math.ceil(response.length / 4);
      
      await aiBillingService.trackAIUsage(userId, {
        model: modelConfig.name,
        provider: modelConfig.provider,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        prompt: messages[messages.length - 1]?.content?.substring(0, 200) || '',
        completion: response.substring(0, 200),
        purpose: 'api-generation',
        timestamp: new Date()
      });
    }
    
    res.json({
      model: modelConfig.name,
      content: response,
      usage: {
        prompt_tokens: Math.ceil(JSON.stringify(messages).length / 4),
        completion_tokens: Math.ceil(response.length / 4),
        total_tokens: Math.ceil(JSON.stringify(messages).length / 4) + Math.ceil(response.length / 4)
      },
      metadata: {
        provider: modelConfig.provider,
        duration: `${duration}ms`,
        temperature,
        max_tokens
      }
    });
  } catch (error: any) {
    logger.error('Open-source model generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
});

// Code generation with open-source model
router.post('/code', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      model = 'deepseek-coder-33b', 
      prompt,
      language = 'javascript',
      context,
      temperature = 0.5,
      max_tokens = 4096
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Build code-specific messages
    const messages = [
      {
        role: 'system',
        content: `You are an expert ${language} developer. Generate clean, efficient, and well-documented code.${context ? `\n\nContext: ${context}` : ''}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    // Generate code
    const startTime = Date.now();
    const response = await openSourceModelsProvider.generateCodeWithUnderstanding(
      messages,
      context ? { language, context } : null,
      { model, temperature, max_tokens }
    );
    const duration = Date.now() - startTime;
    
    // Track usage
    if (userId) {
      const modelConfig = OPENSOURCE_MODELS[model as keyof typeof OPENSOURCE_MODELS];
      const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
      const outputTokens = Math.ceil(response.length / 4);
      
      await aiBillingService.trackAIUsage(userId, {
        model: modelConfig.name,
        provider: modelConfig.provider,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        prompt: prompt.substring(0, 200),
        completion: response.substring(0, 200),
        purpose: 'code-generation',
        timestamp: new Date()
      });
    }
    
    res.json({
      code: response,
      model: OPENSOURCE_MODELS[model as keyof typeof OPENSOURCE_MODELS]?.name || model,
      language,
      metadata: {
        duration: `${duration}ms`,
        temperature,
        max_tokens
      }
    });
  } catch (error: any) {
    logger.error('Code generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate code',
      details: error.message 
    });
  }
});

// Get model pricing information
router.get('/pricing', async (req, res) => {
  try {
    const pricing = Object.entries(OPENSOURCE_MODELS).map(([id, config]) => ({
      id,
      name: config.name,
      tier: config.tier,
      provider: config.provider,
      inputPrice: config.inputPrice,
      outputPrice: config.outputPrice,
      unit: '1M tokens',
      currency: 'USD',
      available: openSourceModelsProvider.isConfigured(id)
    }));
    
    res.json({
      models: pricing,
      tiers: {
        flagship: 'High-performance models for complex tasks',
        specialized: 'Domain-specific models optimized for particular use cases',
        efficient: 'Fast, cost-effective models for quick tasks'
      }
    });
  } catch (error: any) {
    logger.error('Failed to get pricing:', error);
    res.status(500).json({ error: 'Failed to retrieve pricing information' });
  }
});

// Check model availability
router.get('/status/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const modelConfig = OPENSOURCE_MODELS[modelId as keyof typeof OPENSOURCE_MODELS];
    
    if (!modelConfig) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const isAvailable = openSourceModelsProvider.isConfigured(modelId);
    
    res.json({
      id: modelId,
      name: modelConfig.name,
      provider: modelConfig.provider,
      available: isAvailable,
      requiredKey: isAvailable ? null : `${modelConfig.provider.toUpperCase()}_API_KEY`,
      capabilities: modelConfig.capabilities,
      contextWindow: modelConfig.contextWindow
    });
  } catch (error: any) {
    logger.error('Failed to check model status:', error);
    res.status(500).json({ error: 'Failed to check model status' });
  }
});

export default router;