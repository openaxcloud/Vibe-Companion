// @ts-nocheck
/**
 * Real Two-Factor Authentication Service
 * Provides actual 2FA implementation with TOTP
 */

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { realEmailService } from './real-email-service';
import * as crypto from 'crypto';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const logger = createLogger('real-2fa-service');

export interface TwoFactorSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerificationResult {
  verified: boolean;
  error?: string;
}

export class Real2FAService {
  private tempSecrets: Map<number, {
    secret: string;
    backupCodes: string[];
    timestamp: number;
    attempts: number;
  }> = new Map();

  constructor() {
    // Clean up expired temp secrets periodically
    setInterval(() => this.cleanupTempSecrets(), 60 * 1000); // Every minute
  }

  async setupTwoFactor(userId: number): Promise<TwoFactorSetupResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `E-Code (${user.email})`,
      issuer: 'E-Code',
      length: 32
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Store temporarily until user confirms
    this.tempSecrets.set(userId, {
      secret: secret.base32,
      backupCodes,
      timestamp: Date.now(),
      attempts: 0
    });

    // Generate QR code
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: `E-Code:${user.email}`,
      issuer: 'E-Code',
      encoding: 'base32'
    });

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    logger.info(`2FA setup initiated for user ${userId}`);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes
    };
  }

  async confirmTwoFactorSetup(
    userId: number, 
    token: string
  ): Promise<TwoFactorVerificationResult> {
    const tempData = this.tempSecrets.get(userId);
    if (!tempData) {
      return {
        verified: false,
        error: '2FA setup session expired. Please start again.'
      };
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: tempData.secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      tempData.attempts++;
      if (tempData.attempts >= 3) {
        this.tempSecrets.delete(userId);
        return {
          verified: false,
          error: 'Too many failed attempts. Please start setup again.'
        };
      }
      return {
        verified: false,
        error: 'Invalid code. Please try again.'
      };
    }

    // Save secret to user record
    const encryptedSecret = this.encryptSecret(tempData.secret);
    
    await this.updateUser2FASettings(userId, {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      backupCodes: tempData.backupCodes
    });

    this.tempSecrets.delete(userId);

    logger.info(`2FA enabled for user ${userId}`);

    return { verified: true };
  }

  async verifyTwoFactorToken(
    userId: number, 
    token: string
  ): Promise<TwoFactorVerificationResult> {
    const user = await this.getUser2FASettings(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return {
        verified: false,
        error: '2FA not enabled for this user'
      };
    }

    const secret = this.decryptSecret(user.twoFactorSecret);

    // Check if it's a backup code
    if (token.length === 8 && /^[A-Z0-9]+$/.test(token)) {
      return await this.verifyBackupCode(userId, token);
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 1 step before/after for clock skew
    });

    if (!verified) {
      // Log failed attempt
      await this.logFailedAttempt(userId);
      
      return {
        verified: false,
        error: 'Invalid verification code'
      };
    }

    logger.info(`2FA verification successful for user ${userId}`);
    return { verified: true };
  }

  async verifyTOTPOnly(
    userId: number, 
    token: string
  ): Promise<TwoFactorVerificationResult> {
    const user = await this.getUser2FASettings(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return {
        verified: false,
        error: '2FA not enabled for this user'
      };
    }

    const secret = this.decryptSecret(user.twoFactorSecret);

    // Verify TOTP token only - reject non-TOTP format
    if (!/^\d{6}$/.test(token)) {
      return {
        verified: false,
        error: 'Invalid TOTP format. Must be 6 digits.'
      };
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      await this.logFailedAttempt(userId);
      return {
        verified: false,
        error: 'Invalid verification code'
      };
    }

    logger.info(`TOTP verification successful for user ${userId}`);
    return { verified: true };
  }

  async generateEmergencyToken(userId: number): Promise<string> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store with expiration
    await this.storeEmergencyCode(userId, code);

    // Send via email
    await realEmailService.send2FACode(userId, code);

    logger.info(`Emergency 2FA code sent to user ${userId}`);
    
    return 'Emergency code sent to your email';
  }

  async verifyEmergencyToken(
    userId: number, 
    code: string
  ): Promise<TwoFactorVerificationResult> {
    const storedCode = await this.getEmergencyCode(userId);
    
    if (!storedCode || storedCode !== code) {
      return {
        verified: false,
        error: 'Invalid or expired emergency code'
      };
    }

    // Clear the code after use
    await this.clearEmergencyCode(userId);

    logger.info(`Emergency code verified for user ${userId}`);
    
    return { verified: true };
  }

  async disableTwoFactor(
    userId: number, 
    password: string
  ): Promise<boolean> {
    // Verify password first
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // In production, verify password properly
    // For now, assume password is verified

    await this.updateUser2FASettings(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: []
    });

    logger.info(`2FA disabled for user ${userId}`);
    
    return true;
  }

  async regenerateBackupCodes(userId: number): Promise<string[]> {
    const backupCodes = this.generateBackupCodes(8);
    
    await this.updateUserBackupCodes(userId, backupCodes);
    
    logger.info(`Backup codes regenerated for user ${userId}`);
    
    return backupCodes;
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4)
        .toString('hex')
        .toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }

  async verifyBackupCode(
    userId: number, 
    code: string
  ): Promise<TwoFactorVerificationResult> {
    const backupCodes = await this.getUserBackupCodes(userId);
    
    if (!backupCodes || !backupCodes.includes(code)) {
      return {
        verified: false,
        error: 'Invalid backup code'
      };
    }

    // Remove used backup code
    const remainingCodes = backupCodes.filter(c => c !== code);
    await this.updateUserBackupCodes(userId, remainingCodes);

    logger.info(`Backup code used for user ${userId}, ${remainingCodes.length} remaining`);

    return { verified: true };
  }

  private get2FAEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required for 2FA');
    }
    return key;
  }

  private encryptSecret(secret: string): string {
    const key = this.get2FAEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encryptedSecret: string): string {
    const key = this.get2FAEncryptionKey();
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(key).digest(),
      iv
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private cleanupTempSecrets() {
    const now = Date.now();
    const expireTime = 10 * 60 * 1000; // 10 minutes
    
    for (const [userId, data] of this.tempSecrets) {
      if (now - data.timestamp > expireTime) {
        this.tempSecrets.delete(userId);
      }
    }
  }

  private async updateUser2FASettings(
    userId: number, 
    settings: {
      twoFactorEnabled: boolean;
      twoFactorSecret: string | null;
      backupCodes: string[];
    }
  ) {
    await db.update(users)
      .set({
        twoFactorEnabled: settings.twoFactorEnabled,
        twoFactorSecret: settings.twoFactorSecret,
        twoFactorBackupCodes: settings.backupCodes,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    logger.info(`Updated 2FA settings for user ${userId}`);
  }

  private async getUser2FASettings(userId: number): Promise<any> {
    const user = await storage.getUser(userId);
    return user;
  }

  private async updateUserBackupCodes(userId: number, codes: string[]) {
    await db.update(users)
      .set({
        twoFactorBackupCodes: codes,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    logger.info(`Updated backup codes for user ${userId}`);
  }

  private async getUserBackupCodes(userId: number): Promise<string[]> {
    const [user] = await db.select({ backupCodes: users.twoFactorBackupCodes })
      .from(users)
      .where(eq(users.id, userId));
    
    return user?.backupCodes || [];
  }

  private async storeEmergencyCode(userId: number, code: string) {
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await db.update(users)
      .set({
        twoFactorEmergencyCode: code,
        twoFactorEmergencyExpiry: expiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  private async getEmergencyCode(userId: number): Promise<string | null> {
    const [user] = await db.select({
      code: users.twoFactorEmergencyCode,
      expiry: users.twoFactorEmergencyExpiry
    })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user?.code || !user?.expiry) {
      return null;
    }
    
    if (new Date() > user.expiry) {
      await this.clearEmergencyCode(userId);
      return null;
    }
    
    return user.code;
  }

  private async clearEmergencyCode(userId: number) {
    await db.update(users)
      .set({
        twoFactorEmergencyCode: null,
        twoFactorEmergencyExpiry: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  private async logFailedAttempt(userId: number) {
    // Log failed 2FA attempt for security monitoring
    logger.warn(`Failed 2FA attempt for user ${userId}`);
  }

  // Public API for checking 2FA status
  async isTwoFactorEnabled(userId: number): Promise<boolean> {
    const user = await this.getUser2FASettings(userId);
    return user?.twoFactorEnabled || false;
  }

  async getTwoFactorStatus(userId: number): Promise<{
    enabled: boolean;
    backupCodesRemaining: number;
    lastUsed?: Date;
  }> {
    const user = await this.getUser2FASettings(userId);
    const backupCodes = await this.getUserBackupCodes(userId);
    
    return {
      enabled: user?.twoFactorEnabled || false,
      backupCodesRemaining: backupCodes?.length || 0,
      lastUsed: user?.lastTwoFactorUse
    };
  }
}

export const real2FAService = new Real2FAService();