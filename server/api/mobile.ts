// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { projects, files, deviceTokens } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { aiService } from '../ai/ai-service';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { mobileContainerService } from '../services/mobile-container-service';
import bcrypt from '../utils/bcrypt-compat';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getJwtSecret, getJwtRefreshSecret } from '../utils/secrets-manager';
import { createLogger } from '../utils/logger';
import { mobileOAuthRateLimiter } from '../middleware/custom-rate-limiter';
import { mobileAppService } from './mobile-app-service';

const logger = createLogger('mobile-api');
const router = Router();

// ✅ Fortune 500 Security: Use centralized secrets manager
// JWT secrets now managed by secrets-manager.ts with proper dev fallbacks and prod enforcement

// Token expiration times
const MOBILE_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const ACCESS_TOKEN_EXPIRY = '24h'; // Mobile devices need longer sessions
const REFRESH_TOKEN_EXPIRY = '30d'; // Refresh tokens last 30 days

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

// JWT token generation for mobile - using centralized secrets manager
function generateMobileAccessToken(userId: string, username: string): string {
  return jwt.sign(
    { userId, username, type: 'mobile-access' },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateMobileRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'mobile-refresh' },
    getJwtRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

// Type for JWT payloads
interface JWTRefreshPayload {
  userId: string;
  type: string;
  iat?: number;
  exp?: number;
}

function verifyMobileRefreshToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, getJwtRefreshSecret()) as JWTRefreshPayload;
    if (payload.type !== 'mobile-refresh') {
      return null;
    }
    return { userId: payload.userId };
  } catch (error) {
    return null;
  }
}

// Rate limiting helper
function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  
  if (!attempt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (now > attempt.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  
  attempt.count++;
  return true;
}

// Type for access JWT payload
interface JWTAccessPayload {
  userId: string;
  username: string;
  type: string;
  iat?: number;
  exp?: number;
}

// Verify mobile access token (JWT) - using centralized secrets manager
const parseMobileToken = (token: string): { userId: string; issuedAt?: number } => {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JWTAccessPayload;
    if (payload.type !== 'mobile-access') {
      throw new Error('Invalid token type');
    }
    return { userId: payload.userId, issuedAt: payload.iat };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

const mobileEnsureAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    // Development bypass disabled - proper authentication required
    // (Development user must be created in database)
    
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      return next();
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = (bearerMatch ? bearerMatch[1] : authHeader).trim();

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userId } = parseMobileToken(token);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Assign the full user object - Express.User extends our schema User type
    req.user = user;

    return next();
  } catch (error) {
    logger.error('[Mobile] Auth validation failed:', error);
    return res.status(401).json({ error: 'Authentication required' });
  }
};

// Mobile-specific authentication with token support
router.post('/mobile/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check rate limiting
    const rateLimitKey = `${username}_${req.ip}`;
    if (!checkLoginRateLimit(rateLimitKey)) {
      return res.status(429).json({ 
        message: 'Too many login attempts. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      });
    }
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const user = await storage.getUserByUsername(username);
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password with bcrypt
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      logger.error('Password verification error:', bcryptError);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate secure JWT tokens
    const accessToken = generateMobileAccessToken(user.id, user.username);
    const refreshToken = generateMobileRefreshToken(user.id);
    
    // Clear rate limit on successful login
    loginAttempts.delete(rateLimitKey);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken
      }
    });
  } catch (error) {
    logger.error('[Mobile] Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Token refresh endpoint
router.post('/mobile/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        message: 'Refresh token required',
        error: 'NO_REFRESH_TOKEN'
      });
    }
    
    const payload = verifyMobileRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ 
        message: 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    // Get user from database to ensure they still exist and are active
    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Generate new tokens
    const newAccessToken = generateMobileAccessToken(user.id, user.username);
    const newRefreshToken = generateMobileRefreshToken(user.id);
    
    res.json({
      tokens: {
        access: newAccessToken,
        refresh: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('[Mobile] Token refresh error:', error);
    res.status(500).json({ 
      message: 'Token refresh failed',
      error: 'REFRESH_FAILED'
    });
  }
});

