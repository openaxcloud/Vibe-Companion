import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertNotificationSchema } from '@shared/schema';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

const notificationSettingsUpdateSchema = z.object({
  email: z.record(z.boolean()).optional(),
  push: z.record(z.boolean()).optional(),
  frequency: z.enum(['instant', 'hourly', 'daily', 'weekly']).optional(),
});

const normalizeNotificationResponse = (notification: any) => {
  const createdAt = notification.createdAt ? new Date(notification.createdAt) : new Date();

  return {
    id: notification.id,
    type: notification.type ?? 'system',
    title: notification.title,
    message: notification.body,
    body: notification.body,
    read: Boolean(notification.read),
    timestamp: createdAt.toISOString(),
    actionUrl: notification.actionUrl ?? notification.url ?? undefined,
    metadata: notification.data ?? {},
    createdAt: createdAt.toISOString(),
    sent: Boolean(notification.sent),
    sentAt: notification.sentAt ? new Date(notification.sentAt).toISOString() : null,
    readAt: notification.readAt ? new Date(notification.readAt).toISOString() : null,
  };
};

const getUserIdOrThrow = (req: any, res: any): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Not authenticated' });
    return null;
  }
  return typeof userId === 'string' ? userId : String(userId);
};

const getPreferencesHandler = async (req: any, res: any) => {
  const userId = getUserIdOrThrow(req, res);
  if (!userId) return;

  try {
    const preferences = await storage.getNotificationPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
};

const updatePreferencesHandler = async (req: any, res: any) => {
  const userId = getUserIdOrThrow(req, res);
  if (!userId) return;

  try {
    const parsed = notificationSettingsUpdateSchema.parse(req.body ?? {});
    const preferences = await storage.updateNotificationPreferences(userId, parsed);
    res.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid preferences payload', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Failed to update preferences' });
  }
};

// Get all notifications for current user
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    const unreadParam = req.query.unread;
    const unreadOnly = unreadParam === 'true' || unreadParam === '1';
    const notifications = await storage.getNotifications(userId, unreadOnly);

    res.json(notifications.map(normalizeNotificationResponse));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', ensureAuthenticated, async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// Get notification preferences
router.get('/preferences', ensureAuthenticated, getPreferencesHandler);
router.get('/settings', ensureAuthenticated, getPreferencesHandler);

// Update notification preferences
router.patch('/preferences', ensureAuthenticated, updatePreferencesHandler);
router.put('/preferences', ensureAuthenticated, updatePreferencesHandler);
router.patch('/settings', ensureAuthenticated, updatePreferencesHandler);
router.put('/settings', ensureAuthenticated, updatePreferencesHandler);

// Mark notification as read
const markNotificationAsReadHandler = async (req: any, res: any) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    const notificationId = parseInt(req.params.id, 10);
    if (Number.isNaN(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    await storage.markNotificationAsRead(notificationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
};

router.patch('/:id/read', ensureAuthenticated, markNotificationAsReadHandler);
router.put('/:id/read', ensureAuthenticated, markNotificationAsReadHandler);

// Mark all notifications as read
const markAllNotificationsAsReadHandler = async (req: any, res: any) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
};

router.patch('/read-all', ensureAuthenticated, markAllNotificationsAsReadHandler);
router.put('/read-all', ensureAuthenticated, markAllNotificationsAsReadHandler);

// Delete notification
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }
    
    await storage.deleteNotification(notificationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

// Delete all notifications  
router.delete('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    await storage.deleteAllNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ message: 'Failed to delete all notifications' });
  }
});

// Create notification (mainly for testing, real notifications will be created by system events)
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req, res);
    if (!userId) return;

    const payload = {
      ...req.body,
      body: req.body?.body ?? req.body?.message,
      data: req.body?.metadata ?? req.body?.data,
      actionUrl: req.body?.actionUrl ?? req.body?.url ?? req.body?.link,
    };

    if (!payload.body || typeof payload.body !== 'string') {
      return res.status(400).json({ message: 'Notification body is required' });
    }

    const parsed = insertNotificationSchema.parse({ ...payload, userId });
    const notification = await storage.createNotification(parsed);
    res.json(normalizeNotificationResponse(notification));
  } catch (error) {
    console.error('Error creating notification:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid notification payload', errors: error.errors });
      return;
    }
    res.status(500).json({ message: 'Failed to create notification' });
  }
});

export default router;