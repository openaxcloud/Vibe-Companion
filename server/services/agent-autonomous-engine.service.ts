// @ts-nocheck
/**
 * Autonomous Engine Service
 * 
 * Enables AI agent to work autonomously without constant approval by:
 * 1. Risk scoring every action (0-100 scale)
 * 2. Auto-approving low-risk actions based on threshold
 * 3. Requiring human approval for high-risk actions
 * 4. Providing rollback capabilities for all actions
 * 
 * This is a core Phase 1 feature for achieving Replit AI Agent V3 parity.
 */

import { EventEmitter } from 'events';
import { db } from '../db';
import {
  agentSessions,
  autonomousActions,
  agentAuditTrail,
  type RiskThreshold
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('AutonomousEngine');

// Risk scoring weights for different action types
const RISK_WEIGHTS = {
  // File operations
  file_read: 5,
  file_write_new: 15,
  file_write_existing: 25,
  file_delete: 60,
  file_rename: 20,
  
  // Command execution
  command_read_only: 10,
  command_write: 40,
  command_system: 70,
  command_network: 35,
  
  // Database operations
  database_select: 10,
  database_insert: 30,
  database_update: 40,
  database_delete: 70,
  database_schema: 85,
  
  // Tool execution
  tool_safe: 15,
  tool_moderate: 35,
  tool_risky: 65,
  
  // Special operations
  deployment: 80,
  credentials: 95,
  system_config: 90,
};

// Risk threshold mappings (min score required for human approval)
const RISK_THRESHOLDS: Record<RiskThreshold, number> = {
  low: 80,      // Only ultra-risky actions need approval
  medium: 50,   // Balanced - moderate+ risk needs approval
  high: 30,     // Conservative - most actions need approval
  critical: 10  // Paranoid - almost everything needs approval
};

export interface RiskAssessment {
  score: number; // 0-100
  factors: {
    fileModification?: boolean;
    commandExecution?: boolean;
    networkAccess?: boolean;
    databaseAccess?: boolean;
    systemChange?: boolean;
    impact?: string;
  };
  autoApprove: boolean;
  reasoning: string;
}

export interface AutonomousAction {
  id: string;
  sessionId: string;
  actionType: string;
  actionData: Record<string, any>;
  riskAssessment: RiskAssessment;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  rollbackData?: Record<string, any>;
}

export class AutonomousEngineService extends EventEmitter {
  
  /**
   * Assess the risk of an action
   */
  async assessRisk(actionType: string, actionData: Record<string, any>): Promise<RiskAssessment> {
    let score = 0;
    const factors: RiskAssessment['factors'] = {};
    const reasons: string[] = [];
    
    // File operations risk assessment
    if (actionType.startsWith('file_')) {
      factors.fileModification = true;
      
      if (actionType === 'file_delete') {
        score += RISK_WEIGHTS.file_delete;
        reasons.push('Deleting files is high-risk');
      } else if (actionType === 'file_write' || actionType === 'write_file') {
        // Check if file exists
        const isNew = !actionData.previousContent;
        score += isNew ? RISK_WEIGHTS.file_write_new : RISK_WEIGHTS.file_write_existing;
        reasons.push(isNew ? 'Creating new file' : 'Modifying existing file');
        
        // Check for sensitive files
        const path = actionData.path || '';
        if (this.isSensitiveFile(path)) {
          score += 30;
          reasons.push('Modifying sensitive file');
        }
      } else if (actionType === 'file_read' || actionType === 'read_file') {
        score += RISK_WEIGHTS.file_read;
      }
    }
    
    // Command execution risk assessment
    if (actionType.startsWith('command_') || actionType === 'run_command') {
      factors.commandExecution = true;
      const command = actionData.command || '';
      
      if (this.isSystemCommand(command)) {
        score += RISK_WEIGHTS.command_system;
        factors.systemChange = true;
        reasons.push('System-level command');
      } else if (this.isNetworkCommand(command)) {
        score += RISK_WEIGHTS.command_network;
        factors.networkAccess = true;
        reasons.push('Network operation');
      } else if (this.isWriteCommand(command)) {
        score += RISK_WEIGHTS.command_write;
        reasons.push('Command modifies state');
      } else {
        score += RISK_WEIGHTS.command_read_only;
        reasons.push('Read-only command');
      }
    }
    
    // Database operations risk assessment
    if (actionType.startsWith('database_') || actionType.includes('db_')) {
      factors.databaseAccess = true;
      
      if (actionType.includes('delete') || actionType.includes('drop')) {
        score += RISK_WEIGHTS.database_delete;
        reasons.push('Database deletion operation');
      } else if (actionType.includes('schema') || actionType.includes('migration')) {
        score += RISK_WEIGHTS.database_schema;
        factors.systemChange = true;
        reasons.push('Database schema modification');
      } else if (actionType.includes('update')) {
        score += RISK_WEIGHTS.database_update;
        reasons.push('Database update operation');
      } else if (actionType.includes('insert')) {
        score += RISK_WEIGHTS.database_insert;
        reasons.push('Database insert operation');
      } else {
        score += RISK_WEIGHTS.database_select;
        reasons.push('Database read operation');
      }
    }
    
    // Tool execution risk assessment
    if (actionType === 'tool_call' || actionType === 'execute_tool') {
      const toolName = actionData.toolName || actionData.name || '';
      const toolRisk = this.assessToolRisk(toolName);
      score += toolRisk;
      reasons.push(`Tool: ${toolName} (risk: ${toolRisk})`);
    }
    
    // Special high-risk operations
    if (actionType === 'deploy' || actionType === 'deployment') {
      score += RISK_WEIGHTS.deployment;
      reasons.push('Deployment operation');
    }
    
    if (actionType.includes('credential') || actionType.includes('secret') || actionType.includes('password')) {
      score += RISK_WEIGHTS.credentials;
      factors.systemChange = true;
      reasons.push('Credentials/secrets management');
    }
    
    // Cap score at 100
    score = Math.min(score, 100);
    
    // Determine impact level
    let impact = 'low';
    if (score >= 70) impact = 'critical';
    else if (score >= 50) impact = 'high';
    else if (score >= 30) impact = 'medium';
    
    factors.impact = impact;
    
    return {
      score,
      factors,
      autoApprove: false, // Will be determined by threshold
      reasoning: reasons.join('; ')
    };
  }
  
  /**
   * Determine if action can be auto-approved based on risk threshold
   */
  async canAutoApprove(
    sessionId: string,
    riskScore: number
  ): Promise<boolean> {
    try {
      // Get session settings
      const session = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, sessionId))
        .limit(1)
        .then(rows => rows[0]);
      
      if (!session) {
        logger.warn(`Session not found: ${sessionId}`);
        return false;
      }
      
      // Check if autonomous mode is enabled
      if (!session.autonomousMode) {
        return false;
      }
      
      // Get risk threshold
      const threshold = session.riskThreshold || 'medium';
      const minScoreForApproval = RISK_THRESHOLDS[threshold];
      
      // Auto-approve if risk score is below threshold
      const autoApprove = riskScore < minScoreForApproval;
      
      logger.info(`Risk assessment for session ${sessionId}: score=${riskScore}, threshold=${threshold} (${minScoreForApproval}), autoApprove=${autoApprove}`);
      
      return autoApprove;
    } catch (error) {
      logger.error('Error checking auto-approval:', error);
      return false; // Fail safe - require approval on error
    }
  }
  
  /**
   * Execute an autonomous action with risk assessment
   */
  async executeAction(
    sessionId: string,
    actionType: string,
    actionData: Record<string, any>,
    userId: string
  ): Promise<AutonomousAction> {
    try {
      // Assess risk
      const riskAssessment = await this.assessRisk(actionType, actionData);
      const canAutoApprove = await this.canAutoApprove(sessionId, riskAssessment.score);
      riskAssessment.autoApprove = canAutoApprove;
      
      // Create autonomous action record
      const [action] = await db
        .insert(autonomousActions)
        .values({
          sessionId,
          actionType,
          actionData,
          riskScore: riskAssessment.score,
          riskFactors: riskAssessment.factors,
          autoApproved: canAutoApprove,
          approvalRequired: !canAutoApprove,
          status: canAutoApprove ? 'pending' : 'pending', // Will be 'in_progress' when executed
          rollbackData: this.generateRollbackData(actionType, actionData)
        })
        .returning();
      
      // Log to audit trail
      await db.insert(agentAuditTrail).values({
        sessionId,
        userId,
        action: actionType,
        resourceType: this.getResourceType(actionType),
        resourceId: this.getResourceId(actionData),
        details: {
          actionData,
          riskScore: riskAssessment.score,
          autoApproved: canAutoApprove,
          reasoning: riskAssessment.reasoning
        },
        riskScore: riskAssessment.score,
        autoApproved: canAutoApprove,
        rollbackAvailable: true,
        severity: riskAssessment.score >= 70 ? 'critical' : riskAssessment.score >= 50 ? 'error' : 'info'
      });
      
      // Emit event for real-time UI updates
      this.emit('action_created', {
        actionId: action.id,
        sessionId,
        actionType,
        riskScore: riskAssessment.score,
        autoApproved: canAutoApprove
      });
      
      return {
        id: action.id,
        sessionId,
        actionType,
        actionData,
        riskAssessment,
        status: 'pending',
        rollbackData: action.rollbackData || undefined
      };
    } catch (error) {
      logger.error('Error executing autonomous action:', error);
      throw error;
    }
  }
  
  /**
   * Enable autonomous mode for a session
   */
  async enableAutonomousMode(
    sessionId: string,
    riskThreshold: RiskThreshold = 'medium'
  ): Promise<void> {
    // Check if session exists
    const existingSession = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId))
      .limit(1);
    
    if (existingSession.length === 0) {
      // Session doesn't exist - this shouldn't happen normally
      // Sessions should be created when agent starts, not here
      logger.warn(`Session ${sessionId} not found, cannot enable autonomous mode`);
      throw new Error(`Session ${sessionId} does not exist. Please start an agent session first.`);
    } else {
      // Update existing session
      await db
        .update(agentSessions)
        .set({
          autonomousMode: true,
          riskThreshold,
          autoApproveActions: true
        })
        .where(eq(agentSessions.id, sessionId));
    }
    
    logger.info(`Autonomous mode enabled for session ${sessionId} with threshold: ${riskThreshold}`);
    this.emit('autonomous_mode_enabled', { sessionId, riskThreshold });
  }
  
  /**
   * Disable autonomous mode for a session
   */
  async disableAutonomousMode(sessionId: string): Promise<void> {
    await db
      .update(agentSessions)
      .set({
        autonomousMode: false,
        autoApproveActions: false
      })
      .where(eq(agentSessions.id, sessionId));
    
    logger.info(`Autonomous mode disabled for session ${sessionId}`);
    this.emit('autonomous_mode_disabled', { sessionId });
  }
  
  /**
   * Get autonomous actions for a session
   */
  async getAutonomousActions(sessionId: string, limit = 100): Promise<AutonomousAction[]> {
    const actions = await db
      .select()
      .from(autonomousActions)
      .where(eq(autonomousActions.sessionId, sessionId))
      .orderBy(desc(autonomousActions.executedAt))
      .limit(limit);
    
    return actions.map(action => ({
      id: action.id,
      sessionId: action.sessionId,
      actionType: action.actionType,
      actionData: action.actionData || {},
      riskAssessment: {
        score: action.riskScore,
        factors: action.riskFactors || {},
        autoApprove: action.autoApproved,
        reasoning: ''
      },
      status: action.status as any,
      result: action.result,
      error: action.error || undefined,
      rollbackData: action.rollbackData || undefined
    }));
  }
  
  // Helper methods
  
  private isSensitiveFile(path: string): boolean {
    const sensitivePatterns = [
      '.env',
      'config',
      'secret',
      'credential',
      'password',
      'private',
      'key',
      '.pem',
      '.cert',
      'database.ts',
      'db.ts'
    ];
    
    const lowerPath = path.toLowerCase();
    return sensitivePatterns.some(pattern => lowerPath.includes(pattern));
  }
  
  private isSystemCommand(command: string): boolean {
    const systemCommands = ['rm', 'rmdir', 'sudo', 'chmod', 'chown', 'kill', 'pkill', 'reboot', 'shutdown'];
    return systemCommands.some(cmd => command.trim().startsWith(cmd));
  }
  
  private isNetworkCommand(command: string): boolean {
    const networkCommands = ['curl', 'wget', 'nc', 'telnet', 'ssh', 'scp', 'ftp'];
    return networkCommands.some(cmd => command.includes(cmd));
  }
  
  private isWriteCommand(command: string): boolean {
    const writeCommands = ['npm install', 'yarn add', 'pip install', 'git commit', 'git push', 'docker run'];
    return writeCommands.some(cmd => command.includes(cmd));
  }
  
  private assessToolRisk(toolName: string): number {
    const safeTool = ['read_file', 'list_directory', 'search_codebase', 'get_file_info'].includes(toolName);
    const riskyTools = ['deploy', 'delete_file', 'run_command', 'execute_sql'].includes(toolName);
    
    if (safeTool) return RISK_WEIGHTS.tool_safe;
    if (riskyTools) return RISK_WEIGHTS.tool_risky;
    return RISK_WEIGHTS.tool_moderate;
  }
  
  private generateRollbackData(actionType: string, actionData: Record<string, any>): Record<string, any> {
    // Generate rollback information based on action type
    if (actionType.includes('file_write') || actionType === 'write_file') {
      return {
        path: actionData.path,
        previousContent: actionData.previousContent || null,
        action: 'restore_file'
      };
    }
    
    if (actionType.includes('file_delete') || actionType === 'delete_file') {
      return {
        path: actionData.path,
        content: actionData.content || '',
        action: 'restore_file'
      };
    }
    
    return {};
  }
  
  private getResourceType(actionType: string): string {
    if (actionType.startsWith('file_')) return 'file';
    if (actionType.startsWith('command_')) return 'command';
    if (actionType.startsWith('database_')) return 'database';
    if (actionType.startsWith('tool_')) return 'tool';
    return 'unknown';
  }
  
  private getResourceId(actionData: Record<string, any>): string | undefined {
    return actionData.path || actionData.id || actionData.name || undefined;
  }
}

// Singleton instance
export const autonomousEngine = new AutonomousEngineService();
