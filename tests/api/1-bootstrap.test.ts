/**
 * POST /api/workspace/bootstrap
 * Tests: happy path, missing body, unauthenticated, rate-limit (429)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ── hoisted mock state (accessible inside vi.mock factories) ──────────────────

const { storageMock } = vi.hoisted(() => {
  const storageMock = {
    checkProjectLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 10 }),
    createProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'My Project', userId: '1' }),
    createArtifact: vi.fn().mockResolvedValue({ id: 'art-1' }),
    trackEvent: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn().mockResolvedValue({ id: '1', username: 'test' }),
  };
  return { storageMock };
});

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../server/db', () => ({
  pool: { query: vi.fn(), end: vi.fn() },
  db: {},
}));
vi.mock('../../server/storage', () => ({ storage: storageMock }));
vi.mock('../../server/services/fast-bootstrap.service', () => ({
  fastBootstrap: { isAvailable: vi.fn().mockReturnValue(false), getCacheStats: vi.fn().mockReturnValue({}) },
}));
vi.mock('../../server/services/memory-bank.service', () => ({
  memoryBankService: {
    setProjectBasePath: vi.fn(),
    initializeWithAI: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    getContextForAgent: vi.fn().mockResolvedValue(''),
  },
}));
vi.mock('../../server/ai/ai-provider-manager', () => ({ aiProviderManager: {} }));
vi.mock('../../server/utils/secrets-manager', () => ({
  getJwtSecret: vi.fn().mockReturnValue('test-jwt-secret-32-chars-padded!'),
  getEncryptionKey: vi.fn().mockReturnValue('test-key'),
}));
vi.mock('../../server/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../server/middleware/csrf', () => ({
  csrfProtection: (_r: any, _s: any, next: any) => next(),
}));
vi.mock('../../server/utils/project-db-provision', () => ({
  autoProvisionProjectDatabase: vi.fn().mockResolvedValue(undefined),
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import { createTestApp } from './helpers/app';
import bootstrapRouter from '../../server/routes/workspace-bootstrap.router';

// ── tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/workspace/bootstrap', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.checkProjectLimit.mockResolvedValue({ allowed: true, current: 0, limit: 10 });
    storageMock.createProject.mockResolvedValue({ id: 'proj-1', name: 'My Project', userId: '1' });
    app = createTestApp();
    app.use('/api/workspace', bootstrapRouter);
  });

  it('happy path: creates project and returns bootstrapToken + 2 starter files', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');

    const res = await agent
      .post('/api/workspace/bootstrap')
      .send({ prompt: 'build a todo app', buildMode: 'full-app' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projectId).toBe('proj-1');
    expect(typeof res.body.bootstrapToken).toBe('string');
    expect(storageMock.createProject).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ bootstrapPrompt: 'build a todo app' })
    );
    expect(storageMock.createArtifact).toHaveBeenCalled();
  });

  it('returns 400 when prompt is missing', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    const res = await agent.post('/api/workspace/bootstrap').send({ buildMode: 'full-app' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/workspace/bootstrap').send({ prompt: 'test' });
    expect(res.status).toBe(401);
  });

  it('returns 429 when project limit reached', async () => {
    storageMock.checkProjectLimit.mockResolvedValueOnce({ allowed: false, current: 5, limit: 5 });
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    const res = await agent.post('/api/workspace/bootstrap').send({ prompt: 'test project' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/limit/i);
  });
});
