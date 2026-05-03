/**
 * User Settings Router
 * Mounted at /api/user/*
 *
 * Covers: profile, avatar, email, password, username, sessions, 2FA status,
 * connected services, SSH keys, personal API tokens, notification prefs,
 * account export, and account deletion.
 *
 * Security hardening:
 * - Auth-sensitive mutations (password, email, username, account deletion)
 *   are protected by the 'auth' rate limiter (5 req/15 min on prod).
 * - Password and email changes rotate the session to prevent fixation.
 * - All mutation routes require CSRF protection.
 * - Sensitive fields are stripped from every user payload.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createRateLimitMiddleware } from '../middleware/rate-limiter';
import { real2FAService } from '../services/real-2fa-service';
import { pool } from '../db';
import multer from 'multer';
import bcrypt from '../utils/bcrypt-compat';
import crypto from 'crypto';
import { resendVerificationEmail } from '../utils/sendgrid-email-service';

const router = Router();

const authLimiter = createRateLimitMiddleware('auth');

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, GIF, or WEBP images are allowed'));
  },
});

function getUserId(req: Request): string {
  return String((req.user as any)?.id ?? (req.session as any)?.userId ?? '');
}

/**
 * Strict allowlist DTO — only returns fields the client legitimately needs.
 * Never spread raw DB rows; add fields here intentionally.
 */
function safeUser(user: Record<string, unknown>) {
  return {
    id:                user.id,
    username:          user.username,
    email:             user.email,
    displayName:       user.displayName,
    avatarUrl:         user.avatarUrl ?? user.profileImageUrl,
    bio:               user.bio,
    website:           user.website,
    location:          user.location,
    githubUsername:    user.githubUsername,
    twitterUsername:   user.twitterUsername,
    linkedinUsername:  user.linkedinUsername,
    firstName:         user.firstName,
    lastName:          user.lastName,
    emailVerified:     user.emailVerified,
    twoFactorEnabled:  user.twoFactorEnabled,
    role:              user.role,
    subscriptionTier:  user.subscriptionTier,
    creditsBalance:    user.creditsBalance,
    preferredAiModel:  user.preferredAiModel,
    reputation:        user.reputation,
    isMentor:          user.isMentor,
    usernameChangedAt: user.usernameChangedAt,
    lastLoginAt:       user.lastLoginAt,
    createdAt:         user.createdAt,
    // Intentionally excluded: password, twoFactorSecret, twoFactorBackupCodes,
    // githubId/googleId/twitterId/appleId, githubTokenCiphertext/Iv,
    // emailVerificationToken/Expiry, passwordResetToken/Expiry,
    // failedLoginAttempts, accountLockedUntil, lastLoginIp,
    // stripeCustomerId/SubscriptionId/PriceId, isBanned/bannedAt/banReason
  };
}

/**
 * Rotate the session ID (prevent fixation) then call next().
 * If regeneration fails we still let the response continue.
 */
function rotateSession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    const passport = (req.session as any)?.passport;
    const userId = (req.session as any)?.userId;
    req.session.regenerate((err) => {
      if (err) {
        console.warn('[user-settings] session regeneration failed:', err?.message);
      } else {
        // Restore the Passport identity and userId so the user stays logged in
        (req.session as any).passport = passport;
        (req.session as any).userId = userId;
        req.session.save(() => {});
      }
      resolve();
    });
  });
}

