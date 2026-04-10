import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-rotation');

interface RotationConfig {
  rotationIntervalMs: number;
  secretLength: number;
  maxSecrets: number;
}

class SessionSecretRotation {
  private secrets: string[] = [];
  private rotationTimer: NodeJS.Timeout | null = null;
  private config: RotationConfig;

  constructor(config: Partial<RotationConfig> = {}) {
    this.config = {
      rotationIntervalMs: config.rotationIntervalMs || 24 * 60 * 60 * 1000, // 24 hours
      secretLength: config.secretLength || 64,
      maxSecrets: config.maxSecrets || 3, // Keep 3 secrets for graceful rotation
    };
    
    // Initialize with primary secret from environment
    const primarySecret = process.env.SESSION_SECRET || this.generateSecret();
    this.secrets = [primarySecret];
    
    logger.info('Session secret rotation initialized', {
      rotationInterval: this.config.rotationIntervalMs,
      maxSecrets: this.config.maxSecrets,
    });
  }

  private generateSecret(): string {
    return crypto.randomBytes(this.config.secretLength).toString('hex');
  }

  rotate(): void {
    const newSecret = this.generateSecret();
    this.secrets.unshift(newSecret);
    
    // Keep only maxSecrets
    if (this.secrets.length > this.config.maxSecrets) {
      this.secrets = this.secrets.slice(0, this.config.maxSecrets);
    }
    
    logger.info('Session secret rotated', {
      activeSecrets: this.secrets.length,
    });
  }

  startAutoRotation(): void {
    if (this.rotationTimer) {
      return;
    }
    
    this.rotationTimer = setInterval(() => {
      this.rotate();
    }, this.config.rotationIntervalMs);
    
    logger.info('Session auto-rotation started');
  }

  stopAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      logger.info('Session auto-rotation stopped');
    }
  }

  getSecrets(): string[] {
    return [...this.secrets];
  }

  getPrimarySecret(): string {
    return this.secrets[0];
  }
}

export const sessionSecretRotation = new SessionSecretRotation();
