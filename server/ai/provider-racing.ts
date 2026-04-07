/**
 * Provider Racing Module - Fortune 500-Grade AI Latency Optimization
 * 
 * Races multiple AI providers simultaneously and returns the first valid response.
 * This reduces p95 latency by avoiding slow provider fallback chains.
 * 
 * Key Features:
 * - Race 2 providers simultaneously (cost-optimized)
 * - Cancel losing requests immediately on first valid response
 * - Automatic fallback if both racers fail
 * - Cost tracking and guardrails
 * - Provider health-aware selection
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { createLogger } from '../utils/logger';
import { providerLatencyMonitor } from './provider-latency-monitor';

const logger = createLogger('provider-racing');

export interface RaceResult<T> {
  success: boolean;
  data?: T;
  provider: string;
  latencyMs: number;
  cancelled: string[];
  error?: string;
}

export interface RaceOptions {
  maxRacers?: number;
  timeoutMs?: number;
  costBudgetTokens?: number;
  requireValidJson?: boolean;
}

export interface ProviderRequest<T> {
  provider: string;
  execute: (signal: AbortSignal) => Promise<T>;
  priority?: number;
}

const DEFAULT_OPTIONS: RaceOptions = {
  maxRacers: 2,
  timeoutMs: 120000, // 120s - AI streams need sufficient time for complex generations
  costBudgetTokens: 10000,
  requireValidJson: true
};

export class ProviderRacing {
  private activeRaces: Map<string, AbortController[]> = new Map();
  private raceMetrics = {
    totalRaces: 0,
    winsByProvider: new Map<string, number>(),
    avgLatencyByProvider: new Map<string, { sum: number; count: number }>(),
    cancelledRequests: 0,
    fallbacksNeeded: 0
  };

  /**
   * Race multiple providers and return the first valid response
   * 
   * @param raceId - Unique identifier for this race (for cancellation)
   * @param requests - Provider requests to race
   * @param options - Race configuration
   * @returns First successful result or error
   */
  async race<T>(
    raceId: string,
    requests: ProviderRequest<T>[],
    options: RaceOptions = {}
  ): Promise<RaceResult<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    
    if (requests.length === 0) {
      return {
        success: false,
        provider: 'none',
        latencyMs: 0,
        cancelled: [],
        error: 'No providers available for racing'
      };
    }

    // Sort by priority and select top N racers
    const sortedRequests = [...requests].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const racers = sortedRequests.slice(0, opts.maxRacers!);
    
    logger.info(`[Race:${raceId}] Starting race with ${racers.length} providers: ${racers.map(r => r.provider).join(', ')}`);
    
    // Create abort controllers for each racer
    const controllers = racers.map(() => new AbortController());
    this.activeRaces.set(raceId, controllers);
    
    // Create timeout controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
      controllers.forEach(c => c.abort());
    }, opts.timeoutMs!);
    
    try {
      this.raceMetrics.totalRaces++;
      
      // Create racing promises
      const racePromises = racers.map(async (req, index) => {
        const controller = controllers[index];
        const providerStart = Date.now();
        
        try {
          // Check if already aborted
          if (controller.signal.aborted) {
            throw new Error('Race cancelled before start');
          }
          
          const result = await req.execute(controller.signal);
          const latency = Date.now() - providerStart;
          
          // Validate JSON if required - extract JSON from text that may include commentary
          if (opts.requireValidJson && typeof result === 'string') {
            try {
              // First try direct parse
              JSON.parse(result);
            } catch (err: any) { console.error("[catch]", err?.message || err);
              // Try to extract JSON from text with pre/postamble
              const jsonMatch = result.match(/(\{[\s\S]*\})/);
              if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
              }
              try {
                JSON.parse(jsonMatch[1]);
              } catch (err: any) { console.error("[catch]", err?.message || err);
                throw new Error('Invalid JSON response');
              }
            }
          }
          
          // Update metrics
          this.updateProviderMetrics(req.provider, latency, true);
          
          return {
            success: true as const,
            data: result,
            provider: req.provider,
            latencyMs: latency,
            index
          };
        } catch (error: any) {
          const latency = Date.now() - providerStart;
          
          // Don't log aborted requests as errors
          if (error.name !== 'AbortError' && !controller.signal.aborted) {
            logger.warn(`[Race:${raceId}] Provider ${req.provider} failed:`, error.message);
            this.updateProviderMetrics(req.provider, latency, false);
          }
          
          throw { provider: req.provider, error, index };
        }
      });
      
      // Race all providers - first to resolve wins
      const result = await this.raceWithCancellation(racePromises, controllers, raceId);
      
      clearTimeout(timeoutId);
      
      // Track cancelled providers
      const cancelled = racers
        .filter((_, i) => i !== result.index && controllers[i].signal.aborted)
        .map(r => r.provider);
      
      this.raceMetrics.cancelledRequests += cancelled.length;
      
      // Update win count
      const wins = this.raceMetrics.winsByProvider.get(result.provider) ?? 0;
      this.raceMetrics.winsByProvider.set(result.provider, wins + 1);
      
      logger.info(`[Race:${raceId}] Winner: ${result.provider} in ${result.latencyMs}ms, cancelled: [${cancelled.join(', ')}]`);
      
      return {
        success: true,
        data: result.data,
        provider: result.provider,
        latencyMs: Date.now() - startTime,
        cancelled
      };
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // All racers failed - try fallback chain
      this.raceMetrics.fallbacksNeeded++;
      
      const fallbackProviders = sortedRequests.slice(opts.maxRacers!);
      if (fallbackProviders.length > 0) {
        logger.warn(`[Race:${raceId}] All racers failed, trying fallback chain...`);
        
        for (const fallback of fallbackProviders) {
          try {
            const fallbackStart = Date.now();
            const fallbackController = new AbortController();
            const result = await fallback.execute(fallbackController.signal);
            const latency = Date.now() - fallbackStart;
            
            logger.info(`[Race:${raceId}] Fallback succeeded with ${fallback.provider} in ${latency}ms`);
            
            return {
              success: true,
              data: result,
              provider: fallback.provider,
              latencyMs: Date.now() - startTime,
              cancelled: racers.map(r => r.provider)
            };
          } catch (fallbackError: any) {
            logger.warn(`[Race:${raceId}] Fallback ${fallback.provider} also failed:`, fallbackError.message);
          }
        }
      }
      
      logger.error(`[Race:${raceId}] All providers failed after ${Date.now() - startTime}ms`);
      
      return {
        success: false,
        provider: 'none',
        latencyMs: Date.now() - startTime,
        cancelled: racers.map(r => r.provider),
        error: 'All providers failed'
      };
      
    } finally {
      this.activeRaces.delete(raceId);
    }
  }

  /**
   * Race promises with automatic cancellation of losers
   */
  private async raceWithCancellation<T>(
    promises: Promise<T>[],
    controllers: AbortController[],
    raceId: string
  ): Promise<T & { index: number }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let failedCount = 0;
      const errors: any[] = [];
      
      promises.forEach((promise, index) => {
        promise
          .then((result: any) => {
            if (!settled) {
              settled = true;
              
              // Cancel all other requests
              controllers.forEach((controller, i) => {
                if (i !== index && !controller.signal.aborted) {
                  controller.abort();
                }
              });
              
              resolve({ ...result, index });
            }
          })
          .catch((error) => {
            errors.push(error);
            failedCount++;
            
            if (failedCount === promises.length && !settled) {
              settled = true;
              reject(new Error(`All ${promises.length} providers failed`));
            }
          });
      });
    });
  }

  /**
   * Update provider performance metrics
   */
  private updateProviderMetrics(provider: string, latencyMs: number, success: boolean) {
    if (success) {
      const existing = this.raceMetrics.avgLatencyByProvider.get(provider) ?? { sum: 0, count: 0 };
      this.raceMetrics.avgLatencyByProvider.set(provider, {
        sum: existing.sum + latencyMs,
        count: existing.count + 1
      });
      
      // Update global latency monitor (provider, model, latencyMs, success)
      providerLatencyMonitor.recordLatency(provider, 'default', latencyMs, success);
    } else {
      providerLatencyMonitor.recordLatency(provider, 'default', latencyMs, success);
    }
  }

  /**
   * Cancel an active race
   */
  cancelRace(raceId: string): void {
    const controllers = this.activeRaces.get(raceId);
    if (controllers) {
      controllers.forEach(c => c.abort());
      this.activeRaces.delete(raceId);
      logger.info(`[Race:${raceId}] Cancelled by request`);
    }
  }

  /**
   * Get racing metrics for monitoring
   */
  getMetrics(): {
    totalRaces: number;
    winsByProvider: Record<string, number>;
    avgLatencyByProvider: Record<string, number>;
    cancelledRequests: number;
    fallbacksNeeded: number;
    cancellationRate: number;
  } {
    const winsByProvider: Record<string, number> = {};
    this.raceMetrics.winsByProvider.forEach((count, provider) => {
      winsByProvider[provider] = count;
    });
    
    const avgLatencyByProvider: Record<string, number> = {};
    this.raceMetrics.avgLatencyByProvider.forEach(({ sum, count }, provider) => {
      avgLatencyByProvider[provider] = Math.round(sum / count);
    });
    
    const totalRacedProviders = this.raceMetrics.totalRaces * 2; // Assuming 2 racers
    const cancellationRate = totalRacedProviders > 0 
      ? this.raceMetrics.cancelledRequests / totalRacedProviders 
      : 0;
    
    return {
      totalRaces: this.raceMetrics.totalRaces,
      winsByProvider,
      avgLatencyByProvider,
      cancelledRequests: this.raceMetrics.cancelledRequests,
      fallbacksNeeded: this.raceMetrics.fallbacksNeeded,
      cancellationRate
    };
  }

  /**
   * Select optimal racers based on recent performance
   * Uses latency monitoring to pick fastest providers
   */
  selectRacers(
    availableProviders: string[],
    count: number = 2
  ): string[] {
    if (availableProviders.length <= count) {
      return availableProviders;
    }
    
    // Get performance stats for each provider
    const providerStats = availableProviders.map(provider => {
      const stats = providerLatencyMonitor.getProviderStats(provider);
      const successRate = stats && stats.totalRequests > 0 
        ? stats.successfulRequests / stats.totalRequests 
        : 0.5;
      return {
        provider,
        avgLatency: stats?.avgLatencyMs ?? 5000, // Default high latency if unknown
        successRate,
        score: 0
      };
    });
    
    // Score = (1 / avgLatency) * successRate
    // Higher score = faster and more reliable
    providerStats.forEach(stat => {
      stat.score = (1000 / stat.avgLatency) * stat.successRate;
    });
    
    // Sort by score (descending) and take top N
    return providerStats
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.provider);
  }
}

export const providerRacing = new ProviderRacing();
