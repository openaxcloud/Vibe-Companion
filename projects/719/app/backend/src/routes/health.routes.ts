import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';

export interface HealthRoutesOptions {
  dbPool: Pool;
  serviceName?: string;
  version?: string;
}

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  timestamp: string;
}

interface ReadyStatus extends HealthStatus {
  checks: {
    database: {
      status: 'ok' | 'degraded' | 'down';
      latencyMs?: number;
      error?: string;
    };
  };
}

const DEFAULT_SERVICE_NAME = 'backend-service';
const DEFAULT_VERSION = process.env.npm_package_version || '0.0.0';

export function createHealthRouter(options: HealthRoutesOptions): Router {
  const { dbPool, serviceName = DEFAULT_SERVICE_NAME, version = DEFAULT_VERSION } = options;
  const router = Router();

  const getBaseStatus = (): HealthStatus => ({
    status: 'ok',
    service: serviceName,
    version,
    timestamp: new Date().toISOString(),
  });

  router.get('/health', (_req: Request, res: Response) => {
    const payload: HealthStatus = getBaseStatus();
    res.status(200).json(payload);
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const baseStatus = getBaseStatus();
    const start = process.hrtime.bigint();

    let dbStatus: ReadyStatus['checks']['database'] = {
      status: 'down',
    };

    try {
      await dbPool.query('SELECT 1');
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;

      dbStatus = {
        status: 'ok',
        latencyMs: Math.round(latencyMs * 100) / 100,
      };
    } catch (error) {
      dbStatus = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }

    const overallStatus: ReadyStatus['status'] =
      dbStatus.status === 'ok' ? 'ok' : 'down';

    const payload: ReadyStatus = {
      ...baseStatus,
      status: overallStatus,
      checks: {
        database: dbStatus,
      },
    };

    const httpStatus = overallStatus === 'ok' ? 200 : 503;
    res.status(httpStatus).json(payload);
  });

  return router;
}