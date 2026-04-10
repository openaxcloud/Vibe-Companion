// @ts-nocheck
/**
 * API Key Manager
 * Secure API key generation and validation
 */

import crypto from 'crypto';
import { db } from '../db';
import { apiKeys } from '../../shared/schema';
import { and, eq, or, isNull, gte } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('api-key-manager');

export class APIKeyManager {
  private keyPrefix = 'ecode_';
  private keyLength = 32;
  
  /**
   * Generate new API key pair
   */
  generateAPIKey(): { key: string; hash: string; publicKey: string; keyPrefix: string } {
    // Generate random bytes
    const randomBytes = crypto.randomBytes(this.keyLength);
    
    // Create the full API key
    const key = `${this.keyPrefix}${randomBytes.toString('base64url')}`;
    
    // Create hash for storage - S-C1 FIXED: Never store plain text
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    
    // Create public key (first 8 chars of hash for identification)
    const publicKey = `pk_${hash.substring(0, 8)}`;
    
    // Store first 12 chars for identification in UI
    const keyPrefixDisplay = key.substring(0, 12);
    
    logger.info('API key generated', { publicKey });
    
    return { key, hash, publicKey, keyPrefix: keyPrefixDisplay };
  }
  
  /**
   * Create and store new API key for user
   */
  async createAPIKey(
    userId: number,
    name: string,
    permissions?: string[],
    expiresIn?: number // Days
  ): Promise<{ key: string; publicKey: string; id: number }> {
    const { key, hash, publicKey, keyPrefix } = this.generateAPIKey();
    
    const expiresAt = expiresIn 
      ? new Date(Date.now() + (expiresIn * 24 * 3600000))
      : null;
    
    try {
      // S-C1 FIXED: Store keyHash and keyPrefix, never plain text
      const result = await db.insert(apiKeys).values({
        userId,
        name,
        publicKey,
        keyHash: hash,
        keyPrefix, // S-C1: Store prefix for identification
        permissions: permissions || [], // JSONB array, not JSON string
        expiresAt,
        createdAt: new Date(),
        lastUsedAt: null,
        active: true,
        metadata: {
          createdBy: userId,
          createdAt: new Date().toISOString(),
          userAgent: null
        }
      }).returning({ id: apiKeys.id });
      
      logger.info('API key created', {
        userId,
        publicKey,
        name,
        expiresAt
      });
      
      return {
        key, // Only returned once during creation
        publicKey,
        id: result[0].id
      };
    } catch (error) {
      logger.error('Failed to create API key', { error, userId });
      throw new Error('Failed to create API key');
    }
  }
  
