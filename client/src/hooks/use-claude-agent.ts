import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface ClaudeAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: any;
  isError?: boolean;
  action?: string;
}

export interface ClaudeAgentState {
  configured: boolean;
  sessionId: string | null;
  claudeSessionId: string | null;
  streaming: boolean;
  status: 'idle' | 'connecting' | 'processing' | 'error';
  messages: ClaudeAgentMessage[];
  error: string | null;
}

export function useClaudeAgent(projectId: string) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ClaudeAgentState>({
    configured: false,
    sessionId: null,
    claudeSessionId: null,
    streaming: false,
    status: 'idle',
    messages: [],
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const messageIdCounter = useRef(0);

  const genId = () => `claude-msg-${Date.now()}-${messageIdCounter.current++}`;

  const addMessage = useCallback((msg: Omit<ClaudeAgentMessage, 'id' | 'timestamp'>) => {
    const full: ClaudeAgentMessage = { ...msg, id: genId(), timestamp: Date.now() };
    setState(prev => ({ ...prev, messages: [...prev.messages, full] }));
    return full;
  }, []);

  const initSession = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'connecting', error: null }));

    try {
      const res = await fetch(`/api/projects/${projectId}/agent/session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to create session' }));
        setState(prev => ({
          ...prev,
          status: 'error',
          configured: false,
          error: data.message || data.error,
        }));
        return null;
      }

      const data = await res.json();
      setState(prev => ({
        ...prev,
        configured: data.configured,
        sessionId: data.sessionId,
        claudeSessionId: data.claudeSessionId,
        status: 'idle',
        error: null,
      }));

      return data;
    } catch (err: any) {
      setState(prev => ({ ...prev, status: 'error', error: err.message }));
      return null;
    }
  }, [projectId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!state.sessionId || !state.claudeSessionId) {
      const session = await initSession();
      if (!session) return;

      addMessage({ role: 'user', content: message });

      setState(prev => ({ ...prev, streaming: true, status: 'processing' }));

      try {
        await fetch(`/api/projects/${projectId}/agent/message`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.sessionId,
            claudeSessionId: session.claudeSessionId,
            message,
          }),
        });
      } catch (err: any) {
        setState(prev => ({ ...prev, streaming: false, status: 'error', error: err.message }));
      }
      return;
    }

    addMessage({ role: 'user', content: message });
    setState(prev => ({ ...prev, streaming: true, status: 'processing' }));

    try {
      await fetch(`/api/projects/${projectId}/agent/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          claudeSessionId: state.claudeSessionId,
          message,
        }),
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, streaming: false, status: 'error', error: err.message }));
    }
  }, [state.sessionId, state.claudeSessionId, projectId, initSession, addMessage]);

  const archiveSession = useCallback(async () => {
    if (!state.sessionId || !state.claudeSessionId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      await fetch(`/api/projects/${projectId}/agent/archive`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          claudeSessionId: state.claudeSessionId,
        }),
      });
    } catch {}

    setState(prev => ({
      ...prev,
      sessionId: null,
      claudeSessionId: null,
      streaming: false,
      status: 'idle',
    }));
  }, [state.sessionId, state.claudeSessionId, projectId]);

  const handleWsEvent = useCallback((data: any) => {
    const eventType = data.type?.replace('claude_agent:', '') || data.type;

    switch (eventType) {
      case 'agent_message': {
        const text = data.data?.text || '';
        if (text) {
          setState(prev => {
            const lastMsg = prev.messages[prev.messages.length - 1];
            if (lastMsg?.role === 'assistant' && !lastMsg.toolName) {
              const updated = [...prev.messages];
              updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content + text };
              return { ...prev, messages: updated };
            }
            return { ...prev, messages: [...prev.messages, { id: genId(), role: 'assistant', content: text, timestamp: Date.now() }] };
          });
        }
        break;
      }

      case 'agent_tool_use': {
        addMessage({
          role: 'tool',
          content: `Using tool: ${data.data?.tool}`,
          toolName: data.data?.tool,
          toolInput: data.data?.input,
          action: data.data?.tool,
        });
        break;
      }

      case 'agent_tool_result': {
        if (data.data?.content) {
          const text = typeof data.data.content === 'string'
            ? data.data.content
            : JSON.stringify(data.data.content);
          addMessage({
            role: 'tool',
            content: text.substring(0, 2000),
            isError: data.data.isError,
          });
        }
        break;
      }

      case 'file_created':
      case 'file_updated': {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
        break;
      }

      case 'terminal_command':
      case 'terminal_output':
        break;

      case 'preview_refresh': {
        queryClient.invalidateQueries({ queryKey: [`/api/preview/projects/${projectId}`] });
        break;
      }

      case 'packages_refresh': {
        queryClient.invalidateQueries({ queryKey: [`/api/packages`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/packages`] });
        break;
      }

      case 'database_refresh': {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/database`] });
        break;
      }

      case 'agent_status': {
        if (data.data?.status === 'idle') {
          setState(prev => ({ ...prev, streaming: false, status: 'idle' }));
        }
        break;
      }

      case 'agent_error': {
        setState(prev => ({
          ...prev,
          streaming: false,
          status: 'error',
          error: data.data?.message || 'Agent error',
        }));
        addMessage({
          role: 'system',
          content: `Error: ${data.data?.message || 'Unknown error'}`,
          isError: true,
        });
        break;
      }
    }
  }, [projectId, queryClient, addMessage]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    initSession,
    sendMessage,
    archiveSession,
    handleWsEvent,
    clearMessages: useCallback(() => {
      setState(prev => ({ ...prev, messages: [] }));
    }, []),
  };
}
