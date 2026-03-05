import { useEffect, useRef, useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export interface WsMessage {
  type: string;
  runId?: string;
  status?: string;
  message?: string;
  logType?: "info" | "error" | "success";
  timestamp?: number;
  exitCode?: number;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useProjectWebSocket(projectId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!projectId || unmounted.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectAttempt.current > 0) {
        toast({ title: "Reconnected", description: "Connection restored", duration: 2000 });
      }
      reconnectAttempt.current = 0;
    };

    ws.onclose = () => {
      setConnected(false);
      if (!unmounted.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        setMessages((prev) => [...prev, data]);
      } catch {}
    };
  }, [projectId, toast]);

  const scheduleReconnect = useCallback(() => {
    if (unmounted.current) return;
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY);
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(() => {
      if (!unmounted.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  useEffect(() => {
    unmounted.current = false;
    if (!projectId) return;

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [projectId, connect]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, clearMessages };
}
