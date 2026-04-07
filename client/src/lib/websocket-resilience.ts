/**
 * Fortune 500-Grade WebSocket Resilience Manager
 * 
 * Features:
 * - Exponential backoff with jitter for reconnection
 * - Circuit breaker pattern to prevent connection storms
 * - Heartbeat/ping-pong for dead connection detection
 * - Graceful degradation with connection state events
 * - Mobile network change detection
 * - Connection quality monitoring
 */

import { safeJsonParse } from './safe-json';

export type ConnectionState = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed'
  | 'circuit_open';

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  maxReconnectAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterFactor?: number;
  /** Enable application-level heartbeat (only for JSON-based protocols, NOT for raw PTY) */
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTime?: number;
}

export interface ConnectionEvent {
  state: ConnectionState;
  attempt?: number;
  maxAttempts?: number;
  nextRetryMs?: number;
  error?: string;
  latency?: number;
}

type EventCallback = (event: ConnectionEvent) => void;
type MessageCallback = (data: MessageEvent) => void;

const DEFAULT_CONFIG = {
  maxReconnectAttempts: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  enableHeartbeat: false, // Disabled by default - only enable for JSON protocols
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTime: 60000,
};

type ResolvedConfig = Omit<Required<WebSocketConfig>, 'protocols'> & { protocols?: string | string[] };

export class ResilientWebSocket {
  private ws: WebSocket | null = null;
  private config: ResolvedConfig;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongTime = 0;
  private connectionStartTime = 0;
  private consecutiveFailures = 0;
  private circuitOpenTime = 0;
  private eventListeners: Set<EventCallback> = new Set();
  private messageListeners: Set<MessageCallback> = new Set();
  private isIntentionallyClosed = false;
  private networkOnline = true;

