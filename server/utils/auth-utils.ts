import { randomBytes, createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getJwtSecret, getJwtRefreshSecret } from './secrets-manager';
import { isTokenRevoked, trackUserToken } from '../auth/token-revocation';

// ✅ Fortune 500 Security: Use centralized secrets manager
// Legacy local functions removed - all code now uses centralized secrets-manager

// Generate random tokens
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

// Generate email verification token
export function generateEmailVerificationToken(): string {
  return generateToken(32);
}

// Generate password reset token
export function generatePasswordResetToken(): string {
  return generateToken(32);
}

// Hash token for storage
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// JWT token generation and verification - SECURITY: Use centralized secrets manager
export interface AccessTokenPayload {
  userId: number;
  username: string;
  jti: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: number;
  jti: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export function generateAccessToken(userId: number, username: string): string {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  trackUserToken(userId, jti, expiresAt);
  
  return jwt.sign(
    { userId, username, type: 'access', jti },
    getJwtSecret(),
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(userId: number): string {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  trackUserToken(userId, jti, expiresAt);
  
  return jwt.sign(
    { userId, type: 'refresh', jti },
    getJwtRefreshSecret(),
    { expiresIn: '7d' }
  );
}

export async function verifyAccessToken(token: string): Promise<{ userId: number; username: string; jti: string }> {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      throw new Error('Token has been revoked');
    }
    
    return { userId: payload.userId, username: payload.username, jti: payload.jti };
  } catch (error: any) {
    if (error.message === 'Token has been revoked') {
      throw error;
    }
    throw new Error('Invalid or expired access token');
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: number; jti: string }> {
  try {
    const payload = jwt.verify(token, getJwtRefreshSecret()) as RefreshTokenPayload;
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      throw new Error('Token has been revoked');
    }
    
    return { userId: payload.userId, jti: payload.jti };
  } catch (error: any) {
    if (error.message === 'Token has been revoked') {
      throw error;
    }
    throw new Error('Invalid or expired refresh token');
  }
}

export function decodeTokenWithoutVerification(token: string): { jti?: string; exp?: number; userId?: number } | null {
  try {
    const decoded = jwt.decode(token) as any;
    return decoded ? { jti: decoded.jti, exp: decoded.exp, userId: decoded.userId } : null;
  } catch {
    return null;
  }
}

// Session token generation
export function generateSessionToken(): string {
  return generateToken(64);
}

// API key generation
export function generateApiKey(): string {
  const prefix = 'ek_'; // E-Code key prefix
  const key = generateToken(32);
  return `${prefix}${key}`;
}

// Two-factor authentication
export function generateTwoFactorSecret(): string {
  // This would integrate with an authenticator app
  return generateToken(16);
}

export function generateTwoFactorBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateToken(8));
  }
  return codes;
}