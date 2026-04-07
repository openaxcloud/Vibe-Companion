import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

type EventHandler = (...args: any[]) => void;

interface UseSocketOptions {
  url: string;
  /**
   * Optional query params to include in the connection
   */
  query?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Authentication token or data
   */
  authToken?: string | null;
  /**
   * Whether to automatically connect on mount
   * @default true
   */
  autoConnect?: boolean;
  /**
   * Reconnection options
   */
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  /**
   * Path for Socket.IO
   */
  path?: string;
}

interface UseSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, handler: EventHandler) => void;
  off: (event: string, handler?: EventHandler) => void;
}

/**
 * React hook to manage a Socket.IO connection lifecycle and listeners.
 */
export const useSocket = (options: UseSocketOptions): UseSocketResult => {
  const {
    url,
    query,
    authToken,
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = Infinity,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    path = "/socket.io",
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const createSocket = useCallback(() => {
    if (!url) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnecting(true);

    const socket = io(url, {
      path,
      query,
      auth: authToken ? { token: authToken } : undefined,
      autoConnect: false,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setIsConnected(true);
      setIsConnecting(false);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setIsConnecting(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
      setIsConnecting(false);
    });

    socketRef.current = socket;

    if (autoConnect) {
      socket.connect();
    }
  }, [
    url,
    path,
    JSON.stringify(query ?? {}),
    authToken,
    autoConnect,
    reconnection,
    reconnectionAttempts,
    reconnectionDelay,
    reconnectionDelayMax,
  ]);

  useEffect(() => {
    createSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, [createSocket]);

  const connect = useCallback(() => {
    if (!socketRef.current) {
      createSocket();
      return;
    }

    if (!socketRef.current.connected && !socketRef.current.active) {
      setIsConnecting(true);
      socketRef.current.connect();
    }
  }, [createSocket]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.removeAllListeners();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    if (!socketRef.current || !socketRef.current.connected) {
      return;
    }
    socketRef.current.emit(event, ...args);
  }, []);

  const on = useCallback((event: string, handler: EventHandler) => {
    if (!socketRef.current) {
      return;
    }
    socketRef.current.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: EventHandler) => {
    if (!socketRef.current) {
      return;
    }
    if (handler) {
      socketRef.current.off(event, handler);
    } else {
      socketRef.current.removeAllListeners(event);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
};

export default useSocket;