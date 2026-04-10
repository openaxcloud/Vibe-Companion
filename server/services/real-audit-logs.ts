import { db } from '../db';
import { users, projects } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { EventEmitter } from 'events';

const logger = {
  info: (message: string, ...args: any[]) => {},
  error: (message: string, ...args: any[]) => console.error(`[real-audit-logs] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[real-audit-logs] WARN: ${message}`, ...args),
};

export interface AuditLog {
  id: number;
  timestamp: Date;
  userId: number;
  userName?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'error';
  errorMessage?: string;
  duration?: number;
  metadata?: {
    projectId?: number;
    teamId?: number;
    organizationId?: number;
    sessionId?: string;
    requestId?: string;
  };
}

export interface AuditFilters {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  result?: 'success' | 'failure' | 'error';
  projectId?: number;
  teamId?: number;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byResult: Record<string, number>;
  byUser: Array<{ userId: number; userName: string; count: number }>;
  recentFailures: AuditLog[];
  suspiciousActivity: Array<{
    userId: number;
    reason: string;
    events: number;
    lastSeen: Date;
  }>;
}

export class RealAuditLogsService extends EventEmitter {
  private logs = new Map<number, AuditLog>();
  private nextLogId = 1;
  private retentionDays = 90; // Default retention period
  private alertThresholds = {
    failedLogins: 5,
    unauthorizedAccess: 3,
    dataExports: 10,
    configChanges: 5,
  };

  constructor() {
    super();
    logger.info('Real Audit Logs Service initialized');
    
    // Start background cleanup job
    this.startRetentionCleanup();
    
    // Start anomaly detection
    this.startAnomalyDetection();
  }

