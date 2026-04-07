import webpush, { PushSubscription, SendResult } from "web-push";
import { randomUUID } from "crypto";

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PushNotificationPayloadBase = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

export type MessageEventPayload = PushNotificationPayloadBase & {
  type: "message";
  messageId: string;
  channelId: string;
  senderId: string;
};

export type ChannelEventPayload = PushNotificationPayloadBase & {
  type: "channel";
  channelId: string;
  event: "created" | "updated" | "deleted";
};

export type PushNotificationPayload = MessageEventPayload | ChannelEventPayload;

export type PushSendResult = {
  subscriptionId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
};

export interface PushSubscriptionStore {
  saveSubscription(
    subscription: PushSubscription,
    userId?: string | null
  ): Promise<PushSubscriptionRecord>;
  removeSubscriptionByEndpoint(endpoint: string): Promise<boolean>;
  removeSubscriptionById(id: string): Promise<boolean>;
  getSubscriptionsByUserId(userId: string): Promise<PushSubscriptionRecord[]>;
  getAllSubscriptions(): Promise<PushSubscriptionRecord[]>;
}

class InMemoryPushSubscriptionStore implements PushSubscriptionStore {
  private subscriptions: Map<string, PushSubscriptionRecord> = new Map();

  async saveSubscription(
    subscription: PushSubscription,
    userId?: string | null
  ): Promise<PushSubscriptionRecord> {
    const existing = [...this.subscriptions.values()].find(
      (s) => s.endpoint === subscription.endpoint
    );

    const now = new Date();

    if (existing) {
      const updated: PushSubscriptionRecord = {
        ...existing,
        keys: {
          p256dh: subscription.keys?.p256dh ?? existing.keys.p256dh,
          auth: subscription.keys?.auth ?? existing.keys.auth,
        },
        userId: userId ?? existing.userId ?? null,
        updatedAt: now,
      };
      this.subscriptions.set(updated.id, updated);
      return updated;
    }

    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new Error("Invalid subscription: missing keys");
    }

    const record: PushSubscriptionRecord = {
      id: randomUUID(),
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userId: userId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(record.id, record);
    return record;
  }

  async removeSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    const entry = [...this.subscriptions.entries()].find(
      ([, s]) => s.endpoint === endpoint
    );
    if (!entry) return false;
    this.subscriptions.delete(entry[0]);
    return true;
  }

  async removeSubscriptionById(id: string): Promise<boolean> {
    return this.subscriptions.delete(id);
  }

  async getSubscriptionsByUserId(userId: string): Promise<PushSubscriptionRecord[]> {
    return [...this.subscriptions.values()].filter((s) => s.userId === userId);
  }

  async getAllSubscriptions(): Promise<PushSubscriptionRecord[]> {
    return [...this.subscriptions.values()];
  }
}

export interface PushServiceConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export class PushService {
  private store: PushSubscriptionStore;
  private config: PushServiceConfig;
  private initialized: boolean = false;

  constructor(config: PushServiceConfig, store?: PushSubscriptionStore) {
    this.store = store ?? new InMemoryPushSubscriptionStore();
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    if (!this.config.vapidPublicKey || !this.config.vapidPrivateKey || !this.config.vapidSubject) {
      throw new Error("PushService: Missing VAPID configuration");
    }

    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey
    );

    this.initialized = true;
  }

  getPublicVapidKey(): string {
    return this.config.vapidPublicKey;
  }

  async saveSubscription(
    subscription: PushSubscription,
    userId?: string | null
  ): Promise<PushSubscriptionRecord> {
    return this.store.saveSubscription(subscription, userId);
  }

  async removeSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    return this.store.removeSubscriptionByEndpoint(endpoint);
  }

  async removeSubscriptionById(id: string): Promise<boolean> {
    return this.store.removeSubscriptionById(id);
  }

  async sendToSubscription(
    subscriptionRecord: PushSubscriptionRecord,
    payload: PushNotificationPayload,
    ttlSeconds: number = 60
  ): Promise<PushSendResult> {
    const subscription: PushSubscription = {
      endpoint: subscriptionRecord.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscriptionRecord.keys.p256dh,
        auth: subscriptionRecord.keys.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      ...payload,
      timestamp: Date.now(),
    });

    try {
      const result: SendResult = await webpush.sendNotification(subscription, notificationPayload, {
        TTL: ttlSeconds,
      });

      const statusCode = (result as any).statusCode as number | undefined;

      return {
        subscriptionId: subscriptionRecord.id,
        success: true,
        statusCode,
      };
    } catch (err: any) {
      const statusCode: number | undefined = err?.statusCode;

      if (statusCode === 404 || statusCode === 410) {
        await this.store.removeSubscriptionById(subscriptionRecord.id);
      }

      return {
        subscriptionId: subscriptionRecord.id,
        success: false,
        statusCode,
        error: err?.message ?? "Unknown error sending push notification",
      };
    }
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    ttlSeconds: number = 60
  ): Promise<PushSendResult[]> {
    const subscriptions = await this.store.getSubscriptionsByUserId(userId);
    if (subscriptions.length === 0) {
      return [];
    }

    const results = await Promise.all(
      subscriptions.map((s) => this.sendToSubscription(s, payload, ttlSeconds))
    );

    return results;
  }

  async broadcast(
    payload: PushNotificationPayload,
    ttlSeconds: number = 60
  ): Promise<PushSendResult[]> {
    const subscriptions = await this.store.getAllSubscriptions();
    if (subscriptions.length === 0) {
      return [];
    }

    const results = await Promise.all(
      subscriptions.map((s) => this.sendToSubscription(s, payload, ttlSeconds))
    );

    return results;
  }

  async sendMessageNotificationToUser(
    params: {
      userId: string;
      messageId: string;
      channelId: string;
      senderId: string;
      title: string;
      body?: string;
      icon?: string;
      badge?: string;
      data?: Record<string, unknown>;
    },
    ttlSeconds: number = 60
  ): Promise<PushSendResult[]> {
    const { userId, messageId, channelId, senderId, title, body, icon, badge, data } = params;

    const payload: MessageEventPayload = {
      type: "message",
      messageId,
      channelId,
      senderId,
      title,
      body,
      icon,
      badge,
      data: {
        ...data,
        messageId,
        channelId,
        senderId,
      },
    };

    return this.sendToUser(userId, payload, ttlSeconds);
  }

  async sendChannelEventNotificationToUser(
    params: {
      userId: string;
      channelId: string;
      event: "created" | "updated" | "deleted";
      title: string;
      body?: string;
      icon?: string;
      badge?: string;
      data?: Record<string, unknown>;
    },
    ttlSeconds: number = 60
  ): Promise<PushSendResult[]> {
    const { userId, channelId, event, title, body, icon, badge, data } = params;

    const payload: ChannelEventPayload = {
      type: "channel",
      channelId,
      event,
      title,
      body,
      icon,
      badge,
      data: {
        ...data,
        channelId,
        event,
      },
    };

    return this.sendToUser(userId, payload, ttlSeconds);
  }
}

let defaultPushService: PushService | null = null;

export function getDefaultPushService(): PushService {
  if (!defaultPushService) {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey