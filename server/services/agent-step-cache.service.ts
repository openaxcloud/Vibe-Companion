/**
 * Agent Step Cache Service
 * 
 * Caches intermediate agent phases for cost savings:
 * - SPECIFICATION: App description, features, technologies
 * - ARCHITECTURE_PLAN: Structure, data models, API endpoints
 * - FILE_LAYOUT: File structure and purposes
 * - INITIAL_SCAFFOLD: Generated code and commands
 * 
 * Allows partial regeneration: "regenerate but change just X"
 * without redoing expensive AI calls for unchanged parts.
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { db } from '../db';
import {
  agentStepCache,
  type AgentStepCache,
  type InsertAgentStepCache
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as crypto from 'crypto';

const logger = createLogger('AgentStepCache');

export type StepType = 'SPECIFICATION' | 'ARCHITECTURE_PLAN' | 'FILE_LAYOUT' | 'INITIAL_SCAFFOLD';

export interface StepCacheContent {
  specification?: {
    title: string;
    description: string;
    features: string[];
    technologies: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  };
  architecturePlan?: {
    structure: string[];
    dataModels: Record<string, any>[];
    apiEndpoints: string[];
    dependencies: string[];
  };
  fileLayout?: {
    files: Array<{
      path: string;
      purpose: string;
      language: string;
    }>;
    directories: string[];
  };
  initialScaffold?: {
    files: Array<{
      path: string;
      content: string;
      language: string;
    }>;
    commands: string[];
  };
  raw?: string;
}

export interface CacheMetrics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  costSaved: number;
  tokensSaved: number;
}

class AgentStepCacheService {
  private metrics = {
    hits: 0,
    misses: 0,
    costSaved: 0,
    tokensSaved: 0
  };

  /**
   * Generate a hash for the prompt to use as cache key
   */
  private generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
  }

  /**
   * Get cached step if available and valid
   */
  async getCachedStep(
    projectId: number,
    stepType: StepType,
    promptHash: string,
    version?: number
  ): Promise<AgentStepCache | null> {
    try {
      const conditions = [
        eq(agentStepCache.projectId, projectId),
        eq(agentStepCache.stepType, stepType),
        eq(agentStepCache.promptHash, promptHash),
        eq(agentStepCache.isValid, true)
      ];

      // Add version filter if specific version requested
      if (version !== undefined) {
        conditions.push(eq(agentStepCache.version, version));
      }

      let query = db.select()
        .from(agentStepCache)
        .where(and(...conditions))
        .orderBy(desc(agentStepCache.version))
        .limit(1);

      const [cached] = await query;
      
      // Check TTL expiration (24 hours)
      if (cached && cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        // Expired - mark as invalid and return null
        await db.update(agentStepCache)
          .set({ isValid: false })
          .where(eq(agentStepCache.id, cached.id));
        this.metrics.misses++;
        logger.debug(`[Cache Expired] ${stepType} for project ${projectId}`, { projectId, stepType });
        return null;
      }

      if (cached) {
        // Update hit count and last accessed time
        await db.update(agentStepCache)
          .set({
            hitCount: (cached.hitCount || 0) + 1,
            lastAccessedAt: new Date()
          })
          .where(eq(agentStepCache.id, cached.id));

        this.metrics.hits++;
        this.metrics.tokensSaved += cached.tokensUsed || 0;
        this.metrics.costSaved += parseFloat(cached.cost || '0');

        logger.info(`[Cache Hit] ${stepType} for project ${projectId} (version ${cached.version})`, {
          projectId,
          stepType,
          version: cached.version,
          hitCount: cached.hitCount
        });

        return cached;
      }

      this.metrics.misses++;
      logger.debug(`[Cache Miss] ${stepType} for project ${projectId}`, { projectId, stepType });
      return null;
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to get cached step:`, error);
      return null;
    }
  }

  /**
   * Store a new step in the cache
   */
  async cacheStep(
    projectId: number,
    stepType: StepType,
    prompt: string,
    content: StepCacheContent,
    options: {
      userId?: number;
      provider?: string;
      model?: string;
      tokensUsed?: number;
      cost?: number;
      generationTimeMs?: number;
      buildMode?: 'design-first' | 'full-app' | 'continue-planning';
      contextFiles?: string[];
    } = {}
  ): Promise<AgentStepCache> {
    try {
      const promptHash = this.generateHash(prompt);
      const contentHash = this.generateHash(JSON.stringify(content));

      // Get latest version for this project+step
      const [latestVersion] = await db.select({ version: agentStepCache.version })
        .from(agentStepCache)
        .where(and(
          eq(agentStepCache.projectId, projectId),
          eq(agentStepCache.stepType, stepType)
        ))
        .orderBy(desc(agentStepCache.version))
        .limit(1);

      const newVersion = (latestVersion?.version || 0) + 1;

      const cacheData: InsertAgentStepCache = {
        projectId,
        userId: options.userId,
        stepType,
        version: newVersion,
        promptHash,
        contentHash,
        content,
        provider: options.provider,
        model: options.model,
        tokensUsed: options.tokensUsed || 0,
        cost: options.cost?.toString() || '0',
        generationTimeMs: options.generationTimeMs,
        isValid: true,
        metadata: {
          buildMode: options.buildMode,
          parentVersion: newVersion > 1 ? newVersion - 1 : undefined,
          contextFiles: options.contextFiles
        }
      };

      const [inserted] = await db.insert(agentStepCache)
        .values(cacheData)
        .returning();

      logger.info(`[Cache Store] ${stepType} v${newVersion} for project ${projectId}`, {
        projectId,
        stepType,
        version: newVersion,
        tokensUsed: options.tokensUsed,
        provider: options.provider
      });

      return inserted;
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to store step:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cached steps for a project
   * Used when project changes require regeneration
   */
  async invalidateSteps(
    projectId: number,
    stepTypes?: StepType[],
    reason?: string
  ): Promise<number> {
    try {
      const conditions = [eq(agentStepCache.projectId, projectId)];
      
      if (stepTypes && stepTypes.length > 0) {
        // Invalidate only specified steps - preserve existing metadata
        let updateCount = 0;
        for (const stepType of stepTypes) {
          // First get existing entries to preserve their metadata
          const existing = await db.select()
            .from(agentStepCache)
            .where(and(
              eq(agentStepCache.projectId, projectId),
              eq(agentStepCache.stepType, stepType),
              eq(agentStepCache.isValid, true)
            ));
          
          for (const entry of existing) {
            // Merge new invalidation reason with existing metadata
            const mergedMetadata = {
              ...(entry.metadata as Record<string, any> || {}),
              changeReason: reason,
              invalidatedAt: new Date().toISOString()
            };
            
            await db.update(agentStepCache)
              .set({ 
                isValid: false,
                metadata: mergedMetadata
              })
              .where(eq(agentStepCache.id, entry.id));
            updateCount++;
          }
        }
        
        logger.info(`[Cache Invalidate] ${updateCount} entries for project ${projectId}`, {
          projectId,
          stepTypes,
          reason
        });
        
        return updateCount;
      } else {
        // Invalidate all steps for project - preserve existing metadata
        const existing = await db.select()
          .from(agentStepCache)
          .where(and(
            eq(agentStepCache.projectId, projectId),
            eq(agentStepCache.isValid, true)
          ));
        
        for (const entry of existing) {
          // Merge new invalidation reason with existing metadata
          const mergedMetadata = {
            ...(entry.metadata as Record<string, any> || {}),
            changeReason: reason,
            invalidatedAt: new Date().toISOString()
          };
          
          await db.update(agentStepCache)
            .set({ 
              isValid: false,
              metadata: mergedMetadata
            })
            .where(eq(agentStepCache.id, entry.id));
        }
        
        logger.info(`[Cache Invalidate] All ${existing.length} entries for project ${projectId}`, {
          projectId,
          reason
        });
        
        return existing.length;
      }
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to invalidate steps:`, error);
      throw error;
    }
  }

  /**
   * Get all cached steps for a project with their versions
   */
  async getProjectSteps(projectId: number): Promise<AgentStepCache[]> {
    try {
      const steps = await db.select()
        .from(agentStepCache)
        .where(and(
          eq(agentStepCache.projectId, projectId),
          eq(agentStepCache.isValid, true)
        ))
        .orderBy(desc(agentStepCache.createdAt));

      return steps;
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to get project steps:`, error);
      return [];
    }
  }

  /**
   * Get the latest version of each step type for a project
   * Useful for partial regeneration
   */
  async getLatestSteps(projectId: number): Promise<Map<StepType, AgentStepCache>> {
    try {
      const steps = await this.getProjectSteps(projectId);
      const latestByType = new Map<StepType, AgentStepCache>();

      for (const step of steps) {
        const existingStep = latestByType.get(step.stepType as StepType);
        if (!existingStep || step.version > existingStep.version) {
          latestByType.set(step.stepType as StepType, step);
        }
      }

      return latestByType;
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to get latest steps:`, error);
      return new Map();
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      totalEntries: total,
      hitCount: this.metrics.hits,
      missCount: this.metrics.misses,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
      costSaved: this.metrics.costSaved,
      tokensSaved: this.metrics.tokensSaved
    };
  }

  /**
   * Reset metrics (for testing/monitoring)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      costSaved: 0,
      tokensSaved: 0
    };
  }

  /**
   * Try to get cached step, or execute generator if cache miss
   * Main entry point for agent integration
   */
  async getOrGenerate<T extends StepCacheContent>(
    projectId: number,
    stepType: StepType,
    prompt: string,
    generator: () => Promise<{
      content: T;
      tokensUsed: number;
      cost: number;
      provider: string;
      model: string;
      generationTimeMs: number;
    }>,
    options: {
      userId?: number;
      forceRegenerate?: boolean;
      buildMode?: 'design-first' | 'full-app' | 'continue-planning';
      contextFiles?: string[];
    } = {}
  ): Promise<{ content: T; fromCache: boolean; version: number }> {
    const promptHash = this.generateHash(prompt);

    // Check cache first (unless force regenerate)
    if (!options.forceRegenerate) {
      const cached = await this.getCachedStep(projectId, stepType, promptHash);
      if (cached) {
        return {
          content: cached.content as T,
          fromCache: true,
          version: cached.version
        };
      }
    }

    // Generate new content
    const startTime = Date.now();
    const result = await generator();
    const generationTime = Date.now() - startTime;

    // Cache the result
    const cached = await this.cacheStep(projectId, stepType, prompt, result.content, {
      userId: options.userId,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      generationTimeMs: result.generationTimeMs || generationTime,
      buildMode: options.buildMode,
      contextFiles: options.contextFiles
    });

    return {
      content: result.content as T,
      fromCache: false,
      version: cached.version
    };
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await db.update(agentStepCache)
        .set({ isValid: false })
        .where(and(
          eq(agentStepCache.isValid, true),
          // Entries with expiresAt in the past
        ))
        .returning();

      if (result.length > 0) {
        logger.info(`[Cache Cleanup] Expired ${result.length} entries`);
      }

      return result.length;
    } catch (error: any) {
      logger.error(`[Cache Error] Failed to cleanup expired entries:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const agentStepCacheService = new AgentStepCacheService();
