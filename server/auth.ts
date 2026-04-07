import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

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
    store: storage.sessionStore,
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

  // Register a new user
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      console.log("User registered successfully:", user.username);

      // Log in the newly registered user
      req.login(user as Express.User, (err: any) => {
        if (err) {
          console.error("Error during login after register:", err);
          return next(err);
        }
        
        console.log(`User ${user.username} logged in after registration`);
        // Return user info without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err: any) {
      console.error("Error during registration:", err.message);
      next(err);
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    passport.authenticate("local", (err: any, user: UserForAuth | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) {
        console.log(`Login failed for ${req.body.username}: ${info?.message || "Authentication failed"}`);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user as Express.User, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return next(err);
        }
        
        console.log(`User ${user.username} logged in successfully`);
        // Return user info without password
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
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