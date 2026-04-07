// @ts-nocheck
import { db } from '../db';
import { mobileDevices, pushNotifications, users, projects, deviceTokens } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { fcmService } from '../integrations/fcm-service';

export class MobileAppService {
  // Register mobile device
  async registerDevice(data: {
    userId: number;
    deviceId: string;
    platform: 'ios' | 'android';
    deviceName?: string;
    pushToken?: string;
    appVersion?: string;
  }) {
    // Check if device already exists
    const [existing] = await db
      .select()
      .from(mobileDevices)
      .where(and(
        eq(mobileDevices.userId, data.userId),
        eq(mobileDevices.deviceId, data.deviceId)
      ));

    if (existing) {
      // Update existing device
      const [device] = await db
        .update(mobileDevices)
        .set({
          deviceName: data.deviceName,
          pushToken: data.pushToken,
          appVersion: data.appVersion,
          isActive: true,
          lastSeen: new Date()
        })
        .where(eq(mobileDevices.id, existing.id))
        .returning();

      return device;
    } else {
      // Create new device registration
      const [device] = await db
        .insert(mobileDevices)
        .values({
          ...data,
          isActive: true,
          lastSeen: new Date(),
          createdAt: new Date()
        })
        .returning();

      return device;
    }
  }

  // Update device info
  async updateDevice(deviceId: string, data: {
    deviceName?: string;
    pushToken?: string;
    appVersion?: string;
    lastSeen?: Date;
  }) {
    const [device] = await db
      .update(mobileDevices)
      .set({
        ...data,
        lastSeen: data.lastSeen || new Date()
      })
      .where(eq(mobileDevices.deviceId, deviceId))
      .returning();

    return device;
  }

  // Deactivate device
  async deactivateDevice(userId: number, deviceId: string) {
    const [device] = await db
      .update(mobileDevices)
      .set({ isActive: false })
      .where(and(
        eq(mobileDevices.userId, userId),
        eq(mobileDevices.deviceId, deviceId)
      ))
      .returning();

    return device;
  }

  // Get user's devices
  async getUserDevices(userId: number) {
    return await db
      .select({
        id: mobileDevices.id,
        deviceId: mobileDevices.deviceId,
        platform: mobileDevices.platform,
        deviceName: mobileDevices.deviceName,
        appVersion: mobileDevices.appVersion,
        isActive: mobileDevices.isActive,
        lastSeen: mobileDevices.lastSeen,
        createdAt: mobileDevices.createdAt
      })
      .from(mobileDevices)
      .where(eq(mobileDevices.userId, userId))
      .orderBy(desc(mobileDevices.lastSeen));
  }

