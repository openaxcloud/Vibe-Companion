import { EventEmitter } from 'events';
import { Pool, PoolClient } from 'pg';

export type PresenceStatus = 'online' | 'offline' | 'away';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  updatedAt: Date;
}

export interface PresenceUpdateInput {
  userId: string;
  status: PresenceStatus;
  lastSeen?: Date;
}

export interface PresenceServiceOptions {
  dbPool: Pool;
  /**
   * Time in milliseconds after which a user without activity
   * is considered offline. This is a soft rule; explicit updates override it.
   */
  offlineTimeoutMs?: number;
  /**
   * Debounce window for persisting presence changes to the database.
   * Presence events to WebSocket clients are still emitted immediately.
   */
  persistDebounceMs?: number;
}

export interface PresenceEvents {
  /**
   * Fired when a user's presence changes.
   * @param userId - User identifier
   * @param presence - New presence state
   */
  presenceChanged: (userId: string, presence: UserPresence) => void;
}

type PresenceEventKeys = keyof PresenceEvents;

export class PresenceService extends EventEmitter {
  private dbPool: Pool;
  private offlineTimeoutMs: number;
  private persistDebounceMs: number;

  // In-memory cache of presence
  private presenceCache: Map<string, UserPresence>;
  // Track pending DB writes to debounce them
  private pendingPersistTimeouts: Map<string, NodeJS.Timeout>;

  constructor(options: PresenceServiceOptions) {
    super();
    this.dbPool = options.dbPool;
    this.offlineTimeoutMs = options.offlineTimeoutMs ?? 5 * 60 * 1000; // default 5 minutes
    this.persistDebounceMs = options.persistDebounceMs ?? 5 * 1000; // default 5 seconds
    this.presenceCache = new Map();
    this.pendingPersistTimeouts = new Map();
  }

  /**
   * Update a user's presence state. Emits presenceChanged immediately and
   * schedules a debounced DB write.
   */
  async updatePresence(input: PresenceUpdateInput): Promise<UserPresence> {
    const now = new Date();
    const lastSeen = input.lastSeen ?? now;

    const current = this.presenceCache.get(input.userId);
    const updated: UserPresence = {
      userId: input.userId,
      status: input.status,
      lastSeen,
      updatedAt: now,
    };

    const hasMeaningfulChange =
      !current ||
      current.status !== updated.status ||
      current.lastSeen.getTime() !== updated.lastSeen.getTime();

    this.presenceCache.set(input.userId, updated);

    if (hasMeaningfulChange) {
      this.emit('presenceChanged', input.userId, updated);
    }

    this.schedulePersist(updated);

    return updated;
  }

  /**
   * Explicitly mark a user as online and update lastSeen.
   */
  async markOnline(userId: string): Promise<UserPresence> {
    return this.updatePresence({ userId, status: 'online' });
  }

  /**
   * Explicitly mark a user as offline (e.g., logout / disconnect).
   */
  async markOffline(userId: string): Promise<UserPresence> {
    return this.updatePresence({ userId, status: 'offline' });
  }

  /**
   * Explicitly mark a user as away.
   */
  async markAway(userId: string): Promise<UserPresence> {
    return this.updatePresence({ userId, status: 'away' });
  }

  /**
   * Update a user's lastSeen without necessarily changing their status.
   * Commonly used for "heartbeat" pings while user remains online.
   */
  async touchLastSeen(userId: string): Promise<UserPresence> {
    const now = new Date();
    const current = this.presenceCache.get(userId);

    const status: PresenceStatus = current?.status ?? 'online';
    return this.updatePresence({
      userId,
      status,
      lastSeen: now,
    });
  }

  /**
   * Get a user's presence from cache or DB.
   * If not found in cache, attempts to load from DB and applies offline timeout rule.
   */
  async getPresence(userId: string): Promise<UserPresence | null> {
    const cached = this.presenceCache.get(userId);
    if (cached) {
      return this.applyOfflineTimeout(cached);
    }

    const fromDb = await this.loadPresenceFromDb(userId);
    if (!fromDb) {
      return null;
    }

    const normalized = this.applyOfflineTimeout(fromDb);
    this.presenceCache.set(userId, normalized);
    return normalized;
  }

