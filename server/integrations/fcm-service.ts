import { db } from '../db';
import { deviceTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export interface FCMSendResult {
  token: string;
  success: boolean;
  error?: string;
  staleToken?: boolean;
}

const STALE_TOKEN_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/mismatched-credential',
];

export class FCMService {
  private initialized = false;
  private admin: any = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.warn('[FCMService] FIREBASE_SERVICE_ACCOUNT_JSON not configured. Push notifications disabled.');
      return;
    }

    try {
      this.admin = require('firebase-admin');
    } catch {
      console.warn('[FCMService] firebase-admin not installed — push notifications disabled.');
      return;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (!this.admin.apps.length) {
        this.admin.initializeApp({ credential: this.admin.credential.cert(serviceAccount) });
      }
      this.initialized = true;
      console.log('[FCMService] Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('[FCMService] Failed to initialize Firebase Admin SDK:', error);
    }
  }

  async sendToDevice(deviceToken: string, notification: FCMNotificationPayload): Promise<FCMSendResult> {
    if (!this.initialized) {
      return { token: deviceToken, success: false, error: 'FCM not initialized' };
    }
    try {
      const message = {
        token: deviceToken,
        notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
        data: notification.data,
        android: { priority: 'high', notification: { clickAction: notification.clickAction, sound: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      };
      await this.admin.messaging().send(message);
      return { token: deviceToken, success: true };
    } catch (error: any) {
      const errorCode = error?.code || error?.errorInfo?.code || '';
      const isStale = STALE_TOKEN_ERROR_CODES.includes(errorCode);
      if (isStale) await this.removeStaleToken(deviceToken);
      return { token: deviceToken, success: false, error: errorCode || error.message, staleToken: isStale };
    }
  }

  async sendToMultipleDevices(
    deviceTokensList: string[],
    notification: FCMNotificationPayload
  ): Promise<{ successCount: number; failureCount: number; results: FCMSendResult[] }> {
    if (!this.initialized) {
      return {
        successCount: 0,
        failureCount: deviceTokensList.length,
        results: deviceTokensList.map(t => ({ token: t, success: false, error: 'FCM not initialized' })),
      };
    }
    if (deviceTokensList.length === 0) return { successCount: 0, failureCount: 0, results: [] };

    try {
      const message = {
        tokens: deviceTokensList,
        notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
        data: notification.data,
        android: { priority: 'high', notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      };
      const response = await this.admin.messaging().sendEachForMulticast(message);
      const results: FCMSendResult[] = [];
      const staleTokensToRemove: string[] = [];

      response.responses.forEach((resp: any, idx: number) => {
        const token = deviceTokensList[idx];
        if (resp.success) {
          results.push({ token, success: true });
        } else {
          const errorCode = resp.error?.code || '';
          const isStale = STALE_TOKEN_ERROR_CODES.includes(errorCode);
          if (isStale) staleTokensToRemove.push(token);
          results.push({ token, success: false, error: errorCode || resp.error?.message, staleToken: isStale });
        }
      });

      if (staleTokensToRemove.length > 0) {
        await Promise.all(staleTokensToRemove.map(t => this.removeStaleToken(t)));
      }

      return { successCount: response.successCount, failureCount: response.failureCount, results };
    } catch (error) {
      console.error('[FCMService] Error sending batch notifications:', error);
      return {
        successCount: 0,
        failureCount: deviceTokensList.length,
        results: deviceTokensList.map(t => ({ token: t, success: false, error: 'batch send failed' })),
      };
    }
  }

  async sendToTopic(topic: string, notification: FCMNotificationPayload): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const message = {
        topic,
        notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
        data: notification.data,
      };
      await this.admin.messaging().send(message);
      return true;
    } catch (error) {
      console.error('[FCMService] Error sending topic notification:', error);
      return false;
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) return;
    try { await this.admin.messaging().subscribeToTopic(tokens, topic); } catch {}
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) return;
    try { await this.admin.messaging().unsubscribeFromTopic(tokens, topic); } catch {}
  }

  private async removeStaleToken(token: string): Promise<void> {
    try {
      await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
    } catch (err) {
      console.error('[FCMService] Failed to remove stale token from DB:', err);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const fcmService = new FCMService();
