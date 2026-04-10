/**
 * Sandbox Monitoring and Audit System
 * Provides real-time monitoring, security event logging, and audit trails
 * for the enterprise-grade sandboxing system
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('sandbox-monitor');

export interface SandboxOptions {
  language: string;
  code: string;
  files?: { [path: string]: string };
  stdin?: string;
  env?: Record<string, string>;
  args?: string[];
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  securityPolicy?: 'untrusted' | 'standard' | 'privileged';
  uid?: number;
  gid?: number;
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'syscall_violation' | 'resource_limit' | 'file_access' | 'network_attempt' | 
        'process_spawn' | 'memory_violation' | 'execution_start' | 'execution_end' |
        'permission_denied' | 'sandbox_escape_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sandboxId: string;
  userId?: number;
  projectId?: number;
  details: {
    syscall?: string;
    resource?: string;
    limit?: number;
    actual?: number;
    path?: string;
    ip?: string;
    port?: number;
    pid?: number;
    exitCode?: number;
    executionTime?: number;
    error?: string;
    stackTrace?: string;
  };
  metadata?: Record<string, any>;
}

export interface SandboxMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  securityViolations: number;
  averageExecutionTime: number;
  resourceUsage: {
    cpuTime: number;
    memoryPeak: number;
    diskIO: number;
    networkIO: number;
  };
  violationsByType: Record<string, number>;
  executionsByLanguage: Record<string, number>;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: 'create_sandbox' | 'destroy_sandbox' | 'execute_code' | 
          'policy_change' | 'configuration_update' | 'security_event';
  actor: {
    type: 'user' | 'system' | 'admin';
    id?: number;
    username?: string;
    ip?: string;
  };
  target: {
    type: 'sandbox' | 'project' | 'file' | 'configuration';
    id?: string;
    name?: string;
  };
  result: 'success' | 'failure';
  details: Record<string, any>;
}

export class SandboxMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private auditLogs: AuditLog[] = [];
  private metrics: SandboxMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    securityViolations: 0,
    averageExecutionTime: 0,
    resourceUsage: {
      cpuTime: 0,
      memoryPeak: 0,
      diskIO: 0,
      networkIO: 0
    },
    violationsByType: {},
    executionsByLanguage: {}
  };
  
  private readonly maxEventsInMemory = 10000;
  private readonly auditLogPath: string;
  private readonly securityLogPath: string;
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    super();
    
    // Set up log paths
    const logsDir = path.join(process.cwd(), 'logs', 'sandbox');
    this.auditLogPath = path.join(logsDir, 'audit.log');
    this.securityLogPath = path.join(logsDir, 'security.log');
    
    // Initialize logging directories
    this.initializeLogging().catch(err => {
      logger.error('Failed to initialize sandbox logging', err);
    });
    
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.persistMetrics().catch(err => {
        logger.error('Failed to persist sandbox metrics', err);
      });
    }, 60000); // Every minute
  }

  /**
   * Initialize logging directories and files
   */
  private async initializeLogging(): Promise<void> {
    const logsDir = path.dirname(this.auditLogPath);
    await fs.mkdir(logsDir, { recursive: true });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    // Add to in-memory buffer
    this.events.push(fullEvent);
    if (this.events.length > this.maxEventsInMemory) {
      this.events.shift();
    }

    // Update metrics
    this.metrics.securityViolations++;
    this.metrics.violationsByType[event.type] = 
      (this.metrics.violationsByType[event.type] || 0) + 1;

    // Emit event for real-time monitoring
    this.emit('security-event', fullEvent);

    // Log to file for persistence
    await this.appendToFile(this.securityLogPath, fullEvent);

    // Log critical events
    if (event.severity === 'critical') {
      logger.error('Critical security event in sandbox', fullEvent);
    }
  }

  /**
   * Log an audit event
   */
  async logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditLog = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    // Add to in-memory buffer
    this.auditLogs.push(fullEvent);
    if (this.auditLogs.length > this.maxEventsInMemory) {
      this.auditLogs.shift();
    }

    // Emit event for real-time monitoring
    this.emit('audit-event', fullEvent);

    // Log to file for persistence
    await this.appendToFile(this.auditLogPath, fullEvent);
  }

  /**
   * Record execution start
   */
  async recordExecutionStart(
    sandboxId: string,
    options: SandboxOptions,
    userId?: number,
    projectId?: number
  ): Promise<void> {
    this.metrics.totalExecutions++;
    this.metrics.executionsByLanguage[options.language] = 
      (this.metrics.executionsByLanguage[options.language] || 0) + 1;

    await this.logAuditEvent({
      action: 'execute_code',
      actor: {
        type: 'user',
        id: userId
      },
      target: {
        type: 'sandbox',
        id: sandboxId
      },
      result: 'success',
      details: {
        language: options.language,
        securityPolicy: options.securityPolicy,
        timeout: options.timeout,
        projectId
      }
    });
  }

  /**
   * Record execution end
   */
  async recordExecutionEnd(
    sandboxId: string,
    executionTime: number,
    exitCode: number,
    error?: string,
    userId?: number,
    projectId?: number
  ): Promise<void> {
    if (exitCode === 0 && !error) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * 
      (this.metrics.totalExecutions - 1) + executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;

    await this.logSecurityEvent({
      type: 'execution_end',
      severity: 'low',
      sandboxId,
      userId,
      projectId,
      details: {
        executionTime,
        exitCode,
        error
      }
    });
  }

  /**
   * Record resource usage
   */
  async recordResourceUsage(
    sandboxId: string,
    resources: {
      cpuTime: number;
      memoryPeak: number;
      diskIO: number;
      networkIO: number;
    }
  ): Promise<void> {
    this.metrics.resourceUsage.cpuTime += resources.cpuTime;
    this.metrics.resourceUsage.memoryPeak = 
      Math.max(this.metrics.resourceUsage.memoryPeak, resources.memoryPeak);
    this.metrics.resourceUsage.diskIO += resources.diskIO;
    this.metrics.resourceUsage.networkIO += resources.networkIO;
  }

  /**
   * Get recent security events
   */
  getRecentSecurityEvents(
    limit: number = 100,
    severity?: SecurityEvent['severity'],
    type?: SecurityEvent['type']
  ): SecurityEvent[] {
    let events = [...this.events].reverse();
    
    if (severity) {
      events = events.filter(e => e.severity === severity);
    }
    
    if (type) {
      events = events.filter(e => e.type === type);
    }
    
    return events.slice(0, limit);
  }

  /**
   * Get recent audit logs
   */
  getRecentAuditLogs(
    limit: number = 100,
    action?: AuditLog['action'],
    actorId?: number
  ): AuditLog[] {
    let logs = [...this.auditLogs].reverse();
    
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    
    if (actorId !== undefined) {
      logs = logs.filter(l => l.actor.id === actorId);
    }
    
    return logs.slice(0, limit);
  }

  /**
   * Get current metrics
   */
  getMetrics(): SandboxMetrics {
    return { ...this.metrics };
  }

  /**
   * Get security report
   */
  async getSecurityReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      totalEvents: number;
      criticalEvents: number;
      highEvents: number;
      mediumEvents: number;
      lowEvents: number;
    };
    topViolations: Array<{ type: string; count: number }>;
    timeline: Array<{ date: string; count: number }>;
    recommendations: string[];
  }> {
    const events = this.events.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );

    const summary = {
      totalEvents: events.length,
      criticalEvents: events.filter(e => e.severity === 'critical').length,
      highEvents: events.filter(e => e.severity === 'high').length,
      mediumEvents: events.filter(e => e.severity === 'medium').length,
      lowEvents: events.filter(e => e.severity === 'low').length
    };

    // Count violations by type
    const violationCounts: Record<string, number> = {};
    events.forEach(e => {
      violationCounts[e.type] = (violationCounts[e.type] || 0) + 1;
    });

    const topViolations = Object.entries(violationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    // Group by date for timeline
    const timeline: Record<string, number> = {};
    events.forEach(e => {
      const date = e.timestamp.toISOString().split('T')[0];
      timeline[date] = (timeline[date] || 0) + 1;
    });

    const timelineArray = Object.entries(timeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Generate recommendations based on data
    const recommendations: string[] = [];
    
    if (summary.criticalEvents > 0) {
      recommendations.push(
        'Critical security events detected. Review sandbox escape attempts and strengthen isolation.'
      );
    }
    
    if (violationCounts['syscall_violation'] > 10) {
      recommendations.push(
        'High number of syscall violations. Consider reviewing and adjusting seccomp filters.'
      );
    }
    
    if (violationCounts['resource_limit'] > 20) {
      recommendations.push(
        'Frequent resource limit violations. Consider adjusting resource quotas or investigating resource-intensive code.'
      );
    }

    return {
      summary,
      topViolations,
      timeline: timelineArray,
      recommendations
    };
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const logs = this.auditLogs.filter(
      l => l.timestamp >= startDate && l.timestamp <= endDate
    );

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      // CSV format
      const headers = [
        'ID', 'Timestamp', 'Action', 'Actor Type', 'Actor ID', 
        'Target Type', 'Target ID', 'Result', 'Details'
      ];
      
      const rows = logs.map(log => [
        log.id,
        log.timestamp.toISOString(),
        log.action,
        log.actor.type,
        log.actor.id || '',
        log.target.type,
        log.target.id || '',
        log.result,
        JSON.stringify(log.details)
      ]);

      return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Remove old events from memory
    this.events = this.events.filter(e => e.timestamp > cutoffDate);
    this.auditLogs = this.auditLogs.filter(l => l.timestamp > cutoffDate);

    // Archive old log files
    await this.archiveOldLogFiles(cutoffDate);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${process.hrtime.bigint().toString(36).slice(0, 9)}`;
  }

  /**
   * Append event to log file
   */
  private async appendToFile(filePath: string, event: any): Promise<void> {
    try {
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filePath, line, 'utf-8');
    } catch (error) {
      logger.error(`Failed to write to log file ${filePath}`, error);
    }
  }

  /**
   * Persist metrics to file
   */
  private async persistMetrics(): Promise<void> {
    try {
      const metricsPath = path.join(
        path.dirname(this.auditLogPath), 
        'metrics.json'
      );
      await fs.writeFile(
        metricsPath, 
        JSON.stringify(this.metrics, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to persist metrics', error);
    }
  }

  /**
   * Archive old log files
   */
  private async archiveOldLogFiles(cutoffDate: Date): Promise<void> {
    // Implementation for archiving old log files
    // This would typically involve reading log files, filtering by date,
    // and moving old entries to archive files
  }

  /**
   * Destroy monitor and clean up
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.removeAllListeners();
  }
}

// Global sandbox monitor instance
export const sandboxMonitor = new SandboxMonitor();