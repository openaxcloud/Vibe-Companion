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
  const [usePolling, setUsePolling] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPollTimestamp = useRef(0);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingStart = useRef(0);
  const pongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const updateQuality = useCallback((latencyMs: number) => {
    if (latencyMs < 100) {
      setConnectionQuality("excellent");
    } else if (latencyMs < 500) {
      setConnectionQuality("good");
    } else {
      setConnectionQuality("poor");
    }
  }, []);

  const startPing = useCallback((ws: WebSocket) => {
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
  }, []);

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

  const connect = useCallback(() => {
    if (!projectId || unmounted.current || usePolling) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionQuality("good");
      wsFailures.current = 0;
      if (reconnectAttempt.current > 0) {
        toast({ title: "Reconnected", description: "Connection restored", duration: 2000 });
      }
      reconnectAttempt.current = 0;
      startPing(ws);
    };

    ws.onclose = (event) => {
      setConnected(false);
      stopPing();
      if (event.code === 1013) {
        toast({ title: "Connection limit", description: "Too many open tabs. Close some to reconnect.", duration: 5000 });
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
          toast({ title: "Using fallback", description: "WebSocket unavailable, using polling", duration: 3000 });
        } else {
          setConnectionQuality("disconnected");
          scheduleReconnect();
        }
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        if (data.type === "pong") {
          if (pongTimeout.current) clearTimeout(pongTimeout.current);
          const latency = Date.now() - pingStart.current;
          updateQuality(latency);
          return;
        }
        if (data.type === "connected") {
          return;
        }
        if (data.type === "error" && data.message === "Message rate limit exceeded") {
          return;
        }
        setMessages((prev) => [...prev, data]);
      } catch {}
    };
  }, [projectId, toast, usePolling, startPing, stopPing, updateQuality]);

  const scheduleReconnect = useCallback(() => {
    if (unmounted.current) return;
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY);
    reconnectAttempt.current++;
    setConnectionQuality("disconnected");
    reconnectTimer.current = setTimeout(() => {
      if (!unmounted.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  const poll = useCallback(async () => {
    if (!projectId || unmounted.current || !usePolling) return;
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
    if (!unmounted.current && usePolling) {
      pollTimer.current = setTimeout(poll, POLL_INTERVAL);
    }
  }, [projectId, usePolling]);

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
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [projectId, connect, usePolling, stopPing]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const retryWebSocket = useCallback(() => {
    setUsePolling(false);
    wsFailures.current = 0;
    reconnectAttempt.current = 0;
    setConnectionQuality("disconnected");
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setTimeout(() => connect(), 100);
  }, [connect]);

  return { messages, connected: connected || usePolling, connectionQuality, clearMessages, retryWebSocket };
}
