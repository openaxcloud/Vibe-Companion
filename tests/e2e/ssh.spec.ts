/**
 * SSH Panel — browser-level end-to-end audit.
 *
 * Verifies:
 *  1. /ssh page loads without JS exceptions or 5xx responses
 *  2. Keys tab and Connect tab are present
 *  3. Connect tab shows "no project context" notice when no ?projectId= in URL
 *  4. Navigate to /ssh?projectId=<id> → connection-info wiring is exercised:
 *       - data-testid="ssh-unavailable-notice" or data-testid="ssh-connection-details"
 *         is rendered (no raw JSON blob, no blank panel)
 *  5. Add a key via API → key appears in Keys tab with correct fingerprint
 *  6. Delete the key via the UI → key disappears from the list
 *  7. No JS pageerrors throughout the entire flow
 */
import * as crypto from 'crypto';
import path from 'path';
import { test, expect } from './fixtures';

const SHOTS = path.join(process.cwd(), 'tests/e2e/shots');

/** Build an OpenSSH wire-format ed25519 public key from a raw 32-byte key. */
function buildOpensshPublicKey(rawPubKey: Buffer): string {
  const name = Buffer.from('ssh-ed25519', 'utf8');
  const buf = Buffer.allocUnsafe(4 + name.length + 4 + rawPubKey.length);
  buf.writeUInt32BE(name.length, 0);
  name.copy(buf, 4);
  buf.writeUInt32BE(rawPubKey.length, 4 + name.length);
  rawPubKey.copy(buf, 4 + name.length + 4);
  return `ssh-ed25519 ${buf.toString('base64')} e2e-test`;
}

