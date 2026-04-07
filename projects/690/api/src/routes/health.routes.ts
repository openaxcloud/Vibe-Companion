import { Router, Request, Response } from 'express';

type HealthStatus = {
  status: 'ok';
  version: string;
};

const router = Router();

const getAppVersion = (): string => {
  const pkgVersion =
    (global as any).__APP_VERSION__ ||
    process.env.npm_package_version ||
    process.env.APP_VERSION;

  return typeof pkgVersion === 'string' && pkgVersion.trim().length > 0
    ? pkgVersion
    : '0.0.0';
};

router.get('/health', (_req: Request, res: Response<HealthStatus>) => {
  const payload: HealthStatus = {
    status: 'ok',
    version: getAppVersion(),
  };

  res.status(200).json(payload);
});

export default router;