import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface Collaborator {
  id: string;
  odUserId: string | number;
  username: string;
  avatar?: string;
  color: string;
  status: 'active' | 'idle' | 'away';
  currentFile?: string;
  activity?: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastSeen: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file-change';
}

export interface TypingIndicator {
  odUserId: string;
  username: string;
  isTyping: boolean;
}

export interface FileChangeNotification {
  odUserId: string;
  username: string;
  file: string;
  action: 'create' | 'update' | 'delete';
}

interface UseRealTimeCollaborationOptions {
  projectId: number;
  autoConnect?: boolean;
}

export function useRealTimeCollaboration({ projectId, autoConnect = true }: UseRealTimeCollaborationOptions) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!user || !projectId || socketRef.current?.connected) return;

    const wsUrl = `${window.location.protocol}//${window.location.host}`;

    const socket = io(wsUrl, {
      path: '/ws/collaboration',
      query: {
        projectId: projectId.toString(),
        odUserId: user.id.toString(),
        username: user.username || 'Anonymous',
        avatar: user.avatarUrl || undefined
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true,
      timeout: 30000
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setError('Unable to connect to collaboration server');
      }
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('collaborator:joined', (data: { collaborator: Collaborator; collaborators: Collaborator[]; chatHistory: ChatMessage[] }) => {
      setCollaborators(data.collaborators.filter(c => c.odUserId !== user.id));
      setChatMessages(data.chatHistory);
    });

    socket.on('collaborator:left', (data: { socketId: string; collaborators: Collaborator[] }) => {
      setCollaborators(data.collaborators.filter(c => c.odUserId !== user.id));
      if (followingUserId) {
        const stillPresent = data.collaborators.some(c => c.odUserId === followingUserId);
        if (!stillPresent) {
          setFollowingUserId(null);
        }
      }
    });

    socket.on('cursor:updated', (data: { odUserId: string; socketId: string; cursor: CursorPosition; currentFile?: string; color: string; username: string }) => {
      setCollaborators(prev => prev.map(c => 
        c.id === data.socketId ? { ...c, cursor: data.cursor, currentFile: data.currentFile } : c
      ));
    });

    socket.on('selection:updated', (data: { odUserId: string; socketId: string; selection: SelectionRange; color: string; username: string }) => {
      setCollaborators(prev => prev.map(c => 
        c.id === data.socketId ? { ...c, selection: data.selection } : c
      ));
    });

    socket.on('activity:updated', (data: { odUserId: string; socketId: string; activity: string; currentFile?: string }) => {
      setCollaborators(prev => prev.map(c => 
        c.id === data.socketId ? { ...c, activity: data.activity, currentFile: data.currentFile } : c
      ));
    });

    socket.on('status:updated', (data: { odUserId: string; socketId: string; status: 'active' | 'idle' | 'away' }) => {
      setCollaborators(prev => prev.map(c => 
        c.id === data.socketId ? { ...c, status: data.status } : c
      ));
    });

    socket.on('chat:message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-499), message]);
    });

    socket.on('chat:typing', (data: TypingIndicator) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          const exists = prev.some(u => u.odUserId === data.odUserId);
          if (exists) return prev;
          return [...prev, data];
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.odUserId !== data.odUserId));
      }
    });

    socket.on('file:changed', (_data: FileChangeNotification) => {});

    socket.on('follow:requested', (_data: { followerId: string; followerName: string; targetUserId: string }) => {});

    socketRef.current = socket;
  }, [user, projectId, followingUserId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setChatMessages([]);
      setTypingUsers([]);
    }
  }, []);

  useEffect(() => {
    if (autoConnect && user && projectId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, user, projectId, connect, disconnect]);

  const updateCursor = useCallback((lineNumber: number, column: number, file?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cursor:update', { lineNumber, column, file });
    }
  }, []);

  const updateSelection = useCallback((selection: SelectionRange) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('selection:update', selection);
    }
  }, []);

  const updateActivity = useCallback((activity: string, file?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('activity:update', { activity, file });
    }
  }, []);

  const updateStatus = useCallback((status: 'active' | 'idle' | 'away') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('status:update', { status });
    }
  }, []);

  const sendChatMessage = useCallback((content: string) => {
    if (socketRef.current?.connected && content.trim()) {
      socketRef.current.emit('chat:message', { content: content.trim() });
    }
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current?.connected) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      socketRef.current.emit('chat:typing', { isTyping });
      
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          socketRef.current?.emit('chat:typing', { isTyping: false });
        }, 3000);
      }
    }
  }, []);

  const notifyFileChange = useCallback((file: string, action: 'create' | 'update' | 'delete') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file:change', { file, action });
    }
  }, []);

  const followUser = useCallback((odUserId: string | null) => {
    setFollowingUserId(odUserId);
    if (socketRef.current?.connected && odUserId) {
      socketRef.current.emit('follow:request', { targetUserId: odUserId });
    }
  }, []);

  const getCollaboratorCursor = useCallback((odUserId: string) => {
    return collaborators.find(c => c.odUserId === odUserId)?.cursor;
  }, [collaborators]);

  return {
    isConnected,
    collaborators,
    chatMessages,
    typingUsers,
    followingUserId,
    error,
    
    connect,
    disconnect,
    updateCursor,
    updateSelection,
    updateActivity,
    updateStatus,
    sendChatMessage,
    setTyping,
    notifyFileChange,
    followUser,
    getCollaboratorCursor,
    
    activeCount: collaborators.filter(c => c.status === 'active').length + 1,
    totalCount: collaborators.length + 1
  };
}

export default useRealTimeCollaboration;
