// @ts-nocheck
/**
 * Complete Authentication System with Enhanced Security
 * Implements session management, account lockout, and 2FA preparation
 */

import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { db } from '../db';
import { users, authAttempts, userSessions } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { passwordSecurity, tokenSecurity, sessionSecurity, twoFactorAuth, emailValidation } from '../utils/security';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';

const logger = createLogger('auth-complete');

// Configuration
const AUTH_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  sessionRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  passwordMinLength: 8,
  requirePasswordComplexity: true,
  require2FA: false, // Can be enabled per user
};

/**
 * Account Lockout Management
 */
class AccountLockoutManager {
  private lockouts = new Map<string, { count: number; lockedUntil?: Date }>();

  async recordFailedAttempt(username: string, ip: string): Promise<void> {
    const key = `${username}:${ip}`;
    const record = this.lockouts.get(key) || { count: 0 };

    record.count++;

    if (record.count >= AUTH_CONFIG.maxFailedAttempts) {
      record.lockedUntil = new Date(Date.now() + AUTH_CONFIG.lockoutDuration);
      
      // Log security event
      logger.warn('Account locked due to failed attempts', {
        username,
        ip,
        attempts: record.count,
        lockedUntil: record.lockedUntil,
      });

      // Store in database for persistence
      try {
        await db.insert(authAttempts).values({
          id: crypto.randomUUID(),
          username,
          ipAddress: ip,
          attemptType: 'failed',
          lockedUntil: record.lockedUntil,
          createdAt: new Date(),
        });
      } catch (error) {
        logger.error('Failed to record auth attempt in database', error);
      }
    }

    this.lockouts.set(key, record);
  }

  async clearFailedAttempts(username: string, ip: string): Promise<void> {
    const key = `${username}:${ip}`;
    this.lockouts.delete(key);

    // Record successful attempt
    try {
      await db.insert(authAttempts).values({
        id: crypto.randomUUID(),
        username,
        ipAddress: ip,
        attemptType: 'success',
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to record successful auth in database', error);
    }
  }

  isLockedOut(username: string, ip: string): boolean {
    const key = `${username}:${ip}`;
    const record = this.lockouts.get(key);

    if (!record || !record.lockedUntil) {
      return false;
    }

    if (new Date() > record.lockedUntil) {
      // Lockout expired
      this.lockouts.delete(key);
      return false;
    }

    return true;
  }

  getRemainingLockoutTime(username: string, ip: string): number {
    const key = `${username}:${ip}`;
    const record = this.lockouts.get(key);

    if (!record || !record.lockedUntil) {
      return 0;
    }

    const remaining = record.lockedUntil.getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
  }
}

const lockoutManager = new AccountLockoutManager();

/**
 * Session Management
 */
class SecureSessionManager {
  private activeSessions = new Map<string, {
    userId: string;
    createdAt: Date;
    lastActivity: Date;
    ipAddress: string;
    userAgent: string;
    csrfToken: string;
  }>();

  createSession(userId: string, req: Request): string {
    const sessionId = sessionSecurity.generateSessionId();
    const csrfToken = tokenSecurity.generateToken(32);

    this.activeSessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      csrfToken,
    });

    // Store in database for persistence
    db.insert(userSessions).values({
      id: sessionId,
      userId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + AUTH_CONFIG.sessionTimeout),
    }).catch((error) => {
      logger.error('Failed to persist session', error);
    });

    return sessionId;
  }

  getSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has timed out
    const inactiveTime = Date.now() - session.lastActivity.getTime();
    if (inactiveTime > AUTH_CONFIG.sessionTimeout) {
      this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  updateActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      session.lastActivity = new Date();

      // Update in database
      db.update(userSessions)
        .set({ lastActivity: new Date() })
        .where(eq(userSessions.id, sessionId))
        .catch((error) => {
          logger.error('Failed to update session activity', error);
        });
    }
  }

  destroySession(sessionId: string): void {
    this.activeSessions.delete(sessionId);

    // Remove from database
    db.delete(userSessions)
      .where(eq(userSessions.id, sessionId))
      .catch((error) => {
        logger.error('Failed to delete session from database', error);
      });
  }

  destroyAllUserSessions(userId: string): void {
    // Remove from memory
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Remove from database
    db.delete(userSessions)
      .where(eq(userSessions.userId, userId))
      .catch((error) => {
        logger.error('Failed to delete user sessions from database', error);
      });
  }

  getCsrfToken(sessionId: string): string | null {
    const session = this.activeSessions.get(sessionId);
    return session?.csrfToken || null;
  }

  verifyCsrfToken(sessionId: string, token: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.csrfToken === token;
  }
}

const sessionManager = new SecureSessionManager();