  /**
   * Get presence for multiple users in a single DB roundtrip.
   */
  async getPresenceForUsers(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    if (userIds.length === 0) return result;

    const missingFromCache: string[] = [];

    for (const id of userIds) {
      const cached = this.presenceCache.get(id);
      if (cached) {
        result.set(id, this.applyOfflineTimeout(cached));
      } else {
        missingFromCache.push(id);
      }
    }

    if (missingFromCache.length > 0) {
      const dbRecords = await this.loadPresenceForUsersFromDb(missingFromCache);
      for (const presence of dbRecords) {
        const normalized = this.applyOfflineTimeout(presence);
        this.presenceCache.set(presence.userId, normalized);
        result.set(presence.userId, normalized);
      }
    }

    return result;
  }

  /**
   * Force persistence of in-memory presence state for a user.
   */
  async flushUserPresence(userId: string): Promise<void> {
    const presence = this.presenceCache.get(userId);
    if (!presence) return;

    const pending = this.pendingPersistTimeouts.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.pendingPersistTimeouts.delete(userId);
    }

    await this.persistPresenceToDb(presence);
  }

  /**
   * Force persistence of all cached presence states.
   */
  async flushAll(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const userId of this.presenceCache.keys()) {
      tasks.push(this.flushUserPresence(userId));
    }
    await Promise.all(tasks);
  }

  /**
   * Gracefully shutdown and ensure all presence is persisted.
   */
  async shutdown(): Promise<void> {
    await this.flushAll();
    this.removeAllListeners();
  }

  /**
   * Explicitly set a user's lastSeen value, without affecting status,
   * and persist immediately.
   */
  async setLastSeen(userId: string, lastSeen: Date): Promise<UserPresence> {
    const current = await this.getPresence(userId);
    const status: PresenceStatus = current?.status ?? 'offline';

    const presence: UserPresence = {
      userId,
      status,
      lastSeen,
      updatedAt: new Date(),
    };

    this.presenceCache.set(userId, presence);
    this.emit('presenceChanged', userId, presence);
    await this.persistPresenceToDb(presence);

    return presence;
  }

  /**
   * Subscribe to presence events with proper typing.
   */
  override on<T extends PresenceEventKeys>(
    event: T,
    listener: PresenceEvents[T]
  ): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.on(event, listener as any);
  }

  override once<T extends PresenceEventKeys>(
    event: T,
    listener: PresenceEvents[T]
  ): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.once(event, listener as any);
  }

  override off<T extends PresenceEventKeys>(
    event: T,
    listener: PresenceEvents[T]
  ): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.off(event, listener as any);
  }

  private schedulePersist(presence: UserPresence): void {
    const { userId } = presence;

    const existingTimeout = this.pendingPersistTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      this.pendingPersistTimeouts.delete(userId);
      try {
        await this.persistPresenceToDb(presence);
      } catch {
        // Log errors at a higher layer; avoid throwing from timer
      }
    }, this.persistDebounceMs);

    this.pendingPersistTimeouts.set(userId, timeout);
  }

  private applyOfflineTimeout(presence: UserPresence): UserPresence {
    if (presence.status === 'offline') {
      return presence;
    }

    const now = Date.now();
    const lastSeenTime = presence.lastSeen.getTime();
    const isStale = now - lastSeenTime > this.offlineTimeoutMs;

    if (!isStale) {
      return presence;
    }

    const normalized: UserPresence = {
      ...presence,
      status: 'offline',
      updatedAt: new Date(now),
    };

    this.presenceCache.set(presence.userId, normalized);
    return normalized;
  }

  private async loadPresenceFromDb(userId: string): Promise<UserPresence | null> {
    const