// @ts-nocheck
/**
 * Security Monitoring Service
 * Real-time threat detection and response system
 */

import { EventEmitter } from 'events';
import { Request } from 'express';
import { db } from '../db';
import { securityEvents, alerts, auditLogs } from '@shared/schema';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';

const logger = createLogger('security-monitoring');

/**
 * Security Event Types
 */
enum SecurityEventType {
  FAILED_LOGIN = 'failed_login',
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  PATH_TRAVERSAL = 'path_traversal',
  CSRF_ATTEMPT = 'csrf_attempt',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  MALWARE_DETECTED = 'malware_detected',
  DOS_ATTACK = 'dos_attack',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
}

/**
 * Alert Severity Levels
 */
enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Threat Intelligence
 */
class ThreatIntelligence {
  private knownBadIps = new Set<string>();
  private knownBadUserAgents = new Set<string>([
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'metasploit',
    'burpsuite',
  ]);
  private suspiciousPatterns = {
    sql: [
      /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
      /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
      /'.*--/g,
      /\bwaitfor\s+delay/gi,
    ],
    xss: [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /document\.(cookie|write|location)/gi,
      /eval\s*\(/gi,
    ],
    pathTraversal: [
      /\.\.\//g,
      /\.\.\\/, 
      /%2e%2e/gi,
      /%252e%252e/gi,
      /\/etc\/(passwd|shadow)/gi,
    ],
    commandInjection: [
      /;\s*(ls|cat|pwd|whoami|id|uname)/gi,
      /\|\s*(ls|cat|pwd|whoami|id|uname)/gi,
      /`.*`/g,
      /\$\(.*\)/g,
    ],
  };

  isKnownThreat(ip: string, userAgent: string): boolean {
    if (this.knownBadIps.has(ip)) {
      return true;
    }

    const lowerUserAgent = userAgent.toLowerCase();
    for (const badAgent of this.knownBadUserAgents) {
      if (lowerUserAgent.includes(badAgent)) {
        return true;
      }
    }

    return false;
  }

  detectAttackPatterns(input: string): { type: SecurityEventType; pattern: string }[] {
    const detections: { type: SecurityEventType; pattern: string }[] = [];

    // Check SQL injection patterns
    for (const pattern of this.suspiciousPatterns.sql) {
      if (pattern.test(input)) {
        detections.push({
          type: SecurityEventType.SQL_INJECTION,
          pattern: pattern.source,
        });
      }
    }

    // Check XSS patterns
    for (const pattern of this.suspiciousPatterns.xss) {
      if (pattern.test(input)) {
        detections.push({
          type: SecurityEventType.XSS_ATTEMPT,
          pattern: pattern.source,
        });
      }
    }

    // Check path traversal patterns
    for (const pattern of this.suspiciousPatterns.pathTraversal) {
      if (pattern.test(input)) {
        detections.push({
          type: SecurityEventType.PATH_TRAVERSAL,
          pattern: pattern.source,
        });
      }
    }

    return detections;
  }

  addThreatIp(ip: string): void {
    this.knownBadIps.add(ip);
  }
}

/**
 * Anomaly Detector
 */
class AnomalyDetector {
  private requestHistory = new Map<string, {
    count: number;
    lastRequest: Date;
    endpoints: Set<string>;
  }>();

  private normalBehavior = {
    maxRequestsPerMinute: 60,
    maxEndpointsPerMinute: 20,
    maxFailedLoginsPerHour: 5,
  };

  detectAnomalies(ip: string, endpoint: string): string[] {
    const anomalies: string[] = [];
    const now = new Date();
    
    const history = this.requestHistory.get(ip) || {
      count: 0,
      lastRequest: now,
      endpoints: new Set(),
    };

    const timeDiff = now.getTime() - history.lastRequest.getTime();
    const minutesPassed = timeDiff / 60000;

    // Update history
    history.count++;
    history.endpoints.add(endpoint);
    history.lastRequest = now;
    this.requestHistory.set(ip, history);

    // Check request rate
    if (minutesPassed < 1 && history.count > this.normalBehavior.maxRequestsPerMinute) {
      anomalies.push(`High request rate: ${history.count} requests in ${minutesPassed.toFixed(2)} minutes`);
    }

    // Check endpoint scanning
    if (minutesPassed < 1 && history.endpoints.size > this.normalBehavior.maxEndpointsPerMinute) {
      anomalies.push(`Endpoint scanning: ${history.endpoints.size} different endpoints`);
    }

    return anomalies;
  }

