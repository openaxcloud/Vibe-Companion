import crypto from 'crypto';
import { db } from '../db';
import { projects, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const logger = {
  info: (message: string, ...args: any[]) => {},
  error: (message: string, ...args: any[]) => console.error(`[real-secret-management] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[real-secret-management] WARN: ${message}`, ...args),
};

interface Secret {
  id: number;
  projectId: number;
  key: string;
  value: string;
  category: 'api' | 'database' | 'auth' | 'cloud' | 'monitoring' | 'other';
  scope: 'project' | 'workspace' | 'global';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  isEncrypted: boolean;
  metadata?: {
    provider?: string;
    service?: string;
    environment?: string;
  };
}

export interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
}

export class RealSecretManagementService {
  private secrets = new Map<string, Secret>();
  private encryptionKey: Buffer;
  private nextSecretId = 1;

  constructor() {
    // CRITICAL: Use existing ENCRYPTION_KEY for consistency with other services
    const keyString = process.env.ENCRYPTION_KEY;
    
    if (!keyString) {
      const errorMsg = 
        '🚨 CRITICAL: ENCRYPTION_KEY environment variable is required!\n' +
        'This key is used across all encryption services (2FA, secrets, etc.)\n' +
        'Without this, encrypted secrets will be lost on every restart!';
      
      logger.error(errorMsg);
      throw new Error('ENCRYPTION_KEY is required for RealSecretManagementService');
    }
    
    // Derive 32-byte key from ENCRYPTION_KEY (supports any length)
    // Use SHA-256 hash to ensure consistent 32-byte output for AES-256
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();
    
    logger.info('✅ Real Secret Management Service initialized with AES-256-GCM encryption (using ENCRYPTION_KEY)');
  }