// ------------------------------------------------------------------
// GET /api/user/settings — aggregated settings payload
// ------------------------------------------------------------------
router.get('/settings', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [user, prefs, notifPrefs] = await Promise.all([
      storage.getUser(userId),
      storage.getUserPreferences(userId),
      storage.getNotificationPreferences(userId).catch(() => null),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const u = user as Record<string, unknown>;
    const twoFactorEnabled = !!u.twoFactorEnabled;
    const githubConnected = !!u.githubTokenCiphertext;
    const githubUsername = (u.githubUsername as string) || null;

    res.json({
      ...(safeUser(user as Record<string, unknown>)),
      preferences: prefs,
      notificationPreferences: notifPrefs,
      twoFactorEnabled,
      githubConnected,
      githubUsername,
    });
  } catch (err: any) {
    console.error('[user-settings] GET /settings error:', err);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/profile — lightweight profile read
// ------------------------------------------------------------------
router.get('/profile', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(getUserId(req));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(safeUser(user as Record<string, unknown>));
  } catch {
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/preferences — standalone preferences read
// ------------------------------------------------------------------
router.get('/preferences', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const prefs = await storage.getUserPreferences(getUserId(req));
    res.json(prefs ?? {});
  } catch {
    res.status(500).json({ message: 'Failed to load preferences' });
  }
});

// ------------------------------------------------------------------
// PUT /api/user/preferences — standalone preferences update (CSRF-protected)
// ------------------------------------------------------------------
router.put('/preferences', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const customThemeSchema = z.object({
      name: z.string(),
      colors: z.object({
        background: z.string(), text: z.string(),
        accent: z.string(), panel: z.string(), border: z.string(),
      }),
    });
    const schema = z.object({
      fontSize:                z.number().int().min(10).max(24).optional(),
      tabSize:                 z.number().int().min(1).max(8).optional(),
      wordWrap:                z.boolean().optional(),
      theme:                   z.string().optional(),
      language:                z.string().optional(),
      activeThemeId:           z.string().nullable().optional(),
      agentToolsConfig:        z.record(z.any()).optional(),
      keyboardShortcuts:       z.record(z.string().nullable()).optional(),
      autoCloseBrackets:       z.boolean().optional(),
      indentationDetection:    z.boolean().optional(),
      formatPastedText:        z.boolean().optional(),
      indentationChar:         z.enum(['spaces', 'tabs']).optional(),
      indentationSize:         z.number().int().min(1).max(8).optional(),
      minimap:                 z.boolean().optional(),
      multiselectModifier:     z.enum(['Alt', 'Ctrl', 'Meta']).optional(),
      filetreeGitStatus:       z.boolean().optional(),
      semanticTokens:          z.boolean().optional(),
      aiCodeCompletion:        z.boolean().optional(),
      acceptSuggestionOnCommit: z.boolean().optional(),
      shellBell:               z.boolean().optional(),
      automaticPreview:        z.boolean().optional(),
      forwardPorts:            z.boolean().optional(),
      agentAudioNotification:  z.boolean().optional(),
      agentPushNotification:   z.boolean().optional(),
      accessibleTerminal:      z.boolean().optional(),
      customTheme:             customThemeSchema.nullable().optional(),
      communityTheme:          z.string().nullable().optional(),
      keyboardMode:            z.boolean().optional(),
      keyboardModePromptDismissed: z.boolean().optional(),
      creditAlertThreshold:    z.number().min(0).max(100).optional(),
    });
    const data = schema.parse(req.body);
    const updated = await storage.updateUserPreferences(getUserId(req), data);
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to save preferences' });
  }
});

// ------------------------------------------------------------------
// PUT /api/user/profile — profile update
// ------------------------------------------------------------------
router.put('/profile', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      displayName: z.string().min(1).max(100).optional(),
      bio:         z.string().max(500).optional().nullable(),
      website:     z.string().max(200).optional().nullable(),
      location:    z.string().max(100).optional().nullable(),
      github:      z.string().max(50).optional().nullable(),
      twitter:     z.string().max(50).optional().nullable(),
    });
    const data = schema.parse(req.body);
    const userId = getUserId(req);

    const patch: Parameters<typeof storage.updateUser>[1] = {};
    if (data.displayName !== undefined) patch.displayName    = data.displayName;
    if ('bio'      in data) patch.bio             = data.bio ?? null;
    if ('website'  in data) patch.website         = data.website ?? null;
    if ('location' in data) patch.location        = data.location ?? null;
    if ('github'   in data) patch.githubUsername  = data.github ?? null;
    if ('twitter'  in data) patch.twitterUsername = data.twitter ?? null;

    const updated = await storage.updateUser(userId, patch);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(safeUser(updated as Record<string, unknown>));
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// ------------------------------------------------------------------
// POST /api/user/avatar — avatar upload (≤2 MB)
// ------------------------------------------------------------------
router.post('/avatar', ensureAuthenticated, csrfProtection, (req: Request, res: Response) => {
  memUpload.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const userId = getUserId(req);
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      const updated = await storage.updateUser(userId, { avatarUrl: dataUrl });
      if (!updated) return res.status(404).json({ message: 'User not found' });
      res.json({ avatarUrl: (updated as Record<string, unknown>).avatarUrl });
    } catch {
      res.status(500).json({ message: 'Failed to save avatar' });
    }
  });
});

