import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatEvent, Message } from '@/types/chatbot';

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  sessionId: string | null;
}

interface UseWebSocketOptions {
  userId?: string;
  conversationId?: string;
  onMessage?: (message: Message) => void;
  onError?: (error: string) => void;
  onConnected?: (sessionId: string) => void;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    userId = 'anonymous',
    conversationId,
    onMessage,
    onError,
    onConnected,
    autoReconnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000
  } = options;

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    sessionId: null
  });

  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = new URL('/ws', `${protocol}//${window.location.host}`);
      wsUrl.searchParams.set('userId', userId);
      
      if (conversationId) {
        wsUrl.searchParams.set('conversationId', conversationId);
      }

      const ws = new WebSocket(wsUrl.toString());

      ws.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({ 
          ...prev, 
          connected: true, 
          connecting: false, 
          error: null 
        }));
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const chatEvent: ChatEvent = JSON.parse(event.data);
          
          switch (chatEvent.type) {
            case 'connected':
              setState(prev => ({ 
                ...prev, 
                sessionId: chatEvent.payload.sessionId 
              }));
              onConnected?.(chatEvent.payload.sessionId);
              break;

            case 'message':
              onMessage?.(chatEvent.payload);
              break;

            case 'typing':
              const { isTyping, userId: typingUserId } = chatEvent.payload;
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                if (isTyping) {
                  newSet.add(typingUserId);
                } else {
                  newSet.delete(typingUserId);
                }
                return newSet;
              });
              break;

            case 'error':
              console.error('WebSocket error:', chatEvent.payload.error);
              onError?.(chatEvent.payload.error);
              setState(prev => ({ 
                ...prev, 
                error: chatEvent.payload.error 
              }));
              break;

            case 'disconnected':
              console.log('Session disconnected:', chatEvent.payload.sessionId);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setState(prev => ({ 
          ...prev, 
          connected: false, 
          connecting: false,
          sessionId: null
        }));
        setTypingUsers(new Set());

        // Attempt reconnection if enabled and not manually closed
        if (autoReconnect && 
            event.code !== 1000 && 
            reconnectCountRef.current < reconnectAttempts) {
          
          reconnectCountRef.current++;
          const delay = reconnectDelay * Math.pow(2, reconnectCountRef.current - 1);
          
          console.log(`Attempting reconnection ${reconnectCountRef.current}/${reconnectAttempts} in ${delay}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection error',
          connecting: false
        }));
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to connect',
        connecting: false
      }));
    }
  }, [userId, conversationId, onMessage, onError, onConnected, autoReconnect, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectCountRef.current = reconnectAttempts; // Prevent auto-reconnect
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
  }, [reconnectAttempts]);

  const sendMessage = useCallback((content: string, context?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'message',
      payload: { content, context }
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'typing',
      payload: { isTyping, userId }
    };

    wsRef.current.send(JSON.stringify(message));
  }, [userId]);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendTypingIndicator
  };
}