// Get projects for mobile
router.get('/mobile/projects', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(20);
    
    res.json(userProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      language: p.language,
      visibility: p.visibility,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      stats: {
        views: p.views || 0,
        likes: p.likes || 0,
        forks: p.forks || 0
      }
    })));
  } catch (error) {
    logger.error('[Mobile] Failed to fetch projects:', error);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// Create project from mobile
router.post('/mobile/projects', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const { name, language, description } = req.body;
    const userId = req.user.id;
    
    const project = await storage.createProject({
      name,
      description,
      language,
      ownerId: userId,
      visibility: 'private'
    });

    // Initialize project with template files
    if (language === 'javascript') {
      await storage.createFile({
        projectId: project.id,
        path: 'index.js',
        content: '// Welcome to your mobile project!\nconsole.log("Hello from E-Code Mobile!");'
      });
      await storage.createFile({
        projectId: project.id,
        path: 'package.json',
        content: JSON.stringify({
          name: project.name.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js'
          }
        }, null, 2)
      });
    } else if (language === 'python') {
      await storage.createFile({
        projectId: project.id,
        path: 'main.py',
        content: '# Welcome to your mobile project!\nprint("Hello from E-Code Mobile!")'
      });
    }

    res.json(project);
  } catch (error) {
    logger.error('Failed to create mobile project:', error);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

// Get project files for mobile editor
router.get('/mobile/projects/:projectId/files', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const projectFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId));
    
    res.json(projectFiles.map(f => ({
      id: f.id,
      path: f.path,
      content: f.content,
      language: detectLanguage(f.path),
      size: f.content?.length || 0
    })));
  } catch (error) {
    logger.error('Failed to fetch files:', error);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});

// Save file from mobile editor
router.put('/mobile/projects/:projectId/files/:fileId', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const { content } = req.body;
    const fileId = parseInt(req.params.fileId);
    
    await storage.updateFile(fileId, { content });
    
    res.json({ success: true, message: 'File saved' });
  } catch (error) {
    logger.error('Failed to save file:', error);
    res.status(500).json({ message: 'Failed to save file' });
  }
});

// Run code from mobile
router.post('/mobile/projects/:projectId/run', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { fileId, code } = req.body;
    
    // Execute code in container
    const result = await mobileContainerService.executeCode({
      projectId,
      language: req.body.language || 'javascript',
      code,
      timeout: 5000
    });
    
    res.json({
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      executionTime: result.executionTime
    });
  } catch (error) {
    logger.error('Failed to run code:', error);
    res.status(500).json({ message: 'Failed to run code' });
  }
});

// AI chat for mobile (non-streaming)
// ✅ Uses client-specified model - backend enforces correct Kimi K2 params (temp=1.0, max>=16384)
router.post('/mobile/ai/chat', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const { projectId, message, model, messages, context } = req.body;
    
    const modelId = model || 'gpt-4.1';
    const chatMessages = messages || [{ role: 'user', content: message }];
    
    const response = await aiProviderManager.generateChat(
      modelId,
      chatMessages,
      {
        system: context?.systemPrompt,
        max_completion_tokens: 4096,
      }
    );
    
    res.json({ content: response, response });
  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ message: 'AI service unavailable' });
  }
});

