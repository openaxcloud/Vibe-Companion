import passport from "passport";
import { Express, Request, Response } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { 
  generateEmailVerificationToken, 
  generatePasswordResetToken, 
  validatePassword,
  generateToken,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from "./utils/auth-utils";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendAccountLockedEmail 
} from "./utils/email-utils";
import { 
  createRateLimiter, 
  checkAccountLockout, 
  logLoginAttempt 
} from "./middleware/rate-limiter";

// Define a type that matches what Express.User needs to be
type UserForAuth = {
  id: number;
  username: string;
  password: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Extend Express Request type to include User
declare global {
  namespace Express {
    // Define Express.User as our User type
    interface User extends UserForAuth {}
  }
}

// Promisify scrypt
const scryptAsync = promisify(scrypt);

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Password comparison function - supports both scrypt and bcrypt formats
async function comparePasswords(supplied: string, stored: string) {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(supplied, stored);
  }
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Setup authentication for the Express app
export function setupAuth(app: Express) {
  // Session and passport middleware are already initialized in index.ts
  // This function only registers auth routes


  // Register a new user with email verification
  app.post("/api/register", createRateLimiter("register"), async (req, res, next) => {
    try {
      const { username, password, email, displayName } = req.body;
      
      // Validate required fields
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, email, and password are required" });
      }
      
      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ 
          message: "Password does not meet requirements",
          errors: passwordValidation.errors 
        });
      }
      
      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Generate email verification token
      const { token, expiry } = generateEmailVerificationToken();
      
      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        displayName: displayName || username,
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      });

      console.log("User registered successfully:", user.username);
      
      // Send verification email
      await sendVerificationEmail(user.email, user.username, token);
      
      // Don't auto-login - require email verification first
      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account.",
        requiresVerification: true 
      });
    } catch (err: any) {
      console.error("Error during registration:", err.message);
      next(err);
    }
  });

  // Login route with enhanced security
  app.post("/api/login", 
    createRateLimiter("login"), 
    checkAccountLockout,
    async (req, res, next) => {
      const { username, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"];
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      try {
        const user = await storage.getUserByUsername(username);
        
        passport.authenticate("local", async (err: any, authenticatedUser: UserForAuth | false, info: { message: string }) => {
          if (err) return next(err);
          
          if (!authenticatedUser) {
            // Log failed attempt
            if (user) {
              await logLoginAttempt(user.id, ipAddress, userAgent, false, info?.message);
              
              // Increment failed login attempts
              const newFailedAttempts = user.failedLoginAttempts + 1;
              await storage.updateUser(user.id, { failedLoginAttempts: newFailedAttempts });
              
              // Lock account if too many failed attempts
              if (newFailedAttempts >= 5) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + 30);
                
                await storage.updateUser(user.id, { 
                  accountLockedUntil: lockUntil,
                  failedLoginAttempts: 0 
                });
                
                // Send account locked email
                await sendAccountLockedEmail(user.email, user.username, lockUntil);
                
                return res.status(423).json({ 
                  message: "Account locked due to multiple failed login attempts. Check your email." 
                });
              }
            }
            
            console.log(`Login failed for ${username}: ${info?.message || "Authentication failed"}`);
            return res.status(401).json({ message: info?.message || "Authentication failed" });
          }
          
          // Check if email is verified
          if (!authenticatedUser.emailVerified) {
            await logLoginAttempt(authenticatedUser.id, ipAddress, userAgent, false, "Email not verified");
            return res.status(403).json({ 
              message: "Please verify your email before logging in.",
              requiresVerification: true 
            });
          }
          
          // Reset failed login attempts on successful authentication
          await storage.updateUser(authenticatedUser.id, { 
            failedLoginAttempts: 0,
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress
          });
          
          // Log successful login
          await logLoginAttempt(authenticatedUser.id, ipAddress, userAgent, true);
          
          req.login(authenticatedUser as Express.User, (err: any) => {
            if (err) {
              console.error("Login error:", err);
              return next(err);
            }
            
            console.log(`User ${authenticatedUser.username} logged in successfully`);
            
            // Generate JWT tokens
            const accessToken = generateAccessToken(authenticatedUser.id);
            const refreshToken = generateRefreshToken(authenticatedUser.id);
            
            // Return user info without password
            const { password, ...userWithoutPassword } = authenticatedUser;
            res.json({
              ...userWithoutPassword,
              tokens: {
                access: accessToken,
                refresh: refreshToken
              }
            });
          });
        })(req, res, next);
      } catch (error) {
        console.error("Login error:", error);
        next(error);
      }
    }
  );

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Email verification endpoint
  app.get("/api/verify-email", async (req, res) => {
    const { token } = req.query;
    
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid verification token" });
    }
    
    try {
      // Find user with this token
      const users = await storage.getAllUsers(); // We need to add this method
      const user = users.find(u => 
        u.emailVerificationToken === token && 
        u.emailVerificationExpiry && 
        new Date(u.emailVerificationExpiry) > new Date()
      );
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }
      
      // Update user as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null
      });
      
      console.log(`Email verified for user: ${user.username}`);
      res.json({ message: "Email verified successfully! You can now log in." });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Error verifying email" });
    }
  });
  
  // Request password reset
  app.post("/api/forgot-password", createRateLimiter("passwordReset"), async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    try {
      const user = await storage.getUserByEmail(email);
      
      // Don't reveal if email exists or not
      if (!user) {
        return res.json({ message: "If that email exists, a password reset link has been sent." });
      }
      
      // Generate reset token
      const { token, expiry } = generatePasswordResetToken();
      
      await storage.updateUser(user.id, {
        passwordResetToken: token,
        passwordResetExpiry: expiry
      });
      
      // Send reset email
      await sendPasswordResetEmail(user.email, user.username, token);
      
      res.json({ message: "If that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Error processing password reset request" });
    }
  });
  
  // Reset password with token
  app.post("/api/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        message: "Password does not meet requirements",
        errors: passwordValidation.errors 
      });
    }
    
    try {
      // Find user with this token
      const users = await storage.getAllUsers(); // We need to add this method
      const user = users.find(u => 
        u.passwordResetToken === token && 
        u.passwordResetExpiry && 
        new Date(u.passwordResetExpiry) > new Date()
      );
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash new password and update user
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0, // Reset failed attempts
        accountLockedUntil: null // Unlock account
      });
      
      console.log(`Password reset for user: ${user.username}`);
      res.json({ message: "Password reset successfully! You can now log in with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Error resetting password" });
    }
  });
  
  // Refresh JWT token
  app.post("/api/refresh-token", async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }
    
    try {
      const { userId } = await verifyRefreshToken(refreshToken);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      
      // Generate new tokens
      const accessToken = generateAccessToken(user.id);
      const newRefreshToken = generateRefreshToken(user.id);
      
      res.json({
        tokens: {
          access: accessToken,
          refresh: newRefreshToken
        }
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  });
  
  // Create API token
  app.post("/api/tokens", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const { name, expiresIn, scopes } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: "Token name is required" });
    }
    
    try {
      const token = generateToken();
      const tokenHash = hashToken(token);
      
      let expiresAt = null;
      if (expiresIn) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresIn);
      }
      
      const apiToken = await storage.createApiToken({
        userId: req.user.id,
        name,
        token: token.substring(0, 8) + "..." + token.substring(token.length - 4), // Store partial for display
        tokenHash,
        expiresAt,
        scopes: scopes || ["read", "write"]
      });
      
      // Return the full token only once
      res.json({
        ...apiToken,
        token: token, // Full token shown only on creation
        message: "Save this token securely. It won't be shown again."
      });
    } catch (error) {
      console.error("API token creation error:", error);
      res.status(500).json({ message: "Error creating API token" });
    }
  });
  
  // List user's API tokens
  app.get("/api/tokens", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const tokens = await storage.getUserApiTokens(req.user.id);
      res.json(tokens);
    } catch (error) {
      console.error("API token list error:", error);
      res.status(500).json({ message: "Error fetching API tokens" });
    }
  });
  
  // Delete API token
  app.delete("/api/tokens/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const tokenId = parseInt(req.params.id);
      const tokens = await storage.getUserApiTokens(req.user.id);
      
      // Verify token belongs to user
      if (!tokens.find(t => t.id === tokenId)) {
        return res.status(404).json({ message: "Token not found" });
      }
      
      await storage.deleteApiToken(tokenId);
      res.json({ message: "API token deleted successfully" });
    } catch (error) {
      console.error("API token deletion error:", error);
      res.status(500).json({ message: "Error deleting API token" });
    }
  });
  
  // Dev auth login endpoint (development only)
  app.post('/api/dev-auth/login', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'Dev auth only available in development' });
    }

    // Create a dev user for testing
    const devUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      bio: 'Development test user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Log in the dev user
    req.login(devUser, (err) => {
      if (err) {
        console.error('Dev login error:', err);
        return res.status(500).json({ message: 'Login failed', error: err.message });
      }
      console.log('Dev user logged in successfully:', devUser.username);
      res.json({ success: true, message: 'Logged in successfully', user: devUser });
    });
  });

  // Get current user info
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password, ...userWithoutPassword } = req.user as any; 
    res.json(userWithoutPassword);
  });

  app.get("/api/auth/me", async (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const { password: _, ...safeUser } = req.user as any;
      return res.json(safeUser);
    }
    if ((req.session as any)?.userId) {
      try {
        const user = await storage.getUser((req.session as any).userId);
        if (user) {
          const { password: _, ...safeUser } = user;
          return res.json(safeUser);
        }
      } catch {}
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  app.get("/api/auth/session", (req, res) => {
    const userId = req.user?.id || (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json({ authenticated: true, userId });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password: pw } = req.body;
      if (!email || !pw) return res.status(400).json({ message: "Email and password are required" });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      const isValid = await comparePasswords(pw, user.password);
      if (!isValid) return res.status(401).json({ message: "Invalid email or password" });
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => err ? reject(err) : resolve());
      });
      (req.session as any).userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve());
      });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[auth/login]", err?.message || err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password: pw, username, displayName, name } = req.body;
      if (!email || !pw) return res.status(400).json({ message: "Email and password are required" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "Email already registered" });
      const hashedPw = await hashPassword(pw);
      const user = await storage.createUser({
        email,
        password: hashedPw,
        displayName: displayName || name || username || email.split("@")[0],
      });
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => err ? reject(err) : resolve());
      });
      (req.session as any).userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[auth/register]", err?.message || err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed" });
        res.clearCookie("plot.sid");
        res.clearCookie("ecode.sid");
        res.json({ success: true });
      });
    });
  });
  
  // Diagnostic endpoint for session debugging (development only)
  app.get("/api/debug/session", (req, res) => {
    const debugInfo = {
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
      sessionCookie: req.headers.cookie,
      sessionConfig: {
        name: 'plot.sid',
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        saveUninitialized: true,
        resave: false
      }
    };
    
    res.json(debugInfo);
  });
}