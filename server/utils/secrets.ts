// @ts-nocheck
/**
 * Secrets Management
 * Encrypted storage and management of sensitive data
 */

import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('secrets-manager');

export class SecretManager {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  private salt: string = 'e-code-platform-salt';
  
  constructor() {
    // SECURITY: Require encryption key in production, allow dev fallback only in development
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SECRET_KEY;
    
    if (!encryptionKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[SECURITY] ENCRYPTION_KEY or SECRET_KEY environment variable must be set in production');
      }
      // Development only: use random key per session (data won't persist across restarts)
      logger.warn('[SECURITY] No ENCRYPTION_KEY set - using random key for development only');
    }
    
    const keyToUse = encryptionKey || crypto.randomBytes(32).toString('hex');
    
    // Derive key from password
    this.key = crypto.scryptSync(keyToUse, this.salt, 32);
  }
  
  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return combined string: iv:authTag:encrypted
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }
  
  /**
   * Hash a secret (one-way)
   */
  hash(secret: string): string {
    return crypto
      .createHash('sha256')
      .update(secret + this.salt)
      .digest('hex');
  }
  
  /**
   * Compare secret with hash
   */
  compareHash(secret: string, hash: string): boolean {
    const computedHash = this.hash(secret);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  }
  
  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }
  
  /**
   * Generate API key pair
   */
  generateAPIKeyPair(): { publicKey: string; secretKey: string; hash: string } {
    const publicKey = `pk_${this.generateToken(24)}`;
    const secretKey = `sk_${this.generateToken(32)}`;
    const hash = this.hash(secretKey);
    
    return { publicKey, secretKey, hash };
  }
  
  /**
   * Rotate encryption key
   */
  rotateKey(oldKey: string, newKey: string): SecretManager {
    // Create new instance with new key
    const newManager = new SecretManager();
    newManager.key = crypto.scryptSync(newKey, this.salt, 32);
    
    logger.info('Encryption key rotated successfully');
    
    return newManager;
  }
  
  /**
   * Store secret securely (in memory with expiration)
   */
  private secretStore = new Map<string, { value: string; expires: number }>();
  
  storeSecret(key: string, value: string, ttl: number = 3600000): void {
    const encryptedValue = this.encrypt(value);
    this.secretStore.set(key, {
      value: encryptedValue,
      expires: Date.now() + ttl
    });
    
    // Schedule cleanup
    setTimeout(() => {
      this.secretStore.delete(key);
    }, ttl);
  }
  
  /**
   * Retrieve stored secret
   */
  getSecret(key: string): string | null {
    const stored = this.secretStore.get(key);
    
    if (!stored) {
      return null;
    }
    
    if (stored.expires < Date.now()) {
      this.secretStore.delete(key);
      return null;
    }
    
    return this.decrypt(stored.value);
  }
  
  /**
   * Clear all stored secrets
   */
  clearSecrets(): void {
    this.secretStore.clear();
    logger.info('All stored secrets cleared');
  }
  
  /**
   * Validate environment variables
   */
  validateEnvironmentSecrets(): { valid: boolean; missing: string[] } {
    const required = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'JWT_SECRET'
    ];
    
    const missing: string[] = [];
    
    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
    
    if (missing.length > 0) {
      logger.warn('Missing required environment secrets', { missing });
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask common sensitive patterns
      return data
        .replace(/password["\s]*[:=]\s*"[^"]+"/gi, 'password: "***"')
        .replace(/api[_-]?key["\s]*[:=]\s*"[^"]+"/gi, 'api_key: "***"')
        .replace(/token["\s]*[:=]\s*"[^"]+"/gi, 'token: "***"')
        .replace(/secret["\s]*[:=]\s*"[^"]+"/gi, 'secret: "***"')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****'); // Credit card
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked: any = Array.isArray(data) ? [] : {};
      const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'auth', 'credential'];
      
      for (const key in data) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          masked[key] = '***';
        } else {
          masked[key] = this.maskSensitiveData(data[key]);
        }
      }
      
      return masked;
    }
    
    return data;
  }
  
  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    // Ensure password meets complexity requirements
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password);
    
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      // Regenerate if doesn't meet requirements
      return this.generateSecurePassword(length);
    }
    
    return password;
  }
}

// Export singleton instance
export const secretManager = new SecretManager();

// Cleanup on exit
process.on('exit', () => {
  secretManager.clearSecrets();
});

process.on('SIGINT', () => {
  secretManager.clearSecrets();
});

process.on('SIGTERM', () => {
  secretManager.clearSecrets();
});

export async function fetchAllProjectSecrets(projectId: string, userId?: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  try {
    const { db } = await import('../db');
    const { environmentVariables, projectEnvVars, accountEnvVars, accountEnvVarLinks } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const { decrypt } = await import('../encryption');

    try {
      const links = await db
        .select({ key: accountEnvVars.key, encryptedValue: accountEnvVars.encryptedValue })
        .from(accountEnvVarLinks)
        .innerJoin(accountEnvVars, eq(accountEnvVarLinks.accountEnvVarId, accountEnvVars.id))
        .where(eq(accountEnvVarLinks.projectId, projectId));
      for (const link of links) {
        if (link.key && link.encryptedValue) {
          try { vars[link.key] = decrypt(link.encryptedValue); } catch {}
        }
      }
    } catch {}

    try {
      const projVars = await db.select().from(projectEnvVars).where(eq(projectEnvVars.projectId, projectId));
      for (const pv of projVars) {
        if (pv.key && pv.encryptedValue) {
          try { vars[pv.key] = decrypt(pv.encryptedValue); } catch {}
        }
      }
    } catch {}

    try {
      const envVarRows = await db.select().from(environmentVariables).where(eq(environmentVariables.projectId, projectId));
      for (const ev of envVarRows) {
        if (!ev.key || !ev.value) continue;
        if (ev.isSecret) {
          try {
            const { RealSecretManagementService } = await import('../services/real-secret-management');
            const svc = new RealSecretManagementService();
            const enc = JSON.parse(ev.value) as { iv: string; encryptedData: string; authTag: string };
            vars[ev.key] = svc.decryptValue(enc);
          } catch {}
        } else {
          vars[ev.key] = ev.value;
        }
      }
    } catch {}
  } catch (err: any) {
    logger.warn(`fetchAllProjectSecrets failed for ${projectId}: ${err.message}`);
  }
  return vars;
}

export async function getProjectSecretNames(projectId: string, userId?: string): Promise<string[]> {
  const names = new Set<string>();
  try {
    const { db } = await import('../db');
    const { environmentVariables, projectEnvVars, accountEnvVars, accountEnvVarLinks } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    try {
      const projVars = await db.select({ key: projectEnvVars.key }).from(projectEnvVars).where(eq(projectEnvVars.projectId, projectId));
      for (const pv of projVars) if (pv.key) names.add(pv.key);
    } catch {}

    try {
      const envVarRows = await db.select({ key: environmentVariables.key }).from(environmentVariables).where(eq(environmentVariables.projectId, projectId));
      for (const ev of envVarRows) if (ev.key) names.add(ev.key);
    } catch {}

    try {
      const links = await db
        .select({ key: accountEnvVars.key })
        .from(accountEnvVarLinks)
        .innerJoin(accountEnvVars, eq(accountEnvVarLinks.accountEnvVarId, accountEnvVars.id))
        .where(eq(accountEnvVarLinks.projectId, projectId));
      for (const link of links) if (link.key) names.add(link.key);
    } catch {}
  } catch {}
  return Array.from(names);
}