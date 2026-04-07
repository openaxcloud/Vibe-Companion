import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "./utils/bcrypt-compat";

// Extend session data to include custom properties
declare module 'express-session' {
  interface SessionData {
    userAgent?: string;
    ipAddress?: string;
    userId?: number | string;
    lastActivityAt?: string;
  }
}

// Promisify scrypt (kept for comparePasswords legacy path only)
const scryptAsync = promisify(scrypt);

// Password hashing — uses bcrypt (cost factor 12) for all new passwords
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

// Password comparison function
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    if (!stored || stored.length < 20) {
      console.error("Invalid hash format");
      return false;
    }
    // If it's a bcrypt hash, use bcrypt
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
      return await bcrypt.compare(supplied, stored);
    }
    // Otherwise use scrypt (legacy)
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error("Invalid scrypt hash format");
      return false;
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    // Ensure buffers are same length before comparison
    if (hashedBuf.length !== suppliedBuf.length) {
      console.error("Buffer length mismatch in password comparison");
      return false;
    }
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}