// ------------------------------------------------------------------
// PUT /api/user/email — email change (auth rate-limited, session rotated)
// ------------------------------------------------------------------
router.put('/email', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.password) {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const existing = await storage.getUserByEmail(email);
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: 'Email already in use by another account' });
    }

    await storage.updateUser(userId, { email, emailVerified: false });

    // Send verification email for the new address
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.createEmailVerification(userId, token, expiresAt);
    resendVerificationEmail(userId, email, user.displayName || user.username || '', token).catch(e =>
      console.warn('[user-settings] failed to send verification email:', e?.message)
    );

    // Rotate session to prevent fixation
    await rotateSession(req);

    console.log(`[AUDIT] Email changed: userId=${userId} newEmail=${email} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ email, emailVerified: false, message: 'Email updated. Check your inbox to verify.' });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to update email' });
  }
});

// ------------------------------------------------------------------
// PUT /api/user/password — change password (auth rate-limited, session rotated)
// ------------------------------------------------------------------
router.put('/password', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8),
    }).parse(req.body);

    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.password) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await storage.updateUser(userId, { password: hashedPassword });

    // Rotate session to prevent fixation after credential change
    await rotateSession(req);

    console.log(`[AUDIT] Password changed: userId=${userId} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ message: 'Password updated successfully' });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// ------------------------------------------------------------------
// PUT /api/user/username — one-time username change (auth rate-limited)
// ------------------------------------------------------------------
router.put('/username', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { username } = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens'),
    }).parse(req.body);

    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if ((user as Record<string, unknown>).usernameChangedAt) {
      return res.status(400).json({ message: 'Username can only be changed once' });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    const updated = await storage.changeUsername(userId, username);
    if (!updated) return res.status(400).json({ message: 'Failed to change username' });
    res.json({ username: updated.username });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to change username' });
  }
});