/** Compute the SHA256 fingerprint as ssh-keygen -lf would output. */
function computeFingerprint(publicKey: string): string {
  const blob = Buffer.from(publicKey.trim().split(/\s+/)[1], 'base64');
  const hash = crypto.createHash('sha256').update(blob).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

test.describe('SSH panel', () => {
  test('account-level /ssh page loads without errors', async ({ page, freshProjectId }, testInfo) => {
    const fatalErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('pageerror', e => fatalErrors.push(e.message));
    page.on('response', r => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`); });

    // Navigate to the account-level SSH page (no projectId in URL).
    const res = await page.goto('/ssh', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(res?.status(), '/ssh must not return a 5xx').toBeLessThan(500);

    // Page must not be a blank/error page — SSH heading must render.
    await page.waitForSelector('[data-testid="button-back-to-account"]', { timeout: 20_000 });

    // Keys tab must be present.
    await expect(page.locator('[data-testid="tab-ssh-keys"]')).toBeVisible({ timeout: 8_000 });

    // Connect tab must be present.
    const connectTab = page.locator('[data-testid="tab-ssh-connect"]');
    await expect(connectTab).toBeVisible({ timeout: 5_000 });
    await connectTab.click();
    await page.waitForTimeout(500);

    // Without ?projectId= the panel must show the no-project-context notice,
    // NOT raw connection credentials with an invalid SSH username.
    const noProjectNotice = page.locator('[data-testid="ssh-no-project-notice"]');
    const unavailableNotice = page.locator('[data-testid="ssh-unavailable-notice"]');
    const eitherNotice = noProjectNotice.or(unavailableNotice);
    await expect(eitherNotice.first()).toBeVisible({ timeout: 5_000 });

    // The panel must not show connection details without a project context.
    await expect(page.locator('[data-testid="ssh-connection-details"]')).not.toBeVisible();

    const shot = path.join(SHOTS, 'ssh-account-page.png');
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    await testInfo.attach('ssh-account-page.png', { path: shot, contentType: 'image/png' }).catch(() => {});

    expect(fatalErrors, 'No JS pageerrors on /ssh').toEqual([]);
    expect(serverErrors, 'No 5xx responses on /ssh').toEqual([]);
  });

  test('connection-info wiring: /ssh?projectId=<id> renders connect panel', async ({ page, freshProjectId }, testInfo) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', e => fatalErrors.push(e.message));

    const res = await page.goto(`/ssh?projectId=${freshProjectId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(res?.status(), '/ssh?projectId= must not return 5xx').toBeLessThan(500);

    // Page chrome must mount.
    await page.waitForSelector('[data-testid="button-back-to-account"]', { timeout: 20_000 });

    // Navigate to Connect tab.
    const connectTab = page.locator('[data-testid="tab-ssh-connect"]');
    if (await connectTab.count() > 0) {
      await connectTab.click();
      await page.waitForTimeout(1_500); // allow connection-info fetch to complete

      // Panel must show either real credentials or an unavailable notice — never nothing.
      const connDetails = page.locator('[data-testid="ssh-connection-details"]');
      const unavailableNotice = page.locator('[data-testid="ssh-unavailable-notice"]');
      const either = connDetails.or(unavailableNotice);
      await expect(either.first()).toBeVisible({ timeout: 8_000 });

      if (await connDetails.isVisible()) {
        // Values must come from the backend — not empty strings.
        const host = await page.locator('[data-testid="text-ssh-host"]').textContent();
        const port = await page.locator('[data-testid="text-ssh-port"]').textContent();
        const user = await page.locator('[data-testid="text-ssh-user"]').textContent();
        expect(host?.trim().length, 'host must be non-empty').toBeGreaterThan(0);
        expect(port?.trim().length, 'port must be non-empty').toBeGreaterThan(0);
        expect(user?.trim().length, 'user must be non-empty').toBeGreaterThan(0);
        expect(user?.trim(), 'user must match projectId').toBe(freshProjectId);
      }
    }

    const shot = path.join(SHOTS, 'ssh-connect-tab.png');
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    await testInfo.attach('ssh-connect-tab.png', { path: shot, contentType: 'image/png' }).catch(() => {});

    expect(fatalErrors, 'No JS pageerrors on /ssh?projectId=').toEqual([]);
  });

  test('add key → appears in UI → delete via UI → disappears', async ({ page, freshProjectId }, testInfo) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', e => fatalErrors.push(e.message));

    await page.goto('/ssh', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('[data-testid="button-back-to-account"]', { timeout: 20_000 });

    // Generate a test key pair for this run.
    const { publicKey: pubDer } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const rawPub = (pubDer as unknown as Buffer).slice(-32);
    const testPublicKey = buildOpensshPublicKey(rawPub);
    const expectedFingerprint = computeFingerprint(testPublicKey);

    // Add the key via API (page.request shares session cookies with the browser).
    const csrfRes = await page.request.get('/api/csrf-token');
    const csrfBody = await csrfRes.json().catch(() => null);
    const csrf = csrfBody?.csrfToken ?? '';

    const addRes = await page.request.post('/api/ssh-keys', {
      data: { label: 'playwright-e2e-key', publicKey: testPublicKey },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(addRes.ok(), `POST /api/ssh-keys should succeed (got ${addRes.status()})`).toBeTruthy();
    const addBody = await addRes.json();
    const keyId = addBody.id as string;
    expect(keyId, 'Added key must have an id').toBeTruthy();
    expect(addBody.fingerprint, 'fingerprint must match SHA256 computation').toBe(expectedFingerprint);

    // Reload the page so React re-fetches the key list.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="button-back-to-account"]', { timeout: 20_000 });
    await page.waitForTimeout(1_000);

    // Key must appear in the list.
    const keyRow = page.locator(`[data-testid="ssh-key-fingerprint-${keyId}"]`);
    await expect(keyRow).toBeVisible({ timeout: 8_000 });
    const fingerprintText = await keyRow.textContent();
    expect(fingerprintText?.trim()).toBe(expectedFingerprint);

    // Delete via the UI: hover to reveal trash icon, click it.
    const keyCard = page.locator(`[data-testid="button-delete-ssh-key-${keyId}"]`);
    await keyCard.click({ timeout: 5_000 });

    // Confirm the deletion.
    const confirmBtn = page.locator(`[data-testid="button-confirm-delete-ssh-key-${keyId}"]`);
    await confirmBtn.click({ timeout: 5_000 });

    // Key must disappear from the list.
    await expect(keyRow).not.toBeVisible({ timeout: 8_000 });

    const shot = path.join(SHOTS, 'ssh-key-lifecycle.png');
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    await testInfo.attach('ssh-key-lifecycle.png', { path: shot, contentType: 'image/png' }).catch(() => {});

    expect(fatalErrors, 'No JS pageerrors during key lifecycle').toEqual([]);
  });

  test('agent tool endpoints: list → add → revoke', async ({ page }, testInfo) => {
    // Pure API-level smoke test for the AI agent tool endpoints, run in the same
    // authenticated browser context so we inherit the session cookie.

    const csrfRes = await page.request.get('/api/csrf-token');
    const csrf = (await csrfRes.json().catch(() => null))?.csrfToken ?? '';
    const headers = csrf ? { 'x-csrf-token': csrf } : {};

    // list
    const listRes = await page.request.get('/api/ssh-keys/agent/list');
    expect(listRes.ok(), 'GET /api/ssh-keys/agent/list must return 200').toBeTruthy();
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.keys), 'agent/list must return {keys:[]}').toBeTruthy();

    // add
    const { publicKey: pubDer2 } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const raw2 = (pubDer2 as unknown as Buffer).slice(-32);
    const agentKey = buildOpensshPublicKey(raw2);

    const addRes = await page.request.post('/api/ssh-keys/agent/add', {
      data: { label: 'playwright-agent-key', publicKey: agentKey },
      headers,
    });
    expect(addRes.status(), 'POST /api/ssh-keys/agent/add must return 201').toBe(201);
    const addBody = await addRes.json();
    const agentKeyId = addBody.id;
    expect(agentKeyId, 'agent add must return an id').toBeTruthy();
    expect(addBody.lastUsed, 'agent add must include lastUsed field').toBeNull();

    // revoke
    const revokeRes = await page.request.delete(`/api/ssh-keys/agent/revoke/${agentKeyId}`, { headers });
    expect(revokeRes.ok(), 'DELETE /api/ssh-keys/agent/revoke/:id must succeed').toBeTruthy();

    // verify gone from list
    const list2Res = await page.request.get('/api/ssh-keys/agent/list');
    const list2Body = await list2Res.json();
    const stillPresent = (list2Body.keys as any[]).some((k: any) => k.id === agentKeyId);
    expect(stillPresent, 'Revoked key must not appear in list').toBeFalsy();
  });
});
