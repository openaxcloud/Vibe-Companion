// @ts-nocheck
/**
 * Agent Grid Data Service
 * Provides data aggregation and query capabilities for AG Grid components
 * Phase 2 - Agent Activity Dashboard
 * 
 * ALIGNED WITH ACTUAL SCHEMA (Nov 2025):
 * - agentSessions: id (varchar), userId, projectId, model, isActive, totalTokensUsed, totalOperations
 * - autonomousActions: id (varchar), sessionId, actionType (text), riskScore, status, autoApproved
 * - fileOperations: id (varchar), sessionId, operationType, filePath, status, content, previousContent
 * - agentMessages: id (varchar), sessionId, conversationId, role, content, model, metadata
 * 
 * SECURITY: All errors are propagated to caller for proper 500 responses
 */

import { db } from '../db';
import { 
  agentSessions, 
  autonomousActions, 
  fileOperations,
  agentMessages,
  aiConversations,
  users,
  projects
} from '@shared/schema';
import { eq, and, gte, lte, desc, asc, count, sql, isNotNull } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import type {
  AgentSessionRow,
  AgentActionRow,
  FileOperationRow,
  ConversationMessageRow,
  SessionsGridResponse,
  ActionsGridResponse,
  FileOperationsGridResponse,
  ConversationsGridResponse,
  MetricsDashboardResponse,
  AgentDashboardMetrics,
} from '@shared/types/agent-grid.types';

const logger = createLogger('agent-grid-data-service');

interface QueryParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  userId?: number;
  projectId?: number;
  sessionId?: string;
  status?: string;
  model?: string;
  startDate?: string;
  endDate?: string;
  operationType?: string;
  role?: string;
  searchQuery?: string;
}

interface ErrorResponse {
  error?: string;
}

class AgentGridDataService {
  // ============================================================================
  // Sessions Grid
  // ============================================================================

