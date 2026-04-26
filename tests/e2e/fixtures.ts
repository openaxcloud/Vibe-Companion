/**
 * Authenticate the seeded admin user via the public auth endpoints
 * and provide one shared project ID for the panel suite (creating a
 * fresh project per test would hit the per-user project limit on the
 * default plan and isn't needed — panel mount checks are read-only).
 *
 * Run scripts/reset-e2e-admin.ts before this suite to ensure the
 * admin account exists, has the expected password, and is on the
 * enterprise tier (no project rate limit).
 */
import { APIRequestContext, expect, test as base } from '@playwright/test';

type Fixtures = {
  authedRequest: APIRequestContext;
  freshProjectId: string;
};

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

let cachedProjectId: string | null = null;

async function getCsrfToken(request: APIRequestContext) {
  const r = await request.get('/api/csrf-token');
  if (!r.ok()) return null;
  const body = await r.json().catch(() => null);
  return body?.csrfToken || body?.token || null;
}

async function login(request: APIRequestContext) {
  const csrf = await getCsrfToken(request);
  const r = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `login failed: status=${r.status()} body=${await r.text()}`).toBeTruthy();
}

async function getOrCreateProject(request: APIRequestContext): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  // Try to reuse an existing project to avoid the per-user create rate limit.
  const list = await request.get('/api/projects');
  if (list.ok()) {
    const body = await list.json().catch(() => null);
    const projects = Array.isArray(body) ? body : (body?.projects ?? []);
    if (Array.isArray(projects) && projects.length > 0) {
      cachedProjectId = String(projects[0].id);
      return cachedProjectId;
    }
  }
  // Fall back to creating one.
  const csrf = await getCsrfToken(request);
  const r = await request.post('/api/projects', {
    data: { name: `e2e-audit-${Date.now()}`, language: 'javascript', visibility: 'private' },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `create project failed: ${r.status()} ${await r.text()}`).toBeTruthy();
  const body = await r.json();
  cachedProjectId = String(body.id || body.project?.id);
  return cachedProjectId;
}

export const test = base.extend<Fixtures>({
  authedRequest: async ({ request }, use) => {
    await login(request);
    await use(request);
  },
  freshProjectId: async ({ authedRequest }, use) => {
    const id = await getOrCreateProject(authedRequest);
    await use(id);
  },
});

export { expect };
