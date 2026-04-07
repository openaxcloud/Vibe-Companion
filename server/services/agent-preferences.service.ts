// @ts-nocheck
import { type IStorage } from '../storage';
import { AI_MODELS, type AiModel } from '@shared/schema';

/**
 * Agent Preferences Service
 * Manages user preferences for AI agent (model selection, extended thinking, etc.)
 */
export class AgentPreferencesService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get available AI models with capabilities
   */
  getAvailableModels(): Array<{
    id: AiModel;
    name: string;
    description: string;
    category: 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot';
    tier: 'standard' | 'high-power';
    capabilities: {
      extendedThinking: boolean;
      codeGeneration: boolean;
      maxTokens: number;
      speed: 'fast' | 'medium' | 'slow';
      cost: 'low' | 'medium' | 'high';
    };
  }> {
    // CONFIRMED WORKING via live ModelFarm tests (March 2026)
    return [
      // ── OpenAI — GPT-4.1.x (ALL free via Replit ModelFarm) ────────────────────
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'Best overall — top intelligence for coding, reasoning & agentic tasks. Free via ModelFarm.',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'medium', cost: 'free' },
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'OpenAI flagship — powerful and versatile for complex tasks. Free via ModelFarm.',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'medium', cost: 'free' },
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'Fast GPT-4.1 — excellent balance of speed and capability. Free via ModelFarm.',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'free' },
      },
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
        description: 'Fastest GPT-4.1 — ultra-low latency for background tasks. Free via ModelFarm.',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'free' },
      },
      // ── OpenAI — GPT-4.1 family (confirmed working on ModelFarm) ─────────────
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'Best coding & instruction following — 1M context window. Free via ModelFarm.',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1047576, speed: 'medium', cost: 'free' },
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'Fast and efficient — best price-to-performance for most tasks. Free via ModelFarm.',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1047576, speed: 'fast', cost: 'free' },
      },
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
        description: 'Smallest, fastest GPT-4.1 — high-volume, latency-sensitive tasks. Free via ModelFarm.',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1047576, speed: 'fast', cost: 'free' },
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Multimodal flagship — vision, audio, and text with 128K context',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 128000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Affordable multimodal model — vision + text at low cost',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 128000, speed: 'fast', cost: 'low' },
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
        description: 'Latest efficient reasoning — fast STEM and coding reasoning',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'o3',
        name: 'o3',
        description: 'Most powerful reasoning — frontier performance on hard benchmarks',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'slow', cost: 'high' },
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        description: 'Efficient reasoning — strong on math, science, and code at lower cost',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'o1',
        name: 'o1',
        description: 'Advanced reasoning model for complex problem solving',
        category: 'openai',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 128000, speed: 'slow', cost: 'high' },
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous-generation flagship with broad knowledge and vision',
        category: 'openai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 128000, speed: 'medium', cost: 'medium' },
      },

      // ── Anthropic ────────────────────────────────────────────────────────────
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        description: 'Most powerful Claude — frontier intelligence for complex tasks',
        category: 'anthropic',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'slow', cost: 'high' },
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: 'High performance with excellent coding and analysis capabilities',
        category: 'anthropic',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        description: 'Extended thinking — deep reasoning with visible thought process',
        category: 'anthropic',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 200000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Best balance of speed and intelligence for coding and analysis',
        category: 'anthropic',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 200000, speed: 'fast', cost: 'medium' },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and efficient — near-instant responses for everyday tasks',
        category: 'anthropic',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 200000, speed: 'fast', cost: 'low' },
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Previous-generation flagship for complex reasoning',
        category: 'anthropic',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 200000, speed: 'slow', cost: 'high' },
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest compact model — high throughput, low latency',
        category: 'anthropic',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 200000, speed: 'fast', cost: 'low' },
      },

      // ── Google Gemini ─────────────────────────────────────────────────────────
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Most powerful Gemini — state-of-the-art reasoning and 1M context window',
        category: 'google',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 1000000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Best price-performance — fast multimodal AI with thinking capabilities',
        category: 'google',
        tier: 'high-power',
        capabilities: { extendedThinking: true, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'low' },
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Next-gen speed and multimodal features at low cost',
        category: 'google',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'low' },
      },
      {
        id: 'gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash Lite',
        description: 'Lightest Gemini model — fastest and most cost-efficient',
        category: 'google',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'low' },
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Complex reasoning with industry-leading 2M token context',
        category: 'google',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 2000000, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast versatile multimodal model for diverse tasks',
        category: 'google',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 1000000, speed: 'fast', cost: 'low' },
      },

      // ── xAI / Grok ───────────────────────────────────────────────────────────
      {
        id: 'grok-3',
        name: 'Grok 3',
        description: "xAI's flagship — real-time knowledge, strong reasoning, 131K context",
        category: 'xai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 131072, speed: 'medium', cost: 'medium' },
      },
      {
        id: 'grok-3-mini',
        name: 'Grok 3 Mini',
        description: 'Efficient Grok model — fast reasoning at lower cost',
        category: 'xai',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 131072, speed: 'fast', cost: 'low' },
      },
      {
        id: 'grok-3-fast',
        name: 'Grok 3 Fast',
        description: 'Fastest Grok 3 variant — optimized for speed-critical workloads',
        category: 'xai',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 131072, speed: 'fast', cost: 'high' },
      },

      // ── Moonshot AI / Kimi ────────────────────────────────────────────────────
      {
        id: 'moonshot-v1-8k',
        name: 'Kimi 8K',
        description: 'Fast inference for shorter contexts — ideal for quick tasks',
        category: 'moonshot',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 8192, speed: 'fast', cost: 'low' },
      },
      {
        id: 'moonshot-v1-32k',
        name: 'Kimi 32K',
        description: 'Balanced performance with 32K context window',
        category: 'moonshot',
        tier: 'standard',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 32768, speed: 'fast', cost: 'low' },
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Kimi 128K',
        description: 'Long-context specialist — documents, codebases, long conversations',
        category: 'moonshot',
        tier: 'high-power',
        capabilities: { extendedThinking: false, codeGeneration: true, maxTokens: 131072, speed: 'medium', cost: 'medium' },
      },
    ];
  }

  /**
   * Get high power models only (for High Power Mode toggle)
   */
  getHighPowerModels(): AiModel[] {
    return this.getAvailableModels()
      .filter(m => m.tier === 'high-power')
      .map(m => m.id);
  }

  /**
   * Get models with extended thinking capability
   */
  getExtendedThinkingModels(): AiModel[] {
    return this.getAvailableModels()
      .filter(m => m.capabilities.extendedThinking)
      .map(m => m.id);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: number) {
    return await this.storage.getDynamicIntelligenceSettings(String(userId));
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: number,
    preferences: {
      extendedThinking?: boolean;
      highPowerMode?: boolean;
      autoWebSearch?: boolean;
      preferredModel?: AiModel;
      customInstructions?: string;
      improvePromptEnabled?: boolean;
      progressTabEnabled?: boolean;
      pauseResumeEnabled?: boolean;
      autoCheckpoints?: boolean;
    }
  ) {
    // Validate model if provided
    if (preferences.preferredModel && !AI_MODELS.includes(preferences.preferredModel)) {
      throw new Error(`Invalid model: ${preferences.preferredModel}. Must be one of: ${AI_MODELS.join(', ')}`);
    }

    return await this.storage.updateDynamicIntelligenceSettings(String(userId), preferences);
  }

  /**
   * Get model recommendation based on task complexity and user preferences
   */
  getRecommendedModel(task: {
    requiresExtendedThinking?: boolean;
    highPowerMode?: boolean;
    complexity?: 'simple' | 'medium' | 'complex';
    speedPriority?: 'fast' | 'balanced' | 'quality';
  }): AiModel {
    const { requiresExtendedThinking, highPowerMode, complexity = 'medium', speedPriority = 'balanced' } = task;

    // High power mode always uses premium models
    if (highPowerMode) {
      if (requiresExtendedThinking || complexity === 'complex') {
        return 'claude-opus-4-20250514';
      }
      return 'gpt-4o';
    }

    // Extended thinking required
    if (requiresExtendedThinking) {
      if (speedPriority === 'fast') return 'o4-mini';
      if (speedPriority === 'quality') return 'claude-opus-4-20250514';
      return 'claude-sonnet-4-20250514';
    }

    // Complex tasks
    if (complexity === 'complex') {
      if (speedPriority === 'quality') return 'claude-opus-4-20250514';
      return 'claude-sonnet-4-20250514';
    }

    // Simple tasks prioritizing speed
    if (complexity === 'simple') {
      if (speedPriority === 'fast') return 'claude-3-5-haiku-20241022';
      return 'gpt-4.1-mini';
    }

    // Medium complexity
    if (speedPriority === 'fast') return 'gpt-4.1-mini';
    if (speedPriority === 'quality') return 'claude-sonnet-4-20250514';
    return 'gpt-4.1-mini';
  }

  /**
   * Get recommended fast model for Fast Mode (10-60s targeted changes)
   * Fast Mode prioritizes speed over quality for quick single-file edits
   */
  getFastModel(): AiModel {
    // Priority order for fast models (by speed and availability)
    const fastModels: AiModel[] = [
      'claude-3-5-haiku-20241022',  // Fastest Claude model
      'gpt-4.1-mini',               // Fast GPT model
      'gemini-2.5-flash',           // Fast Gemini model
      'grok-3-mini',                // Fast xAI model
    ];
    
    // Return first available fast model
    const availableModels = this.getAvailableModels();
    const availableIds = availableModels.map(m => m.id);
    
    for (const fastModel of fastModels) {
      if (availableIds.includes(fastModel)) {
        return fastModel;
      }
    }
    
    // Fallback to first model with 'fast' speed rating
    const fastBySpeed = availableModels.find(m => m.capabilities.speed === 'fast');
    return fastBySpeed?.id || 'gpt-4.1-nano';
  }

  /**
   * Get estimated time range for Fast Mode based on model
   */
  getFastModeEstimate(model: AiModel): { min: number; max: number; label: string } {
    const modelInfo = this.getAvailableModels().find(m => m.id === model);
    
    if (modelInfo?.capabilities.speed === 'fast') {
      return { min: 10, max: 30, label: '~20s' };
    }
    if (modelInfo?.capabilities.speed === 'medium') {
      return { min: 30, max: 60, label: '~45s' };
    }
    return { min: 45, max: 90, label: '~60s' };
  }

  /**
   * Get the effective model based on user preferences and tool settings
   */
  getEffectiveModel(settings: {
    preferredModel?: AiModel;
    extendedThinking?: boolean;
    highPowerMode?: boolean;
    taskComplexity?: 'simple' | 'medium' | 'complex';
  }): AiModel {
    const { preferredModel, extendedThinking, highPowerMode, taskComplexity } = settings;

    // If high power mode is on, upgrade to a high-power model
    if (highPowerMode) {
      const highPowerModels = this.getHighPowerModels();
      if (preferredModel && highPowerModels.includes(preferredModel)) {
        return preferredModel;
      }
      // Default high power model
      return 'claude-opus-4-20250514';
    }

    // If extended thinking is on, ensure model supports it
    if (extendedThinking) {
      const thinkingModels = this.getExtendedThinkingModels();
      if (preferredModel && thinkingModels.includes(preferredModel)) {
        return preferredModel;
      }
      // Default extended thinking model
      return 'claude-sonnet-4-20250514';
    }

    // Use preferred model or default
    return preferredModel || 'gpt-4.1-mini';
  }
}
