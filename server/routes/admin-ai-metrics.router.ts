/**
 * Admin AI Metrics Router
 * Surfaces AI streaming health metrics aggregated from the in-memory
 * observability buffer so the ops team can see latency spikes, provider
 * errors, token consumption, and concurrency cap hits in real time.
 */

import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { aggregateAiStreamMetrics } from '../observability/ai-stream-metrics';

const router = Router();

router.use(ensureAuthenticated);
router.use(ensureAdmin);

/**
 * GET /api/admin/ai-metrics?windowMinutes=15
 * Returns aggregated AI stream metrics for the requested time window.
 */
router.get('/', (req, res) => {
  try {
    const raw = req.query.windowMinutes;
    let windowMinutes = 15;
    if (typeof raw === 'string') {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        windowMinutes = Math.min(parsed, 24 * 60);
      }
    }
    const snapshot = aggregateAiStreamMetrics(windowMinutes);
    res.setHeader('Cache-Control', 'no-store');
    res.json(snapshot);
  } catch (error: any) {
    console.error('[admin-ai-metrics] Failed to aggregate:', error);
    res.status(500).json({ error: 'Failed to aggregate AI stream metrics' });
  }
});

export default router;
