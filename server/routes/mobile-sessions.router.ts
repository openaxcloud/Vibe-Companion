import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { storage } from '../storage';
import { ensureAuthenticated as requireAuth } from '../middleware/auth';
import { insertMobileSessionSchema, MobileSession } from '@shared/schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('mobile-sessions-router');
const router = Router();

const createMobileSessionSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceName: z.string().optional(),
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateMobileSessionSchema = z.object({
  deviceName: z.string().optional(),
  pushToken: z.string().optional(),
  isActive: z.boolean().optional(),
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/sessions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  try {
    const sessions = await storage.getUserMobileSessions(userId);
    const activeSessions = sessions.filter(s => s.isActive && new Date(s.expiresAt) > new Date());
    
    res.json({
      sessions: activeSessions.map(session => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        platform: session.platform,
        lastActiveAt: session.lastActiveAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
      })),
      total: activeSessions.length,
    });
  } catch (error) {
    logger.error('Failed to fetch mobile sessions', { userId, error });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}));

router.post('/sessions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const validation = createMobileSessionSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ 
      error: 'Invalid request body',
      details: validation.error.errors 
    });
    return;
  }

  const { deviceId, deviceName, platform, pushToken, expiresAt } = validation.data;

  try {
    const existingSession = await storage.getMobileSession(userId, deviceId);
    
    if (existingSession) {
      const updatedSession = await storage.updateMobileSession(userId, deviceId, {
        deviceName,
        pushToken,
        lastActiveAt: new Date(),
        isActive: true,
      });
      
      logger.info('Mobile session updated (re-registered)', { userId, deviceId });
      res.json({
        session: updatedSession,
        isNew: false,
      });
      return;
    }

    const sessionExpiresAt = expiresAt 
      ? new Date(expiresAt) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const newSession = await storage.createMobileSession({
      userId,
      deviceId,
      deviceName: deviceName || null,
      platform,
      pushToken: pushToken || null,
      expiresAt: sessionExpiresAt,
      isActive: true,
    });

    logger.info('Mobile session created', { userId, deviceId, platform });
    res.status(201).json({
      session: newSession,
      isNew: true,
    });
  } catch (error) {
    logger.error('Failed to create mobile session', { userId, deviceId, error });
    res.status(500).json({ error: 'Failed to create session' });
  }
}));

router.patch('/sessions/:deviceId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const { deviceId } = req.params;
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const validation = updateMobileSessionSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ 
      error: 'Invalid request body',
      details: validation.error.errors 
    });
    return;
  }

  try {
    const existingSession = await storage.getMobileSession(userId, deviceId);
    
    if (!existingSession) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const updateData: Partial<MobileSession> = {
      ...validation.data,
      lastActiveAt: new Date(),
    };

    const updatedSession = await storage.updateMobileSession(userId, deviceId, updateData);
    
    if (!updatedSession) {
      res.status(500).json({ error: 'Failed to update session' });
      return;
    }

    logger.info('Mobile session updated', { userId, deviceId });
    res.json({ session: updatedSession });
  } catch (error) {
    logger.error('Failed to update mobile session', { userId, deviceId, error });
    res.status(500).json({ error: 'Failed to update session' });
  }
}));

/**
 * POST /push-token - Register or update push notification token
 * Called by mobile app when user grants notification permissions
 */
const pushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token is required'),
  platform: z.enum(['ios', 'android']),
  deviceType: z.string().optional(),
  deviceId: z.string().optional(),
});

router.post('/push-token', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const validation = pushTokenSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ 
      error: 'Invalid request body',
      details: validation.error.errors 
    });
    return;
  }

  const { pushToken, platform, deviceId } = validation.data;
  // SECURITY: Use cryptographically secure random ID instead of predictable timestamp
  const actualDeviceId = deviceId || `${platform}-${crypto.randomUUID()}`;

  try {
    const existingSession = await storage.getMobileSession(userId, actualDeviceId);
    
    if (existingSession) {
      await storage.updateMobileSession(userId, actualDeviceId, {
        pushToken,
        lastActiveAt: new Date(),
        isActive: true,
      });
      
      logger.info('Push token updated for existing session', { userId, deviceId: actualDeviceId });
    } else {
      await storage.createMobileSession({
        userId,
        deviceId: actualDeviceId,
        deviceName: null,
        platform,
        pushToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      });
      
      logger.info('Push token registered with new session', { userId, deviceId: actualDeviceId });
    }

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    logger.error('Failed to register push token', { userId, error });
    res.status(500).json({ error: 'Failed to register push token' });
  }
}));

router.delete('/sessions/:deviceId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const { deviceId } = req.params;
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  try {
    const existingSession = await storage.getMobileSession(userId, deviceId);
    
    if (!existingSession) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const deleted = await storage.deleteMobileSession(userId, deviceId);
    
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete session' });
      return;
    }

    logger.info('Mobile session deleted', { userId, deviceId });
    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    logger.error('Failed to delete mobile session', { userId, deviceId, error });
    res.status(500).json({ error: 'Failed to delete session' });
  }
}));

export default router;
