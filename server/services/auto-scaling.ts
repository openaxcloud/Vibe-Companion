// @ts-nocheck
import { EventEmitter } from 'events';
import { db } from '../db';
import { scalingPolicies, deploymentMetrics } from '@shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { deploymentMetricsService } from './deployment-metrics';

export interface ScalingPolicy {
  id?: string;
  deploymentId: string;
  name: string;
  enabled: boolean;
  metric: 'cpu' | 'memory' | 'requests' | 'responseTime' | 'custom';
  thresholdUp: number;
  thresholdDown: number;
  scaleUpBy: number; // number of instances to add
  scaleDownBy: number; // number of instances to remove
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number; // seconds
  customMetric?: {
    query: string;
    aggregation: 'avg' | 'max' | 'min' | 'sum';
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScalingEvent {
  deploymentId: string;
  policyId: string;
  action: 'scale_up' | 'scale_down' | 'no_action';
  previousInstances: number;
  newInstances: number;
  metric: string;
  metricValue: number;
  threshold: number;
  timestamp: Date;
  reason: string;
}

export interface ScalingStatus {
  deploymentId: string;
  currentInstances: number;
  targetInstances: number;
  activePolicies: number;
  lastScalingEvent?: ScalingEvent;
  inCooldown: boolean;
  cooldownEndsAt?: Date;
  estimatedCost: number;
}

export interface CostEstimate {
  currentCost: number;
  estimatedCost: number;
  savingsOrIncrease: number;
  breakdown: {
    compute: number;
    memory: number;
    network: number;
    storage: number;
  };
}

export class AutoScalingService extends EventEmitter {
  private policies = new Map<string, ScalingPolicy[]>();
  private scalingEvents = new Map<string, ScalingEvent[]>();
  private cooldowns = new Map<string, Date>();
  private currentInstances = new Map<string, number>();
  private monitoringInterval?: NodeJS.Timer;
  
  // Pricing constants (per hour, per instance)
  private readonly pricing = {
    compute: 0.05, // $0.05 per CPU hour
    memory: 0.01, // $0.01 per GB hour
    network: 0.001, // $0.001 per GB
    storage: 0.0001, // $0.0001 per GB hour
  };

  constructor() {
    super();
    this.startMonitoring();
    this.subscribeToMetrics();
  }

  private startMonitoring() {
    // Check scaling policies every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.evaluateAllPolicies();
    }, 30000);
  }

  private subscribeToMetrics() {
    // Subscribe to deployment metrics for auto-scaling decisions
    deploymentMetricsService.on('metric', async (metric) => {
      await this.evaluateMetricsForScaling(metric);
    });
  }

  async createPolicy(policy: ScalingPolicy): Promise<ScalingPolicy> {
    const policyId = crypto.randomUUID();
    const newPolicy: ScalingPolicy = {
      ...policy,
      id: policyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in database
    try {
      await db.insert(scalingPolicies).values({
        deploymentId: policy.deploymentId,
        name: policy.name,
        enabled: policy.enabled,
        metric: policy.metric,
        thresholdUp: policy.thresholdUp,
        thresholdDown: policy.thresholdDown,
        scaleUpBy: policy.scaleUpBy,
        scaleDownBy: policy.scaleDownBy,
        minInstances: policy.minInstances,
        maxInstances: policy.maxInstances,
        cooldownPeriod: policy.cooldownPeriod,
        customMetric: policy.customMetric,
      });
    } catch (error) {
      console.error('Failed to create scaling policy:', error);
    }

    // Update cache
    if (!this.policies.has(policy.deploymentId)) {
      this.policies.set(policy.deploymentId, []);
    }
    this.policies.get(policy.deploymentId)!.push(newPolicy);

    this.emit('policyCreated', newPolicy);
    return newPolicy;
  }

  async updatePolicy(policyId: string, updates: Partial<ScalingPolicy>): Promise<void> {
    // Update database
    try {
      await db
        .update(scalingPolicies)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(scalingPolicies.id, policyId));
    } catch (error) {
      console.error('Failed to update scaling policy:', error);
    }

    // Update cache
    for (const [deploymentId, policies] of this.policies) {
      const policyIndex = policies.findIndex(p => p.id === policyId);
      if (policyIndex !== -1) {
        policies[policyIndex] = { ...policies[policyIndex], ...updates };
        this.emit('policyUpdated', policies[policyIndex]);
        break;
      }
    }
  }

  async deletePolicy(policyId: string): Promise<void> {
    // Delete from database
    try {
      await db.delete(scalingPolicies).where(eq(scalingPolicies.id, policyId));
    } catch (error) {
      console.error('Failed to delete scaling policy:', error);
    }

    // Update cache
    for (const [deploymentId, policies] of this.policies) {
      const policyIndex = policies.findIndex(p => p.id === policyId);
      if (policyIndex !== -1) {
        const deleted = policies.splice(policyIndex, 1)[0];
        this.emit('policyDeleted', deleted);
        break;
      }
    }
  }