  constructor(config: WebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      
      // Mobile visibility change detection
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleOnline = (): void => {
    this.networkOnline = true;
    if (this.state === 'disconnected' || this.state === 'failed') {
      this.reconnectAttempt = 0;
      this.consecutiveFailures = 0;
      this.connect();
    }
  };

  private handleOffline = (): void => {
    this.networkOnline = false;
    this.emitEvent({ state: 'disconnected', error: 'Network offline' });
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.state !== 'connected') {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.reconnectAttempt = 0;
        this.connect();
      }
    }
  };

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateBackoff(): number {
    const { baseDelay, maxDelay, jitterFactor } = this.config;
    
    // Exponential: base * 2^attempt, capped at max
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempt),
      maxDelay
    );
    
    // Add jitter: ±jitterFactor of the delay
    const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
    
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Check if circuit breaker should prevent connection
   */
  private isCircuitOpen(): boolean {
    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      const timeSinceOpen = Date.now() - this.circuitOpenTime;
      
      if (timeSinceOpen < this.config.circuitBreakerResetTime) {
        return true;
      }
      
      // Circuit is ready to half-open (allow one attempt)
      this.consecutiveFailures = this.config.circuitBreakerThreshold - 1;
    }
    
    return false;
  }

  /**
   * Emit connection event to all listeners
   */
  private emitEvent(event: ConnectionEvent): void {
    this.state = event.state;
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[ResilientWS] Event listener error:', err);
      }
    });
  }

  /**
   * Start heartbeat monitoring (only for JSON-based protocols)
   * IMPORTANT: Do NOT enable heartbeat for raw PTY terminals - it corrupts the data stream
   */
  private startHeartbeat(): void {
    // Skip heartbeat for raw data protocols (like PTY terminal)
    if (!this.config.enableHeartbeat) {
      return;
    }
    
    this.stopHeartbeat();
    
    this.lastPongTime = Date.now();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send ping (JSON format - only use for JSON-based protocols)
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (err) {
          console.warn('[ResilientWS] Failed to send heartbeat:', err);
        }
        
        // Set timeout for pong response
        this.heartbeatTimeoutTimer = setTimeout(() => {
          const timeSinceLastPong = Date.now() - this.lastPongTime;
          
          if (timeSinceLastPong > this.config.heartbeatTimeout) {
            console.warn('[ResilientWS] Heartbeat timeout - connection appears dead');
            this.ws?.close(4000, 'Heartbeat timeout');
          }
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage = (event: MessageEvent): void => {
    const data = safeJsonParse<{ type?: string } | null>(event.data, null);
    
    // Handle pong responses for heartbeat
    if (data?.type === 'pong') {
      this.lastPongTime = Date.now();
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer);
        this.heartbeatTimeoutTimer = null;
      }
      return;
    }
    
    // Forward to message listeners (including non-JSON messages)
    this.messageListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[ResilientWS] Message listener error:', err);
      }
    });
  };

  /**
   * Connect to WebSocket
   */
  public connect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }
    
    if (!this.networkOnline) {
      this.emitEvent({ state: 'disconnected', error: 'Waiting for network' });
      return;
    }
    
    if (this.isCircuitOpen()) {
      const remainingTime = this.config.circuitBreakerResetTime - (Date.now() - this.circuitOpenTime);
      this.emitEvent({ 
        state: 'circuit_open', 
        error: `Too many failures. Retry in ${Math.ceil(remainingTime / 1000)}s`,
        nextRetryMs: remainingTime
      });
      
      // Schedule automatic retry after circuit resets
      this.reconnectTimer = setTimeout(() => this.connect(), remainingTime);
      return;
    }
    
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    const isReconnect = this.reconnectAttempt > 0;
    this.emitEvent({ 
      state: isReconnect ? 'reconnecting' : 'connecting',
      attempt: this.reconnectAttempt + 1,
      maxAttempts: this.config.maxReconnectAttempts
    });
    
    this.connectionStartTime = Date.now();
    
    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      
      this.ws.onopen = () => {
        const latency = Date.now() - this.connectionStartTime;
        
        this.reconnectAttempt = 0;
        this.consecutiveFailures = 0;
        
        this.emitEvent({ state: 'connected', latency });
        this.startHeartbeat();
      };
      
      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        
        if (this.isIntentionallyClosed) {
          this.emitEvent({ state: 'disconnected' });
          return;
        }
        
        this.consecutiveFailures++;
        
        if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
          this.circuitOpenTime = Date.now();
        }
        
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('[ResilientWS] WebSocket error:', error);
      };
      
      this.ws.onmessage = this.handleMessage;
      
    } catch (err) {
      console.error('[ResilientWS] Failed to create WebSocket:', err);
      this.consecutiveFailures++;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      this.emitEvent({ 
        state: 'failed', 
        error: `Max reconnection attempts (${this.config.maxReconnectAttempts}) exceeded`
      });
      return;
    }
    
    const delay = this.calculateBackoff();
    this.reconnectAttempt++;
    
    this.emitEvent({
      state: 'reconnecting',
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.maxReconnectAttempts,
      nextRetryMs: delay
    });
    
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /**
   * Send message through WebSocket
   */
  public send(data: string | object): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[ResilientWS] Cannot send - connection not open');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    } catch (err) {
      console.error('[ResilientWS] Send error:', err);
      return false;
    }
  }

  /**
   * Subscribe to connection events
   */
  public onStateChange(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    
    // Immediately emit current state
    callback({ state: this.state });
    
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Subscribe to messages
   */
  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Force reconnection (reset attempts)
   */
  public forceReconnect(): void {
    this.reconnectAttempt = 0;
    this.consecutiveFailures = 0;
    this.isIntentionallyClosed = false;
    this.close();
    this.connect();
  }

  /**
   * Close connection
   */
  public close(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
    
    this.emitEvent({ state: 'disconnected' });
  }

  /**
   * Cleanup all resources
   */
  public destroy(): void {
    this.close();
    this.eventListeners.clear();
    this.messageListeners.clear();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

/**
 * Create a resilient WebSocket instance for terminal connections
 * NOTE: Heartbeat is DISABLED for terminal - PTY uses raw binary/text data, not JSON
 */
export function createTerminalWebSocket(
  projectId: string | number,
  sessionId?: string
): ResilientWebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ projectId: String(projectId) });
  if (sessionId) params.set('sessionId', sessionId);
  
  const url = `${protocol}//${window.location.host}/api/terminal/ws?${params}`;
  
  return new ResilientWebSocket({
    url,
    maxReconnectAttempts: 15,
    baseDelay: 500,
    maxDelay: 30000,
    jitterFactor: 0.25,
    enableHeartbeat: false, // CRITICAL: PTY sends raw data, not JSON - heartbeat would corrupt terminal
    circuitBreakerThreshold: 5,
    circuitBreakerResetTime: 45000,
  });
}

/**
 * Create a resilient WebSocket instance for security scan connections
 * NOTE: Heartbeat is ENABLED - uses JSON protocol
 */
export function createSecurityWebSocket(
  projectId: string | number
): ResilientWebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/security-scans/ws?projectId=${projectId}`;
  
  return new ResilientWebSocket({
    url,
    maxReconnectAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.25,
    enableHeartbeat: true,
    heartbeatInterval: 45000,
    heartbeatTimeout: 15000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTime: 60000,
  });
}

/**
 * Create a resilient WebSocket instance for agent connections
 * NOTE: Heartbeat is ENABLED for agent - uses JSON protocol
 */
export function createAgentWebSocket(
  projectId: string | number,
  sessionId: string,
  bootstrapToken?: string
): ResilientWebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ 
    projectId: String(projectId),
    sessionId 
  });
  if (bootstrapToken) params.set('bootstrap', bootstrapToken);
  
  const url = `${protocol}//${window.location.host}/ws/agent?${params}`;
  
  return new ResilientWebSocket({
    url,
    maxReconnectAttempts: 20,
    baseDelay: 1000,
    maxDelay: 60000,
    jitterFactor: 0.3,
    enableHeartbeat: true, // Agent uses JSON protocol - heartbeat is safe
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
    circuitBreakerThreshold: 7,
    circuitBreakerResetTime: 60000,
  });
}
