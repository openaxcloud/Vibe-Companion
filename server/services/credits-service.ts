/**
 * Credits Management Service - Production Grade
 * Implements Replit-identical credits system with:
 * 1. Idempotent usage ingestion (no double-charging on retries)
 * 2. Monthly snapshots for Stripe proration
 * 3. Transactional credit deductions
 * 4. Absolute cumulative totals instead of increments
 */

import crypto from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import { users, usageEvents, usageLedger, payAsYouGoQueue } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import {
  METERED_PRICES,
  PLANS,
  getPlanByTier,
  exceedsAllowance,
  calculateComputeCost,
  calculateStorageCost,
  calculateBandwidthCost,
} from '../payments/pricing-constants';

const logger = createLogger('credits-service');

const MAX_CREDITS = 100000;

/**
 * Get current billing period in YYYY-MM format
 */
function getBillingPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface UsageMetrics {
  computeHours: number;
  storageGb: number;
  bandwidthGb: number;
  deployments: number;
}

export interface CostBreakdown {
  allowanceCost: number;        // Cost covered by allowance
  creditsCost: number;          // Cost deducted from credits
  payAsYouGoCost: number;       // Cost charged via Stripe
  totalCost: number;
}

export class CreditsService {
  /**
   * Record usage with idempotency - Production-ready method
   * @param userId - User ID
   * @param metric - Metric type (compute, storage, bandwidth, deployment)
   * @param reportedTotal - ABSOLUTE cumulative total (not incremental)
   * @param idempotencyKey - Unique key for deduplication (UUID recommended)
   */
  async recordUsageIdempotent(
    userId: string,
    metric: 'compute' | 'storage' | 'bandwidth' | 'deployment',
    reportedTotal: number,
    idempotencyKey: string
  ): Promise<CostBreakdown> {
    const billingPeriod = getBillingPeriod();

    // Check if this event was already processed (idempotency)
    const existingEvent = await db
      .select()
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, parseInt(userId)),
          eq(usageEvents.idempotencyKey, idempotencyKey),
          eq(usageEvents.metric, metric)
        )
      )
      .limit(1);

    if (existingEvent.length > 0) {
      // Already processed - return cached result
      const event = existingEvent[0];
      logger.info(`Idempotency hit - reusing result for key ${idempotencyKey}`);
      return {
        allowanceCost: parseFloat(event.allowanceUsed.toString()),
        creditsCost: parseFloat(event.creditsDeducted.toString()),
        payAsYouGoCost: parseFloat(event.payAsYouGo.toString()),
        totalCost: parseFloat(event.billedAmount.toString()),
      };
    }

    // New event - process with transaction
    return await db.transaction(async (tx) => {
      // Lock user row for update (prevents concurrent credit balance corruption)
      const user = await tx
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .for('update')
        .limit(1);

      if (!user || user.length === 0) {
        throw new Error('User not found');
      }

      const userData = user[0];
      const plan = getPlanByTier(userData.subscriptionTier || 'free');

      // Explicit field mapping to prevent silent failures
      const fieldMapping = {
        compute: {
          lastBilled: 'lastBilledComputeHours' as const,
          usage: 'usageComputeHours' as const,
          allowanceKey: null, // No allowance for compute
          costCalculator: calculateComputeCost,
        },
        storage: {
          lastBilled: 'lastBilledStorageGb' as const,
          usage: 'usageStorageGb' as const,
          allowanceKey: 'storageGb' as const,
          costCalculator: calculateStorageCost,
        },
        bandwidth: {
          lastBilled: 'lastBilledBandwidthGb' as const,
          usage: 'usageBandwidthGb' as const,
          allowanceKey: 'bandwidthGb' as const,
          costCalculator: calculateBandwidthCost,
        },
        deployment: {
          lastBilled: null, // No lastBilled tracking for deployments
          usage: 'usageDeployments' as const,
          allowanceKey: null,
          costCalculator: () => 0,
        },
      };

      const mapping = fieldMapping[metric];
      if (!mapping) {
        throw new Error(`Unknown metric: ${metric}`);
      }

      // Get last billed total for this metric
      const lastBilledTotal = mapping.lastBilled
        ? parseFloat((userData[mapping.lastBilled] as any)?.toString() || '0')
        : 0;

      // Calculate incremental usage (what's new since last billing)
      const incrementalUsage = Math.max(0, reportedTotal - lastBilledTotal);

      if (incrementalUsage <= 0) {
        // No new usage - return zero cost (handles decreases/deletions safely)
        logger.debug(`No incremental usage for ${metric} (reported: ${reportedTotal}, lastBilled: ${lastBilledTotal})`);
        return {
          allowanceCost: 0,
          creditsCost: 0,
          payAsYouGoCost: 0,
          totalCost: 0,
        };
      }

      // Get allowance for this metric
      const allowance = mapping.allowanceKey
        ? (plan.allowances as any)[mapping.allowanceKey] || 0
        : 0;

      // Calculate how much of the incremental usage exceeds allowance
      const currentUsage = parseFloat((userData[mapping.usage] as any)?.toString() || '0');
      const newTotalUsage = reportedTotal;

      let allowanceCost = 0;
      let billableUsage = incrementalUsage;

      if (allowance > 0) {
        const usedAllowance = Math.min(newTotalUsage, allowance);
        const previousUsedAllowance = Math.min(currentUsage, allowance);
        const newAllowanceUsage = Math.max(0, usedAllowance - previousUsedAllowance);
        
        allowanceCost = newAllowanceUsage;
        billableUsage = Math.max(0, incrementalUsage - newAllowanceUsage);
      }

      // Calculate cost for billable usage
      const cost = mapping.costCalculator(billableUsage);
      let creditsBalance = parseFloat(userData.creditsBalance?.toString() || '0');

      let creditsCost = 0;
      let payAsYouGoCost = 0;

      if (cost > 0) {
        if (creditsBalance >= cost) {
          // Deduct from credits
          creditsCost = cost;
          creditsBalance -= cost;
        } else {
          // Partially from credits, rest pay-as-you-go
          creditsCost = creditsBalance;
          payAsYouGoCost = cost - creditsBalance;
          creditsBalance = 0;
        }
      }

      // Update user record with new totals
      const updates: any = {
        creditsBalance: creditsBalance.toFixed(2),
        [mapping.usage]: newTotalUsage.toFixed(2),
      };

      // Only update lastBilled if metric has it
      if (mapping.lastBilled) {
        updates[mapping.lastBilled] = reportedTotal.toFixed(2);
      }

      await tx.update(users).set(updates).where(eq(users.id, parseInt(userId)));

      // Record event in usage_events for idempotency
      const eventResult = await tx.insert(usageEvents).values({
        userId: parseInt(userId),
        idempotencyKey,
        metric,
        reportedTotal: reportedTotal.toString(),
        billedAmount: cost.toString(),
        creditsDeducted: creditsCost.toString(),
        payAsYouGo: payAsYouGoCost.toString(),
        allowanceUsed: allowanceCost.toString(),
        billingPeriod,
        processedAt: new Date(),
        metadata: {
          plan: userData.subscriptionTier,
          allowance,
          incrementalUsage,
        },
      }).returning({ id: usageEvents.id });

      // If pay-as-you-go triggered, enqueue for Stripe billing
      if (payAsYouGoCost > 0) {
        const eventId = eventResult[0]?.id;
        const description = `${metric.charAt(0).toUpperCase() + metric.slice(1)} usage (${incrementalUsage.toFixed(2)} ${metric === 'compute' ? 'hours' : 'GB'})`;

        await tx.insert(payAsYouGoQueue).values({
          userId: parseInt(userId),
          usageEventId: eventId,
          idempotencyKey, // Dedicated column for deduplication
          metric,
          amount: payAsYouGoCost.toString(),
          description,
          billingPeriod,
          status: 'pending',
          attempts: 0,
          createdAt: new Date(),
          nextRetryAt: new Date(), // Process immediately
          metadata: {
            plan: userData.subscriptionTier,
          },
        });

        logger.info(
          `Pay-as-you-go enqueued for user ${userId}: ` +
          `${metric} = $${payAsYouGoCost.toFixed(2)} (queue id: ${eventId}, idempotency: ${idempotencyKey})`
        );
      }

      return {
        allowanceCost,
        creditsCost,
        payAsYouGoCost,
        totalCost: cost,
      };
    });
  }

  /**
   * Refill monthly credits for a user - Production-ready with snapshots
   * Creates usageLedger snapshot BEFORE reset for Stripe proration
   * CRITICAL: lastBilled* are NEVER reset (lifetime totals)
   */
  async refillMonthlyCredits(userId: string): Promise<void> {
    return await db.transaction(async (tx) => {
      // Lock user row for update
      const user = await tx
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .for('update')
        .limit(1);

      if (!user || user.length === 0) {
        throw new Error('User not found');
      }

      const userData = user[0];
      const plan = getPlanByTier(userData.subscriptionTier || 'free');

      // Calculate billing period being CLOSED (last refill date)
      const lastRefill = userData.lastCreditRefill ? new Date(userData.lastCreditRefill) : new Date();
      const closingPeriod = `${lastRefill.getFullYear()}-${String(lastRefill.getMonth() + 1).padStart(2, '0')}`;

      // Query usageEvents for the period being closed
      const periodEvents = await tx
        .select()
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, parseInt(userId)),
            eq(usageEvents.billingPeriod, closingPeriod)
          )
        );

      // Aggregate credits and pay-as-you-go from events
      const creditsUsed = periodEvents.reduce(
        (sum, event) => sum + parseFloat(event.creditsDeducted.toString()),
        0
      );

      const payAsYouGoTotal = periodEvents.reduce(
        (sum, event) => sum + parseFloat(event.payAsYouGo.toString()),
        0
      );

      // Get current usage totals (for snapshot only)
      const computeHours = parseFloat(userData.usageComputeHours?.toString() || '0');
      const storageGb = parseFloat(userData.usageStorageGb?.toString() || '0');
      const bandwidthGb = parseFloat(userData.usageBandwidthGb?.toString() || '0');
      const deployments = parseInt(userData.usageDeployments?.toString() || '0');

      // Calculate allowance usage percentage
      const storageAllowance = plan.allowances.storageGb;
      const bandwidthAllowance = plan.allowances.bandwidthGb;
      const allowanceUsedPercent = 
        ((storageGb / Math.max(storageAllowance, 1)) * 50) +
        ((bandwidthGb / Math.max(bandwidthAllowance, 1)) * 50);

      const currentBalance = parseFloat(userData.creditsBalance?.toString() || '0');

      // Create snapshot in usageLedger BEFORE reset
      await tx.insert(usageLedger).values({
        userId: parseInt(userId),
        billingPeriod: closingPeriod,
        snapshotType: 'monthly_refill',
        computeHoursTotal: computeHours.toString(),
        storageGbTotal: storageGb.toString(),
        bandwidthGbTotal: bandwidthGb.toString(),
        deploymentsTotal: deployments,
        creditsUsed: creditsUsed.toString(),
        payAsYouGoTotal: payAsYouGoTotal.toString(),
        allowanceUsedPercent: allowanceUsedPercent.toFixed(2),
        subscriptionTier: userData.subscriptionTier || 'free',
        creditsBalance: currentBalance.toString(),
        creditsMonthlyAllowance: plan.creditsMonthly.toString(),
        createdAt: new Date(),
        metadata: {
          plan: userData.subscriptionTier,
          eventsCount: periodEvents.length,
          closingPeriod,
        },
      });

      // Now refill credits and reset ONLY allowance-facing usage fields
      // NEVER reset lastBilled* (they are lifetime totals)
      // P-H3: Cap credits at MAX_CREDITS to prevent balance overflow
      const newBalance = Math.min(currentBalance + plan.creditsMonthly, MAX_CREDITS);
      const now = new Date();

      await tx.update(users).set({
        creditsBalance: newBalance.toFixed(2),
        creditsMonthlyAllowance: plan.creditsMonthly.toFixed(2),
        lastCreditRefill: now,
        usageResetAt: now,
        // Reset ONLY allowance-facing usage counters
        usageComputeHours: '0.00',
        usageStorageGb: '0.00',
        usageBandwidthGb: '0.00',
        usageDeployments: 0,
        // NEVER reset lastBilled* - these are lifetime cumulative totals
      }).where(eq(users.id, parseInt(userId)));

      logger.info(
        `Monthly refill for user ${userId}: ` +
        `+${plan.creditsMonthly} credits (new balance: ${newBalance.toFixed(2)}, capped at ${MAX_CREDITS}), ` +
        `snapshot saved (period: ${closingPeriod}, credits used: $${creditsUsed.toFixed(2)}, pay-as-you-go: $${payAsYouGoTotal.toFixed(2)})`
      );
    });
  }

  /**
   * Check if credits need refilling (monthly cycle)
   */
  async checkAndRefillCredits(userId: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user || !user.lastCreditRefill) {
      // First time - refill immediately
      await this.refillMonthlyCredits(userId);
      return;
    }

    const now = new Date();
    const lastRefill = new Date(user.lastCreditRefill);
    const daysSinceRefill = (now.getTime() - lastRefill.getTime()) / (1000 * 60 * 60 * 24);

    // Refill if more than 30 days since last refill
    if (daysSinceRefill >= 30) {
      await this.refillMonthlyCredits(userId);
    }
  }

  /**
   * Record compute usage and deduct from allowance/credits/pay-as-you-go
   * MIGRATED: Now uses recordUsageIdempotent for production-ready billing
   */
  async recordComputeUsage(userId: string, vcpuHours: number): Promise<CostBreakdown> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Convert incremental usage to absolute total
    const currentUsage = parseFloat(user.usageComputeHours || '0');
    const newTotalUsage = currentUsage + vcpuHours;

    // Generate idempotency key for this usage report using crypto.randomUUID() for collision prevention
    const idempotencyKey = `compute-${userId}-${Date.now()}-${crypto.randomUUID()}`;

    // Use production-ready idempotent billing
    return await this.recordUsageIdempotent(
      userId,
      'compute',
      newTotalUsage,
      idempotencyKey
    );
  }

  /**
   * Record storage usage (incremental billing - only charge for NEW usage beyond allowance)
   * @param storageGb - INCREMENTAL storage used (GB added, must be >= 0)
   * MIGRATED: Now uses recordUsageIdempotent for production-ready billing
   */
  async recordStorageUsage(userId: string, storageGb: number): Promise<CostBreakdown> {
    // Validation: Reject negative increments (deletions/refunds not supported)
    if (storageGb < 0) {
      throw new Error('Negative storage increments not supported. Use absolute decrease tracking.');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Convert incremental usage to absolute total
    const currentUsage = parseFloat(user.usageStorageGb || '0');
    const newTotalUsage = currentUsage + storageGb;

    // Generate idempotency key for this usage report using crypto.randomUUID() for collision prevention
    const idempotencyKey = `storage-${userId}-${Date.now()}-${crypto.randomUUID()}`;

    // Use production-ready idempotent billing
    return await this.recordUsageIdempotent(
      userId,
      'storage',
      newTotalUsage,
      idempotencyKey
    );
  }

  /**
   * Record bandwidth usage (incremental billing - only charge for NEW usage beyond allowance)
   * @param bandwidthGb - INCREMENTAL bandwidth used (GB added, must be >= 0)
   * MIGRATED: Now uses recordUsageIdempotent for production-ready billing
   */
  async recordBandwidthUsage(userId: string, bandwidthGb: number): Promise<CostBreakdown> {
    // Validation: Reject negative increments (prevents retry/reconciliation errors)
    if (bandwidthGb < 0) {
      throw new Error('Negative bandwidth increments not supported.');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Convert incremental usage to absolute total
    const currentUsage = parseFloat(user.usageBandwidthGb || '0');
    const newUsage = currentUsage + bandwidthGb;

    // Generate idempotency key for this usage report using crypto.randomUUID() for collision prevention
    const idempotencyKey = `bandwidth-${userId}-${Date.now()}-${crypto.randomUUID()}`;

    // Use production-ready idempotent billing
    return await this.recordUsageIdempotent(
      userId,
      'bandwidth',
      newUsage,
      idempotencyKey
    );
  }

  /**
   * Get current credits balance and usage summary
   */
  async getCreditsStatus(userId: string): Promise<{
    creditsBalance: number;
    creditsMonthlyAllowance: number;
    lastRefill: Date | null;
    usage: UsageMetrics;
    allowances: typeof PLANS.CORE.allowances;
    plan: typeof PLANS.CORE;
  }> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = getPlanByTier(user.subscriptionTier || 'free');

    return {
      creditsBalance: parseFloat(user.creditsBalance || '0'),
      creditsMonthlyAllowance: parseFloat(user.creditsMonthlyAllowance || '0'),
      lastRefill: user.lastCreditRefill || null,
      usage: {
        computeHours: parseFloat(user.usageComputeHours || '0'),
        storageGb: parseFloat(user.usageStorageGb || '0'),
        bandwidthGb: parseFloat(user.usageBandwidthGb || '0'),
        deployments: user.usageDeployments || 0,
      },
      allowances: plan.allowances,
      plan,
    };
  }

  /**
   * Reset monthly usage counters
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    await storage.updateUser(userId, {
      usageComputeHours: '0.00',
      usageStorageGb: '0.00',
      usageBandwidthGb: '0.00',
      usageDeployments: 0,
      usageResetAt: new Date(),
    });

    logger.info(`Reset monthly usage for user ${userId}`);
  }

  /**
   * Update user's plan allowances and credits when subscription changes
   * Preserves existing credits balance AND current-period usage for accurate proration
   */
  async updatePlanAllowances(userId: string, tier: 'free' | 'core' | 'teams' | 'enterprise'): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = getPlanByTier(tier);
    const now = new Date();
    
    // Preserve existing credits AND usage - only update allowances and monthly entitlement
    const currentBalance = parseFloat(user.creditsBalance || '0');
    
    await storage.updateUser(userId, {
      subscriptionTier: tier,
      creditsMonthlyAllowance: plan.creditsMonthly.toString(),
      // PRESERVE existing balance - don't overwrite with plan default
      // creditsBalance will be topped up on next monthly refill
      allowanceVcpus: plan.allowances.vcpus,
      allowanceRamGb: plan.allowances.ramGb,
      allowanceStorageGb: plan.allowances.storageGb,
      allowanceBandwidthGb: plan.allowances.bandwidthGb,
      // Don't reset usageResetAt - preserve current billing period
    });

    // DON'T reset usage counters - preserve for accurate proration
    // Usage will be reset on next monthly refill cycle
    // await this.resetMonthlyUsage(userId); // REMOVED

    logger.info(`Updated plan allowances for user ${userId} to ${tier} tier (preserved $${currentBalance.toFixed(2)} credits and current-period usage)`);
  }

  // REMOVED: recordPayAsYouGoCharge - now handled by recordUsageIdempotent → pay_as_you_go_queue

  /**
   * Add credits to a user's balance (for refunds, bonuses, etc.)
   * #133 FIXED: Transactional credit addition with audit logging
   */
  async addCredits(userId: string, amount: number, reason: string): Promise<void> {
    return await db.transaction(async (tx) => {
      const user = await tx
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .for('update')
        .limit(1);

      if (!user || user.length === 0) {
        throw new Error('User not found');
      }

      const userData = user[0];
      const currentBalance = parseFloat(userData.creditsBalance?.toString() || '0');
      const newBalance = Math.min(currentBalance + amount, MAX_CREDITS);

      await tx.update(users).set({
        creditsBalance: newBalance.toFixed(2),
      }).where(eq(users.id, parseInt(userId)));

      logger.info(`Added ${amount} credits to user ${userId} (reason: ${reason}). Balance: ${currentBalance.toFixed(2)} -> ${newBalance.toFixed(2)}`);
    });
  }
}

export const creditsService = new CreditsService();
