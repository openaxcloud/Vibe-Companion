// @ts-nocheck
/**
 * AI Usage Metering Service (Pay-As-You-Go)
 * Tracks every AI request and calculates costs for Stripe metered billing
 * 
 * Flow:
 * 1. AI request made → trackUsage() called
 * 2. Calculate cost based on model + tokens
 * 3. Insert into ai_usage_metering table
 * 4. Report to Stripe metered billing (async)
 */

import { db } from '../db';
import { aiUsageMetering, aiStripeUsageQueue } from '@shared/schema';
import { createLogger } from '../utils/logger';
import { normalizeModelName } from '../utils/model-normalizer';
import { AlertService } from './alert-service';
import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';
import { getModelPricing, calculateRequestCost } from '../config/ai-pricing';

const logger = createLogger('ai-metering');

// ✅ Issue #36 FIX: Pricing config centralized to server/config/ai-pricing.ts
// Import getModelPricing and calculateRequestCost from centralized config

interface TrackUsageParams {
  userId: string;
  endpoint: string;
  model: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  userTier: 'free' | 'pro' | 'enterprise';
  subscriptionId?: string;
  requestDurationMs?: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class AiMeteringService {
  private stripe: Stripe | null = null;

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = getStripe();
    } else {
      logger.warn('STRIPE_SECRET_KEY not found - Stripe metering disabled');
    }
  }

  /**
   * Calculate cost in USD based on model and token usage
   * ✅ Issue #36 FIX: Uses centralized pricing from server/config/ai-pricing.ts
   */
  private calculateCost(model: string, tokensInput: number, tokensOutput: number): number {
    return calculateRequestCost(model, tokensInput, tokensOutput);
  }

  /**
   * Track AI usage and insert into database
   * Returns the metering record ID
   */
  async trackUsage(params: TrackUsageParams): Promise<number> {
    try {
      // ✅ CRITICAL: Normalize model to prevent DB insert failures
      const originalModel = params.model;
      const normalizedModel = normalizeModelName(params.model, params.provider);
      
      if (originalModel !== normalizedModel) {
        logger.debug(`Model normalized: "${originalModel}" → "${normalizedModel}"`);
      }
      
      const tokensTotal = params.tokensInput + params.tokensOutput;
      const costUsd = this.calculateCost(normalizedModel, params.tokensInput, params.tokensOutput);

      // Insert into metering table
      const [record] = await db.insert(aiUsageMetering).values({
        userId: params.userId,
        endpoint: params.endpoint,
        model: normalizedModel as any, // Now guaranteed to be valid enum
        provider: params.provider,
        tokensInput: params.tokensInput,
        tokensOutput: params.tokensOutput,
        tokensTotal,
        costUsd: costUsd.toFixed(6), // Store with 6 decimal precision
        billed: false,
        userTier: params.userTier,
        subscriptionId: params.subscriptionId || null,
        requestDurationMs: params.requestDurationMs || null,
        status: params.status,
        errorMessage: params.errorMessage || null,
        metadata: params.metadata || null,
      }).returning({ id: aiUsageMetering.id });

      logger.info(`Tracked AI usage: user=${params.userId}, model=${params.model}, tokens=${tokensTotal}, cost=$${costUsd.toFixed(6)}`);

      // ✅ Enqueue for Stripe billing with retry logic (async, don't block)
      this.enqueueStripeUsage(params.userId, params.subscriptionId, costUsd, record.id).catch((error) => {
        logger.error('Failed to enqueue Stripe usage', { error, meteringId: record.id });
      });

      return record.id;
    } catch (error) {
      logger.error('Failed to track AI usage', { error, params });
      throw error;
    }
  }

  /**
   * ✅ NEW: Enqueue Stripe usage for retry queue processing
   * Replaces direct Stripe API calls to ensure zero revenue loss
   */
  private async enqueueStripeUsage(
    userId: string,
    subscriptionId: string | undefined,
    costUsd: number,
    meteringId: number
  ): Promise<void> {
    // ✅ SHORT-CIRCUIT: Skip if no Stripe key (config not ready)
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.debug('Stripe API key not configured - skipping queue (non-critical)');
      return;
    }

    if (!subscriptionId) {
      logger.debug('No subscription ID - skipping Stripe queue');
      return;
    }

    try {
      // Calculate initial retry time (5 minutes from now)
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + 5);

      await db.insert(aiStripeUsageQueue).values({
        meteringId,
        userId,
        subscriptionId,
        costUsd: costUsd.toFixed(6),
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: nextRetry,
        status: 'pending',
      });

      logger.info(`✅ Enqueued Stripe usage for metering ${meteringId}`, {
        userId,
        costUsd: costUsd.toFixed(6),
        nextRetry: nextRetry.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to enqueue Stripe usage', { error, meteringId });
      // ✅ Send alert for billing queue failure
      AlertService.stripeBillingFailed(userId, meteringId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Direct Stripe API call using new billing.meterEvents API
   * Now replaced by enqueueStripeUsage + worker processing for production use
   */
  private async reportToStripe(
    userId: string,
    stripeCustomerId: string | undefined,
    costUsd: number,
    meteringId: number
  ): Promise<void> {
    if (!this.stripe || !stripeCustomerId) {
      logger.debug('Stripe not configured or no customer ID - skipping metered billing');
      return;
    }

    try {
      const quantityCents = Math.ceil(costUsd * 100);
      const meterEvent = await this.stripe.billing.meterEvents.create({
        event_name: 'ai_api_usage',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(quantityCents),
        },
        timestamp: Math.floor(Date.now() / 1000),
      });

      await db.update(aiUsageMetering)
        .set({
          stripeUsageRecordId: meterEvent.identifier,
          billed: true,
          billedAt: new Date(),
        })
        .where({ id: meteringId });

      logger.info(`Reported to Stripe: $${costUsd.toFixed(6)} → ${quantityCents} cents, meterEventId=${meterEvent.identifier}`);
    } catch (error) {
      logger.error('Failed to report to Stripe', { error, userId, stripeCustomerId });
      throw error;
    }
  }

  /**
   * Get user's monthly usage summary
   */
  async getMonthlyUsage(userId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    billedCost: number;
    unbilledCost: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await db
      .select()
      .from(aiUsageMetering)
      .where(({ userId: dbUserId, createdAt }) => {
        return dbUserId === userId && createdAt >= startOfMonth;
      });

    const totalTokens = usage.reduce((sum, r) => sum + r.tokensTotal, 0);
    const totalCost = usage.reduce((sum, r) => sum + parseFloat(r.costUsd), 0);
    const requestCount = usage.length;
    const billedCost = usage.filter(r => r.billed).reduce((sum, r) => sum + parseFloat(r.costUsd), 0);
    const unbilledCost = totalCost - billedCost;

    return {
      totalTokens,
      totalCost,
      requestCount,
      billedCost,
      unbilledCost,
    };
  }
}

// Export singleton instance
export const aiMeteringService = new AiMeteringService();
