import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { AUTH_RATE_LIMITS, RateLimitConfig } from "../utils/auth-utils";

interface RateLimitStore {
  [key: string]: {
    attempts: number;
    resetTime: number;
  };
}

// In-memory rate limit store (in production, use Redis)
const rateLimitStore: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}, 60 * 1000); // Clean up every minute

// Create rate limiter middleware
export function createRateLimiter(type: keyof typeof AUTH_RATE_LIMITS) {
  const config = AUTH_RATE_LIMITS[type];
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.connection.remoteAddress || "unknown";
    const key = `${type}:${identifier}`;
    const now = Date.now();
    
    // Check if IP is already blocked
    if (rateLimitStore[key] && rateLimitStore[key].resetTime > now) {
      const remainingTime = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);
      return res.status(429).json({
        message: "Too many attempts. Please try again later.",
        retryAfter: remainingTime
      });
    }
    
    // Initialize or update attempt count
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      rateLimitStore[key] = {
        attempts: 1,
        resetTime: now + config.windowMs
      };
    } else {
      rateLimitStore[key].attempts++;
    }
    
    // Check if limit exceeded
    if (rateLimitStore[key].attempts > config.maxAttempts) {
      rateLimitStore[key].resetTime = now + config.blockDurationMs;
      
      // Log the rate limit event
      console.log(`Rate limit exceeded for ${key}: ${rateLimitStore[key].attempts} attempts`);
      
      return res.status(429).json({
        message: "Too many attempts. Your access has been temporarily blocked.",
        retryAfter: Math.ceil(config.blockDurationMs / 1000)
      });
    }
    
    next();
  };
}

// Account lockout middleware
export async function checkAccountLockout(req: Request, res: Response, next: NextFunction) {
  const { username } = req.body;
  
  if (!username) {
    return next();
  }
  
  try {
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return next();
    }
    
    // Check if account is locked
    if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.accountLockedUntil).getTime() - Date.now()) / 1000);
      return res.status(423).json({
        message: "Account is temporarily locked due to multiple failed login attempts.",
        retryAfter: remainingTime
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking account lockout:", error);
    next();
  }
}

// Log login attempt
export async function logLoginAttempt(
  userId: number | null,
  ipAddress: string,
  userAgent: string | undefined,
  successful: boolean,
  failureReason?: string
) {
  try {
    if (userId) {
      await storage.createLoginHistory({
        userId,
        ipAddress,
        userAgent: userAgent || null,
        successful,
        failureReason: failureReason || null
      });
    }
  } catch (error) {
    console.error("Error logging login attempt:", error);
  }
}