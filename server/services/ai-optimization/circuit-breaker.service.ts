/**
 * Circuit Breaker Service for AI Providers
 * Prevents cascade failures by temporarily disabling unhealthy providers
 * Implements exponential backoff and automatic recovery
 */

import { db } from "../../db/drizzle";
import { aiProviderHealth, type AiProviderHealth } from "../../../shared/schema";
import { eq } from "drizzle-orm";

export type ProviderStatus = 'healthy' | 'degraded' | 'circuit_open' | 'unavailable';

export interface ProviderHealthStatus {
  provider: string;
  status: ProviderStatus;
  canAcceptRequests: boolean;
  nextRetryAt?: Date;
  errorRate: number;
  avgResponseTime: number;
}

export class CircuitBreakerService {
  // Configuration
  private static readonly MAX_CONSECUTIVE_FAILURES = 5;
  private static readonly ERROR_RATE_THRESHOLD = 0.5; // 50%
  private static readonly CIRCUIT_OPEN_DURATION_MS = 60000; // 1 minute
  private static readonly MAX_BACKOFF_MS = 300000; // 5 minutes

  /**
   * Initialize health tracking for a provider
   */
  async initializeProvider(provider: string): Promise<void> {
    const existing = await this.getProviderHealth(provider);
    
    if (!existing) {
      await db.insert(aiProviderHealth).values({
        provider,
        status: 'healthy',
        consecutiveFailures: 0,
        totalRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        metadata: {},
      });
    }
  }

  /**
   * Check if a provider can accept requests
   */
  async canAcceptRequest(provider: string): Promise<boolean> {
    const health = await this.getProviderHealth(provider);
    
    if (!health) {
      // Provider not initialized, initialize and allow
      await this.initializeProvider(provider);
      return true;
    }

    // Circuit open - check if we should retry
    if (health.status === 'circuit_open' && health.nextRetryAt) {
      if (new Date() >= new Date(health.nextRetryAt)) {
        // Time to retry - move to degraded state
        await this.updateStatus(provider, 'degraded');
        return true;
      }
      return false; // Still in cooldown
    }

    // Unavailable providers never accept requests
    if (health.status === 'unavailable') {
      return false;
    }

    // Healthy and degraded providers accept requests
    return true;
  }

  /**
   * Record successful request
   */
  async recordSuccess(params: {
    provider: string;
    responseTime: number;
  }): Promise<void> {
    const health = await this.getProviderHealth(params.provider);
    
    if (!health) {
      await this.initializeProvider(params.provider);
      return;
    }

    const totalRequests = health.totalRequests || 0;
    const avgResponseTime = health.avgResponseTime || 0;
    const failedRequests = health.failedRequests || 0;
    
    const newTotalRequests = totalRequests + 1;
    const newAvgResponseTime = Math.round(
      (avgResponseTime * totalRequests + params.responseTime) / newTotalRequests
    );

    const errorRate = failedRequests / newTotalRequests;
    const newStatus = this.calculateStatus(0, errorRate, newAvgResponseTime);

    await db
      .update(aiProviderHealth)
      .set({
        status: newStatus,
        consecutiveFailures: 0, // Reset on success
        lastSuccess: new Date(),
        totalRequests: newTotalRequests,
        avgResponseTime: newAvgResponseTime,
        metadata: {
          ...health.metadata as any,
          errorRate,
        },
        updatedAt: new Date(),
      })
      .where(eq(aiProviderHealth.provider, params.provider));
  }

