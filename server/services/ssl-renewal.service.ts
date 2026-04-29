import { createLogger } from '../utils/logger';
import { renewExpiringCertificates } from '../domainManager';

const logger = createLogger('ssl-renewal');

interface SSLConfig {
  domain: string;
  email: string;
  staging?: boolean;
}

const DEFAULT_SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
const DEFAULT_RENEW_THRESHOLD_DAYS = 30;

class SSLRenewalService {
  private enabled = false;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Disabled by default - Replit handles SSL
    this.enabled = process.env.ENABLE_CUSTOM_SSL === 'true';

    if (this.enabled) {
      logger.info('SSL auto-renewal service enabled');
    } else {
      logger.info('SSL auto-renewal disabled - using platform SSL');
    }
  }

  async renewCertificate(config: SSLConfig): Promise<boolean> {
    if (!this.enabled) {
      logger.warn('SSL renewal requested but service is disabled');
      return false;
    }

    logger.info(`SSL renewal requested for domain: ${config.domain}`);

    // SSL auto-renewal is not configured for this environment
    // On Replit: SSL is handled automatically by the platform
    // Self-hosted: Configure ACME/Let's Encrypt with acme-client package
    throw new Error(`SSL auto-renewal is not configured for domain ${config.domain}. On Replit, SSL is managed automatically. For self-hosted deployments, configure ACME/Let's Encrypt integration.`);
  }

  /**
   * One-shot sweep over all managed custom domains, renewing any whose cert
   * expires within `thresholdDays`. Tolerates the schema drift in
   * custom_domains (see domainManager.renewExpiringCertificates).
   */
  async runRenewalSweep(thresholdDays = DEFAULT_RENEW_THRESHOLD_DAYS): Promise<void> {
    try {
      await renewExpiringCertificates(thresholdDays);
    } catch (err: any) {
      logger.error(`Certificate renewal sweep failed: ${err?.message || err}`);
    }
  }

  /**
   * Begin the periodic renewal sweep. Idempotent — calling start() twice
   * does not stack timers.
   */
  start(intervalMs = DEFAULT_SWEEP_INTERVAL_MS): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      void this.runRenewalSweep();
    }, intervalMs);
    logger.info(`SSL renewal sweep scheduled every ${Math.round(intervalMs / 3600000)}h`);
  }

  stop(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const sslRenewalService = new SSLRenewalService();
