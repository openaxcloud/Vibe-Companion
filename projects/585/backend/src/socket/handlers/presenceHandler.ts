import { Server, Socket } from "socket.io";
import { RedisClientType, createClient } from "redis";

export type PresenceStatus = "online" | "offline";

export interface PresenceInfo {
  userId: string;
  status: PresenceStatus;
  lastSeen: number | null;
}

export interface PresenceHandlerConfig {
  redisUrl?: string;
  presenceKeyPrefix?: string;
  onlineTtlSeconds?: number;
}

export interface PresenceHandlerDeps {
  io: Server;
  redisClient?: RedisClientType;
  config?: PresenceHandlerConfig;
}

const DEFAULT_PRESENCE_KEY_PREFIX = "presence:user:";
const DEFAULT_ONLINE_TTL_SECONDS = 60 * 10; // 10 minutes

export class PresenceService {
  private readonly io: Server;
  private readonly redis: RedisClientType;
  private readonly presenceKeyPrefix: string;
  private readonly onlineTtlSeconds: number;
  private readonly ownedRedisClient: boolean;

  constructor(deps: PresenceHandlerDeps) {
    if (!deps.io) {
      throw new Error("PresenceService requires a Socket.IO server instance (io).");
    }

    this.io = deps.io;
    this.ownedRedisClient = !deps.redisClient;

    this.redis =
      deps.redisClient ??
      createClient({
        url: deps.config?.redisUrl,
      });

    this.presenceKeyPrefix =
      deps.config?.presenceKeyPrefix ?? DEFAULT_PRESENCE_KEY_PREFIX;
    this.onlineTtlSeconds =
      deps.config?.onlineTtlSeconds ?? DEFAULT_ONLINE_TTL_SECONDS;
  }

  async init(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  async shutdown(): Promise<void> {
    if (this.ownedRedisClient && this.redis.isOpen) {
      await this.redis.quit();
    }
  }

  async setUserOnline(userId: string): Promise<void> {
    if (!userId) return;

    const key = this.getPresenceKey(userId);
    const now = Date.now();
    const payload: PresenceInfo = {
      userId,
      status: "online",
      lastSeen: null,
    };

    await this.redis.set(key, JSON.stringify(payload), {
      EX: this.onlineTtlSeconds,
    });

    this.io.to(this.getUserRoom(userId)).emit("presence:status", payload);
  }

  async setUserOffline(userId: string): Promise<void> {
    if (!userId) return;

    const key = this.getPresenceKey(userId);
    const now = Date.now();
    const payload: PresenceInfo = {
      userId,
      status: "offline",
      lastSeen: now,
    };

    await this.redis.set(key, JSON.stringify(payload), {
      EX: this.onlineTtlSeconds,
    });

    this.io.to(this.getUserRoom(userId)).emit("presence:status", payload);
  }

  async getUserPresence(userId: string): Promise<PresenceInfo | null> {
    if (!userId) return null;

    const key = this.getPresenceKey(userId);
    const raw = await this.redis.get(key);

    if (!raw) {
      return {
        userId,
        status: "offline",
        lastSeen: null,
      };
    }

    try {
      const parsed = JSON.parse(raw) as PresenceInfo;
      if (!parsed.userId) parsed.userId = userId;
      if (parsed.status !== "online" && parsed.status !== "offline") {
        parsed.status = "offline";
      }
      return parsed;
    } catch {
      return {
        userId,
        status: "offline",
        lastSeen: null,
      };
    }
  }

  async getUsersPresence(userIds: string[]): Promise<PresenceInfo[]> {
    if (!userIds || userIds.length === 0) return [];

    const keys = userIds.map((id) => this.getPresenceKey(id));
    const results = await this.redis.mGet(keys);

    return userIds.map((userId, index) => {
      const raw = results[index];
      if (!raw) {
        return {
          userId,
          status: "offline",
          lastSeen: null,
        };
      }
      try {
        const parsed = JSON.parse(raw) as PresenceInfo;
        if (!parsed.userId) parsed.userId = userId;
        if (parsed.status !== "online" && parsed.status !== "offline") {
          parsed.status = "offline";
        }
        return parsed;
      } catch {
        return {
          userId,
          status: "offline",
          lastSeen: null,
        };
      }
    });
  }

  private getPresenceKey(userId: string): string {
    return `undefinedundefined`;
  }

  private getUserRoom(userId: string): string {
    return `user:undefined`;
  }
}

export const registerPresenceHandlers = async (
  io: Server,
  deps: { redisClient?: RedisClientType; config?: PresenceHandlerConfig } = {}
): Promise<PresenceService> => {
  const presenceService = new PresenceService({
    io,
    redisClient: deps.redisClient,
    config: deps.config,
  });

  await presenceService.init();

  io.on("connection", (socket: Socket) => {
    const userId = extractUserIdFromSocket(socket);

    if (userId) {
      const userRoom = `user:undefined`;
      socket.join(userRoom);
      void presenceService.setUserOnline(userId);
    }

    socket.on("presence:get", async (payload: { userId: string }, cb?: (presence: PresenceInfo | null) => void) => {
      if (!payload?.userId) {
        if (cb) cb(null);
        return;
      }
      const presence = await presenceService.getUserPresence(payload.userId);
      if (cb) cb(presence);
    });

    socket.on(
      "presence:getMany",
      async (payload: { userIds: string[] }, cb?: (presence: PresenceInfo[]) => void) => {
        const ids = Array.isArray(payload?.userIds) ? payload.userIds : [];
        const presence = await presenceService.getUsersPresence(ids);
        if (cb) cb(presence);
      }
    );

    socket.on("disconnect", async () => {
      if (!userId) return;

      const socketsInUserRoom = await io.in(`user:undefined`).allSockets();
      if (socketsInUserRoom.size === 0) {
        void presenceService.setUserOffline(userId);
      }
    });
  });

  return presenceService;
};

function extractUserIdFromSocket(socket: Socket): string | null {
  const authUserId = (socket.handshake.auth as any)?.userId;
  if (typeof authUserId === "string" && authUserId.trim().length > 0) {
    return authUserId;
  }

  const queryUserId = (socket.handshake.query as any)?.userId;
  if (typeof queryUserId === "string" && queryUserId.trim().length > 0) {
    return queryUserId;
  }

  const user = (socket.data as any)?.user;
  if (user && typeof user.id === "string" && user.id.trim().length > 0) {
    return user.id;
  }

  return null;
}