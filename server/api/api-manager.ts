import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { storage } from '../storage';

export interface APIKey {
  id: string;
  userId: number;
  name: string;
  key: string;
  hashedKey: string;
  permissions: string[];
  rateLimit: number; // requests per hour
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIUsage {
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
}

export class APIManager {
  private apiKeys: Map<string, APIKey> = new Map();
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();

  async generateAPIKey(
    userId: number,
    name: string,
    permissions: string[] = ['read'],
    expiresInDays?: number
  ): Promise<{ key: string; keyInfo: Omit<APIKey, 'key' | 'hashedKey'> }> {
    const key = `rplt_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = this.hashKey(key);
    
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey: APIKey = {
      id: uuidv4(),
      userId,
      name,
      key, // Only stored temporarily
      hashedKey,
      permissions,
      rateLimit: 1000, // Default rate limit
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to storage (without plain key)
    await this.saveAPIKey(apiKey);

    // Return key info without sensitive data
    const { key: _, hashedKey: __, ...keyInfo } = apiKey;
    
    return { key, keyInfo };
  }

  async validateAPIKey(key: string): Promise<APIKey | null> {
    const hashedKey = this.hashKey(key);
    
    // Check cache first
    const cachedKey = Array.from(this.apiKeys.values()).find(
      k => k.hashedKey === hashedKey
    );
    
    if (cachedKey) {
      return this.checkKeyValidity(cachedKey);
    }

    // Load from storage
    const storedKey = await this.loadAPIKeyByHash(hashedKey);
    if (storedKey) {
      this.apiKeys.set(storedKey.id, storedKey);
      return this.checkKeyValidity(storedKey);
    }

    return null;
  }

  async checkRateLimit(keyId: string, limit: number): Promise<boolean> {
    const now = new Date();
    const rateLimit = this.rateLimits.get(keyId);

    if (!rateLimit || rateLimit.resetAt < now) {
      // Reset rate limit
      this.rateLimits.set(keyId, {
        count: 1,
        resetAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour
      });
      return true;
    }

    if (rateLimit.count >= limit) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  async logAPIUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number
  ): Promise<void> {
    const usage: APIUsage = {
      keyId,
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date()
    };

    await this.saveAPIUsage(usage);

    // Update last used timestamp
    const apiKey = this.apiKeys.get(keyId);
    if (apiKey) {
      apiKey.lastUsedAt = new Date();
      await this.updateAPIKeyLastUsed(keyId, apiKey.lastUsedAt);
    }
  }

  async getUserAPIKeys(userId: number): Promise<Array<Omit<APIKey, 'key' | 'hashedKey'>>> {
    const keys = await this.loadUserAPIKeys(userId);
    
    return keys.map(({ key, hashedKey, ...keyInfo }) => keyInfo);
  }

  async revokeAPIKey(userId: number, keyId: string): Promise<boolean> {
    const apiKey = await this.loadAPIKey(keyId);
    
    if (!apiKey || apiKey.userId !== userId) {
      return false;
    }

    await this.deleteAPIKey(keyId);
    this.apiKeys.delete(keyId);
    this.rateLimits.delete(keyId);
    
    return true;
  }

  async updateAPIKey(
    userId: number,
    keyId: string,
    updates: {
      name?: string;
      permissions?: string[];
      rateLimit?: number;
      expiresAt?: Date;
    }
  ): Promise<boolean> {
    const apiKey = await this.loadAPIKey(keyId);
    
    if (!apiKey || apiKey.userId !== userId) {
      return false;
    }

    Object.assign(apiKey, updates, { updatedAt: new Date() });
    await this.saveAPIKey(apiKey);
    
    // Update cache
    this.apiKeys.set(keyId, apiKey);
    
    return true;
  }

  async getAPIUsageStats(
    userId: number,
    keyId?: string,
    days = 30
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsByEndpoint: Record<string, number>;
    requestsByDay: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await this.loadAPIUsage(userId, keyId, startDate);

    const stats = {
      totalRequests: usage.length,
      successfulRequests: usage.filter(u => u.statusCode < 400).length,
      failedRequests: usage.filter(u => u.statusCode >= 400).length,
      averageResponseTime: 0,
      requestsByEndpoint: {} as Record<string, number>,
      requestsByDay: [] as Array<{ date: string; count: number }>
    };

    // Calculate average response time
    if (usage.length > 0) {
      const totalResponseTime = usage.reduce((sum, u) => sum + u.responseTime, 0);
      stats.averageResponseTime = totalResponseTime / usage.length;
    }

    // Group by endpoint
    usage.forEach(u => {
      const endpoint = `${u.method} ${u.endpoint}`;
      stats.requestsByEndpoint[endpoint] = (stats.requestsByEndpoint[endpoint] || 0) + 1;
    });

    // Group by day
    const dayMap = new Map<string, number>();
    usage.forEach(u => {
      const day = u.timestamp.toISOString().split('T')[0];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });

    stats.requestsByDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  }

  async hasPermission(keyId: string, permission: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(keyId) || await this.loadAPIKey(keyId);
    
    if (!apiKey) {
      return false;
    }

    return apiKey.permissions.includes(permission) || apiKey.permissions.includes('admin');
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private checkKeyValidity(apiKey: APIKey): APIKey | null {
    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    return apiKey;
  }

  // Storage methods (in real implementation, these would use database)
  private async saveAPIKey(apiKey: APIKey): Promise<void> {
    // Save to database (without plain key)
    const { key, ...keyData } = apiKey;
    // await storage.saveAPIKey(keyData);
  }

  private async loadAPIKey(keyId: string): Promise<APIKey | null> {
    // Load from database
    // return await storage.getAPIKey(keyId);
    return null;
  }

  private async loadAPIKeyByHash(hashedKey: string): Promise<APIKey | null> {
    // Load from database by hashed key
    // return await storage.getAPIKeyByHash(hashedKey);
    return null;
  }

  private async loadUserAPIKeys(userId: number): Promise<APIKey[]> {
    // Load all keys for user
    // return await storage.getUserAPIKeys(userId);
    return [];
  }

  private async deleteAPIKey(keyId: string): Promise<void> {
    // Delete from database
    // await storage.deleteAPIKey(keyId);
  }

  private async updateAPIKeyLastUsed(keyId: string, lastUsedAt: Date): Promise<void> {
    // Update last used timestamp
    // await storage.updateAPIKeyLastUsed(keyId, lastUsedAt);
  }

  private async saveAPIUsage(usage: APIUsage): Promise<void> {
    // Save usage record
    // await storage.saveAPIUsage(usage);
  }

  private async loadAPIUsage(
    userId: number,
    keyId?: string,
    startDate?: Date
  ): Promise<APIUsage[]> {
    // Load usage records
    // return await storage.getAPIUsage(userId, keyId, startDate);
    return [];
  }
}

export const apiManager = new APIManager();