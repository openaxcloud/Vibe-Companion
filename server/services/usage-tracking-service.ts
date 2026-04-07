import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('usage-tracking');

export interface UsageMetrics {
  timestamp: Date;
  userId: number;
  resource: string;
  amount: number;
  cost: number;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  resource: string;
  period: 'hour' | 'day' | 'week' | 'month';
  data: Array<{
    timestamp: Date;
    amount: number;
    cost: number;
  }>;
  total: {
    amount: number;
    cost: number;
  };
}

export interface ResourceLimits {
  compute: { limit: number; used: number; unit: 'cpu-hours' };
  storage: { limit: number; used: number; unit: 'GB' };
  bandwidth: { limit: number; used: number; unit: 'GB' };
  ai: { limit: number; used: number; unit: 'tokens' };
  database: { limit: number; used: number; unit: 'GB' };
}

export class UsageTrackingService {
  private usageData: Map<string, UsageMetrics[]> = new Map();
  
  constructor() {
    // Initialize with some sample historical data
    this.initializeSampleData();
  }

  async trackUsage(metric: Omit<UsageMetrics, 'timestamp'>): Promise<void> {
    try {
      const fullMetric: UsageMetrics = {
        ...metric,
        timestamp: new Date()
      };

      const key = `${metric.userId}-${metric.resource}`;
      if (!this.usageData.has(key)) {
        this.usageData.set(key, []);
      }
      
      this.usageData.get(key)!.push(fullMetric);
      
      logger.info(`Tracked usage: ${metric.resource} - ${metric.amount} units for user ${metric.userId}`);
      
      // In production, this would save to database
      // await db.insert(usageMetrics).values(fullMetric);
    } catch (error) {
      logger.error('Error tracking usage:', error);
      throw error;
    }
  }

  async getUsageStats(userId: number, resource: string, period: 'hour' | 'day' | 'week' | 'month'): Promise<UsageStats> {
    try {
      const key = `${userId}-${resource}`;
      const metrics = this.usageData.get(key) || [];
      
      const now = new Date();
      const periodMs = this.getPeriodMilliseconds(period);
      const startTime = new Date(now.getTime() - periodMs);
      
      // Filter metrics within the period
      const filteredMetrics = metrics.filter(m => m.timestamp >= startTime);
      
      // Group by time intervals
      const intervalMs = this.getIntervalMilliseconds(period);
      const groupedData = new Map<number, { amount: number; cost: number }>();
      
      filteredMetrics.forEach(metric => {
        const intervalKey = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
        const existing = groupedData.get(intervalKey) || { amount: 0, cost: 0 };
        groupedData.set(intervalKey, {
          amount: existing.amount + metric.amount,
          cost: existing.cost + metric.cost
        });
      });
      
      // Convert to array format
      const data = Array.from(groupedData.entries()).map(([timestamp, values]) => ({
        timestamp: new Date(timestamp),
        amount: values.amount,
        cost: values.cost
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Calculate totals
      const total = data.reduce((acc, item) => ({
        amount: acc.amount + item.amount,
        cost: acc.cost + item.cost
      }), { amount: 0, cost: 0 });
      
      return {
        resource,
        period,
        data,
        total
      };
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      throw error;
    }
  }

  async getResourceLimits(userId: number): Promise<ResourceLimits> {
    try {
      // Calculate current usage
      const computeUsage = await this.calculateResourceUsage(userId, 'compute');
      const storageUsage = await this.calculateResourceUsage(userId, 'storage');
      const bandwidthUsage = await this.calculateResourceUsage(userId, 'bandwidth');
      const aiUsage = await this.calculateResourceUsage(userId, 'ai');
      const databaseUsage = await this.calculateResourceUsage(userId, 'database');
      
      // In production, limits would come from user's subscription plan
      return {
        compute: { limit: 1000, used: computeUsage, unit: 'cpu-hours' },
        storage: { limit: 50, used: storageUsage, unit: 'GB' },
        bandwidth: { limit: 100, used: bandwidthUsage, unit: 'GB' },
        ai: { limit: 1000000, used: aiUsage, unit: 'tokens' },
        database: { limit: 10, used: databaseUsage, unit: 'GB' }
      };
    } catch (error) {
      logger.error('Error getting resource limits:', error);
      throw error;
    }
  }

  async createUsageAlert(userId: number, alert: {
    resource: string;
    threshold: number;
    type: 'percentage' | 'absolute';
    action: 'email' | 'notification' | 'both';
  }): Promise<{ id: string; created: boolean }> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In production, this would save to database
      logger.info(`Created usage alert ${alertId} for user ${userId}`);
      
      return { id: alertId, created: true };
    } catch (error) {
      logger.error('Error creating usage alert:', error);
      throw error;
    }
  }

  private async calculateResourceUsage(userId: number, resource: string): Promise<number> {
    const stats = await this.getUsageStats(userId, resource, 'month');
    return stats.total.amount;
  }

  private getPeriodMilliseconds(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private getIntervalMilliseconds(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 5 * 60 * 1000; // 5 minutes
      case 'day': return 60 * 60 * 1000; // 1 hour
      case 'week': return 24 * 60 * 60 * 1000; // 1 day
      case 'month': return 24 * 60 * 60 * 1000; // 1 day
    }
  }

  private initializeSampleData() {
    // Generate sample usage data for demonstration
    const now = new Date();
    const resources = ['compute', 'storage', 'bandwidth', 'ai', 'database'];
    const userId = 1;
    
    resources.forEach(resource => {
      const key = `${userId}-${resource}`;
      const data: UsageMetrics[] = [];
      
      // Generate data for the last 30 days
      for (let i = 0; i < 30 * 24; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        const baseAmount = Math.random() * 10;
        const amount = resource === 'ai' ? baseAmount * 1000 : baseAmount;
        const costPerUnit = this.getCostPerUnit(resource);
        
        data.push({
          timestamp,
          userId,
          resource,
          amount,
          cost: amount * costPerUnit,
          metadata: { generated: true }
        });
      }
      
      this.usageData.set(key, data);
    });
  }

  private getCostPerUnit(resource: string): number {
    const costs: Record<string, number> = {
      compute: 0.02,    // $0.02 per CPU hour
      storage: 0.10,    // $0.10 per GB
      bandwidth: 0.05,  // $0.05 per GB
      ai: 0.000002,     // $0.000002 per token
      database: 0.15    // $0.15 per GB
    };
    return costs[resource] || 0.01;
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();