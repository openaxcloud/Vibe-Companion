/**
 * Stripe Usage Worker - Background Job Processor
 * Processes ai_stripe_usage_queue with exponential backoff retry logic
 * Ensures zero revenue loss by retrying failed Stripe billing calls
 * 
 * ✅ UPDATED: Uses Stripe API 2025-08-27.basil with billing.MeterEvent
 * (Legacy subscriptionItems.createUsageRecord removed in API 2025-03-31.basil)
 */

import { db } from '../db';
import { aiStripeUsageQueue, aiUsageMetering, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';
import { createLogger } from '../utils/logger';
import { AlertService } from '../services/alert-service';

const logger = createLogger('stripe-usage-worker');

const stripe = process.env.STRIPE_SECRET_KEY ? getStripe() : null;

/**
 * Calculate next retry delay with exponential backoff
 * 1st retry: 5 minutes
 * 2nd retry: 15 minutes (3x)
 * 3rd retry: 45 minutes (3x)
 */
function calculateNextRetry(attempts: number): Date {
  const baseDelayMinutes = 5;
  const delayMinutes = baseDelayMinutes * Math.pow(3, attempts);
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
  return nextRetry;
}

/**
 * Process a single queue item
 * ✅ NOTE: Items are already marked as 'processing' by atomic claim in main loop
 */
async function processQueueItem(item: any): Promise<void> {
  try {
    // Item already marked as 'processing' by atomic UPDATE in processStripeUsageQueue()

    logger.info(`Processing Stripe queue item ${item.id}`, {
      meteringId: item.metering_id,
      userId: item.user_id,
      attempts: item.attempts,
    });

    // ✅ Fetch user to get Stripe Customer ID (required for new Meter API)
    const user = await db.select().from(users).where(eq(users.id, item.user_id)).limit(1);
    if (!user || user.length === 0) {
      throw new Error(`User ${item.user_id} not found`);
    }

    const stripeCustomerId = user[0].stripeCustomerId;
    if (!stripeCustomerId) {
      throw new Error('No Stripe Customer ID - user may not have active subscription');
    }

    // ✅ NEW API: billing.MeterEvent (replaces deprecated subscriptionItems.createUsageRecord)
    // Stripe API 2025-03-31.basil removed legacy usage-based billing methods
    const meterEvent = await stripe!.billing.meterEvents.create({
      event_name: 'ai_api_usage', // Meter event name (must match Stripe Dashboard meter)
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: String(Math.ceil(parseFloat(item.cost_usd) * 100)), // Convert USD to cents as string
      },
      timestamp: Math.floor(Date.now() / 1000),
    });

    logger.info(`✅ Stripe meter event created successfully`, {
      queueId: item.id,
      meteringId: item.metering_id,
      meterEventId: meterEvent.identifier,
      customerId: stripeCustomerId,
    });

    // Mark queue item as completed
    await db.update(aiStripeUsageQueue)
      .set({ 
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(aiStripeUsageQueue.id, item.id));

    // Update metering record
    await db.update(aiUsageMetering)
      .set({
        billed: true,
        billedAt: new Date(),
        stripeUsageRecordId: meterEvent.identifier,
      })
      .where(eq(aiUsageMetering.id, item.metering_id));

  } catch (error: any) {
    const newAttempts = item.attempts + 1;
    logger.error(`❌ Stripe queue processing failed (attempt ${newAttempts}/${item.max_attempts})`, {
      queueId: item.id,
      meteringId: item.metering_id,
      error: error.message,
    });

    // Check if exhausted
    if (newAttempts >= item.max_attempts) {
      logger.error(`🚨 Stripe queue EXHAUSTED for item ${item.id} - Manual intervention required!`);

      // Mark as failed
      await db.update(aiStripeUsageQueue)
        .set({
          status: 'failed',
          attempts: newAttempts,
          lastError: error.message || 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(aiStripeUsageQueue.id, item.id));

      // Send critical alert
      await AlertService.stripeQueueExhausted(
        item.metering_id,
        newAttempts,
        error.message || 'Unknown error'
      );

    } else {
      // Schedule retry with exponential backoff
      const nextRetry = calculateNextRetry(newAttempts);
      await db.update(aiStripeUsageQueue)
        .set({
          status: 'pending',
          attempts: newAttempts,
          lastError: error.message || 'Unknown error',
          nextRetryAt: nextRetry,
          updatedAt: new Date(),
        })
        .where(eq(aiStripeUsageQueue.id, item.id));

      logger.info(`Scheduled retry for queue item ${item.id} at ${nextRetry.toISOString()}`);
    }
  }
}

/**
 * Main worker loop - processes pending queue items with row-level locking
 * ✅ CRITICAL: Uses atomic claim to prevent double-processing in multi-instance environments
 */
export async function processStripeUsageQueue(): Promise<void> {
  try {
    // ✅ SHORT-CIRCUIT: Skip processing if Stripe key not configured
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.debug('Stripe API key not configured - skipping queue processing');
      return;
    }

    // ✅ SAFETY: Assert Stripe client is initialized (TypeScript type narrowing)
    if (!stripe) {
      logger.error('Stripe client not initialized despite STRIPE_SECRET_KEY being set');
      return;
    }

    // ✅ ATOMIC CLAIM: Use raw SQL with FOR UPDATE SKIP LOCKED to prevent race conditions
    // This guarantees ONLY ONE worker processes each queue item (multi-instance safe)
    type QueueItem = {
      id: number;
      metering_id: number;
      user_id: string;
      subscription_id: string | null;
      cost_usd: string;
      status: string;
      attempts: number;
      max_attempts: number;
      last_error: string | null;
      next_retry_at: Date;
      created_at: Date;
      updated_at: Date;
    };

    const result = await db.execute<QueueItem>(sql`
      UPDATE ${aiStripeUsageQueue}
      SET status = 'processing'
      WHERE id IN (
        SELECT id FROM ${aiStripeUsageQueue}
        WHERE status = 'pending' AND next_retry_at <= NOW()
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    // ✅ ROBUST: Handle different adapter return shapes (Postgres array vs SQLite {rows})
    // NodePgDatabase returns QueryResult with .rows, other adapters return array directly
    const pendingItems: QueueItem[] = Array.isArray(result) ? result : (result as any).rows || [];

    if (pendingItems.length === 0) {
      logger.debug('No pending Stripe queue items to process');
      return;
    }

    logger.info(`Processing ${pendingItems.length} pending Stripe queue items`);

    // Process items sequentially to avoid rate limits
    for (const item of pendingItems) {
      await processQueueItem(item);
    }

  } catch (error: any) {
    // PostgresError has symbol properties that don't JSON.stringify
    // Extract the actual error details
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack, code: (error as any).code, detail: (error as any).detail }
      : error;
    logger.error('Stripe usage worker error', { error: errorDetails });
  }
}

/**
 * Start worker with interval (30 seconds)
 */
export function startStripeUsageWorker(): NodeJS.Timeout {
  const intervalMs = 30 * 1000; // 30 seconds
  logger.info(`Starting Stripe usage worker (interval: ${intervalMs}ms)`);

  // Run immediately on startup
  processStripeUsageQueue().catch((error) => {
    logger.error('Initial Stripe queue processing failed', { error });
  });

  // Then run on interval
  return setInterval(() => {
    processStripeUsageQueue().catch((error) => {
      logger.error('Stripe queue processing failed', { error });
    });
  }, intervalMs);
}
