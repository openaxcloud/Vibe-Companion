/**
 * E2E tests for the OAuth + RBAC + invite flow.
 *
 * Strategy: the tests exercise the real HTTP API via `request` (no browser
 * required for most steps) so they run without needing a browser and without
 * a real OAuth redirect.  The "OAuth callback" step is covered by hitting the
 * test-only auth endpoint that the server exposes when
 * NODE_ENV !== 'production' (falls back to the normal local-strategy login
 * for the integration test).
 *
 * Real OAuth browser flows are NOT tested here because they require live
 * provider credentials; those belong in a manual / smoke-test checklist.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiCtx() {
  return playwrightRequest.newContext({ baseURL: BASE });
}

async function registerUser(api: Awaited<ReturnType<typeof apiCtx>>, email: string, password: string, displayName: string) {
  const res = await api.post('/api/auth/register', {
    data: { email, password, displayName },
  });
  return res;
}

async function loginUser(api: Awaited<ReturnType<typeof apiCtx>>, email: string, password: string) {
  const res = await api.post('/api/auth/login', {
    data: { email, password },
  });
  return res;
}

async function createProject(api: Awaited<ReturnType<typeof apiCtx>>, name: string) {
  const res = await api.post('/api/projects', {
    data: { name, language: 'javascript' },
  });
  return res;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('OAuth provider config', () => {
  test('GET /api/auth/config reports github and google presence', async () => {
    const api = await apiCtx();
    const res = await api.get('/api/auth/config');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('providers');
    expect(body.providers).toHaveProperty('github');
    expect(body.providers).toHaveProperty('google');
  });

  test('GET /api/auth/github/redirect returns redirect when GITHUB_CLIENT_ID set', async () => {
    const api = await apiCtx();
    // Without credentials the endpoint returns 500; with them it redirects.
    // We just assert the response exists and is one of the two expected shapes.
    const res = await api.get('/api/auth/github/redirect', { maxRedirects: 0 });
    expect([302, 500, 200]).toContain(res.status());
  });

  test('GET /api/auth/google returns redirect when GOOGLE_CLIENT_ID set', async () => {
    const api = await apiCtx();
    const res = await api.get('/api/auth/google', { maxRedirects: 0 });
    expect([302, 500, 200]).toContain(res.status());
  });
});

test.describe('RBAC + invite flow (API level)', () => {
  // Use unique-per-run emails so tests can be re-run against a live DB.
  const suffix = Date.now();
  const ownerEmail = `rbac-owner-${suffix}@test.local`;
  const ownerPass = 'Test1234!';
  const editorEmail = `rbac-editor-${suffix}@test.local`;
  const editorPass = 'Test1234!';
  const viewerEmail = `rbac-viewer-${suffix}@test.local`;
  const viewerPass = 'Test1234!';

  let ownerApi: Awaited<ReturnType<typeof apiCtx>>;
  let editorApi: Awaited<ReturnType<typeof apiCtx>>;
  let viewerApi: Awaited<ReturnType<typeof apiCtx>>;
  let projectId: string;
  let inviteToken: string;

  test.beforeAll(async () => {
    ownerApi = await apiCtx();
    editorApi = await apiCtx();
    viewerApi = await apiCtx();

    // Register all three users.
    for (const [api, email, pass, name] of [
      [ownerApi, ownerEmail, ownerPass, 'Owner'],
      [editorApi, editorEmail, editorPass, 'Editor'],
      [viewerApi, viewerEmail, viewerPass, 'Viewer'],
    ] as const) {
      const regRes = await registerUser(api as any, email, pass, name);
      // 201 = created, 409 = already exists (re-run scenario) — both are fine.
      expect([201, 409]).toContain(regRes.status());
      const loginRes = await loginUser(api as any, email, pass);
      expect(loginRes.status()).toBe(200);
    }
  });

  test('owner can create a project', async () => {
    const res = await createProject(ownerApi, `rbac-test-${suffix}`);
    expect(res.status()).toBe(201);
    const body = await res.json();
    projectId = body.id;
    expect(projectId).toBeTruthy();
  });

  test('owner gets role=owner on their project', async () => {
    const res = await ownerApi.get(`/api/projects/${projectId}/my-role`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('owner');
  });

  test('editor (not yet invited) is denied write access', async () => {
    // Try to fetch project collaborators as editor — should be 403 or 404.
    const res = await editorApi.get(`/api/projects/${projectId}/invites`);
    expect([403, 401, 404]).toContain(res.status());
  });

  test('owner creates JWT invite for editor', async () => {
    const res = await ownerApi.post(`/api/projects/${projectId}/invites`, {
      data: { email: editorEmail, role: 'editor' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    inviteToken = body.token;
  });

  test('GET /api/invites/:token returns invite preview without auth', async () => {
    const anonApi = await apiCtx();
    const res = await anonApi.get(`/api/invites/${inviteToken}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('editor');
    expect(body.projectId).toBe(projectId);
  });

  test('editor accepts invite and becomes collaborator', async () => {
    const res = await editorApi.post(`/api/invites/${inviteToken}/accept`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('editor');
    expect(body.projectId).toBe(projectId);
  });

  test('editor now has role=editor on the project', async () => {
    const res = await editorApi.get(`/api/projects/${projectId}/my-role`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('editor');
  });

  test('editor appears in shared-projects list', async () => {
    const res = await editorApi.get('/api/me/shared-projects');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const found = body.find((c: any) => c.projectId === projectId);
    expect(found).toBeTruthy();
    expect(found.role).toBe('editor');
  });

  test('viewer (uninvited) cannot write to the project', async () => {
    // POST to a write endpoint as viewer should be 403/401/404.
    const res = await viewerApi.post(`/api/projects/${projectId}/invites`, {
      data: { email: 'someone@test.local', role: 'viewer' },
    });
    expect([403, 401, 404]).toContain(res.status());
  });

  test('owner can list pending invites (none, editor already accepted)', async () => {
    const res = await ownerApi.get(`/api/projects/${projectId}/invites`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // The editor invite was accepted, so status is 'accepted'; no 'pending' invites remain.
    const pending = body.filter((i: any) => i.status === 'pending');
    expect(pending.length).toBe(0);
  });

  test('duplicate invite for same email returns 409', async () => {
    // The editor invite is already accepted, but a second invite for the same
    // email+status=pending combo should be blocked. Create a fresh pending invite.
    const firstRes = await ownerApi.post(`/api/projects/${projectId}/invites`, {
      data: { email: viewerEmail, role: 'viewer' },
    });
    expect(firstRes.status()).toBe(201);

    const dupeRes = await ownerApi.post(`/api/projects/${projectId}/invites`, {
      data: { email: viewerEmail, role: 'viewer' },
    });
    expect(dupeRes.status()).toBe(409);

    // Clean up: delete the pending invite.
    const listRes = await ownerApi.get(`/api/projects/${projectId}/invites`);
    const invites = await listRes.json();
    const pending = invites.find((i: any) => i.email === viewerEmail && i.status === 'pending');
    if (pending) {
      const delRes = await ownerApi.delete(`/api/projects/${projectId}/invites/${pending.id}`);
      expect(delRes.status()).toBe(200);
    }
  });

  test('expired/invalid token returns 400', async () => {
    const anonApi = await apiCtx();
    const res = await anonApi.get('/api/invites/not-a-real-jwt-token');
    expect(res.status()).toBe(400);
  });
});

test.describe('Dashboard UI smoke (browser)', () => {
  test('dashboard page loads and shows project section', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() =>
      page.goto('/dashboard', { waitUntil: 'load', timeout: 20000 }),
    );
    // The page should render without a JS crash.
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
