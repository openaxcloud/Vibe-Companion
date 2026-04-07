import EventEmitter from "eventemitter3";

export type WsClientEvent =
  | "open"
  | "close"
  | "error"
  | "message"
  | "reconnecting"
  | "reconnected";

export interface WsClientOptions {
  /**
   * Base URL of the WebSocket server, without protocol.
   * Example: "api.example.com/realtime"
   */
  baseUrl: string;
  /**
   * Optional function to provide an auth token or other query param dynamically.
   */
  getAuthToken?: () => string | null | undefined;
  /**
   * Interval (ms) between heartbeat pings.
   * Set to 0 or undefined to disable heartbeats.
   */
  heartbeatIntervalMs?: number;
  /**
   * How long (ms) to wait before considering the connection dead
   * after a missed heartbeat pong.
   */
  heartbeatTimeoutMs?: number;
  /**
   * Maximum number of reconnect attempts. Use Infinity for no limit.
   */
  maxReconnectAttempts?: number;
  /**
   * Base delay (ms) before the first reconnect attempt.
   */
  reconnectBaseDelayMs?: number;
  /**
   * Maximum delay (ms) between reconnect attempts.
   */
  reconnectMaxDelayMs?: number;
  /**
   * Optional subprotocols to pass to the WebSocket constructor.
   */
  protocols?: string | string[];
  /**
   * Optional additional query parameters appended to the URL.
   */
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Optional logger for debug/info/warn/error. Defaults to console.
   */
  logger?: {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export interface WsMessageEnvelope<T = unknown> {
  type: string;
  payload?: T;
  [key: string]: unknown;
}

type Listener = (data?: unknown) => void;

const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 10_000;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = Infinity;

export class WsClient {
  private readonly options: Required<Omit<WsClientOptions, "getAuthToken" | "protocols" | "queryParams" | "logger">> &
    Pick<WsClientOptions, "getAuthToken" | "protocols" | "queryParams" | "logger">;

  private socket: WebSocket | null = null;
  private readonly emitter = new EventEmitter<WsClientEvent>();
  private hasManuallyClosed = false;

  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;

  private heartbeatIntervalId: number | null = null;
  private heartbeatTimeoutId: number | null = null;
  private lastPongAt: number | null = null;

  constructor(opts: WsClientOptions) {
    if (!opts || !opts.baseUrl) {
      throw new Error("WsClient requires a baseUrl option");
    }

    this.options = {
      baseUrl: opts.baseUrl,
      getAuthToken: opts.getAuthToken,
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: opts.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
      maxReconnectAttempts: opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      reconnectBaseDelayMs: opts.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS,
      reconnectMaxDelayMs: opts.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS,
      protocols: opts.protocols,
      queryParams: opts.queryParams,
      logger: opts.logger ?? console
    };
  }

  public connect(): void {
    this.hasManuallyClosed = false;
    this.clearReconnectTimer();

    const url = this.buildUrl();
    this.logDebug("Connecting to WebSocket:", url);

    try {
      const socket = new WebSocket(url, this.options.protocols);

      this.socket = socket;

      socket.onopen = this.handleOpen;
      socket.onclose = this.handleClose;
      socket.onerror = this.handleError;
      socket.onmessage = this.handleMessage;
    } catch (err) {
      this.logError("WebSocket construction failed:", err);
      this.scheduleReconnect();
    }
  }

  public disconnect(code?: number, reason?: string): void {
    this.hasManuallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(code, reason);
    }

    this.socket = null;
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public getReadyState(): number | null {
    return this.socket?.readyState ?? null;
  }

  public sendRaw(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send message: WebSocket is not open");
    }
    this.socket.send(data);
  }

  public send<T = unknown>(message: WsMessageEnvelope<T>): void {
    this.sendRaw(JSON.stringify(message));
  }

  public subscribe(event: WsClientEvent, listener: Listener): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  public on(event: WsClientEvent, listener: Listener): this {
    this.emitter.on(event, listener);
    return this;
  }

  public off(event: WsClientEvent, listener: Listener): this {
    this.emitter.off(event, listener);
    return this;
  }

  public once(event: WsClientEvent, listener: Listener): this {
    this.emitter.once(event, listener);
    return this;
  }

  public removeAllListeners(event?: WsClientEvent): this {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }

  private readonly handleOpen = (): void => {
    this.logInfo("WebSocket connection established");
    this.reconnectAttempts = 0;
    this.lastPongAt = Date.now();

    this.startHeartbeat();
    this.emitter.emit("open");
  };

  private readonly handleClose = (event: CloseEvent): void => {
    this.logInfo("WebSocket closed", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    this.stopHeartbeat();
    this.emitter.emit("close");

    if (!this.hasManuallyClosed) {
      this.scheduleReconnect();
    }
  };

  private readonly handleError = (event: Event): void => {
    this.logError("WebSocket error", event);
    this.emitter.emit("error", event);
  };

  private readonly handleMessage = (event: MessageEvent<string | ArrayBuffer>): void => {
    const data = event.data;

    if (typeof data === "string") {
      if (data === "pong") {
        this.lastPongAt = Date.now();
        this.logDebug("Received heartbeat pong");
        return;
      }

      try {
        const parsed = JSON.parse(data) as WsMessageEnvelope;
        this.emitter.emit("message", parsed);
      } catch (err) {
        this.logWarn("Failed to parse WebSocket message as JSON, emitting raw string", err);
        this.emitter.emit("message", data);
      }
    } else {
      this.emitter.emit("message", data);
    }
  };

  private startHeartbeat(): void {
    if (!this.options.heartbeatIntervalMs || this.options.heartbeatIntervalMs <= 0) {
      return;
    }

    this.stopHeartbeat();

    this.logDebug("Starting heartbeat with interval", this.options.heartbeatIntervalMs);

    this.heartbeatIntervalId = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        this.socket.send("ping");
        this.scheduleHeartbeatTimeout();
      } catch (err) {
        this.logWarn("Failed to send heartbeat ping", err);
      }
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.heartbeatTimeoutId !== null) {
      window.clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private scheduleHeartbeatTimeout(): void {
    if (!this.options.heartbeatTimeoutMs || this.options.heartbeatTimeoutMs <= 0) {
      return;
    }

    if (this.heartbeatTimeoutId !== null) {
      window.clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    const timeoutMs = this.options.heartbeatTimeoutMs;

    this.heartbeatTimeoutId = window.setTimeout(() => {
      const lastPong = this.lastPongAt ?? 0;
      const elapsed = Date.now() - lastPong;

      if (elapsed