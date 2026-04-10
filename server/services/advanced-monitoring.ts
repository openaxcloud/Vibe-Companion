import { EventEmitter } from 'events';
import type { DatabaseStorage } from '../storage';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getRequestCountLastMinute } from '../middleware/request-counter';

export interface MetricPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  duration: number; // seconds
  severity: 'info' | 'warning' | 'critical';
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  refreshInterval: number;
}

export interface Widget {
  id: string;
  type: 'line' | 'bar' | 'gauge' | 'heatmap' | 'table';
  title: string;
  metric: string;
  timeRange: string;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export class AdvancedMonitoringService extends EventEmitter {
  private storage: DatabaseStorage;
  private metrics: Map<string, MetricPoint[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  
  constructor(storage: DatabaseStorage) {
    super();
    this.storage = storage;
    this.initializeBuiltInDashboards();
    this.startMetricCollection();
  }

  private initializeBuiltInDashboards() {
    // System Performance Dashboard
    this.dashboards.set('system-performance', {
      id: 'system-performance',
      name: 'System Performance',
      refreshInterval: 10,
      widgets: [
        {
          id: 'cpu-usage',
          type: 'line',
          title: 'CPU Usage',
          metric: 'system.cpu.usage',
          timeRange: '1h',
          aggregation: 'avg'
        },
        {
          id: 'memory-usage',
          type: 'gauge',
          title: 'Memory Usage',
          metric: 'system.memory.usage',
          timeRange: 'current',
          aggregation: 'avg'
        },
        {
          id: 'gpu-utilization',
          type: 'heatmap',
          title: 'GPU Utilization',
          metric: 'gpu.utilization',
          timeRange: '1h',
          aggregation: 'avg'
        }
      ]
    });

    // Business Analytics Dashboard
    this.dashboards.set('business-analytics', {
      id: 'business-analytics',
      name: 'Business Analytics',
      refreshInterval: 60,
      widgets: [
        {
          id: 'active-users',
          type: 'line',
          title: 'Active Users',
          metric: 'business.users.active',
          timeRange: '7d',
          aggregation: 'sum'
        },
        {
          id: 'revenue',
          type: 'bar',
          title: 'Revenue by Service',
          metric: 'business.revenue',
          timeRange: '30d',
          aggregation: 'sum'
        },
        {
          id: 'api-usage',
          type: 'table',
          title: 'API Usage by Endpoint',
          metric: 'api.requests',
          timeRange: '24h',
          aggregation: 'count'
        }
      ]
    });
  }

  private startMetricCollection() {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // Collect business metrics every minute
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 60000);
  }

  private collectSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    this.recordMetric('system.cpu.usage', 
      (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      { type: 'system' }
    );
    
    this.recordMetric('system.memory.usage', 
      memUsage.heapUsed / memUsage.heapTotal * 100,
      { type: 'heap' }
    );
    
    this.recordMetric('system.memory.rss',
      memUsage.rss / 1024 / 1024, // MB
      { type: 'rss' }
    );
  }

  private async collectBusinessMetrics() {
    let activeUsers = 0;
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [result] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${agentSessions.userId})` })
        .from(agentSessions)
        .where(and(
          eq(agentSessions.isActive, true),
          gte(agentSessions.startedAt, fiveMinAgo)
        ));
      activeUsers = Number(result?.count || 0);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      activeUsers = 0;
    }

    const apiRequests = getRequestCountLastMinute();
    
    this.recordMetric('business.users.active', activeUsers, { period: '5m' });
    this.recordMetric('api.requests', apiRequests, { period: '1m' });
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    const point: MetricPoint = {
      timestamp: new Date(),
      value,
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const points = this.metrics.get(name)!;
    points.push(point);

    // Keep only last 24 hours of data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics.set(name, points.filter(p => p.timestamp > cutoff));

    // Check alert rules
    this.checkAlerts(name, value);

    this.emit('metric', { name, point });
  }

  private checkAlerts(metric: string, value: number) {
    for (const rule of Array.from(this.alertRules.values())) {
      if (rule.metric === metric) {
        const triggered = this.evaluateRule(rule, value);
        if (triggered) {
          this.triggerAlert(rule, value);
        }
      }
    }
  }

  private evaluateRule(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'above':
        return value > rule.threshold;
      case 'below':
        return value < rule.threshold;
      case 'equals':
        return Math.abs(value - rule.threshold) < 0.001;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number) {
    const alert = {
      rule,
      value,
      timestamp: new Date(),
      message: `Alert: ${rule.name} - ${rule.metric} is ${rule.condition} ${rule.threshold} (current: ${value})`
    };

    this.emit('alert', alert);

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, alert);
    }
  }

  private executeAlertAction(action: AlertAction, alert: any) {
    switch (action.type) {
      case 'email':
        // Would send email via email service
        break;
      case 'webhook':
        // Would call webhook
        break;
      case 'slack':
        // Would send Slack message
        break;
      case 'pagerduty':
        // Would create PagerDuty incident
        break;
    }
  }

  createAlertRule(rule: AlertRule) {
    this.alertRules.set(rule.id, rule);
    return rule;
  }

  deleteAlertRule(id: string) {
    return this.alertRules.delete(id);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  createDashboard(dashboard: Dashboard) {
    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  getMetrics(name: string, timeRange: string, aggregation?: string): MetricPoint[] {
    const points = this.metrics.get(name) || [];
    const now = new Date();
    let cutoff: Date;

    // Parse time range
    const match = timeRange.match(/(\d+)([hdm])/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 'h':
          cutoff = new Date(now.getTime() - value * 60 * 60 * 1000);
          break;
        case 'd':
          cutoff = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
          break;
        case 'm':
          cutoff = new Date(now.getTime() - value * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
    } else {
      cutoff = new Date(0);
    }

    return points.filter(p => p.timestamp > cutoff);
  }

  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // Advanced analytics
  async getAnomalies(metric: string, sensitivity: number = 3): Promise<any[]> {
    const points = this.getMetrics(metric, '24h');
    if (points.length < 10) return [];

    // Simple anomaly detection using standard deviation
    const values = points.map(p => p.value);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = points.filter(p => 
      Math.abs(p.value - mean) > sensitivity * stdDev
    );

    return anomalies.map(p => ({
      timestamp: p.timestamp,
      value: p.value,
      deviation: (p.value - mean) / stdDev
    }));
  }

  async getForecast(metric: string, hours: number): Promise<any[]> {
    const points = this.getMetrics(metric, '7d');
    if (points.length < 10) return [];

    // Simple linear regression for forecasting
    const n = points.length;
    const x = points.map((_, i) => i);
    const y = points.map(p => p.value);

    const sumX = x.reduce((a, b) => a + b);
    const sumY = y.reduce((a, b) => a + b);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const forecast = [];
    const lastTimestamp = points[points.length - 1].timestamp;
    
    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + (i + 1) * 60 * 60 * 1000);
      const value = slope * (n + i) + intercept;
      forecast.push({ timestamp, value, type: 'forecast' });
    }

    return forecast;
  }
}

// Export singleton instance
let monitoringInstance: AdvancedMonitoringService | null = null;

export function getAdvancedMonitoringService(storage: DatabaseStorage): AdvancedMonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new AdvancedMonitoringService(storage);
  }
  return monitoringInstance;
}