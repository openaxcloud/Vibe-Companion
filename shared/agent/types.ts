/**
 * Shared Agent Types
 * Platform-agnostic types for AI Agent functionality across web and mobile
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  type?: 'code' | 'explanation' | 'suggestion' | 'error' | 'action' | 'progress' | 'building';
  metadata?: {
    language?: string;
    fileName?: string;
    action?: string;
    files?: string[];
    packages?: string[];
    progress?: number;
    buildType?: string;
    technology?: string;
  };
  pricing?: {
    complexity: string;
    costInCents: number;
    costInDollars: string;
    effortScore: number;
  };
  metrics?: {
    filesModified: number;
    linesOfCode: number;
    tokensUsed: number;
    apiCalls: number;
    executionTimeMs: number;
  };
  attachments?: any[]; // File[] on web, different type on mobile
  plan?: ProjectPlan;
  actions?: AgentAction[];
  completed?: boolean;
  checkpoint?: any;
}

export interface ProjectPlan {
  id: string;
  title: string;
  description: string;
  tasks: ProjectTask[];
  approved: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  type: 'file' | 'folder' | 'package' | 'config';
  selected: boolean;
  required: boolean;
  estimated: string;
}

export interface AgentAction {
  type: 'create_file' | 'edit_file' | 'delete_file' | 'create_folder' | 'install_package' | 'run_command' | 'deploy';
  path?: string;
  content?: string;
  package?: string;
  version?: string;
  description?: string;
  data?: any;
  completed: boolean;
  progress?: number;
  approved?: boolean;
}

export interface AgentSessionState {
  messages: Message[];
  isLoading: boolean;
  isBuilding: boolean;
  buildProgress: number;
  currentPlan: ProjectPlan | null;
  showPlanDialog: boolean;
}

export interface AgentSessionActions {
  sendMessage: (content: string, attachments?: any[]) => Promise<void>;
  executeActions: (actions: AgentAction[]) => Promise<void>;
  approvePlan: (selectedTasks?: ProjectTask[]) => Promise<void>;
  cancelPlan: () => void;
  toggleTaskSelection: (taskId: string) => void;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

export interface UseAgentSessionOptions {
  projectId: number;
  initialPrompt?: string | null;
  onActionComplete?: (action: AgentAction) => void;
  onBuildComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface AgentSessionHook {
  state: AgentSessionState;
  actions: AgentSessionActions;
}
