import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';

export interface HealthRouteOptions {
  dbPool?: Pool;
  serviceName?: string;
  version?: string;
}

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: {
    name: string;
    version: string;
    uptimeSeconds: number;
    timestamp: string;
  };
  checks: {
    db: {
      status: 'up' | 'down';
      latencyMs?: number;
      error?: string;
    };
  };
}

const startedAt = Date.now();

export function createHealthRouter(options: HealthRouteOptions = {}): Router {
  const { dbPool, serviceName = 'api-service', version = '1.0.0' } = options;
  const router = Router();

  router.get('/health', async (req: Request, res: Response) => {
    const health: HealthStatus = {
      status: 'ok',
      service: {
        name: serviceName,
        version,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
      },
      checks: {
        db: {
          status: 'up',
        },
      },
    };

    let overallStatus: HealthStatus['status'] = 'ok';

    if (dbPool) {
      const start = process.hrtime.bigint();
      try {
        await dbPool.query('SELECT 1');
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1_000_000;
        health.checks.db.latencyMs = Math.round(latencyMs * 100) / 100;
      } catch (error) {
        health.checks.db.status = 'down';
        health.checks.db.error =
          error instanceof Error ? error.message : 'Unknown database error';
        overallStatus = 'error';
      }
    } else {
      health.checks.db.status = 'down';
      health.checks.db.error = 'Database pool not configured';
      overallStatus = 'degraded';
    }

    health.status = overallStatus;

    const httpStatus =
      overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 503 : 500;

    res.status(httpStatus).json(health);
  });

  return router;
}

export default createHealthRouter;