// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface PowerUp {
  id: number;
  projectId: number;
  type: 'cpu' | 'memory' | 'storage' | 'bandwidth' | 'build_priority';
  level: 'basic' | 'boosted' | 'turbo' | 'max';
  active: boolean;
  expiresAt?: Date;
  limits: {
    cpu?: number; // vCPUs
    memory?: number; // MB
    storage?: number; // GB
    bandwidth?: number; // GB/month
    buildMinutes?: number; // minutes/month
    concurrentBuilds?: number;
  };
  usage: {
    cpu?: number;
    memory?: number;
    storage?: number;
    bandwidth?: number;
    buildMinutes?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PowerUpPurchase {
  id: number;
  userId: number;
  projectId: number;
  powerUpType: PowerUp['type'];
  level: PowerUp['level'];
  duration: '1h' | '24h' | '7d' | '30d' | 'permanent';
  cyclesCost: number;
  purchasedAt: Date;
  activatedAt?: Date;
}

export class PowerUpsService {
  constructor(private storage: DatabaseStorage) {}

  async getPowerUpPricing(): Promise<{
    type: PowerUp['type'];
    level: PowerUp['level'];
    duration: PowerUpPurchase['duration'];
    cyclesCost: number;
    limits: PowerUp['limits'];
  }[]> {
    return [
      // CPU Power Ups
      {
        type: 'cpu',
        level: 'boosted',
        duration: '1h',
        cyclesCost: 100,
        limits: { cpu: 2 }
      },
      {
        type: 'cpu',
        level: 'turbo',
        duration: '24h',
        cyclesCost: 1000,
        limits: { cpu: 4 }
      },
      {
        type: 'cpu',
        level: 'max',
        duration: '30d',
        cyclesCost: 10000,
        limits: { cpu: 8 }
      },
      // Memory Power Ups
      {
        type: 'memory',
        level: 'boosted',
        duration: '1h',
        cyclesCost: 80,
        limits: { memory: 2048 }
      },
      {
        type: 'memory',
        level: 'turbo',
        duration: '24h',
        cyclesCost: 800,
        limits: { memory: 4096 }
      },
      {
        type: 'memory',
        level: 'max',
        duration: '30d',
        cyclesCost: 8000,
        limits: { memory: 16384 }
      },
      // Storage Power Ups
      {
        type: 'storage',
        level: 'boosted',
        duration: '7d',
        cyclesCost: 500,
        limits: { storage: 10 }
      },
      {
        type: 'storage',
        level: 'turbo',
        duration: '30d',
        cyclesCost: 2000,
        limits: { storage: 50 }
      },
      {
        type: 'storage',
        level: 'max',
        duration: 'permanent',
        cyclesCost: 5000,
        limits: { storage: 100 }
      },
      // Build Priority
      {
        type: 'build_priority',
        level: 'boosted',
        duration: '24h',
        cyclesCost: 200,
        limits: { buildMinutes: 1000, concurrentBuilds: 3 }
      },
      {
        type: 'build_priority',
        level: 'max',
        duration: '30d',
        cyclesCost: 3000,
        limits: { buildMinutes: 10000, concurrentBuilds: 10 }
      }
    ];
  }

  async purchasePowerUp(data: {
    userId: number;
    projectId: number;
    powerUpType: PowerUp['type'];
    level: PowerUp['level'];
    duration: PowerUpPurchase['duration'];
  }): Promise<PowerUpPurchase> {
    // Get pricing
    const pricing = await this.getPowerUpPricing();
    const price = pricing.find(
      p => p.type === data.powerUpType && p.level === data.level && p.duration === data.duration
    );
    
    if (!price) {
      throw new Error('Invalid power-up configuration');
    }
    
    // Check user cycles balance
    const userCycles = await this.storage.getUserCycles(data.userId);
    if (userCycles < price.cyclesCost) {
      throw new Error('Insufficient cycles');
    }
    
    // Deduct cycles
    await this.storage.deductUserCycles(data.userId, price.cyclesCost);
    
    // Create purchase record
    const purchase = {
      ...data,
      cyclesCost: price.cyclesCost,
      purchasedAt: new Date()
    };
    
    const purchaseId = await this.storage.createPowerUpPurchase(purchase);
    
    // Activate power-up
    await this.activatePowerUp(purchaseId);
    
    return { ...purchase, id: purchaseId };
  }

  async activatePowerUp(purchaseId: number): Promise<void> {
    const purchase = await this.storage.getPowerUpPurchase(purchaseId);
    if (!purchase) throw new Error('Purchase not found');
    
    // Deactivate existing power-ups of same type
    const existingPowerUps = await this.storage.getProjectPowerUps(purchase.projectId);
    for (const powerUp of existingPowerUps) {
      if (powerUp.type === purchase.powerUpType && powerUp.active) {
        await this.storage.updatePowerUp(powerUp.id, { active: false });
      }
    }
    
    // Calculate expiration
    const expiresAt = this.calculateExpiration(purchase.duration);
    
    // Get limits from pricing
    const pricing = await this.getPowerUpPricing();
    const price = pricing.find(
      p => p.type === purchase.powerUpType && p.level === purchase.level
    );
    
    // Create new power-up
    const powerUp = {
      projectId: purchase.projectId,
      type: purchase.powerUpType,
      level: purchase.level,
      active: true,
      expiresAt,
      limits: price!.limits,
      usage: {
        cpu: 0,
        memory: 0,
        storage: 0,
        bandwidth: 0,
        buildMinutes: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.storage.createPowerUp(powerUp);
    
    // Update purchase
    await this.storage.updatePowerUpPurchase(purchaseId, {
      activatedAt: new Date()
    });
  }

  private calculateExpiration(duration: PowerUpPurchase['duration']): Date | undefined {
    if (duration === 'permanent') return undefined;
    
    const now = new Date();
    switch (duration) {
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  }

  async getProjectPowerUps(projectId: number): Promise<PowerUp[]> {
    const powerUps = await this.storage.getProjectPowerUps(projectId);
    
    // Check for expired power-ups
    const now = new Date();
    for (const powerUp of powerUps) {
      if (powerUp.active && powerUp.expiresAt && powerUp.expiresAt < now) {
        await this.storage.updatePowerUp(powerUp.id, { active: false });
        powerUp.active = false;
      }
    }
    
    return powerUps;
  }

  async trackUsage(projectId: number, type: PowerUp['type'], amount: number): Promise<void> {
    const powerUps = await this.getProjectPowerUps(projectId);
    const activePowerUp = powerUps.find(p => p.type === type && p.active);
    
    if (!activePowerUp) return;
    
    const usageField = type === 'build_priority' ? 'buildMinutes' : type;
    const currentUsage = activePowerUp.usage[usageField] || 0;
    
    await this.storage.updatePowerUp(activePowerUp.id, {
      usage: {
        ...activePowerUp.usage,
        [usageField]: currentUsage + amount
      },
      updatedAt: new Date()
    });
  }

  async getResourceLimits(projectId: number): Promise<{
    cpu: number;
    memory: number;
    storage: number;
    bandwidth: number;
    buildMinutes: number;
    concurrentBuilds: number;
  }> {
    const powerUps = await this.getProjectPowerUps(projectId);
    
    // Base limits
    const limits = {
      cpu: 0.5,
      memory: 512,
      storage: 1,
      bandwidth: 10,
      buildMinutes: 100,
      concurrentBuilds: 1
    };
    
    // Apply active power-ups
    for (const powerUp of powerUps) {
      if (!powerUp.active) continue;
      
      if (powerUp.limits.cpu) limits.cpu = Math.max(limits.cpu, powerUp.limits.cpu);
      if (powerUp.limits.memory) limits.memory = Math.max(limits.memory, powerUp.limits.memory);
      if (powerUp.limits.storage) limits.storage = Math.max(limits.storage, powerUp.limits.storage);
      if (powerUp.limits.bandwidth) limits.bandwidth = Math.max(limits.bandwidth, powerUp.limits.bandwidth);
      if (powerUp.limits.buildMinutes) limits.buildMinutes = Math.max(limits.buildMinutes, powerUp.limits.buildMinutes);
      if (powerUp.limits.concurrentBuilds) limits.concurrentBuilds = Math.max(limits.concurrentBuilds, powerUp.limits.concurrentBuilds);
    }
    
    return limits;
  }

  async getPowerUpHistory(userId: number): Promise<PowerUpPurchase[]> {
    return this.storage.getUserPowerUpPurchases(userId);
  }
}