// ------------------------------------------------------------------
// POST /api/user/resend-verification — resend email verification
// ------------------------------------------------------------------
router.post('/resend-verification', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ message: 'Email is already verified' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.createEmailVerification(userId, token, expiresAt);
    await resendVerificationEmail(userId, user.email || '', user.displayName || user.username || '', token);
    res.json({ message: 'Verification email sent. Check your inbox.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/user/account — account deletion (auth rate-limited)
// ------------------------------------------------------------------
router.delete('/account', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }).parse(req.body);
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    console.log(`[AUDIT] Account deletion: userId=${userId} email=${user?.email} ip=${req.ip} at=${new Date().toISOString()}`);
    await storage.deleteUser(userId);
    req.logout?.((err) => { if (err) console.error('[user-settings] logout error:', err); });
    if (req.session) req.session.destroy(() => {});
    res.json({ message: 'Account deleted' });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Type 'DELETE MY ACCOUNT' to confirm" });
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/export — data export (JSON file download)
// ------------------------------------------------------------------
router.get('/export', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [user, projects] = await Promise.all([
      storage.getUser(userId),
      storage.getProjects(userId),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ecode-export-${userId}-${Date.now()}.json"`);
    res.json({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, createdAt: user.createdAt },
      projects: projects.map(p => ({ id: p.id, name: p.name, language: p.language, createdAt: p.createdAt })),
      exportedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ message: 'Failed to export data' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/sessions — list active sessions
// ------------------------------------------------------------------
router.get('/sessions', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const currentSid = req.sessionID;

    const result = await pool.query(
      `SELECT sid, sess, expire FROM user_sessions
       WHERE sess->>'passport' IS NOT NULL
         AND (sess->'passport'->>'user')::text = $1
         AND expire > NOW()
       ORDER BY expire DESC LIMIT 50`,
      [userId]
    );

    const sessions = result.rows.map((row: any) => {
      const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
      return {
        id: row.sid,
        isCurrent: row.sid === currentSid,
        userAgent: sess.userAgent || null,
        ip: sess.ip || sess.lastLoginIp || null,
        lastActive: row.expire,
        createdAt: sess.createdAt || null,
      };
    });

    res.json(sessions);
  } catch (err: any) {
    console.error('[user-settings] GET /sessions error:', err);
    res.json([]);
  }
});

// ------------------------------------------------------------------
// DELETE /api/user/sessions/:id — revoke a session
// ------------------------------------------------------------------
router.delete('/sessions/:id', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const sid = req.params.id;
    const check = await pool.query(
      `SELECT sid FROM user_sessions
       WHERE sid = $1 AND (sess->'passport'->>'user')::text = $2`,
      [sid, userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    await pool.query('DELETE FROM user_sessions WHERE sid = $1', [sid]);
    res.json({ message: 'Session revoked' });
  } catch {
    res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// ------------------------------------------------------------------
// POST /api/user/sessions/revoke-others — revoke all except current
// ------------------------------------------------------------------
router.post('/sessions/revoke-others', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const currentSid = req.sessionID;
    await pool.query(
      `DELETE FROM user_sessions
       WHERE (sess->'passport'->>'user')::text = $1 AND sid != $2`,
      [userId, currentSid]
    );
    res.json({ message: 'All other sessions revoked' });
  } catch {
    res.status(500).json({ message: 'Failed to revoke sessions' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/2fa-status — legacy alias kept for backwards compat
// ------------------------------------------------------------------
router.get('/2fa-status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const status = await real2FAService.getTwoFactorStatus(getUserId(req));
    res.json({ enabled: status.enabled });
  } catch {
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
});

// ------------------------------------------------------------------
// /api/user/2fa/* — full 2FA TOTP suite (consistent namespace)
// ------------------------------------------------------------------
router.get('/2fa/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const status = await real2FAService.getTwoFactorStatus(getUserId(req));
    res.json(status);
  } catch {
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
});

router.post('/2fa/setup', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const result = await real2FAService.setupTwoFactor(getUserId(req));
    res.json({ secret: result.secret, qrCodeUrl: result.qrCodeUrl, backupCodes: result.backupCodes });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to start 2FA setup' });
  }
});

async function handle2FAConfirm(req: Request, res: Response) {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const userId = getUserId(req);
    const result = await real2FAService.confirmTwoFactorSetup(userId, token);
    if (!result.verified) return res.status(400).json({ message: result.error || 'Invalid token' });
    console.log(`[AUDIT] 2FA enabled: userId=${userId} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: err?.message || 'Failed to confirm 2FA' });
  }
}
// /confirm keeps backward compatibility; /verify is the canonical endpoint
// Both are auth-rate-limited — verifying a TOTP token is a security-sensitive action
router.post('/2fa/confirm', ensureAuthenticated, authLimiter, csrfProtection, handle2FAConfirm);
router.post('/2fa/verify',  ensureAuthenticated, authLimiter, csrfProtection, handle2FAConfirm);

router.post('/2fa/disable', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const userId = getUserId(req);

    // Verify current password before disabling 2FA — this is a security-sensitive action
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password) {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    }

    await real2FAService.disableTwoFactor(userId);
    console.log(`[AUDIT] 2FA disabled: userId=${userId} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(400).json({ message: err?.message || 'Failed to disable 2FA' });
  }
});

router.post('/2fa/backup-codes/regenerate', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const codes = await real2FAService.regenerateBackupCodes(getUserId(req));
    res.json({ backupCodes: codes });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to regenerate backup codes' });
  }
});

// ------------------------------------------------------------------
// GET /api/user/connected-services — OAuth-connected services
// ------------------------------------------------------------------
router.get('/connected-services', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const u = user as Record<string, unknown>;

    // Identity-provider links stored directly on the user record
    const identityProviders = [
      { id: 'github',  name: 'GitHub',  connected: !!u.githubId,  username: (u.githubUsername as string) || null },
      { id: 'google',  name: 'Google',  connected: !!u.googleId,  username: null },
      { id: 'twitter', name: 'Twitter', connected: !!u.twitterId, username: (u.twitterUsername as string) || null },
      { id: 'apple',   name: 'Apple',   connected: !!u.appleId,   username: null },
    ];

    // OAuth integration connections (from user_connections table)
    const integrations = await storage.getUserConnections(userId);

    res.json({ identityProviders, integrations });
  } catch {
    res.status(500).json({ message: 'Failed to load connected services' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/user/connected-services/:id — disconnect service or identity provider
// ------------------------------------------------------------------

// Maps identity provider IDs to the DB fields that must be nulled on unlink.
// GitHub additionally clears encrypted token material so no OAuth access remains.
const IDENTITY_PROVIDER_FIELDS: Record<string, Parameters<typeof storage.updateUser>[1]> = {
  github:  { githubId: null, githubTokenCiphertext: null, githubTokenIv: null },
  google:  { googleId: null },
  twitter: { twitterId: null },
  apple:   { appleId: null },
};

router.delete('/connected-services/:id', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const providerId = req.params.id;

    // If the ID matches a known OAuth identity provider, null out its DB columns
    if (Object.prototype.hasOwnProperty.call(IDENTITY_PROVIDER_FIELDS, providerId)) {
      const patch = IDENTITY_PROVIDER_FIELDS[providerId];
      await storage.updateUser(userId, patch);
      console.log(`[AUDIT] Connected service unlinked: userId=${userId} provider=${providerId} ip=${req.ip} at=${new Date().toISOString()}`);
      return res.json({ message: `${providerId} account unlinked` });
    }

    // Otherwise treat it as an integration-connection ID
    const deleted = await storage.disconnectUserConnection(userId, providerId);
    if (!deleted) return res.status(404).json({ message: 'Connection not found' });
    console.log(`[AUDIT] Integration disconnected: userId=${userId} connectionId=${providerId} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ message: 'Service disconnected' });
  } catch {
    res.status(500).json({ message: 'Failed to disconnect service' });
  }
});

// ------------------------------------------------------------------
// GET/PUT /api/user/notification-preferences
// ------------------------------------------------------------------
router.get('/notification-preferences', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const prefs = await storage.getNotificationPreferences(getUserId(req));
    res.json(prefs);
  } catch {
    res.status(500).json({ message: 'Failed to load notification preferences' });
  }
});

router.put('/notification-preferences', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      agent:            z.boolean().optional(),
      billing:          z.boolean().optional(),
      deployment:       z.boolean().optional(),
      security:         z.boolean().optional(),
      team:             z.boolean().optional(),
      system:           z.boolean().optional(),
      projectUpdates:   z.boolean().optional(),
      commentsMentions: z.boolean().optional(),
      newsletter:       z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const prefs = await storage.updateNotificationPreferences(getUserId(req), data);
    res.json(prefs);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

// ------------------------------------------------------------------
// SSH key CRUD
// ------------------------------------------------------------------
router.get('/ssh-keys', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    res.json(await storage.listSshKeysByUser(getUserId(req)));
  } catch {
    res.status(500).json({ message: 'Failed to list SSH keys' });
  }
});

router.post('/ssh-keys', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { label, publicKey } = z.object({
      label:     z.string().min(1).max(100),
      publicKey: z.string().min(50).max(10000),
    }).parse(req.body);

    const trimmedKey = publicKey.trim();
    if (!trimmedKey.match(/^(ssh-|ecdsa-|sk-)/)) {
      return res.status(400).json({ message: 'Invalid SSH public key format' });
    }

    const parts = trimmedKey.split(' ');
    const keyData = parts[1] || '';
    const fingerprint = `SHA256:${crypto.createHash('sha256').update(Buffer.from(keyData, 'base64')).digest('base64')}`;

    const userId = getUserId(req);
    const key = await storage.createSshKey(userId, label, trimmedKey, fingerprint);
    console.log(`[AUDIT] SSH key added: userId=${userId} label=${label} fingerprint=${fingerprint} ip=${req.ip} at=${new Date().toISOString()}`);
    res.status(201).json(key);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    if (err?.code === '23505') return res.status(409).json({ message: 'SSH key already added' });
    res.status(500).json({ message: 'Failed to add SSH key' });
  }
});

router.delete('/ssh-keys/:id', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const deleted = await storage.deleteSshKey(req.params.id, userId);
    if (!deleted) return res.status(404).json({ message: 'SSH key not found' });
    console.log(`[AUDIT] SSH key deleted: userId=${userId} keyId=${req.params.id} ip=${req.ip} at=${new Date().toISOString()}`);
    res.json({ message: 'SSH key removed' });
  } catch {
    res.status(500).json({ message: 'Failed to remove SSH key' });
  }
});

// ------------------------------------------------------------------
// Personal API token CRUD
// ------------------------------------------------------------------
router.get('/api-tokens', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const tokens = await storage.listApiTokens(getUserId(req));
    // Never expose the hash; return safe subset only
    res.json(tokens.map(t => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    })));
  } catch {
    res.status(500).json({ message: 'Failed to list API tokens' });
  }
});

router.post('/api-tokens', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const userId = getUserId(req);
    const rawToken = `ecode_${crypto.randomBytes(32).toString('hex')}`;
    const tokenPrefix = rawToken.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const token = await storage.createApiToken(userId, name, tokenHash, tokenPrefix);
    console.log(`[AUDIT] API token created: userId=${userId} name=${name} id=${token.id} at=${new Date().toISOString()}`);
    // rawToken is shown once here and never stored
    res.status(201).json({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      createdAt: token.createdAt,
      token: rawToken,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: 'Failed to create API token' });
  }
});

router.delete('/api-tokens/:id', ensureAuthenticated, authLimiter, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const deleted = await storage.deleteApiToken(req.params.id, userId);
    if (!deleted) return res.status(404).json({ message: 'Token not found' });
    console.log(`[AUDIT] API token revoked: userId=${userId} tokenId=${req.params.id} at=${new Date().toISOString()}`);
    res.json({ message: 'Token revoked' });
  } catch {
    res.status(500).json({ message: 'Failed to revoke token' });
  }
});

export default router;
