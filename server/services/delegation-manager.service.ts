/**
 * DelegationManager - Intelligent Model Routing Based on Task Complexity
 * 
 * Fortune 500-grade implementation that:
 * - Routes tasks to appropriate models based on complexity scoring
 * - Checks provider availability before delegation
 * - Falls back gracefully to available providers
 * - Tracks delegation decisions for metrics
 * 
 * @architect Dec 29, 2025: Full integration with AutonomyTaskExecutor
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { orchestratorMetrics } from './orchestrator-metrics.service';

const logger = createLogger('DelegationManager');

export type ModelTier = 'fast' | 'balanced' | 'quality';
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot';

export interface DelegationDecision {
  selectedModel: string;
  selectedProvider: Provider;
  tier: ModelTier;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  fallbackUsed: boolean;
  originalProvider?: Provider;
}

export interface TaskDelegationInput {
  complexityScore: number;
  confidenceScore: number;
  estimatedTokens: number;
  taskType: string;
  preferredProvider?: Provider;
}

/**
 * MODEL_TIERS: Provider-specific models organized by performance/cost trade-offs
 * Each tier maps provider -> model config (null if provider doesn't have a model in that tier)
 */
const MODEL_TIERS: Record<ModelTier, Record<Provider, { model: string; costPer1kTokens: number; avgLatencyMs: number } | null>> = {
  fast: {
    openai: { model: 'gpt-4.1-nano', costPer1kTokens: 0.0001, avgLatencyMs: 300 },
    anthropic: { model: 'claude-3-5-haiku-20241022', costPer1kTokens: 0.001, avgLatencyMs: 600 },
    google: { model: 'gemini-2.5-flash', costPer1kTokens: 0.000075, avgLatencyMs: 400 },
    xai: null,
    moonshot: { model: 'moonshot-v1-32k', costPer1kTokens: 0.0015, avgLatencyMs: 700 }
  },
  balanced: {
    openai: { model: 'gpt-4.1', costPer1kTokens: 0.0008, avgLatencyMs: 800 },
    anthropic: { model: 'claude-sonnet-4-20250514', costPer1kTokens: 0.003, avgLatencyMs: 1200 },
    google: { model: 'gemini-2.5-flash', costPer1kTokens: 0.000075, avgLatencyMs: 800 },
    xai: null,
    moonshot: { model: 'moonshot-v1-128k', costPer1kTokens: 0.0025, avgLatencyMs: 1500 }
  },
  quality: {
    openai: { model: 'gpt-4.1', costPer1kTokens: 0.0008, avgLatencyMs: 1200 },
    anthropic: { model: 'claude-opus-4-20250514', costPer1kTokens: 0.015, avgLatencyMs: 3000 },
    google: { model: 'gemini-2.5-pro', costPer1kTokens: 0.00125, avgLatencyMs: 2500 },
    xai: { model: 'grok-3', costPer1kTokens: 0.003, avgLatencyMs: 2000 },
    moonshot: { model: 'moonshot-v1-128k', costPer1kTokens: 0.0025, avgLatencyMs: 2000 }
  }
};

/**
 * Complexity thresholds for tier selection
 */
const COMPLEXITY_THRESHOLDS = {
  fast: 3,      // complexity < 3 -> fast tier
  balanced: 7,  // complexity 3-7 -> balanced tier
  quality: 10   // complexity > 7 -> quality tier
};

/**
 * Provider availability cache with TTL
 */
interface ProviderStatus {
  available: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
}

class DelegationManagerService extends EventEmitter {
  private providerStatus: Map<Provider, ProviderStatus> = new Map();
  private readonly STATUS_TTL_MS = 60000; // 1 minute cache
  private readonly MAX_FAILURES_BEFORE_UNAVAILABLE = 3;
  
  constructor() {
    super();
    this.initializeProviderStatus();
    logger.info('DelegationManager initialized with complexity-based routing');
  }
  
