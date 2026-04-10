/**
 * Agent Grid Types
 * TypeScript interfaces for AG Grid data structures
 * Phase 2 - Agent Activity Dashboard
 */

// ============================================================================
// Session Grid Types
// ============================================================================

export interface AgentSessionRow {
  id: string;
  userId: number;
  projectId: number | null;
  projectName?: string;
  userName?: string;
  model: string;
  provider?: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  endedAt?: Date | null;
  duration?: number; // milliseconds
  totalTokensUsed: number;
  totalOperations: number;
  totalCost?: number;
  autonomousMode: boolean;
  riskThreshold: 'low' | 'medium' | 'high' | 'critical';
  actionsCount: number;
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  commandsExecuted: number;
  errorsCount: number;
}

export interface SessionFilters {
  userId?: number;
  projectId?: number;
  status?: AgentSessionRow['status'][];
  model?: string[];
  autonomousMode?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minTokens?: number;
  maxTokens?: number;
  hasErrors?: boolean;
}

export interface SessionSortModel {
  field: keyof AgentSessionRow;
  direction: 'asc' | 'desc';
}

// ============================================================================
// Action Grid Types
// ============================================================================

export type ActionType = 
  | 'file_create' 
  | 'file_edit' 
  | 'file_delete' 
  | 'file_read'
  | 'command_execute' 
  | 'package_install'
  | 'web_search'
  | 'code_search'
  | 'diagnostics'
  | 'project_analysis'
  | 'tool_call'
  | 'unknown';

export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';

export interface AgentActionRow {
  id: string;
  sessionId: string;
  actionType: ActionType;
  actionLabel: string;
  target: string; // file path, command, package name, etc.
  description?: string;
  status: ActionStatus;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  autoApproved: boolean;
  approvalRequired: boolean;
  rollbackAvailable: boolean;
  executedAt: Date;
  completedAt?: Date | null;
  duration?: number; // milliseconds
  result?: any;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    filesChanged?: string[];
    commandOutput?: string;
    linesAdded?: number;
    linesRemoved?: number;
  };
}

export interface ActionFilters {
  sessionId?: string;
  actionType?: ActionType[];
  status?: ActionStatus[];
  riskLevel?: ('low' | 'medium' | 'high' | 'critical')[];
  autoApproved?: boolean;
  hasError?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// File Operations Grid Types
// ============================================================================

export type FileOperationType = 'create' | 'edit' | 'delete' | 'rename' | 'move';

export interface FileOperationRow {
  id: string;
  sessionId: string;
  actionId: string;
  operationType: FileOperationType;
  filePath: string;
  fileName: string;
  fileExtension: string;
  language?: string;
  previousContent?: string;
  newContent?: string;
  diff?: string;
  linesAdded: number;
  linesRemoved: number;
  totalLines: number;
  fileSize: number; // bytes
  timestamp: Date;
  rollbackAvailable: boolean;
  rolledBack: boolean;
}

export interface FileOperationFilters {
  sessionId?: string;
  operationType?: FileOperationType[];
  fileExtension?: string[];
  language?: string[];
  hasChanges?: boolean;
  rollbackAvailable?: boolean;
}

// ============================================================================
// Conversation History Grid Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ConversationMessageRow {
  id: string;
  conversationId: number;
  sessionId?: string;
  projectId: number;
  role: MessageRole;
  content: string;
  contentPreview: string; // truncated for grid display
  model?: string;
  provider?: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  latency?: number; // milliseconds
  hasToolCalls: boolean;
  toolCallsCount: number;
  hasThinking: boolean;
  thinkingPreview?: string;
  timestamp: Date;
  finishReason?: string;
  metadata?: {
    extendedThinking?: boolean;
    webSearch?: boolean;
    cacheHit?: boolean;
    streamingDuration?: number;
  };
}

export interface ConversationFilters {
  conversationId?: number;
  sessionId?: string;
  projectId?: number;
  role?: MessageRole[];
  model?: string[];
  hasToolCalls?: boolean;
  hasThinking?: boolean;
  searchText?: string; // full-text search
  dateRange?: {
    start: Date;
    end: Date;
  };
  minTokens?: number;
  maxTokens?: number;
}

// ============================================================================
// Metrics Dashboard Types
// ============================================================================

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  avgSessionDuration: number; // milliseconds
  avgTokensPerSession: number;
  avgActionsPerSession: number;
  totalCost: number;
}

export interface ActionMetrics {
  totalActions: number;
  actionsByType: Record<ActionType, number>;
  actionsByStatus: Record<ActionStatus, number>;
  avgRiskScore: number;
  autoApprovalRate: number; // percentage
  rollbackRate: number; // percentage
  avgActionDuration: number; // milliseconds
}

export interface FileMetrics {
  totalFileOperations: number;
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  topLanguages: Array<{ language: string; count: number }>;
  topFileTypes: Array<{ extension: string; count: number }>;
}

export interface ConversationMetrics {
  totalConversations: number;
  totalMessages: number;
  messagesByRole: Record<MessageRole, number>;
  totalTokensUsed: number;
  totalCost: number;
  avgMessagesPerConversation: number;
  topModels: Array<{ model: string; count: number; tokens: number }>;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface AgentDashboardMetrics {
  sessions: SessionMetrics;
  actions: ActionMetrics;
  files: FileMetrics;
  conversations: ConversationMetrics;
  tokenUsageOverTime: TimeSeriesDataPoint[];
  costOverTime: TimeSeriesDataPoint[];
  actionsOverTime: TimeSeriesDataPoint[];
  errorRate: TimeSeriesDataPoint[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface GridDataRequest<TFilters> {
  filters?: TFilters;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination: PaginationParams;
}

export interface GridDataResponse<TRow> {
  rows: TRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionsGridRequest extends GridDataRequest<SessionFilters> {}
export interface SessionsGridResponse extends GridDataResponse<AgentSessionRow> {}

export interface ActionsGridRequest extends GridDataRequest<ActionFilters> {
  sessionId?: string;
}
export interface ActionsGridResponse extends GridDataResponse<AgentActionRow> {}

export interface FileOperationsGridRequest extends GridDataRequest<FileOperationFilters> {
  sessionId?: string;
}
export interface FileOperationsGridResponse extends GridDataResponse<FileOperationRow> {}

export interface ConversationsGridRequest extends GridDataRequest<ConversationFilters> {
  projectId?: number;
}
export interface ConversationsGridResponse extends GridDataResponse<ConversationMessageRow> {}

export interface MetricsDashboardRequest {
  userId?: number;
  projectId?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface MetricsDashboardResponse {
  metrics: AgentDashboardMetrics;
  generatedAt: Date;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'excel';

export interface ExportRequest {
  format: ExportFormat;
  columns?: string[];
  includeMetadata?: boolean;
}

// ============================================================================
// Real-time Updates
// ============================================================================

export type GridUpdateType = 
  | 'session_created'
  | 'session_updated'
  | 'session_ended'
  | 'action_started'
  | 'action_completed'
  | 'action_failed'
  | 'file_operation'
  | 'message_added';

export interface GridUpdateEvent {
  type: GridUpdateType;
  timestamp: Date;
  data: AgentSessionRow | AgentActionRow | FileOperationRow | ConversationMessageRow;
}

// ============================================================================
// Type Aliases for Backward Compatibility
// ============================================================================

export type FilesGridResponse = FileOperationsGridResponse;
export type ConversationRow = ConversationMessageRow;
