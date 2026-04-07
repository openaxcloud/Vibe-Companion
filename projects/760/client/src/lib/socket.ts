import { io, Socket } from 'socket.io-client';

export type SocketEventHandler<T = any> = (payload: T) => void;

export interface SocketAuth {
  token?: string | null;
}

export interface SocketConfig {
  url: string;
  auth?: SocketAuth;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
}

export interface SocketStatus {
  connected: boolean;
  connecting: boolean;
  lastError?: string;
}

type ListenerMap = Map<string, Set<SocketEventHandler>>;

class SocketService {
  private static instance: SocketService | null = null;

  private socket: Socket | null = null;
  private config: SocketConfig | null = null;
  private status: SocketStatus = {
    connected: false,
    connecting: false,
  };

  private listeners: ListenerMap = new Map();
  private internalInitialized = false;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public initialize(config: SocketConfig): void {
    if (!config.url) {
      throw new Error('SocketService: "url" is required to initialize socket.');
    }

    const {
      url,
      auth,
      autoConnect = false,
      reconnection = true,
      reconnectionAttempts = Infinity,
      reconnectionDelay = 1000,
      reconnectionDelayMax = 5000,
      timeout = 20000,
    } = config;

    this.config = {
      url,
      auth,
      autoConnect,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      timeout,
    };

    if (this.socket) {
      this.cleanupSocket();
    }

    this.socket = io(url, {
      autoConnect,
      auth: auth?.token ? { token: auth.token } : undefined,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      timeout,
      transports: ['websocket', 'polling'],
    });

    this.setupInternalListeners();
    if (autoConnect) {
      this.connect();
    }
  }

  public connect(token?: string | null): void {
    if (!this.config || !this.socket) {
      throw new Error('SocketService: Must call initialize() before connect().');
    }

    if (this.status.connected || this.status.connecting) {
      return;
    }

    if (token || token === null) {
      this.updateAuthToken(token);
    }

    this.status.connecting = true;
    this.socket.connect();
  }

  public disconnect(): void {
    if (!this.socket) return;

    this.socket.disconnect();
    this.status.connected = false;
    this.status.connecting = false;
  }

  public updateAuthToken(token?: string | null): void {
    if (!this.socket) return;

    const auth: Record<string, unknown> = {};
    if (token) {
      auth.token = token;
    }
    this.socket.auth = auth;
  }

  public on<T = any>(event: string, handler: SocketEventHandler<T>): () => void {
    if (!event || typeof handler !== 'function') {
      throw new Error('SocketService: "event" and "handler" are required for on().');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;

    if (!handlers.has(handler as SocketEventHandler)) {
      handlers.add(handler as SocketEventHandler);
      this.socket?.on(event, handler);
    }

    return () => this.off(event, handler);
  }

  public once<T = any>(event: string, handler: SocketEventHandler<T>): () => void {
    if (!event || typeof handler !== 'function') {
      throw new Error('SocketService: "event" and "handler" are required for once().');
    }

    const wrapped: SocketEventHandler<T> = (payload: T) => {
      handler(payload);
      this.off(event, wrapped);
    };

    return this.on(event, wrapped);
  }

  public off<T = any>(event: string, handler?: SocketEventHandler<T>): void {
    if (!event) return;

    if (!handler) {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.forEach((fn) => this.socket?.off(event, fn));
        this.listeners.delete(event);
      }
      return;
    }

    const handlers = this.listeners.get(event);
    if (!handlers) return;

    if (handlers.has(handler as SocketEventHandler)) {
      handlers.delete(handler as SocketEventHandler);
      this.socket?.off(event, handler);
    }

    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  public emit<T = any>(event: string, payload?: T): void {
    if (!this.socket) {
      throw new Error('SocketService: Socket not initialized. Call initialize() first.');
    }
    if (!event) {
      throw new Error('SocketService: "event" is required for emit().');
    }

    this.socket.emit(event, payload);
  }

  public getStatus(): SocketStatus {
    return { ...this.status };
  }

  public getRawSocket(): Socket | null {
    return this.socket;
  }

  private setupInternalListeners(): void {
    if (!this.socket || this.internalInitialized) return;

    this.internalInitialized = true;

    this.socket.on('connect', () => {
      this.status.connected = true;
      this.status.connecting = false;
      this.status.lastError = undefined;
    });

    this.socket.on('disconnect', () => {
      this.status.connected = false;
      this.status.connecting = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      this.status.connected = false;
      this.status.connecting = false;
      this.status.lastError = error.message || 'Connection error';
    });

    this.socket.on('error', (error: unknown) => {
      if (error instanceof Error) {
        this.status.lastError = error.message;
      } else if (typeof error === 'string') {
        this.status.lastError = error;
      } else {
        this.status.lastError = 'Unknown socket error';
      }
    });
  }

  private cleanupSocket(): void {
    if (!this.socket) return;

    this.listeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket?.off(event, handler);
      });
    });
    this.listeners.clear();

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.status = {
      connected: false,
      connecting: false,
    };
    this.internalInitialized = false;
  }
}

const socketService = SocketService.getInstance();

export const initSocket = (config: SocketConfig): void => {
  socketService.initialize(config);
};

export const connectSocket = (token?: string | null): void => {
  socketService.connect(token);
};

export const disconnectSocket = (): void => {
  socketService.disconnect();
};

export const updateSocketAuthToken = (token?: string | null): void => {
  socketService.updateAuthToken(token);
};

export const socketOn = <T = any>(event: string, handler: SocketEventHandler<T>): (() => void) => {
  return socketService.on(event, handler);
};

export const socketOnce = <T = any>(event: string, handler: SocketEventHandler<T>): (() => void) => {
  return socketService.once(event, handler);
};

export const socketOff = <T = any>(event: string, handler?: SocketEventHandler<T>): void => {
  socketService.off(event, handler);
};

export const socketEmit = <T = any>(event: string, payload?: T): void => {
  socketService.emit(event, payload);
};

export const getSocketStatus = (): SocketStatus => {
  return socketService.getStatus();
};

export const getSocketInstance = (): Socket | null => {
  return socketService.getRawSocket();
};