import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "../utils/bcrypt-compat";
import passport from "passport";
import { userRegistrationSchema, securityLogs, emailVerificationTokens, passwordResetTokens } from "@shared/schema";
import { type IStorage } from "../storage";
import { ensureAuthenticated as sharedEnsureAuth } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import type { User } from "@shared/schema";
import { randomBytes } from "crypto";
import { hashToken, generateEmailVerificationToken, generatePasswordResetToken, decodeTokenWithoutVerification } from "../utils/auth-utils";
import { revokeToken, revokeAllUserTokens } from "../auth/token-revocation";
import { sendVerificationEmail, sendPasswordResetEmail, resendVerificationEmail } from "../utils/sendgrid-email-service";
import { z } from "zod";
import { db, withTransaction } from "../db";
import { eq, and, gte } from "drizzle-orm";
import { users } from "@shared/schema";
import { sessionManager } from "../auth/session-manager";
import { createLogger } from "../utils/logger";
import { tierRateLimiters } from "../middleware/tier-rate-limiter";
import { createTwoFactorChallenge, consumeVerifiedChallenge } from "./2fa.router";

const logger = createLogger('auth-router');

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
}

// Define a UserForAuth type that includes password for authentication
// User already has password as a required field, so no override needed
type UserForAuth = User;