  private encrypt(text: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex')
    };
  }

  decryptValue(encryptedData: EncryptedData): string {
    return this.decrypt(encryptedData);
  }

  private decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async createSecret(projectId: number, data: {
    key: string;
    value: string;
    category?: string;
    scope?: string;
    description?: string;
    metadata?: any;
  }): Promise<Secret> {
    logger.info(`Creating encrypted secret for project ${projectId}`, { key: data.key });

    // Check if secret already exists
    const existingKey = `${projectId}-${data.key}`;
    if (this.secrets.has(existingKey)) {
      throw new Error(`Secret with key '${data.key}' already exists in this project`);
    }

    // Encrypt the secret value
    const encrypted = this.encrypt(data.value);
    const encryptedValue = JSON.stringify(encrypted);

    const secret: Secret = {
      id: this.nextSecretId++,
      projectId,
      key: data.key,
      value: encryptedValue, // Store encrypted value
      category: this.categorizeSecret(data.key, data.category),
      scope: (data.scope as any) || 'project',
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEncrypted: true,
      metadata: data.metadata,
    };

    this.secrets.set(existingKey, secret);
    
    logger.info(`Secret created successfully: ${data.key} (encrypted)`);
    return this.sanitizeSecret(secret);
  }

  async getSecretsByProject(projectId: number): Promise<Secret[]> {
    const projectSecrets: Secret[] = [];
    
    for (const [key, secret] of Array.from(this.secrets.entries())) {
      if (secret.projectId === projectId) {
        projectSecrets.push(this.sanitizeSecret(secret));
      }
    }
    
    return projectSecrets;
  }

  async getSecretValue(projectId: number, key: string): Promise<string | null> {
    const secretKey = `${projectId}-${key}`;
    const secret = this.secrets.get(secretKey);
    
    if (!secret) {
      return null;
    }

    // Update last used timestamp
    secret.lastUsed = new Date();
    
    // Decrypt the value
    try {
      const encrypted: EncryptedData = JSON.parse(secret.value);
      const decrypted = this.decrypt(encrypted);
      
      logger.info(`Secret accessed: ${key} for project ${projectId}`);
      return decrypted;
    } catch (error) {
      logger.error(`Failed to decrypt secret: ${key}`, error);
      throw new Error('Failed to decrypt secret');
    }
  }

  async updateSecret(projectId: number, key: string, newValue: string): Promise<Secret> {
    const secretKey = `${projectId}-${key}`;
    const secret = this.secrets.get(secretKey);
    
    if (!secret) {
      throw new Error(`Secret '${key}' not found`);
    }

    // Encrypt the new value
    const encrypted = this.encrypt(newValue);
    secret.value = JSON.stringify(encrypted);
    secret.updatedAt = new Date();
    
    logger.info(`Secret updated: ${key} for project ${projectId}`);
    return this.sanitizeSecret(secret);
  }

  async deleteSecret(projectId: number, key: string): Promise<void> {
    const secretKey = `${projectId}-${key}`;
    
    if (!this.secrets.has(secretKey)) {
      throw new Error(`Secret '${key}' not found`);
    }

    this.secrets.delete(secretKey);
    logger.info(`Secret deleted: ${key} for project ${projectId}`);
  }

  async getSecretUsageStats(projectId: number): Promise<{
    totalSecrets: number;
    byCategory: Record<string, number>;
    recentlyUsed: Secret[];
    lastUpdated: Secret | null;
  }> {
    const projectSecrets = await this.getSecretsByProject(projectId);
    
    const byCategory: Record<string, number> = {};
    projectSecrets.forEach(secret => {
      byCategory[secret.category] = (byCategory[secret.category] || 0) + 1;
    });

    const recentlyUsed = projectSecrets
      .filter(s => s.lastUsed)
      .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
      .slice(0, 5);

    const lastUpdated = projectSecrets
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] || null;

    return {
      totalSecrets: projectSecrets.length,
      byCategory,
      recentlyUsed,
      lastUpdated,
    };
  }

  // Validate secret key format
  validateSecretKey(key: string): boolean {
    // Must be uppercase, alphanumeric with underscores
    const pattern = /^[A-Z][A-Z0-9_]*$/;
    return pattern.test(key);
  }

  // Auto-categorize secrets based on common patterns
  private categorizeSecret(key: string, providedCategory?: string): Secret['category'] {
    if (providedCategory && ['api', 'database', 'auth', 'cloud', 'monitoring', 'other'].includes(providedCategory)) {
      return providedCategory as Secret['category'];
    }

    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes('api_key') || lowerKey.includes('api_secret') || lowerKey.includes('api_token')) {
      return 'api';
    }
    if (lowerKey.includes('database') || lowerKey.includes('db_') || lowerKey.includes('postgres') || lowerKey.includes('mysql')) {
      return 'database';
    }
    if (lowerKey.includes('auth') || lowerKey.includes('jwt') || lowerKey.includes('oauth') || lowerKey.includes('password')) {
      return 'auth';
    }
    if (lowerKey.includes('aws') || lowerKey.includes('gcp') || lowerKey.includes('azure') || lowerKey.includes('cloud')) {
      return 'cloud';
    }
    if (lowerKey.includes('datadog') || lowerKey.includes('newrelic') || lowerKey.includes('sentry')) {
      return 'monitoring';
    }
    
    return 'other';
  }

  // Remove sensitive data before sending to client
  private sanitizeSecret(secret: Secret): Secret {
    return {
      ...secret,
      value: '••••••••', // Never expose encrypted values
    };
  }

  // Bulk import secrets from environment variables
  async importFromEnv(projectId: number, prefix: string = ''): Promise<number> {
    let imported = 0;
    
    for (const [key, value] of Object.entries(process.env)) {
      if (prefix && !key.startsWith(prefix)) {
        continue;
      }
      
      if (value && this.validateSecretKey(key)) {
        try {
          await this.createSecret(projectId, {
            key,
            value,
            description: `Imported from environment variable`,
          });
          imported++;
        } catch (error) {
          // Skip if already exists
          logger.warn(`Failed to import ${key}:`, error);
        }
      }
    }
    
    logger.info(`Imported ${imported} secrets from environment variables`);
    return imported;
  }

  // Export secrets as environment variables format (for deployment)
  async exportAsEnv(projectId: number): Promise<string> {
    const secrets = await this.getSecretsByProject(projectId);
    const lines: string[] = [];
    
    for (const secret of secrets) {
      const value = await this.getSecretValue(projectId, secret.key);
      if (value) {
        // Escape special characters in value
        const escapedValue = value.replace(/"/g, '\\"');
        lines.push(`${secret.key}="${escapedValue}"`);
      }
    }
    
    return lines.join('\n');
  }
}

export const realSecretManagementService = new RealSecretManagementService();