  reset(): void {
    // Clear old entries
    const now = new Date();
    for (const [ip, history] of this.requestHistory.entries()) {
      if (now.getTime() - history.lastRequest.getTime() > 3600000) { // 1 hour
        this.requestHistory.delete(ip);
      }
    }
  }
}

/**
 * Security Monitoring Service
 */
class SecurityMonitoringService extends EventEmitter {
  private threatIntelligence = new ThreatIntelligence();
  private anomalyDetector = new AnomalyDetector();
  private activeAlerts = new Map<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
  }>();

  /**
   * Monitor incoming request
   */
  async monitorRequest(req: Request): Promise<void> {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const endpoint = req.path;
    const method = req.method;
    
    const requestData = `${endpoint} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;

    // Check known threats
    if (this.threatIntelligence.isKnownThreat(ip, userAgent)) {
      await this.createSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: AlertSeverity.HIGH,
        source: ip,
        description: 'Request from known malicious source',
        metadata: { userAgent, endpoint, method },
      });
      
      this.emit('threat-detected', { ip, userAgent, endpoint });
    }

    // Detect attack patterns
    const attacks = this.threatIntelligence.detectAttackPatterns(requestData);
    for (const attack of attacks) {
      await this.createSecurityEvent({
        type: attack.type,
        severity: AlertSeverity.MEDIUM,
        source: ip,
        description: `Attack pattern detected: ${attack.pattern}`,
        metadata: { userAgent, endpoint, method, pattern: attack.pattern },
      });
    }

    // Detect anomalies
    const anomalies = this.anomalyDetector.detectAnomalies(ip, endpoint);
    for (const anomaly of anomalies) {
      await this.createSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: AlertSeverity.LOW,
        source: ip,
        description: anomaly,
        metadata: { userAgent, endpoint, method },
      });
    }
  }

  /**
   * Monitor failed login attempts
   */
  async monitorFailedLogin(username: string, ip: string): Promise<void> {
    const key = `login_${username}_${ip}`;
    const alert = this.activeAlerts.get(key) || {
      count: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
    };

    alert.count++;
    alert.lastSeen = new Date();
    this.activeAlerts.set(key, alert);

    // Check for brute force
    if (alert.count >= 5) {
      await this.createSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE,
        severity: AlertSeverity.HIGH,
        source: ip,
        description: `Brute force attempt detected: ${alert.count} failed logins for ${username}`,
        metadata: { username, attempts: alert.count },
      });

      // Add to threat intelligence
      if (alert.count >= 10) {
        this.threatIntelligence.addThreatIp(ip);
      }

      this.emit('brute-force', { username, ip, attempts: alert.count });
    }
  }

  /**
   * Monitor data access
   */
  async monitorDataAccess(userId: string, resource: string, action: string): Promise<void> {
    await this.createAuditLog({
      userId,
      action,
      resource,
      timestamp: new Date(),
      metadata: {},
    });

    // Check for suspicious data access patterns
    const key = `data_${userId}`;
    const alert = this.activeAlerts.get(key) || {
      count: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
    };

    alert.count++;
    alert.lastSeen = new Date();
    this.activeAlerts.set(key, alert);

    // Alert on excessive data access
    if (alert.count > 100 && 
        alert.lastSeen.getTime() - alert.firstSeen.getTime() < 60000) {
      await this.createSecurityEvent({
        type: SecurityEventType.DATA_BREACH_ATTEMPT,
        severity: AlertSeverity.CRITICAL,
        source: userId,
        description: `Potential data breach: ${alert.count} data accesses in 1 minute`,
        metadata: { resource, action },
      });

      this.emit('data-breach-attempt', { userId, count: alert.count });
    }
  }

  /**
   * Create security event
   */
  private async createSecurityEvent(event: {
    type: SecurityEventType;
    severity: AlertSeverity;
    source: string;
    description: string;
    metadata: any;
  }): Promise<void> {
    try {
      // Store in database
      await db.insert(securityEvents).values({
        id: crypto.randomUUID(),
        type: event.type,
        severity: event.severity,
        source: event.source,
        description: event.description,
        metadata: event.metadata,
        timestamp: new Date(),
      });

      // Create alert for high severity events
      if (event.severity === AlertSeverity.HIGH || event.severity === AlertSeverity.CRITICAL) {
        await this.createAlert(event);
      }

      logger.warn('Security event detected', event);
    } catch (error) {
      logger.error('Failed to create security event', error);
    }
  }

  /**
   * Create alert
   */
  private async createAlert(event: any): Promise<void> {
    try {
      await db.insert(alerts).values({
        id: crypto.randomUUID(),
        type: event.type,
        severity: event.severity,
        message: event.description,
        status: 'active',
        triggeredAt: new Date(),
      });

      // Trigger automated response
      this.triggerAutomatedResponse(event);

      // Send notifications (email, Slack, etc.)
      this.sendAlertNotification(event);
    } catch (error) {
      logger.error('Failed to create alert', error);
    }
  }

  /**
   * Create audit log
   */
  private async createAuditLog(log: {
    userId: string;
    action: string;
    resource: string;
    timestamp: Date;
    metadata: any;
  }): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        ...log,
      });
    } catch (error) {
      logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Trigger automated response
   */
  private triggerAutomatedResponse(event: any): void {
    switch (event.type) {
      case SecurityEventType.BRUTE_FORCE:
        // Block IP address
        this.emit('block-ip', { ip: event.source, duration: 3600000 });
        break;

      case SecurityEventType.DATA_BREACH_ATTEMPT:
        // Revoke user access
        this.emit('revoke-access', { userId: event.source });
        break;

      case SecurityEventType.MALWARE_DETECTED:
        // Quarantine file
        this.emit('quarantine-file', event.metadata);
        break;

      case SecurityEventType.DOS_ATTACK:
        // Enable DDoS protection
        this.emit('enable-ddos-protection', {});
        break;

      default:
        logger.info('No automated response for event type', { type: event.type });
    }
  }

  /**
   * Send alert notification
   */
  private sendAlertNotification(event: any): void {
    // In production, integrate with notification services
    logger.critical('SECURITY ALERT', {
      type: event.type,
      severity: event.severity,
      description: event.description,
      timestamp: new Date(),
    });

    // Email notification
    this.emit('send-email', {
      to: process.env.SECURITY_TEAM_EMAIL,
      subject: `[${event.severity.toUpperCase()}] Security Alert: ${event.type}`,
      body: JSON.stringify(event, null, 2),
    });

    // Slack notification
    this.emit('send-slack', {
      channel: process.env.SECURITY_SLACK_CHANNEL,
      message: `🚨 *Security Alert*\nType: ${event.type}\nSeverity: ${event.severity}\nDescription: ${event.description}`,
    });
  }

  /**
   * Get security dashboard data
   */
  async getDashboardData(): Promise<any> {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    try {
      // Get recent events
      const recentEvents = await db
        .select()
        .from(securityEvents)
        .where(gte(securityEvents.timestamp, oneHourAgo))
        .orderBy(sql`${securityEvents.timestamp} DESC`)
        .limit(100);

      // Get active alerts
      const activeAlerts = await db
        .select()
        .from(alerts)
        .where(eq(alerts.status, 'active'))
        .orderBy(sql`${alerts.triggeredAt} DESC`)
        .limit(50);

      // Calculate statistics
      const stats = {
        eventsLastHour: recentEvents.length,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
        topThreats: this.getTopThreats(recentEvents),
      };

      return {
        stats,
        recentEvents: recentEvents.slice(0, 10),
        activeAlerts: activeAlerts.slice(0, 10),
      };
    } catch (error) {
      logger.error('Failed to get dashboard data', error);
      return {
        stats: {},
        recentEvents: [],
        activeAlerts: [],
      };
    }
  }

  /**
   * Get top threats
   */
  private getTopThreats(events: any[]): any[] {
    const threats = new Map<string, number>();

    for (const event of events) {
      const count = threats.get(event.type) || 0;
      threats.set(event.type, count + 1);
    }

    return Array.from(threats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    try {
      // Clean old events
      await db
        .delete(securityEvents)
        .where(lte(securityEvents.timestamp, thirtyDaysAgo));

      // Clean old audit logs
      await db
        .delete(auditLogs)
        .where(lte(auditLogs.timestamp, thirtyDaysAgo));

      // Reset anomaly detector
      this.anomalyDetector.reset();

      // Clear old alerts from memory
      const now = new Date();
      for (const [key, alert] of this.activeAlerts.entries()) {
        if (now.getTime() - alert.lastSeen.getTime() > 3600000) {
          this.activeAlerts.delete(key);
        }
      }

      logger.info('Security monitoring cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed', error);
    }
  }
}

// Create singleton instance
export const securityMonitoring = new SecurityMonitoringService();

// Schedule cleanup
setInterval(() => securityMonitoring.cleanup(), 24 * 60 * 60 * 1000);

export default securityMonitoring;