export class AuthRouter {
  private router: Router;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  /**
   * Sanitize user object by removing sensitive fields
   * Returns only safe fields for client consumption
   */
  private sanitizeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      bio: user.bio,
      website: user.website,
      githubUsername: user.githubUsername,
      twitterUsername: user.twitterUsername,
      linkedinUsername: user.linkedinUsername,
      reputation: user.reputation,
      isMentor: user.isMentor,
      role: user.role,
      isAdmin: user.role === 'admin' || user.role === 'super_admin',
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
      // EXCLUDED: password, twoFactorSecret, passwordResetToken, stripeCustomerId, etc.
    };
  }

  // Use the shared ensureAuthenticated middleware for consistent authentication
  private ensureAuthenticated = sharedEnsureAuth;

  private initializeRoutes() {
    // Fortune 500 Auth Rate Limiter - Apply to all auth routes
    // Free: 5/15min, Pro: 20/15min, Enterprise: 100/15min (10x in dev)
    this.router.use('/register', tierRateLimiters.auth);
    this.router.use('/login', tierRateLimiters.auth);
    this.router.use('/logout', tierRateLimiters.auth);
    this.router.use('/auth', tierRateLimiters.auth);
    this.router.use('/verify-email', tierRateLimiters.auth);
    this.router.use('/resend-verification', tierRateLimiters.auth);
    this.router.use('/forgot-password', tierRateLimiters.auth);
    this.router.use('/reset-password', tierRateLimiters.auth);
    
    const meHandler = (req: Request, res: Response) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(this.sanitizeUser(user));
    };

    this.router.get("/me", this.ensureAuthenticated, meHandler);
    this.router.get("/auth/me", this.ensureAuthenticated, meHandler);

    // Alias: /user -> /me (for compatibility with health probes and legacy clients)
    this.router.get("/user", this.ensureAuthenticated, (req: Request, res: Response) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(this.sanitizeUser(user));
    });

    // Register endpoint
    this.router.post("/register", csrfProtection, async (req: Request, res: Response) => {
      try {
        // Use registration schema with password validation
        const validatedData = userRegistrationSchema.parse(req.body);
        
        // Validate required fields
        if (!validatedData.username || !validatedData.email) {
          return res.status(400).json({
            message: "Username and email are required",
            code: "MISSING_FIELDS"
          });
        }
        
        // Check if user exists
        const existingUser = await this.storage.getUserByUsername(validatedData.username);
        if (existingUser) {
          return res.status(400).json({ 
            error: "Username already exists",
            message: "Username already exists",
            code: "USERNAME_EXISTS"
          });
        }

        // Check if email is already used
        const existingEmail = await this.storage.getUserByEmail(validatedData.email);
        if (existingEmail) {
          return res.status(400).json({
            error: "Email already registered",
            message: "Email already registered",
            code: "EMAIL_EXISTS"
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);
        
        // Generate verification token before transaction (no DB access)
        const verificationToken = generateEmailVerificationToken();
        const hashedToken = hashToken(verificationToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
        
        // Create user with emailVerified set to false (exclude plain password from storage)
        const { password, ...userDataWithoutPassword } = validatedData;
        
        // Use transaction to ensure user creation and verification token are atomic
        const user = await withTransaction(async (tx) => {
          // Create user
          const [createdUser] = await tx.insert(users).values({
            ...userDataWithoutPassword,
            password: hashedPassword,
            emailVerified: false
          }).returning();
          
          // Save email verification token
          await tx.insert(emailVerificationTokens).values({
            userId: createdUser.id,
            email: createdUser.email!,
            token: hashedToken,
            expiresAt
          });
          
          return createdUser;
        });

        // Send verification email OUTSIDE transaction (external service, non-critical)
        let emailSent = false;
        try {
          await sendVerificationEmail(
            user.id.toString(),
            user.email!,
            user.displayName || user.username || 'User',
            verificationToken // Send unhashed token to user
          );
          emailSent = true;
        } catch (emailError: any) {
          logger.error('Failed to send verification email', { message: emailError.message });
          emailSent = false;
        }

        // Log registration event (separate from transaction - audit logs should not block registration)
        await db.insert(securityLogs).values({
          userId: user.id,
          ip: req.ip || 'unknown',
          action: 'user_registration',
          resource: user.email || 'unknown',
          result: 'success',
          userAgent: req.headers['user-agent'] || '',
          metadata: { username: user.username, emailSent }
        });
        
        const successMessage = emailSent 
          ? "Registration successful. Please check your email to verify your account."
          : "Account created but verification email failed - please use the resend verification option.";
        
        // Log the user in automatically if session is available
        // SECURITY: Regenerate session before login to prevent session fixation
        if (req.login && typeof req.login === 'function') {
          req.session.regenerate((regenErr: any) => {
            if (regenErr) {
              logger.warn('Session regeneration failed after registration', { message: regenErr.message });
              return res.json({ 
                success: true,
                emailSent,
                message: successMessage + " Please login manually.",
                user: this.sanitizeUser(user)
              });
            }
            
            req.login(user, (err: any) => {
              if (err) {
                logger.error('Login after registration failed', { message: err.message });
                return res.json({ 
                  success: true,
                  emailSent,
                  message: successMessage + " Login manually to continue.",
                  user: this.sanitizeUser(user)
                });
              }
              
              req.session.save((saveErr: any) => {
                if (saveErr) {
                  logger.warn('Session save warning after registration', { message: saveErr.message });
                }
                
                res.json({ 
                  success: true,
                  emailSent,
                  message: successMessage,
                  user: this.sanitizeUser(user)
                });
              });
            });
          });
        } else {
          res.json({ 
            success: true,
            emailSent,
            message: successMessage,
            user: this.sanitizeUser(user)
          });
        }
      } catch (error: any) {
        logger.error('Registration error', { message: error.message });
        if (error.name === 'ZodError') {
          const hasPasswordError = error.errors?.some((e: any) => e.path?.includes('password'));
          const errorMessage = hasPasswordError 
            ? "Invalid password. Password must be at least 8 characters." 
            : "Invalid input data";
          
          return res.status(400).json({ 
            error: errorMessage,
            message: errorMessage,
            code: "INVALID_INPUT",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          error: "Registration failed",
          message: "Registration failed",
          code: "REGISTRATION_ERROR"
        });
      }
    });

    // Login endpoint
    // SECURITY: Session regeneration prevents session fixation attacks (Fortune 500)
    this.router.post("/login", csrfProtection, (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('local', (err: any, user: User, info: any) => {
        if (err) {
          logger.error('Login error:', err.message);
          return res.status(500).json({ 
            error: "Login failed",
            message: "Login failed",
            code: "LOGIN_ERROR"
          });
        }
        
        if (!user) {
          return res.status(401).json({ 
            error: info?.message || "Invalid credentials",
            message: info?.message || "Invalid credentials",
            code: "INVALID_CREDENTIALS"
          });
        }
        
        // Check if 2FA is enabled - require verification before completing login
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const challengeId = createTwoFactorChallenge(user.id);
          logger.info(`2FA challenge created for user ${user.id}`);
          // SECURITY: Return 401 to indicate authentication is incomplete
          return res.status(401).json({
            requires2FA: true,
            challengeId,
            email: user.email,
            message: "Two-factor authentication required",
            code: "2FA_REQUIRED"
          });
        }
        
        // SECURITY: Regenerate session BEFORE login to prevent session fixation
        req.session.regenerate((regenErr: any) => {
          if (regenErr) {
            logger.error('Session regeneration failed:', regenErr.message);
            return res.status(500).json({ 
              message: "Session security error",
              code: "SESSION_ERROR"
            });
          }
          
          req.login(user, (loginErr: any) => {
            if (loginErr) {
              logger.error('Session creation failed:', loginErr.message);
              return res.status(500).json({ 
                message: "Session creation failed",
                code: "SESSION_ERROR"
              });
            }
            
            // Save session to persist user data
            req.session.save((saveErr: any) => {
              if (saveErr) {
                logger.warn('Session save warning:', saveErr.message);
              }
              
              logger.info(`User ${user.id} logged in successfully`);
              res.json({ 
                message: "Login successful",
                user: this.sanitizeUser(user)
              });
            });
          });
        });
      })(req, res, next);
    });

    // Logout endpoint - properly destroy session and clear cookies
    this.router.post("/logout", csrfProtection, (req: Request, res: Response) => {
      // ✅ 40-YEAR SENIOR FIX: Call Passport logout BEFORE session destruction
      // req.logout() removes user from session; must be called before session is destroyed
      req.logout((logoutErr: any) => {
        if (logoutErr) {
          logger.warn('Passport logout warning', { message: logoutErr.message });
        }
        
        // Now destroy the session after Passport logout
        sessionManager.destroySession(req, res, (err: any) => {
          if (err) {
            logger.error('Logout error', { message: err.message });
            return res.status(500).json({ 
              message: "Logout failed",
              code: "LOGOUT_ERROR"
            });
          }
          
          res.json({ 
            message: "Logout successful",
            code: "LOGOUT_SUCCESS"
          });
        });
      });
    });

    // Complete login after 2FA verification
    // SECURITY: Uses signed proof token from challenge/verify to prevent session fixation
    this.router.post("/login/2fa-complete", csrfProtection, async (req: Request, res: Response) => {
      try {
        const { pendingSessionToken } = req.body;
        
        if (!pendingSessionToken || typeof pendingSessionToken !== 'string') {
          return res.status(400).json({
            message: "Invalid session token",
            code: "INVALID_TOKEN"
          });
        }
        
        const userId = consumeVerifiedChallenge(pendingSessionToken);
        if (!userId) {
          return res.status(401).json({
            message: "Session token expired or invalid",
            code: "TOKEN_EXPIRED"
          });
        }
        
        const user = await this.storage.getUser(String(userId));
        if (!user) {
          return res.status(401).json({
            message: "User not found",
            code: "USER_NOT_FOUND"
          });
        }
        
        req.session.regenerate((regenErr: any) => {
          if (regenErr) {
            logger.error('Session regeneration failed:', regenErr.message);
            return res.status(500).json({ 
              message: "Session security error",
              code: "SESSION_ERROR"
            });
          }
          
          req.login(user, (loginErr: any) => {
            if (loginErr) {
              logger.error('Session creation failed:', loginErr.message);
              return res.status(500).json({ 
                message: "Session creation failed",
                code: "SESSION_ERROR"
              });
            }
            
            req.session.save((saveErr: any) => {
              if (saveErr) {
                logger.warn('Session save warning:', saveErr.message);
              }
              
              logger.info(`User ${user.id} completed 2FA login`);
              res.json({ 
                message: "Login successful",
                user: this.sanitizeUser(user)
              });
            });
          });
        });
      } catch (error) {
        logger.error('2FA complete error:', sanitizeError(error));
        res.status(500).json({
          message: "Login failed",
          code: "LOGIN_ERROR"
        });
      }
    });

    // ===== COMPATIBILITY LAYER: /auth/* aliases =====
    // These routes provide backward compatibility and align with RESTful naming
    // Eventually, we should deprecate the flat /* routes and use only /auth/*
    
    // Alias: /auth/user -> /me
    this.router.get("/auth/user", this.ensureAuthenticated, (req: Request, res: Response) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(this.sanitizeUser(user));
    });

    // Alias: /auth/register -> /register
    this.router.post("/auth/register", csrfProtection, async (req: Request, res: Response) => {
      try {
        // Use registration schema with password validation
        const validatedData = userRegistrationSchema.parse(req.body);
        
        // Validate required fields
        if (!validatedData.username || !validatedData.email) {
          return res.status(400).json({
            message: "Username and email are required",
            code: "MISSING_FIELDS"
          });
        }
        
        // Check if user exists
        const existingUser = await this.storage.getUserByUsername(validatedData.username);
        if (existingUser) {
          return res.status(400).json({ 
            error: "Username already exists",
            message: "Username already exists",
            code: "USERNAME_EXISTS"
          });
        }

        // Check if email is already used
        const existingEmail = await this.storage.getUserByEmail(validatedData.email);
        if (existingEmail) {
          return res.status(400).json({
            error: "Email already registered",
            message: "Email already registered",
            code: "EMAIL_EXISTS"
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);
        
        // Generate verification token before transaction (no DB access)
        const verificationToken = generateEmailVerificationToken();
        const hashedToken = hashToken(verificationToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
        
        // Create user with emailVerified set to false (exclude plain password from storage)
        const { password, ...userDataWithoutPassword } = validatedData;
        
        // Use transaction to ensure user creation and verification token are atomic
        const user = await withTransaction(async (tx) => {
          // Create user
          const [createdUser] = await tx.insert(users).values({
            ...userDataWithoutPassword,
            password: hashedPassword,
            emailVerified: false
          }).returning();
          
          // Save email verification token
          await tx.insert(emailVerificationTokens).values({
            userId: createdUser.id,
            email: createdUser.email!,
            token: hashedToken,
            expiresAt
          });
          
          return createdUser;
        });

        // Send verification email OUTSIDE transaction (external service, non-critical)
        let emailSent = false;
        try {
          await sendVerificationEmail(
            user.id.toString(),
            user.email!,
            user.displayName || user.username || 'User',
            verificationToken // Send unhashed token to user
          );
          emailSent = true;
        } catch (emailError: any) {
          logger.error('Failed to send verification email', { message: emailError.message });
          emailSent = false;
        }

        // Log registration event (separate from transaction - audit logs should not block registration)
        await db.insert(securityLogs).values({
          userId: user.id,
          ip: req.ip || 'unknown',
          action: 'user_registration',
          resource: user.email || 'unknown',
          result: 'success',
          userAgent: req.headers['user-agent'] || '',
          metadata: { username: user.username, emailSent }
        });
        
        const successMessage = emailSent 
          ? "Registration successful. Please check your email to verify your account."
          : "Account created but verification email failed - please use the resend verification option.";
        
        // Log the user in automatically if session is available
        // SECURITY: Regenerate session before login to prevent session fixation
        if (req.login && typeof req.login === 'function') {
          req.session.regenerate((regenErr: any) => {
            if (regenErr) {
              logger.warn('Session regeneration failed after registration', { message: regenErr.message });
              return res.json({ 
                success: true,
                emailSent,
                message: successMessage + " Please login manually.",
                user: this.sanitizeUser(user)
              });
            }
            
            req.login(user, (err: any) => {
              if (err) {
                logger.error('Login after registration failed', { message: err.message });
                return res.json({ 
                  success: true,
                  emailSent,
                  message: successMessage + " Login manually to continue.",
                  user: this.sanitizeUser(user)
                });
              }
              
              req.session.save((saveErr: any) => {
                if (saveErr) {
                  logger.warn('Session save warning after registration', { message: saveErr.message });
                }
                
                res.json({ 
                  success: true,
                  emailSent,
                  message: successMessage,
                  user: this.sanitizeUser(user)
                });
              });
            });
          });
        } else {
          res.json({ 
            success: true,
            emailSent,
            message: successMessage,
            user: this.sanitizeUser(user)
          });
        }
      } catch (error: any) {
        logger.error('Registration error', { message: error.message });
        if (error.name === 'ZodError') {
          const hasPasswordError = error.errors?.some((e: any) => e.path?.includes('password'));
          const errorMessage = hasPasswordError 
            ? "Invalid password. Password must be at least 8 characters." 
            : "Invalid input data";
          
          return res.status(400).json({ 
            error: errorMessage,
            message: errorMessage,
            code: "INVALID_INPUT",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          error: "Registration failed",
          message: "Registration failed",
          code: "REGISTRATION_ERROR"
        });
      }
    });

    // Alias: /auth/login -> /login
    // SECURITY: Session regeneration prevents session fixation attacks (Fortune 500)
    this.router.post("/auth/login", csrfProtection, (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('local', (err: any, user: User, info: any) => {
        if (err) {
          logger.error('Login error', { message: err.message });
          return res.status(500).json({ 
            error: "Login failed",
            message: "Login failed",
            code: "LOGIN_ERROR"
          });
        }
        
        if (!user) {
          return res.status(401).json({ 
            error: info?.message || "Invalid credentials",
            message: info?.message || "Invalid credentials",
            code: "INVALID_CREDENTIALS"
          });
        }
        
        // Check if 2FA is enabled - require verification before completing login
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const challengeId = createTwoFactorChallenge(user.id);
          logger.info(`2FA challenge created for user ${user.id}`);
          // SECURITY: Return 401 to indicate authentication is incomplete
          return res.status(401).json({
            requires2FA: true,
            challengeId,
            email: user.email,
            message: "Two-factor authentication required",
            code: "2FA_REQUIRED"
          });
        }
        
        // SECURITY: Regenerate session BEFORE login to prevent session fixation
        req.session.regenerate((regenErr: any) => {
          if (regenErr) {
            logger.error('Session regeneration failed:', regenErr.message);
            return res.status(500).json({ 
              message: "Session security error",
              code: "SESSION_ERROR"
            });
          }
          
          req.login(user, (loginErr: any) => {
            if (loginErr) {
              logger.error('Session creation failed', { message: loginErr.message });
              return res.status(500).json({ 
                message: "Session creation failed",
                code: "SESSION_ERROR"
              });
            }
            
            req.session.save((saveErr: any) => {
              if (saveErr) {
                logger.warn('Session save warning:', saveErr.message);
              }
              
              logger.info(`User ${user.id} logged in successfully via /auth/login`);
              res.json({ 
                message: "Login successful",
                user: this.sanitizeUser(user)
              });
            });
          });
        });
      })(req, res, next);
    });

    // Alias: /auth/logout -> /logout
    this.router.post("/auth/logout", csrfProtection, (req: Request, res: Response) => {
      // ✅ 40-YEAR SENIOR FIX: Call Passport logout BEFORE session destruction
      // req.logout() removes user from session; must be called before session is destroyed
      req.logout((logoutErr: any) => {
        if (logoutErr) {
          logger.warn('Passport logout warning', { message: logoutErr.message });
        }
        
        // Now destroy the session after Passport logout
        sessionManager.destroySession(req, res, (err: any) => {
          if (err) {
            logger.error('Logout error', { message: err.message });
            return res.status(500).json({ 
              message: "Logout failed",
              code: "LOGOUT_ERROR"
            });
          }
          
          res.json({ 
            message: "Logout successful",
            code: "LOGOUT_SUCCESS"
          });
        });
      });
    });

    // Check authentication status
    this.router.get("/auth/check", (req: Request, res: Response) => {
      res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.user ? this.sanitizeUser(req.user) : null
      });
    });

    // JWT Token Revocation endpoint - revokes the current JWT token
    this.router.post("/auth/revoke-token", (req: Request, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(400).json({
            message: "No token provided",
            code: "NO_TOKEN"
          });
        }

        const token = authHeader.substring(7);
        const decoded = decodeTokenWithoutVerification(token);

        if (!decoded || !decoded.jti) {
          return res.status(400).json({
            message: "Invalid token format or missing JTI",
            code: "INVALID_TOKEN"
          });
        }

        const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        revokeToken(decoded.jti, expiresAt, decoded.userId);

        logger.info('Token revoked via API', {
          jti: decoded.jti.substring(0, 8) + '...',
          userId: decoded.userId
        });

        res.json({
          message: "Token revoked successfully",
          code: "TOKEN_REVOKED"
        });
      } catch (error: any) {
        logger.error(`[Auth] Operation failed: ${sanitizeError(error)}`);
        res.status(500).json({
          message: "Token revocation failed",
          code: "REVOCATION_ERROR"
        });
      }
    });

    // Revoke all tokens for a user (requires authentication)
    this.router.post("/auth/revoke-all-tokens", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({
            message: "Not authenticated",
            code: "AUTH_REQUIRED"
          });
        }

        const revokedCount = await revokeAllUserTokens(user.id);

        await db.insert(securityLogs).values({
          userId: user.id,
          ip: req.ip || 'unknown',
          action: 'revoke_all_tokens',
          resource: `user:${user.id}`,
          result: 'success',
          userAgent: req.headers['user-agent'] || '',
          metadata: { revokedCount }
        });

        logger.info('All user tokens revoked', { userId: user.id, revokedCount });

        res.json({
          message: `All tokens revoked successfully`,
          code: "ALL_TOKENS_REVOKED",
          revokedCount
        });
      } catch (error: any) {
        logger.error(`[Auth] Operation failed: ${sanitizeError(error)}`);
        res.status(500).json({
          message: "Failed to revoke tokens",
          code: "REVOCATION_ERROR"
        });
      }
    });

    // Email verification endpoint (token-based, no CSRF needed - token provides protection)
    this.router.post("/verify-email", async (req: Request, res: Response) => {
      try {
        const { token } = z.object({ token: z.string() }).parse(req.body);
        
        // Hash the token to compare with stored hash
        const hashedToken = hashToken(token);
        
        // Get verification record
        const verification = await this.storage.getEmailVerificationByToken(hashedToken);
        if (!verification) {
          return res.status(400).json({ 
            message: "Invalid verification token",
            code: "INVALID_TOKEN"
          });
        }

        // Check if token has expired
        if (new Date() > verification.expiresAt) {
          await this.storage.deleteEmailVerificationToken(hashedToken);
          return res.status(400).json({ 
            message: "Verification token has expired. Please request a new one.",
            code: "TOKEN_EXPIRED"
          });
        }

        // Mark user as verified
        await this.storage.updateUser(verification.userId.toString(), { 
          emailVerified: true 
        });

        // Delete the used token
        await this.storage.deleteEmailVerificationToken(hashedToken);

        // Log verification event
        await db.insert(securityLogs).values({
          userId: verification.userId,
          ip: req.ip || 'unknown',
          action: 'email_verification',
          resource: verification.email,
          result: 'success',
          userAgent: req.headers['user-agent'] || ''
        });

        res.json({ 
          message: "Email verified successfully! You can now access all features.",
          code: "EMAIL_VERIFIED"
        });
      } catch (error: any) {
        logger.error('Email verification error', { message: error.message });
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            message: "Invalid request format",
            code: "INVALID_REQUEST"
          });
        }
        res.status(500).json({ 
          message: "Email verification failed",
          code: "VERIFICATION_ERROR"
        });
      }
    });

    // Resend verification email endpoint
    this.router.post("/resend-verification", csrfProtection, this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ 
            message: "Not authenticated",
            code: "AUTH_REQUIRED"
          });
        }

        // Check if email is already verified
        if (user.emailVerified) {
          return res.status(400).json({ 
            message: "Email is already verified",
            code: "ALREADY_VERIFIED"
          });
        }

        // Rate limiting: max 3 resend requests per hour
        const recentResends = await db.select()
          .from(securityLogs)
          .where(
            and(
              eq(securityLogs.userId, user.id),
              eq(securityLogs.action, 'verification_resend'),
              gte(securityLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000))
            )
          );

        if (recentResends.length >= 3) {
          return res.status(429).json({
            message: "Too many resend requests. Please wait before trying again.",
            code: "RATE_LIMITED"
          });
        }

        // Generate new verification token
        const verificationToken = generateEmailVerificationToken();
        const hashedToken = hashToken(verificationToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

        // Delete any existing tokens for this user
        const existingTokens = await db.select()
          .from(emailVerificationTokens)
          .where(eq(emailVerificationTokens.userId, user.id));
        
        for (const token of existingTokens) {
          await this.storage.deleteEmailVerificationToken(token.token);
        }

        // Validate email exists
        if (!user.email) {
          return res.status(400).json({ 
            message: "User email is not set",
            code: "EMAIL_MISSING"
          });
        }

        // Save new token
        await this.storage.saveEmailVerificationToken(
          user.id.toString(),
          user.email,
          hashedToken,
          expiresAt
        );

        // Send verification email
        let emailSent = false;
        try {
          await resendVerificationEmail(
            user.id.toString(),
            user.email,
            user.displayName || user.username || 'User',
            verificationToken
          );
          emailSent = true;
        } catch (emailError: any) {
          console.error('[Email] Failed to send verification email:', emailError);
          logger.error('Failed to resend verification email', { message: emailError.message });
        }

        // Log resend event
        await db.insert(securityLogs).values({
          userId: user.id,
          ip: req.ip || 'unknown',
          action: 'verification_resend',
          resource: user.email,
          result: emailSent ? 'success' : 'email_failed',
          userAgent: req.headers['user-agent'] || '',
          metadata: { emailSent }
        });

        if (emailSent) {
          res.json({ 
            success: true,
            emailSent: true,
            message: "Verification email has been resent. Please check your inbox.",
            code: "VERIFICATION_RESENT"
          });
        } else {
          res.json({ 
            success: true,
            emailSent: false,
            message: "Verification token created but email failed - please try again later.",
            code: "VERIFICATION_RESENT_EMAIL_FAILED"
          });
        }
      } catch (error: any) {
        logger.error('Resend verification error', { message: error.message });
        res.status(500).json({ 
          message: "Failed to resend verification email",
          code: "RESEND_ERROR"
        });
      }
    });

    // Forgot password endpoint (no CSRF protection needed - public endpoint)
    this.router.post("/forgot-password", async (req: Request, res: Response) => {
      try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);

        // Always return the same response to prevent email enumeration
        const successResponse = {
          message: "If an account exists with this email, a password reset link has been sent.",
          code: "RESET_REQUESTED"
        };

        // Check if user exists
        const user = await this.storage.getUserByEmail(email);
        if (!user || !user.email) {
          // Don't reveal if email exists
          return res.json(successResponse);
        }

        // Rate limiting check (simple implementation)
        const recentRequests = await db.select()
          .from(securityLogs)
          .where(
            and(
              eq(securityLogs.userId, user.id),
              eq(securityLogs.action, 'password_reset_request'),
              gte(securityLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000)) // Last hour
            )
          );

        if (recentRequests.length >= 3) {
          // Still return success to prevent enumeration
          return res.json(successResponse);
        }

        // Generate password reset token
        const resetToken = generatePasswordResetToken();
        const hashedToken = hashToken(resetToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2); // Expires in 2 hours

        // Delete any existing reset tokens for this user
        const existingTokens = await db.select()
          .from(passwordResetTokens)
          .where(eq(passwordResetTokens.userId, user.id));
        
        for (const token of existingTokens) {
          await this.storage.deletePasswordResetToken(token.token);
        }

        // Save reset token
        await this.storage.savePasswordResetToken(
          user.id.toString(),
          hashedToken,
          expiresAt
        );

        // Send reset email
        let emailSent = false;
        try {
          await sendPasswordResetEmail(
            user.id.toString(),
            user.email,
            user.displayName || user.username || 'User',
            resetToken
          );
          emailSent = true;
        } catch (emailError: any) {
          logger.error('Failed to send reset email', { message: emailError.message });
          emailSent = false;
        }

        // Log reset request (emailSent tracked in metadata, response stays same to prevent enumeration)
        await db.insert(securityLogs).values({
          userId: user.id,
          ip: req.ip || 'unknown',
          action: 'password_reset_request',
          resource: user.email,
          result: emailSent ? 'success' : 'email_failed',
          userAgent: req.headers['user-agent'] || '',
          metadata: { emailSent }
        });

        res.json(successResponse);
      } catch (error: any) {
        logger.error('Password reset request error', { message: error.message });
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            message: "Invalid email format",
            code: "INVALID_EMAIL"
          });
        }
        res.status(500).json({ 
          message: "Failed to process password reset request",
          code: "RESET_ERROR"
        });
      }
    });

    // Reset password endpoint (no CSRF protection needed - token-based authentication)
    this.router.post("/reset-password", async (req: Request, res: Response) => {
      try {
        const { token, newPassword } = z.object({
          token: z.string(),
          newPassword: z.string().min(8).max(100)
        }).parse(req.body);

        // Hash the token to compare with stored hash
        const hashedToken = hashToken(token);

        // Get reset record
        const resetRecord = await this.storage.getPasswordResetByToken(hashedToken);
        if (!resetRecord) {
          return res.status(400).json({ 
            message: "Invalid or expired reset token",
            code: "INVALID_TOKEN"
          });
        }

        // Check if token has expired
        if (new Date() > resetRecord.expiresAt) {
          await this.storage.deletePasswordResetToken(hashedToken);
          return res.status(400).json({ 
            message: "Reset token has expired. Please request a new one.",
            code: "TOKEN_EXPIRED"
          });
        }

        // Check if token was already used
        if (resetRecord.usedAt) {
          return res.status(400).json({ 
            message: "This reset token has already been used",
            code: "TOKEN_USED"
          });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Use transaction to ensure password update, token marking, and logging are atomic
        await withTransaction(async (tx) => {
          // Update user password
          await tx.update(users).set({
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiry: null,
            failedLoginAttempts: 0,
            accountLockedUntil: null,
            updatedAt: new Date()
          }).where(eq(users.id, resetRecord.userId));

          // Mark token as used
          await tx.update(passwordResetTokens).set({
            usedAt: new Date()
          }).where(eq(passwordResetTokens.token, hashedToken));

          // Log password reset
          await tx.insert(securityLogs).values({
            userId: resetRecord.userId,
            ip: req.ip || 'unknown',
            action: 'password_reset_complete',
            resource: 'password',
            result: 'success',
            userAgent: req.headers['user-agent'] || ''
          });
        });

        res.json({ 
          message: "Password reset successfully! You can now log in with your new password.",
          code: "PASSWORD_RESET"
        });
      } catch (error: any) {
        logger.error('Password reset error', { message: error.message });
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            message: "Invalid request. Password must be at least 8 characters.",
            code: "INVALID_REQUEST",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          message: "Failed to reset password",
          code: "RESET_ERROR"
        });
      }
    });

    // WebSocket authentication token endpoint
    // Generates a short-lived JWT token for WebSocket connections (e.g., background testing)
    this.router.get("/auth/ws-token", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ 
            message: "Not authenticated",
            code: "AUTH_REQUIRED"
          });
        }

        // Generate a short-lived JWT token for WebSocket auth (5 minutes)
        const jwt = await import('jsonwebtoken');
        const { getJwtSecret } = await import('../utils/secrets-manager');
        
        const token = jwt.default.sign(
          { 
            userId: user.id, 
            username: user.username,
            type: 'websocket'
          },
          getJwtSecret(),
          { expiresIn: '5m' }
        );

        res.json({ 
          token,
          expiresIn: 300 // 5 minutes in seconds
        });
      } catch (error: any) {
        logger.error(`[Auth] Operation failed: ${sanitizeError(error)}`);
        res.status(500).json({ 
          message: "Failed to generate WebSocket token",
          code: "TOKEN_ERROR"
        });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}