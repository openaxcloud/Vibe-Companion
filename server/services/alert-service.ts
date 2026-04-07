/**
 * Alert Service - Production Monitoring & Alerting
 * Sends critical alerts to Slack and Sentry for Fortune 500 operations
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('alert-service');

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertCategory {
  AI_MODEL = 'ai_model',
  BILLING = 'billing',
  SYSTEM = 'system',
  SECURITY = 'security',
}

interface AlertPayload {
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Send alert to Slack (production monitoring channel)
 */
async function sendSlackAlert(alert: AlertPayload): Promise<void> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!slackWebhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured - alert not sent', { alert });
    return;
  }

  try {
    const color = {
      [AlertSeverity.INFO]: '#36a64f',
      [AlertSeverity.WARNING]: '#ff9900',
      [AlertSeverity.ERROR]: '#ff0000',
      [AlertSeverity.CRITICAL]: '#8b0000',
    }[alert.severity];

    const emoji = {
      [AlertSeverity.INFO]: ':information_source:',
      [AlertSeverity.WARNING]: ':warning:',
      [AlertSeverity.ERROR]: ':x:',
      [AlertSeverity.CRITICAL]: ':rotating_light:',
    }[alert.severity];

    const slackPayload = {
      attachments: [
        {
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: alert.metadata ? Object.entries(alert.metadata).map(([key, value]) => ({
            title: key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            short: true,
          })) : [],
          footer: 'E-Code Platform Monitoring',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    logger.debug('Slack alert sent successfully', { title: alert.title });
  } catch (error) {
    logger.error('Failed to send Slack alert', { error, alert });
  }
}

/**
 * Send alert to Sentry (error tracking)
 */
async function sendSentryAlert(alert: AlertPayload): Promise<void> {
  // Only send ERROR and CRITICAL to Sentry
  if (alert.severity !== AlertSeverity.ERROR && alert.severity !== AlertSeverity.CRITICAL) {
    return;
  }

  try {
    // If Sentry SDK is configured, use it
    // @ts-expect-error - Sentry might not be available
    if (typeof Sentry !== 'undefined') {
      // @ts-expect-error - global Sentry can be injected at runtime
      Sentry.captureMessage(alert.message, {
        level: alert.severity === AlertSeverity.CRITICAL ? 'fatal' : 'error',
        tags: {
          category: alert.category,
          severity: alert.severity,
        },
        extra: alert.metadata,
      });
      logger.debug('Sentry alert sent successfully', { title: alert.title });
    }
  } catch (error) {
    logger.error('Failed to send Sentry alert', { error, alert });
  }
}

/**
 * Main alert function - sends to all configured channels
 */
export async function sendAlert(alert: AlertPayload): Promise<void> {
  logger.info(`Alert: [${alert.severity}] [${alert.category}] ${alert.title}`, {
    message: alert.message,
    metadata: alert.metadata,
  });

  // Send to Slack for all severities
  await sendSlackAlert(alert);

  // Send to Sentry for ERROR and CRITICAL only
  await sendSentryAlert(alert);
}

/**
 * Convenience functions for specific alert types
 */
export const AlertService = {
  /**
   * Alert when unknown AI model is detected
   */
  unknownModel: (modelName: string, provider: string, fallback: string) => {
    return sendAlert({
      severity: AlertSeverity.WARNING,
      category: AlertCategory.AI_MODEL,
      title: 'Unknown AI Model Detected',
      message: `Model "${modelName}" from provider "${provider}" is not recognized. Using fallback: "${fallback}"`,
      metadata: {
        modelName,
        provider,
        fallback,
        action: 'Add to MODEL_NORMALIZATION_MAP in server/utils/model-normalizer.ts',
      },
    });
  },

  /**
   * Alert when Stripe billing fails
   */
  stripeBillingFailed: (userId: string, meteringId: number, error: string) => {
    return sendAlert({
      severity: AlertSeverity.ERROR,
      category: AlertCategory.BILLING,
      title: 'Stripe Metered Billing Failed',
      message: `Failed to report AI usage to Stripe for user ${userId}. Revenue may be lost!`,
      metadata: {
        userId,
        meteringId,
        error,
        action: 'Check Stripe connectivity and retry manually',
      },
    });
  },

  /**
   * Alert when Stripe retry queue is exhausted
   */
  stripeQueueExhausted: (meteringId: number, attempts: number, lastError: string) => {
    return sendAlert({
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.BILLING,
      title: 'Stripe Queue Exhausted - Revenue Loss',
      message: `Usage record ${meteringId} failed after ${attempts} attempts. Manual intervention required!`,
      metadata: {
        meteringId,
        attempts,
        lastError,
        action: 'Investigate Stripe API status and retry manually',
      },
    });
  },

  /**
   * Alert when AI provider fails repeatedly
   */
  providerFailure: (provider: string, failureCount: number, error: string) => {
    return sendAlert({
      severity: AlertSeverity.ERROR,
      category: AlertCategory.SYSTEM,
      title: 'AI Provider Failure',
      message: `Provider "${provider}" has failed ${failureCount} times. Service degradation possible.`,
      metadata: {
        provider,
        failureCount,
        error,
        action: 'Check provider API status and switch to fallback if needed',
      },
    });
  },
};
