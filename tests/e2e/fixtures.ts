/**
 * Authenticate via the same browser context the page lives in
 * (page.request shares cookies with page). Reuses one project across
 * the whole suite to dodge the per-user create rate limit.
 *
 * Run scripts/reset-e2e-admin.ts before this suite to ensure the
 * admin account exists, has the expected password, and is on the
 * enterprise tier (no project rate limit).
 */
import { Page, expect, test as base } from '@playwright/test';

type Fixtures = {
  freshProjectId: string;
};

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

let cachedProjectId: string | null = null;

async function getCsrf(page: Page): Promise<string | null> {
  const r = await page.request.get('/api/csrf-token');
  if (!r.ok()) return null;
  const body = await r.json().catch(() => null);
  return body?.csrfToken || body?.token || null;
}

async function login(page: Page) {
  const csrf = await getCsrf(page);
  const r = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `login failed: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function getOrCreateProject(page: Page): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const list = await page.request.get('/api/projects');
  if (list.ok()) {
    const body = await list.json().catch(() => null);
    const projects = Array.isArray(body) ? body : (body?.projects ?? []);
    if (Array.isArray(projects) && projects.length > 0) {
      cachedProjectId = String(projects[0].id);
      return cachedProjectId;
    }
  }
  const csrf = await getCsrf(page);
  const r = await page.request.post('/api/projects', {
    data: { name: `e2e-audit-${Date.now()}`, language: 'javascript', visibility: 'private' },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `create project failed: ${r.status()} ${await r.text()}`).toBeTruthy();
  const body = await r.json();
  cachedProjectId = String(body.id || body.project?.id);
  return cachedProjectId;
}

export const test = base.extend<Fixtures>({
  freshProjectId: async ({ page }, use) => {
    await login(page);
    const id = await getOrCreateProject(page);
    await use(id);
  },
});

export { expect };
