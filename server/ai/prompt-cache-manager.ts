/**
 * Prompt Cache Manager - Fortune 500-Grade AI Cost Optimization
 * 
 * Implements comprehensive prompt caching strategies:
 * - LRU cache for response deduplication
 * - Provider-specific cache optimizations (Anthropic cache_control, OpenAI structure)
 * - Hash-based request deduplication
 * - System prompt caching
 * - Cache metrics for cost analysis
 * 
 * @author E-Code Platform
 * @version 2.0.0
 * @since December 2025
 */

import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('prompt-cache-manager');

export interface CachedPrompt {
  hash: string;
  content: string;
  tokenCount: number;
  createdAt: number;
  lastUsedAt: number;
  hitCount: number;
  provider?: string;
}

export interface CachedResponse {
  hash: string;
  response: string;
  model: string;
  createdAt: number;
  lastUsedAt: number;
  hitCount: number;
  tokensUsed: number;
  costSaved: number;
}

export interface CacheMetrics {
  systemPromptHits: number;
  systemPromptMisses: number;
  responseHits: number;
  responseMisses: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  cacheSize: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface ProviderCacheConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'moonshot';
  enableSystemPromptCache: boolean;
  enableResponseCache: boolean;
  cacheControlHeaders: boolean;
  maxCacheAge: number;
}

export interface MessageWithCache {
  role: 'system' | 'user' | 'assistant';
  content: string | { type: string; text: string; cache_control?: { type: string } }[];
}

export class PromptCacheManager {
  private systemPromptCache: Map<string, CachedPrompt> = new Map();
  private responseCache: Map<string, CachedResponse> = new Map();
  private pendingRequests: Map<string, Promise<string>> = new Map();
  private maxCacheSize: number;
  private maxResponseCacheSize: number;
  private responseCacheTTL: number;
  private metrics: CacheMetrics;
  
  private providerConfigs: Map<string, ProviderCacheConfig> = new Map([
    ['anthropic', {
      provider: 'anthropic',
      enableSystemPromptCache: true,
      enableResponseCache: true,
      cacheControlHeaders: true,
      maxCacheAge: 300000
    }],
    ['openai', {
      provider: 'openai',
      enableSystemPromptCache: true,
      enableResponseCache: true,
      cacheControlHeaders: false,
      maxCacheAge: 300000
    }],
    ['gemini', {
      provider: 'gemini',
      enableSystemPromptCache: true,
      enableResponseCache: true,
      cacheControlHeaders: false,
      maxCacheAge: 300000
    }],
    ['xai', {
      provider: 'xai',
      enableSystemPromptCache: true,
      enableResponseCache: true,
      cacheControlHeaders: false,
      maxCacheAge: 300000
    }],
    ['moonshot', {
      provider: 'moonshot',
      enableSystemPromptCache: true,
      enableResponseCache: true,
      cacheControlHeaders: false,
      maxCacheAge: 300000
    }]
  ]);

