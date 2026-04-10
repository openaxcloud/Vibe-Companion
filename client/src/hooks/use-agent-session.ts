import { useState, useEffect, useCallback } from 'react';

export interface AgentSessionData {
  messages?: any[];
  agentMode?: 'autonomous' | 'plan';
  selectedModel?: string;
  extendedThinking?: boolean;
  highPowerMode?: boolean;
  autoCheckpoints?: boolean;
  autoApprovePlans?: boolean;
  autonomousModeEnabled?: boolean;
  pendingActions?: any[];
  timestamp?: number;
}

interface UseAgentSessionReturn {
  session: AgentSessionData | null;
  isLoading: boolean;
  saveSession: (data: Partial<AgentSessionData>) => void;
  clearSession: () => void;
  updateMessages: (messages: any[]) => void;
  updateSettings: (settings: Partial<AgentSessionData>) => void;
}

/**
 * Hook for managing AI Agent session state per-project
 * Uses sessionStorage with key `agent-session-${projectId}`
 * 
 * @param projectId Project ID to scope the session
 * @returns Session data and management functions
 */
export function useAgentSession(projectId: string | number): UseAgentSessionReturn {
  const [session, setSession] = useState<AgentSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `agent-session-${projectId}`;

  // Load session from sessionStorage on mount
  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as AgentSessionData;
        
        // Validate timestamp (expire after 24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (parsed.timestamp && Date.now() - parsed.timestamp < maxAge) {
          setSession(parsed);
        } else {
          sessionStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      sessionStorage.removeItem(storageKey);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, storageKey]);

  // Save session to sessionStorage
  const saveSession = useCallback((data: Partial<AgentSessionData>) => {
    try {
      // FIX: Guard against null session (first-time users)
      const updated: AgentSessionData = {
        ...(session || {}),
        ...data,
        timestamp: Date.now(),
      };
      
      sessionStorage.setItem(storageKey, JSON.stringify(updated));
      setSession(updated);
    } catch (error) {
    }
  }, [session, storageKey, projectId]);

  // Clear session from sessionStorage
  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
      setSession(null);
    } catch (error) {
    }
  }, [storageKey, projectId]);

  // Helper: Update messages array
  const updateMessages = useCallback((messages: any[]) => {
    saveSession({ messages });
  }, [saveSession]);

  // Helper: Update settings (mode, model, flags)
  const updateSettings = useCallback((settings: Partial<AgentSessionData>) => {
    saveSession(settings);
  }, [saveSession]);

  return {
    session,
    isLoading,
    saveSession,
    clearSession,
    updateMessages,
    updateSettings,
  };
}