  private initializeProviderStatus(): void {
    const providers: Provider[] = ['openai', 'anthropic', 'google', 'xai', 'moonshot'];
    providers.forEach(provider => {
      this.providerStatus.set(provider, {
        available: this.checkProviderConfigured(provider),
        lastChecked: new Date(),
        consecutiveFailures: 0
      });
    });
  }
  
  /**
   * Check if a provider has required environment configuration
   */
  private checkProviderConfigured(provider: Provider): boolean {
    switch (provider) {
      case 'openai':
        return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
      case 'anthropic':
        return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
      case 'google':
        return !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
      case 'xai':
        return !!(process.env.AI_INTEGRATIONS_XAI_API_KEY || process.env.XAI_API_KEY);
      case 'moonshot':
        return !!(process.env.MOONSHOT_API_KEY);
      default:
        return false;
    }
  }
  
  /**
   * Determine the appropriate tier based on complexity score
   */
  private determineTier(complexityScore: number): ModelTier {
    if (complexityScore < COMPLEXITY_THRESHOLDS.fast) {
      return 'fast';
    } else if (complexityScore <= COMPLEXITY_THRESHOLDS.balanced) {
      return 'balanced';
    } else {
      return 'quality';
    }
  }
  
  /**
   * Check if a provider is currently available
   */
  isProviderAvailable(provider: Provider): boolean {
    const status = this.providerStatus.get(provider);
    if (!status) return false;
    
    // Refresh status if cache expired
    if (Date.now() - status.lastChecked.getTime() > this.STATUS_TTL_MS) {
      status.available = this.checkProviderConfigured(provider);
      status.lastChecked = new Date();
    }
    
    return status.available && status.consecutiveFailures < this.MAX_FAILURES_BEFORE_UNAVAILABLE;
  }
  
  /**
   * Get all available providers for a given tier
   */
  getAvailableProvidersForTier(tier: ModelTier): Provider[] {
    const tierConfig = MODEL_TIERS[tier];
    const available: Provider[] = [];
    
    for (const [provider, config] of Object.entries(tierConfig)) {
      if (config && this.isProviderAvailable(provider as Provider)) {
        available.push(provider as Provider);
      }
    }
    
    return available;
  }
  
