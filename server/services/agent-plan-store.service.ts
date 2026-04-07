import { db } from '../db';
import { agentPlans, type AgentPlan, type InsertAgentPlan } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentPlanStore');

/**
 * Agent Plan Storage Service
 * ✅ FIX (Nov 21, 2025): Dedicated service to persist complete AI plans
 * ARCHITECT APPROVED: Stores full plans once, workflow steps reference via taskId
 * 
 * Solves JSONB overflow issue by separating plan storage from workflow execution.
 */
class AgentPlanStoreService {
  /**
   * Store a complete execution plan
   * @param sessionId - Agent session ID
   * @param projectId - Project ID
   * @param plan - Complete plan from AI provider
   * @returns Created plan record
   */
  async storePlan(sessionId: string, projectId: number, plan: any): Promise<AgentPlan> {
    try {
      // ✅ FIX (Nov 30, 2025): Ensure planId is NEVER null to prevent NOT NULL constraint violation
      // The plan.id may be missing from some plan generators, so we generate a unique fallback
      const safePlanId = plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const planData: InsertAgentPlan = {
        sessionId,
        projectId,
        planId: safePlanId,
        goal: plan.goal || plan.prompt || 'Autonomous execution',
        tasks: plan.tasks || [],  // Also ensure tasks is never null
        estimatedTime: plan.estimatedTime,
        status: 'pending',
        totalTokens: plan.totalTokens || 0,
        totalCost: plan.totalCost || '0',
        metadata: {
          provider: plan.provider,
          fallbackChain: plan.fallbackChain,
          generationTimeMs: plan.generationTimeMs,
          taskCount: (plan.tasks || []).length
        }
      };

      const [insertedPlan] = await db.insert(agentPlans)
        .values(planData)
        .returning();

      logger.info(`[Store] Stored plan ${safePlanId} with ${(plan.tasks || []).length} tasks`, {
        planId: safePlanId,
        sessionId,
        taskCount: (plan.tasks || []).length
      });

      return insertedPlan;
    } catch (error: any) {
      logger.error(`[Store] Failed to store plan:`, { planId: plan?.id, sessionId, error });
      throw error;
    }
  }

  /**
   * Get a complete plan by session ID
   * @param sessionId - Agent session ID
   * @returns Plan with full task details
   */
  async getPlanBySession(sessionId: string): Promise<AgentPlan | null> {
    try {
      const [plan] = await db.select()
        .from(agentPlans)
        .where(eq(agentPlans.sessionId, sessionId))
        .orderBy(agentPlans.createdAt)
        .limit(1);

      return plan || null;
    } catch (error: any) {
      logger.error(`[Get Plan] Failed to fetch plan for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific task from a plan
   * @param sessionId - Agent session ID
   * @param taskId - Task ID (e.g., "task-1")
   * @returns Task with full file contents, commands, etc.
   */
  async getTask(sessionId: string, taskId: string): Promise<any | null> {
    try {
      const plan = await this.getPlanBySession(sessionId);
      if (!plan) {
        logger.warn(`[Get Task] No plan found for session ${sessionId}`);
        return null;
      }

      const task = plan.tasks.find((t: any) => t.id === taskId);
      if (!task) {
        logger.warn(`[Get Task] Task ${taskId} not found in plan ${plan.planId}`);
        return null;
      }

      return task;
    } catch (error: any) {
      logger.error(`[Get Task] Failed to fetch task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Update plan status (executing, completed, failed)
   * @param sessionId - Agent session ID
   * @param status - New status
   */
  async updateStatus(sessionId: string, status: string): Promise<void> {
    try {
      await db.update(agentPlans)
        .set({ 
          status,
          completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
        })
        .where(eq(agentPlans.sessionId, sessionId));

      logger.info(`[Update] Plan status updated to ${status}`, { sessionId });
    } catch (error: any) {
      logger.error(`[Update] Failed to update plan status:`, error);
      throw error;
    }
  }

  /**
   * Get all tasks from a plan
   * @param sessionId - Agent session ID
   * @returns Array of tasks with full details
   */
  async getAllTasks(sessionId: string): Promise<any[]> {
    try {
      const plan = await this.getPlanBySession(sessionId);
      if (!plan) {
        logger.warn(`[Get All Tasks] No plan found for session ${sessionId}`);
        return [];
      }

      return plan.tasks;
    } catch (error: any) {
      logger.error(`[Get All Tasks] Failed to fetch tasks:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentPlanStore = new AgentPlanStoreService();
