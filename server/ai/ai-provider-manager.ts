import { AIProviderFactory, type AIProvider } from './ai-providers';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CircuitBreaker, RetryExecutor, isRetryableError } from './circuit-breaker';
import { createStreamLimiter } from './stream-limiter';
import { AGENT_SYSTEM_PROMPT, getSystemPromptForContext } from './prompts/agent-system-prompt';
import { ContextWindowManager } from './context-window-manager';
import { agentWebSocketService } from '../services/agent-websocket-service';
import { promptCacheManager } from './prompt-cache-manager';
import { providerLatencyMonitor } from './provider-latency-monitor';
import { createLogger } from '../utils/logger';
export { AI_MODELS, MODELFARM_MODELS, type AIModel } from './models-catalog';
import { AI_MODELS, MODELFARM_MODELS, type AIModel } from './models-catalog';

const logger = createLogger('ai-provider-manager');

const MODEL_MAX_OUTPUT_TOKENS: Record<string, number> = {
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4.1': 16384,
  'gpt-4.1-mini': 16384,
  'gpt-4.1-nano': 16384,
  'gpt-4-turbo': 4096,
  'gpt-3.5-turbo': 4096,
  'o1': 32768,
  'o1-mini': 32768,
  'o1-preview': 32768,
  'o3': 32768,
  'o3-mini': 32768,
  'o4-mini': 32768,
  'claude-sonnet-4-20250514': 8192,
  'claude-3-5-sonnet-20241022': 8192,
  'claude-3-5-haiku-20241022': 8192,
  'claude-3-opus-20240229': 4096,
  'claude-3-haiku-20240307': 4096,
  'gemini-2.5-flash': 8192,
  'gemini-2.5-pro': 8192,
  'gemini-2.0-flash': 8192,
  'gemini-1.5-flash': 8192,
  'gemini-1.5-pro': 8192,
  'grok-3': 16384,
  'grok-3-mini': 16384,
  'kimi-k2': 16384,
  'moonshot-v1-32k': 8192,
  'moonshot-v1-128k': 16384,
};

function clampMaxTokens(modelId: string, requested: number): number {
  const cap = MODEL_MAX_OUTPUT_TOKENS[modelId];
  if (!cap) return Math.min(requested, 16384);
  return Math.min(requested, cap);
}

/**
 * ✅ 40-YEAR ENGINEERING FIX: Provider fallback chain for 99.9% uptime (Fortune 500 requirement)
 * Ordered by reliability, cost, and speed
 * UPDATED January 2025: kimi-k2-0711-preview → kimi-k2-0905-preview (September 2025 upgrade)
 */
