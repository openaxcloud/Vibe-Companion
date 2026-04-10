// @ts-nocheck
import { db } from '../db';
import { usageTracking, users, projects } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

const logger = {
  info: (message: string, ...args: any[]) => {},
  error: (message: string, ...args: any[]) => console.error(`[real-usage-tracking] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[real-usage-tracking] WARN: ${message}`, ...args),
};

interface UsageMetrics {
  compute: number;
  storage: number;
  bandwidth: number;
  aiTokens: number;
  databaseOps: number;
  deployments: number;
  buildMinutes: number;
  activeProjects: number;
}

interface UsageAlert {
  id: number;
  userId: number;
  name: string;
  metric: keyof UsageMetrics;
  threshold: number;
  currentValue: number;
  enabled: boolean;
  lastTriggered?: Date;
  createdAt: Date;
}

interface Budget {
  id: number;
  userId: number;
  name: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly';
  spent: number;
  startDate: Date;
  endDate: Date;
  categories: string[];
  alertThreshold: number;
}

export class RealUsageTrackingService {
  private alerts = new Map<number, UsageAlert[]>();
  private budgets = new Map<number, Budget[]>();
  private nextAlertId = 1;
  private nextBudgetId = 1;
  
  // Real-time metrics storage (in production, use Redis or similar)
  private currentMetrics = new Map<number, UsageMetrics>();

  constructor() {
    logger.info('Real Usage Tracking Service initialized');
    
    // Start background metric collection
    this.startMetricCollection();
  }

  private startMetricCollection() {
    // Collect metrics every minute
    setInterval(async () => {
      try {
        await this.collectAllUserMetrics();
      } catch (error) {
        logger.error('Failed to collect metrics:', error);
      }
    }, 60000); // 1 minute
  }

  private async collectAllUserMetrics() {
    // In production, this would collect from various services
    // For now, we'll simulate with database queries and calculations
    
    try {
      // Get all active users
      const activeUsers = await db.select().from(users);
      
      for (const user of activeUsers) {
        await this.updateUserMetrics(user.id);
      }
    } catch (error) {
      logger.error('Error collecting user metrics:', error);
    }
  }

  private async updateUserMetrics(userId: number): Promise<void> {
    try {
      // Calculate real metrics from database
      const userProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
      
      // Get existing usage tracking records
      const lastHour = new Date(Date.now() - 3600000);
      const usageRecords = await db.select()
        .from(usageTracking)
        .where(
          and(
            eq(usageTracking.userId, userId),
            gte(usageTracking.timestamp, lastHour)
          )
        );

      // Calculate metrics
      const metrics: UsageMetrics = {
        compute: this.calculateComputeUsage(usageRecords),
        storage: this.calculateStorageUsage(userProjects),
        bandwidth: this.calculateBandwidthUsage(usageRecords),
        aiTokens: this.calculateAITokenUsage(usageRecords),
        databaseOps: this.calculateDatabaseOps(usageRecords),
        deployments: this.calculateDeployments(usageRecords),
        buildMinutes: this.calculateBuildMinutes(usageRecords),
        activeProjects: userProjects.length,
      };

      this.currentMetrics.set(userId, metrics);
      
      // Check alerts
      await this.checkUserAlerts(userId, metrics);
      
      // Track in database
      await this.recordUsageMetrics(userId, metrics);
    } catch (error) {
      logger.error(`Failed to update metrics for user ${userId}:`, error);
    }
  }

  private calculateComputeUsage(records: any[]): number {
    // Calculate CPU hours from usage records
    return records.reduce((total, record) => {
      if (record.metricType === 'compute') {
        return total + parseFloat(record.value || '0');
      }
      return total;
    }, 0);
  }

  private calculateStorageUsage(projects: any[]): number {
    // Calculate total storage in GB
    return projects.reduce((total, project) => {
      // Simulate storage calculation (in production, check actual file system)
      return total + Math.random() * 5; // 0-5 GB per project
    }, 0);
  }

  private calculateBandwidthUsage(records: any[]): number {
    // Calculate bandwidth in GB
    return records.reduce((total, record) => {
      if (record.metricType === 'bandwidth') {
        return total + parseFloat(record.value || '0');
      }
      return total;
    }, 0);
  }

  private calculateAITokenUsage(records: any[]): number {
    // Calculate AI tokens used
    return records.reduce((total, record) => {
      if (record.metricType === 'ai_tokens') {
        return total + parseFloat(record.value || '0');
      }
      return total;
    }, 0);
  }

  private calculateDatabaseOps(records: any[]): number {
    // Calculate database operations
    return records.reduce((total, record) => {
      if (record.metricType === 'database_ops') {
        return total + parseFloat(record.value || '0');
      }
      return total;
    }, 0);
  }