  /**
   * Find the best fallback provider when preferred is unavailable
   */
  private findFallbackProvider(tier: ModelTier, excludeProvider?: Provider): { provider: Provider; model: string } | null {
    const tierConfig = MODEL_TIERS[tier];
    
    // Priority order for fallback
    const priorityOrder: Provider[] = ['openai', 'anthropic', 'google', 'moonshot', 'xai'];
    
    for (const provider of priorityOrder) {
      if (provider === excludeProvider) continue;
      if (tierConfig[provider] && this.isProviderAvailable(provider)) {
        return { provider, model: tierConfig[provider]!.model };
      }
    }
    
    // If no provider available in this tier, try adjacent tiers
    const tierOrder: ModelTier[] = tier === 'fast' ? ['balanced', 'quality'] : 
                                   tier === 'quality' ? ['balanced', 'fast'] : 
                                   ['fast', 'quality'];
    
    for (const fallbackTier of tierOrder) {
      for (const provider of priorityOrder) {
        const config = MODEL_TIERS[fallbackTier][provider];
        if (config && this.isProviderAvailable(provider)) {
          logger.warn(`Using ${fallbackTier} tier as fallback (original tier: ${tier})`);
          return { provider, model: config.model };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Main delegation method - selects the appropriate model based on task complexity
   */
  async delegateTask(input: TaskDelegationInput): Promise<DelegationDecision> {
    const startTime = Date.now();
    const tier = this.determineTier(input.complexityScore);
    const preferredProvider = input.preferredProvider || 'openai';
    
    logger.info(`Delegating task: complexity=${input.complexityScore}, tier=${tier}, preferred=${preferredProvider}`);
    
    let selectedProvider = preferredProvider;
    let selectedModel: string;
    let fallbackUsed = false;
    let originalProvider: Provider | undefined;
    
    // Check if preferred provider is available for this tier
    const tierConfig = MODEL_TIERS[tier][preferredProvider];
    
    if (tierConfig && this.isProviderAvailable(preferredProvider)) {
      selectedModel = tierConfig.model;
    } else {
      // Find fallback
      originalProvider = preferredProvider;
      const fallback = this.findFallbackProvider(tier, preferredProvider);
      
      if (fallback) {
        selectedProvider = fallback.provider;
        selectedModel = fallback.model;
        fallbackUsed = true;
        logger.warn(`Using fallback: ${selectedProvider}/${selectedModel} (preferred ${preferredProvider} unavailable)`);
      } else {
        // Last resort: use any available model
        selectedProvider = 'openai';
        selectedModel = 'gpt-4.1';
        fallbackUsed = true;
        logger.error('No providers available, using last resort: gpt-4.1');
      }
    }
    
    // Calculate estimates
    const modelConfig = MODEL_TIERS[tier][selectedProvider] || MODEL_TIERS.balanced.openai!;
    const estimatedCost = (input.estimatedTokens / 1000) * (modelConfig?.costPer1kTokens || 0.001);
    const estimatedLatency = modelConfig?.avgLatencyMs || 1000;
    
    const decision: DelegationDecision = {
      selectedModel,
      selectedProvider,
      tier,
      reason: this.buildDecisionReason(input, tier, fallbackUsed),
      estimatedCost,
      estimatedLatency,
      fallbackUsed,
      originalProvider: fallbackUsed ? originalProvider : undefined
    };
    
    // Emit delegation event for monitoring
    this.emit('delegation:decision', {
      ...decision,
      input,
      decisionTimeMs: Date.now() - startTime
    });
    
    logger.info(`Delegation decision: ${selectedProvider}/${selectedModel} (tier: ${tier}, cost: $${estimatedCost.toFixed(4)})`);
    
    return decision;
  }
  
  /**
   * Build human-readable decision reason
   */
  private buildDecisionReason(input: TaskDelegationInput, tier: ModelTier, fallbackUsed: boolean): string {
    const complexityDesc = input.complexityScore < 3 ? 'simple' : 
                          input.complexityScore <= 7 ? 'moderate' : 'complex';
    
    let reason = `Task complexity ${input.complexityScore}/10 (${complexityDesc}) → ${tier} tier`;
    
    if (fallbackUsed) {
      reason += ` (fallback: preferred provider unavailable)`;
    }
    
    if (input.confidenceScore < 0.5) {
      reason += ` | Low confidence (${(input.confidenceScore * 100).toFixed(0)}%) - may need rework`;
    }
    
    return reason;
  }
  
  /**
   * Report provider failure for circuit breaker logic
   */
  reportProviderFailure(provider: Provider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.consecutiveFailures++;
      status.lastChecked = new Date();
      
      if (status.consecutiveFailures >= this.MAX_FAILURES_BEFORE_UNAVAILABLE) {
        status.available = false;
        logger.warn(`Provider ${provider} marked unavailable after ${status.consecutiveFailures} failures`);
        this.emit('provider:unavailable', { provider, failures: status.consecutiveFailures });
      }
    }
  }
  
  /**
   * Report provider success - resets failure counter
   */
  reportProviderSuccess(provider: Provider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.consecutiveFailures = 0;
      status.available = true;
      status.lastChecked = new Date();
    }
  }
  
  /**
   * Get current provider health status
   */
  getProviderHealth(): Record<Provider, { available: boolean; failures: number }> {
    const health: Record<string, { available: boolean; failures: number }> = {};
    
    this.providerStatus.forEach((status, provider) => {
      health[provider] = {
        available: status.available && status.consecutiveFailures < this.MAX_FAILURES_BEFORE_UNAVAILABLE,
        failures: status.consecutiveFailures
      };
    });
    
    return health as Record<Provider, { available: boolean; failures: number }>;
  }
  
  /**
   * Get tier configuration for debugging/monitoring
   */
  getTierConfiguration(): typeof MODEL_TIERS {
    return MODEL_TIERS;
  }
}

export const delegationManager = new DelegationManagerService();
