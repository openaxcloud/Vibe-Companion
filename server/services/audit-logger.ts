// @ts-nocheck
/**
 * Audit Logger Service
 * Comprehensive security event logging and monitoring
 */

import { db } from '../db';
import { securityLogs } from '../../shared/schema';
import { and, eq, gte } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('audit-logger');

export class AuditLogger {
  private blockedIPs = new Map<string, number>();
  private alertThreshold = 10; // Failed attempts before alerting
  private blockDuration = 3600000; // 1 hour block
  
  /**
   * Log security event
   */
  async logSecurityEvent(event: {
    userId?: number;
    ip: string;
    action: string;
    resource?: string;
    result: 'success' | 'failure';
    metadata?: any;
  }): Promise<void> {
    try {
      const log = {
        timestamp: new Date(),
        userId: event.userId || null,
        ip: event.ip,
        action: event.action,
        resource: event.resource || null,
        result: event.result,
        userAgent: event.metadata?.userAgent || null,
        sessionId: event.metadata?.sessionId || null,
        statusCode: event.metadata?.statusCode || null,
        duration: event.metadata?.duration || null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      };
      
      // Store in database
      await db.insert(securityLogs).values(log);
      
      // Check for suspicious activity
      if (event.result === 'failure') {
        await this.checkForAttackPatterns(event);
      }
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Security event logged', { event });
      }
    } catch (error) {
      logger.error('Failed to log security event', { error, event });
    }
  }
  
  /**
   * Check for attack patterns
   */
  async checkForAttackPatterns(event: any): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000);
      
      // Get recent failures from this IP
      const recentFailures = await db
        .select()
        .from(securityLogs)
        .where(
          and(
            eq(securityLogs.ip, event.ip),
            eq(securityLogs.result, 'failure'),
            gte(securityLogs.timestamp, oneHourAgo)
          )
        );
      
      if (recentFailures.length >= this.alertThreshold) {
        // Block IP temporarily
        await this.blockIP(event.ip);
        
        // Send alert
        await this.sendSecurityAlert({
          type: 'potential_attack',
          ip: event.ip,
          failureCount: recentFailures.length,
          lastAction: event.action,
          timestamp: new Date()
        });
        
        logger.warn('Potential attack detected', {
          ip: event.ip,
          failures: recentFailures.length,
          action: event.action
        });
      }
      
      // Check for specific attack patterns
      await this.detectSpecificPatterns(event, recentFailures);
    } catch (error) {
      logger.error('Failed to check attack patterns', { error });
    }
  }
  
  /**
   * Detect specific attack patterns
   */
  async detectSpecificPatterns(event: any, recentFailures: any[]): Promise<void> {
    // SQL injection attempt detection
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b)/i,
      /(\bOR\b\s*\d+\s*=\s*\d+)/i,
      /(--|\*|;|'|")/
    ];
    
    const hasSQLPattern = sqlPatterns.some(pattern => 
      pattern.test(event.resource || '') || 
      pattern.test(JSON.stringify(event.metadata || {}))
    );
    
    if (hasSQLPattern) {
      await this.sendSecurityAlert({
        type: 'sql_injection_attempt',
        ip: event.ip,
        action: event.action,
        resource: event.resource,
        timestamp: new Date()
      });
    }
    
    // XSS attempt detection
    const xssPatterns = [
      /<script[\s\S]*?>/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];
    
    const hasXSSPattern = xssPatterns.some(pattern => 
      pattern.test(event.resource || '') || 
      pattern.test(JSON.stringify(event.metadata || {}))
    );
    
    if (hasXSSPattern) {
      await this.sendSecurityAlert({
        type: 'xss_attempt',
        ip: event.ip,
        action: event.action,
        resource: event.resource,
        timestamp: new Date()
      });
    }
    
    // Brute force detection
    const authFailures = recentFailures.filter(f => 
      f.action.includes('login') || f.action.includes('auth')
    );
    
    if (authFailures.length >= 5) {
      await this.sendSecurityAlert({
        type: 'brute_force_attempt',
        ip: event.ip,
        attempts: authFailures.length,
        timestamp: new Date()
      });
    }
    
    // Path traversal detection
    if (event.resource && (event.resource.includes('..') || event.resource.includes('//'))) {
      await this.sendSecurityAlert({
        type: 'path_traversal_attempt',
        ip: event.ip,
        resource: event.resource,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Block IP address temporarily
   */
  async blockIP(ip: string): Promise<void> {
    this.blockedIPs.set(ip, Date.now() + this.blockDuration);
    
    // Schedule unblock
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info('IP unblocked', { ip });
    }, this.blockDuration);
    
    logger.warn('IP blocked', { ip, duration: this.blockDuration });
  }
  
  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    const blockExpiry = this.blockedIPs.get(ip);
    
    if (!blockExpiry) {
      return false;
    }
    
    if (blockExpiry < Date.now()) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }
  
  /**
   * Send security alert
   */
  async sendSecurityAlert(alert: any): Promise<void> {
    try {
      // Log the alert
      logger.error('SECURITY ALERT', alert);
      
      // In production, you would send alerts via email, Slack, etc.
      if (process.env.NODE_ENV === 'production') {
        // Send to monitoring service
        if (process.env.SECURITY_ALERT_WEBHOOK) {
          await fetch(process.env.SECURITY_ALERT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `Security Alert: ${alert.type}`,
              alert
            })
          });
        }
        
        // Send email alert
        if (process.env.SECURITY_ALERT_EMAIL) {
          // Implement email sending
          // await emailService.send({
          //   to: process.env.SECURITY_ALERT_EMAIL,
          //   subject: `Security Alert: ${alert.type}`,
          //   body: JSON.stringify(alert, null, 2)
          // });
        }
      }
    } catch (error) {
      logger.error('Failed to send security alert', { error, alert });
    }
  }
  
  /**
   * Get security statistics
   */
  async getSecurityStats(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - (hours * 3600000));
    
    const logs = await db
      .select()
      .from(securityLogs)
      .where(gte(securityLogs.timestamp, since));
    
    const stats = {
      totalEvents: logs.length,
      failures: logs.filter(l => l.result === 'failure').length,
      successes: logs.filter(l => l.result === 'success').length,
      uniqueIPs: new Set(logs.map(l => l.ip)).size,
      blockedIPs: this.blockedIPs.size,
      topActions: this.getTopActions(logs),
      failuresByIP: this.getFailuresByIP(logs),
      timeRange: { from: since, to: new Date() }
    };
    
    return stats;
  }
  
  /**
   * Get top actions from logs
   */
  private getTopActions(logs: any[]): any[] {
    const actionCounts = new Map<string, number>();
    
    for (const log of logs) {
      const count = actionCounts.get(log.action) || 0;
      actionCounts.set(log.action, count + 1);
    }
    
    return Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));
  }
  
  /**
   * Get failures grouped by IP
   */
  private getFailuresByIP(logs: any[]): any[] {
    const failures = logs.filter(l => l.result === 'failure');
    const ipCounts = new Map<string, number>();
    
    for (const log of failures) {
      const count = ipCounts.get(log.ip) || 0;
      ipCounts.set(log.ip, count + 1);
    }
    
    return Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }
  
  /**
   * Clean old logs
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 3600000));
    
    try {
      const result = await db
        .delete(securityLogs)
        .where(gte(cutoffDate, securityLogs.timestamp));
      
      logger.info('Old security logs cleaned', { 
        cutoffDate,
        daysToKeep
      });
    } catch (error) {
      logger.error('Failed to clean old logs', { error });
    }
  }
  
  /**
   * Middleware to block blacklisted IPs
   */
  blockMiddleware() {
    return (req: any, res: any, next: any) => {
      if (this.isIPBlocked(req.ip)) {
        logger.warn('Blocked IP attempted access', { 
          ip: req.ip,
          path: req.path 
        });
        
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Your IP has been temporarily blocked due to suspicious activity'
        });
      }
      
      next();
    };
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Schedule periodic cleanup
setInterval(() => {
  auditLogger.cleanOldLogs();
}, 24 * 3600000); // Daily cleanup