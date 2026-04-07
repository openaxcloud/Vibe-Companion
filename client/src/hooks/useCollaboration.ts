import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface Cursor {
  userId: number;
  username: string;
  color: string;
  position: {
    line: number;
    column: number;
  };
}

interface Collaborator {
  userId: number;
  username: string;
  color: string;
  isOnline: boolean;
}

export function useCollaboration(projectId: number, fileId: number) {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Connect to collaboration server
  useEffect(() => {
    if (!projectId || !fileId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to collaboration server');
        setIsConnected(true);
        
        // Authenticate
        ws.send(JSON.stringify({
          type: 'auth',
          projectId,
          fileId,
          timestamp: Date.now()
        }));

        // Join project
        ws.send(JSON.stringify({
          type: 'join_project',
          projectId,
          timestamp: Date.now()
        }));

        // Join file
        ws.send(JSON.stringify({
          type: 'join_file',
          projectId,
          fileId,
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse collaboration message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from collaboration server');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect to collaboration server:', error);
    }

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [projectId, fileId]);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'cursor_update':
        updateCursor(message.data);
        break;
      case 'collaborator_joined':
        addCollaborator(message.data);
        break;
      case 'collaborator_left':
        removeCollaborator(message.userId);
        break;
      case 'active_users':
        setCollaborators(message.data);
        break;
    }
  };

  const updateCursor = (data: any) => {
    setCursors(prev => {
      const existing = prev.findIndex(c => c.userId === data.userId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          userId: data.userId,
          username: data.username,
          color: data.color || generateColor(data.userId),
          position: data.position
        };
        return updated;
      } else {
        return [...prev, {
          userId: data.userId,
          username: data.username,
          color: data.color || generateColor(data.userId),
          position: data.position
        }];
      }
    });
  };

  const addCollaborator = (data: any) => {
    setCollaborators(prev => {
      const existing = prev.find(c => c.userId === data.userId);
      if (!existing) {
        return [...prev, {
          userId: data.userId,
          username: data.username,
          color: data.color || generateColor(data.userId),
          isOnline: true
        }];
      }
      return prev;
    });
  };

  const removeCollaborator = (userId: number) => {
    setCollaborators(prev => prev.filter(c => c.userId !== userId));
    setCursors(prev => prev.filter(c => c.userId !== userId));
  };

  const updateCursorPosition = useCallback((position: { line: number; column: number }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor_update',
        projectId,
        fileId,
        data: { position },
        timestamp: Date.now()
      }));
    }
  }, [projectId, fileId]);

  const sendEdit = useCallback((edit: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'edit',
        projectId,
        fileId,
        data: edit,
        timestamp: Date.now()
      }));
    }
  }, [projectId, fileId]);

  const generateColor = (userId: number) => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3', '#ff9ff3', '#54a0ff'];
    return colors[userId % colors.length];
  };

  return {
    cursors,
    collaborators,
    isConnected,
    updateCursorPosition,
    sendEdit
  };
}