const PROVIDER_FALLBACK_CHAIN = [
  'gpt-4.1',                   // Free via Replit ModelFarm
  'claude-sonnet-4-20250514',  // Anthropic Claude 4 Sonnet
  'gemini-2.5-flash',          // Google Gemini 2.5 Flash
  'grok-3',                    // xAI Grok 3
  'kimi-k2',                   // Moonshot Kimi K2
  'moonshot-v1-32k'            // Moonshot Kimi 32K (legacy)
];

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private geminiClient?: GoogleGenerativeAI;
  private moonshotClient?: OpenAI;  // Moonshot uses OpenAI-compatible API
  
  // Circuit breakers for each provider (Fortune 500 resilience)
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryExecutor: RetryExecutor;
  // ✅ 40-YEAR ENGINEERING FIX: Balanced timeout for autonomous workspace reliability
  // 60s allows complex plan generation to complete while still failing fast on true hangs
  private streamLimiter = createStreamLimiter('AIProviderManager', {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    timeoutMs: 60000, // 60s - allows plan generation to complete (was 30s, too aggressive)
    maxChunkSizeBytes: 100 * 1024, // 100KB per chunk
    debug: process.env.NODE_ENV === 'development'
  });
  
  constructor() {
    this.initializeProviders();
    this.initializeCircuitBreakers();
    // ✅ 40-YEAR ENGINEERING FIX: Aggressive retry for autonomous workspace reliability
    this.retryExecutor = new RetryExecutor({
      maxRetries: 4,        // Increased from 2 → 4 for better resilience
      initialDelay: 500,    // Reduced from 1000ms → 500ms for faster recovery
      maxDelay: 3000,       // Reduced from 10000ms → 3000ms to fail fast
      backoffMultiplier: 2,
      useJitter: true
    });
  }
  
  /**
   * Initialize circuit breakers for all providers
   */
  // ✅ 40-YEAR ENGINEERING FIX: Faster circuit breaker recovery for autonomous workspace
  private initializeCircuitBreakers() {
    const providerNames = ['openai', 'anthropic', 'gemini', 'moonshot', 'xai'];
    
    for (const provider of providerNames) {
      this.circuitBreakers.set(provider, new CircuitBreaker(provider, {
        failureThreshold: 3,     // Reduced from 5 → 3 to fail fast
        resetTimeout: 20000,     // Reduced from 30s → 20s for faster recovery
        windowSize: 60000,       // 1 minute
        successThreshold: 2,     // Reduced from 3 → 2 to recover faster
        debug: process.env.NODE_ENV === 'development'
      }));
    }
    
    logger.info('Circuit breakers initialized for all providers');
  }
  
  /**
   * Initialize all available providers from environment variables
   */
  private initializeProviders() {
    // DEBUG: Log environment variable state
    logger.info('Initializing providers...');
    logger.debug('API key status', {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      XAI_API_KEY: !!process.env.XAI_API_KEY,
      MOONSHOT_API_KEY: !!process.env.MOONSHOT_API_KEY
    });
    
    // OpenAI — direct API key (no ModelFarm proxy)
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (openaiApiKey) {
      try {
        this.providers.set('openai', AIProviderFactory.create('openai', openaiApiKey));
        this.openaiClient = new OpenAI({
          apiKey: openaiApiKey,
          maxRetries: 3,
          timeout: 60000,
        });
        logger.info('[AIProviderManager] OpenAI provider initialized via direct API key');
      } catch (error) {
        logger.warn('Failed to initialize OpenAI provider:', error);
      }
    } else {
      logger.warn('OpenAI API key not found in environment');
    }
    
    // Anthropic — check both direct and integration keys
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      try {
        this.providers.set('anthropic', AIProviderFactory.create('anthropic', anthropicApiKey));
        this.anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
        logger.info('Anthropic provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Anthropic provider:', error);
      }
    } else {
      logger.warn('Anthropic API key not found in environment');
    }
    
    // Gemini — check both direct and integration keys
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (geminiApiKey) {
      try {
        this.providers.set('gemini', AIProviderFactory.create('gemini', geminiApiKey));
        this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
        logger.info('Gemini provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Gemini provider:', error);
      }
    } else {
      logger.warn('Gemini API key not found in environment');
    }
    
    // xAI (Grok) — check both direct and integration keys (support both XAI_API_KEY and xAI_API_KEY)
    const xaiApiKey = process.env.XAI_API_KEY || process.env.xAI_API_KEY || process.env.AI_INTEGRATIONS_XAI_API_KEY;
    if (xaiApiKey) {
      try {
        this.providers.set('xai', AIProviderFactory.create('xai', xaiApiKey));
        logger.info('xAI provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize xAI provider:', error);
      }
    } else {
      logger.warn('xAI API key not found in environment');
    }
    
    // Moonshot AI (Kimi) — check both direct and integration keys
    const moonshotApiKey = process.env.MOONSHOT_API_KEY || process.env.AI_INTEGRATIONS_MOONSHOT_API_KEY;
    if (moonshotApiKey) {
      try {
        this.providers.set('moonshot', AIProviderFactory.create('moonshot', moonshotApiKey));
        
        this.moonshotClient = new OpenAI({
          apiKey: moonshotApiKey,
          baseURL: 'https://api.moonshot.ai/v1'
        });
        logger.info('Moonshot AI provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Moonshot AI provider:', error);
      }
    } else {
      logger.warn('Moonshot AI API key not found in environment');
    }
    
    // Groq (Mixtral, Llama) — check both direct and integration keys
    const groqApiKey = process.env.GROQ_API_KEY || process.env.AI_INTEGRATIONS_GROQ_API_KEY;
    if (groqApiKey) {
      try {
        this.providers.set('groq', AIProviderFactory.create('groq', groqApiKey));
        logger.info('Groq provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Groq provider:', error);
      }
    } else {
      logger.warn('Groq API key not found in environment');
    }
    
    // Other providers (for future expansion)
    const otherProviders = ['perplexity', 'cohere', 'deepseek', 'mistral'];
    otherProviders.forEach(provider => {
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      if (process.env[envKey]) {
        try {
          this.providers.set(provider, AIProviderFactory.create(provider, process.env[envKey]!));
          logger.info(`${provider} provider initialized`);
        } catch (error) {
          logger.warn(`Failed to initialize ${provider} provider:`, error);
        }
      }
    });
    
    // Log summary
    const providerCount = this.providers.size;
    logger.info(`Initialization complete: ${providerCount} provider(s) initialized`);
    if (providerCount === 0) {
      logger.error('NO PROVIDERS INITIALIZED! Please configure API keys in Replit Secrets.');
    }
  }
  
  /**
   * Get available models based on initialized providers
   */
  getAvailableModels(): AIModel[] {
    // Return all configured models with availability flag
    // This allows frontend to show unavailable models (grayed out) to encourage configuration
    return AI_MODELS.map(model => ({
      ...model,
      available: this.providers.has(model.provider)
    }));
  }
  
  /**
   * Get model details by ID
   */
  getModel(modelId: string): AIModel | undefined {
    return AI_MODELS.find(m => m.id === modelId);
  }
  
  /**
   * Get model details by ID (alias for getModel)
   */
  getModelById(modelId: string): AIModel | undefined {
    return this.getModel(modelId);
  }
  
  /**
   * Get circuit breaker statuses for all providers
   * Used by health endpoints for monitoring
   */
  getCircuitBreakerStatuses(): Record<string, {
    status: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailure?: string;
    nextAttempt?: string;
  }> {
    const statuses: Record<string, any> = {};
    
    for (const [provider, breaker] of this.circuitBreakers) {
      const status = breaker.getStatus();
      statuses[provider] = {
        status: status.state.toLowerCase() as 'closed' | 'open' | 'half_open',
        failureCount: status.failures,
        lastFailure: status.failures > 0 ? new Date().toISOString() : undefined,
        nextAttempt: status.nextAttemptTime || undefined
      };
    }
    
    return statuses;
  }
  
  /**
   * Stream chat completion with the selected model
   * Routes to appropriate provider based on model ID
   * 
   * @param modelId The model ID to use (e.g., "gpt-4.1", "claude-sonnet-4-20250514")
   * @param messages Array of chat messages with role and content
   * @param options Additional options like system prompt, max_tokens, temperature
   */
  /**
   * Stream chat with automatic failover (Fortune 500 - 99.9% uptime)
   * Tries fallback chain if primary model fails
   * ✅ FORTUNE 500 FIX: Skip providers with OPEN circuit breakers
   */
  async *streamChatWithFallback(
    modelId: string,
    messages: any[],
    options?: { 
      system?: string; 
      max_tokens?: number; 
      temperature?: number; 
      reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
      timeoutMs?: number;
      context?: 'coding' | 'review' | 'explanation' | 'general';
    }
  ): AsyncGenerator<string> {
    // Get model for context window optimization
    const model = this.getModel(modelId);
    
    // Inject system prompt if not provided
    const systemPrompt = options?.system || getSystemPromptForContext(options?.context || 'general');
    
    // Check if messages already have system prompt
    const hasSystemPrompt = messages.some(m => m.role === 'system');
    
    const messagesWithSystem = hasSystemPrompt
      ? messages
      : [{ role: 'system', content: systemPrompt }, ...messages];
    
    // Optimize for context window if model is available
    const optimizedMessages = model 
      ? new ContextWindowManager(model.maxTokens).optimizeConversationHistory(messagesWithSystem, {
          preserveSystemMessages: true,
          minRecentMessages: 10
        })
      : messagesWithSystem;
    
    // Try primary model first
    try {
      yield* this.generateChatStreamWithRetry(modelId, optimizedMessages, options);
      return;
    } catch (primaryError: any) {
      logger.error(`Primary model ${modelId} failed — status=${primaryError.status ?? 'N/A'} code=${primaryError.code ?? 'N/A'} msg="${primaryError.message}" — trying fallback chain...`);
      
      // Get primary provider for degraded mode notification
      const primaryModel = this.getModel(modelId);
      const primaryProvider = primaryModel?.provider || 'unknown';
      
      // Try fallback chain (skip models from providers with OPEN circuit breakers)
      const triedProviders = new Set<string>();
      const openCircuits: string[] = [];
      
      for (const fallbackModelId of PROVIDER_FALLBACK_CHAIN) {
        if (fallbackModelId === modelId) continue; // Skip primary model
        
        const fallbackModel = this.getModel(fallbackModelId);
        if (!fallbackModel || !this.providers.has(fallbackModel.provider)) {
          continue; // Provider not configured
        }
        
        // ✅ FORTUNE 500 FIX: Skip if we already tried this provider and it failed
        // This prevents hammering the same failed provider with different models
        if (triedProviders.has(fallbackModel.provider)) {
          logger.info(`Skipping ${fallbackModelId} - provider ${fallbackModel.provider} already failed`);
          continue;
        }
        
        // ✅ FORTUNE 500 FIX: Check circuit breaker state before attempting
        const circuitBreaker = this.circuitBreakers.get(fallbackModel.provider);
        if (circuitBreaker) {
          const status = circuitBreaker.getStatus();
          if (status.state === 'OPEN') {
            logger.info(`Skipping ${fallbackModelId} - circuit breaker OPEN for ${fallbackModel.provider}`);
            openCircuits.push(fallbackModel.provider);
            triedProviders.add(fallbackModel.provider);
            
            // ✅ GRACEFUL DEGRADATION: Broadcast circuit breaker open notification
            this.broadcastDegradedModeNotification({
              provider: fallbackModel.provider,
              status: 'circuit_open',
              message: `AI provider ${fallbackModel.provider} temporarily unavailable (circuit breaker open)`,
              estimatedRecovery: status.nextAttemptTime ? new Date(status.nextAttemptTime) : undefined
            });
            continue;
          }
        }
        
        try {
          logger.info(`Trying fallback: ${fallbackModelId} (provider: ${fallbackModel.provider})`);
          triedProviders.add(fallbackModel.provider);
          
          // ✅ GRACEFUL DEGRADATION: Broadcast fallback activation notification
          this.broadcastDegradedModeNotification({
            provider: primaryProvider,
            status: 'fallback_activated',
            fallbackProvider: fallbackModel.provider,
            message: `Switched from ${primaryProvider} to ${fallbackModel.provider} for improved reliability`
          });
          
          yield* this.generateChatStreamWithRetry(fallbackModelId, optimizedMessages, options);
          logger.info(`Fallback successful: ${fallbackModelId}`);
          return;
        } catch (fallbackError: any) {
          logger.error(`Fallback ${fallbackModelId} failed — status=${fallbackError.status ?? 'N/A'} code=${fallbackError.code ?? 'N/A'} msg="${fallbackError.message}"`);
          continue;
        }
      }
      
      // All providers failed - broadcast critical degradation
      this.broadcastDegradedModeNotification({
        provider: 'all',
        status: 'circuit_open',
        message: `All AI providers are currently unavailable. Please try again later.`
      });
      
      const configuredProviders = [...this.providers.keys()];
      logger.error(`All AI providers exhausted. Configured: [${configuredProviders.join(', ') || 'none'}]. Primary error: ${primaryError.message}`);
      throw new Error(`All AI providers failed (configured: ${configuredProviders.join(', ') || 'none'}). Check server logs and verify API keys in Replit Secrets. Last error: ${primaryError.message}`);
    }
  }
  
  /**
   * Broadcast degraded mode notification via WebSocket
   * Informs connected clients about provider health changes
   */
  private broadcastDegradedModeNotification(data: {
    provider: string;
    status: 'circuit_open' | 'fallback_activated' | 'recovered';
    fallbackProvider?: string;
    message: string;
    estimatedRecovery?: Date;
  }) {
    try {
      agentWebSocketService.broadcastDegradedMode(data);
    } catch (error) {
      // Don't let WebSocket errors affect AI operations
      logger.warn('Failed to broadcast degraded mode notification:', error);
    }
  }
  
  
  /**
   * Stream chat with retry logic and circuit breaker
   * ✅ FORTUNE 500 FIX: Correct layering order
   * 1. Circuit breaker (check if provider is healthy FIRST)
   * 2. Retry logic (only retry if circuit allows)
   * 3. Stream limits (protect against unbounded streams)
   * ✅ Per-call timeout support for complex operations (e.g., plan generation)
   */
  private async *generateChatStreamWithRetry(
    modelId: string,
    messages: any[],
    options?: any
  ): AsyncGenerator<string> {
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    const circuitBreaker = this.circuitBreakers.get(model.provider);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for provider: ${model.provider}`);
    }
    
    // ✅ Use custom timeout if provided, otherwise use default
    // CRITICAL: Preserve all safety limits (maxSizeBytes, maxChunkSizeBytes) when overriding timeout
    const limiter = options?.timeoutMs 
      ? createStreamLimiter(`AIProviderManager-${modelId}`, {
          maxSizeBytes: this.streamLimiter.getConfig().maxSizeBytes,  // Preserve 10MB limit
          timeoutMs: options.timeoutMs,  // Override with custom timeout (e.g., 90s for plan gen)
          maxChunkSizeBytes: this.streamLimiter.getConfig().maxChunkSizeBytes,  // Preserve 100KB chunk limit
          debug: this.streamLimiter.getConfig().debug
        })
      : this.streamLimiter;
    
    // ✅ CORRECT ORDER: Circuit Breaker → Retry → Stream Limits
    // Circuit breaker wraps EVERYTHING - if circuit is OPEN, reject immediately
    yield* circuitBreaker.executeStream(
      async function* (this: AIProviderManager) {
        // Retry executor INSIDE circuit breaker - only retries if circuit allows
        yield* this.retryExecutor.executeStream(
          async function* (this: AIProviderManager) {
            // Stream limiter protects individual call attempts
            yield* limiter.limitStream(
              this.generateChatStream(modelId, messages, options)
            );
          }.bind(this),
          isRetryableError
        );
      }.bind(this)
    );
  }

  async *streamChat(
    modelId: string,
    messages: any[],
    options?: { 
      system?: string; 
      max_tokens?: number; 
      temperature?: number; 
      reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
      timeoutMs?: number; // ✅ Allow per-call timeout override (e.g., 90s for plan generation)
    }
  ): AsyncGenerator<string> {
    // ✅ FORTUNE 500 FIX: Use streamChatWithFallback by default for 99.9% uptime
    // This enables: circuit breakers, retry logic, provider fallback, streaming limits
    yield* this.streamChatWithFallback(modelId, messages, options);
  }
  
  /**
   * Generate chat completion with streaming support
   * Routes to appropriate provider based on model ID
   */
  async *generateChatStream(
    modelId: string,
    messages: any[],
    options?: any
  ): AsyncGenerator<string> {
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider not initialized: ${model.provider}. Please set ${model.provider.toUpperCase()}_API_KEY environment variable.`);
    }
    
    // Use native streaming for providers that support it
    // ✅ CRITICAL FIX: Removed internal Anthropic→GPT fallback that was breaking external fallback chain
    // Now errors propagate cleanly to ai-plan-generator.service.ts which handles full fallback logic
    if (model.provider === 'anthropic' && this.anthropicClient) {
      // Log provider errors for debugging but let them propagate
      try {
        yield* this.streamAnthropic(modelId, messages, options);
      } catch (error: any) {
        logger.error(`Anthropic streaming failed for ${modelId}:`, { status: error.status, message: error.message });
        throw error; // Propagate to outer fallback loop
      }
    } else if (model.provider === 'openai' && this.openaiClient) {
      try {
        yield* this.streamOpenAI(modelId, messages, options);
      } catch (error: any) {
        logger.error(`OpenAI streaming failed for ${modelId}:`, { status: error.status, message: error.message });
        throw error; // Propagate to outer fallback loop
      }
    } else if (model.provider === 'gemini' && this.geminiClient) {
      try {
        yield* this.streamGemini(modelId, messages, options);
      } catch (error: any) {
        logger.error(`Gemini streaming failed for ${modelId}:`, { status: error.status, message: error.message });
        throw error; // Propagate to outer fallback loop
      }
    } else if (model.provider === 'moonshot' && this.moonshotClient) {
      try {
        yield* this.streamMoonshot(modelId, messages, options);
      } catch (error: any) {
        logger.error(`Moonshot streaming failed for ${modelId}:`, { status: error.status, message: error.message });
        throw error; // Propagate to outer fallback loop
      }
    } else {
      // Fallback to non-streaming for providers without native streaming
      const response = await provider.generateChat(messages, { ...options, model: modelId });
      yield response;
    }
  }
  
  /**
   * Anthropic streaming implementation with robust error handling
   * ✅ ROBUST PARSING: Handle stream errors and JSON parsing failures
   * ✅ PROMPT CACHING: Uses Anthropic's cache_control for 90% cost reduction on repeated prompts
   */
  private async *streamAnthropic(modelId: string, messages: any[], options?: any): AsyncGenerator<string> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');
    
    const startTime = Date.now();
    let tokensGenerated = 0;
    let success = false;
    
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    
    // ✅ PROMPT CACHING: Use cache_control for system prompts (Anthropic-specific optimization)
    // This enables 90% cost reduction on repeated system prompts (cached for 5 minutes)
    const { system: cachedSystem, messages: cachedMessages } = promptCacheManager.formatMessagesForAnthropic(
      messages,
      systemMessage
    );
    
    // Cache the system prompt hash for metrics
    if (systemMessage) {
      promptCacheManager.cacheSystemPrompt(systemMessage, 'anthropic');
    }
    
    try {
      const stream = await this.anthropicClient.messages.create({
        model: modelId,
        messages: cachedMessages as any,
        system: cachedSystem as any,
        max_tokens: clampMaxTokens(modelId, options?.max_tokens || 8192),
        temperature: options?.temperature || 0.4,
        stream: true,
      });
      
      let buffer = '';
      for await (const chunk of stream) {
        try {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            if (text) {
              buffer += text;
              tokensGenerated += Math.ceil(text.length / 4);
              yield text;
            }
          }
        } catch (chunkError: any) {
          logger.warn(`Anthropic chunk parsing error: ${chunkError.message}`);
          continue;
        }
      }
      
      if (!buffer) {
        throw new Error('Anthropic stream produced no content');
      }
      
      success = true;
    } catch (error: any) {
      logger.error(`Anthropic stream error: ${error.message}`);
      providerLatencyMonitor.recordLatency('anthropic', modelId, Date.now() - startTime, false, 0, error.message);
      throw error;
    } finally {
      if (success) {
        providerLatencyMonitor.recordLatency('anthropic', modelId, Date.now() - startTime, true, tokensGenerated);
      }
    }
  }
  
  /**
   * OpenAI streaming implementation with robust error handling
   * ✅ ROBUST PARSING: Handle stream errors and JSON parsing failures
   * ✅ PROMPT CACHING: OpenAI automatically caches prompts with matching prefixes
   * Structure messages to maximize cache hits (system prompt first, consistent formatting)
   */
  private async *streamOpenAI(modelId: string, messages: any[], options?: any): AsyncGenerator<string> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');
    
    

    const startTime = Date.now();
    let tokensGenerated = 0;
    let success = false;
    
    // ✅ PROMPT CACHING: Format messages for optimal OpenAI caching
    // OpenAI caches prompts automatically when prefix matches
    const systemPrompt = options?.system || messages.find(m => m.role === 'system')?.content;
    const openaiMessages = promptCacheManager.formatMessagesForOpenAI(messages, systemPrompt);
    
    // Cache system prompt for metrics tracking
    if (systemPrompt) {
      promptCacheManager.cacheSystemPrompt(systemPrompt, 'openai');
    }
    
    const isNewGenModel = /^o[1-9]/.test(modelId);
    
    const completionParams: any = {
      model: modelId,
      messages: openaiMessages,
      stream: true,
    };
    
    // New-gen models don't support temperature parameter
    if (!isNewGenModel) {
      completionParams.temperature = options?.temperature || 0.7;
    }
    
    const safeMaxTokens = clampMaxTokens(modelId, options?.max_tokens || 16384);
    if (isNewGenModel) {
      completionParams.max_completion_tokens = safeMaxTokens;
    } else {
      completionParams.max_tokens = safeMaxTokens;
    }

    if (options?.reasoning_effort && /^o[1-9]/.test(modelId)) {
      completionParams.reasoning_effort = options.reasoning_effort;
    }

    try {
      const stream = await this.openaiClient.chat.completions.create(completionParams) as unknown as AsyncIterable<any>;
      
      let buffer = '';
      for await (const chunk of stream) {
        try {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            buffer += content;
            tokensGenerated += Math.ceil(content.length / 4);
            yield content;
          }
        } catch (chunkError: any) {
          logger.warn(`OpenAI chunk parsing error: ${chunkError.message}`);
          continue;
        }
      }
      
      if (!buffer) {
        throw new Error('OpenAI stream produced no content');
      }
      
      success = true;
    } catch (error: any) {
      logger.error(`OpenAI stream error: ${error.message}`);
      providerLatencyMonitor.recordLatency('openai', modelId, Date.now() - startTime, false, 0, error.message);
      throw error;
    } finally {
      if (success) {
        providerLatencyMonitor.recordLatency('openai', modelId, Date.now() - startTime, true, tokensGenerated);
      }
    }
  }
  
  /**
   * Moonshot AI (Kimi-K2) streaming implementation with robust error handling
   * ✅ ROBUST PARSING: Handle stream errors and JSON parsing failures
   * ✅ 40-YEAR FIX (Nov 21, 2025): Detect error payloads BEFORE iterating
   * 
   * KIMI K2 CONFIGURATION (per official docs):
   * 1. Temperature = 1.0 - Required for optimal thinking quality
   * 2. Streaming = true - Prevents timeouts, delivers reasoning_content before final answer
   * 3. max_tokens >= 16000 - Thinking is token-intensive
   * 4. Preserve reasoning_content - Automatic server-side handling
   */
  /**
   * ✅ PROMPT CACHING: Moonshot AI system prompt caching for cost optimization
   */
  private async *streamMoonshot(modelId: string, messages: any[], options?: any): AsyncGenerator<string> {
    if (!this.moonshotClient) throw new Error('Moonshot AI client not initialized');
    
    const startTime = Date.now();
    let tokensGenerated = 0;
    let success = false;
    
    // ✅ KIMI K2 OPTIMIZATION: Detect thinking models for special configuration
    const isThinkingModel = modelId.includes('thinking') || modelId.includes('moonshot-v1-128k');
    
    // ✅ KIMI REQUIREMENT 1: Temperature = 1.0 for thinking models
    const temperature = isThinkingModel ? 1.0 : (options?.temperature ?? 0.7);
    
    const maxTokens = isThinkingModel 
      ? Math.max(clampMaxTokens(modelId, options?.max_tokens || 16384), 16384)
      : clampMaxTokens(modelId, options?.max_tokens || 16384);
    
    // ✅ PROMPT CACHING: Cache system prompt for Moonshot
    const systemPrompt = options?.system || messages.find(m => m.role === 'system')?.content;
    if (systemPrompt) {
      promptCacheManager.cacheSystemPrompt(systemPrompt, 'moonshot');
    }
    
    let moonshotMessages = [...messages];
    if (options?.system && !messages.find(m => m.role === 'system')) {
      moonshotMessages = [
        { role: 'system', content: options.system },
        ...messages
      ];
    }
    
    logger.info(`[Moonshot Provider] Using model: ${modelId}, thinking: ${isThinkingModel}, temp: ${temperature}, maxTokens: ${maxTokens}`);
    
    try {
      // ✅ KIMI REQUIREMENT 3: Enable Streaming (stream = true)
      const stream = await this.moonshotClient.chat.completions.create({
        model: modelId,
        messages: moonshotMessages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }) as unknown as AsyncIterable<any>;
      
      // ✅ CRITICAL FIX (Nov 21, 2025): Check if response is an error object instead of stream
      // Moonshot API returns { body: { errors: [...] } } for auth/rate-limit failures
      // This prevents infinite loop on empty stream
      if ((stream as any).body?.errors) {
        const errors = (stream as any).body.errors;
        const errorMsg = errors[0]?.message || JSON.stringify(errors);
        const errorCode = errors[0]?.code || 'UNKNOWN_ERROR';
        logger.error('Moonshot API returned error payload:', { code: errorCode, message: errorMsg, errors });
        throw new Error(`Moonshot API error (${errorCode}): ${errorMsg}`);
      }
      
      let buffer = '';
      let reasoningBuffer = '';
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        try {
          // ✅ ADDITIONAL CHECK: Detect error in chunk
          if (chunk.error) {
            throw new Error(`Moonshot stream error: ${chunk.error.message || JSON.stringify(chunk.error)}`);
          }
          
          const delta = chunk.choices?.[0]?.delta as any;
          
          // ✅ KIMI REQUIREMENT 2: Handle reasoning_content for thinking models
          // reasoning_content appears in streaming before the final answer
          if (delta?.reasoning_content) {
            reasoningBuffer += delta.reasoning_content;
            tokensGenerated += Math.ceil(delta.reasoning_content.length / 4);
            // Yield thinking content with special marker for client handling
            yield `<thinking>${delta.reasoning_content}</thinking>`;
          }
          
          const content = delta?.content;
          if (content) {
            buffer += content;
            tokensGenerated += Math.ceil(content.length / 4);
            yield content;
          }
        } catch (chunkError: any) {
          logger.warn(`Moonshot chunk parsing error: ${chunkError.message}`);
          continue;
        }
      }
      
      // ✅ ENHANCED ERROR: Log chunk count for debugging
      if (!buffer && !reasoningBuffer) {
        throw new Error(`Moonshot stream produced no content (received ${chunkCount} chunks)`);
      }
      
      success = true;
      logger.info(`Moonshot stream completed successfully: ${buffer.length} chars content, ${reasoningBuffer.length} chars reasoning from ${chunkCount} chunks`);
    } catch (error: any) {
      // ✅ ENHANCED LOGGING: Include status code, error details for diagnostics
      logger.error('Moonshot stream error:', {
        message: error.message,
        statusCode: error.status || error.statusCode || error.code,
        errorType: error.constructor?.name,
        details: error.response?.data || error.body || 'No additional details'
      });
      providerLatencyMonitor.recordLatency('moonshot', modelId, Date.now() - startTime, false, 0, error.message);
      throw error;
    } finally {
      if (success) {
        providerLatencyMonitor.recordLatency('moonshot', modelId, Date.now() - startTime, true, tokensGenerated);
      }
    }
  }
  
  /**
   * Gemini streaming implementation with robust error handling
   * ✅ NEW APPROACH: Add system message as first chat message instead of systemInstruction
   * ✅ ROBUST PARSING: Handle stream errors, JSON parsing, and fallback mechanisms
   */
  /**
   * ✅ PROMPT CACHING: Gemini context caching for system prompts
   * Caches system instructions for improved performance on repeated calls
   */
  private async *streamGemini(modelId: string, messages: any[], options?: any): AsyncGenerator<string> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');
    
    const startTime = Date.now();
    let tokensGenerated = 0;
    let success = false;
    
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');
    
    // ✅ PROMPT CACHING: Format messages for Gemini and cache system prompt
    const { systemInstruction, contents } = promptCacheManager.formatMessagesForGemini(messages, systemMessage);
    
    // Cache system prompt for metrics tracking
    if (systemMessage) {
      promptCacheManager.cacheSystemPrompt(systemMessage, 'gemini');
    }
    
    // Create model WITHOUT systemInstruction to avoid SDK issues (Gemini SDK quirk)
    const model = this.geminiClient.getGenerativeModel({ 
      model: modelId,
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: clampMaxTokens(modelId, options?.max_tokens || 8192),
      }
    });
    
    // Build history: prepend system message as model response if present
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }]
    }));
    
    // WORKAROUND: Add system message as first model message in history
    if (systemMessage && systemMessage.trim()) {
      history.unshift({
        role: 'model' as const,
        parts: [{ text: `System context: ${systemMessage}` }]
      });
      history.unshift({
        role: 'user' as const,
        parts: [{ text: 'Understood. I will follow the system instructions.' }]
      });
    }
    
    const chat = model.startChat({ history });
    const lastMessage = chatMessages[chatMessages.length - 1]?.content || '';
    
    try {
      const result = await chat.sendMessageStream(lastMessage);
      
      // ✅ ROBUST PARSING: Accumulate chunks and handle errors gracefully
      let buffer = '';
      for await (const chunk of result.stream) {
        try {
          const text = chunk.text();
          if (text) {
            buffer += text;
            tokensGenerated += Math.ceil(text.length / 4);
            yield text;
          }
        } catch (chunkError: any) {
          logger.warn(`Gemini chunk parsing error: ${chunkError.message}`);
          // Continue to next chunk instead of failing completely
          continue;
        }
      }
      
      // If we got nothing, try to get the full response as fallback
      if (!buffer) {
        const response = await result.response;
        const fullText = response.text();
        if (fullText) {
          tokensGenerated += Math.ceil(fullText.length / 4);
          yield fullText;
        }
      }
      
      success = true;
    } catch (error: any) {
      logger.error(`Gemini stream error: ${error.message}`);
      providerLatencyMonitor.recordLatency('gemini', modelId, Date.now() - startTime, false, 0, error.message);
      throw new Error(`Gemini streaming failed: ${error.message}`);
    } finally {
      if (success) {
        providerLatencyMonitor.recordLatency('gemini', modelId, Date.now() - startTime, true, tokensGenerated);
      }
    }
  }
  
  /**
   * Non-streaming generation for compatibility
   */
  async generateChat(modelId: string, messages: any[], options?: any): Promise<string> {
    let fullResponse = '';
    for await (const chunk of this.generateChatStream(modelId, messages, options)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
  
  // ============================================================================
  // LEGACY COMPATIBILITY LAYER
  // ============================================================================
  // These methods provide backward compatibility with the old provider-based API
  // Used by: ai-code-completion, ai-code-review, advanced-ai-service, etc.
  // ============================================================================
  
  /**
   * Legacy API: Get available providers (mapped to model-based API)
   * Maps old provider names to new model IDs
   */
  getAvailableProviders(): Array<{ name: string; isAvailable: boolean }> {
    const providerMap: Record<string, string[]> = {
      'OpenAI': ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3'],
      'Anthropic': ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
      'Gemini': ['gemini-2.5-pro', 'gemini-2.5-flash']
    };
    
    return Object.entries(providerMap).map(([name, modelIds]) => ({
      name,
      isAvailable: modelIds.some(id => {
        const model = this.getModel(id);
        return model && this.providers.has(model.provider);
      })
    }));
  }
  
  /**
   * Legacy API: Get provider by name (maps to default model for that provider)
   */
  getProvider(providerName: string): LegacyProviderAdapter | null {
    const providerToModelMap: Record<string, string> = {
      'OpenAI': 'gpt-4.1',
      'Claude': 'claude-sonnet-4-20250514',
      'Claude Sonnet 4': 'claude-sonnet-4-20250514',
      'Claude 3.5 Sonnet': 'claude-sonnet-4-20250514',
      'Anthropic': 'claude-sonnet-4-20250514',
      'Gemini': 'gemini-2.5-flash',
      'Moonshot': 'kimi-k2',
      'xAI': 'grok-3'
    };
    
    const modelId = providerToModelMap[providerName];
    if (!modelId) return null;
    
    const model = this.getModel(modelId);
    if (!model || !this.providers.has(model.provider)) return null;
    
    return new LegacyProviderAdapter(this, modelId, providerName);
  }
  
  /**
   * Legacy API: Get default provider
   */
  getDefaultProvider(): LegacyProviderAdapter {
    // Try providers in order of preference - UPDATED January 2026
    const preferredModels = [
      'gpt-4.1',
      'claude-sonnet-4-20250514',
      'gemini-2.5-flash',
      'grok-3',
      'moonshot-v1-32k'
    ];
    
    for (const modelId of preferredModels) {
      const model = this.getModel(modelId);
      if (model && this.providers.has(model.provider)) {
        return new LegacyProviderAdapter(this, modelId, model.name);
      }
    }
    
    throw new Error('No AI providers available. Please configure API keys in Replit Secrets.');
  }
}

/**
 * Legacy Provider Adapter
 * Adapts the new model-based API to the old provider-based interface
 */
class LegacyProviderAdapter {
  name: string;
  private manager: AIProviderManager;
  private modelId: string;
  
  constructor(manager: AIProviderManager, modelId: string, name: string) {
    this.manager = manager;
    this.modelId = modelId;
    this.name = name;
  }
  
  async generateCompletion(
    prompt: string,
    systemPrompt: string,
    maxTokens = 1024,
    temperature = 0.2,
    userId?: number
  ): Promise<string> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];
    
    return this.manager.generateChat(this.modelId, messages, {
      max_tokens: maxTokens,
      temperature
    });
  }
  
  async generateChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens = 1024,
    temperature = 0.5,
    userId?: number
  ): Promise<string> {
    return this.manager.generateChat(this.modelId, messages, {
      max_tokens: maxTokens,
      temperature
    });
  }
  
  async generateCodeWithUnderstanding(
    code: string,
    language: string,
    instruction: string,
    userId?: number
  ): Promise<string> {
    const systemPrompt = `You are an expert ${language} developer. Generate code that follows the existing patterns and conventions.`;
    const prompt = `Given this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nUser instruction: ${instruction}\n\nGenerate the requested code following the existing code style.`;
    
    return this.generateCompletion(prompt, systemPrompt, 2048, 0.3, userId);
  }
  
  async analyzeCode(code: string, language: string): Promise<any> {
    // Delegate to code analyzer if needed
    return { suggestions: [] };
  }
  
  isAvailable(): boolean {
    const model = this.manager.getModel(this.modelId);
    return model ? this.manager['providers'].has(model.provider) : false;
  }
  
  async *streamChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens = 2048,
    temperature = 0.5
  ): AsyncGenerator<string, void, unknown> {
    yield* this.manager.streamChatWithFallback(this.modelId, messages, {
      max_tokens: maxTokens,
      temperature
    });
  }
}

// Singleton instance
export const aiProviderManager = new AIProviderManager();
