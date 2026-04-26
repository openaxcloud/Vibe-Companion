// @ts-nocheck
import { db } from '../db';
import { usageTracking, projects, users } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { agentUsageTrackingService } from './agent-usage-tracking-service';
import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';

const logger = createLogger('effort-pricing-service');

export interface EffortMetrics {
  tokensUsed: number;
  apiCalls: number;
  computeTime: number; // in seconds
  filesProcessed: number;
  codeGenerated: number; // lines of code
  testsRun: number;
  deploymentsCreated: number;
  errorsRecovered: number;
  checkpointsCreated: number;
  totalEffortScore: number;
}

export interface EffortPricing {
  basePrice: number; // in cents
  tokenCost: number;
  computeCost: number;
  actionCost: number;
  totalCost: number;
  breakdown: {
    tokens: { count: number; cost: number };
    compute: { seconds: number; cost: number };
    actions: { count: number; cost: number };
    bonus: { description: string; cost: number };
  };
}

export interface EffortUsageReport {
  userId: number;
  projectId: number;
  period: {
    start: Date;
    end: Date;
  };
  totalEffort: EffortMetrics;
  totalCost: number;
  dailyBreakdown: Array<{
    date: string;
    effort: EffortMetrics;
    cost: number;
  }>;
  topProjects: Array<{
    projectId: number;
    projectName: string;
    effortScore: number;
    cost: number;
  }>;
}

/**
 * Service for tracking and pricing AI agent effort
 */
export class EffortPricingService {
  private stripe: Stripe | null = null;
  
