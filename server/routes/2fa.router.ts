/**
 * Two-Factor Authentication Router
 * Exposes 2FA setup, verification, and management endpoints
 * 
 * Endpoints:
 * - POST-LOGIN MANAGEMENT (requires full authentication):
 *   - GET /status - Get 2FA status
 *   - POST /setup - Initiate 2FA setup
 *   - POST /confirm - Confirm 2FA with TOTP token
 *   - POST /disable - Disable 2FA
 *   - POST /backup-codes/regenerate - Regenerate backup codes
 * 
 * - LOGIN FLOW (uses challenge token, no session required):
 *   - POST /challenge/verify - Verify 2FA during login
 *   - POST /challenge/emergency - Request emergency code during login
 */

import { Router, Request, Response, NextFunction } from 'express';
import { real2FAService } from '../services/real-2fa-service';
import { createLogger } from '../utils/logger';
import { z } from 'zod';
import crypto from 'crypto';

const logger = createLogger('2fa-router');
const router = Router();

const pendingChallenges = new Map<string, {
  userId: number;
  timestamp: number;
  attempts: number;
}>();

const verifiedChallenges = new Map<string, {
  userId: number;
  timestamp: number;
}>();

setInterval(() => {
  const now = Date.now();
  const expireTime = 5 * 60 * 1000;
  for (const [id, challenge] of pendingChallenges) {
    if (now - challenge.timestamp > expireTime) {
      pendingChallenges.delete(id);
    }
  }
  for (const [token, verified] of verifiedChallenges) {
    if (now - verified.timestamp > 60 * 1000) {
      verifiedChallenges.delete(token);
    }
  }
}, 60 * 1000);

function createSignedProof(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  verifiedChallenges.set(token, {
    userId,
    timestamp: Date.now()
  });
  return token;
}

export function consumeVerifiedChallenge(token: string): number | null {
  const verified = verifiedChallenges.get(token);
  if (!verified) return null;
  if (Date.now() - verified.timestamp > 60 * 1000) {
    verifiedChallenges.delete(token);
    return null;
  }
  verifiedChallenges.delete(token);
  return verified.userId;
}

const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const getUserId = (req: Request): number => {
  const user = req.user as { id: number } | undefined;
  if (!user?.id) {
    throw new Error('User ID not found in session');
  }
  return user.id;
};

export function createTwoFactorChallenge(userId: number): string {
  const challengeId = crypto.randomBytes(32).toString('hex');
  pendingChallenges.set(challengeId, {
    userId,
    timestamp: Date.now(),
    attempts: 0
  });
  logger.info(`2FA challenge created for user ${userId}`);
  return challengeId;
}

export function validateTwoFactorChallenge(challengeId: string): number | null {
  const challenge = pendingChallenges.get(challengeId);
  if (!challenge) {
    return null;
  }
  
  if (Date.now() - challenge.timestamp > 5 * 60 * 1000) {
    pendingChallenges.delete(challengeId);
    return null;
  }
  
  return challenge.userId;
}

export function consumeTwoFactorChallenge(challengeId: string): void {
  pendingChallenges.delete(challengeId);
}

router.get('/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const status = await real2FAService.getTwoFactorStatus(userId);
    res.json(status);
  } catch (error) {
    logger.error('Failed to get 2FA status', { error });
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

router.post('/setup', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = await real2FAService.setupTwoFactor(userId);
    res.json({
      secret: result.secret,
      qrCodeUrl: result.qrCodeUrl,
      backupCodes: result.backupCodes
    });
  } catch (error) {
    logger.error('Failed to setup 2FA', { error });
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

const confirmSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits')
});

router.post('/confirm', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { token } = confirmSchema.parse(req.body);
    const userId = getUserId(req);
    const result = await real2FAService.confirmTwoFactorSetup(userId, token);
    
    if (!result.verified) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Failed to confirm 2FA', { error });
    res.status(500).json({ error: 'Failed to confirm 2FA' });
  }
});

const verifySchema = z.object({
  token: z.string().min(6, 'Token required')
});

router.post('/verify', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { token } = verifySchema.parse(req.body);
    const userId = getUserId(req);
    
    const result = await real2FAService.verifyTwoFactorToken(userId, token);
    
    if (!result.verified) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Failed to verify 2FA', { error });
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

const challengeVerifySchema = z.object({
  challengeId: z.string().length(64, 'Invalid challenge ID'),
  token: z.string().min(6, 'Token required'),
  type: z.enum(['totp', 'backup', 'emergency']).optional().default('totp')
});

router.post('/challenge/verify', async (req: Request, res: Response) => {
  try {
    const { challengeId, token, type } = challengeVerifySchema.parse(req.body);
    
    const challenge = pendingChallenges.get(challengeId);
    if (!challenge) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }
    
    if (challenge.attempts >= 3) {
      pendingChallenges.delete(challengeId);
      return res.status(429).json({ error: 'Too many failed attempts' });
    }
    
    let result;
    if (type === 'emergency') {
      result = await real2FAService.verifyEmergencyToken(challenge.userId, token);
    } else if (type === 'backup') {
      result = await real2FAService.verifyBackupCode(challenge.userId, token);
    } else {
      result = await real2FAService.verifyTOTPOnly(challenge.userId, token);
    }
    
    if (!result.verified) {
      challenge.attempts++;
      return res.status(400).json({ 
        error: result.error,
        attemptsRemaining: 3 - challenge.attempts
      });
    }
    
    pendingChallenges.delete(challengeId);
    
    const pendingSessionToken = createSignedProof(challenge.userId);
    
    res.json({ 
      success: true,
      pendingSessionToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Failed to verify 2FA challenge', { error });
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

const challengeEmergencySchema = z.object({
  challengeId: z.string().length(64, 'Invalid challenge ID')
});

router.post('/challenge/emergency', async (req: Request, res: Response) => {
  try {
    const { challengeId } = challengeEmergencySchema.parse(req.body);
    
    const userId = validateTwoFactorChallenge(challengeId);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }
    
    const message = await real2FAService.generateEmergencyToken(userId);
    res.json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Failed to send emergency code', { error });
    res.status(500).json({ error: 'Failed to send emergency code' });
  }
});

const disableSchema = z.object({
  password: z.string().min(1, 'Password required')
});

router.post('/disable', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { password } = disableSchema.parse(req.body);
    const userId = getUserId(req);
    
    await real2FAService.disableTwoFactor(userId, password);
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Failed to disable 2FA', { error });
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

router.post('/backup-codes/regenerate', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const codes = await real2FAService.regenerateBackupCodes(userId);
    res.json({ backupCodes: codes });
  } catch (error) {
    logger.error('Failed to regenerate backup codes', { error });
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

router.post('/emergency', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const message = await real2FAService.generateEmergencyToken(userId);
    res.json({ message });
  } catch (error) {
    logger.error('Failed to send emergency code', { error });
    res.status(500).json({ error: 'Failed to send emergency code' });
  }
});

export default router;
