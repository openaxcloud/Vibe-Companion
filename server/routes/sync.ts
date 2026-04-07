/**
 * Multi-Device Sync API
 * Synchronizes user preferences, workspace state, and settings across devices
 * 
 * ✅ SECURITY: All sync endpoints require authentication - user data must be protected
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('sync');
const router = Router();

/**
 * SECURITY: All sync routes require authentication
 * Workspace state, preferences, and device info are sensitive user data
 */
router.use(ensureAuthenticated);

/**
 * CSRF protection for all mutating operations (PUT, POST, DELETE)
 */
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

// Type definitions
interface WorkspaceState {
  openFiles: Array<{ projectId: number; fileId: number; path: string; cursorPosition?: { line: number; column: number } }>;
  activeProjectId: number | null;
  activeFileId: number | null;
  breakpoints: Record<string, Array<{ line: number; enabled: boolean }>>;
  editorLayout: {
    splitMode: 'single' | 'vertical' | 'horizontal';
    panelSizes: number[];
    visiblePanels: string[];
  };
  terminalState: {
    tabs: Array<{ id: string; cwd: string; history: string[] }>;
    activeTabId: string | null;
  };
  lastModified: number;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  autoSave: boolean;
  autoSaveDelay: number;
  minimap: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  keyboardShortcuts: Record<string, string>;
  aiPreferences: {
    defaultModel: string;
    autoComplete: boolean;
    inlineSuggestions: boolean;
  };
  notifications: {
    enabled: boolean;
    desktop: boolean;
    sound: boolean;
    emailDigest: boolean;
  };
  lastModified: number;
}

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  platform: string;
  lastSyncAt: number;
}

// Default values
const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  openFiles: [],
  activeProjectId: null,
  activeFileId: null,
  breakpoints: {},
  editorLayout: {
    splitMode: 'single',
    panelSizes: [50, 50],
    visiblePanels: ['editor', 'terminal'],
  },
  terminalState: {
    tabs: [],
    activeTabId: null,
  },
  lastModified: Date.now(),
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Monaco, monospace',
  tabSize: 2,
  autoSave: true,
  autoSaveDelay: 1000,
  minimap: true,
  lineNumbers: true,
  wordWrap: false,
  keyboardShortcuts: {},
  aiPreferences: {
    defaultModel: 'claude-sonnet-4-20250514',
    autoComplete: true,
    inlineSuggestions: true,
  },
  notifications: {
    enabled: true,
    desktop: true,
    sound: false,
    emailDigest: false,
  },
  lastModified: Date.now(),
};

// ============================================================
// WORKSPACE STATE SYNC
// ============================================================

/**
 * GET /api/sync/workspace
 * Get current workspace state for the user
 */
router.get('/workspace', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const workspaceState = (settings?.workspaceState as WorkspaceState) || DEFAULT_WORKSPACE_STATE;

    res.json(workspaceState);
  } catch (error) {
    logger.error('Failed to get workspace state:', error);
    res.status(500).json({ error: 'Failed to get workspace state' });
  }
});

/**
 * PUT /api/sync/workspace
 * Update workspace state
 */
router.put('/workspace', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const workspaceState: Partial<WorkspaceState> = req.body;

    if (!workspaceState) {
      return res.status(400).json({ error: 'Workspace state is required' });
    }

    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const currentState = (settings?.workspaceState as WorkspaceState) || DEFAULT_WORKSPACE_STATE;

    const updatedState: WorkspaceState = {
      ...currentState,
      ...workspaceState,
      lastModified: Date.now(),
    };

    await storage.updateDynamicIntelligenceSettings(userId, {
      workspaceState: updatedState as any,
    });

    logger.info(`Workspace state updated for user ${userId}`);
    res.json({ success: true, workspaceState: updatedState });
  } catch (error) {
    logger.error('Failed to update workspace state:', error);
    res.status(500).json({ error: 'Failed to update workspace state' });
  }
});

// ============================================================
// USER PREFERENCES SYNC
// ============================================================

