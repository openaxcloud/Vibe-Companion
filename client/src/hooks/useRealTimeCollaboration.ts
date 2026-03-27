import { useEffect, useState, useCallback } from 'react';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  cursor?: { line: number; column: number };
  color?: string;
  isActive: boolean;
  lastSeen?: Date;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  edited?: boolean;
}

export interface RealTimeCollaborationState {
  collaborators: Collaborator[];
  messages: ChatMessage[];
  isConnected: boolean;
  error?: string;
}

/**
 * Hook for managing real-time collaboration features
 * Handles collaborator presence, cursor positions, and chat messages
 */
export function useRealTimeCollaboration(projectId: number) {
  const [state, setState] = useState<RealTimeCollaborationState>({
    collaborators: [],
    messages: [],
    isConnected: false,
  });

  const addCollaborator = useCallback((collaborator: Collaborator) => {
    setState((prev) => ({
      ...prev,
      collaborators: [...prev.collaborators.filter((c) => c.id !== collaborator.id), collaborator],
    }));
  }, []);

  const removeCollaborator = useCallback((collaboratorId: string) => {
    setState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== collaboratorId),
    }));
  }, []);

  const updateCollaboratorCursor = useCallback(
    (collaboratorId: string, cursor: { line: number; column: number }) => {
      setState((prev) => ({
        ...prev,
        collaborators: prev.collaborators.map((c) =>
          c.id === collaboratorId ? { ...c, cursor } : c
        ),
      }));
    },
    []
  );

  const addMessage = useCallback((message: ChatMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
    }));
  }, []);

  useEffect(() => {
    // In a real implementation, this would establish a WebSocket connection
    // For now, we just set up the hook structure
    setState((prev) => ({ ...prev, isConnected: true }));

    return () => {
      // Cleanup connection
    };
  }, [projectId]);

  return {
    ...state,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorCursor,
    addMessage,
    clearMessages,
  };
}