  async getPolicies(deploymentId: string): Promise<ScalingPolicy[]> {
    try {
      const policies = await db
        .select()
        .from(scalingPolicies)
        .where(eq(scalingPolicies.deploymentId, deploymentId));
      
      return policies.map(p => ({
        id: p.id,
        deploymentId: p.deploymentId,
        name: p.name,
        enabled: p.enabled,
        metric: p.metric as ScalingPolicy['metric'],
        thresholdUp: p.thresholdUp,
        thresholdDown: p.thresholdDown,
        scaleUpBy: p.scaleUpBy,
        scaleDownBy: p.scaleDownBy,
        minInstances: p.minInstances,
        maxInstances: p.maxInstances,
        cooldownPeriod: p.cooldownPeriod,
        customMetric: p.customMetric as ScalingPolicy['customMetric'],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    } catch (error) {
      console.error('Failed to get scaling policies:', error);
      return [];
    }
  }

  private async evaluateAllPolicies(): Promise<void> {
    for (const [deploymentId, policies] of this.policies) {
      for (const policy of policies) {
        if (policy.enabled && !this.isInCooldown(deploymentId)) {
          await this.evaluatePolicy(deploymentId, policy);
        }
      }
    }
  }

  private async evaluateMetricsForScaling(metric: any): Promise<void> {
    const deploymentId = metric.deploymentId;
    const policies = this.policies.get(deploymentId) || [];
    
    for (const policy of policies) {
      if (!policy.enabled || this.isInCooldown(deploymentId)) {
        continue;
      }

      let shouldScale = false;
      let scaleDirection: 'up' | 'down' | 'none' = 'none';
      let metricValue = 0;

      switch (policy.metric) {
        case 'cpu':
          metricValue = metric.cpuUsage;
          break;
        case 'memory':
          metricValue = metric.memoryUsage;
          break;
        case 'requests':
          metricValue = metric.requestCount;
          break;
        case 'responseTime':
          metricValue = metric.responseTime;
          break;
      }

      if (metricValue >= policy.thresholdUp) {
        scaleDirection = 'up';
        shouldScale = true;
      } else if (metricValue <= policy.thresholdDown) {
        scaleDirection = 'down';
        shouldScale = true;
      }

      if (shouldScale) {
        await this.executeScaling(deploymentId, policy, scaleDirection, metricValue);
      }
    }
  }

  private async evaluatePolicy(deploymentId: string, policy: ScalingPolicy): Promise<void> {
    // Get recent metrics
    const metrics = await deploymentMetricsService.getMetrics(deploymentId, 'hour');
    if (metrics.length === 0) return;

    // Calculate average metric value
    let metricValue = 0;
    const recentMetrics = metrics.slice(0, 10); // Last 10 data points

    switch (policy.metric) {
      case 'cpu':
        metricValue = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
        break;
      case 'memory':
        metricValue = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
        break;
      case 'requests':
        metricValue = recentMetrics.reduce((sum, m) => sum + m.requestCount, 0) / recentMetrics.length;
        break;
      case 'responseTime':
        metricValue = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
        break;
    }

    // Determine scaling action
    let scaleDirection: 'up' | 'down' | 'none' = 'none';
    
    if (metricValue >= policy.thresholdUp) {
      scaleDirection = 'up';
    } else if (metricValue <= policy.thresholdDown) {
      scaleDirection = 'down';
    }

    if (scaleDirection !== 'none') {
      await this.executeScaling(deploymentId, policy, scaleDirection, metricValue);
    }
  }

  private async executeScaling(
    deploymentId: string,
    policy: ScalingPolicy,
    direction: 'up' | 'down',
    metricValue: number
  ): Promise<void> {
    const currentCount = this.currentInstances.get(deploymentId) || 1;
    let newCount = currentCount;
    let action: ScalingEvent['action'] = 'no_action';
    let reason = '';

    if (direction === 'up') {
      newCount = Math.min(currentCount + policy.scaleUpBy, policy.maxInstances);
      if (newCount > currentCount) {
        action = 'scale_up';
        reason = `${policy.metric} reached ${metricValue.toFixed(1)} (threshold: ${policy.thresholdUp})`;
      } else {
        reason = `Already at maximum instances (${policy.maxInstances})`;
      }
    } else if (direction === 'down') {
      newCount = Math.max(currentCount - policy.scaleDownBy, policy.minInstances);
      if (newCount < currentCount) {
        action = 'scale_down';
        reason = `${policy.metric} dropped to ${metricValue.toFixed(1)} (threshold: ${policy.thresholdDown})`;
      } else {
        reason = `Already at minimum instances (${policy.minInstances})`;
      }
    }

    if (action !== 'no_action') {
      // Execute scaling action
      await this.scaleDeployment(deploymentId, newCount);
      
      // Set cooldown
      const cooldownEnds = new Date();
      cooldownEnds.setSeconds(cooldownEnds.getSeconds() + policy.cooldownPeriod);
      this.cooldowns.set(deploymentId, cooldownEnds);
      
      // Update current instance count
      this.currentInstances.set(deploymentId, newCount);
    }

    // Record scaling event
    const event: ScalingEvent = {
      deploymentId,
      policyId: policy.id!,
      action,
      previousInstances: currentCount,
      newInstances: newCount,
      metric: policy.metric,
      metricValue,
      threshold: direction === 'up' ? policy.thresholdUp : policy.thresholdDown,
      timestamp: new Date(),
      reason,
    };

    await this.recordScalingEvent(event);
  }

  private async scaleDeployment(deploymentId: string, targetInstances: number): Promise<void> {
    // In production, this would call the container orchestration API
    
    // Simulate scaling action
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.emit('scaled', {
      deploymentId,
      instances: targetInstances,
      timestamp: new Date(),
    });
  }

  private async recordScalingEvent(event: ScalingEvent): Promise<void> {
    if (!this.scalingEvents.has(event.deploymentId)) {
      this.scalingEvents.set(event.deploymentId, []);
    }
    
    const events = this.scalingEvents.get(event.deploymentId)!;
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.shift();
    }
    
    this.emit('scalingEvent', event);
  }

  private isInCooldown(deploymentId: string): boolean {
    const cooldownEnds = this.cooldowns.get(deploymentId);
    if (!cooldownEnds) return false;
    
    return new Date() < cooldownEnds;
  }

  async getScalingStatus(deploymentId: string): Promise<ScalingStatus> {
    const currentCount = this.currentInstances.get(deploymentId) || 1;
    const policies = this.policies.get(deploymentId) || [];
    const events = this.scalingEvents.get(deploymentId) || [];
    const cooldownEnds = this.cooldowns.get(deploymentId);
    
    return {
      deploymentId,
      currentInstances: currentCount,
      targetInstances: currentCount, // In production, this would come from orchestrator
      activePolicies: policies.filter(p => p.enabled).length,
      lastScalingEvent: events[events.length - 1],
      inCooldown: this.isInCooldown(deploymentId),
      cooldownEndsAt: cooldownEnds,
      estimatedCost: this.estimateCost(currentCount),
    };
  }

  async getScalingHistory(deploymentId: string, limit: number = 50): Promise<ScalingEvent[]> {
    const events = this.scalingEvents.get(deploymentId) || [];
    return events.slice(-limit);
  }

  estimateCost(instances: number): number {
    // Basic cost estimation
    const hourlyPerInstance = 
      this.pricing.compute * 2 + // 2 CPUs
      this.pricing.memory * 4 + // 4 GB RAM
      this.pricing.network * 10 + // 10 GB network
      this.pricing.storage * 20; // 20 GB storage
    
    return hourlyPerInstance * instances * 730; // Monthly cost
  }

  async getCostEstimate(
    deploymentId: string,
    targetInstances?: number
  ): Promise<CostEstimate> {
    const currentCount = this.currentInstances.get(deploymentId) || 1;
    const target = targetInstances || currentCount;
    
    const currentCost = this.estimateCost(currentCount);
    const estimatedCost = this.estimateCost(target);
    
    return {
      currentCost,
      estimatedCost,
      savingsOrIncrease: estimatedCost - currentCost,
      breakdown: {
        compute: this.pricing.compute * 2 * target * 730,
        memory: this.pricing.memory * 4 * target * 730,
        network: this.pricing.network * 10 * target * 730,
        storage: this.pricing.storage * 20 * target * 730,
      },
    };
  }

  async simulateScaling(
    deploymentId: string,
    policyId: string,
    metricValue: number
  ): Promise<{ action: string; newInstances: number; estimatedCost: number }> {
    const policies = this.policies.get(deploymentId) || [];
    const policy = policies.find(p => p.id === policyId);
    
    if (!policy) {
      throw new Error('Policy not found');
    }
    
    const currentCount = this.currentInstances.get(deploymentId) || 1;
    let newCount = currentCount;
    let action = 'no_action';
    
    if (metricValue >= policy.thresholdUp) {
      newCount = Math.min(currentCount + policy.scaleUpBy, policy.maxInstances);
      action = newCount > currentCount ? 'scale_up' : 'max_reached';
    } else if (metricValue <= policy.thresholdDown) {
      newCount = Math.max(currentCount - policy.scaleDownBy, policy.minInstances);
      action = newCount < currentCount ? 'scale_down' : 'min_reached';
    }
    
    return {
      action,
      newInstances: newCount,
      estimatedCost: this.estimateCost(newCount),
    };
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

export const autoScalingService = new AutoScalingService();