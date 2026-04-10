// @ts-nocheck
import { DatabaseStorage } from '../storage';
import { fcmService } from '../integrations/fcm-service';
import { db } from '../db';
import { deviceTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface MobileSession {
  id: number;
  userId: number;
  deviceId: string;
  deviceInfo: {
    platform: 'ios' | 'android';
    version: string;
    model: string;
    screenSize: string;
  };
  pushToken?: string;
  lastActiveAt: Date;
  createdAt: Date;
}

export interface PushNotification {
  id: number;
  userId: number;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: 'project_update' | 'deployment_complete' | 'comment' | 'mention' | 'system';
  sent: boolean;
  sentAt?: Date;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface OfflineSync {
  id: number;
  userId: number;
  projectId: number;
  syncType: 'download' | 'upload';
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  files: {
    path: string;
    action: 'create' | 'update' | 'delete';
    content?: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  completedAt?: Date;
}

export interface MobileFeatureFlags {
  userId: number;
  offlineMode: boolean;
  pushNotifications: boolean;
  biometricAuth: boolean;
  darkMode: boolean;
  autoSync: boolean;
  reducedMotion: boolean;
  dataSaver: boolean;
}

export interface TouchGesture {
  id: string;
  name: string;
  description: string;
  gesture: 'tap' | 'double_tap' | 'long_press' | 'swipe_left' | 'swipe_right' | 
           'swipe_up' | 'swipe_down' | 'pinch' | 'spread' | 'rotate';
  action: {
    type: 'navigate' | 'execute' | 'toggle' | 'menu';
    target: string;
    params?: any;
  };
  enabled: boolean;
}

export class MobileAppService {
  private mobileSessions = new Map<number, MobileSession>();
  private pushNotifications = new Map<number, PushNotification>();
  private offlineSyncs = new Map<number, OfflineSync>();
  private sessionIdCounter = 1;
  private notificationIdCounter = 1;
  private syncIdCounter = 1;
  
  private defaultGestures: TouchGesture[] = [
    {
      id: 'swipe-right-back',
      name: 'Swipe Back',
      description: 'Swipe right to go back',
      gesture: 'swipe_right',
      action: { type: 'navigate', target: 'back' },
      enabled: true
    },
    {
      id: 'double-tap-run',
      name: 'Quick Run',
      description: 'Double tap to run project',
      gesture: 'double_tap',
      action: { type: 'execute', target: 'run_project' },
      enabled: true
    },
    {
      id: 'long-press-menu',
      name: 'Context Menu',
      description: 'Long press for context menu',
      gesture: 'long_press',
      action: { type: 'menu', target: 'context_menu' },
      enabled: true
    },
    {
      id: 'pinch-zoom',
      name: 'Code Zoom',
      description: 'Pinch to zoom code',
      gesture: 'pinch',
      action: { type: 'execute', target: 'zoom_code' },
      enabled: true
    },
    {
      id: 'swipe-up-terminal',
      name: 'Show Terminal',
      description: 'Swipe up to show terminal',
      gesture: 'swipe_up',
      action: { type: 'toggle', target: 'terminal' },
      enabled: true
    }
  ];

  constructor(private storage: DatabaseStorage) {}

  async registerDevice(data: {
    userId: number;
    deviceId: string;
    deviceInfo: MobileSession['deviceInfo'];
    pushToken?: string;
  }): Promise<MobileSession> {
    // Check if device already registered
    const existingSession = Array.from(this.mobileSessions.values()).find(
      s => s.userId === data.userId && s.deviceId === data.deviceId
    );
    
    if (existingSession) {
      // Update existing session
      existingSession.pushToken = data.pushToken;
      existingSession.lastActiveAt = new Date();
      return existingSession;
    }
    
    // Create new session
    const id = this.sessionIdCounter++;
    const session = {
      ...data,
      id,
      lastActiveAt: new Date(),
      createdAt: new Date()
    };
    
    this.mobileSessions.set(id, session);
    
    return session;
  }

  async sendPushNotification(data: {
    userId: number;
    title: string;
    body: string;
    type: PushNotification['type'];
    data?: Record<string, any>;
  }): Promise<void> {
    const notification = {
      ...data,
      sent: false,
      read: false,
      createdAt: new Date()
    };

    const id = this.notificationIdCounter++;
    const notificationWithId = { ...notification, id };
    this.pushNotifications.set(id, notificationWithId);

    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, data.userId));

    const tokenStrings = tokens.map(t => t.token).filter(Boolean);

    if (tokenStrings.length > 0) {
      const fcmData: Record<string, string> = {};
      if (data.data) {
        for (const [k, v] of Object.entries(data.data)) {
          fcmData[k] = String(v);
        }
      }

      await fcmService.sendToMultipleDevices(tokenStrings, {
        title: data.title,
        body: data.body,
        data: Object.keys(fcmData).length > 0 ? fcmData : undefined
      });
    }

    await this.storage.updatePushNotification(id, {
      sent: true,
      sentAt: new Date()
    });
  }

  async startOfflineSync(data: {
    userId: number;
    projectId: number;
    syncType: 'download' | 'upload';
  }): Promise<OfflineSync> {
    const sync = {
      ...data,
      status: 'pending' as const,
      files: [],
      createdAt: new Date()
    };
    
    const id = await this.storage.createOfflineSync(sync);
    
    // Start sync process
    if (data.syncType === 'download') {
      this.downloadProjectForOffline(id, data.projectId);
    } else {
      this.uploadOfflineChanges(id, data.projectId);
    }
    
    return { ...sync, id };
  }

  private async downloadProjectForOffline(syncId: number, projectId: number): Promise<void> {
    try {
      await this.storage.updateOfflineSync(syncId, { status: 'syncing' });
      
      // Get project files
      const files = await this.storage.getProjectFiles(projectId);
      
      const syncFiles = files.map(file => ({
        path: file.name,
        action: 'create' as const,
        content: file.content,
        timestamp: new Date()
      }));
      
      await this.storage.updateOfflineSync(syncId, {
        status: 'completed',
        files: syncFiles,
        completedAt: new Date()
      });
    } catch (error) {
      await this.storage.updateOfflineSync(syncId, {
        status: 'failed'
      });
    }
  }

  private async uploadOfflineChanges(syncId: number, projectId: number): Promise<void> {
    try {
      await this.storage.updateOfflineSync(syncId, { status: 'syncing' });
      
      // Get offline changes from sync record
      const sync = await this.storage.getOfflineSync(syncId);
      if (!sync) return;
      
      // Apply changes to project
      for (const file of sync.files) {
        switch (file.action) {
          case 'create':
            await this.storage.createFile({
              name: file.path,
              projectId,
              content: file.content || '',
              isFolder: false
            });
            break;
          case 'update':
            const existingFile = await this.storage.getFileByPath(projectId, file.path);
            if (existingFile) {
              await this.storage.updateFile(existingFile.id, {
                content: file.content || ''
              });
            }
            break;
          case 'delete':
            const fileToDelete = await this.storage.getFileByPath(projectId, file.path);
            if (fileToDelete) {
              await this.storage.deleteFile(fileToDelete.id);
            }
            break;
        }
      }
      
      await this.storage.updateOfflineSync(syncId, {
        status: 'completed',
        completedAt: new Date()
      });
    } catch (error) {
      await this.storage.updateOfflineSync(syncId, {
        status: 'failed'
      });
    }
  }

  async getMobileFeatureFlags(userId: number): Promise<MobileFeatureFlags> {
    const flags = await this.storage.getMobileFeatureFlags(userId);
    
    if (!flags) {
      // Return defaults
      return {
        userId,
        offlineMode: true,
        pushNotifications: true,
        biometricAuth: false,
        darkMode: true,
        autoSync: true,
        reducedMotion: false,
        dataSaver: false
      };
    }
    
    return flags;
  }

  async updateMobileFeatureFlags(
    userId: number,
    flags: Partial<MobileFeatureFlags>
  ): Promise<void> {
    await this.storage.updateMobileFeatureFlags(userId, flags);
  }

  async getUserGestures(userId: number): Promise<TouchGesture[]> {
    const customGestures = await this.storage.getUserGestures(userId);
    
    // Merge with defaults
    const gestureMap = new Map<string, TouchGesture>();
    
    // Add defaults first
    for (const gesture of this.defaultGestures) {
      gestureMap.set(gesture.id, gesture);
    }
    
    // Override with custom settings
    for (const custom of customGestures) {
      const existing = gestureMap.get(custom.id);
      if (existing) {
        gestureMap.set(custom.id, { ...existing, ...custom });
      }
    }
    
    return Array.from(gestureMap.values());
  }

  async updateGesture(userId: number, gestureId: string, enabled: boolean): Promise<void> {
    await this.storage.updateUserGesture(userId, gestureId, enabled);
  }

  async trackMobileActivity(sessionId: number, activity: {
    type: 'screen_view' | 'action' | 'error';
    screen?: string;
    action?: string;
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.storage.updateMobileSession(sessionId, {
      lastActiveAt: new Date()
    });
    
    await this.storage.trackMobileActivity({
      sessionId,
      ...activity,
      timestamp: new Date()
    });
  }

  async getMobileAnalytics(userId: number, period: '1d' | '7d' | '30d'): Promise<{
    sessions: number;
    screenViews: number;
    actions: number;
    errors: number;
    avgSessionDuration: number;
    topScreens: { screen: string; views: number }[];
    topActions: { action: string; count: number }[];
  }> {
    return this.storage.getMobileAnalytics(userId, period);
  }
}