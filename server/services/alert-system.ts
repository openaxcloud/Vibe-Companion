/**
 * Alert System Service
 * Advanced alerting with thresholds, anomaly detection, and notifications
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { alerts, alertHistory, users } from '@shared/schema';
import { eq, and, or, gte, lte, desc, sql } from 'drizzle-orm';

const logger = createLogger('alert-system');

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  quietHours?: QuietHours;
  escalation?: EscalationPolicy;
  cooldownMinutes?: number;
  lastTriggered?: Date;
}

interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'pattern' | 'composite';
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  duration?: number; // How long condition must be true (seconds)
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  window?: number; // Time window for aggregation (seconds)
}

interface AlertAction {
  type: 'email' | 'inapp' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
}

interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timezone: string;
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
}

interface EscalationPolicy {
  levels: EscalationLevel[];
}

interface EscalationLevel {
  delayMinutes: number;
  actions: AlertAction[];
  repeatCount?: number;
}

interface ActiveAlert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, any>;
  triggeredAt: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'muted';
  escalationLevel?: number;
}

interface AnomalyDetector {
  metric: string;
  baseline: number;
  standardDeviation: number;
  sensitivity: number; // Number of standard deviations for anomaly
  dataPoints: number[];
}

export class AlertSystem extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private anomalyDetectors: Map<string, AnomalyDetector> = new Map();
  private metricHistory: Map<string, number[]> = new Map();
  private mutedAlerts: Set<string> = new Set();
  
  constructor() {
    super();
    this.initialize();
  }

  private async initialize() {
    logger.info('Initializing alert system');
    await this.loadAlertRules();
    await this.loadActiveAlerts();
    this.setupDefaultRules();
    this.startAnomalyDetection();
  }

  private setupDefaultRules() {
    // Default alert rules
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu',
        name: 'High CPU Usage',
        description: 'Alert when CPU usage exceeds 80%',
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'cpu_usage',
          operator: 'gt',
          value: 80,
          duration: 300, // 5 minutes
          aggregation: 'avg',
          window: 300
        },
        actions: [
          {
            type: 'inapp',
            config: { priority: 'high' }
          }
        ],
        cooldownMinutes: 15
      },
      {
        id: 'high_memory',
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds 85%',
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'memory_usage',
          operator: 'gt',
          value: 85,
          duration: 300,
          aggregation: 'avg',
          window: 300
        },
        actions: [
          {
            type: 'inapp',
            config: { priority: 'high' }
          }
        ],
        cooldownMinutes: 15
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'error_rate',
          operator: 'gt',
          value: 5,
          duration: 60,
          aggregation: 'avg',
          window: 300
        },
        actions: [
          {
            type: 'inapp',
            config: { priority: 'critical' }
          }
        ],
        escalation: {
          levels: [
            {
              delayMinutes: 5,
              actions: [
                {
                  type: 'email',
                  config: { template: 'error_escalation' }
                }
              ]
            }
          ]
        },
        cooldownMinutes: 10
      },
      {
        id: 'slow_response',
        name: 'Slow Response Time',
        description: 'Alert when average response time exceeds 2 seconds',
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'avg_response_time',
          operator: 'gt',
          value: 2000,
          duration: 180,
          aggregation: 'avg',
          window: 300
        },
        actions: [
          {
            type: 'inapp',
            config: { priority: 'medium' }
          }
        ],
        cooldownMinutes: 20
      },
      {
        id: 'traffic_anomaly',
        name: 'Traffic Anomaly',
        description: 'Detect unusual traffic patterns',
        enabled: true,
        condition: {
          type: 'anomaly',
          metric: 'requests_per_minute',
          operator: 'gt',
          value: 3, // 3 standard deviations
          window: 3600 // Look at last hour for baseline
        },
        actions: [
          {
            type: 'inapp',
            config: { priority: 'medium' }
          }
        ],
        cooldownMinutes: 30
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private startAnomalyDetection() {
    // Initialize anomaly detectors for key metrics
    const metricsToMonitor = [
      'requests_per_minute',
      'avg_response_time',
      'error_rate',
      'cpu_usage',
      'memory_usage'
    ];

    metricsToMonitor.forEach(metric => {
      this.anomalyDetectors.set(metric, {
        metric,
        baseline: 0,
        standardDeviation: 0,
        sensitivity: 3,
        dataPoints: []
      });
    });
  }

  // Check if a metric value triggers any alerts
  public async checkMetric(metricName: string, value: number) {
    // Store metric history
    if (!this.metricHistory.has(metricName)) {
      this.metricHistory.set(metricName, []);
    }
    const history = this.metricHistory.get(metricName)!;
    history.push(value);
    if (history.length > 3600) { // Keep last hour of second-by-second data
      history.shift();
    }

    // Update anomaly detector
    await this.updateAnomalyDetector(metricName, value);

    // Check all rules that involve this metric
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;
      if (rule.condition.metric !== metricName) continue;

      const shouldTrigger = await this.evaluateCondition(rule.condition, metricName, value);
      
      if (shouldTrigger) {
        await this.triggerAlert(rule, value);
      } else {
        await this.resolveAlertIfActive(ruleId);
      }
    }
  }

  private async updateAnomalyDetector(metric: string, value: number) {
    const detector = this.anomalyDetectors.get(metric);
    if (!detector) return;

    detector.dataPoints.push(value);
    if (detector.dataPoints.length > 3600) { // Keep last hour
      detector.dataPoints.shift();
    }

    // Calculate baseline and standard deviation
    if (detector.dataPoints.length >= 60) { // Need at least 1 minute of data
      const sum = detector.dataPoints.reduce((a, b) => a + b, 0);
      detector.baseline = sum / detector.dataPoints.length;

      const squaredDiffs = detector.dataPoints.map(v => Math.pow(v - detector.baseline, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
      detector.standardDeviation = Math.sqrt(avgSquaredDiff);
    }
  }

  private async evaluateCondition(condition: AlertCondition, metricName: string, currentValue: number): Promise<boolean> {
    if (condition.type === 'threshold') {
      return this.evaluateThresholdCondition(condition, metricName, currentValue);
    } else if (condition.type === 'anomaly') {
      return this.evaluateAnomalyCondition(condition, metricName, currentValue);
    }
    
    return false;
  }

  private evaluateThresholdCondition(condition: AlertCondition, metricName: string, currentValue: number): boolean {
    const history = this.metricHistory.get(metricName) || [];
    
    if (condition.window && condition.aggregation) {
      // Get values within the window
      const windowValues = history.slice(-condition.window);
      if (windowValues.length === 0) return false;
      
      // Calculate aggregated value
      let aggValue: number;
      switch (condition.aggregation) {
        case 'avg':
          aggValue = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
          break;
        case 'sum':
          aggValue = windowValues.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          aggValue = Math.min(...windowValues);
          break;
        case 'max':
          aggValue = Math.max(...windowValues);
          break;
        case 'count':
          aggValue = windowValues.length;
          break;
        default:
          aggValue = currentValue;
      }
      
      currentValue = aggValue;
    }
    
    // Evaluate operator
    switch (condition.operator) {
      case 'gt': return currentValue > condition.value;
      case 'lt': return currentValue < condition.value;
      case 'gte': return currentValue >= condition.value;
      case 'lte': return currentValue <= condition.value;
      case 'eq': return currentValue === condition.value;
      case 'ne': return currentValue !== condition.value;
      default: return false;
    }
  }

  private evaluateAnomalyCondition(condition: AlertCondition, metricName: string, currentValue: number): boolean {
    const detector = this.anomalyDetectors.get(metricName);
    if (!detector || detector.dataPoints.length < 60) {
      return false; // Not enough data for anomaly detection
    }

    const deviation = Math.abs(currentValue - detector.baseline);
    const numStdDevs = deviation / detector.standardDeviation;
    
    return numStdDevs > condition.value;
  }

  private async triggerAlert(rule: AlertRule, metricValue: number) {
    // Check cooldown
    if (rule.lastTriggered && rule.cooldownMinutes) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
        return; // Still in cooldown
      }
    }

    // Check quiet hours
    if (this.isInQuietHours(rule.quietHours)) {
      logger.debug(`Alert ${rule.id} suppressed due to quiet hours`);
      return;
    }

    // Check if already active
    if (this.activeAlerts.has(rule.id) && !this.mutedAlerts.has(rule.id)) {
      return; // Alert already active
    }

    const severity = this.determineSeverity(rule, metricValue);
    
    const alert: ActiveAlert = {
      id: `${rule.id}_${Date.now()}`,
      ruleId: rule.id,
      severity,
      message: `${rule.name}: ${rule.description}`,
      details: {
        metric: rule.condition.metric,
        value: metricValue,
        threshold: rule.condition.value,
        operator: rule.condition.operator
      },
      triggeredAt: new Date(),
      status: 'active',
      escalationLevel: 0
    };

    // Store alert
    this.activeAlerts.set(rule.id, alert);
    rule.lastTriggered = new Date();

    // Save to database
    await this.saveAlertToDatabase(alert);

    // Execute actions
    await this.executeActions(rule.actions, alert);

    // Set up escalation if configured
    if (rule.escalation) {
      this.scheduleEscalation(rule, alert);
    }

    // Emit event
    this.emit('alert_triggered', alert);
    
    logger.warn(`Alert triggered: ${rule.name}`, alert.details);
  }

  private determineSeverity(rule: AlertRule, value: number): 'info' | 'warning' | 'error' | 'critical' {
    // Determine severity based on how far the value exceeds the threshold
    const threshold = rule.condition.value;
    const ratio = value / threshold;
    
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'error';
    if (ratio > 1.2) return 'warning';
    return 'info';
  }

  private isInQuietHours(quietHours?: QuietHours): boolean {
    if (!quietHours || !quietHours.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Check day of week if specified
    if (quietHours.daysOfWeek && !quietHours.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // Check hour range
    if (quietHours.startHour <= quietHours.endHour) {
      // Normal range (e.g., 9-17)
      return currentHour >= quietHours.startHour && currentHour < quietHours.endHour;
    } else {
      // Overnight range (e.g., 22-6)
      return currentHour >= quietHours.startHour || currentHour < quietHours.endHour;
    }
  }

  private async executeActions(actions: AlertAction[], alert: ActiveAlert) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'inapp':
            await this.sendInAppNotification(alert, action.config);
            break;
          case 'email':
            await this.sendEmailNotification(alert, action.config);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, action.config);
            break;
          case 'slack':
            await this.sendSlackNotification(alert, action.config);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(alert, action.config);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  private async sendInAppNotification(alert: ActiveAlert, config: Record<string, any>) {
    // Emit event for WebSocket broadcast
    this.emit('inapp_notification', {
      type: 'alert',
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      priority: config.priority || 'medium',
      timestamp: alert.triggeredAt
    });
  }

  private async sendEmailNotification(alert: ActiveAlert, config: Record<string, any>) {
    // Implement email sending logic
    logger.info(`Would send email notification for alert: ${alert.id}`);
  }

  private async sendWebhookNotification(alert: ActiveAlert, config: Record<string, any>) {
    // Implement webhook calling logic
    logger.info(`Would call webhook for alert: ${alert.id}`);
  }

  private async sendSlackNotification(alert: ActiveAlert, config: Record<string, any>) {
    // Implement Slack notification logic
    logger.info(`Would send Slack notification for alert: ${alert.id}`);
  }

  private async sendPagerDutyNotification(alert: ActiveAlert, config: Record<string, any>) {
    // Implement PagerDuty integration
    logger.info(`Would trigger PagerDuty for alert: ${alert.id}`);
  }

  private scheduleEscalation(rule: AlertRule, alert: ActiveAlert) {
    if (!rule.escalation) return;

    rule.escalation.levels.forEach((level, index) => {
      setTimeout(async () => {
        // Check if alert is still active
        const currentAlert = this.activeAlerts.get(rule.id);
        if (currentAlert && currentAlert.status === 'active') {
          currentAlert.escalationLevel = index + 1;
          await this.executeActions(level.actions, currentAlert);
          logger.warn(`Alert escalated to level ${index + 1}: ${rule.name}`);
        }
      }, level.delayMinutes * 60 * 1000);
    });
  }

  private async resolveAlertIfActive(ruleId: string) {
    const alert = this.activeAlerts.get(ruleId);
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(ruleId);
      
      await this.updateAlertInDatabase(alert);
      
      this.emit('alert_resolved', alert);
      logger.info(`Alert resolved: ${ruleId}`);
    }
  }

  // Public API methods

  public async acknowledgeAlert(alertRuleId: string, userId: string) {
    const alert = this.activeAlerts.get(alertRuleId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    await this.updateAlertInDatabase(alert);

    this.emit('alert_acknowledged', alert);
    logger.info(`Alert acknowledged: ${alertRuleId} by ${userId}`);

    return alert;
  }

  public muteAlert(alertRuleId: string, durationMinutes?: number) {
    this.mutedAlerts.add(alertRuleId);
    
    if (durationMinutes) {
      setTimeout(() => {
        this.unmuteAlert(alertRuleId);
      }, durationMinutes * 60 * 1000);
    }
    
    logger.info(`Alert muted: ${alertRuleId}`);
  }

  public unmuteAlert(alertRuleId: string) {
    this.mutedAlerts.delete(alertRuleId);
    logger.info(`Alert unmuted: ${alertRuleId}`);
  }

  public getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 100): Promise<any[]> {
    return this.loadAlertHistory(limit);
  }

  public addAlertRule(rule: AlertRule) {
    this.alertRules.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.id}`);
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>) {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info(`Alert rule updated: ${ruleId}`);
    }
  }

  public deleteAlertRule(ruleId: string) {
    this.alertRules.delete(ruleId);
    logger.info(`Alert rule deleted: ${ruleId}`);
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  // Database operations
  private async saveAlertToDatabase(alert: ActiveAlert) {
    try {
      await db.insert(alerts).values({
        type: alert.ruleId,
        severity: alert.severity,
        message: alert.message,
        status: alert.status,
        triggered_at: alert.triggeredAt,
        metadata: alert.details
      });
    } catch (error) {
      logger.error('Failed to save alert to database:', error);
    }
  }

  private async updateAlertInDatabase(alert: ActiveAlert) {
    try {
      await db.update(alerts)
        .set({
          status: alert.status,
          acknowledged_by: alert.acknowledgedBy,
          acknowledged_at: alert.acknowledgedAt,
          resolved_at: alert.resolvedAt
        })
        .where(eq(alerts.type, alert.ruleId));
    } catch (error) {
      logger.error('Failed to update alert in database:', error);
    }
  }

  private async loadAlertRules() {
    // Load custom alert rules from database if they exist
    // For now, we use the default rules set up in setupDefaultRules()
  }

  private async loadActiveAlerts() {
    try {
      const activeAlertsFromDb = await db
        .select()
        .from(alerts)
        .where(or(eq(alerts.status, 'active'), eq(alerts.status, 'acknowledged')))
        .orderBy(desc(alerts.triggered_at));

      // Restore active alerts
      activeAlertsFromDb.forEach(dbAlert => {
        const alert: ActiveAlert = {
          id: `${dbAlert.type}_${dbAlert.triggered_at}`,
          ruleId: dbAlert.type,
          severity: dbAlert.severity as any,
          message: dbAlert.message,
          details: dbAlert.metadata as any || {},
          triggeredAt: dbAlert.triggered_at,
          acknowledgedBy: dbAlert.acknowledged_by || undefined,
          acknowledgedAt: dbAlert.acknowledged_at || undefined,
          status: dbAlert.status as any
        };
        this.activeAlerts.set(dbAlert.type, alert);
      });

      logger.info(`Loaded ${this.activeAlerts.size} active alerts`);
    } catch (error) {
      logger.error('Failed to load active alerts:', error);
    }
  }

  private async loadAlertHistory(limit: number) {
    try {
      return await db
        .select()
        .from(alerts)
        .orderBy(desc(alerts.triggered_at))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to load alert history:', error);
      return [];
    }
  }
}

export const alertSystem = new AlertSystem();