/**
 * Password Validation & Management
 */
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < AUTH_CONFIG.passwordMinLength) {
    errors.push(`Password must be at least ${AUTH_CONFIG.passwordMinLength} characters long`);
  }

  if (AUTH_CONFIG.requirePasswordComplexity) {
    const complexity = passwordSecurity.validateStrength(password);
    if (!complexity.valid) {
      errors.push(...complexity.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Authentication Middleware
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.session?.id;

  if (!sessionId) {
    return res.status(401).json({ error: 'No session found' });
  }

  const session = sessionManager.getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  // Update session activity
  sessionManager.updateActivity(sessionId);

  // Attach user info to request
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      sessionManager.destroySession(sessionId);
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    res.locals.csrfToken = session.csrfToken;
    next();
  } catch (error) {
    logger.error('Failed to fetch user for session', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * CSRF Protection Middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip for GET requests and public endpoints
  if (req.method === 'GET' || req.path.startsWith('/api/public')) {
    return next();
  }

  const sessionId = req.session?.id;
  if (!sessionId) {
    return res.status(403).json({ error: 'No session found' });
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  if (!csrfToken || !sessionManager.verifyCsrfToken(sessionId, csrfToken)) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      sessionId,
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

/**
 * Login Handler
 */
export const handleLogin = async (req: Request, res: Response) => {
  const { username, password, totpToken } = req.body;
  const ip = req.ip || 'unknown';

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check lockout
  if (lockoutManager.isLockedOut(username, ip)) {
    const remaining = lockoutManager.getRemainingLockoutTime(username, ip);
    return res.status(423).json({ 
      error: 'Account temporarily locked',
      retryAfter: remaining,
    });
  }

  try {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      await lockoutManager.recordFailedAttempt(username, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordValid = await passwordSecurity.verify(password, user.password);
    if (!passwordValid) {
      await lockoutManager.recordFailedAttempt(username, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpToken) {
        return res.status(200).json({ 
          require2FA: true,
          message: 'Please provide 2FA token',
        });
      }

      const tokenValid = twoFactorAuth.verifyToken(user.twoFactorSecret, totpToken);
      if (!tokenValid) {
        await lockoutManager.recordFailedAttempt(username, ip);
        return res.status(401).json({ error: 'Invalid 2FA token' });
      }
    }

    // Clear failed attempts
    await lockoutManager.clearFailedAttempts(username, ip);

    // Create session
    const sessionId = sessionManager.createSession(user.id, req);
    const csrfToken = sessionManager.getCsrfToken(sessionId);

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Set secure session cookie
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed', err);
        return res.status(500).json({ error: 'Session creation failed' });
      }

      req.session.userId = String(user.id);
      req.session.id = sessionId;

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        csrfToken,
      });
    });
  } catch (error) {
    logger.error('Login error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout Handler
 */
export const handleLogout = (req: Request, res: Response) => {
  const sessionId = req.session?.id;

  if (sessionId) {
    sessionManager.destroySession(sessionId);
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction failed', err);
    }

    res.clearCookie('ecode.sid');
    res.json({ success: true });
  });
};

/**
 * Register Handler
 */
export const handleRegister = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  // Validate email
  if (!emailValidation.isValid(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Check for disposable email
  if (emailValidation.isDisposable(email)) {
    return res.status(400).json({ error: 'Disposable email addresses not allowed' });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ 
      error: 'Password does not meet requirements',
      details: passwordValidation.errors,
    });
  }

  try {
    // Check if username exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const password = await passwordSecurity.hash(password);

    // Create user
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      username,
      email: emailValidation.normalize(email),
      password,
      role: 'user',
      createdAt: new Date(),
    });

    // Create session
    const sessionId = sessionManager.createSession(userId, req);
    const csrfToken = sessionManager.getCsrfToken(sessionId);

    req.session.userId = String(userId);
    req.session.id = sessionId;

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        username,
        email,
        role: 'user',
      },
      csrfToken,
    });
  } catch (error) {
    logger.error('Registration error', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Enable 2FA Handler
 */
export const handleEnable2FA = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { secret, qrCode } = twoFactorAuth.generateSecret();
  const backupCodes = twoFactorAuth.generateBackupCodes();

  // Store secret temporarily (should be confirmed with valid token)
  res.json({
    secret,
    qrCode,
    backupCodes,
    message: 'Scan the QR code with your authenticator app and verify with a token',
  });
};

/**
 * Verify 2FA Setup
 */
export const handleVerify2FA = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { secret, token } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!twoFactorAuth.verifyToken(secret, token)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  // Save secret to user account
  await db
    .update(users)
    .set({ 
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    })
    .where(eq(users.id, userId));

  res.json({ success: true, message: '2FA enabled successfully' });
};

/**
 * Password Reset Handler
 */
export const handlePasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!emailValidation.isValid(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailValidation.normalize(email)))
      .limit(1);

    if (user) {
      // Generate reset token
      const resetToken = tokenSecurity.generateToken(32);
      const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token (in production, send via email)
      await db
        .update(users)
        .set({ 
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry,
        })
        .where(eq(users.id, user.id));

      logger.info('Password reset requested', { userId: user.id, email });
    }

    // Always return success to prevent email enumeration
    res.json({ 
      success: true, 
      message: 'If an account exists, a reset link has been sent',
    });
  } catch (error) {
    logger.error('Password reset error', error);
    return res.status(500).json({ error: 'Request failed' });
  }
};

/**
 * Session Refresh Middleware
 */
export const sessionRefresh = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.session?.id;

  if (sessionId) {
    const session = sessionManager.getSession(sessionId);
    
    if (session) {
      const timeSinceActivity = Date.now() - session.lastActivity.getTime();
      
      // Refresh session if close to expiry
      if (timeSinceActivity > AUTH_CONFIG.sessionTimeout - AUTH_CONFIG.sessionRefreshThreshold) {
        req.session.touch();
      }
    }
  }

  next();
};

export default {
  authMiddleware,
  csrfProtection,
  handleLogin,
  handleLogout,
  handleRegister,
  handleEnable2FA,
  handleVerify2FA,
  handlePasswordReset,
  sessionRefresh,
  lockoutManager,
  sessionManager,
};