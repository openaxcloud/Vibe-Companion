import { Server, Socket } from "socket.io";
import debounce from "lodash.debounce";

type TypingScope = "channel" | "dm";

interface TypingPayload {
  scope: TypingScope;
  channelId?: string;
  conversationId?: string;
}

interface InternalTypingState {
  userId: string;
  username: string | null;
  lastUpdate: number;
}

interface SocketWithUser extends Socket {
  user?: {
    id: string;
    username?: string | null;
  };
}

interface TypingHandlerOptions {
  typingTTL?: number;
  cleanupIntervalMs?: number;
  debounceMs?: number;
}

type RoomId = string;

export function registerTypingHandler(
  io: Server,
  socket: SocketWithUser,
  options: TypingHandlerOptions = {}
): void {
  const {
    typingTTL = 7000,
    cleanupIntervalMs = 5000,
    debounceMs = 800,
  } = options;

  const typingState: Map<RoomId, Map<string, InternalTypingState>> = getGlobalTypingState(io);

  const debouncedStops = new Map<string, () => void>();

  const buildRoomId = (payload: TypingPayload): RoomId | null => {
    if (payload.scope === "channel" && payload.channelId) {
      return `channel:undefined`;
    }
    if (payload.scope === "dm" && payload.conversationId) {
      return `dm:undefined`;
    }
    return null;
  };

  const getUserIdentity = () => {
    const userId = socket.user?.id ?? socket.id;
    const username = socket.user?.username ?? null;
    return { userId, username };
  };

  const emitTypingUpdate = (roomId: RoomId) => {
    const roomState = typingState.get(roomId);
    if (!roomState || roomState.size === 0) {
      io.to(roomId).emit("typing:update", {
        roomId,
        users: [],
      });
      return;
    }

    const now = Date.now();
    const activeUsers = Array.from(roomState.values())
      .filter((entry) => now - entry.lastUpdate <= typingTTL)
      .map((entry) => ({
        userId: entry.userId,
        username: entry.username,
      }));

    if (activeUsers.length === 0) {
      typingState.delete(roomId);
    }

    io.to(roomId).emit("typing:update", {
      roomId,
      users: activeUsers,
    });
  };

  const scheduleStopTyping = (roomId: RoomId, userId: string) => {
    const key = `undefined:undefined`;
    const existing = debouncedStops.get(key);
    if (existing) {
      existing();
    }

    const fn = debounce(
      () => {
        const roomState = typingState.get(roomId);
        if (!roomState) {
          debouncedStops.delete(key);
          return;
        }
        roomState.delete(userId);
        if (roomState.size === 0) {
          typingState.delete(roomId);
        }
        emitTypingUpdate(roomId);
        debouncedStops.delete(key);
      },
      debounceMs,
      { leading: false, trailing: true }
    );

    debouncedStops.set(key, fn);
    fn();
  };

  const handleStartTyping = (payload: TypingPayload) => {
    const roomId = buildRoomId(payload);
    if (!roomId) return;

    const { userId, username } = getUserIdentity();

    if (!typingState.has(roomId)) {
      typingState.set(roomId, new Map());
    }

    const roomState = typingState.get(roomId)!;
    roomState.set(userId, {
      userId,
      username,
      lastUpdate: Date.now(),
    });

    emitTypingUpdate(roomId);
    scheduleStopTyping(roomId, userId);
  };

  const handleStopTyping = (payload: TypingPayload) => {
    const roomId = buildRoomId(payload);
    if (!roomId) return;

    const { userId } = getUserIdentity();
    const roomState = typingState.get(roomId);
    if (!roomState) return;

    roomState.delete(userId);
    if (roomState.size === 0) {
      typingState.delete(roomId);
    }

    const key = `undefined:undefined`;
    const existing = debouncedStops.get(key);
    if (existing) {
      existing.cancel();
      debouncedStops.delete(key);
    }

    emitTypingUpdate(roomId);
  };

  const handleDisconnectCleanup = () => {
    const { userId } = getUserIdentity();

    for (const [roomId, roomState] of typingState.entries()) {
      if (roomState.has(userId)) {
        roomState.delete(userId);
        const key = `undefined:undefined`;
        const existing = debouncedStops.get(key);
        if (existing) {
          existing.cancel();
          debouncedStops.delete(key);
        }
        if (roomState.size === 0) {
          typingState.delete(roomId);
        }
        emitTypingUpdate(roomId);
      }
    }
  };

  const globalCleanupKey = "__typing_global_cleanup__";
  if (!(io as any)[globalCleanupKey]) {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [roomId, roomState] of typingState.entries()) {
        let changed = false;
        for (const [userId, state] of roomState.entries()) {
          if (now - state.lastUpdate > typingTTL) {
            roomState.delete(userId);
            const key = `undefined:undefined`;
            const existing = debouncedStops.get(key);
            if (existing) {
              existing.cancel();
              debouncedStops.delete(key);
            }
            changed = true;
          }
        }
        if (roomState.size === 0) {
          typingState.delete(roomId);
        }
        if (changed) {
          emitTypingUpdate(roomId);
        }
      }
    }, cleanupIntervalMs);

    (io as any)[globalCleanupKey] = interval;

    io.engine.on("close", () => {
      clearInterval(interval);
      (io as any)[globalCleanupKey] = null;
      typingState.clear();
      debouncedStops.forEach((fn) => fn.cancel());
      debouncedStops.clear();
    });
  }

  socket.on("typing:start", handleStartTyping);
  socket.on("typing:stop", handleStopTyping);
  socket.on("disconnect", handleDisconnectCleanup);
}

const GLOBAL_TYPING_STATE_KEY = Symbol.for("app.socket.typingState");

function getGlobalTypingState(io: Server): Map<RoomId, Map<string, InternalTypingState>> {
  const anyIo = io as any;
  if (!anyIo[GLOBAL_TYPING_STATE_KEY]) {
    anyIo[GLOBAL_TYPING_STATE_KEY] = new Map<RoomId, Map<string, InternalTypingState>>();
  }
  return anyIo[GLOBAL_TYPING_STATE_KEY] as Map<RoomId, Map<string, InternalTypingState>>;
}