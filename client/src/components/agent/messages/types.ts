/**
 * Message Types for AI Agent Chat
 * Professional-grade type definitions matching Replit's architecture
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageType = 
  | 'chat'          // Standard conversation
  | 'thinking'      // AI extended thinking process
  | 'task'          // Task execution with status
  | 'action'        // File operation, command execution
  | 'checkpoint'    // Code checkpoint with diff
  | 'error'         // Error message
  | 'success'       // Success notification
  | 'progress'      // Progress indicator
  | 'code'          // Code snippet
  | 'explanation'   // Technical explanation
  | 'suggestion';   // AI suggestion

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type ActionType = 
  | 'create_file' 
  | 'edit_file' 
  | 'delete_file' 
  | 'run_command' 
  | 'install_package'
  | 'create_folder';

export interface ThinkingStep {
  id: string;
  type: 'reasoning' | 'analysis' | 'planning' | 'tool_use';
  title: string;
  content: string;
  status: 'active' | 'completed' | 'error';
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: number;
  estimatedTime?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  artifacts?: {
    filesCreated?: string[];
    filesModified?: string[];
    packagesInstalled?: string[];
    commands?: string[];
  };
}

export interface Action {
  id: string;
  type: ActionType;
  path?: string;
  content?: string;
  oldContent?: string; // For edit_file operations - shows diff
  newContent?: string; // For edit_file operations - shows diff
  language?: string; // Language for syntax highlighting in diff
  command?: string;
  package?: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  timestamp: Date;
  result?: {
    success: boolean;
    message?: string;
    error?: string;
  };
}

export interface FileDiff {
  path: string;
  before: string;
  after: string;
  language?: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  timestamp: Date;
  diff: FileDiff[];
  rollbackAvailable: boolean;
}

export interface AgentMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: Date;
  
  // Extended thinking
  thinking?: {
    steps: ThinkingStep[];
    isStreaming: boolean;
    totalTokens?: number;
    thinkingTime?: number;
  };
  
  // Tasks
  tasks?: Task[];
  
  // Actions requiring approval
  actions?: Action[];
  
  // Checkpoint data
  checkpoint?: Checkpoint;
  
  // Code metadata
  code?: {
    language: string;
    fileName?: string;
    snippet: string;
  };
  
  // Metadata
  metadata?: {
    tokensUsed?: number;
    executionTimeMs?: number;
    model?: string;
    temperature?: number;
    [key: string]: any;
  };
  
  // Pricing (if applicable)
  pricing?: {
    complexity: string;
    costInCents: number;
    costInDollars: string;
    effortScore: number;
  };
  
  // Error details
  error?: {
    message: string;
    stack?: string;
    code?: string;
    recoverable: boolean;
  };
  
  // Progress
  progress?: {
    current: number;
    total: number;
    percentage: number;
    status: string;
  };
}
