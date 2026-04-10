/**
 * React hook for Fortune 500-grade resilient WebSocket connections
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ResilientWebSocket, 
  ConnectionState, 
  ConnectionEvent,
  WebSocketConfig 
} from '@/lib/websocket-resilience';

export interface UseResilientWebSocketOptions extends Omit<WebSocketConfig, 'url'> {
  url: string;
  enabled?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onStateChange?: (event: ConnectionEvent) => void;
}

export interface UseResilientWebSocketReturn {
  state: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  maxAttempts: number;
  nextRetryMs: number | null;
  error: string | null;
  latency: number | null;
  send: (data: string | object) => boolean;
  connect: () => void;
  disconnect: () => void;
  forceReconnect: () => void;
}

export function useResilientWebSocket({
  url,
  enabled = true,
  onMessage,
  onStateChange,
  ...config
}: UseResilientWebSocketOptions): UseResilientWebSocketReturn {
  const wsRef = useRef<ResilientWebSocket | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(config.maxReconnectAttempts ?? 10);
  const [nextRetryMs, setNextRetryMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  // Create WebSocket instance
  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    const ws = new ResilientWebSocket({ url, ...config });
    wsRef.current = ws;

    // Subscribe to state changes
    const unsubState = ws.onStateChange((event) => {
      setState(event.state);
      setReconnectAttempt(event.attempt ?? 0);
      setMaxAttempts(event.maxAttempts ?? config.maxReconnectAttempts ?? 10);
      setNextRetryMs(event.nextRetryMs ?? null);
      setError(event.error ?? null);
      setLatency(event.latency ?? null);
      
      onStateChange?.(event);
    });

    // Subscribe to messages
    let unsubMessage: (() => void) | undefined;
    if (onMessage) {
      unsubMessage = ws.onMessage(onMessage);
    }

    // Connect
    ws.connect();

    return () => {
      unsubState();
      unsubMessage?.();
      ws.destroy();
      wsRef.current = null;
    };
    // Note: config and onStateChange are intentionally excluded to prevent reconnection loops
    // They are captured at creation time and changes require remounting with new url/enabled
  }, [url, enabled]);

  // Update message handler when it changes
  useEffect(() => {
    if (!wsRef.current || !onMessage) return;
    
    const unsub = wsRef.current.onMessage(onMessage);
    return unsub;
  }, [onMessage]);

  const send = useCallback((data: string | object): boolean => {
    return wsRef.current?.send(data) ?? false;
  }, []);

  const connect = useCallback(() => {
    wsRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  const forceReconnect = useCallback(() => {
    wsRef.current?.forceReconnect();
  }, []);

  return {
    state,
    isConnected: state === 'connected',
    isReconnecting: state === 'reconnecting',
    reconnectAttempt,
    maxAttempts,
    nextRetryMs,
    error,
    latency,
    send,
    connect,
    disconnect,
    forceReconnect,
  };
}

/**
 * Countdown hook for showing time until next retry
 */
export function useRetryCountdown(nextRetryMs: number | null): number {
  const [countdown, setCountdown] = useState(0);
  
  useEffect(() => {
    if (nextRetryMs === null || nextRetryMs <= 0) {
      setCountdown(0);
      return;
    }
    
    setCountdown(Math.ceil(nextRetryMs / 1000));
    
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [nextRetryMs]);
  
  return countdown;
}
