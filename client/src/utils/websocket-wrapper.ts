/**
 * WebSocket Wrapper for Development
 * Provides graceful handling of WebSocket connections in development mode
 */

interface WebSocketWrapperOptions {
  onOpen?: () => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  enableInDevelopment?: boolean;
}

export class WebSocketWrapper {
  private ws: WebSocket | null = null;
  private url: string;
  private options: WebSocketWrapperOptions;
  private isDevelopment: boolean;

  constructor(url: string, options: WebSocketWrapperOptions = {}) {
    this.url = url;
    this.options = {
      enableInDevelopment: false,
      ...options
    };
    this.isDevelopment = import.meta.env.DEV;

    // Skip WebSocket connection in development unless explicitly enabled
    if (this.isDevelopment && !this.options.enableInDevelopment) {
      // Call onOpen immediately in dev to allow components to function
      if (this.options.onOpen) {
        setTimeout(this.options.onOpen, 0);
      }
      return;
    }

    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);

      if (this.options.onOpen) {
        this.ws.onopen = this.options.onOpen;
      }

      if (this.options.onMessage) {
        this.ws.onmessage = this.options.onMessage;
      }

      if (this.options.onError) {
        this.ws.onerror = this.options.onError;
      } else {
        // Default error handler to suppress errors in development
        this.ws.onerror = (event) => {
          if (!this.isDevelopment) {
            console.error('[WebSocket] Error:', event);
          }
        };
      }

      if (this.options.onClose) {
        this.ws.onclose = this.options.onClose;
      }
    } catch (error) {
      if (!this.isDevelopment) {
        console.error('[WebSocket] Connection failed:', error);
      }
    }
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else if (!this.isDevelopment) {
      console.warn('[WebSocket] Cannot send - connection not open');
    }
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  public get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  public get instance(): WebSocket | null {
    return this.ws;
  }
}

/**
 * Create a WebSocket connection with development mode handling
 * Returns null in development mode unless enableInDevelopment is true
 */
export function createWebSocket(
  url: string, 
  options: WebSocketWrapperOptions = {}
): WebSocketWrapper {
  return new WebSocketWrapper(url, options);
}

export default WebSocketWrapper;
