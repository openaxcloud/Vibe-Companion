import { Router, Request, Response } from 'express';
import { StatusPageService } from '../status/status-page-service';

const router = Router();
const statusService = new StatusPageService();

router.get('/status', (_req: Request, res: Response) => {
  try {
    const { services } = statusService.getSystemStatus();
    res.json(services);
  } catch {
    res.json([]);
  }
});

router.get('/status/services', (_req: Request, res: Response) => {
  try {
    const { services } = statusService.getSystemStatus();
    res.json(services);
  } catch {
    res.json([]);
  }
});

router.get('/status/incidents', (_req: Request, res: Response) => {
  try {
    const days = parseInt(String((_req.query as Record<string, string>).days || '30'), 10);
    const incidents = statusService.getIncidentHistory(days);
    res.json(incidents);
  } catch {
    res.json([]);
  }
});

router.get('/status/maintenance', (_req: Request, res: Response) => {
  try {
    const { maintenance } = statusService.getSystemStatus();
    res.json(maintenance);
  } catch {
    res.json([]);
  }
});

router.get('/status/metrics', (_req: Request, res: Response) => {
  try {
    const summary = statusService.getStatusSummary();
    res.json(summary);
  } catch {
    res.json({ uptime: 100, response_time: 0, active_incidents: 0, services_operational: 0, total_services: 0 });
  }
});

router.get('/status/uptime', (_req: Request, res: Response) => {
  try {
    const range = String((_req.query as Record<string, string>).range || '24h');
    const hours = range === '7d' ? 168 : range === '30d' ? 720 : range === '90d' ? 2160 : 24;
    const uptime = statusService.getUptimePercentage(hours);
    const metrics = statusService.getMetrics(hours);
    res.json({ uptime, metrics, range });
  } catch {
    res.json({ uptime: 100, metrics: [], range: '24h' });
  }
});

export default router;