  async getSessions(params: QueryParams): Promise<SessionsGridResponse & ErrorResponse> {
    const { 
      page = 1, 
      pageSize = 25, 
      sortDirection = 'desc',
      userId,
      projectId,
      status,
      model,
      startDate,
      endDate
    } = params;
    
    const offset = (page - 1) * pageSize;

    try {
      const conditions = [];
      
      if (userId) {
        conditions.push(eq(agentSessions.userId, userId));
      }
      
      if (projectId) {
        conditions.push(eq(agentSessions.projectId, projectId));
      }
      
      if (status) {
        if (status === 'active') {
          conditions.push(eq(agentSessions.isActive, true));
        } else if (status === 'completed') {
          conditions.push(and(
            eq(agentSessions.isActive, false),
            isNotNull(agentSessions.endedAt)
          ));
        } else if (status === 'failed') {
          conditions.push(and(
            eq(agentSessions.isActive, false),
            sql`${agentSessions.metadata}->>'error' IS NOT NULL`
          ));
        }
      }
      
      if (model) {
        conditions.push(eq(agentSessions.model, model));
      }
      
      if (startDate) {
        conditions.push(gte(agentSessions.startedAt, new Date(startDate)));
      }
      
      if (endDate) {
        conditions.push(lte(agentSessions.startedAt, new Date(endDate)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, sessions] = await Promise.all([
        db.select({ count: count() }).from(agentSessions).where(whereClause),
        db.select({
          id: agentSessions.id,
          userId: agentSessions.userId,
          projectId: agentSessions.projectId,
          model: agentSessions.model,
          isActive: agentSessions.isActive,
          totalTokensUsed: agentSessions.totalTokensUsed,
          totalOperations: agentSessions.totalOperations,
          autonomousMode: agentSessions.autonomousMode,
          riskThreshold: agentSessions.riskThreshold,
          startedAt: agentSessions.startedAt,
          endedAt: agentSessions.endedAt,
          metadata: agentSessions.metadata,
          userName: users.displayName,
          projectName: projects.name,
        })
          .from(agentSessions)
          .leftJoin(users, eq(agentSessions.userId, users.id))
          .leftJoin(projects, eq(agentSessions.projectId, projects.id))
          .where(whereClause)
          .orderBy(sortDirection === 'asc' ? asc(agentSessions.startedAt) : desc(agentSessions.startedAt))
          .limit(pageSize)
          .offset(offset)
      ]);

      const totalCount = Number(countResult[0]?.count || 0);
      
      const rows: AgentSessionRow[] = sessions.map(session => {
        const duration = session.endedAt 
          ? new Date(session.endedAt).getTime() - new Date(session.startedAt!).getTime()
          : session.startedAt 
            ? Date.now() - new Date(session.startedAt).getTime()
            : 0;

        return {
          id: session.id,
          userId: session.userId,
          projectId: session.projectId,
          projectName: session.projectName || undefined,
          userName: session.userName || undefined,
          model: session.model,
          provider: (session.metadata as any)?.provider,
          status: session.isActive ? 'active' : (session.endedAt ? 'completed' : 'failed'),
          startedAt: session.startedAt || new Date(),
          endedAt: session.endedAt,
          duration,
          totalTokensUsed: session.totalTokensUsed || 0,
          totalOperations: session.totalOperations || 0,
          totalCost: (session.metadata as any)?.totalCost || 0,
          autonomousMode: session.autonomousMode || false,
          riskThreshold: (session.riskThreshold as any) || 'medium',
          actionsCount: session.totalOperations || 0,
          filesCreated: (session.metadata as any)?.filesCreated || 0,
          filesModified: (session.metadata as any)?.filesModified || 0,
          filesDeleted: (session.metadata as any)?.filesDeleted || 0,
          commandsExecuted: (session.metadata as any)?.commandsExecuted || 0,
          errorsCount: (session.metadata as any)?.errorsCount || 0,
        };
      });

      return {
        rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    } catch (error: any) {
      logger.error('Error fetching sessions:', error);
      const errorMessage = error?.code === '42P01' 
        ? 'Database tables not initialized. Please run migrations.'
        : 'Database query failed';
      return {
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // Actions Grid
  // ============================================================================

  async getActions(params: QueryParams): Promise<ActionsGridResponse & ErrorResponse> {
    const { 
      page = 1, 
      pageSize = 50, 
      sortDirection = 'desc',
      sessionId,
      status,
    } = params;
    
    const offset = (page - 1) * pageSize;

    try {
      const conditions = [];
      
      if (sessionId) {
        conditions.push(eq(autonomousActions.sessionId, sessionId));
      }
      
      if (status) {
        conditions.push(eq(autonomousActions.status, status as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, actions] = await Promise.all([
        db.select({ count: count() }).from(autonomousActions).where(whereClause),
        db.select()
          .from(autonomousActions)
          .where(whereClause)
          .orderBy(sortDirection === 'asc' ? asc(autonomousActions.executedAt) : desc(autonomousActions.executedAt))
          .limit(pageSize)
          .offset(offset)
      ]);

      const totalCount = Number(countResult[0]?.count || 0);
      
      const rows: AgentActionRow[] = actions.map(action => {
        const actionData = action.actionData as Record<string, any> || {};
        const riskFactors = action.riskFactors as Record<string, any> || {};
        
        return {
          id: action.id,
          sessionId: action.sessionId,
          actionType: this.mapActionType(action.actionType),
          actionLabel: this.getActionLabel(action.actionType, actionData),
          target: actionData.path || actionData.command || actionData.tool || '',
          description: actionData.description || riskFactors.impact || '',
          status: action.status as any,
          riskScore: action.riskScore || 0,
          riskLevel: this.getRiskLevel(action.riskScore || 0),
          autoApproved: action.autoApproved || false,
          approvalRequired: action.approvalRequired || false,
          rollbackAvailable: action.rollbackAvailable || false,
          executedAt: action.executedAt || new Date(),
          completedAt: action.completedAt,
          duration: action.completedAt && action.executedAt 
            ? new Date(action.completedAt).getTime() - new Date(action.executedAt).getTime()
            : undefined,
          result: action.result,
          error: action.error || undefined,
        };
      });

      return {
        rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    } catch (error: any) {
      logger.error('Error fetching actions:', error);
      const errorMessage = error?.code === '42P01' 
        ? 'Database tables not initialized. Please run migrations.'
        : 'Database query failed';
      return {
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // File Operations Grid
  // ============================================================================

  async getFileOperations(params: QueryParams): Promise<FileOperationsGridResponse & ErrorResponse> {
    const { 
      page = 1, 
      pageSize = 50, 
      sortDirection = 'desc',
      sessionId,
      operationType,
    } = params;
    
    const offset = (page - 1) * pageSize;

    try {
      const conditions = [];
      
      if (sessionId) {
        conditions.push(eq(fileOperations.sessionId, sessionId));
      }
      
      if (operationType) {
        conditions.push(eq(fileOperations.operationType, operationType as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, files] = await Promise.all([
        db.select({ count: count() }).from(fileOperations).where(whereClause),
        db.select()
          .from(fileOperations)
          .where(whereClause)
          .orderBy(sortDirection === 'asc' ? asc(fileOperations.executedAt) : desc(fileOperations.executedAt))
          .limit(pageSize)
          .offset(offset)
      ]);

      const totalCount = Number(countResult[0]?.count || 0);
      
      const rows: FileOperationRow[] = files.map(file => {
        const metadata = file.metadata as Record<string, any> || {};
        const filePath = file.filePath || '';
        const fileName = filePath.split('/').pop() || '';
        const fileExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        
        return {
          id: file.id,
          sessionId: file.sessionId,
          actionId: file.id,
          operationType: this.mapFileOpType(file.operationType),
          filePath,
          fileName,
          fileExtension: fileExt,
          language: this.getLanguageFromExtension(fileExt),
          previousContent: file.previousContent || undefined,
          newContent: file.content || undefined,
          diff: metadata.diff,
          linesAdded: this.countLines(file.content, file.previousContent, 'added'),
          linesRemoved: this.countLines(file.content, file.previousContent, 'removed'),
          totalLines: (file.content || '').split('\n').length,
          fileSize: metadata.fileSize || (file.content?.length || 0),
          timestamp: file.executedAt || new Date(),
          rollbackAvailable: !!file.previousContent,
          rolledBack: !!file.rollbackOf,
        };
      });

      return {
        rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    } catch (error: any) {
      logger.error('Error fetching file operations:', error);
      const errorMessage = error?.code === '42P01' 
        ? 'Database tables not initialized. Please run migrations.'
        : 'Database query failed';
      return {
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // Conversations Grid
  // ============================================================================

  async getConversations(params: QueryParams): Promise<ConversationsGridResponse & ErrorResponse> {
    const { 
      page = 1, 
      pageSize = 50, 
      sortDirection = 'desc',
      sessionId,
      role,
      model,
      searchQuery,
    } = params;
    
    const offset = (page - 1) * pageSize;

    try {
      const conditions = [];
      
      if (sessionId) {
        conditions.push(eq(agentMessages.sessionId, sessionId));
      }
      
      if (role) {
        conditions.push(eq(agentMessages.role, role));
      }
      
      if (model) {
        conditions.push(eq(agentMessages.model, model));
      }
      
      if (searchQuery) {
        conditions.push(sql`${agentMessages.content} ILIKE ${'%' + searchQuery + '%'}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, messages] = await Promise.all([
        db.select({ count: count() }).from(agentMessages).where(whereClause),
        db.select()
          .from(agentMessages)
          .where(whereClause)
          .orderBy(sortDirection === 'asc' ? asc(agentMessages.createdAt) : desc(agentMessages.createdAt))
          .limit(pageSize)
          .offset(offset)
      ]);

      const totalCount = Number(countResult[0]?.count || 0);
      
      const rows: ConversationMessageRow[] = messages.map(msg => {
        const metadata = msg.metadata as Record<string, any> || {};
        const thinking = msg.extendedThinking as Record<string, any> || {};
        const content = msg.content || '';
        
        return {
          id: msg.id,
          conversationId: msg.conversationId,
          sessionId: msg.sessionId || undefined,
          projectId: msg.projectId,
          role: msg.role as any,
          content,
          contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          model: msg.model || undefined,
          provider: undefined,
          tokensUsed: metadata.tokensUsed,
          promptTokens: metadata.promptTokens,
          completionTokens: metadata.completionTokens,
          cost: metadata.cost,
          latency: metadata.processingTimeMs,
          hasToolCalls: !!(metadata.toolsUsed && metadata.toolsUsed.length > 0),
          toolCallsCount: metadata.toolsUsed?.length || 0,
          hasThinking: !!thinking.enabled,
          thinkingPreview: thinking.reasoning?.substring(0, 100),
          timestamp: msg.createdAt,
          finishReason: metadata.finishReason,
          metadata: {
            extendedThinking: !!thinking.enabled,
            webSearch: metadata.webSearch,
            cacheHit: metadata.cacheHit,
            streamingDuration: metadata.streamingDuration,
          },
        };
      });

      return {
        rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    } catch (error: any) {
      logger.error('Error fetching conversations:', error);
      const errorMessage = error?.code === '42P01' 
        ? 'Database tables not initialized. Please run migrations.'
        : 'Database query failed';
      return {
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // Metrics Dashboard
  // ============================================================================

  async getMetrics(params: QueryParams): Promise<MetricsDashboardResponse & ErrorResponse> {
    const { userId, projectId, startDate, endDate } = params;

    try {
      const sessionConditions = [];
      if (userId) sessionConditions.push(eq(agentSessions.userId, userId));
      if (projectId) sessionConditions.push(eq(agentSessions.projectId, projectId));
      if (startDate) sessionConditions.push(gte(agentSessions.startedAt, new Date(startDate)));
      if (endDate) sessionConditions.push(lte(agentSessions.startedAt, new Date(endDate)));
      
      const sessionWhere = sessionConditions.length > 0 ? and(...sessionConditions) : undefined;

      const [sessionStats, actionStats, fileStats, messageStats] = await Promise.all([
        this.getSessionMetrics(sessionWhere),
        this.getActionMetrics(sessionWhere),
        this.getFileMetrics(sessionWhere),
        this.getConversationMetrics(sessionWhere),
      ]);

      const metrics: AgentDashboardMetrics = {
        sessions: sessionStats,
        actions: actionStats,
        files: fileStats,
        conversations: messageStats,
        tokenUsageOverTime: [],
        costOverTime: [],
        actionsOverTime: [],
        errorRate: [],
      };

      return {
        metrics,
        generatedAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Error fetching metrics:', error);
      const errorMessage = error?.code === '42P01' 
        ? 'Database tables not initialized. Please run migrations.'
        : 'Database query failed';
      return {
        metrics: this.getEmptyMetrics(),
        generatedAt: new Date(),
        error: errorMessage,
      };
    }
  }

  private async getSessionMetrics(whereClause: any) {
    try {
      const result = await db.select({
        totalSessions: count(),
        activeSessions: sql<number>`COUNT(CASE WHEN ${agentSessions.isActive} = true THEN 1 END)`,
        completedSessions: sql<number>`COUNT(CASE WHEN ${agentSessions.isActive} = false AND ${agentSessions.endedAt} IS NOT NULL THEN 1 END)`,
        totalTokens: sql<number>`COALESCE(SUM(${agentSessions.totalTokensUsed}), 0)`,
        totalOperations: sql<number>`COALESCE(SUM(${agentSessions.totalOperations}), 0)`,
      }).from(agentSessions).where(whereClause);

      const stats = result[0] || {};
      const totalSessions = Number(stats.totalSessions) || 0;
      const totalTokens = Number(stats.totalTokens) || 0;
      const totalOperations = Number(stats.totalOperations) || 0;

      return {
        totalSessions,
        activeSessions: Number(stats.activeSessions) || 0,
        completedSessions: Number(stats.completedSessions) || 0,
        failedSessions: totalSessions - (Number(stats.activeSessions) || 0) - (Number(stats.completedSessions) || 0),
        avgSessionDuration: 0,
        avgTokensPerSession: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
        avgActionsPerSession: totalSessions > 0 ? Math.round(totalOperations / totalSessions) : 0,
        totalCost: 0,
      };
    } catch {
      return {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        failedSessions: 0,
        avgSessionDuration: 0,
        avgTokensPerSession: 0,
        avgActionsPerSession: 0,
        totalCost: 0,
      };
    }
  }

  private async getActionMetrics(sessionWhere: any) {
    try {
      const result = await db.select({
        totalActions: count(),
        completedActions: sql<number>`COUNT(CASE WHEN ${autonomousActions.status} = 'completed' THEN 1 END)`,
        failedActions: sql<number>`COUNT(CASE WHEN ${autonomousActions.status} = 'failed' THEN 1 END)`,
        autoApprovedCount: sql<number>`COUNT(CASE WHEN ${autonomousActions.autoApproved} = true THEN 1 END)`,
        avgRisk: sql<number>`COALESCE(AVG(${autonomousActions.riskScore}), 0)`,
      }).from(autonomousActions);

      const stats = result[0] || {};
      const totalActions = Number(stats.totalActions) || 0;
      const autoApprovedCount = Number(stats.autoApprovedCount) || 0;

      return {
        totalActions,
        actionsByType: {} as Record<string, number>,
        actionsByStatus: {
          completed: Number(stats.completedActions) || 0,
          failed: Number(stats.failedActions) || 0,
          pending: 0,
          in_progress: 0,
          cancelled: 0,
          rolled_back: 0,
        },
        avgRiskScore: Number(stats.avgRisk) || 0,
        autoApprovalRate: totalActions > 0 ? (autoApprovedCount / totalActions) * 100 : 0,
        rollbackRate: 0,
        avgActionDuration: 0,
      };
    } catch {
      return {
        totalActions: 0,
        actionsByType: {},
        actionsByStatus: { completed: 0, failed: 0, pending: 0, in_progress: 0, cancelled: 0, rolled_back: 0 },
        avgRiskScore: 0,
        autoApprovalRate: 0,
        rollbackRate: 0,
        avgActionDuration: 0,
      };
    }
  }

  private async getFileMetrics(sessionWhere: any) {
    try {
      const result = await db.select({
        totalOps: count(),
        created: sql<number>`COUNT(CASE WHEN ${fileOperations.operationType} = 'file_create' THEN 1 END)`,
        updated: sql<number>`COUNT(CASE WHEN ${fileOperations.operationType} = 'file_update' THEN 1 END)`,
        deleted: sql<number>`COUNT(CASE WHEN ${fileOperations.operationType} = 'file_delete' THEN 1 END)`,
      }).from(fileOperations);

      const stats = result[0] || {};

      return {
        totalFileOperations: Number(stats.totalOps) || 0,
        filesCreated: Number(stats.created) || 0,
        filesModified: Number(stats.updated) || 0,
        filesDeleted: Number(stats.deleted) || 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        topLanguages: [],
        topFileTypes: [],
      };
    } catch {
      return {
        totalFileOperations: 0,
        filesCreated: 0,
        filesModified: 0,
        filesDeleted: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        topLanguages: [],
        topFileTypes: [],
      };
    }
  }

  private async getConversationMetrics(sessionWhere: any) {
    try {
      const result = await db.select({
        totalMessages: count(),
        userMessages: sql<number>`COUNT(CASE WHEN ${agentMessages.role} = 'user' THEN 1 END)`,
        assistantMessages: sql<number>`COUNT(CASE WHEN ${agentMessages.role} = 'assistant' THEN 1 END)`,
      }).from(agentMessages);

      const convResult = await db.select({ totalConvs: count() }).from(aiConversations);

      const stats = result[0] || {};
      const totalMessages = Number(stats.totalMessages) || 0;
      const totalConversations = Number(convResult[0]?.totalConvs) || 0;

      return {
        totalConversations,
        totalMessages,
        messagesByRole: {
          user: Number(stats.userMessages) || 0,
          assistant: Number(stats.assistantMessages) || 0,
          system: 0,
          tool: 0,
        },
        totalTokensUsed: 0,
        totalCost: 0,
        avgMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
        topModels: [],
      };
    } catch {
      return {
        totalConversations: 0,
        totalMessages: 0,
        messagesByRole: { user: 0, assistant: 0, system: 0, tool: 0 },
        totalTokensUsed: 0,
        totalCost: 0,
        avgMessagesPerConversation: 0,
        topModels: [],
      };
    }
  }

  private getEmptyMetrics(): AgentDashboardMetrics {
    return {
      sessions: {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        failedSessions: 0,
        avgSessionDuration: 0,
        avgTokensPerSession: 0,
        avgActionsPerSession: 0,
        totalCost: 0,
      },
      actions: {
        totalActions: 0,
        actionsByType: {
          file_create: 0,
          file_edit: 0,
          file_delete: 0,
          file_read: 0,
          command_execute: 0,
          package_install: 0,
          web_search: 0,
          code_search: 0,
          diagnostics: 0,
          project_analysis: 0,
          tool_call: 0,
          unknown: 0
        },
        actionsByStatus: { completed: 0, failed: 0, pending: 0, in_progress: 0, cancelled: 0, rolled_back: 0 },
        avgRiskScore: 0,
        autoApprovalRate: 0,
        rollbackRate: 0,
        avgActionDuration: 0,
      },
      files: {
        totalFileOperations: 0,
        filesCreated: 0,
        filesModified: 0,
        filesDeleted: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        topLanguages: [],
        topFileTypes: [],
      },
      conversations: {
        totalConversations: 0,
        totalMessages: 0,
        messagesByRole: { user: 0, assistant: 0, system: 0, tool: 0 },
        totalTokensUsed: 0,
        totalCost: 0,
        avgMessagesPerConversation: 0,
        topModels: [],
      },
      tokenUsageOverTime: [],
      costOverTime: [],
      actionsOverTime: [],
      errorRate: [],
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapActionType(type: string): any {
    const mapping: Record<string, string> = {
      'file_write': 'file_create',
      'file_create': 'file_create',
      'file_update': 'file_edit',
      'file_edit': 'file_edit',
      'file_delete': 'file_delete',
      'command_execute': 'command_execute',
      'tool_call': 'tool_call',
      'package_install': 'package_install',
      'web_search': 'web_search',
      'code_search': 'code_search',
    };
    return mapping[type] || 'unknown';
  }

  private getActionLabel(type: string, data: Record<string, any>): string {
    const labels: Record<string, string> = {
      'file_write': 'Write File',
      'file_create': 'Create File',
      'file_update': 'Update File',
      'file_edit': 'Edit File',
      'file_delete': 'Delete File',
      'command_execute': 'Execute Command',
      'tool_call': data.tool || 'Tool Call',
      'package_install': 'Install Package',
      'web_search': 'Web Search',
      'code_search': 'Code Search',
    };
    return labels[type] || type.replace(/_/g, ' ');
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 25) return 'low';
    if (score <= 50) return 'medium';
    if (score <= 75) return 'high';
    return 'critical';
  }

  private mapFileOpType(type: string): any {
    const mapping: Record<string, string> = {
      'file_create': 'create',
      'file_update': 'edit',
      'file_delete': 'delete',
      'file_rename': 'rename',
      'file_move': 'move',
      'file_read': 'edit',
    };
    return mapping[type] || 'edit';
  }

  private getLanguageFromExtension(ext: string): string {
    const mapping: Record<string, string> = {
      'ts': 'TypeScript',
      'tsx': 'TypeScript',
      'js': 'JavaScript',
      'jsx': 'JavaScript',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'go': 'Go',
      'rs': 'Rust',
      'rb': 'Ruby',
      'php': 'PHP',
      'css': 'CSS',
      'scss': 'SCSS',
      'html': 'HTML',
      'json': 'JSON',
      'yaml': 'YAML',
      'yml': 'YAML',
      'md': 'Markdown',
      'sql': 'SQL',
      'sh': 'Shell',
      'bash': 'Shell',
    };
    return mapping[ext.toLowerCase()] || ext.toUpperCase();
  }

  private countLines(newContent: string | null, prevContent: string | null, type: 'added' | 'removed'): number {
    if (!newContent && !prevContent) return 0;
    
    const newLines = (newContent || '').split('\n').length;
    const prevLines = (prevContent || '').split('\n').length;
    
    if (type === 'added') {
      return Math.max(0, newLines - prevLines);
    }
    return Math.max(0, prevLines - newLines);
  }

  // ============================================================================
  // Export Methods
  // ============================================================================

  async exportSessions(format: 'csv' | 'json', params: QueryParams): Promise<string | object[]> {
    const response = await this.getSessions({ ...params, pageSize: 10000 });
    
    if (format === 'json') {
      return response.rows;
    }
    
    const headers = ['ID', 'User', 'Project', 'Model', 'Status', 'Tokens', 'Operations', 'Started', 'Duration'];
    const rows = response.rows.map(row => [
      row.id,
      row.userName || '',
      row.projectName || '',
      row.model,
      row.status,
      row.totalTokensUsed,
      row.totalOperations,
      row.startedAt?.toISOString() || '',
      row.duration || 0,
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const agentGridDataService = new AgentGridDataService();
