import express, { Request, Response, NextFunction, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import type { ParsedQs } from 'qs';
import crypto from 'crypto';

type AuthedRequest<TParams = any, TResBody = any, TReqBody = any, TReqQuery = ParsedQs> = Request<
  TParams,
  TResBody,
  TReqBody,
  TReqQuery
> & {
  user?: {
    id: string;
    roles: string[];
  };
};

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

const asyncHandler =
  (fn: AsyncHandler): AsyncHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const validateRequest: AsyncHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    error: 'ValidationError',
    details: errors.array().map((e) => ({
      field: e.type === 'field' ? e.path : undefined,
      message: e.msg,
      location: e.location,
    })),
  });
};

const authMiddleware: AsyncHandler = (req: AuthedRequest, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Placeholder auth logic – replace with real verification (JWT, session, etc.)
    const fakeUserId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    req.user = {
      id: fakeUserId,
      roles: ['user'],
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireRole =
  (requiredRoles: string | string[]): AsyncHandler =>
  (req: AuthedRequest, res, next) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hasRole = req.user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };

const webhookRawBodyMiddleware = (
  req: Request & { rawBody?: Buffer },
  res: Response,
  next: NextFunction
) => {
  if (req.readableEnded) return next();

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    try {
      if (req.headers['content-type']?.includes('application/json')) {
        const text = req.rawBody.toString('utf8').trim();
        req.body = text ? JSON.parse(text) : {};
      } else {
        req.body = {};
      }
    } catch {
      req.body = {};
    }
    next();
  });
  req.on('error', () => {
    return res.status(400).json({ error: 'InvalidRequestBody' });
  });
};

const router: Router = express.Router();

/**
 * Public healthcheck endpoint
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Example: Authenticated user profile endpoint
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    return res.status(200).json({
      id: req.user?.id,
      roles: req.user?.roles ?? [],
    });
  })
);

/**
 * Example: List resources with query validation
 */
router.get(
  '/resources',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim().isLength({ max: 200 }),
  ],
  validateRequest,
  asyncHandler(async (req: AuthedRequest<unknown, any, any, ParsedQs>, res: Response) => {
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 20;
    const search = (req.query.search as string | undefined) || undefined;

    // Placeholder: fetch paginated resources
    const items = [];
    const total = 0;

    return res.status(200).json({
      page,
      limit,
      total,
      items,
      search,
    });
  })
);

/**
 * Example: Create resource with body validation
 */
router.post(
  '/resources',
  authMiddleware,
  requireRole(['admin', 'editor']),
  [
    body('name').isString().trim().isLength({ min: 1, max: 200 }),
    body('metadata').optional().isObject(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { name, metadata } = req.body as { name: string; metadata?: Record<string, unknown> };

    const resource = {
      id: crypto.randomUUID(),
      name,
      metadata: metadata ?? {},
      createdBy: req.user?.id ?? null,
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json(resource);
  })
);

/**
 * Example: Webhook endpoint with raw body access
 */
router.post(
  '/webhooks/:provider',
  webhookRawBodyMiddleware,
  [
    param('provider').isString().trim().isIn(['stripe', 'github', 'custom']),
  ],
  validateRequest,
  asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const { provider } = req.params as { provider: 'stripe' | 'github' | 'custom' };
    const rawBody = req.rawBody ?? Buffer.from('', 'utf8');

    // Example: signature header - adjust per provider
    const signatureHeader = req.headers['stripe-signature'] || req.headers['x-hub-signature'];

    // Placeholder verification logic; replace with provider-specific logic
    const receivedSignature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader || '';

    const computedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || 'development-secret')
      .update(rawBody)
      .digest('hex');

    const isValid = !!receivedSignature && receivedSignature.includes(computedSignature);

    if (!isValid) {
      return res.status(400).json({ error: 'InvalidSignature' });
    }

    // Safely parsed body from middleware
    const eventPayload = req.body;

    // TODO: handle event based on provider and payload
    // This endpoint should be idempotent in real implementation

    return res.status(200).json({ received: true, provider, idempotentKey: computedSignature });
  })
);

/**
 * 404 handler for unmatched routes under this router
 */
router.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    path: req.path,
  });
});

export default router;