  /**
   * Validate API key
   */
  async validateAPIKey(key: string): Promise<{
    valid: boolean;
    userId?: number;
    permissions?: string[];
    keyId?: number;
  }> {
    // Check format
    if (!key || !key.startsWith(this.keyPrefix)) {
      return { valid: false };
    }
    
    // Generate hash
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    
    try {
      // Find API key in database
      const apiKey = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.keyHash, hash),
            eq(apiKeys.active, true)
          )
        )
        .limit(1);
      
      if (apiKey.length === 0) {
        logger.warn('Invalid API key attempted', { 
          hash: hash.substring(0, 8) 
        });
        return { valid: false };
      }
      
      const keyData = apiKey[0];
      
      // Check expiration
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        logger.warn('Expired API key attempted', {
          keyId: keyData.id,
          expiredAt: keyData.expiresAt
        });
        return { valid: false };
      }
      
      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({ 
          lastUsedAt: new Date(),
          usageCount: (keyData.usageCount || 0) + 1
        })
        .where(eq(apiKeys.id, keyData.id));
      
      return {
        valid: true,
        userId: keyData.userId,
        // S-C1 FIXED: permissions is now JSONB array, not JSON string
        permissions: Array.isArray(keyData.permissions) ? keyData.permissions : [],
        keyId: keyData.id
      };
    } catch (error) {
      logger.error('API key validation error', { error });
      return { valid: false };
    }
  }
  
  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: number, revokedBy?: number): Promise<boolean> {
    try {
      await db
        .update(apiKeys)
        .set({ 
          active: false,
          revokedAt: new Date(),
          // S-C1 FIXED: metadata is JSONB, not JSON string
          metadata: {
            revokedBy,
            revokedAt: new Date().toISOString()
          }
        })
        .where(eq(apiKeys.id, keyId));
      
      logger.info('API key revoked', { keyId, revokedBy });
      return true;
    } catch (error) {
      logger.error('Failed to revoke API key', { error, keyId });
      return false;
    }
  }
  
  /**
   * List user's API keys
   */
  async listUserAPIKeys(userId: number): Promise<any[]> {
    try {
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          publicKey: apiKeys.publicKey,
          keyPrefix: apiKeys.keyPrefix, // S-C1: Include for UI display
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          active: apiKeys.active,
          permissions: apiKeys.permissions,
          usageCount: apiKeys.usageCount
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      
      // S-C1 FIXED: permissions is JSONB array, not JSON string
      return keys.map(key => ({
        ...key,
        permissions: Array.isArray(key.permissions) ? key.permissions : []
      }));
    } catch (error) {
      logger.error('Failed to list API keys', { error, userId });
      return [];
    }
  }
  
  /**
   * Rotate API key
   */
  async rotateAPIKey(keyId: number): Promise<{ key: string; publicKey: string } | null> {
    try {
      // Get existing key data
      const existing = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId))
        .limit(1);
      
      if (existing.length === 0) {
        return null;
      }
      
      const oldKey = existing[0];
      
      // Generate new key - S-C1: Includes keyPrefix
      const { key, hash, publicKey, keyPrefix } = this.generateAPIKey();
      
      // S-C1 FIXED: metadata is JSONB, merge properly
      const existingMetadata = typeof oldKey.metadata === 'object' ? oldKey.metadata : {};
      
      // Update with new key
      await db
        .update(apiKeys)
        .set({
          keyHash: hash,
          publicKey,
          keyPrefix, // S-C1: Update prefix on rotation
          rotatedAt: new Date(),
          metadata: {
            ...existingMetadata,
            rotatedAt: new Date().toISOString(),
            previousPublicKey: oldKey.publicKey
          }
        })
        .where(eq(apiKeys.id, keyId));
      
      logger.info('API key rotated', { 
        keyId,
        oldPublicKey: oldKey.publicKey,
        newPublicKey: publicKey
      });
      
      return { key, publicKey };
    } catch (error) {
      logger.error('Failed to rotate API key', { error, keyId });
      return null;
    }
  }
  
  /**
   * Check if user has permission
   */
  hasPermission(permissions: string[], required: string): boolean {
    if (!permissions || permissions.length === 0) {
      return false;
    }
    
    // Check for wildcard permission
    if (permissions.includes('*') || permissions.includes('admin')) {
      return true;
    }
    
    // Check for specific permission
    if (permissions.includes(required)) {
      return true;
    }
    
    // Check for partial wildcard (e.g., 'projects:*' matches 'projects:read')
    const requiredParts = required.split(':');
    for (const perm of permissions) {
      if (perm.endsWith(':*')) {
        const permBase = perm.slice(0, -2);
        if (required.startsWith(permBase + ':')) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Validate API key from request
   */
  async validateRequest(req: any): Promise<{
    authenticated: boolean;
    userId?: number;
    permissions?: string[];
    keyId?: number;
  }> {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { authenticated: false };
    }
    
    // Support both Bearer and APIKey schemes
    let apiKey: string | undefined;
    
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    } else if (authHeader.startsWith('APIKey ')) {
      apiKey = authHeader.substring(7);
    } else {
      apiKey = authHeader;
    }
    
    if (!apiKey) {
      return { authenticated: false };
    }
    
    const validation = await this.validateAPIKey(apiKey);
    
    if (!validation.valid) {
      return { authenticated: false };
    }
    
    // Attach to request for later use
    req.apiKey = {
      userId: validation.userId,
      permissions: validation.permissions,
      keyId: validation.keyId
    };
    
    return {
      authenticated: true,
      userId: validation.userId,
      permissions: validation.permissions,
      keyId: validation.keyId
    };
  }
  
  /**
   * Middleware for API key authentication
   */
  authMiddleware(requiredPermission?: string) {
    return async (req: any, res: any, next: any) => {
      const validation = await this.validateRequest(req);
      
      if (!validation.authenticated) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid or missing API key'
        });
      }
      
      // Check permission if required
      if (requiredPermission && !this.hasPermission(validation.permissions || [], requiredPermission)) {
        logger.warn('Insufficient permissions', {
          userId: validation.userId,
          required: requiredPermission,
          permissions: validation.permissions
        });
        
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }
      
      // Attach user info to request
      req.user = { id: validation.userId };
      req.permissions = validation.permissions;
      
      next();
    };
  }
  
  /**
   * Clean up expired keys
   */
  async cleanupExpiredKeys(): Promise<void> {
    try {
      const result = await db
        .update(apiKeys)
        .set({ active: false })
        .where(
          and(
            eq(apiKeys.active, true),
            gte(new Date(), apiKeys.expiresAt)
          )
        );
      
      logger.info('Expired API keys cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup expired keys', { error });
    }
  }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager();

// Schedule periodic cleanup
setInterval(() => {
  apiKeyManager.cleanupExpiredKeys();
}, 3600000); // Hourly cleanup