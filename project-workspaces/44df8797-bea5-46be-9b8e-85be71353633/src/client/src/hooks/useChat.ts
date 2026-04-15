import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message, ChatRequest, ApiResponse, ChatResponse } from '../../../shared/types';

export interface UseChatReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  createConversation: () => Promise<void>;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useChat = (): UseChatReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async (): Promise<void> => {
    try {
      const response = await fetch('/api/chat/conversations');
      const result: ApiResponse<Conversation[]> = await response.json();
      
      if (result.success) {
        setConversations(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load conversations');
    }
  };

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        message: content,
        conversationId: currentConversationId || undefined,
      };

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: ApiResponse<ChatResponse> = await response.json();

      if (result.success) {
        // Update conversations with new messages
        await loadConversations();
        
        // Set current conversation if it's a new one
        if (!currentConversationId) {
          setCurrentConversationId(result.data.conversationId);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId]);

  const createConversation = useCallback(async (): Promise<void> => {
    setCurrentConversationId(null);
    setError(null);
  }, []);

  const selectConversation = useCallback((id: string): void => {
    setCurrentConversationId(id);
    setError(null);
  }, []);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
      });

      const result: ApiResponse<{ deleted: boolean }> = await response.json();

      if (result.success) {
        setConversations(prev => prev.filter(c => c.id !== id));
        
        // Clear current conversation if it was deleted
        if (currentConversationId === id) {
          setCurrentConversationId(null);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to delete conversation');
    }
  }, [currentConversationId]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    conversations,
    currentConversation,
    isLoading,
    error,
    sendMessage,
    createConversation,
    selectConversation,
    deleteConversation,
    clearError,
  };
};