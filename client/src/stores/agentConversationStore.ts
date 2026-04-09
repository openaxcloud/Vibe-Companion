import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ToolExecution {
  id: string;
  tool: string;
  parameters: any;
  result?: any;
  success?: boolean;
  status: 'pending' | 'running' | 'complete' | 'error';
  metadata?: {
    executionTime?: number;
    filesChanged?: string[];
    commandOutput?: string;
  };
  error?: string;
}

interface ThinkingStep {
  id: string;
  type?: 'reasoning' | 'analysis' | 'planning' | 'implementation' | 'verification' | 'tool_use';
  title: string;
  content?: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'completed' | 'error';
  timestamp: Date;
  details?: string[];
  progress?: number;
  duration?: number;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

type ActionType = 'create_file' | 'edit_file' | 'delete_file' | 'run_command' | 'install_package' | 'create_folder' | string;

interface Action {
  id: string;
  type: ActionType;
  path?: string;
  content?: string;
  command?: string;
  package?: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'completed';
  timestamp?: Date;
  result?: {
    success: boolean;
    message?: string;
    error?: string;
  };
}

interface FileDiff {
  path: string;
  changes: string;
}

type WorkflowPhase = 
  | 'generating_features'
  | 'selecting_build_option'
  | 'building_design'
  | 'design_preview'
  | 'building_full'
  | 'mvp_complete'
  | 'extended_build'
  | 'complete';

export type AutonomousBuildMode = 'design-first' | 'full-app';

export interface AutonomousBuildTask {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
}

export interface AutonomousWorkspacePayload {
  phase?: 'planning' | 'awaiting_approval' | 'executing' | 'complete' | 'error';
  searchQuery?: string;
  appType?: string;
  featureList?: string[];
  planTitle?: string;
  buildMode?: AutonomousBuildMode;
  progress?: number;
  currentTask?: string;
  tasks?: AutonomousBuildTask[];
  planText?: string;
  errorMessage?: string;
  projectUrl?: string;
  errorDetails?: string;
  agentStatus?: 'idle' | 'thinking' | 'vibing' | 'working' | 'building' | 'styling' | 'testing' | 'deploying' | 'complete' | 'error';
  subMessage?: string;
  fileOperation?: {
    type: 'create' | 'edit' | 'delete' | 'read' | 'move';
    path: string;
    language?: string;
    linesChanged?: number;
    preview?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'error';
  };
  terminal?: {
    command: string;
    output?: string;
    status?: 'running' | 'success' | 'error';
    exitCode?: number;
    duration?: number;
  };
  code?: {
    content: string;
    language?: string;
    filename?: string;
    action?: 'adding' | 'removing' | 'modifying';
  };
  dependencies?: {
    packages: string[];
    status?: 'installing' | 'success' | 'error';
    manager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  };
  action?: {
    title: string;
    description?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
  };
  thinkingSteps?: string[];
  timeline?: {
    events: Array<{
      id: string;
      type: 'file_create' | 'file_edit' | 'file_delete' | 'command' | 'checkpoint' | 'info';
      title: string;
      description?: string;
      timestamp: Date | string;
      filePath?: string;
      status?: 'pending' | 'in_progress' | 'completed' | 'error';
    }>;
    maxHeight?: string;
  };
  checkpoint?: {
    title: string;
    description?: string;
    number?: number;
    completedTasks?: number;
    totalTasks?: number;
    eta?: string;
  };
  taskList?: {
    title?: string;
    items: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      filePath?: string;
      duration?: number;
    }>;
    showProgress?: boolean;
    compact?: boolean;
  };
  preview?: {
    url?: string;
    title?: string;
    isLoading?: boolean;
    isLive?: boolean;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  thinking?: ThinkingStep[];
  toolExecutions?: ToolExecution[];
  isStreaming?: boolean;
  type?: 'text' | 'workflow_features' | 'workflow_build_choice' | 'workflow_design' | 'workflow_mvp' 
    | 'autonomous_working' | 'autonomous_search' | 'autonomous_plan' | 'autonomous_build_options' 
    | 'autonomous_progress' | 'autonomous_complete' | 'autonomous_error' 
    | 'autonomous_file_operation' | 'autonomous_terminal' | 'autonomous_code' 
    | 'autonomous_dependencies' | 'autonomous_action' | 'autonomous_thinking'
    | 'autonomous_timeline' | 'autonomous_checkpoint' | 'autonomous_task_list' | 'autonomous_preview'
    | 'auto_checkpoint_created';
  workflowPhase?: WorkflowPhase;
  workflowPayload?: {
    featureList?: string[];
    taskList?: string[];
    designPreviewUrl?: string;
    buildChoice?: 'full' | 'design';
  };
  autonomousPayload?: AutonomousWorkspacePayload;
  tasks?: Task[];
  actions?: Action[];
  checkpoint?: {
    id: string;
    name: string;
    diff: FileDiff[];
    rollbackAvailable: boolean;
  };
  autoCheckpoint?: {
    id: number;
    aiSummary?: string;
    filesCount?: number;
    createdAt: string;
    type?: 'auto' | 'manual' | 'milestone';
  };
  webSearchResults?: {
    query: string;
    answer?: string;
    sources: Array<{ title: string; url: string }>;
    resultCount: number;
  };
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    cost?: string;
    latency?: number;
    webSearchUsed?: boolean;
    extendedThinking?: boolean;
    cacheHit?: boolean;
    streamingDuration?: number;
    finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
    error?: boolean;
  };
}

