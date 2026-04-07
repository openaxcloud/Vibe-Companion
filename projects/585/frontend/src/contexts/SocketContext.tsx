import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";

type SocketStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
  isConnected: boolean;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: <T = unknown>(event: string, data?: T, callback?: (response: unknown) => void) => void;
  subscribe: <T = unknown>(
    event: string,
    handler: (data: T) => void
  ) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
  url?: string;
  options?: Parameters<typeof io>[1];
  autoConnect?: boolean;
}

const DEFAULT_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  url = process.env.REACT_APP_SOCKET_URL || window.location.origin,
  options,
  autoConnect = true,
}) => {
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectDelayRef = useRef<number>(DEFAULT_RECONNECT_DELAY_MS);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef<boolean>(false);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const scheduleReconnect = () => {
    if (manualDisconnectRef.current || status === "connected" || status === "connecting") {
      return;
    }

    clearReconnectTimeout();
    const delay = reconnectDelayRef.current;
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY_MS
      );
      internalConnect();
    }, delay);
  };

  const resetReconnectBackoff = () => {
    reconnectDelayRef.current = DEFAULT_RECONNECT_DELAY_MS;
    clearReconnectTimeout();
  };

  const internalConnect = () => {
    if (socketRef.current?.connected || status === "connecting") {
      return;
    }

    manualDisconnectRef.current = false;
    setStatus((prev) => (prev === "reconnecting" ? "reconnecting" : "connecting"));
    setLastError(null);

    if (!socketRef.current) {
      const socketInstance = io(url, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        ...options,
      });
      socketRef.current = socketInstance;

      socketInstance.on("connect", () => {
        setStatus("connected");
        setLastError(null);
        resetReconnectBackoff();
      });

      socketInstance.on("disconnect", (reason) => {
        if (manualDisconnectRef.current) {
          setStatus("disconnected");
          return;
        }

        setStatus("reconnecting");

        if (reason === "io server disconnect") {
          socketInstance.connect();
        } else {
          scheduleReconnect();
        }
      });

      socketInstance.on("connect_error", (err: Error) => {
        setStatus("error");
        setLastError(err.message || "Connection error");
        scheduleReconnect();
      });

      socketInstance.on("error", (err: Error) => {
        setStatus("error");
        setLastError(err.message || "Socket error");
      });
    }

    try {
      socketRef.current.connect();
    } catch (err) {
      setStatus("error");
      if (err instanceof Error) {
        setLastError(err.message);
      } else {
        setLastError("Unknown connection error");
      }
      scheduleReconnect();
    }
  };

  const connect = () => {
    manualDisconnectRef.current = false;
    internalConnect();
  };

  const disconnect = () => {
    manualDisconnectRef.current = true;
    resetReconnectBackoff();
    clearReconnectTimeout();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.removeAllListeners();
      socketRef.current = null;
    }
    setStatus("disconnected");
  };

  const emit = <T = unknown,>(
    event: string,
    data?: T,
    callback?: (response: unknown) => void
  ) => {
    if (!socketRef.current || !socketRef.current.connected) {
      return;
    }
    if (callback) {
      socketRef.current.emit(event, data, callback);
    } else {
      socketRef.current.emit(event, data);
    }
  };

  const subscribe = <T = unknown,>(
    event: string,
    handler: (data: T) => void
  ) => {
    const socket = socketRef.current;
    if (!socket) {
      return () => undefined;
    }
    socket.on(event, handler as (data: unknown) => void);
    return () => {
      socket.off(event, handler as (data: unknown) => void);
    };
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
      clearReconnectTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const contextValue: SocketContextValue = useMemo(
    () => ({
      socket: socketRef.current,
      status,
      isConnected: status === "connected",
      lastError,
      connect,
      disconnect,
      emit,
      subscribe,
    }),
    [status, lastError]
  );

  return (
    <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};