router.post('/mobile/ai/chat/stream', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const { model, messages, projectId } = req.body;
    
    const modelId = model || 'gpt-4.1';
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    logger.info(`[Mobile AI Stream] Starting stream for model: ${modelId}, projectId: ${projectId}`);
    
    // ✅ CRITICAL: aiProviderManager.streamChat enforces Kimi K2 requirements:
    // - temperature = 1.0 for kimi-k2-* models
    // - max_tokens >= 16384 for kimi-k2-* models  
    // - reasoning_content preserved in response
    const stream = aiProviderManager.streamChat(
      modelId,
      messages,
      {
        max_tokens: 4096,
        temperature: 0.7
      }
    );
    
    for await (const chunk of stream) {
      if (chunk) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    logger.error('AI streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI service unavailable' })}\n\n`);
    res.end();
  }
});

// Get explore content for mobile
router.get('/mobile/explore', async (req, res) => {
  try {
    // Get templates and projects from database
    const templates = [
      { id: 'python', name: 'Python', language: 'python' },
      { id: 'javascript', name: 'JavaScript', language: 'javascript' },
      { id: 'react', name: 'React', language: 'react' },
      { id: 'html', name: 'HTML/CSS', language: 'html' }
    ];
    
    const allProjects = await db.select().from(projects).limit(20);
    const trending = allProjects.slice(0, 10);
    const featured = allProjects.slice(10, 15);
    
    res.json({
      templates: templates.slice(0, 6),
      trending,
      featured
    });
  } catch (error) {
    logger.error('Failed to fetch explore content:', error);
    res.status(500).json({ message: 'Failed to fetch content' });
  }
});

// Get notifications for mobile
router.get('/mobile/notifications', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await storage.getNotificationsForUser(userId, 50);
    
    res.json(notifications.map(n => ({
      id: String(n.id),
      type: n.type,
      title: n.title,
      message: n.body,
      actionUrl: n.actionUrl,
      time: formatTimeAgo(n.createdAt ? new Date(n.createdAt) : new Date()),
      read: n.read
    })));
  } catch (error) {
    logger.error('Failed to fetch notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Helper function
function detectLanguage(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown'
  };
  return langMap[ext || ''] || 'plaintext';
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ====== FCM DEVICE TOKEN MANAGEMENT ======

router.post('/mobile/device-token', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, deviceId } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    if (!platform || !['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android, ios, or web' });
    }

    const [existing] = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.token, token));

    if (existing) {
      if (existing.userId !== userId) {
        await db.delete(deviceTokens).where(eq(deviceTokens.id, existing.id));
        await db
          .insert(deviceTokens)
          .values({ userId, token, platform, deviceId: deviceId || null });
      } else {
        await db
          .update(deviceTokens)
          .set({ platform, deviceId: deviceId || null, lastSeen: new Date() })
          .where(eq(deviceTokens.id, existing.id));
      }
    } else {
      await db
        .insert(deviceTokens)
        .values({ userId, token, platform, deviceId: deviceId || null });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Mobile] Device token registration error:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

router.delete('/mobile/device-token', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }

    await db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    logger.error('[Mobile] Device token removal error:', error);
    res.status(500).json({ error: 'Failed to remove device token' });
  }
});

// ====== ADMIN: TEST NOTIFICATION ======

router.post('/mobile/admin/test-notification', mobileEnsureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const targetUserId = req.body.userId || userId;
    const title = req.body.title || 'Test Notification';
    const body = req.body.body || 'This is a test push notification from E-Code developer tools.';

    const result = await mobileAppService.sendPushNotification({
      userId: targetUserId,
      title,
      body,
      type: 'system',
      data: { test: 'true' }
    });

    res.json({
      success: true,
      deviceCount: result.deviceCount,
      deliveryResults: result.deliveryResults,
      notificationId: result.notification.id
    });
  } catch (error) {
    logger.error('[Mobile] Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// ====== MOBILE OAUTH FLOW ======
// Mobile OAuth works by:
// 1. App requests OAuth URL from server
// 2. App opens URL in system browser
// 3. User authenticates with provider
// 4. Provider redirects to server callback
// 5. Server redirects to deep link (ecode://auth/callback?token=xxx)
// 6. App receives deep link and stores token

const MOBILE_OAUTH_REDIRECT = 'ecode://auth/callback';

// Helper to get base URL for OAuth callbacks
function getBaseUrl(): string {
  // Production: Always use the canonical domain
  if (process.env.NODE_ENV === 'production') {
    return process.env.BASE_URL || 'https://e-code.ai';
  }
  // Development: Use configured BASE_URL or Replit URL
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  // Fallback for Replit development environment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'https://e-code.ai';
}

// Initiate GitHub OAuth for mobile
// Rate limit: 10 req/min per IP
router.get('/mobile/auth/oauth/github', mobileOAuthRateLimiter, async (req, res) => {
  try {
    const state = crypto.randomUUID();
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ 
        error: 'GitHub OAuth not configured',
        message: 'GitHub authentication is not available at this time'
      });
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${getBaseUrl()}/mobile/auth/oauth/github/callback`,
      scope: 'user:email',
      state: state,
      allow_signup: 'true'
    });
    
    res.json({ 
      authUrl: `https://github.com/login/oauth/authorize?${params.toString()}`,
      state 
    });
  } catch (error) {
    logger.error('[Mobile OAuth] GitHub init error:', error);
    res.status(500).json({ error: 'Failed to initialize GitHub OAuth' });
  }
});

