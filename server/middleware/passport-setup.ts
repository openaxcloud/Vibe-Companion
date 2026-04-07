/**
 * Passport authentication setup
 * Initializes passport with local strategy and session support
 */

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Application } from "express";
import session from "express-session";
import { LRUCache } from "lru-cache";
import { getStorage, sessionStore } from "../storage";
import { User } from "@shared/schema";
import bcrypt from "../utils/bcrypt-compat";
import { sessionSecretRotation } from "../auth/session-rotation";

// ✅ P1-05 FIX: LRU cache for deserializeUser — prevents DB query on every authenticated request
// Cache 1000 users, TTL 5 minutes. On logout/user update, cache auto-expires.
const userCache = new LRUCache<string, User>({ max: 1000, ttl: 5 * 60 * 1000 });

export function setupPassportAuth(app: Application) {
  const storage = getStorage();
  
  // Session configuration - Uses rotating secrets for enhanced security
  // The sessionSecretRotation class manages multiple secrets for graceful rotation
  // Express-session will use the first secret to sign new sessions and all secrets to verify
  const secrets = sessionSecretRotation.getSecrets();
  if (secrets.length === 0 || !secrets[0]) {
    throw new Error('[SECURITY] Session secrets not properly initialized');
  }
  
  // Start auto-rotation of session secrets (rotates every 24 hours by default)
  sessionSecretRotation.startAutoRotation();
  
  app.use(session({
    store: sessionStore,
    secret: secrets,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: (process.env.NODE_ENV === 'production' || !!process.env.REPL_ID) ? 'none' as const : 'lax' as const
    },
    name: 'ecode.sid'
  }));
  
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Setup local strategy for username/password authentication (using email as username field)
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: "Incorrect email or password" });
        }
        
        // Handle null password
        if (!user.password) {
          return done(null, false, { message: "Password not set" });
        }
        
        // Use bcrypt for password comparison
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
          return done(null, false, { message: "Incorrect email or password" });
        }
        
        return done(null, user);
      } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
      }
    })
  );
  
  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  // Deserialize user from session — with LRU cache to avoid DB hit on every request
  passport.deserializeUser(async (id: string, done) => {
    try {
      const cached = userCache.get(id);
      if (cached) return done(null, cached);
      const user = await storage.getUser(id);
      if (user) userCache.set(id, user as User);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}