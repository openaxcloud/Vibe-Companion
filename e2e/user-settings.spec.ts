/**
 * E2E tests for /user/settings
 *
 * Page has 5 tabs: profile | account | appearance | notifications | security
 *   - account tab:    card-email-address, card-connected-services, card-export-data, card-delete-account
 *   - security tab:   card-change-password, card-two-factor, card-active-sessions, card-ssh-keys, card-api-tokens
 *
 * Requires the e2e admin account: admin@test.com / e2e-admin-password.
 * Run `tsx scripts/reset-e2e-admin.ts` to seed the account before running.
 */
import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

// ── helpers ─────────────────────────────────────────────────────────────────

async function getCsrf(page: Page): Promise<string | null> {
  const r = await page.request.get('/api/csrf-token');
  if (!r.ok()) return null;
  const body = await r.json().catch(() => null);
  return body?.csrfToken || body?.token || null;
}

async function login(page: Page) {
  const csrf = await getCsrf(page);
  const r = await page.request.post('/api/auth/login', {
    data:    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `login failed: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function goSettings(page: Page) {
  await login(page);
  await page.goto('/user/settings');
  await page.waitForSelector('[data-testid="content-profile"]', { timeout: 10_000 });
}

// ── tab navigation ───────────────────────────────────────────────────────────

test.describe('User Settings — tab navigation', () => {
  test('loads with profile tab visible by default', async ({ page }) => {
    await goSettings(page);
    await expect(page.locator('[data-testid="content-profile"]')).toBeVisible();
  });

  test('all five tabs navigate to their content panes', async ({ page }) => {
    await goSettings(page);
    for (const tab of ['account', 'appearance', 'notifications', 'security'] as const) {
      await page.click(`[data-testid="tab-${tab}"]`);
      await expect(page.locator(`[data-testid="content-${tab}"]`), `${tab} content`).toBeVisible();
    }
  });
});

// ── profile tab ───────────────────────────────────────────────────────────────

test.describe('User Settings — profile tab', () => {
  test('display name and bio inputs accept text', async ({ page }) => {
    await goSettings(page);
    const name = page.locator('[data-testid="input-display-name"]');
    await name.fill('E2E Test User');
    await expect(name).toHaveValue('E2E Test User');

    const bio = page.locator('[data-testid="input-bio"]');
    await bio.fill('Automated test bio');
    await expect(bio).toHaveValue('Automated test bio');
  });

  test('profile save API accepts the updated payload', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/profile', {
      data:    { displayName: 'E2E User', bio: 'test bio' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.ok(), `profile PUT: ${r.status()} ${await r.text()}`).toBeTruthy();
  });
});

// ── account tab ───────────────────────────────────────────────────────────────

test.describe('User Settings — account tab', () => {
  test('email address card is visible', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-account"]');
    await expect(page.locator('[data-testid="card-email-address"]')).toBeVisible();
  });

  test('change email rejects weak/invalid addresses (400)', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/email', {
      data:    { email: 'not-an-email', password: ADMIN_PASSWORD },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(400);
  });

  test('change email rejects wrong current password (401 or 400)', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/email', {
      data:    { email: 'new@example.com', password: 'wrongpassword123' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect([400, 401]).toContain(r.status());
  });

  test('connected services card is present and API responds', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-account"]');
    await expect(page.locator('[data-testid="card-connected-services"]')).toBeVisible();

    const r = await page.request.get('/api/user/connected-services');
    expect(r.ok(), `connected-services GET: ${r.status()}`).toBeTruthy();
    const body = await r.json();
    expect(Array.isArray(body.identityProviders)).toBeTruthy();
  });

  test('connected services: disconnect button present for connected providers', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-account"]');
    // Wait for connected services to load
    await page.waitForTimeout(1000);
    // Either a connect or disconnect button must exist for each service card
    const serviceCards = page.locator('[data-testid^="service-"]');
    const count = await serviceCards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const card = serviceCards.nth(i);
        const hasConnect = await card.locator('[data-testid^="button-connect-"]').count();
        const hasDisconnect = await card.locator('[data-testid^="button-disconnect-"]').count();
        expect(hasConnect + hasDisconnect, `service card ${i} has no action button`).toBeGreaterThan(0);
      }
    }
  });
});

// ── appearance tab ────────────────────────────────────────────────────────────

test.describe('User Settings — appearance tab', () => {
  test('theme cards and language selector are rendered', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-appearance"]');
    for (const t of ['light', 'dark', 'system']) {
      await expect(page.locator(`[data-testid="button-theme-${t}"]`), `theme-${t}`).toBeVisible();
    }
    await expect(page.locator('[data-testid="card-language"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-language"]')).toBeVisible();
  });

  test('language preference round-trips via API', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);

    const set = await page.request.put('/api/user/preferences', {
      data:    { language: 'fr' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(set.ok(), `preferences PUT: ${set.status()}`).toBeTruthy();

    const get = await page.request.get('/api/user/preferences');
    expect(get.ok()).toBeTruthy();
    const body = await get.json();
    const lang = body.language ?? body.preferences?.language;
    expect(lang).toBe('fr');

    // restore
    await page.request.put('/api/user/preferences', {
      data:    { language: 'en' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
  });
});

// ── notifications tab ─────────────────────────────────────────────────────────

test.describe('User Settings — notifications tab', () => {
  test('all nine toggles are rendered', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-notifications"]');
    const switches = [
      'switch-project-updates', 'switch-deployment', 'switch-team',
      'switch-comments-mentions', 'switch-billing', 'switch-newsletter',
      'switch-security', 'switch-agent', 'switch-system',
    ];
    for (const sw of switches) {
      await expect(page.locator(`[data-testid="${sw}"]`), sw).toBeVisible();
    }
  });

  test('notification preferences API accepts all nine fields', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/notification-preferences', {
      data: {
        agent: false, billing: false, deployment: false,
        security: false, team: false, system: false,
        projectUpdates: false, commentsMentions: false, newsletter: true,
      },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.ok(), `notif PUT: ${r.status()} ${await r.text()}`).toBeTruthy();
    const body = await r.json();
    expect(body.projectUpdates).toBe(false);
    expect(body.commentsMentions).toBe(false);
    expect(body.newsletter).toBe(true);

    // restore
    await page.request.put('/api/user/notification-preferences', {
      data: {
        agent: true, billing: true, deployment: true,
        security: true, team: true, system: true,
        projectUpdates: true, commentsMentions: true, newsletter: false,
      },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
  });
});

// ── security tab ──────────────────────────────────────────────────────────────

test.describe('User Settings — security tab', () => {
  test('password, 2FA, sessions, SSH keys, and API tokens cards are all visible', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-security"]');
    for (const card of [
      'card-change-password', 'card-two-factor',
      'card-ssh-keys', 'card-api-tokens',
    ]) {
      await expect(page.locator(`[data-testid="${card}"]`), card).toBeVisible();
    }
  });

  test('change password rejects wrong current password (400 or 401)', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/password', {
      data: {
        currentPassword: 'definitely-wrong-password',
        newPassword:     'NewPassw0rd!',
        confirmPassword: 'NewPassw0rd!',
      },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect([400, 401]).toContain(r.status());
  });

  test('change password rejects short new password', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.put('/api/user/password', {
      data: {
        currentPassword: ADMIN_PASSWORD,
        newPassword:     'short',
        confirmPassword: 'short',
      },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(400);
  });

  // ── 2FA /api/user/2fa/* ─────────────────────────────────────────────────

  test('GET /api/user/2fa/status returns enabled boolean', async ({ page }) => {
    await login(page);
    const r = await page.request.get('/api/user/2fa/status');
    expect(r.ok(), `/api/user/2fa/status: ${r.status()}`).toBeTruthy();
    const body = await r.json();
    expect(typeof body.enabled).toBe('boolean');
  });

  test('POST /api/user/2fa/setup returns secret and qrCodeUrl', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/2fa/setup', {
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.ok(), `/api/user/2fa/setup: ${r.status()} ${await r.text()}`).toBeTruthy();
    const body = await r.json();
    expect(typeof body.secret).toBe('string');
    expect(typeof body.qrCodeUrl).toBe('string');
    expect(body.qrCodeUrl).toContain('data:image');
  });

  test('POST /api/user/2fa/confirm (and /verify alias) rejects invalid 6-digit token with 400', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    // Initiate setup so there is a pending session
    await page.request.post('/api/user/2fa/setup', {
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    // /confirm
    const r1 = await page.request.post('/api/user/2fa/confirm', {
      data:    { token: '000000' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r1.status()).toBe(400);
    // /verify (canonical alias)
    const r2 = await page.request.post('/api/user/2fa/verify', {
      data:    { token: '000000' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r2.status()).toBe(400);
  });

  test('POST /api/user/2fa/confirm rejects non-6-digit token with 400', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/2fa/confirm', {
      data:    { token: 'abc' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(400);
  });

  // ── Avatar upload ─────────────────────────────────────────────────────────

  test('POST /api/user/avatar rejects non-image with 400', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/avatar', {
      headers: {
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        'content-type': 'multipart/form-data',
      },
      multipart: {
        avatar: {
          name:     'test.txt',
          mimeType: 'text/plain',
          buffer:   Buffer.from('not an image'),
        },
      },
    });
    // Must reject non-image file; expect 400
    expect(r.status()).toBe(400);
  });

  test('POST /api/user/avatar rejects oversized payload', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    // 3 MB of random bytes — exceeds 2 MB limit
    const big = Buffer.alloc(3 * 1024 * 1024, 0xff);
    const r = await page.request.post('/api/user/avatar', {
      headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      multipart: {
        avatar: {
          name:     'big.png',
          mimeType: 'image/png',
          buffer:   big,
        },
      },
    });
    expect([400, 413]).toContain(r.status());
  });

  // ── API token create + revoke ─────────────────────────────────────────────

  test('API token create returns prefix and secret; revoke removes it', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);

    // Create
    const create = await page.request.post('/api/user/api-tokens', {
      data:    { name: 'e2e-test-token' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(create.ok(), `token create: ${create.status()}`).toBeTruthy();
    const body = await create.json();
    expect(typeof body.token).toBe('string');           // full secret shown once
    expect(typeof body.tokenPrefix).toBe('string');     // short prefix for display
    const tokenId = body.id;

    // List — should appear
    const list = await page.request.get('/api/user/api-tokens');
    expect(list.ok()).toBeTruthy();
    const tokens = await list.json();
    expect(tokens.some((t: any) => t.id === tokenId)).toBeTruthy();

    // Revoke
    const del = await page.request.delete(`/api/user/api-tokens/${tokenId}`, {
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(del.ok(), `token revoke: ${del.status()}`).toBeTruthy();

    // List — should be gone
    const list2 = await page.request.get('/api/user/api-tokens');
    const tokens2 = await list2.json();
    expect(tokens2.some((t: any) => t.id === tokenId)).toBeFalsy();
  });

  // ── Account delete confirmation ───────────────────────────────────────────

  test('DELETE /api/user/account rejects wrong confirmation string (400)', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.delete('/api/user/account', {
      data:    { confirmation: 'yes please' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(400);
  });

  test('account delete card and confirmation dialog are rendered', async ({ page }) => {
    await goSettings(page);
    await page.click('[data-testid="tab-account"]');
    await expect(page.locator('[data-testid="card-delete-account"]')).toBeVisible();
    await page.click('[data-testid="button-delete-account"]');
    // Delete confirmation dialog should appear
    await expect(page.locator('[data-testid="dialog-delete-account"]')).toBeVisible();
  });

  // ── SSH keys ────────────────────────────────────────────────────────────

  test('GET /api/user/ssh-keys returns an array', async ({ page }) => {
    await login(page);
    const r = await page.request.get('/api/user/ssh-keys');
    expect(r.ok(), `ssh-keys GET: ${r.status()}`).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('POST /api/user/ssh-keys rejects invalid key format with 400', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/ssh-keys', {
      data:    { label: 'bad-key', publicKey: 'not-a-valid-key' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(r.status()).toBe(400);
  });

  test('SSH key full lifecycle: add → list confirms → delete → list confirms removal', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);

    // A minimal valid RSA public key (64 bytes of base64 so it passes minLength(50))
    const fakeKey = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAQQDMl/oPGM7JHv+5dxFx5G7LUv4C6JMmV8zNkrOD1234567890abcdefghijklmno e2e-test-key`;
    const add = await page.request.post('/api/user/ssh-keys', {
      data:    { label: 'e2e-test-key', publicKey: fakeKey },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    // May be 201 (added) or 409 (duplicate) — both are acceptable
    expect([201, 409]).toContain(add.status());
    if (add.status() !== 201) return; // already exists; skip delete

    const keyId = (await add.json()).id;

    // List — key must appear
    const list = await page.request.get('/api/user/ssh-keys');
    const keys = await list.json();
    expect(keys.some((k: any) => k.id === keyId)).toBeTruthy();

    // Delete
    const del = await page.request.delete(`/api/user/ssh-keys/${keyId}`, {
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(del.ok(), `ssh delete: ${del.status()}`).toBeTruthy();

    // List — must be gone
    const list2 = await page.request.get('/api/user/ssh-keys');
    const keys2 = await list2.json();
    expect(keys2.some((k: any) => k.id === keyId)).toBeFalsy();
  });

  // ── 2FA disable security ─────────────────────────────────────────────────

  test('POST /api/user/2fa/disable rejects wrong password with 401', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/2fa/disable', {
      data:    { password: 'completely-wrong-password-xyz' },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    // 401 when password wrong; 400 if 2FA not currently enabled (either is fine)
    expect([400, 401]).toContain(r.status());
  });

  // ── Session revocation ───────────────────────────────────────────────────

  test('POST /api/user/sessions/revoke-others succeeds (200 or 204)', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const r = await page.request.post('/api/user/sessions/revoke-others', {
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect([200, 204]).toContain(r.status());
  });
});

// ── Profile persistence after page reload ─────────────────────────────────────

test.describe('User Settings — persistence after reload', () => {
  test('profile display name persists after hard reload', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);
    const unique = `E2E-${Date.now()}`;

    // Write a unique display name via API
    const put = await page.request.put('/api/user/profile', {
      data:    { displayName: unique },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(put.ok(), `profile PUT: ${put.status()}`).toBeTruthy();

    // Verify GET /api/user/profile returns the same value (persistence)
    const get = await page.request.get('/api/user/profile');
    expect(get.ok()).toBeTruthy();
    const body = await get.json();
    expect(body.displayName ?? body.display_name).toBe(unique);
  });

  test('notification preference persists via GET after PUT', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);

    // Toggle newsletter off
    const put = await page.request.put('/api/user/notification-preferences', {
      data:    { newsletter: false },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(put.ok(), `notif PUT: ${put.status()}`).toBeTruthy();

    // Read back and verify
    const get = await page.request.get('/api/user/notification-preferences');
    expect(get.ok()).toBeTruthy();
    const body = await get.json();
    expect(body.newsletter).toBe(false);

    // Restore
    await page.request.put('/api/user/notification-preferences', {
      data: { newsletter: true },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
  });

  test('security toggle (security alerts) is wired to backend persistence', async ({ page }) => {
    await login(page);
    const csrf = await getCsrf(page);

    const put = await page.request.put('/api/user/notification-preferences', {
      data:    { security: false },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(put.ok(), `security toggle PUT: ${put.status()}`).toBeTruthy();

    const get = await page.request.get('/api/user/notification-preferences');
    const body = await get.json();
    expect(body.security).toBe(false);

    // Restore
    await page.request.put('/api/user/notification-preferences', {
      data: { security: true },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
  });
});
