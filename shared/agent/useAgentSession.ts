/**
 * useAgentSession Hook
 * Shared Agent session logic for both web and mobile platforms
 * Platform-agnostic state management for AI Agent interactions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Message,
  ProjectPlan,
  ProjectTask,
  AgentAction,
  AgentSessionState,
  AgentSessionActions,
  UseAgentSessionOptions,
  AgentSessionHook
} from './types';

/**
 * Platform-agnostic API client
 * Must be configured per platform (fetch for web, axios/fetch for React Native)
 */
export interface ApiClient {
  post: (url: string, data: any) => Promise<any>;
}

let globalApiClient: ApiClient | null = null;

export function configureAgentApi(client: ApiClient) {
  globalApiClient = client;
}

/**
 * Shared Agent Session Hook
 * Manages messages, plans, actions, and building state
 */
export function useAgentSession(options: UseAgentSessionOptions): AgentSessionHook {
  const {
    projectId,
    initialPrompt,
    onActionComplete,
    onBuildComplete,
    onError
  } = options;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<ProjectPlan | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);

  // Refs for callbacks
  const onActionCompleteRef = useRef(onActionComplete);
  const onBuildCompleteRef = useRef(onBuildComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onActionCompleteRef.current = onActionComplete;
    onBuildCompleteRef.current = onBuildComplete;
    onErrorRef.current = onError;
  }, [onActionComplete, onBuildComplete, onError]);

  // Handle initial prompt (for dashboard "Create with AI" flow)
  useEffect(() => {
    if (initialPrompt) {
      // Check session storage for initial prompt (web only - React Native doesn't have window)
      const storageKey = `agent-prompt-${projectId}`;
      let storedPrompt: string | null = null;
      
      if (typeof window !== 'undefined' && window.sessionStorage) {
        storedPrompt = window.sessionStorage.getItem(storageKey);
      }

      if (storedPrompt || initialPrompt) {
        const promptToUse = storedPrompt || initialPrompt;
        
        // Clear from session storage (web only)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(storageKey);
        }

        // Auto-send the prompt after a brief delay
        setTimeout(() => {
          sendMessage(promptToUse);
        }, 500);
      }
    }
  }, [projectId, initialPrompt]);

  /**
   * Send a message to the AI Agent
   */
  const sendMessage = useCallback(async (content: string, attachments?: any[]) => {
    if (!globalApiClient) {
      console.error('[useAgentSession] API client not configured. Call configureAgentApi first.');
      return;
    }

    const messageContent = content.trim();
    if (!messageContent && (!attachments || attachments.length === 0)) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      attachments: attachments || []
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await globalApiClient.post(`/api/projects/${projectId}/ai/chat`, {
        message: messageContent,
        mode: 'agent',
        attachments: attachments && attachments.length > 0 
          ? attachments.map((f: any) => f.name || f.fileName || 'file')
          : undefined
      });

      // Parse the response
      const responseData = typeof response === 'string' ? JSON.parse(response) : response;

      // Check if response includes a project plan
      let newPlan: ProjectPlan | undefined;
      if (responseData.plan) {
        newPlan = {
          id: `plan-${Date.now()}`,
          title: responseData.plan.title || 'Project Implementation Plan',
          description: responseData.plan.description || "Here's what I'll build for you:",
          tasks: (responseData.plan.tasks || []).map((task: any, index: number) => ({
            id: task.id || `task-${index}`,
            title: task.title || task.name || 'Task',
            description: task.description || '',
            type: task.type || 'file',
            selected: task.selected !== false, // Default to selected
            required: task.required || false,
            estimated: task.estimated || task.time || '5 min'
          })),
          approved: false
        };
        setCurrentPlan(newPlan);
        setShowPlanDialog(true);
      }

      const assistantMessage: Message = {
        id: responseData.id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseData.content || responseData.message || 'I understand. Let me help you with that.',
        timestamp: new Date(),
        plan: newPlan, // Use the newly created plan
        actions: responseData.actions,
        pricing: responseData.pricing,
        metrics: responseData.metrics,
        type: responseData.type
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If there are actions and auto-execute is enabled, start building
      if (responseData.actions && responseData.actions.length > 0 && responseData.autoExecute) {
        setIsBuilding(true);
        await executeActions(responseData.actions);
      }
    } catch (error: any) {
      console.error('[useAgentSession] Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error.message || 'Failed to send message. Please try again.'}`,
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);

      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, currentPlan]);

  /**
   * Execute a list of agent actions
   */
  const executeActions = useCallback(async (actions: AgentAction[]) => {
    if (!globalApiClient) {
      console.error('[useAgentSession] API client not configured');
      return;
    }

    setBuildProgress(0);
    setIsBuilding(true);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const progress = ((i + 1) / actions.length) * 100;
      setBuildProgress(progress);

      try {
        switch (action.type) {
          case 'create_file':
            await globalApiClient.post(`/api/projects/${projectId}/files`, {
              path: action.path,
              content: action.content || '',
              name: action.data?.name
            });
            break;

          case 'edit_file':
            await globalApiClient.post(`/api/projects/${projectId}/files/update`, {
              path: action.path,
              content: action.content
            });
            break;

          case 'create_folder':
            await globalApiClient.post(`/api/projects/${projectId}/files/folders`, {
              path: action.path || action.data?.path,
              name: action.data?.name
            });
            break;

          case 'install_package':
            await globalApiClient.post(`/api/packages/${projectId}/install`, {
              name: action.package || action.data?.name,
              version: action.version || action.data?.version
            });
            break;

          case 'run_command':
            // Execute command (if supported)
            await globalApiClient.post(`/api/projects/${projectId}/runtime/execute`, {
              command: action.data?.command
            });
            break;

          case 'deploy':
            await globalApiClient.post(`/api/projects/${projectId}/deploy`, {
              config: action.data
            });
            break;
        }

        // Mark action as completed
        action.completed = true;
        action.progress = 100;

        // Update messages with completed action
        setMessages(prev => prev.map(msg => ({
          ...msg,
          actions: msg.actions?.map(a =>
            a.type === action.type && 
            (a.path === action.path || a.package === action.package || a.data?.name === action.data?.name)
              ? { ...a, completed: true, progress: 100 }
              : a
          )
        })));

        // Callback for action completion
        if (onActionCompleteRef.current) {
          onActionCompleteRef.current(action);
        }

        // Simulate delay between actions
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error(`[useAgentSession] Error executing action ${action.type}:`, error);
        
        if (onErrorRef.current) {
          onErrorRef.current(error as Error);
        }
      }
    }

    setIsBuilding(false);
    setBuildProgress(100);

    // Callback for build completion
    if (onBuildCompleteRef.current) {
      onBuildCompleteRef.current();
    }
  }, [projectId]);

  /**
   * Approve a project plan and start building
   */
  const approvePlan = useCallback(async (selectedTasks?: ProjectTask[]) => {
    if (!currentPlan) return;

    const tasksToExecute = selectedTasks || currentPlan.tasks.filter(task => task.selected);

    setCurrentPlan(prev => prev ? { ...prev, approved: true } : null);
    setShowPlanDialog(false);

    // Convert tasks to actions
    const actions: AgentAction[] = tasksToExecute.map(task => ({
      type: task.type === 'file' ? 'create_file' : 
            task.type === 'folder' ? 'create_folder' : 
            task.type === 'package' ? 'install_package' : 'run_command',
      data: {
        name: task.title,
        description: task.description
      },
      completed: false,
      progress: 0,
      approved: true
    }));

    if (actions.length > 0) {
      setIsBuilding(true);
      await executeActions(actions);
    }
  }, [currentPlan, executeActions]);

  /**
   * Cancel the current plan
   */
  const cancelPlan = useCallback(() => {
    setShowPlanDialog(false);
    setCurrentPlan(null);
  }, []);

  /**
   * Toggle task selection in plan
   */
  const toggleTaskSelection = useCallback((taskId: string) => {
    setCurrentPlan(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId ? { ...task, selected: !task.selected } : task
        )
      };
    });
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentPlan(null);
    setShowPlanDialog(false);
    setBuildProgress(0);
  }, []);

  /**
   * Retry the last user message
   */
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content, lastUserMessage.attachments);
    }
  }, [messages, sendMessage]);

  // Return state and actions
  return {
    state: {
      messages,
      isLoading,
      isBuilding,
      buildProgress,
      currentPlan,
      showPlanDialog
    },
    actions: {
      sendMessage,
      executeActions,
      approvePlan,
      cancelPlan,
      toggleTaskSelection,
      clearMessages,
      retryLastMessage
    }
  };
}
