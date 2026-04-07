/**
 * Hook for real-time server logs via WebSocket
 * Connects to /api/server/logs/ws for live Winston log streaming
 * Mirrors Replit's console log streaming behavior
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServerLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  service: string;
  details?: unknown[];
}

export interface UseServerLogsOptions {
  projectId?: string | number;
  userId?: string | number;
  enabled?: boolean;
  onLog?: (log: ServerLogEntry) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface UseServerLogsResult {
  logs: ServerLogEntry[];
  isConnected: boolean;
  connectionError: string | null;
  connect: () => void;
  disconnect: () => void;
  clearLogs: () => void;
}

export function useServerLogs(options: UseServerLogsOptions = {}): UseServerLogsResult {
  const {
    projectId,
    userId,
    enabled = true,
    onLog,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isManualDisconnectRef = useRef(false);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isManualDisconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', String(projectId));
    if (userId) params.set('userId', String(userId));
    
    const wsUrl = `${protocol}//${window.location.host}/api/server/logs/ws?${params.toString()}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      onConnect?.();

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          return;
        }

        if (data.type === 'initial' && Array.isArray(data.logs)) {
          setLogs(prev => [...prev, ...data.logs]);
          data.logs.forEach((log: ServerLogEntry) => onLog?.(log));
          return;
        }

        if (data.type === 'log' && data.log) {
          const logEntry: ServerLogEntry = data.log;
          setLogs(prev => {
            const newLogs = [...prev, logEntry];
            if (newLogs.length > 1000) {
              return newLogs.slice(-1000);
            }
            return newLogs;
          });
          onLog?.(logEntry);
          return;
        }

        if (data.type === 'pong') {
          return;
        }
      } catch (err) {
      }
    };

    ws.onerror = (event) => {
      setConnectionError('Connection error');
      onError?.(event);
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current) {
        return;
      }
      
      if (wsRef.current !== ws) {
        return;
      }
      
      setIsConnected(false);
      wsRef.current = null;
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      onDisconnect?.();

      if (autoReconnect && 
          !isManualDisconnectRef.current && 
          isMountedRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !isManualDisconnectRef.current) {
            connect();
          }
        }, reconnectDelay);
      }
    };
  }, [projectId, userId, onConnect, onLog, onDisconnect, onError, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    logs,
    isConnected,
    connectionError,
    connect,
    disconnect,
    clearLogs,
  };
}
