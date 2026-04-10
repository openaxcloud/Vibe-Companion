// @ts-nocheck
/**
 * Production Monitoring Service Backend
 * Handles error tracking, performance metrics, and analytics
 * Fortune 500 enterprise-grade monitoring implementation
 */

import { createLogger } from '../utils/logger';
import { db } from '../db';
import { monitoringEvents, performanceMetrics, errorLogs } from '@shared/schema';
import { and, gte, eq, desc, sql } from 'drizzle-orm';

const logger = createLogger('monitoring-service');

interface MonitoringEvent {
  errors: Array<{
    message: string;
    stack?: string;
    type: string;
    timestamp: number;
    userAgent: string;
    url: string;
    userId?: number;
    sessionId?: string;
    metadata?: Record<string, any>;
  }>;
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    tags?: Record<string, string>;
  }>;
  actions: Array<{
    action: string;
    category: string;
    label?: string;
    value?: number;
    timestamp: number;
    userId?: number;
    sessionId?: string;
  }>;
  sessionId: string;
  timestamp: number;
}

export class MonitoringService {
  private errorThresholds = {
    criticalErrorRate: 0.05, // 5% error rate
    responseTimeThreshold: 3000, // 3 seconds
    memoryUsageThreshold: 0.85 // 85% memory usage - more headroom for deployment
  };

  constructor() {
    logger.info('Monitoring service initialized');
    this.startHealthMonitoring();
  }

  async processMonitoringEvents(event: MonitoringEvent, userId?: number): Promise<void> {
    try {
      // Process errors
      if (event.errors && event.errors.length > 0) {
        await this.processErrors(event.errors, userId);
      }

      // Process metrics
      if (event.metrics && event.metrics.length > 0) {
        await this.processMetrics(event.metrics, userId, event.sessionId);
      }

      // Process user actions
      if (event.actions && event.actions.length > 0) {
        await this.processActions(event.actions, userId);
      }

      // Check for alerting conditions
      await this.checkAlertConditions();
    } catch (error) {
      logger.error('Failed to process monitoring events:', error);
    }
  }

  private async processErrors(errors: MonitoringEvent['errors'], userId?: number): Promise<void> {
    for (const error of errors) {
      try {
        await db.insert(errorLogs).values({
          message: error.message,
          stack: error.stack,
          type: error.type,
          timestamp: new Date(error.timestamp),
          userAgent: error.userAgent,
          url: error.url,
          userId: error.userId || userId,
          sessionId: error.sessionId,
          metadata: error.metadata,
          severity: this.calculateErrorSeverity(error)
        });

        // Log critical errors
        if (this.isCriticalError(error)) {
          logger.error('Critical error detected:', {
            message: error.message,
            url: error.url,
            userId: error.userId || userId
          });
        }
      } catch (err) {
        logger.error('Failed to store error log:', err);
      }
    }
  }

  private async processMetrics(metrics: MonitoringEvent['metrics'], userId?: number, sessionId?: string): Promise<void> {
    for (const metric of metrics) {
      try {
        const metadata: Record<string, any> = {
          userId,
          sessionId,
        };

        await db.insert(performanceMetrics).values({
          metric_name: metric.name,
          metric_value: metric.value,
          unit: metric.unit,
          timestamp: new Date(metric.timestamp),
          context: {
            userId,
            sessionId,
            tags: metric.tags
          }
        });

        // Check for performance issues
        if (metric.name === 'page_load_time' && metric.value > this.errorThresholds.responseTimeThreshold) {
          logger.warn('Slow page load detected:', {
            value: metric.value,
            userId,
            tags: metric.tags
          });
        }
      } catch (err) {
        logger.error('Failed to store performance metric:', err);
      }
    }
  }

  private async processActions(actions: MonitoringEvent['actions'], userId?: number): Promise<void> {
    for (const action of actions) {
      try {
        await db.insert(monitoringEvents).values({
          eventType: 'user_action',
          severity: 'info',
          source: 'user',
          message: `User action: ${action.action}`,
          metadata: {
            action: action.action,
            category: action.category,
            label: action.label,
            value: action.value,
            userId: action.userId || userId,
            sessionId: action.sessionId
          },
          timestamp: new Date(action.timestamp)
        });
      } catch (err) {
        logger.error('Failed to store user action:', err);
      }
    }
  }

  private calculateErrorSeverity(error: MonitoringEvent['errors'][0]): string {
    // Critical errors
    if (error.message.includes('CRITICAL') || 
        error.message.includes('FATAL') ||
        error.type === 'unhandledRejection') {
      return 'critical';
    }
    
    // High severity
    if (error.message.includes('ERROR') ||
        error.message.includes('Failed') ||
        error.stack?.includes('TypeError')) {
      return 'high';
    }
    
    // Medium severity
    if (error.message.includes('Warning') ||
        error.message.includes('Deprecated')) {
      return 'medium';
    }
    
    return 'low';
  }

  private isCriticalError(error: MonitoringEvent['errors'][0]): boolean {
    return this.calculateErrorSeverity(error) === 'critical';
  }

