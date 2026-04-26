// @ts-nocheck
/**
 * AI Billing Service
 * Tracks AI model usage and integrates with the billing system
 * Similar to Replit's model where different AI models have different costs
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { BillingService } from './billing-service';
import { storage } from '../storage';

const logger = createLogger('ai-billing-service');

// Pricing per 1K tokens
export const AI_MODEL_PRICING = {
  // OpenAI Models
  'gpt-4o': { input: 0.0025, output: 0.01, creditsPerThousand: 0.0125 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, creditsPerThousand: 0.00075 },
  'o1': { input: 0.015, output: 0.06, creditsPerThousand: 0.075 },
  'o1-mini': { input: 0.003, output: 0.012, creditsPerThousand: 0.015 },
  'o3': { input: 0.01, output: 0.04, creditsPerThousand: 0.05 },
  'gpt-4-turbo': { input: 0.01, output: 0.03, creditsPerThousand: 0.04 },
  'gpt-4': { input: 0.03, output: 0.06, creditsPerThousand: 0.09 },

  // Anthropic Models
  'claude-sonnet-4-6': { input: 0.003, output: 0.015, creditsPerThousand: 0.018 },
  'claude-sonnet-4-6': { input: 0.0008, output: 0.004, creditsPerThousand: 0.005 },
  'claude-opus-4-7': { input: 0.015, output: 0.075, creditsPerThousand: 0.09 },
  'claude-sonnet-4-6': { input: 0.00025, output: 0.00125, creditsPerThousand: 0.0015 },

  // Google Gemini Models
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003, creditsPerThousand: 0.0004 },
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003, creditsPerThousand: 0.0004 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005, creditsPerThousand: 0.00625 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003, creditsPerThousand: 0.0004 },

  // xAI Models — grok-3 family (confirmed real, Mar 2026)
  'grok-3': { input: 0.003, output: 0.015, creditsPerThousand: 0.018 },
  'grok-3-mini': { input: 0.0003, output: 0.0005, creditsPerThousand: 0.0008 },
  'grok-3-fast': { input: 0.005, output: 0.025, creditsPerThousand: 0.030 },

  // Moonshot AI Models
  'moonshot-v1-8k': { input: 0.0012, output: 0.0012, creditsPerThousand: 0.0024 },
  'moonshot-v1-32k': { input: 0.0024, output: 0.0024, creditsPerThousand: 0.0048 },
  'moonshot-v1-128k': { input: 0.006, output: 0.006, creditsPerThousand: 0.012 },

  // Default fallback
  'default': { input: 0.001, output: 0.003, creditsPerThousand: 0.004 }
};

export interface AIUsageMetadata {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  prompt?: string;
  completion?: string;
  projectId?: number;
  sessionId?: string;
  purpose?: 'chat' | 'completion' | 'embedding' | 'code-generation' | 'agent-task';
  timestamp: Date;
}

export interface AIUsageTracking {
  userId: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  creditsCost: number;
  metadata: AIUsageMetadata;
}

export class AIBillingService extends EventEmitter {
  private billingService: BillingService;
  private usageBuffer: Map<number, AIUsageTracking[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.billingService = new BillingService();
    
    // Flush usage buffer every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushUsageBuffer();
    }, 30000);
  }
  
  /**
   * Calculate token count for text (approximation)
   * More accurate counting would use tiktoken or similar
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ~= 4 characters
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Calculate credits cost for AI model usage
   */
  calculateCreditsCost(
    model: string, 
    inputTokens: number, 
    outputTokens: number
  ): number {
    const pricing = AI_MODEL_PRICING[model as keyof typeof AI_MODEL_PRICING] || AI_MODEL_PRICING.default;
    
    // Calculate cost in credits (1 credit = $0.01)
    const inputCost = (inputTokens / 1000) * pricing.input * 100; // Convert to credits
    const outputCost = (outputTokens / 1000) * pricing.output * 100; // Convert to credits
    
    return parseFloat((inputCost + outputCost).toFixed(4));
  }
  
  /**
   * Track AI model usage for a user
   */
  async trackAIUsage(
    userId: number,
    metadata: AIUsageMetadata
  ): Promise<void> {
    try {
      const creditsCost = this.calculateCreditsCost(
        metadata.model,
        metadata.inputTokens,
        metadata.outputTokens
      );
      
      // Add to buffer for batch processing
      if (!this.usageBuffer.has(userId)) {
        this.usageBuffer.set(userId, []);
      }
      
      this.usageBuffer.get(userId)!.push({
        userId,
        model: metadata.model,
        inputTokens: metadata.inputTokens,
        outputTokens: metadata.outputTokens,
        totalTokens: metadata.totalTokens,
        creditsCost,
        metadata
      });
      
      // If buffer is large, flush immediately
      if (this.usageBuffer.get(userId)!.length >= 10) {
        await this.flushUserUsage(userId);
      }
      
      // Emit usage event
      this.emit('ai_usage_tracked', {
        userId,
        model: metadata.model,
        tokens: metadata.totalTokens,
        creditsCost
      });
      
      logger.info(`AI usage tracked for user ${userId}: ${metadata.model} - ${metadata.totalTokens} tokens = ${creditsCost} credits`);
    } catch (error) {
      logger.error('Failed to track AI usage:', error);
      throw error;
    }
  }
  
  /**
   * Track AI usage from completion response
   */
  async trackCompletion(
    userId: number,
    provider: string,
    model: string,
    prompt: string,
    completion: string,
    purpose: AIUsageMetadata['purpose'] = 'completion',
    projectId?: number
  ): Promise<void> {
    const inputTokens = this.estimateTokenCount(prompt);
    const outputTokens = this.estimateTokenCount(completion);
    
    await this.trackAIUsage(userId, {
      model,
      provider,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      prompt: prompt.substring(0, 200), // Store first 200 chars for reference
      completion: completion.substring(0, 200),
      projectId,
      purpose,
      timestamp: new Date()
    });
  }
  
  /**
   * Flush usage buffer for a specific user
   */
  private async flushUserUsage(userId: number): Promise<void> {
    const usage = this.usageBuffer.get(userId);
    if (!usage || usage.length === 0) return;
    
    try {
      // Calculate total credits to deduct
      const totalCredits = usage.reduce((sum, u) => sum + u.creditsCost, 0);
      const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
      
      // Track in billing service as AI resource
      await this.billingService.trackResourceUsage(
        userId,
        'ai.tokens',
        totalTokens,
        {
          models: usage.map(u => u.model),
          totalCost: totalCredits,
          usageCount: usage.length,
          breakdown: usage.map(u => ({
            model: u.model,
            tokens: u.totalTokens,
            cost: u.creditsCost
          }))
        }
      );
      
      // Store detailed usage in database
      for (const u of usage) {
        await storage.createAIUsageRecord({
          userId,
          model: u.model,
          provider: u.metadata.provider,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          totalTokens: u.totalTokens,
          creditsCost: u.creditsCost,
          purpose: u.metadata.purpose,
          projectId: u.metadata.projectId,
          metadata: JSON.stringify(u.metadata)
        });
      }
      
      // Clear buffer
      this.usageBuffer.set(userId, []);
      
      logger.info(`Flushed AI usage for user ${userId}: ${totalTokens} tokens, ${totalCredits} credits`);
    } catch (error) {
      logger.error(`Failed to flush usage for user ${userId}:`, error);
      // Keep buffer for retry
    }
  }
  
  /**
   * Flush all usage buffers
   */
  private async flushUsageBuffer(): Promise<void> {
    const userIds = Array.from(this.usageBuffer.keys());
    
    for (const userId of userIds) {
      await this.flushUserUsage(userId);
    }
  }
  
  /**
   * Get AI usage statistics for a user
   */
  async getUserAIUsage(
    userId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const usage = await storage.getAIUsageStats(userId, startDate, endDate);
    
    // Group by model
    const modelUsage: Record<string, any> = {};
    
    for (const record of usage) {
      if (!modelUsage[record.model]) {
        modelUsage[record.model] = {
          model: record.model,
          provider: record.provider,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          usageCount: 0
        };
      }
      
      modelUsage[record.model].totalTokens += record.totalTokens;
      modelUsage[record.model].inputTokens += record.inputTokens;
      modelUsage[record.model].outputTokens += record.outputTokens;
      modelUsage[record.model].totalCost += record.creditsCost;
      modelUsage[record.model].usageCount += 1;
    }
    
    return {
      totalTokens: usage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCost: usage.reduce((sum, u) => sum + u.creditsCost, 0),
      usageCount: usage.length,
      modelBreakdown: Object.values(modelUsage),
      recentUsage: usage.slice(0, 10)
    };
  }
  
  /**
   * Check if user has enough credits for AI operation
   */
  async checkCreditsForModel(
    userId: number,
    model: string,
    estimatedTokens: number
  ): Promise<boolean> {
    const pricing = AI_MODEL_PRICING[model as keyof typeof AI_MODEL_PRICING] || AI_MODEL_PRICING.default;
    const estimatedCost = (estimatedTokens / 1000) * pricing.creditsPerThousand;
    
    const userCredits = await storage.getUserCredits(userId);
    if (!userCredits) return false;
    
    return userCredits.remainingCredits >= estimatedCost;
  }
  
  /**
   * Get pricing information for all models
   */
  getModelPricing(): typeof AI_MODEL_PRICING {
    return AI_MODEL_PRICING;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flushUsageBuffer();
  }
}

// Export singleton instance
export const aiBillingService = new AIBillingService();