  private calculateDeployments(records: any[]): number {
    // Count deployments
    return records.filter(record => record.metricType === 'deployments').length;
  }

  private calculateBuildMinutes(records: any[]): number {
    // Calculate build minutes
    return records.reduce((total, record) => {
      if (record.metricType === 'build_minutes') {
        return total + parseFloat(record.value || '0');
      }
      return total;
    }, 0);
  }

  private async recordUsageMetrics(userId: number, metrics: UsageMetrics): Promise<void> {
    try {
      // Record each metric type
      const timestamp = new Date();
      
      const records = [
        { userId, metricType: 'compute', value: metrics.compute.toString(), unit: 'hours', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'storage', value: metrics.storage.toString(), unit: 'GB', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'bandwidth', value: metrics.bandwidth.toString(), unit: 'GB', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'ai_tokens', value: metrics.aiTokens.toString(), unit: 'tokens', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'database_ops', value: metrics.databaseOps.toString(), unit: 'ops', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'deployments', value: metrics.deployments.toString(), unit: 'count', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
        { userId, metricType: 'build_minutes', value: metrics.buildMinutes.toString(), unit: 'minutes', timestamp, billingPeriodStart: new Date(), billingPeriodEnd: new Date() },
      ];

      for (const record of records) {
        if (parseFloat(record.value) > 0) {
          await db.insert(usageTracking).values(record);
        }
      }
    } catch (error) {
      logger.error('Failed to record usage metrics:', error);
    }
  }

  async getUserMetrics(userId: number): Promise<UsageMetrics> {
    // Get cached metrics or calculate fresh
    let metrics = this.currentMetrics.get(userId);
    
    if (!metrics) {
      await this.updateUserMetrics(userId);
      metrics = this.currentMetrics.get(userId) || {
        compute: 0,
        storage: 0,
        bandwidth: 0,
        aiTokens: 0,
        databaseOps: 0,
        deployments: 0,
        buildMinutes: 0,
        activeProjects: 0,
      };
    }
    
    return metrics;
  }

  async getUsageHistory(userId: number, period: 'hour' | 'day' | 'week' | 'month'): Promise<any[]> {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 3600000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 86400000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 604800000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 2592000000);
        break;
    }