interface ConversationState {
  messages: Record<number, Message[]>;
  lastSyncedAt: Record<number, number>;
}

interface AgentConversationStore extends ConversationState {
  addMessage: (conversationId: number, message: Message) => void;
  setMessages: (conversationId: number, messages: Message[]) => void;
  updateMessage: (conversationId: number, messageId: string, updates: Partial<Message>) => void;
  clearMessages: (conversationId: number) => void;
  getMessages: (conversationId: number) => Message[];
  setLastSyncedAt: (conversationId: number, timestamp: number) => void;
  getLastSyncedAt: (conversationId: number) => number | undefined;
  hasConversation: (conversationId: number) => boolean;
  migrateMessages: (fromId: number, toId: number) => void;
}

const DEFAULT_ASSISTANT_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "Hi! I'm your AI assistant with extended thinking capabilities. I can help you build, debug, and improve your code with transparent reasoning. What would you like to create today?",
  timestamp: new Date()
};

const DEFAULT_MESSAGES: Message[] = [DEFAULT_ASSISTANT_MESSAGE];

export const useAgentConversationStore = create<AgentConversationStore>()(
  persist(
    (set, get) => ({
      messages: {},
      lastSyncedAt: {},

      addMessage: (conversationId: number, message: Message) => {
        set((state) => {
          const existingMessages = state.messages[conversationId] || [DEFAULT_ASSISTANT_MESSAGE];
          // Dedup: skip if a message with the same ID already exists
          if (message.id && existingMessages.some(m => m.id === message.id)) {
            return {};
          }
          const messageWithDate = {
            ...message,
            timestamp: message.timestamp instanceof Date 
              ? message.timestamp 
              : new Date(message.timestamp)
          };
          return {
            messages: {
              ...state.messages,
              [conversationId]: [...existingMessages, messageWithDate]
            }
          };
        });
      },

      setMessages: (conversationId: number, messages: Message[]) => {
        set((state) => {
          const normalizedMessages = messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date 
              ? msg.timestamp 
              : new Date(msg.timestamp)
          }));
          return {
            messages: {
              ...state.messages,
              [conversationId]: normalizedMessages.length > 0 ? normalizedMessages : [DEFAULT_ASSISTANT_MESSAGE]
            }
          };
        });
      },

      updateMessage: (conversationId: number, messageId: string, updates: Partial<Message>) => {
        set((state) => {
          const existingMessages = state.messages[conversationId] || [];
          return {
            messages: {
              ...state.messages,
              [conversationId]: existingMessages.map(msg => 
                msg.id === messageId 
                  ? { ...msg, ...updates }
                  : msg
              )
            }
          };
        });
      },

      clearMessages: (conversationId: number) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [DEFAULT_ASSISTANT_MESSAGE]
          },
          lastSyncedAt: {
            ...state.lastSyncedAt,
            [conversationId]: Date.now()
          }
        }));
      },

      getMessages: (conversationId: number) => {
        const state = get();
        return state.messages[conversationId] || DEFAULT_MESSAGES;
      },

      setLastSyncedAt: (conversationId: number, timestamp: number) => {
        set((state) => ({
          lastSyncedAt: {
            ...state.lastSyncedAt,
            [conversationId]: timestamp
          }
        }));
      },

      getLastSyncedAt: (conversationId: number) => {
        return get().lastSyncedAt[conversationId];
      },

      hasConversation: (conversationId: number) => {
        return !!get().messages[conversationId];
      },

      migrateMessages: (fromId: number, toId: number) => {
        set((state) => {
          const sourceMessages = state.messages[fromId];
          if (!sourceMessages || sourceMessages.length === 0) {
            return state;
          }
          
          // Filter out the default message and merge with existing target messages
          const existingTargetMessages = state.messages[toId] || [];
          const filteredSourceMessages = sourceMessages.filter(msg => msg.id !== '1');
          
          // Create new messages object without the source key
          const { [fromId]: _, ...restMessages } = state.messages;
          
          return {
            messages: {
              ...restMessages,
              [toId]: existingTargetMessages.length > 1 
                ? [...existingTargetMessages, ...filteredSourceMessages]
                : [existingTargetMessages[0] || DEFAULT_ASSISTANT_MESSAGE, ...filteredSourceMessages]
            }
          };
        });
      }
    }),
    {
      name: 'agent-conversation-storage',
      partialize: (state) => {
        const limitedMessages: Record<number, typeof state.messages[number]> = {};
        for (const [key, msgs] of Object.entries(state.messages)) {
          const conversationId = parseInt(key, 10);
          limitedMessages[conversationId] = msgs.slice(-100);
        }
        return { 
          messages: limitedMessages,
          lastSyncedAt: state.lastSyncedAt
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          Object.keys(state.messages).forEach(key => {
            const conversationId = parseInt(key, 10);
            const messages = state.messages[conversationId];
            if (messages) {
              state.messages[conversationId] = messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }));
            }
          });
        }
      }
    }
  )
);

export default useAgentConversationStore;
