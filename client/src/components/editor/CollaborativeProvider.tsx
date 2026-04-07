import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { EditorView } from '@codemirror/view';
import { 
  createCollaborationExtension,
  disconnectCollaboration,
  getCollaborators,
  onCollaboratorsChange,
  userColors,
  type Collaborator,
} from '@/lib/cm6/collaboration-adapter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Participant {
  user: {
    id: string;
    username: string;
    color: string;
  };
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

interface CollaborativeProviderProps {
  projectId: string;
  fileId: number;
  editor: EditorView | null;
  enabled?: boolean;
  onParticipantsChange?: (participants: Participant[]) => void;
  children?: React.ReactNode;
}

interface CollaborativeContextValue {
  isConnected: boolean;
  participants: Participant[];
  sessionId: string | null;
  userColor: string | null;
  shareLink: string | null;
  generateShareLink: () => Promise<string>;
  followUser: (userId: string) => void;
  getCollaborationExtensions: () => ReturnType<typeof createCollaborationExtension> | null;
}

const CollaborativeContext = createContext<CollaborativeContextValue | null>(null);

export const useCollaboration = () => {
  const context = useContext(CollaborativeContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborativeProvider');
  }
  return context;
};

export function CollaborativeProvider({
  projectId,
  fileId,
  editor,
  enabled = true,
  onParticipantsChange,
  children,
}: CollaborativeProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const collaborationExtensionsRef = useRef<ReturnType<typeof createCollaborationExtension> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cleanupAwarenessRef = useRef<(() => void) | null>(null);

  const { toast } = useToast();

  const convertCollaboratorToParticipant = useCallback((collaborator: Collaborator): Participant => {
    return {
      user: {
        id: collaborator.userId,
        username: collaborator.name,
        color: collaborator.color,
      },
      cursor: collaborator.cursor ? {
        line: 0,
        column: collaborator.cursor.anchor,
      } : undefined,
    };
  }, []);

  const initializeYjs = useCallback(() => {
    if (!editor || ydocRef.current) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;

    const userId = localStorage.getItem('userId') || `user-${Date.now()}`;
    const userName = localStorage.getItem('userName') || 'Anonymous';
    const color = userColor || userColors[Math.floor(Math.random() * userColors.length)];

    const extensions = createCollaborationExtension({
      doc: ydoc,
      provider: wsRef.current,
      userId,
      userName,
      userColor: color,
      awareness,
      textField: 'content',
    });

    collaborationExtensionsRef.current = extensions;

    cleanupAwarenessRef.current = onCollaboratorsChange(awareness, (collaborators) => {
      const newParticipants = collaborators.map(convertCollaboratorToParticipant);
      setParticipants(newParticipants);
    });

    ydoc.on('update', (update: Uint8Array) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'document-update',
          data: Array.from(update),
        }));
      }
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request-state',
      }));
    }
  }, [editor, userColor, convertCollaboratorToParticipant]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'auth-success':
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'join-session',
            data: { projectId, fileId },
          }));
        }
        break;

      case 'auth-failed':
        toast({
          title: 'Authentication failed',
          description: 'Please log in to use collaborative editing',
          variant: 'destructive',
        });
        break;

      case 'session-joined':
        setSessionId(message.data.sessionId);
        setUserColor(message.data.color);
        
        if (message.data.participants) {
          const initialParticipants = message.data.participants.map((p: any) => ({
            user: {
              id: p.user?.id || p.id,
              username: p.user?.username || p.username || 'Anonymous',
              color: p.user?.color || p.color,
            },
            cursor: p.cursor,
            selection: p.selection,
          }));
          setParticipants(initialParticipants);
        }
        
        initializeYjs();
        
        toast({
          title: 'Collaboration started',
          description: `You joined the editing session`,
        });
        break;

      case 'participant-joined':
        setParticipants(prev => [
          ...prev,
          {
            user: {
              id: message.data.id || message.data.userId,
              username: message.data.username || 'Anonymous',
              color: message.data.color,
            },
            cursor: undefined,
            selection: undefined,
          },
        ]);
        
        toast({
          title: 'User joined',
          description: `${message.data.username || 'A user'} joined the session`,
        });
        break;

      case 'participant-leave':
        setParticipants(prev => 
          prev.filter(p => p.user.id !== message.data.userId)
        );
        
        toast({
          title: 'User left',
          description: `${message.data.username || 'A user'} left the session`,
        });
        break;

      case 'document-update':
        if (ydocRef.current) {
          const update = new Uint8Array(message.data);
          Y.applyUpdate(ydocRef.current, update);
        }
        break;

      case 'cursor-update':
        setParticipants(prev => prev.map(p => 
          p.user.id === message.data.userId
            ? { ...p, cursor: message.data.cursor }
            : p
        ));
        break;

      case 'selection-update':
        setParticipants(prev => prev.map(p => 
          p.user.id === message.data.userId
            ? { ...p, selection: message.data.selection }
            : p
        ));
        break;

      case 'state-update':
        if (ydocRef.current && message.data.document) {
          const update = new Uint8Array(message.data.document);
          Y.applyUpdate(ydocRef.current, update);
        }
        if (message.data.participants) {
          const updatedParticipants = message.data.participants.map((p: any) => ({
            user: {
              id: p.user?.id || p.id,
              username: p.user?.username || p.username || 'Anonymous',
              color: p.user?.color || p.color,
            },
            cursor: p.cursor,
            selection: p.selection,
          }));
          setParticipants(updatedParticipants);
        }
        break;
    }
  }, [projectId, fileId, toast, initializeYjs]);

  useEffect(() => {
    if (!enabled || !editor) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collaborate`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        const token = localStorage.getItem('authToken') || '';
        
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          toast({
            title: 'Connection lost',
            description: 'Unable to reconnect to collaboration server',
            variant: 'destructive',
          });
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (cleanupAwarenessRef.current) {
        cleanupAwarenessRef.current();
      }
      disconnectCollaboration();
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
      awarenessRef.current = null;
      collaborationExtensionsRef.current = null;
    };
  }, [enabled, editor, toast, handleWebSocketMessage]);

  const generateShareLink = async (): Promise<string> => {
    try {
      const response = await apiRequest('POST', '/api/collaboration/generate-link', { projectId, fileId });

      if (!response.ok) throw new Error('Failed to generate share link');

      const { link } = await response.json();
      setShareLink(link);
      return link;
    } catch (error) {
      console.error('Error generating share link:', error);
      throw error;
    }
  };

  const followUser = useCallback((userId: string) => {
    const participant = participants.find(p => p.user.id === userId);
    if (participant?.cursor && editor) {
      const doc = editor.state.doc;
      const line = Math.min(participant.cursor.line, doc.lines);
      const lineInfo = doc.line(Math.max(1, line));
      const pos = lineInfo.from + Math.min(participant.cursor.column, lineInfo.length);
      
      editor.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
    }
  }, [participants, editor]);

  const getCollaborationExtensions = useCallback(() => {
    return collaborationExtensionsRef.current;
  }, []);

  useEffect(() => {
    onParticipantsChange?.(participants);
  }, [participants, onParticipantsChange]);

  const contextValue: CollaborativeContextValue = {
    isConnected,
    participants,
    sessionId,
    userColor,
    shareLink,
    generateShareLink,
    followUser,
    getCollaborationExtensions,
  };

  return (
    <CollaborativeContext.Provider value={contextValue}>
      {children}
    </CollaborativeContext.Provider>
  );
}
