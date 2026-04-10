/**
 * Agent Activity Types
 * Unified event types for real-time agent activity streaming
 * Used by WebSocket pipeline, inline chat messages, and Progress dock panel
 */

export type ActivityEventType =
  | 'thinking_start'
  | 'thinking_step'
  | 'thinking_end'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_complete'
  | 'tool_error'
  | 'file_read'
  | 'file_create'
  | 'file_edit'
  | 'file_delete'
  | 'command_start'
  | 'command_output'
  | 'command_complete'
  | 'web_search'
  | 'code_search'
  | 'message_chunk'
  | 'message_complete'
  | 'checkpoint_created'
  | 'test_start'
  | 'test_step'
  | 'test_complete'
  | 'session_start'
  | 'session_end'
  | 'mode_change'
  | 'error';

export interface ThinkingStep {
  id: string;
  stepNumber: number;
  content: string;
  timestamp: number;
  duration?: number;
  tokenCount?: number;
}

export interface ToolExecutionEvent {
  id: string;
  toolName: string;
  toolType: 'file' | 'command' | 'search' | 'api' | 'test' | 'other';
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface FileChangeEvent {
  filePath: string;
  operation: 'create' | 'edit' | 'delete' | 'rename';
  language?: string;
  linesAdded?: number;
  linesRemoved?: number;
  diff?: string;
  preview?: string;
}

export interface CommandEvent {
  command: string;
  cwd?: string;
  output?: string;
  exitCode?: number;
  isStreaming: boolean;
}

export interface SearchEvent {
  query: string;
  searchType: 'web' | 'code' | 'file';
  results?: Array<{
    title: string;
    snippet: string;
    url?: string;
    filePath?: string;
    lineNumber?: number;
  }>;
  resultCount?: number;
}

export interface TestEvent {
  testId: string;
  testName?: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  step?: string;
  screenshot?: string;
  videoUrl?: string;
  error?: string;
  duration?: number;
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  sessionId: string;
  messageId?: string;
  projectId?: number;
  timestamp: number;
  payload: 
    | ThinkingStep
    | ToolExecutionEvent
    | FileChangeEvent
    | CommandEvent
    | SearchEvent
    | TestEvent
    | { content: string }
    | { mode: 'build' | 'edit' | 'plan' }
    | { error: string; code?: string }
    | Record<string, unknown>;
  metadata?: {
    model?: string;
    provider?: string;
    tokensUsed?: number;
    cost?: number;
    autonomousMode?: boolean;
  };
}

export interface ActivityStreamMessage {
  event: 'activity' | 'heartbeat' | 'error' | 'connected' | 'disconnected';
  data?: ActivityEvent;
  sessionId?: string;
  timestamp: number;
}

export interface AgentSessionState {
  sessionId: string;
  projectId: number;
  userId: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  mode: 'build' | 'edit' | 'plan';
  model: string;
  provider: string;
  autonomousMode: boolean;
  startedAt: number;
  lastActivityAt: number;
  thinkingSteps: ThinkingStep[];
  toolExecutions: ToolExecutionEvent[];
  fileChanges: FileChangeEvent[];
  currentActivity?: ActivityEvent;
  metrics: {
    totalTokens: number;
    totalCost: number;
    actionsCount: number;
    filesModified: number;
    commandsExecuted: number;
    errorsCount: number;
  };
}

export interface ActivityFilters {
  sessionId?: string;
  projectId?: number;
  eventTypes?: ActivityEventType[];
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface ActivityStreamConfig {
  sessionId: string;
  projectId: number;
  filters?: ActivityFilters;
  includeHistory?: boolean;
  historyLimit?: number;
}

export function isThinkingStep(payload: unknown): payload is ThinkingStep {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'stepNumber' in payload &&
    'content' in payload
  );
}

export function isToolExecution(payload: unknown): payload is ToolExecutionEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'toolName' in payload &&
    'status' in payload
  );
}

export function isFileChange(payload: unknown): payload is FileChangeEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'filePath' in payload &&
    'operation' in payload
  );
}

export function isCommandEvent(payload: unknown): payload is CommandEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'command' in payload
  );
}

export function isSearchEvent(payload: unknown): payload is SearchEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'query' in payload &&
    'searchType' in payload
  );
}

export function isTestEvent(payload: unknown): payload is TestEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'testId' in payload &&
    'status' in payload
  );
}