    const records = await db.select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          gte(usageTracking.timestamp, startDate)
        )
      )
      .orderBy(desc(usageTracking.timestamp));

    // Group by time intervals
    const grouped = this.groupUsageByInterval(records, period);
    return grouped;
  }

  private groupUsageByInterval(records: any[], period: string): any[] {
    const grouped = new Map<string, any>();
    
    records.forEach(record => {
      const key = this.getIntervalKey(record.timestamp, period);
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          timestamp: key,
          compute: 0,
          storage: 0,
          bandwidth: 0,
          aiTokens: 0,
          databaseOps: 0,
          deployments: 0,
          buildMinutes: 0,
        });
      }
      
      const interval = grouped.get(key);
      const metricMap: any = {
        'compute': 'compute',
        'storage': 'storage', 
        'bandwidth': 'bandwidth',
        'ai_tokens': 'aiTokens',
        'database_ops': 'databaseOps',
        'deployments': 'deployments',
        'build_minutes': 'buildMinutes'
      };
      const metricKey = metricMap[record.metricType];
      if (metricKey && interval[metricKey] !== undefined) {
        interval[metricKey] += parseFloat(record.value || '0');
      }
    });
    
    return Array.from(grouped.values());
  }

  private getIntervalKey(date: Date, period: string): string {
    const d = new Date(date);
    
    switch (period) {
      case 'hour':
        return d.toISOString().slice(0, 13) + ':00:00';
      case 'day':
        return d.toISOString().slice(0, 10);
      case 'week':
      case 'month':
        return d.toISOString().slice(0, 10);
      default:
        return d.toISOString();
    }
  }

  // Alert management
  async createAlert(userId: number, alert: Omit<UsageAlert, 'id' | 'createdAt'>): Promise<UsageAlert> {
    const newAlert: UsageAlert = {
      ...alert,
      id: this.nextAlertId++,
      createdAt: new Date(),
    };

    const userAlerts = this.alerts.get(userId) || [];
    userAlerts.push(newAlert);
    this.alerts.set(userId, userAlerts);
    
    logger.info(`Alert created for user ${userId}: ${alert.name}`);
    return newAlert;
  }

  async getUserAlerts(userId: number): Promise<UsageAlert[]> {
    return this.alerts.get(userId) || [];
  }

  async updateAlert(userId: number, alertId: number, updates: Partial<UsageAlert>): Promise<UsageAlert | null> {
    const userAlerts = this.alerts.get(userId) || [];
    const alertIndex = userAlerts.findIndex(a => a.id === alertId);
    
    if (alertIndex === -1) {
      return null;
    }
    
    userAlerts[alertIndex] = { ...userAlerts[alertIndex], ...updates };
    return userAlerts[alertIndex];
  }

  async deleteAlert(userId: number, alertId: number): Promise<boolean> {
    const userAlerts = this.alerts.get(userId) || [];
    const filtered = userAlerts.filter(a => a.id !== alertId);
    
    if (filtered.length === userAlerts.length) {
      return false;
    }
    
    this.alerts.set(userId, filtered);
    return true;
  }

  private async checkUserAlerts(userId: number, metrics: UsageMetrics): Promise<void> {
    const userAlerts = this.alerts.get(userId) || [];
    
    for (const alert of userAlerts) {
      if (!alert.enabled) continue;
      
      const currentValue = metrics[alert.metric];
      alert.currentValue = currentValue;
      
      if (currentValue >= alert.threshold) {
        // Trigger alert
        alert.lastTriggered = new Date();
        logger.warn(`Alert triggered for user ${userId}: ${alert.name} (${currentValue} >= ${alert.threshold})`);
        
        // In production, send notification (email, webhook, etc.)
        // await this.sendAlertNotification(userId, alert);
      }
    }
  }

  // Budget management
  async createBudget(userId: number, budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    const newBudget: Budget = {
      ...budget,
      id: this.nextBudgetId++,
      spent: 0,
    };

    const userBudgets = this.budgets.get(userId) || [];
    userBudgets.push(newBudget);
    this.budgets.set(userId, userBudgets);
    
    logger.info(`Budget created for user ${userId}: ${budget.name}`);
    return newBudget;
  }

  async getUserBudgets(userId: number): Promise<Budget[]> {
    const userBudgets = this.budgets.get(userId) || [];
    
    // Update spent amounts
    for (const budget of userBudgets) {
      budget.spent = await this.calculateBudgetSpent(userId, budget);
    }
    
    return userBudgets;
  }

  private async calculateBudgetSpent(userId: number, budget: Budget): Promise<number> {
    // Calculate spending based on usage and pricing
    const records = await db.select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          gte(usageTracking.timestamp, budget.startDate),
          lte(usageTracking.timestamp, budget.endDate)
        )
      );

    // Simple pricing model (in production, use actual pricing)
    const pricing = {
      compute: 0.02, // $0.02 per CPU hour
      storage: 0.10, // $0.10 per GB per month
      bandwidth: 0.08, // $0.08 per GB
      ai_tokens: 0.000002, // $0.000002 per token
      database_ops: 0.000001, // $0.000001 per operation
      deployments: 1.00, // $1.00 per deployment
      build_minutes: 0.008, // $0.008 per minute
    };

    let total = 0;
    for (const record of records) {
      if (pricing[record.metricType] && budget.categories.includes(record.metricType)) {
        total += parseFloat(record.value || '0') * pricing[record.metricType];
      }
    }

    return total;
  }

  async updateBudget(userId: number, budgetId: number, updates: Partial<Budget>): Promise<Budget | null> {
    const userBudgets = this.budgets.get(userId) || [];
    const budgetIndex = userBudgets.findIndex(b => b.id === budgetId);
    
    if (budgetIndex === -1) {
      return null;
    }
    
    userBudgets[budgetIndex] = { ...userBudgets[budgetIndex], ...updates };
    return userBudgets[budgetIndex];
  }

  async deleteBudget(userId: number, budgetId: number): Promise<boolean> {
    const userBudgets = this.budgets.get(userId) || [];
    const filtered = userBudgets.filter(b => b.id !== budgetId);
    
    if (filtered.length === userBudgets.length) {
      return false;
    }
    
    this.budgets.set(userId, filtered);
    return true;
  }

  // Cost estimation
  async estimateMonthlyCost(userId: number): Promise<number> {
    const metrics = await this.getUserMetrics(userId);
    
    // Simple cost calculation (in production, use actual pricing tiers)
    const monthlyCost = 
      metrics.compute * 0.02 * 720 + // 720 hours in a month
      metrics.storage * 0.10 +
      metrics.bandwidth * 0.08 * 30 + // Estimated daily bandwidth * 30
      metrics.aiTokens * 0.000002 * 30 +
      metrics.databaseOps * 0.000001 * 30 +
      metrics.deployments * 1.00 * 30 +
      metrics.buildMinutes * 0.008 * 30;
    
    return Math.round(monthlyCost * 100) / 100;
  }
}

export const realUsageTrackingService = new RealUsageTrackingService();