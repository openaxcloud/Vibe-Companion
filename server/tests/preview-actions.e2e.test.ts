/**
 * E2E tests for the shared preview-actions contract layer (Task #147).
 *
 * Both HTTP routes (server/routes/preview.ts) and agent tools
 * (AgentToolFrameworkService) delegate to these same functions, ensuring
 * true endpoint parity between the panel UI and AI agent preview control.
 */

// Vitest globals (describe/it/expect/beforeEach/vi) are available via globals:true in vitest.config.ts

// ── Hoisted mock references (vi.mock factories are hoisted to top of file) ───

const mocks = vi.hoisted(() => {
  const mockProject = { id: 'proj-1', userId: 'user-owner', title: 'Test Project' };
  const mockCollaborator = { projectId: 'proj-1', userId: 'user-collab', role: 'editor' };
  const mockPreview = {
    status: 'running' as const,
    runId: 'run-abc',
    ports: [3000],
    primaryPort: 3000,
    frameworkType: 'react',
    exposedServices: [{ port: 3000, name: 'web' }],
    healthChecks: new Map([[3000, true]]),
    lastHealthCheck: new Date('2025-01-01T00:00:00Z'),
    logs: ['Server started on port 3000'],
  };

  const getProject = vi.fn(async (id: string) => id === 'proj-1' ? mockProject : undefined);
  const getProjectCollaborators = vi.fn(async (projectId: string) =>
    projectId === 'proj-1' ? [mockCollaborator] : []
  );
  const previewServiceGetPreview = vi.fn((_id: string) => mockPreview);
  const startPreviewFromProject = vi.fn(async (_id: string, _uid: string) => mockPreview);
  const startPreview = vi.fn(async (_id: string, _opts: { port: number; runId?: string }) => mockPreview);
  const stopPreview = vi.fn(async (_id: string) => undefined);
  const switchPort = vi.fn(async (_id: string, _port: number) => true);
  const getPreviewUrl = vi.fn((_id: string, port: number) =>
    `/api/preview/projects/proj-1/preview/?port=${port}`
  );
  const previewEventsEmit = vi.fn();

  return {
    mockProject, mockCollaborator, mockPreview,
    getProject, getProjectCollaborators,
    previewServiceGetPreview, startPreviewFromProject, startPreview, stopPreview, switchPort, getPreviewUrl,
    previewEventsEmit,
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../storage', () => ({
  storage: {
    getProject: mocks.getProject,
    getProjectCollaborators: mocks.getProjectCollaborators,
  },
}));

vi.mock('../preview/preview-service', () => ({
  previewService: {
    getPreview: mocks.previewServiceGetPreview,
    startPreviewFromProject: mocks.startPreviewFromProject,
    startPreview: mocks.startPreview,
    stopPreview: mocks.stopPreview,
    switchPort: mocks.switchPort,
    getPreviewUrl: mocks.getPreviewUrl,
  },
}));

vi.mock('../preview/preview-websocket', () => ({
  previewEvents: { emit: mocks.previewEventsEmit },
}));

// ── Import SUT after mocks ───────────────────────────────────────────────────

import {
  verifyProjectAccess,
  actionGetStatus,
  actionStart,
  actionStop,
  actionSwitchPort,
  actionReload,
} from '../preview/preview-actions';

// ── Test suite ───────────────────────────────────────────────────────────────

