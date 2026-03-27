import { useState, useEffect, useRef, useCallback } from "react";

export interface ServerLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
}

export interface ServerLogEntry {
  type: 'http' | 'info' | 'error' | 'warn';
  content: string;
  timestamp: number;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
}

interface UseServerLogsOptions {
  projectId?: string | number;
  userId?: string | number;
  enabled?: boolean;
  onLog?: (entry: ServerLogEntry) => void;
  autoReconnect?: boolean;
}

export function useServerLogs(options: UseServerLogsOptions) {
  const { projectId, enabled = false, onLog, autoReconnect = true } = options;
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onLogRef = useRef(onLog);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposedRef = useRef(false);
  onLogRef.current = onLog;

  const connect = useCallback(() => {
    if (!projectId || disposedRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/server-logs`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposedRef.current) { ws.close(); return; }
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', projectId: String(projectId) }));
      };

      ws.onmessage = (event) => {
        if (disposedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'http' || data.type === 'log' || data.type === 'info' || data.type === 'error' || data.type === 'warn') {
            const entry: ServerLogEntry = {
              type: data.type === 'log' ? 'info' : data.type,
              content: data.content || data.message || '',
              timestamp: data.timestamp || Date.now(),
              method: data.method,
              path: data.path,
              status: data.status,
              duration: data.duration,
            };
            onLogRef.current?.(entry);
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (autoReconnect && !disposedRef.current && enabled) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [projectId, enabled, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    if (enabled) {
      connect();
    }
    return () => {
      disposedRef.current = true;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { logs, isConnected, clearLogs };
}
