import { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";

export type UserPresenceStatus = "online" | "offline" | "away" | "busy";

export interface PresenceInfo {
  userId: string;
  status: UserPresenceStatus;
  lastActiveAt?: string;
}

export interface JoinChannelPayload {
  channelId: string;
}

export interface LeaveChannelPayload {
  channelId: string;
}

export interface SendMessagePayload {
  channelId: string;
  messageId: string;
  content: string;
  createdAt: string;
  senderId: string;
}

export interface MessageDeliveredPayload {
  channelId: string;
  messageId: string;
  userId: string;
  deliveredAt: string;
}

export interface MessageReadPayload {
  channelId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface TypingPayload {
  channelId: string;
  isTyping: boolean;
}

export interface PresenceUpdatePayload {
  status: UserPresenceStatus;
}

export interface ChannelPresenceUpdatedPayload {
  channelId: string;
  user: PresenceInfo;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ClientToServerEvents {
  "channel:join": (payload: JoinChannelPayload, callback?: (err?: ErrorPayload) => void) => void;
  "channel:leave": (payload: LeaveChannelPayload, callback?: (err?: ErrorPayload) => void) => void;
  "message:send": (payload: SendMessagePayload, callback?: (err?: ErrorPayload) => void) => void;
  "message:delivered": (payload: MessageDeliveredPayload) => void;
  "message:read": (payload: MessageReadPayload) => void;
  "typing:update": (payload: TypingPayload) => void;
  "presence:update": (payload: PresenceUpdatePayload) => void;
}

export interface ServerToClientEvents {
  "channel:joined": (payload: JoinChannelPayload) => void;
  "channel:left": (payload: LeaveChannelPayload) => void;
  "message:new": (payload: SendMessagePayload) => void;
  "message:delivered:updated": (payload: MessageDeliveredPayload) => void;
  "message:read:updated": (payload: MessageReadPayload) => void;
  "typing:updated": (payload: TypingPayload & { userId: string }) => void;
  "presence:updated": (payload: PresenceInfo) => void;
  "channel:presence:updated": (payload: ChannelPresenceUpdatedPayload) => void;
  "error": (payload: ErrorPayload) => void;
}

export interface InterServerEvents {
  "presence:broadcast": (payload: PresenceInfo) => void;
}

export interface SocketData {
  userId?: string;
}

export type TypedIOServer = IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const createSocketServer = (httpServer: HttpServer): TypedIOServer => {
  const io: TypedIOServer = new IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    }
  );

  io.on("connection", (socket: TypedSocket) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    if (userId) {
      socket.data.userId = userId;
      const presence: PresenceInfo = {
        userId,
        status: "online",
        lastActiveAt: new Date().toISOString(),
      };
      io.emit("presence:updated", presence);
      io.emit("presence:broadcast", presence);
    }

    socket.on("channel:join", (payload, callback) => {
      if (!payload?.channelId) {
        callback?.({
          code: "INVALID_PAYLOAD",
          message: "channelId is required",
        });
        return;
      }
      socket.join(payload.channelId);
      socket.emit("channel:joined", payload);
      if (socket.data.userId) {
        const presence: ChannelPresenceUpdatedPayload = {
          channelId: payload.channelId,
          user: {
            userId: socket.data.userId,
            status: "online",
            lastActiveAt: new Date().toISOString(),
          },
        };
        socket.to(payload.channelId).emit("channel:presence:updated", presence);
      }
      callback?.();
    });

    socket.on("channel:leave", (payload, callback) => {
      if (!payload?.channelId) {
        callback?.({
          code: "INVALID_PAYLOAD",
          message: "channelId is required",
        });
        return;
      }
      socket.leave(payload.channelId);
      socket.emit("channel:left", payload);
      if (socket.data.userId) {
        const presence: ChannelPresenceUpdatedPayload = {
          channelId: payload.channelId,
          user: {
            userId: socket.data.userId,
            status: "offline",
            lastActiveAt: new Date().toISOString(),
          },
        };
        socket.to(payload.channelId).emit("channel:presence:updated", presence);
      }
      callback?.();
    });

    socket.on("message:send", (payload, callback) => {
      if (!payload?.channelId || !payload?.messageId || !payload?.content || !payload?.senderId) {
        callback?.({
          code: "INVALID_PAYLOAD",
          message: "channelId, messageId, content and senderId are required",
        });
        return;
      }
      socket.to(payload.channelId).emit("message:new", payload);
      callback?.();
    });

    socket.on("message:delivered", (payload) => {
      if (!payload?.channelId || !payload?.messageId || !payload?.userId) return;
      socket.to(payload.channelId).emit("message:delivered:updated", payload);
    });

    socket.on("message:read", (payload) => {
      if (!payload?.channelId || !payload?.messageId || !payload?.userId) return;
      socket.to(payload.channelId).emit("message:read:updated", payload);
    });

    socket.on("typing:update", (payload) => {
      if (!payload?.channelId || typeof payload.isTyping !== "boolean") return;
      if (!socket.data.userId) return;
      socket.to(payload.channelId).emit("typing:updated", {
        channelId: payload.channelId,
        isTyping: payload.isTyping,
        userId: socket.data.userId,
      });
    });

    socket.on("presence:update", (payload) => {
      if (!socket.data.userId || !payload?.status) return;
      const presence: PresenceInfo = {
        userId: socket.data.userId,
        status: payload.status,
        lastActiveAt: new Date().toISOString(),
      };
      io.emit("presence:updated", presence);
      io.emit("presence:broadcast", presence);
    });

    socket.on("disconnect", () => {
      if (!socket.data.userId) return;
      const presence: PresenceInfo = {
        userId: socket.data.userId,
        status: "offline",
        lastActiveAt: new Date().toISOString(),
      };
      io.emit("presence:updated", presence);
      io.emit("presence:broadcast", presence);
    });
  });

  io.on("presence:broadcast", (payload: PresenceInfo) => {
    io.emit("presence:updated", payload);
  });

  return io;
};