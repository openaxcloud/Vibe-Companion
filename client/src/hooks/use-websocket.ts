import { useEffect, useRef, useCallback, useState } from "react";
import { toast as showToast } from "@/hooks/use-toast";

export interface WsMessage {
  type: string;
  runId?: string;
  consoleRunId?: string;
  status?: string;
  message?: string;
  logType?: "info" | "error" | "success";
  timestamp?: number;
  exitCode?: number;
}

export type ConnectionQuality = "excellent" | "good" | "poor" | "disconnected" | "polling";

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;
const POLL_INTERVAL = 3000;
const MAX_WS_FAILURES_BEFORE_POLLING = 3;
const PING_INTERVAL = 15000;
const PING_TIMEOUT = 5000;

export function useProjectWebSocket(projectId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("disconnected");
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const wsFailures = useRef(0);
  const usePollingRef = useRef(false);
  const [usePolling, setUsePolling] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPollTimestamp = useRef(0);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingStart = useRef(0);
  const pongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  useEffect(() => { usePollingRef.current = usePolling; }, [usePolling]);

  const stopPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (pongTimeout.current) {
      clearTimeout(pongTimeout.current);
      pongTimeout.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (unmounted.current) return;
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY);
    reconnectAttempt.current++;
    setConnectionQuality("disconnected");
    reconnectTimer.current = setTimeout(() => {
      if (!unmounted.current) {
        connectRef.current();
      }
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!projectId || unmounted.current || usePollingRef.current) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionQuality("good");
      wsFailures.current = 0;
      if (reconnectAttempt.current > 0) {
        showToast({ title: "Reconnected", description: "Connection restored", duration: 2000 });
      }
      reconnectAttempt.current = 0;
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingStart.current = Date.now();
          ws.send(JSON.stringify({ type: "ping" }));
          pongTimeout.current = setTimeout(() => {
            setConnectionQuality("poor");
          }, PING_TIMEOUT);
        }
      }, PING_INTERVAL);
    };

    ws.onclose = (event) => {
      setConnected(false);
      stopPing();
      if (event.code === 1013) {
        showToast({ title: "Connection limit", description: "Too many open tabs. Close some to reconnect.", duration: 5000 });
        wsFailures.current++;
        setUsePolling(true);
        setConnectionQuality("polling");
        return;
      }
      if (!unmounted.current) {
        wsFailures.current++;
        if (wsFailures.current >= MAX_WS_FAILURES_BEFORE_POLLING) {
          setUsePolling(true);
          setConnectionQuality("polling");
          showToast({ title: "Using fallback", description: "WebSocket unavailable, using polling", duration: 3000 });
        } else {
          scheduleReconnect();
        }
      }
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        if (data.type === "pong") {
          if (pongTimeout.current) clearTimeout(pongTimeout.current);
          const latency = Date.now() - pingStart.current;
          if (latency < 100) setConnectionQuality("excellent");
          else if (latency < 500) setConnectionQuality("good");
          else setConnectionQuality("poor");
          return;
        }
        if (data.type === "connected" || (data.type === "error" && data.message === "Message rate limit exceeded")) {
          return;
        }
        setMessages((prev) => [...prev, data]);
      } catch {}
    };
  }, [projectId, stopPing, scheduleReconnect]);

  connectRef.current = connect;

  const poll = useCallback(async () => {
    if (!projectId || unmounted.current || !usePollingRef.current) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/poll?since=${lastPollTimestamp.current}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => [...prev, ...data.messages]);
        }
        lastPollTimestamp.current = data.timestamp || Date.now();
      }
    } catch {}
    if (!unmounted.current && usePollingRef.current) {
      pollTimer.current = setTimeout(poll, POLL_INTERVAL);
    }
  }, [projectId]);

  useEffect(() => {
    if (usePolling && projectId) {
      lastPollTimestamp.current = Date.now();
      poll();
      return () => {
        if (pollTimer.current) clearTimeout(pollTimer.current);
      };
    }
  }, [usePolling, projectId, poll]);

  useEffect(() => {
    unmounted.current = false;
    if (!projectId) return;

    if (!usePolling) {
      connect();
    }

    return () => {
      unmounted.current = true;
      stopPing();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const retryWebSocket = useCallback(() => {
    setUsePolling(false);
    usePollingRef.current = false;
    wsFailures.current = 0;
    reconnectAttempt.current = 0;
    setConnectionQuality("disconnected");
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setTimeout(() => connectRef.current(), 100);
  }, []);

  return { messages, connected: connected || usePolling, connectionQuality, clearMessages, retryWebSocket, sendMessage };
}