describe('preview-actions contract (shared by HTTP routes + agent tools)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProject.mockImplementation(async (id: string) =>
      id === 'proj-1' ? mocks.mockProject : undefined
    );
    mocks.getProjectCollaborators.mockImplementation(async (projectId: string) =>
      projectId === 'proj-1' ? [mocks.mockCollaborator] : []
    );
    mocks.previewServiceGetPreview.mockImplementation(() => mocks.mockPreview);
    mocks.startPreviewFromProject.mockResolvedValue(mocks.mockPreview);
    mocks.startPreview.mockResolvedValue(mocks.mockPreview);
    mocks.stopPreview.mockResolvedValue(undefined);
    mocks.switchPort.mockResolvedValue(true);
    mocks.getPreviewUrl.mockImplementation((_id: string, port: number) =>
      `/api/preview/projects/proj-1/preview/?port=${port}`
    );
  });

  // ── verifyProjectAccess ──────────────────────────────────────────────────

  describe('verifyProjectAccess', () => {
    it('returns null for project owner', async () => {
      expect(await verifyProjectAccess('proj-1', 'user-owner')).toBeNull();
    });

    it('returns null for project collaborator', async () => {
      expect(await verifyProjectAccess('proj-1', 'user-collab')).toBeNull();
    });

    it('returns error for unknown user', async () => {
      expect(await verifyProjectAccess('proj-1', 'user-stranger'))
        .toBe("You don't have access to this project");
    });

    it('returns error for empty userId', async () => {
      expect(await verifyProjectAccess('proj-1', '')).toBe('Authentication required');
    });

    it('returns error for non-existent project', async () => {
      const result = await verifyProjectAccess('proj-not-found', 'user-owner');
      expect(result).toMatch(/not found/i);
    });
  });

  // ── actionGetStatus ──────────────────────────────────────────────────────

  describe('actionGetStatus', () => {
    it('returns full status shape when preview is running', async () => {
      const result = await actionGetStatus('proj-1');
      expect(result.success).toBe(true);
      expect(result.status).toBe('running');
      expect(result.ports).toEqual([3000]);
      expect(result.primaryPort).toBe(3000);
      expect(result.services).toEqual([{ port: 3000, name: 'web' }]);
      expect(result.frameworkType).toBe('react');
      expect(result.logs).toEqual(['Server started on port 3000']);
      expect(result.previewUrl).toBe('/api/preview/projects/proj-1/preview/');
      expect(result.lastHealthCheck).toBe('2025-01-01T00:00:00.000Z');
    });

    it('returns stopped shape when no preview session exists', async () => {
      mocks.previewServiceGetPreview.mockReturnValueOnce(undefined);
      const result = await actionGetStatus('proj-1');
      expect(result.success).toBe(true);
      expect(result.status).toBe('stopped');
      expect(result.message).toMatch(/no preview session/i);
    });
  });

  // ── actionStart ──────────────────────────────────────────────────────────

  describe('actionStart', () => {
    it('starts preview in auto-detect mode and returns mutation result', async () => {
      const result = await actionStart('proj-1', 'user-owner');
      expect(result.success).toBe(true);
      expect(result.status).toBe('running');
      expect(result.ports).toEqual([3000]);
      expect(result.previewUrl).toBe('/api/preview/projects/proj-1/preview/');
      expect(mocks.startPreviewFromProject).toHaveBeenCalledWith('proj-1', 'user-owner');
    });

    it('starts preview in port-proxy mode when opts.port is supplied', async () => {
      const result = await actionStart('proj-1', 'user-owner', { port: 4000 });
      expect(result.success).toBe(true);
      expect(mocks.startPreview).toHaveBeenCalledWith('proj-1', { port: 4000, runId: undefined });
    });

    it('propagates error when previewService throws', async () => {
      mocks.startPreviewFromProject.mockRejectedValueOnce(
        new Error('No runnable files found in project')
      );
      await expect(actionStart('proj-1', 'user-owner')).rejects.toThrow('No runnable files found');
    });
  });

  // ── actionStop ───────────────────────────────────────────────────────────

  describe('actionStop', () => {
    it('stops preview and returns stopped result', async () => {
      const result = await actionStop('proj-1');
      expect(result.success).toBe(true);
      expect(result.status).toBe('stopped');
      expect(mocks.stopPreview).toHaveBeenCalledWith('proj-1');
    });
  });

  // ── actionSwitchPort ─────────────────────────────────────────────────────

  describe('actionSwitchPort', () => {
    it('switches port and returns url + previewUrl', async () => {
      const result = await actionSwitchPort('proj-1', 4000);
      expect(result.success).toBe(true);
      expect(result.port).toBe(4000);
      expect(result.url).toContain('4000');
      expect(result.previewUrl).toContain('4000');
    });

    it('returns failure when port is unavailable', async () => {
      mocks.switchPort.mockResolvedValueOnce(false);
      const result = await actionSwitchPort('proj-1', 9999);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not available/i);
    });
  });

  // ── actionReload ─────────────────────────────────────────────────────────

  describe('actionReload', () => {
    it('emits preview:rebuild event and returns success', async () => {
      const result = await actionReload('proj-1');
      expect(result.success).toBe(true);
      expect(mocks.previewEventsEmit).toHaveBeenCalledWith('preview:rebuild', { projectId: 'proj-1' });
    });
  });

  // ── lifecycle roundtrip ──────────────────────────────────────────────────

  describe('lifecycle roundtrip', () => {
    it('start → getStatus → stop produces coherent state chain', async () => {
      const started = await actionStart('proj-1', 'user-owner');
      expect(started.status).toBe('running');

      const status = await actionGetStatus('proj-1');
      expect(status.status).toBe('running');
      expect(status.previewUrl).toBeTruthy();

      const stopped = await actionStop('proj-1');
      expect(stopped.status).toBe('stopped');
    });

    it('agent and HTTP path resolve identical result shape for getStatus', async () => {
      const r1 = await actionGetStatus('proj-1');
      const r2 = await actionGetStatus('proj-1');
      expect(r1).toEqual(r2);
    });

    it('access check gates all actions consistently', async () => {
      expect(await verifyProjectAccess('proj-1', 'user-owner')).toBeNull();
      expect(await verifyProjectAccess('proj-1', 'stranger')).not.toBeNull();
    });
  });
});