  private startRetentionCleanup() {
    // Run cleanup daily
    setInterval(async () => {
      try {
        await this.cleanupOldLogs();
      } catch (error) {
        logger.error('Failed to cleanup old logs:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private startAnomalyDetection() {
    // Run anomaly detection every 5 minutes
    setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        logger.error('Failed to detect anomalies:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async log(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const auditLog: AuditLog = {
      ...event,
      id: this.nextLogId++,
      timestamp: new Date(),
    };

    // Store in memory (in production, would persist to database)
    this.logs.set(auditLog.id, auditLog);

    // Emit event for real-time monitoring
    this.emit('audit', auditLog);

    // Check for critical events
    if (this.isCriticalEvent(auditLog)) {
      this.emit('critical', auditLog);
    }

    logger.info(`Audit log created: ${auditLog.action} on ${auditLog.resource} by user ${auditLog.userId}`);
    
    return auditLog;
  }

  async query(filters: AuditFilters): Promise<{ logs: AuditLog[]; total: number }> {
    let filteredLogs = Array.from(this.logs.values());

    // Apply filters
    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }
    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    if (filters.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
    }
    if (filters.result) {
      filteredLogs = filteredLogs.filter(log => log.result === filters.result);
    }
    if (filters.projectId) {
      filteredLogs = filteredLogs.filter(log => log.metadata?.projectId === filters.projectId);
    }
    if (filters.teamId) {
      filteredLogs = filteredLogs.filter(log => log.metadata?.teamId === filters.teamId);
    }
    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const total = filteredLogs.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    return { logs: paginatedLogs, total };
  }

  async getStats(filters?: AuditFilters): Promise<AuditStats> {
    const { logs } = await this.query(filters || {});

    const stats: AuditStats = {
      totalEvents: logs.length,
      byAction: {},
      byResource: {},
      byResult: { success: 0, failure: 0, error: 0 },
      byUser: [],
      recentFailures: [],
      suspiciousActivity: [],
    };

    // Aggregate statistics
    const userCounts = new Map<number, { name: string; count: number }>();
    
    for (const log of logs) {
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      
      // Count by resource
      stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
      
      // Count by result
      stats.byResult[log.result]++;
      
      // Count by user
      if (!userCounts.has(log.userId)) {
        userCounts.set(log.userId, {
          name: log.userName || `User ${log.userId}`,
          count: 0,
        });
      }
      userCounts.get(log.userId)!.count++;
      
      // Collect recent failures
      if (log.result === 'failure' && stats.recentFailures.length < 10) {
        stats.recentFailures.push(log);
      }
    }

    // Convert user counts to array
    stats.byUser = Array.from(userCounts.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 users

    // Detect suspicious activity
    stats.suspiciousActivity = await this.detectSuspiciousActivity(logs);

    return stats;
  }

  private async detectSuspiciousActivity(logs: AuditLog[]): Promise<Array<{
    userId: number;
    reason: string;
    events: number;
    lastSeen: Date;
  }>> {
    const suspicious = [];
    const userActivity = new Map<number, AuditLog[]>();

    // Group logs by user
    for (const log of logs) {
      if (!userActivity.has(log.userId)) {
        userActivity.set(log.userId, []);
      }
      userActivity.get(log.userId)!.push(log);
    }

    // Check each user's activity
    for (const [userId, userLogs] of userActivity.entries()) {
      const recentLogs = userLogs.filter(
        log => log.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );

      // Check for multiple failed logins
      const failedLogins = recentLogs.filter(
        log => log.action === 'login' && log.result === 'failure'
      ).length;
      
      if (failedLogins >= this.alertThresholds.failedLogins) {
        suspicious.push({
          userId,
          reason: `${failedLogins} failed login attempts`,
          events: failedLogins,
          lastSeen: recentLogs[0].timestamp,
        });
      }

      // Check for unauthorized access attempts
      const unauthorizedAttempts = recentLogs.filter(
        log => log.result === 'failure' && log.action.includes('access')
      ).length;
      
      if (unauthorizedAttempts >= this.alertThresholds.unauthorizedAccess) {
        suspicious.push({
          userId,
          reason: `${unauthorizedAttempts} unauthorized access attempts`,
          events: unauthorizedAttempts,
          lastSeen: recentLogs[0].timestamp,
        });
      }

      // Check for excessive data exports
      const dataExports = recentLogs.filter(
        log => ['export', 'download', 'backup'].includes(log.action)
      ).length;
      
      if (dataExports >= this.alertThresholds.dataExports) {
        suspicious.push({
          userId,
          reason: `${dataExports} data export operations`,
          events: dataExports,
          lastSeen: recentLogs[0].timestamp,
        });
      }

      // Check for unusual activity patterns
      const nightTimeActivity = recentLogs.filter(log => {
        const hour = log.timestamp.getHours();
        return hour < 6 || hour > 22; // Activity between 10 PM and 6 AM
      }).length;
      
      if (nightTimeActivity > 10) {
        suspicious.push({
          userId,
          reason: `Unusual night-time activity (${nightTimeActivity} events)`,
          events: nightTimeActivity,
          lastSeen: recentLogs[0].timestamp,
        });
      }
    }

    return suspicious;
  }

  private isCriticalEvent(log: AuditLog): boolean {
    const criticalActions = [
      'delete_project',
      'delete_user',
      'change_permissions',
      'export_all_data',
      'modify_billing',
      'access_denied',
      'security_breach',
    ];

    return criticalActions.includes(log.action) || log.result === 'error';
  }

  async export(filters: AuditFilters, format: 'json' | 'csv' = 'json'): Promise<string> {
    const { logs } = await this.query(filters);

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Name',
      'Action',
      'Resource',
      'Resource ID',
      'Result',
      'IP Address',
      'Duration (ms)',
      'Error Message',
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.userId,
      log.userName || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.result,
      log.ipAddress || '',
      log.duration || '',
      log.errorMessage || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  async setRetentionPeriod(days: number): Promise<void> {
    this.retentionDays = days;
    logger.info(`Audit log retention period set to ${days} days`);
  }

  private async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, log] of this.logs.entries()) {
      if (log.timestamp < cutoffDate) {
        this.logs.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old audit logs`);
    }

    return deletedCount;
  }

  private async detectAnomalies(): Promise<void> {
    const recentLogs = Array.from(this.logs.values()).filter(
      log => log.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    // Check for rapid-fire events from same user
    const userEventCounts = new Map<number, number>();
    for (const log of recentLogs) {
      userEventCounts.set(log.userId, (userEventCounts.get(log.userId) || 0) + 1);
    }

    for (const [userId, count] of userEventCounts.entries()) {
      if (count > 100) { // More than 100 events in 5 minutes
        logger.warn(`Anomaly detected: User ${userId} generated ${count} events in 5 minutes`);
        this.emit('anomaly', {
          type: 'rapid_fire',
          userId,
          count,
          timestamp: new Date(),
        });
      }
    }

    // Check for access from multiple IPs
    const userIPs = new Map<number, Set<string>>();
    for (const log of recentLogs) {
      if (log.ipAddress) {
        if (!userIPs.has(log.userId)) {
          userIPs.set(log.userId, new Set());
        }
        userIPs.get(log.userId)!.add(log.ipAddress);
      }
    }

    for (const [userId, ips] of userIPs.entries()) {
      if (ips.size > 3) { // More than 3 different IPs in 5 minutes
        logger.warn(`Anomaly detected: User ${userId} accessed from ${ips.size} different IPs`);
        this.emit('anomaly', {
          type: 'multiple_ips',
          userId,
          ips: Array.from(ips),
          timestamp: new Date(),
        });
      }
    }
  }

  // Compliance helpers
  async generateComplianceReport(
    standard: 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI',
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { logs } = await this.query({ startDate, endDate });

    const report = {
      standard,
      period: { start: startDate, end: endDate },
      totalEvents: logs.length,
      summary: {},
      violations: [],
      recommendations: [],
    };

    switch (standard) {
      case 'SOC2':
        report.summary = {
          accessControls: logs.filter(l => l.action.includes('access')).length,
          dataModifications: logs.filter(l => ['create', 'update', 'delete'].includes(l.action)).length,
          securityEvents: logs.filter(l => l.result === 'failure').length,
        };
        break;
      
      case 'GDPR':
        report.summary = {
          dataAccess: logs.filter(l => l.action === 'read_personal_data').length,
          dataExports: logs.filter(l => l.action === 'export_personal_data').length,
          dataDeletions: logs.filter(l => l.action === 'delete_personal_data').length,
          consentActions: logs.filter(l => l.action.includes('consent')).length,
        };
        break;
      
      // Add other compliance standards as needed
    }

    return report;
  }
}

// Export singleton instance
export const realAuditLogsService = new RealAuditLogsService();