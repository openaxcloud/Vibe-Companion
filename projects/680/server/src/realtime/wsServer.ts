import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import url from "url";
import jwt, { JwtPayload } from "jsonwebtoken";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

type JwtUserPayload = {
  id: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
};

type AuthTokenPayload = JwtPayload & JwtUserPayload;

export interface AuthenticatedClientContext {
  userId: string;
  email?: string;
  roles: string[];
  token: string;
  rawPayload: AuthTokenPayload;
}

export interface WsClientMetadata {
  id: string;
  connectedAt: number;
  lastPongAt: number;
  userAgent?: string;
  ip?: string;
}

export interface WsClient {
  id: string;
  socket: WebSocket;
  auth?: AuthenticatedClientContext;
  meta: WsClientMetadata;
}

export type WsMessageType =
  | "ping"
  | "pong"
  | "auth_error"
  | "auth_success"
  | "error"
  | "info"
  | "subscribed"
  | "unsubscribed"
  | "event"
  | "heartbeat";

export interface WsBaseMessage {
  type: WsMessageType;
  requestId?: string;
}

export interface WsAuthSuccessMessage extends WsBaseMessage {
  type: "auth_success";
  userId: string;
  roles: string[];
}

export interface WsAuthErrorMessage extends WsBaseMessage {
  type: "auth_error";
  error: string;
  code?: string;
}

export interface WsErrorMessage extends WsBaseMessage {
  type: "error";
  error: string;
  code?: string;
  details?: unknown;
}

export interface WsInfoMessage extends WsBaseMessage {
  type: "info";
  message: string;
}

export interface WsPingMessage extends WsBaseMessage {
  type: "ping" | "heartbeat";
  ts: number;
}

export interface WsPongMessage extends WsBaseMessage {
  type: "pong";
  ts: number;
}

export interface WsEventMessage<T = unknown> extends WsBaseMessage {
  type: "event";
  event: string;
  payload: T;
}

export type WsOutgoingMessage =
  | WsAuthSuccessMessage
  | WsAuthErrorMessage
  | WsErrorMessage
  | WsInfoMessage
  | WsPingMessage
  | WsPongMessage
  | WsEventMessage;

export type WsIncomingMessage =
  | ({
      type: "ping" | "pong" | "heartbeat";
      ts?: number;
    } & WsBaseMessage)
  | ({
      type: "event";
      event: string;
      payload?: unknown;
    } & WsBaseMessage)
  | ({
      type: "info";
      message?: string;
    } & WsBaseMessage)
  | ({
      type: "error";
      error?: string;
    } & WsBaseMessage);

export interface WsServerOptions {
  jwtSecret: string;
  jwtAudience?: string;
  jwtIssuer?: string;
  jwtAlgorithms?: jwt.Algorithm[];
  path?: string;
  heartbeatIntervalMs?: number;
  clientTimeoutMs?: number;
  maxPayloadBytes?: number;
  /**
   * Optional: custom auth hook to perform additional checks or enrich context
   */
  onAuthenticate?: (payload: AuthTokenPayload) => Promise<AuthenticatedClientContext | null>;
  /**
   * Optional logger, defaults to console-like interface
   */
  logger?: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

export interface WsServerEvents {
  connection: (client: WsClient) => void;
  disconnection: (client: WsClient, code: number, reason: string) => void;
  message: (client: WsClient, message: WsIncomingMessage) => void;
  authed: (client: WsClient, auth: AuthenticatedClientContext) => void;
  authFailed: (client: WsClient, error: Error | string) => void;
}

type EventKeys = keyof WsServerEvents;

export class RealtimeWsServer extends EventEmitter {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private readonly options: Required<
    Pick<
      WsServerOptions,
      | "jwtSecret"
      | "path"
      | "heartbeatIntervalMs"
      | "clientTimeoutMs"
      | "maxPayloadBytes"
    >
  > &
    Omit<WsServerOptions, "jwtSecret">;
  private readonly logger: Required<WsServerOptions["logger"]>;
  private readonly clients: Map<string, WsClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(server: http.Server, opts: WsServerOptions) {
    super();
    if (!opts || !opts.jwtSecret) {
      throw new Error("jwtSecret is required to initialize RealtimeWsServer");
    }

    this.httpServer = server;

    this.options = {
      jwtSecret: opts.jwtSecret,
      jwtAudience: opts.jwtAudience,
      jwtIssuer: opts.jwtIssuer,
      jwtAlgorithms: opts.jwtAlgorithms ?? ["HS256"],
      path: opts.path ?? "/ws",
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? 30_000,
      clientTimeoutMs: opts.clientTimeoutMs ?? 90_000,
      maxPayloadBytes: opts.maxPayloadBytes ?? 1024 * 1024,
      onAuthenticate: opts.onAuthenticate,
      logger: opts.logger ?? console,
    };

    this.logger = this.options.logger as Required<typeof this.options.logger>;

    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: this.options.maxPayloadBytes,
    });

    this.setupUpgradeHandling();
    this.setupWsHandling();
    this.startHeartbeat();
  }

  override on<T extends EventKeys>(event: T, listener: WsServerEvents[T]): this {
    return super.on(event, listener);
  }

  override once<T extends EventKeys>(event: T, listener: WsServerEvents[T]): this {
    return super.once(event, listener);
  }

  override emit<T extends EventKeys>(event: T, ...args: Parameters<WsServerEvents[T]>): boolean {
    return super.emit(event, ...args);
  }

  private setupUpgradeHandling(): void {
    this.httpServer.on("upgrade", (req, socket, head) => {
      const { pathname } = url.parse(req.url || "");
      if (pathname !== this.options.path) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit("connection", ws, req);
      });
    });
  }

  private setupWsHandling(): void {
    this.wss.on("connection", (socket: WebSocket, request: http.IncomingMessage) => {
      const clientId = uuidv4();
      const ip =
        (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        request.socket.remoteAddress ||
        undefined;
      const userAgent = (request.headers["user-agent"] as string | undefined) || undefined;

      const meta: WsClientMetadata = {
        id: clientId,
        connectedAt: Date.now(),
        lastPongAt: Date.now(),
        ip,
        userAgent,
      };

      const client: WsClient = {
        id: clientId,
        socket,
        meta,
      };

      this.clients.set(clientId, client);
      this.logger.info("[ws] client connected", { clientId, ip, userAgent });

      this.authenticateClient(request, client)
        .then((auth) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          if (auth) {
            client.auth = auth;
            const msg: WsAuthSuccessMessage = {
              type: "auth_success",
              userId: auth.userId,
              roles: auth.roles,
            };
            this.safeSend(client, msg);
            this.emit("authed", client, auth);
          }
        })
        .catch((err: unknown) => {
          this.logger.warn("[ws] auth error", { clientId, error: String(err) });
          this.emit("authFailed", client, err instanceof Error ? err : String(err));
          const msg: WsAuthErrorMessage = {
            type: "auth_error",
            error: "Authentication failed",
          };
          this.safeSend(client, msg);
          socket.close(4001, "Authentication failed");
        });

      this.emit("connection", client);

      socket.on("message", (data) => {
        this.handleMessage(client, data);
      });

      socket.on("close", (code, reasonBuffer) => {
        const reason =
          typeof reasonBuffer === "string"
            ? reasonBuffer
            : reasonBuffer?.toString("utf8") ?? "";
        this.logger.info("[ws] client disconnected", { clientId, code, reason });
        this.clients.delete(clientId);
        this.emit("disconnection", client, code, reason);
      });

      socket.on("pong", () => {
        client.meta.lastPongAt = Date.now();
      });