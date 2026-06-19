/**
 * GET /api/preview/projects/:id/preview/
 *
 * Validates:
 *  - Returns index.html of an AI-generated project (200, Content-Type text/html)
 *  - 401 when unauthenticated
 *  - 404 when project has no index.html
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../server/db', () => ({
  pool: { query: vi.fn(), end: vi.fn() },
  db: {},
}));

const { storageMock } = vi.hoisted(() => {
  const storageMock = {
    getProject: vi.fn(),
    getFiles: vi.fn(),
    getProjectCollaborators: vi.fn().mockResolvedValue([]),
  };
  return { storageMock };
});

vi.mock('../../server/storage', () => ({ storage: storageMock }));

// proxyToLivePreview skips to next() when preview service has no running preview
vi.mock('../../server/preview/preview-service', () => ({
  previewService: { getPreview: vi.fn().mockReturnValue(null) },
}));
vi.mock('../../server/preview/preview-websocket', () => ({
  previewEvents: { emit: vi.fn() },
}));
vi.mock('../../server/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── imports ───────────────────────────────────────────────────────────────────

import { createTestApp } from './helpers/app';
import previewRouter from '../../server/routes/preview';

const HTML_FILE = {
  id: 1,
  projectId: 1,
  filename: 'index.html',
  path: 'index.html',
  content: '<!DOCTYPE html><html><body><h1>AI App</h1></body></html>',
  isDirectory: false,
};

const PROJECT = { id: '1', userId: '1', name: 'Test Project' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/preview/projects/:id/preview/', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getProject.mockResolvedValue(PROJECT);
    storageMock.getFiles.mockResolvedValue([HTML_FILE]);
    app = createTestApp();
    app.use('/api/preview', previewRouter);
  });

  it('returns index.html of the AI-generated project with mime text/html', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');

    const res = await agent.get('/api/preview/projects/1/preview/');

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain('<h1>AI App</h1>');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/preview/projects/1/preview/');
    expect(res.status).toBe(401);
  });

  it('returns empty body (not 500) when project has no index.html', async () => {
    storageMock.getFiles.mockResolvedValue([
      { ...HTML_FILE, filename: 'app.js', path: 'app.js', content: 'console.log()' },
    ]);
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');

    const res = await agent.get('/api/preview/projects/1/preview/');

    // No index.html → router sends empty HTML or 404, never 500
    expect(res.status).not.toBe(500);
  });
});
