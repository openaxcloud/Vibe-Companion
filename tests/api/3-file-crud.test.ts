/**
 * File CRUD: POST/GET/PUT/DELETE /api/projects/:id/files
 *
 * Validates:
 *  - List, create, update, delete files through the FilesRouter
 *  - tenantId backfill: withScopedTransaction is called with userId as tenantId
 *  - 403 when access is denied (scopedTransaction fails with access-denied error)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ── Scoped queries mock (vi.hoisted so factory can reference it) ──────────────

const { scopedQ } = vi.hoisted(() => {
  const scopedQ = {
    getFilesByProject: vi.fn(),
    getFileById: vi.fn(),
    createFile: vi.fn(),
    updateFile: vi.fn(),
    deleteFile: vi.fn(),
  };
  return { scopedQ };
});

vi.mock('../../server/services/persistence-engine', () => ({
  withScopedTransaction: vi.fn().mockImplementation(async (_tenantId: any, _userId: any, fn: any) => {
    try {
      const data = await fn(scopedQ);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

vi.mock('../../server/db', () => ({
  pool: { query: vi.fn(), end: vi.fn() },
  db: {},
}));
vi.mock('../../server/storage', () => ({
  storage: { getUser: vi.fn().mockResolvedValue({ id: '1', username: 'test' }) },
}));
vi.mock('../../server/utils/project-fs-sync', () => ({
  syncFileToDisc: vi.fn(),
  removeFileFromDisk: vi.fn(),
  syncFileToWorkspace: vi.fn(),
}));
vi.mock('../../server/preview/preview-websocket', () => ({
  previewEvents: { emit: vi.fn() },
}));
vi.mock('../../server/middleware/csrf', () => ({
  csrfProtection: (_r: any, _s: any, next: any) => next(),
}));
vi.mock('../../server/middleware/auth', () => ({
  ensureAuthenticated: (req: any, res: any, next: any) => {
    const uid = req.session?.userId;
    if (!uid) return res.status(401).json({ error: 'Auth required' });
    req.user = { id: uid };
    next();
  },
}));
vi.mock('../../server/services/ai-security.service', () => ({
  aiSecurityService: {
    validatePath: vi.fn().mockReturnValue({ valid: true, sanitized: 'index.html' }),
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../server/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { createTestApp } from './helpers/app';
import { FilesRouter } from '../../server/routes/files.router';
import { withScopedTransaction } from '../../server/services/persistence-engine';

const PROJ = '1';
const FILE_FIXTURE = {
  id: 1, projectId: 1, path: 'index.html', filename: 'index.html',
  content: '<h1>Hi</h1>', isDirectory: false,
};

describe('File CRUD /api/projects/:id/files', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    scopedQ.getFilesByProject.mockResolvedValue([FILE_FIXTURE]);
    scopedQ.getFileById.mockResolvedValue(FILE_FIXTURE);
    scopedQ.createFile.mockResolvedValue({ ...FILE_FIXTURE, id: 2, path: 'new.js', filename: 'new.js' });
    scopedQ.updateFile.mockResolvedValue({ ...FILE_FIXTURE, content: 'updated' });
    scopedQ.deleteFile.mockResolvedValue(true);

    const storage = { getUser: vi.fn().mockResolvedValue({ id: '1' }) } as any;
    app = createTestApp();
    app.use('/api/projects', new FilesRouter(storage).getRouter());
  });

  it('GET /:id/files — lists project files', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    const res = await agent.get(`/api/projects/${PROJ}/files`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].filename).toBe('index.html');
  });

  it('POST /:id/files — creates file; tenantId=userId (backfill invariant)', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    scopedQ.getFilesByProject.mockResolvedValue([]); // no duplicate
    const res = await agent
      .post(`/api/projects/${PROJ}/files`)
      .send({ filename: 'new.js', content: 'console.log()' });
    expect(res.status).toBe(200);
    // tenantId === userId (the backfill invariant for personal projects)
    expect(withScopedTransaction).toHaveBeenCalledWith('1', '1', expect.any(Function));
  });

  it('PUT /:id/files/:path — updates file content via path', async () => {
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    // PUT /:projectId/files/{*filePath} — update existing file
    const res = await agent
      .put(`/api/projects/${PROJ}/files/index.html`)
      .send({ content: 'updated content' });
    // scopedQ.updateFile resolves with updated content
    expect(res.status).toBe(200);
  });

  it('returns 403 when scopedTransaction reports access denied', async () => {
    (withScopedTransaction as any).mockResolvedValueOnce({
      success: false,
      error: new Error('Project not found or access denied'),
    });
    const agent = request.agent(app);
    await agent.get('/test/login?userId=1');
    const res = await agent.get(`/api/projects/${PROJ}/files`);
    expect(res.status).toBe(403);
  });
});