// GitHub OAuth callback for mobile
router.get('/mobile/auth/oauth/github/callback', async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;
    
    if (oauthError) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=${encodeURIComponent(oauthError as string)}`);
    }
    
    if (!code) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=no_code`);
    }
    
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: `${getBaseUrl()}/api/mobile/auth/oauth/github/callback`
      })
    });
    
    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }
    
    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const githubUser = await userResponse.json() as any;
    
    // Get primary email
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    const emails = await emailsResponse.json() as any[];
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email;
    
    // Find or create user by email
    let user = primaryEmail ? await storage.getUserByEmail(primaryEmail) : undefined;
    
    if (!user) {
      // Create new user
      user = await storage.createUser({
        username: githubUser.login,
        email: primaryEmail || `${githubUser.login}@github.local`,
        displayName: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        password: null,
        bio: githubUser.bio || null
      });
    } else {
      // Update avatar if not set
      if (!user.avatarUrl && githubUser.avatar_url) {
        await storage.updateUser(user.id, { avatarUrl: githubUser.avatar_url });
      }
    }
    
    // Generate mobile tokens
    const accessToken = generateMobileAccessToken(user.id, user.username);
    const refreshToken = generateMobileRefreshToken(user.id);
    
    // Redirect to mobile app with tokens
    const redirectUrl = `${MOBILE_OAUTH_REDIRECT}?` + new URLSearchParams({
      token: accessToken,
      refreshToken: refreshToken,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username
    }).toString();
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('[Mobile OAuth] GitHub callback error:', error);
    res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=server_error`);
  }
});

// Initiate Google OAuth for mobile
// Rate limit: 10 req/min per IP
router.get('/mobile/auth/oauth/google', mobileOAuthRateLimiter, async (req, res) => {
  try {
    const state = crypto.randomUUID();
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ 
        error: 'Google OAuth not configured',
        message: 'Google authentication is not available at this time'
      });
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${getBaseUrl()}/mobile/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });
    
    res.json({ 
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state 
    });
  } catch (error) {
    logger.error('[Mobile OAuth] Google init error:', error);
    res.status(500).json({ error: 'Failed to initialize Google OAuth' });
  }
});

// Google OAuth callback for mobile
router.get('/mobile/auth/oauth/google/callback', async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;
    
    if (oauthError) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=${encodeURIComponent(oauthError as string)}`);
    }
    
    if (!code) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=no_code`);
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${getBaseUrl()}/mobile/auth/oauth/google/callback`,
        grant_type: 'authorization_code'
      }).toString()
    });
    
    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) {
      return res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }
    
    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    
    const googleUser = await userResponse.json() as any;
    
    // Find or create user by email
    let user = googleUser.email ? await storage.getUserByEmail(googleUser.email) : undefined;
    
    if (!user) {
      // Create new user from Google profile
      const username = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      user = await storage.createUser({
        username: username,
        email: googleUser.email,
        displayName: googleUser.name || username,
        avatarUrl: googleUser.picture,
        password: null,
        bio: null
      });
    } else {
      // Update avatar if not set
      if (!user.avatarUrl && googleUser.picture) {
        await storage.updateUser(user.id, { avatarUrl: googleUser.picture });
      }
    }
    
    // Generate mobile tokens
    const accessToken = generateMobileAccessToken(user.id, user.username);
    const refreshToken = generateMobileRefreshToken(user.id);
    
    // Redirect to mobile app with tokens
    const redirectUrl = `${MOBILE_OAUTH_REDIRECT}?` + new URLSearchParams({
      token: accessToken,
      refreshToken: refreshToken,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username
    }).toString();
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('[Mobile OAuth] Google callback error:', error);
    res.redirect(`${MOBILE_OAUTH_REDIRECT}?error=server_error`);
  }
});

export const mobileRouter = router;
