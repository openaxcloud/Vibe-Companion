/**
 * Slack Configuration Router
 * Admin endpoints for managing Slack webhook integration
 * ✅ 40-YEAR ENGINEERING: Hot-reloadable configuration without server restarts
 */

import { Router } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { slackAlertService } from '../services/ai-optimization/slack-alert.service';

const router = Router();

// All endpoints require admin authentication
router.use(ensureAuthenticated, ensureAdmin);

/**
 * GET /api/slack-config
 * Get current Slack webhook configuration
 */
router.get('/', async (req, res) => {
  try {
    const webhookUrl = slackAlertService.getWebhookUrl();
    const isEnabled = await slackAlertService.isEnabled();

    res.json({
      configured: webhookUrl !== null,
      enabled: isEnabled,
      webhookUrl: webhookUrl ? maskWebhookUrl(webhookUrl) : null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/slack-config
 * Update Slack webhook URL
 */
router.put('/', async (req, res) => {
  try {
    const schema = z.object({
      webhookUrl: z.string().url().nullable(),
    });

    const { webhookUrl } = schema.parse(req.body);

    // Validate webhook URL format (must be Slack webhook)
    if (webhookUrl && !webhookUrl.startsWith('https://hooks.slack.com/services/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/services/',
      });
    }

    await slackAlertService.setWebhookUrl(webhookUrl);

    res.json({
      success: true,
      message: webhookUrl ? 'Slack webhook URL updated successfully' : 'Slack webhook URL removed',
      configured: webhookUrl !== null,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/slack-config/test
 * Send a test alert to Slack
 */
router.post('/test', async (req, res) => {
  try {
    const testResult = await slackAlertService.testWebhook();

    if (testResult.success) {
      res.json({
        success: true,
        message: 'Test alert sent successfully to Slack',
      });
    } else {
      res.status(400).json({
        success: false,
        error: testResult.error || 'Failed to send test alert',
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Helper function to mask webhook URL for security
 * Shows only last 8 characters
 */
function maskWebhookUrl(url: string): string {
  if (!url || url.length < 20) return '***';
  return '***' + url.slice(-8);
}

export default router;
