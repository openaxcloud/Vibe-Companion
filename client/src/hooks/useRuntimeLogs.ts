import { useState, useEffect, useRef, useCallback } from "react";

export interface RuntimeLog {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
}

export interface RuntimeLogEntry {
  type: 'stdout' | 'stderr' | 'system' | 'exit';
  content: string;
  timestamp: number;
}

interface UseRuntimeLogsOptions {
  projectId?: string | number;
  userId?: string | number;
  executionId?: string;
  enabled?: boolean;
  onLog?: (entry: RuntimeLogEntry) => void;
}

export function useRuntimeLogs(options: UseRuntimeLogsOptions) {
  const { projectId, userId, executionId, enabled = false, onLog } = options;
  const [logs, setLogs] = useState<RuntimeLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const connect = useCallback(() => {
    if (!projectId || !executionId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/runtime`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', projectId: String(projectId), executionId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log' || data.type === 'stdout' || data.type === 'stderr') {
            const entry: RuntimeLogEntry = {
              type: data.type === 'log' ? 'stdout' : data.type,
              content: data.content || data.message || '',
              timestamp: data.timestamp || Date.now(),
            };
            onLogRef.current?.(entry);
          } else if (data.type === 'exit' || data.type === 'complete') {
            setIsComplete(true);
            setExitCode(typeof data.exitCode === 'number' ? data.exitCode : 0);
            const entry: RuntimeLogEntry = {
              type: 'exit',
              content: `Process exited with code ${data.exitCode ?? 0}`,
              timestamp: Date.now(),
            };
            onLogRef.current?.(entry);
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [projectId, executionId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setIsComplete(false);
    setExitCode(null);
  }, []);

  useEffect(() => {
    if (enabled) {
      setIsComplete(false);
      setExitCode(null);
      connect();
    } else {
      disconnect();
    }
    return () => { disconnect(); };
  }, [enabled, connect, disconnect]);

  return { logs, isConnected, isComplete, exitCode, connect, disconnect, clearLogs };
}
