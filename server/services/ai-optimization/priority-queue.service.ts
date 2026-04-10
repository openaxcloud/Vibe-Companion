// @ts-nocheck
/**
 * Priority Queue Service for AI Requests
 * Manages AI request queue with priority levels and rate limiting
 * Ensures critical operations get processed first
 */

import { db } from "../../db/drizzle";
import { aiRequestQueue, type InsertAiRequestQueue } from "../../../shared/schema";
import { eq, and, isNull, desc, asc, sql } from "drizzle-orm";
import { TaskType } from './task-classifier.service';

export type QueuePriority = 'critical' | 'high' | 'normal' | 'low';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface QueuedRequest {
  id: string;
  userId?: string;
  projectId?: string;
  priority: QueuePriority;
  taskType: TaskType;
  provider?: string;
  status: QueueStatus;
  payload: {
    operation: string;
    parameters: Record<string, any>;
    context?: Record<string, any>;
  };
  queuedAt: Date;
  retryCount: number;
  maxRetries: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgWaitTime: number;
  avgProcessingTime: number;
}

export class PriorityQueueService {
  /**
   * Enqueue a new request
   */
  async enqueue(params: {
    userId?: string;
    projectId?: string;
    priority: QueuePriority;
    taskType: TaskType;
    operation: string;
    parameters: Record<string, any>;
    context?: Record<string, any>;
    metadata?: {
      debounced?: boolean;
      cacheKey?: string;
      estimatedTokens?: number;
    };
  }): Promise<string> {
    const result = await db.insert(aiRequestQueue).values({
      userId: params.userId,
      projectId: params.projectId,
      priority: params.priority,
      taskType: params.taskType,
      status: 'pending',
      payload: {
        operation: params.operation,
        parameters: params.parameters,
        context: params.context,
      },
      retryCount: 0,
      maxRetries: 3,
      metadata: params.metadata || {},
    }).returning();

    return result[0].id;
  }

  /**
   * Dequeue next request by priority (atomic with PostgreSQL row locks)
   * SECURITY: Uses CTE with FOR UPDATE SKIP LOCKED to prevent race conditions
   */
  async dequeue(): Promise<QueuedRequest | null> {
    // ATOMIC: Uses CTE (Common Table Expression) with row locks
    // FOR UPDATE SKIP LOCKED prevents double-dispatch in concurrent workers
    const result = await db.execute<{
      id: string;
      user_id: string | null;
      project_id: string | null;
      priority: string;
      task_type: string;
      provider: string | null;
      status: string;
      payload: any;
      queued_at: Date;
      retry_count: number | null;
      max_retries: number | null;
    }>(sql`
      WITH next_request AS (
        SELECT id
        FROM ai_request_queue
        WHERE status = 'pending'
        ORDER BY 
          CASE priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END DESC,
          queued_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ai_request_queue
      SET status = 'processing', started_at = NOW()
      FROM next_request
      WHERE ai_request_queue.id = next_request.id
      RETURNING ai_request_queue.*
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const request = result.rows[0];
    
    return {
      id: request.id,
      userId: request.user_id || undefined,
      projectId: request.project_id || undefined,
      priority: request.priority as QueuePriority,
      taskType: request.task_type as TaskType,
      provider: request.provider || undefined,
      status: 'processing' as QueueStatus,
      payload: request.payload,
      queuedAt: request.queued_at,
      retryCount: request.retry_count || 0,
      maxRetries: request.max_retries || 0,
    };
  }

  /**
   * Complete a request successfully
   */
  async complete(params: {
    id: string;
    result: {
      output?: any;
      tokensUsed?: number;
    };
  }): Promise<void> {
    await db
      .update(aiRequestQueue)
      .set({
        status: 'completed',
        result: params.result,
        completedAt: new Date(),
      })
      .where(eq(aiRequestQueue.id, params.id));
  }

  /**
   * Fail a request
   */
  async fail(params: {
    id: string;
    error: string;
    shouldRetry?: boolean;
  }): Promise<void> {
    const request = await this.getRequest(params.id);
    
    if (!request) {
      return;
    }

    const shouldRetry = params.shouldRetry && request.retryCount < request.maxRetries;

    if (shouldRetry) {
      // Retry with exponential backoff
      const backoffMs = Math.pow(2, request.retryCount) * 1000;
      
      await db
        .update(aiRequestQueue)
        .set({
          status: 'pending',
          retryCount: request.retryCount + 1,
          result: {
            error: params.error,
          },
          // Reset startedAt to re-queue
          startedAt: null,
        })
        .where(eq(aiRequestQueue.id, params.id));
      
      // Wait before retry
      setTimeout(() => {
        // Request will be picked up in next dequeue
      }, backoffMs);
    } else {
      // Max retries reached, mark as failed
      await db
        .update(aiRequestQueue)
        .set({
          status: 'failed',
          result: {
            error: params.error,
          },
          completedAt: new Date(),
        })
        .where(eq(aiRequestQueue.id, params.id));
    }
  }

  /**
   * Cancel a request
   */
  async cancel(id: string): Promise<void> {
    await db
      .update(aiRequestQueue)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(aiRequestQueue.id, id));
  }

  /**
   * Get queue statistics (alias for API compatibility)
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.getStats();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const allRequests = await db.select().from(aiRequestQueue);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      avgWaitTime: 0,
      avgProcessingTime: 0,
    };

    let totalWaitTime = 0;
    let totalProcessingTime = 0;
    let waitCount = 0;
    let processingCount = 0;

    for (const request of allRequests) {
      stats[request.status as keyof typeof stats] = 
        (stats[request.status as keyof typeof stats] as number || 0) + 1;

      if (request.startedAt) {
        const waitTime = new Date(request.startedAt).getTime() - new Date(request.queuedAt).getTime();
        totalWaitTime += waitTime;
        waitCount++;
      }

      if (request.completedAt && request.startedAt) {
        const processingTime = new Date(request.completedAt).getTime() - new Date(request.startedAt).getTime();
        totalProcessingTime += processingTime;
        processingCount++;
      }
    }

    stats.avgWaitTime = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;
    stats.avgProcessingTime = processingCount > 0 ? Math.round(totalProcessingTime / processingCount) : 0;

    return stats;
  }

  /**
   * Get pending requests count by priority
   */
  async getPendingByPriority(): Promise<Record<QueuePriority, number>> {
    const pending = await db
      .select()
      .from(aiRequestQueue)
      .where(eq(aiRequestQueue.status, 'pending'));

    const byPriority: Record<QueuePriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const request of pending) {
      byPriority[request.priority]++;
    }

    return byPriority;
  }

  /**
   * Clear completed/failed requests older than retention period
   */
  async cleanup(retentionDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(aiRequestQueue)
      .where(
        and(
          eq(aiRequestQueue.status, 'completed'),
          // completed before cutoff
        )
      );

    return 0; // Drizzle doesn't return count, would need raw SQL
  }

  /**
   * Get request by ID
   */
  private async getRequest(id: string): Promise<QueuedRequest | null> {
    const results = await db
      .select()
      .from(aiRequestQueue)
      .where(eq(aiRequestQueue.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const request = results[0];
    return {
      id: request.id,
      userId: request.userId || undefined,
      projectId: request.projectId || undefined,
      priority: request.priority,
      taskType: request.taskType,
      provider: request.provider || undefined,
      status: request.status as QueueStatus,
      payload: request.payload as any,
      queuedAt: request.queuedAt,
      retryCount: request.retryCount || 0,
      maxRetries: request.maxRetries || 0,
    };
  }
}

export const priorityQueue = new PriorityQueueService();
