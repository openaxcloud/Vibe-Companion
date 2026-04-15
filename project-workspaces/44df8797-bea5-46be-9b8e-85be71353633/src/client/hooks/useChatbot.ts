import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ChatState, 
  Conversation, 
  Message, 
  ConversationSettings, 
  ChatbotError 
} from '../../types/index';

interface UseChatbotReturn {
  state: ChatState;
  sendMessage: (content: string, settings?: Partial<ConversationSettings>) => Promise<void>;
  createConversation: (title?: string, settings?: Partial<ConversationSettings>) => Promise<void>;
  selectConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  updateSettings: (conversationId: string, settings: Partial<ConversationSettings>) => Promise<void>;
  clearError: () => void;
}

const API_BASE = '/api/chat';

export function useChatbot(): UseChatbotReturn {
  const [state, setState] = useState<ChatState>({
    currentConversation: null,
    conversations: [],
    isLoading: false,
    error: null,
    isTyping: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const setError = useCallback((error: ChatbotError) => {
    setState(prev => ({ ...prev, error, isLoading: false, isTyping: false }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const handleApiError = useCallback((error: any): ChatbotError => {
    if (error.name === 'AbortError') {
      return { type: 'NETWORK_ERROR', message: 'Request was cancelled' };
    }
    
    if (error.message?.includes('API key')) {
      return { type: 'INVALID_API_KEY', message: 'Invalid API key configuration' };
    }
    
    if (error.message?.includes('rate limit')) {
      return { type: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Please try again later.' };
    }
    
    if (error.message?.includes('network') || error.name === 'NetworkError') {
      return { type: 'NETWORK_ERROR', message: 'Network connection failed' };
    }
    
    return { 
      type: 'UNKNOWN_ERROR', 
      message: error.message || 'An unexpected error occurred' 
    };
  }, []);

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const data = await apiRequest('/conversations');
      
      setState(prev => ({
        ...prev,
        conversations: data.conversations || [],
        isLoading: false,
      }));
    } catch (error) {
      setError(handleApiError(error));
    }
  }, [apiRequest, setError, handleApiError]);

  const sendMessage = useCallback(async (
    content: string, 
    settings?: Partial<ConversationSettings>
  ) => {
    if (!content.trim()) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const requestData = {
        content: content.trim(),
        conversationId: state.currentConversation?.id,
        settings,
      };

      const data = await apiRequest('/message', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });

      setState(prev => ({
        ...prev,
        currentConversation: data.conversation,
        conversations: prev.conversations.map(conv => 
          conv.id === data.conversation.id ? data.conversation : conv
        ).concat(
          prev.conversations.some(conv => conv.id === data.conversation.id) 
            ? [] 
            : [data.conversation]
        ),
        isLoading: false,
      }));

    } catch (error) {
      setError(handleApiError(error));
    }
  }, [state.currentConversation?.id, apiRequest, setError, handleApiError]);

  const createConversation = useCallback(async (
    title?: string, 
    settings?: Partial<ConversationSettings>
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const data = await apiRequest('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title, settings }),
      });

      setState(prev => ({
        ...prev,
        currentConversation: data,
        conversations: [data, ...prev.conversations],
        isLoading: false,
      }));

    } catch (error) {
      setError(handleApiError(error));
    }
  }, [apiRequest, setError, handleApiError]);

  const selectConversation = useCallback((conversationId: string) => {
    const conversation = state.conversations.find(c => c.id === conversationId);
    if (conversation) {
      setState(prev => ({
        ...prev,
        currentConversation: conversation,
        error: null,
      }));
    }
  }, [state.conversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await apiRequest(`/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== conversationId),
        currentConversation: prev.currentConversation?.id === conversationId 
          ? null 
          : prev.currentConversation,
        isLoading: false,
      }));

    } catch (error) {
      setError(handleApiError(error));
    }
  }, [apiRequest, setError, handleApiError]);

  const clearConversation = useCallback(async (conversationId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const data = await apiRequest(`/conversations/${conversationId}/messages`, {
        method: 'DELETE',
      });

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c => 
          c.id === conversationId ? data : c
        ),
        currentConversation: prev.currentConversation?.id === conversationId 
          ? data 
          : prev.currentConversation,
        isLoading: false,
      }));

    } catch (error) {
      setError(handleApiError(error));
    }
  }, [apiRequest, setError, handleApiError]);

  const updateSettings = useCallback(async (
    conversationId: string, 
    settings: Partial<ConversationSettings>
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const data = await apiRequest(`/conversations/${conversationId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c => 
          c.id === conversationId ? data : c
        ),
        currentConversation: prev.currentConversation?.id === conversationId 
          ? data 
          : prev.currentConversation,
        isLoading: false,
      }));

    } catch (error) {
      setError(handleApiError(error));
    }
  }, [apiRequest, setError, handleApiError]);

  // Cancel ongoing requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    state,
    sendMessage,
    createConversation,
    selectConversation,
    deleteConversation,
    clearConversation,
    loadConversations,
    updateSettings,
    clearError,
  };
}