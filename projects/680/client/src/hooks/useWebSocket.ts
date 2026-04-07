import { useCallback, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

type RootState = {
  auth: {
    isAuthenticated: boolean;
    token?: string | null;
    userId?: string | null;
  };
  config?: {
    websocketUrl?: string;
  };
};

type WebSocketEventBase = {
  type: string;
  [key: string]: unknown;
};

type WebSocketMessageEvent<T = unknown> = {
  type: "message:new" | "message:update" | "message:delete";
  payload: T;
} & WebSocketEventBase;

type WebSocketPresenceEvent<T = unknown> = {
  type: "presence:update";
  payload: T;
} & WebSocketEventBase;

type WebSocketSystemEvent<T = unknown> = {
  type:
    | "connection:ack"
    | "connection:error"
    | "connection:closed"
    | "error"
    | "pong"
    | "ping";
  payload?: T;
} & WebSocketEventBase;

export type IncomingWebSocketEvent =
  | WebSocketMessageEvent
  | WebSocketPresenceEvent
  | WebSocketSystemEvent
  | WebSocketEventBase;

export type OutgoingWebSocketEvent = {
  type: string;
  payload?: unknown;
  requestId?: string;
};

type UseWebSocketOptions = {
  url?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectIntervalMs?: number;
  onEvent?: (event: IncomingWebSocketEvent) => void;
  onOpen?: (ev: Event) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
};

type WebSocketStatus = "idle" | "connecting" | "open" | "closing" | "closed" | "error";

export type UseWebSocketResult = {
  sendEvent: (event: OutgoingWebSocketEvent) => boolean;
  status: WebSocketStatus;
  lastEvent: IncomingWebSocketEvent | null;
  isConnected: boolean;
};

const selectAuth = (state: RootState) => state.auth;
const selectWebSocketUrl = (state: RootState): string | undefined =>
  state.config?.websocketUrl;

const wsMessageReceived = (event: IncomingWebSocketEvent) => ({
  type: "websocket/messageReceived",
  payload: event,
});

const wsStatusChanged = (status: WebSocketStatus) => ({
  type: "websocket/statusChanged",
  payload: status,
});

const wsConnectionError = (error: string) => ({
  type: "websocket/connectionError",
  payload: error,
});

export function useWebSocket(options?: UseWebSocketOptions): UseWebSocketResult {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);
  const configuredUrl = useSelector(selectWebSocketUrl);

  const {
    url,
    autoReconnect = true,
    reconnectAttempts = 5,
    reconnectIntervalMs = 3000,
    onEvent,
    onOpen,
    onClose,
    onError,
  } = options || {};

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<WebSocketStatus>("idle");
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastEventRef = useRef<IncomingWebSocketEvent | null>(null);

  const effectiveUrl = url || configuredUrl || "";

  const updateStatus = useCallback(
    (newStatus: WebSocketStatus) => {
      statusRef.current = newStatus;
      dispatch(wsStatusChanged(newStatus));
    },
    [dispatch]
  );

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current != null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    clearReconnectTimeout();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
    }
    wsRef.current = null;
  }, [clearReconnectTimeout]);

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect) return;
    if (!auth.isAuthenticated) return;

    if (reconnectCountRef.current >= reconnectAttempts) {
      updateStatus("error");
      dispatch(wsConnectionError("Maximum reconnect attempts reached"));
      return;
    }

    reconnectCountRef.current += 1;
    clearReconnectTimeout();

    reconnectTimeoutRef.current = window.setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      connect();
    }, reconnectIntervalMs);
  }, [
    autoReconnect,
    reconnectAttempts,
    reconnectIntervalMs,
    auth.isAuthenticated,
    updateStatus,
    dispatch,
    clearReconnectTimeout,
  ]);

  const handleIncomingMessage = useCallback(
    (rawData: string) => {
      let parsed: IncomingWebSocketEvent;
      try {
        parsed = JSON.parse(rawData) as IncomingWebSocketEvent;
      } catch (error) {
        const event: IncomingWebSocketEvent = {
          type: "error",
          error: "Invalid JSON from WebSocket",
          raw: rawData,
          detail: (error as Error).message,
        } as IncomingWebSocketEvent;
        lastEventRef.current = event;
        dispatch(wsMessageReceived(event));
        if (onEvent) onEvent(event);
        return;
      }

      lastEventRef.current = parsed;
      dispatch(wsMessageReceived(parsed));
      if (onEvent) onEvent(parsed);
    },
    [dispatch, onEvent]
  );

  const connect = useCallback(() => {
    if (!auth.isAuthenticated) {
      cleanupWebSocket();
      updateStatus("idle");
      return;
    }

    if (!effectiveUrl) {
      dispatch(wsConnectionError("WebSocket URL is not configured"));
      updateStatus("error");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      updateStatus("connecting");

      const urlObj = new URL(effectiveUrl, window.location.origin);

      if (auth.token) {
        urlObj.searchParams.set("token", auth.token);
      }
      if (auth.userId) {
        urlObj.searchParams.set("userId", auth.userId);
      }

      const ws = new WebSocket(urlObj.toString());
      wsRef.current = ws;

      ws.onopen = (event: Event) => {
        reconnectCountRef.current = 0;
        updateStatus("open");
        if (onOpen) onOpen(event);
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        handleIncomingMessage(event.data);
      };

      ws.onclose = (event: CloseEvent) => {
        updateStatus("closed");
        if (onClose) onClose(event);
        if (!event.wasClean) {
          scheduleReconnect();
        }
      };

      ws.onerror = (event: Event) => {
        updateStatus("error");
        dispatch(wsConnectionError("WebSocket error occurred"));
        if (onError) onError(event);
      };
    } catch (error) {
      updateStatus("error");
      dispatch(wsConnectionError((error as Error).message));
      scheduleReconnect();
    }
  }, [
    auth.isAuthenticated,
    auth.token,
    auth.userId,
    effectiveUrl,
    cleanupWebSocket,
    updateStatus,
    dispatch,
    handleIncomingMessage,
    scheduleReconnect,
    onOpen,
    onClose,
    onError,
  ]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      connect();
    } else {
      cleanupWebSocket();
      updateStatus("idle");
    }

    return () => {
      cleanupWebSocket();
      updateStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, effectiveUrl]);

  const sendEvent = useCallback(
    (event: OutgoingWebSocketEvent): boolean => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        ws.send(JSON.stringify(event));
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return {
    sendEvent,
    status: statusRef.current,
    lastEvent: lastEventRef.current,
    isConnected: statusRef.current === "open",
  };
}

export default useWebSocket;