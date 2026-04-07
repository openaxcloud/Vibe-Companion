import { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";

export type UserId = string;
export type RoomId = string;
export type ChannelId = string;
export type DMId = string;

export type RealtimeEventName =
  | "connection"
  | "disconnect"
  | "user:online"
  | "user:offline"
  | "presence:update"
  | "channel:message"
  | "dm:message"
  | "channel:typing"
  | "dm:typing"
  | "notification"
  | "error";

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventName | string;
  payload: T;
}

export interface UserPresence {
  userId: UserId;
  lastSeenAt: number;
  status: "online" | "offline" | "away" | "busy";
  socketCount: number;
}

export interface ConnectionContext {
  userId: UserId;
  socketId: string;
  connectedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ConnectionManagerOptions {
  /**
   * Namespace to register on the Socket.IO server.
   * Defaults to "/realtime".
   */
  namespace?: string;
  /**
   * Optional function to authenticate a socket and resolve its userId.
   * If omitted, userId must be provided via handshake auth or query.
   */
  authenticateSocket?: (socket: Socket) => Promise<UserId | null> | UserId | null;
  /**
   * Logger interface (minimal). Defaults to console.
   */
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
  };
}

export interface IConnectionManager {
  getIo(): IOServer;
  getUserSockets(userId: UserId): Socket[];
  getUserPresence(userId: UserId): UserPresence | undefined;
  getOnlineUsers(): UserPresence[];
  isUserOnline(userId: UserId): boolean;

  // Room / subscription management
  joinChannel(userId: UserId, channelId: ChannelId): void;
  leaveChannel(userId: UserId, channelId: ChannelId): void;
  joinDM(userId: UserId, dmId: DMId): void;
  leaveDM(userId: UserId, dmId: DMId): void;

  // Sending events
  emitToUser<T = unknown>(userId: UserId, event: RealtimeEvent<T>): void;
  emitToUsers<T = unknown>(userIds: UserId[], event: RealtimeEvent<T>): void;
  emitToAll<T = unknown>(event: RealtimeEvent<T>): void;

  emitToChannel<T = unknown>(channelId: ChannelId, event: RealtimeEvent<T>): void;
  emitToChannels<T = unknown>(channelIds: ChannelId[], event: RealtimeEvent<T>): void;

  emitToDM<T = unknown>(dmId: DMId, event: RealtimeEvent<T>): void;
  emitToDMs<T = unknown>(dmIds: DMId[], event: RealtimeEvent<T>): void;

  // Presence broadcasting
  broadcastPresence(userId: UserId): void;
}

export class ConnectionManager implements IConnectionManager {
  private readonly io: IOServer;
  private readonly namespace: string;
  private readonly authenticateSocket?: ConnectionManagerOptions["authenticateSocket"];
  private readonly logger: NonNullable<ConnectionManagerOptions["logger"]>;

  // userId -> Set<socketId>
  private readonly userSockets: Map<UserId, Set<string>> = new Map();

  // socketId -> ConnectionContext
  private readonly socketContexts: Map<string, ConnectionContext> = new Map();

  // userId -> presence
  private readonly userPresence: Map<UserId, UserPresence> = new Map();

  // Membership tracking (for potential querying, though Socket.IO rooms are primary)
  // channelId -> Set<userId>
  private readonly channelMembers: Map<ChannelId, Set<UserId>> = new Map();
  // dmId -> Set<userId>
  private readonly dmMembers: Map<DMId, Set<UserId>> = new Map();

  constructor(httpServer: HttpServer, options: ConnectionManagerOptions = {}) {
    this.namespace = options.namespace ?? "/realtime";
    this.authenticateSocket = options.authenticateSocket;
    this.logger = options.logger ?? console;

    this.io = new IOServer(httpServer, {
      path: this.namespace,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.registerHandlers();
  }

  public getIo(): IOServer {
    return this.io;
  }

  public getUserSockets(userId: UserId): Socket[] {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return [];
    }
    const namespace = this.io.of("/");
    const sockets: Socket[] = [];
    socketIds.forEach((socketId) => {
      const socket = namespace.sockets.get(socketId);
      if (socket) {
        sockets.push(socket);
      }
    });
    return sockets;
  }

  public getUserPresence(userId: UserId): UserPresence | undefined {
    return this.userPresence.get(userId);
  }

  public getOnlineUsers(): UserPresence[] {
    return Array.from(this.userPresence.values()).filter(
      (presence) => presence.status === "online" && presence.socketCount > 0
    );
  }

  public isUserOnline(userId: UserId): boolean {
    const presence = this.userPresence.get(userId);
    return !!presence && presence.status === "online" && presence.socketCount > 0;
  }

  public joinChannel(userId: UserId, channelId: ChannelId): void {
    const sockets = this.getUserSockets(userId);
    if (!sockets.length) {
      return;
    }
    sockets.forEach((socket) => {
      socket.join(this.getChannelRoomName(channelId));
    });

    let members = this.channelMembers.get(channelId);
    if (!members) {
      members = new Set<UserId>();
      this.channelMembers.set(channelId, members);
    }
    members.add(userId);
  }

  public leaveChannel(userId: UserId, channelId: ChannelId): void {
    const sockets = this.getUserSockets(userId);
    if (!sockets.length) {
      return;
    }
    sockets.forEach((socket) => {
      socket.leave(this.getChannelRoomName(channelId));
    });

    const members = this.channelMembers.get(channelId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.channelMembers.delete(channelId);
      }
    }
  }

  public joinDM(userId: UserId, dmId: DMId): void {
    const sockets = this.getUserSockets(userId);
    if (!sockets.length) {
      return;
    }
    sockets.forEach((socket) => {
      socket.join(this.getDMRoomName(dmId));
    });

    let members = this.dmMembers.get(dmId);
    if (!members) {
      members = new Set<UserId>();
      this.dmMembers.set(dmId, members);
    }
    members.add(userId);
  }

  public leaveDM(userId: UserId, dmId: DMId): void {
    const sockets = this.getUserSockets(userId);
    if (!sockets.length) {
      return;
    }
    sockets.forEach((socket) => {
      socket.leave(this.getDMRoomName(dmId));
    });

    const members = this.dmMembers.get(dmId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.dmMembers.delete(dmId);
      }
    }
  }

  public emitToUser<T = unknown>(userId: UserId, event: RealtimeEvent<T>): void {
    const sockets = this.getUserSockets(userId);
    if (!sockets.length) {
      return;
    }
    sockets.forEach((socket) => {
      socket.emit(event.type, event.payload);
    });
  }

  public emitToUsers<T = unknown>(userIds: UserId[], event: RealtimeEvent<T>): void {
    const uniqueIds = new Set<UserId>(userIds);
    uniqueIds.forEach((userId) => this.emitToUser(userId, event));
  }

  public emitToAll<T = unknown>(event: RealtimeEvent<T>): void {
    this.io.emit(event.type, event.payload);
  }

  public emitToChannel<T = unknown>(channelId: ChannelId, event: RealtimeEvent<T>): void {
    this.io.to(this.getChannelRoomName(channelId)).emit(event.type, event.payload);
  }

  public emitToChannels<T = unknown>(channelIds: ChannelId[], event: RealtimeEvent<T>): void {
    const uniqueIds = new Set<ChannelId>(channelIds);
    const rooms = Array.from(uniqueIds).map((id) => this.getChannelRoomName(id));
    if (!rooms.length) {
      return;
    }
    this.io.to(rooms).emit(event.type, event.payload);
  }

  public emitToDM<T = unknown>(dmId: DMId, event: RealtimeEvent<T>): void {
    this.io.to(this.getDMRoomName(dm