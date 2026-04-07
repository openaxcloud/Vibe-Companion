import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage, sessionStore } from "./storage";
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

// Password comparison function
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Setup authentication for the Express app
export function setupAuth(app: Express) {
  // Configure session middleware
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'plot-secret-key-strong-enough-for-development',
    resave: false, // Changed to false as we're using a store that implements touch
    saveUninitialized: true, // Changed to true to allow all sessions for testing
    store: sessionStore,
    name: 'plot.sid', // Custom name to avoid using the default
    cookie: {
      secure: false, // Set to false for development to work with HTTP
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      path: '/'
    }
  };
  
  // Debug session configuration
  console.log("Session configuration:", {
    secret: sessionSettings.secret ? 'Set (hidden)' : 'Not set',
    resave: sessionSettings.resave,
    saveUninitialized: sessionSettings.saveUninitialized,
    cookieSecure: sessionSettings.cookie?.secure,
    environment: process.env.NODE_ENV
  });

  // Setup session middleware and passport
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup local strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Authentication attempt for user: ${username}`);
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log(`User not found: ${username}`);
          return done(null, false, { message: "Incorrect username" });
        }
        
        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          console.log(`Invalid password for user: ${username}`);
          return done(null, false, { message: "Incorrect password" });
        }
        
        console.log(`Authentication successful for user: ${username}`);
        // Use as any to get around TypeScript checking as the user object is compatible with Express.User
        return done(null, user as any);
      } catch (err) {
        console.error(`Authentication error for user ${username}:`, err);
        return done(err);
      }
    })
  );

  // Serialize user to the session
  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user ID:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('User not found during deserialization:', id);
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error('Error deserializing user:', err);
      done(err, null);
    }
  });

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
      console.log("User not authenticated when accessing /api/user");
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return user info without password
    console.log(`User ${req.user?.username} retrieved their profile`);
    // Using as any to get around type checking since the shapes are compatible but TypeScript doesn't know
    const { password, ...userWithoutPassword } = req.user as any; 
    res.json(userWithoutPassword);
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