  private async checkAlertConditions(): Promise<void> {
    try {
      // Check error rate in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentErrors = await db.select({ count: sql<number>`count(*)` })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, fiveMinutesAgo));
      
      const errorCount = recentErrors[0]?.count || 0;
      if (errorCount > 100) {
        logger.error(`High error rate detected: ${errorCount} errors in the last 5 minutes`);
        // Here you would trigger alerts (email, Slack, PagerDuty, etc.)
      }
    } catch (error) {
      logger.error('Failed to check alert conditions:', error);
    }
  }

  async getHealthMetrics(): Promise<{
    status: string;
    uptime: number;
    errorRate: number;
    avgResponseTime: number;
    activeUsers: number;
    systemHealth: {
      memory: number;
      cpu: number;
      diskSpace: number;
    };
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Get error rate
      const [errorData] = await db.select({ count: sql<number>`count(*)` })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, oneHourAgo));
      
      // Get average response time
      const responseTimeData = await db.select({ 
        avg: sql<number>`avg(metric_value)` 
      })
        .from(performanceMetrics)
        .where(and(
          eq(performanceMetrics.metric_name, 'page_load_time'),
          gte(performanceMetrics.timestamp, oneHourAgo)
        ));
      
      // Get active users (from metadata)
      const [activeUserData] = await db.select({ 
        count: sql<number>`count(distinct metadata->>'userId')` 
      })
        .from(monitoringEvents)
        .where(and(
          gte(monitoringEvents.timestamp, oneHourAgo),
          sql`metadata->>'userId' IS NOT NULL`
        ));
      
      const errorRate = (errorData?.count || 0) / 1000; // Errors per 1000 requests
      const avgResponseTime = responseTimeData[0]?.avg || 0;
      const activeUsers = activeUserData?.count || 0;
      
      // System metrics (in production, these would come from actual system monitoring)
      const systemHealth = {
        memory: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        cpu: 0.15, // Would use actual CPU monitoring
        diskSpace: 0.45 // Would check actual disk usage
      };
      
      return {
        status: errorRate > this.errorThresholds.criticalErrorRate ? 'degraded' : 'healthy',
        uptime: process.uptime(),
        errorRate,
        avgResponseTime,
        activeUsers,
        systemHealth
      };
    } catch (error) {
      logger.error('Failed to get health metrics:', error);
      return {
        status: 'error',
        uptime: process.uptime(),
        errorRate: 0,
        avgResponseTime: 0,
        activeUsers: 0,
        systemHealth: {
          memory: 0,
          cpu: 0,
          diskSpace: 0
        }
      };
    }
  }

  async getErrorSummary(hours: number = 24): Promise<any> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const errors = await db.select({
        message: errorLogs.message,
        type: errorLogs.type,
        count: sql<number>`count(*)`,
        lastOccurrence: sql<Date>`max(timestamp)`
      })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, since))
        .groupBy(errorLogs.message, errorLogs.type)
        .orderBy(desc(sql`count(*)`))
        .limit(50);
      
      return errors;
    } catch (error) {
      logger.error('Failed to get error summary:', error);
      return [];
    }
  }

  async trackEvent(eventData: {
    type: string;
    category: string;
    message: string;
    metadata?: Record<string, any>;
    userId?: number;
    projectId?: number;
    url?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ id: number }> {
    try {
      const metadata: Record<string, any> = {
        ...eventData.metadata,
        userId: eventData.userId,
        projectId: eventData.projectId,
        sessionId: eventData.metadata?.sessionId,
      };

      const [event] = await db.insert(monitoringEvents).values({
        eventType: eventData.type,
        severity: 'info',
        source: eventData.category,
        message: eventData.message,
        metadata: {
          ...eventData.metadata,
          userId: eventData.userId,
          projectId: eventData.projectId,
          url: eventData.url,
          userAgent: eventData.userAgent,
          ipAddress: eventData.ipAddress
        },
        timestamp: new Date()
      }).returning({ id: monitoringEvents.id });

      logger.info(`Tracked ${eventData.type} event:`, {
        category: eventData.category,
        action: eventData.message,
        userId: eventData.userId
      });

      return event;
    } catch (error) {
      logger.error('Failed to track event:', error);
      throw error;
    }
  }

  private startHealthMonitoring() {
    // Monitor system health every 5 minutes to reduce overhead
    setInterval(async () => {
      const metrics = await this.getHealthMetrics();
      
      // Log system health
      await db.insert(performanceMetrics).values({
        metric_name: 'system_memory_usage',
        metric_value: metrics.systemHealth.memory,
        unit: 'percentage',
        timestamp: new Date()
      }).catch(err => {
        // Gracefully handle missing tables during initialization
        logger.debug('Failed to log performance metrics (table may not exist yet):', err.message);
      });
      
      // Alert on high memory usage
      if (metrics.systemHealth.memory > this.errorThresholds.memoryUsageThreshold) {
        logger.error('High memory usage detected:', metrics.systemHealth.memory);
      }
    }, 300000); // Every 5 minutes
  }
}

export const monitoringService = new MonitoringService();