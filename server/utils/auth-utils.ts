import { randomBytes, createHash } from "crypto";
import jwt from "jsonwebtoken";
import { promisify } from "util";

const JWT_SECRET = process.env.JWT_SECRET || "ecode-jwt-secret-development";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "ecode-jwt-refresh-secret-development";

// Generate random tokens
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

// Hash a token for storage
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// JWT token generation
export function generateAccessToken(userId: number, scopes: string[] = ["read", "write"]): string {
  return jwt.sign(
    { userId, scopes },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

// JWT token verification
export async function verifyAccessToken(token: string): Promise<{ userId: number; scopes: string[] }> {
  const verified = jwt.verify(token, JWT_SECRET) as any;
  return { userId: verified.userId, scopes: verified.scopes };
}

export async function verifyRefreshToken(token: string): Promise<{ userId: number }> {
  const verified = jwt.verify(token, JWT_REFRESH_SECRET) as any;
  return { userId: verified.userId };
}

// Generate email verification token
export function generateEmailVerificationToken(): { token: string; expiry: Date } {
  const token = generateToken();
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // 24 hours
  return { token, expiry };
}

// Generate password reset token
export function generatePasswordResetToken(): { token: string; expiry: Date } {
  const token = generateToken();
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 1); // 1 hour
  return { token, expiry };
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

export const AUTH_RATE_LIMITS = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 30 * 60 * 1000 // 30 minutes
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  }
};