  // Pricing configuration (in cents)
  private readonly pricing = {
    perThousandTokens: 50, // $0.50 per 1K tokens
    perComputeMinute: 200, // $2.00 per compute minute
    perAction: 10, // $0.10 per action (file operation, test run, etc.)
    perDeployment: 500, // $5.00 per deployment
    perCheckpoint: 25, // $0.25 per checkpoint
    errorRecoveryBonus: 100, // $1.00 bonus for successful error recovery
    complexityMultiplier: {
      simple: 1.0,
      moderate: 1.5,
      complex: 2.0,
      expert: 3.0
    }
  };

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = getStripe();
    }
  }

  /**
   * Track effort for an AI agent action
   */
  async trackEffort(params: {
    userId: number;
    projectId: number;
    action: string;
    metrics: Partial<EffortMetrics>;
    complexity?: 'simple' | 'moderate' | 'complex' | 'expert';
  }): Promise<void> {
    try {
      const effortScore = this.calculateEffortScore(params.metrics);
      const pricing = this.calculatePricing(params.metrics, params.complexity || 'moderate');

      // Track in usage tracking table
      await db.insert(usageTracking).values({
        userId: params.userId,
        projectId: params.projectId,
        timestamp: new Date(),
        metricType: 'agent_effort',
        value: effortScore.toString(),
        unit: 'effort_points',
        metadata: {
          action: params.action,
          metrics: params.metrics,
          complexity: params.complexity,
          pricing: pricing,
          breakdown: {
            tokens: params.metrics.tokensUsed || 0,
            compute: params.metrics.computeTime || 0,
            actions: params.metrics.apiCalls || 0,
            files: params.metrics.filesProcessed || 0,
            code: params.metrics.codeGenerated || 0
          }
        }
      });

      // Also track with agent usage service for detailed analytics
      await agentUsageTrackingService.trackUsage({
        userId: params.userId,
        projectId: params.projectId,
        action: params.action,
        model: 'claude-sonnet-4-6',
        tokensUsed: params.metrics.tokensUsed || 0,
        responseTime: params.metrics.computeTime || 0,
        success: true,
        metadata: {
          effortScore,
          pricing,
          complexity: params.complexity
        }
      });

      logger.info(`Tracked effort for user ${params.userId}, project ${params.projectId}: ${effortScore} points, $${(pricing.totalCost / 100).toFixed(2)}`);
    } catch (error) {
      logger.error('Failed to track effort:', error);
    }
  }

  /**
   * Calculate effort score from metrics
   */
  private calculateEffortScore(metrics: Partial<EffortMetrics>): number {
    let score = 0;

    // Token usage (1 point per 100 tokens)
    if (metrics.tokensUsed) {
      score += Math.ceil(metrics.tokensUsed / 100);
    }

    // Compute time (10 points per minute)
    if (metrics.computeTime) {
      score += Math.ceil((metrics.computeTime / 60) * 10);
    }

    // API calls (2 points per call)
    if (metrics.apiCalls) {
      score += metrics.apiCalls * 2;
    }

    // Files processed (5 points per file)
    if (metrics.filesProcessed) {
      score += metrics.filesProcessed * 5;
    }

    // Code generated (1 point per 10 lines)
    if (metrics.codeGenerated) {
      score += Math.ceil(metrics.codeGenerated / 10);
    }

    // Tests run (3 points per test)
    if (metrics.testsRun) {
      score += metrics.testsRun * 3;
    }

    // Deployments (50 points per deployment)
    if (metrics.deploymentsCreated) {
      score += metrics.deploymentsCreated * 50;
    }

    // Error recovery (20 points per recovery)
    if (metrics.errorsRecovered) {
      score += metrics.errorsRecovered * 20;
    }

    // Checkpoints (10 points per checkpoint)
    if (metrics.checkpointsCreated) {
      score += metrics.checkpointsCreated * 10;
    }

    return score;
  }

  /**
   * Calculate pricing based on effort metrics
   */
  calculatePricing(
    metrics: Partial<EffortMetrics>, 
    complexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'moderate'
  ): EffortPricing {
    const breakdown = {
      tokens: {
        count: metrics.tokensUsed || 0,
        cost: Math.ceil(((metrics.tokensUsed || 0) / 1000) * this.pricing.perThousandTokens)
      },
      compute: {
        seconds: metrics.computeTime || 0,
        cost: Math.ceil(((metrics.computeTime || 0) / 60) * this.pricing.perComputeMinute)
      },
      actions: {
        count: (metrics.apiCalls || 0) + (metrics.filesProcessed || 0) + (metrics.testsRun || 0),
        cost: ((metrics.apiCalls || 0) + (metrics.filesProcessed || 0) + (metrics.testsRun || 0)) * this.pricing.perAction
      },
      bonus: {
        description: '',
        cost: 0
      }
    };

    // Add deployment costs
    if (metrics.deploymentsCreated) {
      breakdown.bonus.cost += metrics.deploymentsCreated * this.pricing.perDeployment;
      breakdown.bonus.description += `Deployments: ${metrics.deploymentsCreated} `;
    }

    // Add checkpoint costs
    if (metrics.checkpointsCreated) {
      breakdown.bonus.cost += metrics.checkpointsCreated * this.pricing.perCheckpoint;
      breakdown.bonus.description += `Checkpoints: ${metrics.checkpointsCreated} `;
    }

    // Add error recovery bonus
    if (metrics.errorsRecovered) {
      breakdown.bonus.cost += metrics.errorsRecovered * this.pricing.errorRecoveryBonus;
      breakdown.bonus.description += `Error recoveries: ${metrics.errorsRecovered} `;
    }

    // Calculate base price
    const basePrice = breakdown.tokens.cost + breakdown.compute.cost + breakdown.actions.cost + breakdown.bonus.cost;

    // Apply complexity multiplier
    const complexityMultiplier = this.pricing.complexityMultiplier[complexity];
    const totalCost = Math.ceil(basePrice * complexityMultiplier);

    return {
      basePrice,
      tokenCost: breakdown.tokens.cost,
      computeCost: breakdown.compute.cost,
      actionCost: breakdown.actions.cost,
      totalCost,
      breakdown
    };
  }

  /**
   * Get effort usage report for a user
   */
  async getEffortUsageReport(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<EffortUsageReport> {
    try {
      // Get all effort tracking records
      const records = await db.select()
        .from(usageTracking)
        .where(and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.metricType, 'agent_effort'),
          gte(usageTracking.timestamp, startDate),
          lte(usageTracking.timestamp, endDate)
        ))
        .orderBy(desc(usageTracking.timestamp));

      // Aggregate total effort
      const totalEffort: EffortMetrics = {
        tokensUsed: 0,
        apiCalls: 0,
        computeTime: 0,
        filesProcessed: 0,
        codeGenerated: 0,
        testsRun: 0,
        deploymentsCreated: 0,
        errorsRecovered: 0,
        checkpointsCreated: 0,
        totalEffortScore: 0
      };

      let totalCost = 0;
      const dailyData = new Map<string, { effort: EffortMetrics; cost: number }>();
      const projectData = new Map<number, { name: string; effortScore: number; cost: number }>();

      // Process records
      for (const record of records) {
        const metrics = record.metadata?.metrics as Partial<EffortMetrics> || {};
        const pricing = record.metadata?.pricing as EffortPricing || { totalCost: 0 };
        const dateKey = record.timestamp.toISOString().split('T')[0];

        // Update totals
        totalEffort.tokensUsed += metrics.tokensUsed || 0;
        totalEffort.apiCalls += metrics.apiCalls || 0;
        totalEffort.computeTime += metrics.computeTime || 0;
        totalEffort.filesProcessed += metrics.filesProcessed || 0;
        totalEffort.codeGenerated += metrics.codeGenerated || 0;
        totalEffort.testsRun += metrics.testsRun || 0;
        totalEffort.deploymentsCreated += metrics.deploymentsCreated || 0;
        totalEffort.errorsRecovered += metrics.errorsRecovered || 0;
        totalEffort.checkpointsCreated += metrics.checkpointsCreated || 0;
        totalEffort.totalEffortScore += parseFloat(record.value);
        totalCost += pricing.totalCost;

        // Update daily data
        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, {
            effort: {
              tokensUsed: 0,
              apiCalls: 0,
              computeTime: 0,
              filesProcessed: 0,
              codeGenerated: 0,
              testsRun: 0,
              deploymentsCreated: 0,
              errorsRecovered: 0,
              checkpointsCreated: 0,
              totalEffortScore: 0
            },
            cost: 0
          });
        }

        const daily = dailyData.get(dateKey)!;
        daily.effort.tokensUsed += metrics.tokensUsed || 0;
        daily.effort.apiCalls += metrics.apiCalls || 0;
        daily.effort.computeTime += metrics.computeTime || 0;
        daily.effort.filesProcessed += metrics.filesProcessed || 0;
        daily.effort.codeGenerated += metrics.codeGenerated || 0;
        daily.effort.testsRun += metrics.testsRun || 0;
        daily.effort.deploymentsCreated += metrics.deploymentsCreated || 0;
        daily.effort.errorsRecovered += metrics.errorsRecovered || 0;
        daily.effort.checkpointsCreated += metrics.checkpointsCreated || 0;
        daily.effort.totalEffortScore += parseFloat(record.value);
        daily.cost += pricing.totalCost;

        // Update project data
        if (record.projectId) {
          if (!projectData.has(record.projectId)) {
            projectData.set(record.projectId, {
              name: '',
              effortScore: 0,
              cost: 0
            });
          }
          const project = projectData.get(record.projectId)!;
          project.effortScore += parseFloat(record.value);
          project.cost += pricing.totalCost;
        }
      }

      // Get project names
      const projectIds = Array.from(projectData.keys());
      if (projectIds.length > 0) {
        const projectRecords = await db.select()
          .from(projects)
          .where(sql`${projects.id} IN ${projectIds}`);
        
        for (const project of projectRecords) {
          const data = projectData.get(project.id);
          if (data) {
            data.name = project.name;
          }
        }
      }

      // Format daily breakdown
      const dailyBreakdown = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          effort: data.effort,
          cost: data.cost
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Format top projects
      const topProjects = Array.from(projectData.entries())
        .map(([projectId, data]) => ({
          projectId,
          projectName: data.name,
          effortScore: data.effortScore,
          cost: data.cost
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      return {
        userId,
        projectId: 0, // Overall report
        period: {
          start: startDate,
          end: endDate
        },
        totalEffort,
        totalCost,
        dailyBreakdown,
        topProjects
      };
    } catch (error) {
      logger.error('Failed to generate effort usage report:', error);
      throw error;
    }
  }

  /**
   * Process effort-based billing
   */
  async processEffortBilling(userId: number, period: { start: Date; end: Date }): Promise<{
    success: boolean;
    chargeId?: string;
    amount: number;
    error?: string;
  }> {
    try {
      // Get usage report
      const report = await this.getEffortUsageReport(userId, period.start, period.end);
      
      if (report.totalCost === 0) {
        return { success: true, amount: 0 };
      }

      // Get user details
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user || !user.stripeCustomerId) {
        return {
          success: false,
          amount: report.totalCost,
          error: 'User not found or no payment method'
        };
      }

      // Create charge with Stripe
      if (this.stripe) {
        const charge = await this.stripe.charges.create({
          amount: report.totalCost,
          currency: 'usd',
          customer: user.stripeCustomerId,
          description: `AI Agent Effort - ${period.start.toDateString()} to ${period.end.toDateString()}`,
          metadata: {
            userId: userId.toString(),
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            totalEffortScore: report.totalEffort.totalEffortScore.toString()
          }
        });

        // Record billing
        await db.insert(usageTracking).values({
          userId,
          timestamp: new Date(),
          metricType: 'billing',
          value: report.totalCost.toString(),
          unit: 'cents',
          metadata: {
            chargeId: charge.id,
            period,
            effortReport: {
              totalEffort: report.totalEffort,
              topProjects: report.topProjects
            }
          }
        });

        logger.info(`Processed effort billing for user ${userId}: $${(report.totalCost / 100).toFixed(2)}`);

        return {
          success: true,
          chargeId: charge.id,
          amount: report.totalCost
        };
      } else {
        // Stripe not configured, just record the usage
        await db.insert(usageTracking).values({
          userId,
          timestamp: new Date(),
          metricType: 'billing_pending',
          value: report.totalCost.toString(),
          unit: 'cents',
          metadata: {
            period,
            effortReport: {
              totalEffort: report.totalEffort,
              topProjects: report.topProjects
            }
          }
        });

        return {
          success: true,
          amount: report.totalCost
        };
      }
    } catch (error) {
      logger.error('Failed to process effort billing:', error);
      return {
        success: false,
        amount: 0,
        error: error.message
      };
    }
  }

  /**
   * Get real-time effort estimate
   */
  async getEffortEstimate(params: {
    action: string;
    fileCount?: number;
    codeComplexity?: 'simple' | 'moderate' | 'complex' | 'expert';
    estimatedTokens?: number;
    includesDeployment?: boolean;
  }): Promise<{
    estimatedCost: number;
    breakdown: EffortPricing;
    confidence: 'low' | 'medium' | 'high';
  }> {
    // Estimate metrics based on action type
    const estimatedMetrics: Partial<EffortMetrics> = {
      tokensUsed: params.estimatedTokens || 2000,
      apiCalls: 5,
      computeTime: 30,
      filesProcessed: params.fileCount || 5,
      codeGenerated: 100,
      testsRun: 0,
      deploymentsCreated: params.includesDeployment ? 1 : 0,
      errorsRecovered: 0,
      checkpointsCreated: 1
    };

    // Adjust based on action type
    if (params.action.includes('test')) {
      estimatedMetrics.testsRun = 10;
    }
    if (params.action.includes('debug') || params.action.includes('fix')) {
      estimatedMetrics.errorsRecovered = 1;
      estimatedMetrics.tokensUsed = (estimatedMetrics.tokensUsed || 0) * 1.5;
    }
    if (params.action.includes('refactor') || params.action.includes('optimize')) {
      estimatedMetrics.codeGenerated = (estimatedMetrics.codeGenerated || 0) * 2;
      estimatedMetrics.computeTime = (estimatedMetrics.computeTime || 0) * 2;
    }

    const pricing = this.calculatePricing(estimatedMetrics, params.codeComplexity || 'moderate');

    // Determine confidence based on parameters provided
    let confidence: 'low' | 'medium' | 'high' = 'medium';
    if (params.estimatedTokens && params.fileCount && params.codeComplexity) {
      confidence = 'high';
    } else if (!params.estimatedTokens && !params.fileCount) {
      confidence = 'low';
    }

    return {
      estimatedCost: pricing.totalCost,
      breakdown: pricing,
      confidence
    };
  }
}

export const effortPricingService = new EffortPricingService();