  // Send push notification via FCM
  async sendPushNotification(data: {
    userId: number;
    title: string;
    body: string;
    type?: string;
    actionUrl?: string;
    data?: Record<string, any>;
  }) {
    const [notification] = await db
      .insert(pushNotifications)
      .values({
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type ?? 'system',
        actionUrl: data.actionUrl,
        data: data.data || {},
        read: false,
        sent: false,
        createdAt: new Date()
      })
      .returning();

    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, data.userId));

    if (tokens.length === 0) {
      return {
        notification,
        deliveryResults: [],
        deviceCount: 0
      };
    }

    const tokenStrings = tokens.map(t => t.token);

    const fcmDataPayload: Record<string, string> = {};
    if (data.data) {
      for (const [k, v] of Object.entries(data.data)) {
        fcmDataPayload[k] = String(v);
      }
    }
    if (data.type) {
      fcmDataPayload.type = data.type;
    }
    if (data.actionUrl) {
      fcmDataPayload.actionUrl = data.actionUrl;
    }

    const { successCount, results } = await fcmService.sendToMultipleDevices(
      tokenStrings,
      {
        title: data.title,
        body: data.body,
        data: Object.keys(fcmDataPayload).length > 0 ? fcmDataPayload : undefined
      }
    );

    if (successCount > 0) {
      await db
        .update(pushNotifications)
        .set({ sent: true, sentAt: new Date() })
        .where(eq(pushNotifications.id, notification.id));
    }

    return {
      notification,
      deliveryResults: results,
      deviceCount: tokens.length
    };
  }

  // Get user's notifications
  async getUserNotifications(userId: number, limit: number = 50, offset: number = 0) {
    return await db
      .select({
        id: pushNotifications.id,
        title: pushNotifications.title,
        body: pushNotifications.body,
        type: pushNotifications.type,
        actionUrl: pushNotifications.actionUrl,
        data: pushNotifications.data,
        read: pushNotifications.read,
        readAt: pushNotifications.readAt,
        sent: pushNotifications.sent,
        sentAt: pushNotifications.sentAt,
        createdAt: pushNotifications.createdAt
      })
      .from(pushNotifications)
      .where(eq(pushNotifications.userId, String(userId)))
      .orderBy(desc(pushNotifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // Mobile API endpoints data formatting
  async getMobileProjectsList(userId: number) {
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        language: projects.language,
        updatedAt: projects.updatedAt,
        views: projects.views,
        likes: projects.likes
      })
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(20);

    return userProjects.map(project => ({
      ...project,
      thumbnail: this.generateProjectThumbnail(project.language),
      lastModified: project.updatedAt?.toISOString(),
      stats: {
        views: project.views,
        likes: project.likes
      }
    }));
  }

  // Generate project thumbnail for mobile app
  private generateProjectThumbnail(language: string | null): string {
    const thumbnails: Record<string, string> = {
      'javascript': '🟨',
      'typescript': '🔷',
      'python': '🐍',
      'java': '☕',
      'cpp': '⚡',
      'go': '🐹',
      'rust': '🦀',
      'html': '🌐',
      'css': '🎨',
      'react': '⚛️',
      'vue': '💚',
      'angular': '🅰️'
    };
    
    return thumbnails[language || 'other'] || '📄';
  }

  // Mobile app analytics
  async getMobileAppStats() {
    const [totalDevices] = await db
      .select({ count: count() })
      .from(mobileDevices)
      .where(eq(mobileDevices.isActive, true));

    const [iosDevices] = await db
      .select({ count: count() })
      .from(mobileDevices)
      .where(and(
        eq(mobileDevices.isActive, true),
        eq(mobileDevices.platform, 'ios')
      ));

    const [androidDevices] = await db
      .select({ count: count() })
      .from(mobileDevices)
      .where(and(
        eq(mobileDevices.isActive, true),
        eq(mobileDevices.platform, 'android')
      ));

    const [totalNotifications] = await db
      .select({ count: count() })
      .from(pushNotifications);

    const [sentNotifications] = await db
      .select({ count: count() })
      .from(pushNotifications)
      .where(eq(pushNotifications.sent, true));

    return {
      totalActiveDevices: totalDevices.count,
      platformDistribution: {
        ios: iosDevices.count,
        android: androidDevices.count
      },
      notificationStats: {
        total: totalNotifications.count,
        sent: sentNotifications.count,
        deliveryRate: totalNotifications.count > 0 
          ? Math.round((sentNotifications.count / totalNotifications.count) * 100)
          : 0
      }
    };
  }

  // Send bulk notifications
  async sendBulkNotifications(data: {
    userIds: number[];
    title: string;
    body: string;
    data?: Record<string, any>;
    platform?: 'ios' | 'android'; // Optional: target specific platform
  }) {
    const results = [];
    
    for (const userId of data.userIds) {
      try {
        const result = await this.sendPushNotification({
          userId,
          title: data.title,
          body: data.body,
          data: data.data
        });
        results.push({ userId, success: true, result });
      } catch (error) {
        results.push({ userId, success: false, error });
      }
    }

    return {
      totalUsers: data.userIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Mobile app configuration
  getMobileAppConfig() {
    return {
      features: {
        codeEditor: true,
        terminal: true,
        aiAssistant: true,
        collaboration: true,
        pushNotifications: true,
        offlineMode: false
      },
      limits: {
        maxProjectsOffline: 5,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        syncInterval: 30000 // 30 seconds
      },
      endpoints: {
        api: process.env.API_BASE_URL || 'https://e-code.ai',
        websocket: process.env.WS_BASE_URL || 'wss://ws.e-code.ai',
        upload: process.env.UPLOAD_BASE_URL || 'https://upload.e-code.ai'
      }
    };
  }
}

export const mobileAppService = new MobileAppService();