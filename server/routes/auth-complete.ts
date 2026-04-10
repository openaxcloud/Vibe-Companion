import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { storage } from '../storage.js';
import { hashPassword, comparePasswords } from '../auth.js';
import { generateEmailVerificationToken, generatePasswordResetToken } from '../utils/auth-utils.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email-utils.js';
import { sendAdminAlertEmail } from '../utils/gandi-email.js';
import { OAuth2Client } from 'google-auth-library';
import { Octokit } from '@octokit/rest';

const router = Router();

// S-C5 FIXED: Strong password validation with complexity requirements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be at most 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: passwordSchema,
  displayName: z.string().min(1).max(50)
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema
});

const verifyEmailSchema = z.object({
  token: z.string()
});

// Google OAuth - requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
const googleClient = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/google/callback`
    )
  : null;

// User Registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      displayName,
      avatarUrl: null,
      bio: null
    });
    
    // Generate verification token
    const verificationToken = generateEmailVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    await storage.saveEmailVerificationToken(user.id, email, verificationToken, expiresAt);
    
    // Send verification email (skip in development)
    if (process.env.NODE_ENV !== 'development') {
      await sendVerificationEmail(email, verificationToken);
    }

    await sendAdminAlertEmail({
      subject: `New platform registration: ${email}`,
      title: 'New user registration',
      description: `${displayName} just created an account on E-Code.`,
      metadata: {
        email,
        username,
        displayName,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Email Verification
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    
    const verification = await storage.getEmailVerificationByToken(token);
    if (!verification || verification.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    // Mark email as verified
    await storage.updateUser(verification.userId, { emailVerified: true });
    await storage.deleteEmailVerificationToken(token);
    
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Request Password Reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    
    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists, a password reset link has been sent.' });
    }
    
    // Generate reset token
    const resetToken = generatePasswordResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // 2 hour expiry
    
    await storage.savePasswordResetToken(user.id, resetToken, expiresAt);
    
    // Send reset email (skip in development)
    if (process.env.NODE_ENV !== 'development') {
      await sendPasswordResetEmail(email, resetToken);
    }
    
    res.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    
    const reset = await storage.getPasswordResetByToken(token);
    if (!reset || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Check if token was already used
    if (reset.usedAt) {
      return res.status(400).json({ error: 'Reset token has already been used' });
    }
    
    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(reset.userId, { password: hashedPassword });
    
    // Mark token as used and delete it
    await storage.markPasswordResetTokenUsed(token);
    await storage.deletePasswordResetToken(token);
    
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Google OAuth
router.get('/google', (req, res) => {
  if (!googleClient) {
    return res.status(501).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }
  
  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'profile', 'email']
  });
  
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    if (!googleClient) {
      throw new Error('Google OAuth not configured');
    }
    
    const { code } = req.query;
    if (!code) {
      throw new Error('No authorization code received');
    }
    
    const { tokens } = await googleClient.getToken(code as string);
    googleClient.setCredentials(tokens);
    
    let googleId: string;
    let email: string;
    let name: string;
    let picture: string | undefined;
    
    // Try to get user info from id_token if available (preferred)
    if (tokens.id_token) {
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID!
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Failed to verify ID token');
      }
      
      googleId = payload.sub;
      email = payload.email!;
      name = payload.name || email.split('@')[0];
      picture = payload.picture;
    } else {
      // Fallback: fetch user info from Google userinfo API
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }
      
      const userInfo = await userInfoResponse.json() as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };
      
      googleId = userInfo.sub;
      email = userInfo.email;
      name = userInfo.name || email.split('@')[0];
      picture = userInfo.picture;
    }
    
    if (!email) {
      throw new Error('No email address found in Google account');
    }
    
    // Find or create user
    let user = await storage.getUserByEmail(email);
    if (!user) {
      user = await storage.createUser({
        username: `google_${googleId}`,
        email,
        password: randomBytes(32).toString('hex'),
        displayName: name,
        avatarUrl: picture || null,
        bio: null
      });
    }
    
    // Log the user in
    req.login(user, (err) => {
      if (err) {
        console.error('Google OAuth login error:', err);
        return res.redirect('/login?error=oauth_failed');
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

// GitHub OAuth
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({ error: 'GitHub OAuth not configured' });
  }
  
  // API-2 SECURITY FIX: Generate CSRF state parameter
  const state = randomBytes(32).toString('hex');
  (req.session as any).oauthState = state;
  
  const redirectUri = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
  
  res.redirect(authUrl);
});

router.get('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth not configured');
    }
    
    // API-2 SECURITY FIX: Validate CSRF state parameter
    const expectedState = (req.session as any).oauthState;
    
    // Special case: 'git_connect' state is allowed for authenticated users connecting GitHub
    const isGitConnectFlow = state === 'git_connect' && req.isAuthenticated?.() && req.user;
    
    if (!isGitConnectFlow) {
      if (!state || !expectedState || state !== expectedState) {
        console.error('GitHub OAuth state mismatch - potential CSRF attack');
        return res.redirect('/login?error=csrf_validation_failed');
      }
    }
    
    // Clear the state from session after validation
    delete (req.session as any).oauthState;
    
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      throw new Error(tokenData.error || 'Failed to get access token');
    }
    
    // Get user info
    const octokit = new Octokit({ auth: access_token });
    const { data: githubUser } = await octokit.users.getAuthenticated();
    const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();
    
    const primaryEmail = emails.find(e => e.primary)?.email || githubUser.email;
    if (!primaryEmail) {
      throw new Error('No email found in GitHub account');
    }
    
    // Check if this is a "connect GitHub for Git" flow (user already logged in)
    const isGitConnect = state === 'git_connect' && req.isAuthenticated?.() && req.user;
    
    if (isGitConnect) {
      // Store token for existing user (Git operations)
      const { githubOAuth } = await import('../services/github-oauth');
      await githubOAuth.storeUserToken(req.user.id, access_token, {
        id: githubUser.id,
        login: githubUser.login,
        name: githubUser.name || '',
        email: primaryEmail,
        avatar_url: githubUser.avatar_url,
        html_url: githubUser.html_url
      });
      
      return res.redirect('/settings?github=connected');
    }
    
    // Find or create user (login/signup flow)
    let user = await storage.getUserByEmail(primaryEmail);
    if (!user) {
      user = await storage.createUser({
        username: githubUser.login,
        email: primaryEmail,
        password: randomBytes(32).toString('hex'),
        displayName: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        bio: githubUser.bio || null
      });
    }
    
    // Store encrypted token for Git operations
    const { githubOAuth } = await import('../services/github-oauth');
    await githubOAuth.storeUserToken(user.id, access_token, {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name || '',
      email: primaryEmail,
      avatar_url: githubUser.avatar_url,
      html_url: githubUser.html_url
    });

    // Log the user in
    req.login(user, (err) => {
      if (err) {
        return res.redirect('/login?error=oauth_failed');
      }
      res.redirect('/github-import?connected=true');
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

export const authCompleteRouter = router;