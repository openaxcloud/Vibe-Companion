import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { safeJsonParse } from './safe-json';

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];

export function generateCursorColor(userId: number | string): string {
  const userIdStr = String(userId);
  let hash = 0;
  for (let i = 0; i < userIdStr.length; i++) {
    hash = userIdStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

type Position = {
  lineNumber: number;
  column: number;
};

export interface CollaboratorCursor {
  id: number;
  name: string;
  color: string;
  fileId: number;
  position: Position;
  selection?: { start: Position; end: Position };
}

type CursorPosition = {
  userId: number;
  username: string;
  color: string;
  fileId: number;
  position: Position;
  selection?: { start: Position; end: Position };
};

type CollaborationMessage = {
  type: 'cursor_move' | 'edit' | 'user_joined' | 'user_left';
  data: any;
  userId: number;
  username: string;
  projectId: number;
  fileId: number;
  timestamp: number;
};

export function useCollaboration(projectId: number | undefined, fileId: number | undefined) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [cursors, setCursors] = useState<Record<number, CursorPosition>>({});
  const [collaborators, setCollaborators] = useState<{ userId: number; username: string }[]>([]);
  const { user } = useAuth();
  
  useEffect(() => {
    if (!projectId || !fileId || !user) return;
    
    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    
    const userColor = generateCursorColor(user.id);
    
    ws.onopen = () => {
      // Send join message
      const joinMessage: CollaborationMessage = {
        type: 'user_joined',
        data: { color: userColor },
        userId: user.id,
        username: user.username,
        projectId,
        fileId,
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(joinMessage));
    };
    
    ws.onmessage = (event) => {
      const message = safeJsonParse<CollaborationMessage | null>(event.data, null);
      if (!message) return;
      
      // Ignore own messages
      if (message.userId === user.id) return;
      
      // Only handle messages for current project/file
      if (message.projectId !== projectId) return;
      
      switch (message.type) {
        case 'cursor_move':
          setCursors(prev => ({
            ...prev,
            [message.userId]: {
              userId: message.userId,
              username: message.username,
              color: message.data.color || generateCursorColor(message.userId),
              fileId: message.fileId,
              position: message.data.position,
              selection: message.data.selection
            }
          }));
          break;
          
        case 'user_joined':
          setCollaborators(prev => {
            // Add only if not already in the list
            if (!prev.some(c => c.userId === message.userId)) {
              return [...prev, { userId: message.userId, username: message.username }];
            }
            return prev;
          });
          
          setCursors(prev => ({
            ...prev,
            [message.userId]: {
              userId: message.userId,
              username: message.username,
              color: message.data.color || generateCursorColor(message.userId),
              fileId: message.fileId,
              position: { lineNumber: 1, column: 1 }
            }
          }));
          
          // Send current cursor position to the new user
          const cursorPositionMessage: CollaborationMessage = {
            type: 'cursor_move',
            data: {
              position: { lineNumber: 1, column: 1 },
              color: userColor
            },
            userId: user.id,
            username: user.username,
            projectId,
            fileId,
            timestamp: Date.now()
          };
          
          ws.send(JSON.stringify(cursorPositionMessage));
          break;
          
        case 'user_left':
          setCursors(prev => {
            const newCursors = { ...prev };
            delete newCursors[message.userId];
            return newCursors;
          });
          
          setCollaborators(prev => 
            prev.filter(c => c.userId !== message.userId)
          );
          break;
          
        case 'edit':
          // This will be handled in the Monaco editor integration
          break;
          
        default:
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error', error);
    };
    
    ws.onclose = () => {
      // Send leave message before socket closes
      if (ws.readyState === WebSocket.OPEN) {
        const leaveMessage: CollaborationMessage = {
          type: 'user_left',
          data: {},
          userId: user.id,
          username: user.username,
          projectId,
          fileId,
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(leaveMessage));
      }
    };
    
    setSocket(ws);
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        const leaveMessage: CollaborationMessage = {
          type: 'user_left',
          data: {},
          userId: user.id,
          username: user.username,
          projectId,
          fileId,
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(leaveMessage));
        ws.close();
      }
    };
  }, [projectId, fileId, user]);
  
  const updateCursorPosition = (position: { lineNumber: number; column: number }, selection?: { start: Position; end: Position }) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !user) return;
    
    const message: CollaborationMessage = {
      type: 'cursor_move',
      data: {
        position,
        color: generateCursorColor(user.id),
        selection
      },
      userId: user.id,
      username: user.username,
      projectId: projectId || 0,
      fileId: fileId || 0,
      timestamp: Date.now()
    };
    
    socket.send(JSON.stringify(message));
  };
  
  const sendEdit = (changes: any) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !user) return;
    
    const message: CollaborationMessage = {
      type: 'edit',
      data: { changes },
      userId: user.id,
      username: user.username,
      projectId: projectId || 0,
      fileId: fileId || 0,
      timestamp: Date.now()
    };
    
    socket.send(JSON.stringify(message));
  };
  
  return {
    cursors,
    collaborators,
    updateCursorPosition,
    sendEdit
  };
}