/**
 * GET /api/sync/preferences
 * Get user preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const settings = await storage.getDynamicIntelligenceSettings(userId);
    
    const preferences: UserPreferences = (settings?.userPreferences as UserPreferences) || {
      ...DEFAULT_PREFERENCES,
      aiPreferences: {
        ...DEFAULT_PREFERENCES.aiPreferences,
        defaultModel: settings?.preferredModel || 'claude-sonnet-4-20250514',
      },
    };

    res.json(preferences);
  } catch (error) {
    logger.error('Failed to get preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/sync/preferences
 * Update user preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const preferences: Partial<UserPreferences> = req.body;

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences are required' });
    }

    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const currentPreferences = (settings?.userPreferences as UserPreferences) || DEFAULT_PREFERENCES;

    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...preferences,
      lastModified: Date.now(),
    };

    await storage.updateDynamicIntelligenceSettings(userId, {
      userPreferences: updatedPreferences as any,
    });

    logger.info(`Preferences updated for user ${userId}`);
    res.json({ success: true, preferences: updatedPreferences });
  } catch (error) {
    logger.error('Failed to update preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ============================================================
// DEVICE MANAGEMENT
// ============================================================

/**
 * GET /api/sync/devices
 * Get list of devices for the user
 */
router.get('/devices', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const devices: DeviceInfo[] = (settings?.devices as DeviceInfo[]) || [];

    res.json(devices);
  } catch (error) {
    logger.error('Failed to get devices:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

/**
 * POST /api/sync/devices
 * Register a new device
 */
router.post('/devices', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const { deviceName, deviceType, platform } = req.body;

    if (!deviceName || !deviceType || !platform) {
      return res.status(400).json({ error: 'Device info is required' });
    }

    const deviceId = randomUUID();
    const newDevice: DeviceInfo = {
      deviceId,
      deviceName,
      deviceType,
      platform,
      lastSyncAt: Date.now(),
    };

    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const devices: DeviceInfo[] = (settings?.devices as DeviceInfo[]) || [];
    devices.push(newDevice);

    await storage.updateDynamicIntelligenceSettings(userId, { devices: devices as any });

    logger.info(`Device registered for user ${userId}: ${deviceName}`);
    res.json({ success: true, device: newDevice });
  } catch (error) {
    logger.error('Failed to register device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * PUT /api/sync/devices/:deviceId
 * Update device last sync time
 */
router.put('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const { deviceId } = req.params;

    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const devices: DeviceInfo[] = (settings?.devices as DeviceInfo[]) || [];
    const device = devices.find((d) => d.deviceId === deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    device.lastSyncAt = Date.now();
    await storage.updateDynamicIntelligenceSettings(userId, { devices: devices as any });

    res.json({ success: true, device });
  } catch (error) {
    logger.error('Failed to update device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

/**
 * DELETE /api/sync/devices/:deviceId
 * Remove a device
 */
router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const { deviceId } = req.params;

    const settings = await storage.getDynamicIntelligenceSettings(userId);
    const devices: DeviceInfo[] = ((settings?.devices as DeviceInfo[]) || []).filter(
      (d) => d.deviceId !== deviceId
    );

    await storage.updateDynamicIntelligenceSettings(userId, { devices: devices as any });

    logger.info(`Device removed for user ${userId}: ${deviceId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove device:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// ============================================================
// SYNC STATUS
// ============================================================

/**
 * GET /api/sync/status
 * Get sync status and last sync times
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(req.user.id);
    const settings = await storage.getDynamicIntelligenceSettings(userId);

    const workspaceState = settings?.workspaceState as WorkspaceState | undefined;
    const userPreferences = settings?.userPreferences as UserPreferences | undefined;
    const devices = (settings?.devices as DeviceInfo[]) || [];

    const status = {
      workspaceLastModified: workspaceState?.lastModified || null,
      preferencesLastModified: userPreferences?.lastModified || null,
      devicesCount: devices.length,
      lastSyncAt: Math.max(
        workspaceState?.lastModified || 0,
        userPreferences?.lastModified || 0
      ),
    };

    res.json(status);
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

export default router;