  /**
   * Record failed request
   */
  async recordFailure(params: {
    provider: string;
    error: string;
    responseTime?: number;
  }): Promise<void> {
    const health = await this.getProviderHealth(params.provider);
    
    if (!health) {
      await this.initializeProvider(params.provider);
      return;
    }

    const consecutiveFailures = health.consecutiveFailures || 0;
    const totalRequests = health.totalRequests || 0;
    const failedRequests = health.failedRequests || 0;
    const avgResponseTime = health.avgResponseTime || 0;
    
    const newConsecutiveFailures = consecutiveFailures + 1;
    const newTotalRequests = totalRequests + 1;
    const newFailedRequests = failedRequests + 1;
    const errorRate = newFailedRequests / newTotalRequests;

    // Calculate new status
    let newStatus = health.status;
    let circuitOpenedAt = health.circuitOpenedAt;
    let nextRetryAt = health.nextRetryAt;

    if (newConsecutiveFailures >= CircuitBreakerService.MAX_CONSECUTIVE_FAILURES) {
      // Open circuit
      newStatus = 'circuit_open';
      circuitOpenedAt = new Date();
      
      // Exponential backoff
      const backoffMs = Math.min(
        CircuitBreakerService.CIRCUIT_OPEN_DURATION_MS * Math.pow(2, Math.min(newConsecutiveFailures - 5, 4)),
        CircuitBreakerService.MAX_BACKOFF_MS
      );
      nextRetryAt = new Date(Date.now() + backoffMs);
    } else if (errorRate > CircuitBreakerService.ERROR_RATE_THRESHOLD) {
      newStatus = 'degraded';
    }

    // Update average response time if provided
    let newAvgResponseTime = avgResponseTime;
    if (params.responseTime !== undefined) {
      newAvgResponseTime = Math.round(
        (avgResponseTime * totalRequests + params.responseTime) / newTotalRequests
      );
    }

    await db
      .update(aiProviderHealth)
      .set({
        status: newStatus,
        consecutiveFailures: newConsecutiveFailures,
        lastFailure: new Date(),
        circuitOpenedAt,
        nextRetryAt,
        totalRequests: newTotalRequests,
        failedRequests: newFailedRequests,
        avgResponseTime: newAvgResponseTime,
        metadata: {
          ...health.metadata as any,
          errorRate,
          lastError: params.error,
        },
        updatedAt: new Date(),
      })
      .where(eq(aiProviderHealth.provider, params.provider));
  }

  /**
   * Get provider health status
   */
  async getStatus(provider: string): Promise<ProviderHealthStatus | null> {
    const health = await this.getProviderHealth(provider);
    
    if (!health) {
      return null;
    }

    const metadata = health.metadata as any || {};
    const canAccept = await this.canAcceptRequest(provider);

    return {
      provider: health.provider,
      status: health.status,
      canAcceptRequests: canAccept,
      nextRetryAt: health.nextRetryAt || undefined,
      errorRate: metadata.errorRate || 0,
      avgResponseTime: health.avgResponseTime || 0,
    };
  }

  /**
   * Get all providers health status
   */
  async getAllStatus(): Promise<ProviderHealthStatus[]> {
    const allHealth = await db.select().from(aiProviderHealth);
    
    const statuses = await Promise.all(
      allHealth.map(async (health) => {
        const metadata = health.metadata as any || {};
        const canAccept = await this.canAcceptRequest(health.provider);
        
        return {
          provider: health.provider,
          status: health.status,
          canAcceptRequests: canAccept,
          nextRetryAt: health.nextRetryAt || undefined,
          errorRate: metadata.errorRate || 0,
          avgResponseTime: health.avgResponseTime || 0,
        };
      })
    );

    return statuses;
  }

  /**
   * Manually reset circuit for a provider
   */
  async resetCircuit(provider: string): Promise<void> {
    await db
      .update(aiProviderHealth)
      .set({
        status: 'healthy',
        consecutiveFailures: 0,
        circuitOpenedAt: null,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderHealth.provider, provider));
  }

  /**
   * Get provider health from database
   */
  private async getProviderHealth(provider: string): Promise<AiProviderHealth | undefined> {
    const results = await db
      .select()
      .from(aiProviderHealth)
      .where(eq(aiProviderHealth.provider, provider))
      .limit(1);
    
    return results[0];
  }

  /**
   * Update provider status
   */
  private async updateStatus(provider: string, status: ProviderStatus): Promise<void> {
    await db
      .update(aiProviderHealth)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderHealth.provider, provider));
  }

  /**
   * Calculate status based on metrics
   */
  private calculateStatus(
    consecutiveFailures: number,
    errorRate: number,
    avgResponseTime: number
  ): ProviderStatus {
    if (consecutiveFailures >= CircuitBreakerService.MAX_CONSECUTIVE_FAILURES) {
      return 'circuit_open';
    }
    
    if (errorRate > CircuitBreakerService.ERROR_RATE_THRESHOLD || avgResponseTime > 10000) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

export const circuitBreaker = new CircuitBreakerService();