  private costPerToken: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.0000025, output: 0.00001 },
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'gpt-4.1': { input: 0.000002, output: 0.000008 },
    'gpt-4.1-mini': { input: 0.0000004, output: 0.0000016 },
    'gpt-4.1-nano': { input: 0.0000001, output: 0.0000004 },
    'o3': { input: 0.00001, output: 0.00004 },
    'o4-mini': { input: 0.0000011, output: 0.0000044 },
    'claude-opus-4-7': { input: 0.000015, output: 0.000075 },
    'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
    'claude-haiku-4-5-20251001': { input: 0.000001, output: 0.000005 },
    'gemini-1.5-pro': { input: 0.00000125, output: 0.000005 },
    'gemini-2.0-flash': { input: 0.0000001, output: 0.0000004 },
    'gemini-2.5-flash': { input: 0.000000075, output: 0.0000003 },
    'gemini-2.5-pro': { input: 0.00000125, output: 0.00001 },
    'grok-3': { input: 0.000003, output: 0.000015 },
    'grok-3-mini': { input: 0.0000003, output: 0.0000005 },
    'grok-3-fast': { input: 0.000005, output: 0.000025 },
    'moonshot-v1-8k': { input: 0.0000012, output: 0.0000012 },
    'moonshot-v1-32k': { input: 0.0000024, output: 0.0000024 },
    'moonshot-v1-128k': { input: 0.000006, output: 0.000006 },
    'default': { input: 0.000001, output: 0.000004 }
  };

  constructor(
    maxCacheSize: number = 100,
    maxResponseCacheSize: number = 500,
    responseCacheTTL: number = 300000
  ) {
    this.maxCacheSize = maxCacheSize;
    this.maxResponseCacheSize = maxResponseCacheSize;
    this.responseCacheTTL = responseCacheTTL;
    this.metrics = {
      systemPromptHits: 0,
      systemPromptMisses: 0,
      responseHits: 0,
      responseMisses: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      cacheSize: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now()
    };

    setInterval(() => this.evictExpiredEntries(), 60000);
    
    logger.info('PromptCacheManager initialized', {
      maxCacheSize,
      maxResponseCacheSize,
      responseCacheTTL
    });
  }

  private generateHash(content: string, modelId?: string): string {
    const data = modelId ? `${modelId}:${content}` : content;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  cacheSystemPrompt(content: string, provider?: string): string {
    const hash = this.generateHash(content);
    
    if (this.systemPromptCache.has(hash)) {
      const cached = this.systemPromptCache.get(hash)!;
      cached.hitCount++;
      cached.lastUsedAt = Date.now();
      this.metrics.systemPromptHits++;
      logger.debug('System prompt cache hit', { hash, hitCount: cached.hitCount });
      return hash;
    }

    if (this.systemPromptCache.size >= this.maxCacheSize) {
      this.evictLRU(this.systemPromptCache);
    }

    const cached: CachedPrompt = {
      hash,
      content,
      tokenCount: this.estimateTokens(content),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      hitCount: 1,
      provider
    };

    this.systemPromptCache.set(hash, cached);
    this.metrics.systemPromptMisses++;
    this.updateCacheMetrics();
    
    logger.debug('System prompt cached', { hash, tokens: cached.tokenCount });
    return hash;
  }

  getSystemPrompt(hash: string): string | null {
    const cached = this.systemPromptCache.get(hash);
    if (cached) {
      cached.hitCount++;
      cached.lastUsedAt = Date.now();
      return cached.content;
    }
    return null;
  }

  cacheResponse(
    requestHash: string,
    response: string,
    model: string,
    tokensUsed: number
  ): void {
    if (this.responseCache.size >= this.maxResponseCacheSize) {
      this.evictLRU(this.responseCache);
    }

    const cost = this.calculateCost(tokensUsed, model, 'output');
    
    const cached: CachedResponse = {
      hash: requestHash,
      response,
      model,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      hitCount: 1,
      tokensUsed,
      costSaved: cost
    };

    this.responseCache.set(requestHash, cached);
    this.updateCacheMetrics();
    
    logger.debug('Response cached', { hash: requestHash, model, tokensUsed });
  }

  getCachedResponse(requestHash: string): CachedResponse | null {
    const cached = this.responseCache.get(requestHash);
    
    if (cached) {
      if (Date.now() - cached.createdAt > this.responseCacheTTL) {
        this.responseCache.delete(requestHash);
        return null;
      }
      
      cached.hitCount++;
      cached.lastUsedAt = Date.now();
      this.metrics.responseHits++;
      this.metrics.totalTokensSaved += cached.tokensUsed;
      this.metrics.totalCostSaved += cached.costSaved;
      
      logger.debug('Response cache hit', { 
        hash: requestHash, 
        hitCount: cached.hitCount,
        tokensSaved: cached.tokensUsed 
      });
      
      return cached;
    }
    
    this.metrics.responseMisses++;
    return null;
  }

  generateRequestHash(
    messages: any[],
    modelId: string,
    options?: { temperature?: number; max_tokens?: number }
  ): string {
    const contentParts = messages.map(m => {
      if (typeof m.content === 'string') {
        return `${m.role}:${m.content}`;
      }
      return `${m.role}:${JSON.stringify(m.content)}`;
    });
    
    const optionsStr = options 
      ? `:t${options.temperature || 0}:m${options.max_tokens || 0}`
      : '';
    
    return this.generateHash(contentParts.join('|') + optionsStr, modelId);
  }

  async deduplicateRequest<T>(
    requestHash: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const pendingKey = requestHash;
    
    if (this.pendingRequests.has(pendingKey)) {
      logger.debug('Request deduplicated - waiting for pending', { hash: requestHash });
      return this.pendingRequests.get(pendingKey) as Promise<T>;
    }
    
    const promise = requestFn();
    this.pendingRequests.set(pendingKey, promise as Promise<string>);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  formatMessagesForAnthropic(
    messages: any[],
    systemPrompt?: string
  ): { system: any; messages: any[] } {
    const config = this.providerConfigs.get('anthropic')!;
    
    if (!config.cacheControlHeaders || !systemPrompt) {
      return {
        system: systemPrompt || '',
        messages: messages.filter(m => m.role !== 'system')
      };
    }

    const systemWithCache = [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ];

    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    const formattedMessages = conversationMessages.map((msg, index) => {
      if (index === 0 && msg.role === 'user' && typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: [
            {
              type: 'text',
              text: msg.content,
              cache_control: { type: 'ephemeral' }
            }
          ]
        };
      }
      return msg;
    });

    logger.debug('Formatted messages for Anthropic with cache_control', {
      systemCached: true,
      messageCount: formattedMessages.length
    });

    return {
      system: systemWithCache,
      messages: formattedMessages
    };
  }

  formatMessagesForOpenAI(
    messages: any[],
    systemPrompt?: string
  ): any[] {
    const formattedMessages = messages.filter(m => m.role !== 'system');
    
    if (systemPrompt) {
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }

    return formattedMessages;
  }

  formatMessagesForGemini(
    messages: any[],
    systemPrompt?: string
  ): { systemInstruction?: string; contents: any[] } {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }));

    return {
      systemInstruction: systemPrompt,
      contents
    };
  }

  private calculateCost(tokens: number, model: string, type: 'input' | 'output'): number {
    const pricing = this.costPerToken[model] || this.costPerToken['default'];
    return tokens * pricing[type];
  }

  private evictLRU<T extends { lastUsedAt: number }>(cache: Map<string, T>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, value] of cache.entries()) {
      if (value.lastUsedAt < oldestTime) {
        oldestTime = value.lastUsedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      logger.debug('LRU eviction', { key: oldestKey });
    }
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.createdAt > this.responseCacheTTL) {
        this.responseCache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.info('Expired entries evicted', { count: evicted });
      this.updateCacheMetrics();
    }
  }

  private updateCacheMetrics(): void {
    this.metrics.cacheSize = this.systemPromptCache.size + this.responseCache.size;
    
    let oldest = Date.now();
    let newest = 0;

    for (const cached of this.systemPromptCache.values()) {
      if (cached.createdAt < oldest) oldest = cached.createdAt;
      if (cached.createdAt > newest) newest = cached.createdAt;
    }

    for (const cached of this.responseCache.values()) {
      if (cached.createdAt < oldest) oldest = cached.createdAt;
      if (cached.createdAt > newest) newest = cached.createdAt;
    }

    this.metrics.oldestEntry = oldest;
    this.metrics.newestEntry = newest;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getCacheStats(): {
    systemPromptCacheSize: number;
    responseCacheSize: number;
    hitRate: number;
    estimatedMonthlySavings: number;
  } {
    const totalRequests = 
      this.metrics.systemPromptHits + 
      this.metrics.systemPromptMisses + 
      this.metrics.responseHits + 
      this.metrics.responseMisses;
    
    const totalHits = this.metrics.systemPromptHits + this.metrics.responseHits;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    const hourlyRate = this.metrics.totalCostSaved / 
      Math.max(1, (Date.now() - this.metrics.oldestEntry) / 3600000);
    const estimatedMonthlySavings = hourlyRate * 24 * 30;

    return {
      systemPromptCacheSize: this.systemPromptCache.size,
      responseCacheSize: this.responseCache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      estimatedMonthlySavings: Math.round(estimatedMonthlySavings * 100) / 100
    };
  }

  clearCache(type?: 'system' | 'response' | 'all'): void {
    if (type === 'system' || type === 'all') {
      this.systemPromptCache.clear();
    }
    if (type === 'response' || type === 'all') {
      this.responseCache.clear();
    }
    
    this.updateCacheMetrics();
    logger.info('Cache cleared', { type: type || 'all' });
  }

  warmCache(systemPrompts: string[]): void {
    for (const prompt of systemPrompts) {
      this.cacheSystemPrompt(prompt);
    }
    logger.info('Cache warmed', { promptCount: systemPrompts.length });
  }
}

export const promptCacheManager = new PromptCacheManager();

export function warmSystemPromptCache(): void {
  const commonSystemPrompts = [
    'You are a helpful AI assistant.',
    'You are an expert software engineer.',
    'You are a code reviewer providing detailed feedback.'
  ];
  
  promptCacheManager.warmCache(commonSystemPrompts);
}
