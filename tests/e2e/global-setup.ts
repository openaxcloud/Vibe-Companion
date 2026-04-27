/**
 * Global Playwright setup — pre-warms the Vite dev-server module
 * graph so the actual panel specs don't pay the ~30-40s cold-load
 * cost on the first navigation per browser context.
 *
 * Without this, the first 4 specs (files/agent/preview/console) all
 * timed out at IDE_LOAD_MS=90s while terminal/git/settings passed —
 * Vite serves ~100 chunks fresh on each new context, the dev server
 * compiles them lazily, and only the fastest panels squeaked
 * through. After this hook, every spec hits warm chunks.
 */
import { chromium, FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'http://localhost:5099';
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Login so the IDE bootstrap can fetch /api/projects/:id behind auth.
    const csrfRes = await page.request.get(`${baseURL}/api/csrf-token`);
    const csrf = (await csrfRes.json().catch(() => null))?.csrfToken;
    await page.request.post(`${baseURL}/api/auth/login`, {
      data: { email: 'admin@test.com', password: 'e2e-admin-password' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });

    // First fetch the project list to discover an id.
    const list = await page.request.get(`${baseURL}/api/projects`);
    const arr = await list.json();
    const pid = Array.isArray(arr) && arr[0]?.id;
    if (!pid) {
      console.warn('[global-setup] no project to warm-load against; skipping');
      return;
    }

    // Cold-load /project/:id — this compiles every chunk Vite serves.
    await page.goto(`${baseURL}/project/${pid}`, { waitUntil: 'load', timeout: 120_000 });

    // Wait until the IDE root mounts so we know the warm-up actually
    // covered the IDE bundle, not just the shell.
    try {
      await page.waitForSelector('[data-ide-layout="unified"]', { timeout: 60_000 });
    } catch {
      console.warn('[global-setup] IDE root never mounted during warm-up — specs may still cold-load');
    }
  } finally {
    await browser.close();
  }

  console.log(`[global-setup] Vite warm-up done in ${Date.now() - t0}ms`);
}
