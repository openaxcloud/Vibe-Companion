import admin, { ServiceAccount, messaging } from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

export type DevicePlatform = "web" | "ios" | "android";

export type NotificationChannel = "push" | "email" | "sms";

export type NotificationCategory =
  | "marketing"
  | "transactional"
  | "system"
  | "security"
  | "reminder";

export interface NotificationPreferences {
  userId: string;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: Record<NotificationCategory, boolean>;
  updatedAt: Date;
}

export type DeviceTokenStatus = "active" | "inactive" | "revoked";

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
  status: DeviceTokenStatus;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface NotificationPayloadData {
  [key: string]: string | number | boolean | undefined | null;
}

export interface NotificationMessageInput {
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  data?: NotificationPayloadData;
  requireInteraction?: boolean;
  imageUrl?: string;
  clickActionUrl?: string;
  ttlSeconds?: number;
}

export interface NotificationSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidTokens?: string[];
}

export interface NotificationServiceConfig {
  firebaseServiceAccount: ServiceAccount;
  firebaseDatabaseURL?: string;
  dryRun?: boolean;
  defaultTTLSeconds?: number;
}

interface FirebaseAppWrapper {
  app: admin.app.App;
  messaging: messaging.Messaging;
}

let firebaseWrapper: FirebaseAppWrapper | null = null;

function initializeFirebase(config: NotificationServiceConfig): FirebaseAppWrapper {
  if (firebaseWrapper) {
    return firebaseWrapper;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(config.firebaseServiceAccount),
      databaseURL: config.firebaseDatabaseURL,
    });
  }

  firebaseWrapper = {
    app: admin.app(),
    messaging: admin.messaging(),
  };

  return firebaseWrapper;
}

export class NotificationService {
  private messaging: messaging.Messaging;
  private dryRun: boolean;
  private defaultTTLSeconds: number;
  private firestore = getFirestore();

  constructor(config: NotificationServiceConfig) {
    const wrapper = initializeFirebase(config);
    this.messaging = wrapper.messaging;
    this.dryRun = !!config.dryRun;
    this.defaultTTLSeconds = config.defaultTTLSeconds ?? 3600;
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const docRef = this.firestore.collection("notificationPreferences").doc(userId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      const defaultPrefs: NotificationPreferences = {
        userId,
        channels: { push: true, email: true, sms: true },
        categories: {
          marketing: true,
          transactional: true,
          system: true,
          security: true,
          reminder: true,
        },
        updatedAt: new Date(),
      };
      await docRef.set(defaultPrefs);
      return defaultPrefs;
    }

    const data = snapshot.data() as NotificationPreferences;
    return {
      ...data,
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt),
    };
  }

  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, "userId">>
  ): Promise<NotificationPreferences> {
    const docRef = this.firestore.collection("notificationPreferences").doc(userId);
    const current = await this.getUserPreferences(userId);

    const merged: NotificationPreferences = {
      ...current,
      ...updates,
      channels: {
        ...current.channels,
        ...(updates.channels || {}),
      },
      categories: {
        ...current.categories,
        ...(updates.categories || {}),
      },
      updatedAt: new Date(),
    };

    await docRef.set(merged, { merge: true });
    return merged;
  }

  async registerDeviceToken(params: {
    userId: string;
    token: string;
    platform: DevicePlatform;
    deviceId?: string | null;
  }): Promise<DeviceToken> {
    const { userId, token, platform, deviceId } = params;
    const collection = this.firestore.collection("deviceTokens");

    const existingSnapshot = await collection
      .where("userId", "==", userId)
      .where("token", "==", token)
      .limit(1)
      .get();

    const now = new Date();

    if (!existingSnapshot.empty) {
      const doc = existingSnapshot.docs[0];
      const existing = doc.data() as DeviceToken;
      const updated: DeviceToken = {
        ...existing,
        platform,
        deviceId: deviceId ?? existing.deviceId ?? null,
        status: "active",
        lastUsedAt: now,
      };
      await doc.ref.set(updated, { merge: true });
      return updated;
    }

    const id = uuidv4();
    const deviceToken: DeviceToken = {
      id,
      userId,
      token,
      platform,
      deviceId: deviceId ?? null,
      status: "active",
      createdAt: now,
      lastUsedAt: now,
    };

    await collection.doc(id).set(deviceToken);
    return deviceToken;
  }

  async unregisterDeviceToken(token: string): Promise<void> {
    const collection = this.firestore.collection("deviceTokens");
    const snapshot = await collection.where("token", "==", token).limit(50).get();

    const batch = this.firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "revoked", lastUsedAt: new Date() });
    });

    if (!snapshot.empty) {
      await batch.commit();
    }
  }

  async listUserActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    const snapshot = await this.firestore
      .collection("deviceTokens")
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as DeviceToken;
      return {
        ...data,
        createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt),
        lastUsedAt:
          data.lastUsedAt instanceof Date || data.lastUsedAt === null
            ? data.lastUsedAt
            : new Date(data.lastUsedAt),
      };
    });
  }

  private async filterByPreferences(
    input: NotificationMessageInput
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(input.userId);

    if (!prefs.channels.push) {
      return false;
    }

    if (prefs.categories[input.category] === false) {
      return false;
    }

    return true;
  }

  private buildFCMMessage(
    token: string,
    input: NotificationMessageInput
  ): messaging.Message {
    const ttl = input.ttlSeconds ?? this.defaultTTLSeconds;

    const data: Record<string, string> = {};
    if (input.data) {
      Object.entries(input.data).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        data[key] = String(value);
      });
    }

    data["category"] = input.category;

    const webPushNotification: messaging.WebpushNotification = {
      title: input.title,
      body: input.body,
      icon: "/icons/icon-192x192.png",
    };

    if (input.imageUrl) {
      webPushNotification.image = input.imageUrl;
    }

    const webpush: messaging.WebpushConfig = {
      notification: webPushNotification,
      fcmOptions: input.clickActionUrl
        ? {
            link: input.clickActionUrl,
          }
        : undefined,
      headers: {
        TTL: ttl.toString(),
      },
      data,
    };

    const android: messaging.AndroidConfig = {
      ttl: ttl * 1000,
      priority: "high",
      notification: {
        title: input.title,
        body: input.body,
        clickAction: input.clickActionUrl,
        notificationPriority: "PRIORITY_HIGH",
        visibility: "PUBLIC",
        sound: "default",
        imageUrl: input.imageUrl,
      },
      data,
    };

    const apns: messaging.ApnsConfig = {
      headers: {
        "apns-priority": "10",
        "apns-expiration": (Math.floor(Date.now() / 1000) + ttl).toString(),
      },
      payload: {
        aps: {
          alert: {
            title: input.title,
            body: input.body,
          },
          sound: "default",
          category: input.category,
          "mutable-content": 1,
        },
        data,
      } as unknown as Record<string, unknown>,
    };

    const message: messaging.Message = {
      token,
      notification: {
        title: input.title,
        body: input.body,
      },
      data,
      webpush,
      android,
      apns,
    };

    return message;
  }

  async sendPushToUser