import { useEffect, useRef, useCallback, useState } from "react";

export interface WsMessage {
  type: string;
  runId?: string;
  status?: string;
  message?: string;
  logType?: "info" | "error" | "success";
  timestamp?: number;
  exitCode?: number;
}

export function useProjectWebSocket(projectId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        setMessages((prev) => [...prev, data]);
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [projectId]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, clearMessages };
}
