/**
 * Schema Warming Store - Client-side State for Background Schema Pre-Drafting
 * 
 * Tracks the status of background schema warming while users chat.
 * Connects to backend SSE for real-time progress updates.
 * 
 * @author E-Code Platform
 * @version 2.0.0
 * @since December 2025
 */

import { create } from 'zustand';
import { apiRequest } from '@/lib/queryClient';

export type WarmingStatus = 'idle' | 'analyzing' | 'warming' | 'ready' | 'error';

export interface WarmingProgress {
  status: WarmingStatus;
  progress: number;
  message: string;
  schemaPreview?: string;
  estimatedTimeRemaining?: number;
}

interface SchemaWarmingState {
  projectId: string | null;
  progress: WarmingProgress;
  isWarming: boolean;
  isReady: boolean;
  eventSource: EventSource | null;
  
  // Actions
  setProjectId: (projectId: string) => void;
  updateProgress: (progress: Partial<WarmingProgress>) => void;
  startWarming: (projectId: string, prompt: string) => void;
  subscribeToStream: (projectId: string) => void;
  markReady: () => void;
  reset: () => void;
}

const initialProgress: WarmingProgress = {
  status: 'idle',
  progress: 0,
  message: 'Waiting to start...',
};

export const useSchemaWarmingStore = create<SchemaWarmingState>((set, get) => ({
  projectId: null,
  progress: initialProgress,
  isWarming: false,
  isReady: false,
  eventSource: null,

  setProjectId: (projectId: string) => {
    set({ projectId });
  },

  updateProgress: (progress: Partial<WarmingProgress>) => {
    set((state) => ({
      progress: { ...state.progress, ...progress },
      isWarming: progress.status === 'analyzing' || progress.status === 'warming',
      isReady: progress.status === 'ready',
    }));
  },

  subscribeToStream: (projectId: string) => {
    const state = get();
    
    // Close existing connection
    if (state.eventSource) {
      state.eventSource.close();
    }
    
    // Create SSE connection to backend
    const eventSource = new EventSource(`/api/agent/schema/stream/${projectId}`, {
      withCredentials: true,
    });
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          set({
            progress: {
              status: data.status || 'warming',
              progress: data.progress || 50,
              message: data.message || 'Processing...',
            },
            isWarming: true,
          });
        } else if (data.type === 'ready') {
          set({
            progress: {
              status: 'ready',
              progress: 100,
              message: 'Schema warmed and ready',
              schemaPreview: data.schemaPreview,
            },
            isWarming: false,
            isReady: true,
          });
          eventSource.close();
        } else if (data.type === 'error') {
          set({
            progress: {
              status: 'error',
              progress: 0,
              message: data.error || 'Schema warming failed',
            },
            isWarming: false,
          });
          eventSource.close();
        } else if (data.type === 'status') {
          set({
            progress: {
              status: data.status || 'idle',
              progress: data.progress || 0,
              message: data.message || 'Checking status...',
            },
          });
        }
      } catch {
        console.warn('[SchemaWarming] Failed to parse SSE message');
      }
    };
    
    eventSource.onerror = () => {
      eventSource.close();
      set({ eventSource: null, isReady: true, isWarming: false, progress: { status: 'ready', progress: 100, message: 'Ready' } });
    };
    
    set({ eventSource, projectId });
  },

  startWarming: async (projectId: string, prompt: string) => {
    const state = get();
    if (state.isWarming && state.projectId === projectId) {
      return; // Already warming this project
    }

    set({
      projectId,
      progress: {
        status: 'analyzing',
        progress: 10,
        message: 'Analyzing your app requirements...',
      },
      isWarming: true,
      isReady: false,
    });

    try {
      // Trigger backend warming
      await apiRequest('POST', '/api/agent/schema/warm', { projectId, prompt });
      
      // Subscribe to SSE stream for real-time updates
      get().subscribeToStream(projectId);
    } catch (error) {
      console.error('[SchemaWarming] Failed to start:', error);
      set({
        progress: {
          status: 'ready',
          progress: 100,
          message: 'Ready',
        },
        isWarming: false,
        isReady: true,
      });
    }
  },

  markReady: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    
    set({
      progress: {
        status: 'ready',
        progress: 100,
        message: 'Schema warmed and ready for deployment',
      },
      isWarming: false,
      isReady: true,
      eventSource: null,
    });
  },

  reset: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    
    set({
      projectId: null,
      progress: initialProgress,
      isWarming: false,
      isReady: false,
      eventSource: null,
    });
  },
}));

/**
 * Get user-friendly status message for current warming state
 */
export function getWarmingStatusMessage(status: WarmingStatus): string {
  switch (status) {
    case 'idle':
      return 'Start chatting to begin schema analysis';
    case 'analyzing':
      return 'Analyzing your app requirements...';
    case 'warming':
      return 'Pre-drafting your database schema...';
    case 'ready':
      return 'Ready to deploy!';
    case 'error':
      return 'Schema warming failed';
    default:
      return 'Preparing...';
  }
}

/**
 * Get the "app not ready" message for tabs
 */
export function getAppNotReadyMessage(tabName: string, status: WarmingStatus): string {
  if (status === 'ready') {
    return '';
  }

  const baseMessages: Record<string, string> = {
    preview: 'Your app preview will appear here once the AI Agent finishes building',
    deploy: 'Deploy will be available once your app is ready',
    files: 'Files will populate as the AI Agent generates your app',
    default: `${tabName} will be available once your app is ready`,
  };

  const warmingAppend = status === 'warming' 
    ? '\n\nSchema is being pre-drafted in the background...' 
    : status === 'analyzing'
    ? '\n\nAnalyzing your requirements...'
    : '';

  return (baseMessages[tabName.toLowerCase()] || baseMessages.default) + warmingAppend;
}
