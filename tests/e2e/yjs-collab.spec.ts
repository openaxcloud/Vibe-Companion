/**
 * Y.js real-time collaboration E2E test.
 *
 * Verifies two things:
 *
 *   1. /ws/collab accepts authenticated WebSocket connections
 *      (regression-guard: if centralUpgradeDispatcher.initialize(server) is
 *      ever removed from server/index.ts this test will fail immediately with
 *      a clear diagnostic instead of a silent 1006 close-code at runtime).
 *
 *   2. An edit typed in browser context A propagates to context B within 5 s
 *      via the Y.js binary CRDT protocol (MSG_UPDATE path in
 *      server/routes/legacy-websocket.ts + server/collaboration.ts broadcast).
 *
 * ── BUGS FOUND DURING AUTHORING ─────────────────────────────────────────────
 *
 * BUG 1 — Same-user WS overwrite (server/collaboration.ts, lines ~176-200)
 *   `projectConnections` is keyed by `projectId → Map<userId, CollabConnection>`.
 *   When two browser contexts connect as the **same** user the second call to
 *   `addCollaborator` overwrites `existing.ws` with the new WebSocket.  The
 *   first context's socket is evicted from the map.
 *   `broadcastBinaryToCollaborators(projectId, excludeUserId, ...)` then skips
 *   every entry matching the sender's userId — which is ALL entries for a shared
 *   admin account.  Result: updates from context A are applied to the server
 *   Y.Doc but never forwarded to context B.
 *   Fix: key the inner map on WebSocket (or a per-tab token) instead of userId.
 *   Supply E2E_COLLAB_EMAIL + E2E_COLLAB_PASSWORD (a *different* user) to make
 *   the sync assertion pass.
 *
 * BUG 2 — Monaco engine discards ytext (ReplitMonacoEditor.tsx lines 90-112)
 *   The default editor engine (localStorage `editor-engine`) is `'monaco'`.
 *   The Monaco branch creates <MonacoCodeEditor> without a `ytext` prop, so
 *   Y.js CRDT changes are never injected into the Monaco editor.
 *   Real-time propagation therefore only works when `editor-engine=codemirror`.
 *   This spec forces CM6 mode via page.addInitScript so the test exercises the
 *   actual CRDT path.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run:
 *   BASE_URL=http://localhost:5099 npx playwright test \
 *     --config=playwright.audit.config.ts --grep yjs
 *
 * For a fully-passing run (avoids Bug 1), supply a distinct collaborator:
 *   E2E_COLLAB_EMAIL=collab@test.com E2E_COLLAB_PASSWORD=collab-pass \
 *   BASE_URL=http://localhost:5099 npx playwright test \
 *     --config=playwright.audit.config.ts --grep yjs
 */
import { type Page } from '@playwright/test';
import { test, expect } from './fixtures';

// ─── Constants ────────────────────────────────────────────────────────────────

const IDE_LOAD_MS = 90_000;
/** Unique token that must not appear in any existing project file. */
const EDIT_MARKER = `yjs_e2e_${Date.now()}`;

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-password';

// Second collaborator — falls back to admin to expose Bug 1.
const COLLAB_EMAIL = process.env.E2E_COLLAB_EMAIL ?? ADMIN_EMAIL;
const COLLAB_PASSWORD = process.env.E2E_COLLAB_PASSWORD ?? ADMIN_PASSWORD;
const SAME_USER = COLLAB_EMAIL === ADMIN_EMAIL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function csrfToken(page: Page): Promise<string | null> {
  const r = await page.request.get('/api/csrf-token');
  if (!r.ok()) return null;
  const b = await r.json().catch(() => null);
  return (b?.csrfToken ?? b?.token ?? null) as string | null;
}

async function loginPage(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
) {
  const csrf = await csrfToken(page);
  const r = await page.request.post('/api/auth/login', {
    data: { email, password },
    headers: csrf ? { 'x-csrf-token': csrf } : {},
  });
  expect(r.ok(), `login failed: ${r.status()} – ${await r.text()}`).toBeTruthy();
}

/**
 * Navigate to the project URL, force the CM6 editor engine so that `ytext`
 * is wired into the editor (Bug 2 workaround), and wait for the IDE root to
 * mount.
 */
async function mountIDEWithCM6(page: Page, projectId: string) {
  // addInitScript must be registered BEFORE goto; it runs on every fresh load.
  await page.addInitScript(() => {
    localStorage.setItem('editor-engine', 'codemirror');
  });

  const candidates = [`/project/${projectId}`, `/ide/${projectId}`];
  let loaded = false;
  for (const url of candidates) {
    const resp = await page
      .goto(url, { waitUntil: 'commit', timeout: 30_000 })
      .catch(() => null);
    if (resp && resp.status() < 500) {
      loaded = true;
      break;
    }
  }
  expect(loaded, 'project URL did not load').toBeTruthy();

  // Dismiss cookie / GDPR banner if visible.
  const decline = await page.$('button:has-text("Decline"), button:has-text("Refuser")');
  if (decline) await decline.click().catch(() => {});

  await page.waitForSelector('[data-ide-layout="unified"]', { timeout: IDE_LOAD_MS });
}

/**
 * Ensure the Files panel is open, click the named file, and wait for the
 * CM6 editor's contenteditable area to appear.
 */
async function openFileInSidebar(page: Page, fileName: string) {
  const filesBtn = await page.$(
    '[data-testid="activity-files"], button[title="Files"]',
  );
  if (filesBtn) await filesBtn.click().catch(() => {});
  await page.waitForTimeout(800);

  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .getByRole('button', { name: new RegExp(escaped) })
    .first()
    .click({ timeout: 8_000 });

  await page.waitForSelector('[data-testid="editor-codemirror-wrapper"]', {
    timeout: 10_000,
  });
  await page.waitForSelector('.cm-content', { timeout: 10_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('yjs collab', () => {
  // Ensure desktop layout so the full IDE renders (same viewport as panels.spec.ts).
  test.use({ viewport: { width: 1280, height: 800 } });

  // ── Step 0: /ws/collab dispatcher smoke-test ─────────────────────────────
  /**
   * Verify that the central upgrade dispatcher correctly routes
   * /ws/collab?projectId=X and that the collab handler returns a
   * `collab:joined` acknowledgement.
   *
   * Failure here means either:
   *   (a) the dev server is not running, OR
   *   (b) centralUpgradeDispatcher.initialize(server) was removed from
   *       server/index.ts (regression of commit 545becb3), OR
   *   (c) the /ws/collab branch in legacy-websocket.ts was deleted.
   */
  test('ws/collab endpoint accepts authenticated WS connection (yjs dispatcher)', async ({
    page,
    freshProjectId,
  }) => {
    // Navigate so that window.location is valid and the session cookie is
    // included in the WebSocket upgrade handshake.
    await page.goto(`/project/${freshProjectId}`, {
      waitUntil: 'commit',
      timeout: 30_000,
    });

    const result = await page.evaluate(async (projectId: string) => {
      return new Promise<{ ok: boolean; code?: number; reason?: string }>(
        (resolve) => {
          const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(
            `${proto}//${location.host}/ws/collab?projectId=${projectId}`,
          );
          ws.binaryType = 'arraybuffer';

          let done = false;
          const finish = (v: { ok: boolean; code?: number; reason?: string }) => {
            if (done) return;
            done = true;
            resolve(v);
          };

          const globalTimer = window.setTimeout(() => {
            ws.close();
            finish({ ok: false, reason: 'timeout after 5000 ms — server never upgraded the socket' });
          }, 5_000);

          ws.addEventListener('open', () => {
            // Mirror what use-collaboration.ts sends on open.
            ws.send(JSON.stringify({ type: 'collab:join' }));

            // Allow 3 s for the collab:joined acknowledgement.
            const joinTimer = window.setTimeout(() => {
              ws.close(1001, 'no joined msg');
              finish({
                ok: false,
                reason: 'WS opened but no collab:joined message received within 3 s',
              });
            }, 3_000);

            ws.addEventListener('message', (e) => {
              if (typeof e.data !== 'string') return;
              try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'collab:joined') {
                  window.clearTimeout(joinTimer);
                  window.clearTimeout(globalTimer);
                  ws.close(1000, 'test done');
                  finish({ ok: true });
                }
              } catch (_) {
                // binary frame or malformed JSON — skip
              }
            });
          });

          ws.addEventListener('close', (e) => {
            window.clearTimeout(globalTimer);
            if (e.code === 1000) return; // clean close we requested
            finish({
              ok: false,
              code: e.code,
              reason: `socket closed unexpectedly: code=${e.code} reason="${e.reason}"`,
            });
          });

          ws.addEventListener('error', () => {
            window.clearTimeout(globalTimer);
            finish({
              ok: false,
              reason: 'WebSocket error event (CORS issue or server not started?)',
            });
          });
        },
      );
    }, freshProjectId);

    expect(
      result.ok,
      `ws/collab handshake failed — ${result.reason ?? `close code=${result.code}`}\n\n` +
        'Checklist:\n' +
        '  1. Is the dev server running on BASE_URL?\n' +
        '  2. Is centralUpgradeDispatcher.initialize(server) called in server/index.ts?\n' +
        '  3. Is the /ws/collab branch present in server/routes/legacy-websocket.ts?',
    ).toBe(true);
  });

  // ── Steps 1-4: two-context real-time propagation ─────────────────────────
  /**
   * Opens the same project in two browser contexts.  Context A types a unique
   * marker; context B must see it within 5 s.
   *
   * DEFAULT OUTCOME (same admin user): FAILS on the `toContainText` assertion
   * due to Bug 1 (same-user WS overwrite in server/collaboration.ts).
   * Supply E2E_COLLAB_EMAIL + E2E_COLLAB_PASSWORD for a distinct second user
   * to get a passing run.
   */
  test('edit in context A propagates to context B within 5 s (yjs sync)', async ({
    browser,
    page,
    freshProjectId,
  }) => {
    if (SAME_USER) {
      console.warn(
        '[yjs-collab] Both contexts use the same admin user (' + ADMIN_EMAIL + ').\n' +
          'server/collaboration.ts keys projectConnections by userId, so the second\n' +
          "context overwrites the first WS entry and broadcastBinaryToCollaborators\n" +
          'skips ALL entries for that userId (the sender). Context A\'s updates will\n' +
          'never reach context B.\n' +
          'Set E2E_COLLAB_EMAIL to a different user to make this test pass.\n' +
          'The test will now run and the sync assertion is expected to FAIL — this\n' +
          'failure documents the bug.',
      );
    }

    // Discover the first editable file so both contexts open the same one.
    const filesResp = await page.request.get(
      `/api/projects/${freshProjectId}/files`,
    );
    const filesBody = await filesResp.json().catch(() => null);
    const allFiles: Array<{ name?: string; filename?: string; type?: string }> =
      Array.isArray(filesBody)
        ? filesBody
        : (filesBody?.files ?? filesBody?.children ?? []);
    const firstFile = allFiles.find(
      (f) => f.type !== 'directory' && f.type !== 'dir',
    );
    expect(
      firstFile,
      'project has no editable files — create at least one file before running this spec',
    ).toBeTruthy();
    const fileName = (firstFile!.name ?? firstFile!.filename) as string;

    // Collect fatal JS errors from both contexts.
    const errorsA: string[] = [];
    const errorsB: string[] = [];
    page.on('pageerror', (e) => errorsA.push(e.message));

    // ── Context A (fixture page, already authenticated as admin) ─────────────
    await mountIDEWithCM6(page, freshProjectId);
    await openFileInSidebar(page, fileName);

    // ── Context B (fresh browser context, authenticated as collaborator) ──────
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    pageB.on('pageerror', (e) => errorsB.push(e.message));

    try {
      await loginPage(pageB, COLLAB_EMAIL, COLLAB_PASSWORD);
      await mountIDEWithCM6(pageB, freshProjectId);
      await openFileInSidebar(pageB, fileName);

      // Both contexts must show the CM6 editor wrapper.
      await expect(
        page.locator('[data-testid="editor-codemirror-wrapper"]'),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        pageB.locator('[data-testid="editor-codemirror-wrapper"]'),
      ).toBeVisible({ timeout: 5_000 });

      // No fatal JS errors during IDE bootstrap.
      expect(errorsA, 'JS exceptions in context A during IDE load').toEqual([]);
      expect(errorsB, 'JS exceptions in context B during IDE load').toEqual([]);

      // Allow Y.js sync step-0/step-1 handshake to complete in both contexts.
      await page.waitForTimeout(2_000);

      // ── Type unique marker in context A ─────────────────────────────────
      const cmA = page.locator('.cm-content').first();
      await cmA.click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Control+Home');
      await page.keyboard.type(EDIT_MARKER);

      // ── Assert marker appears in context B within 5 s ────────────────────
      // NOTE: FAILS when SAME_USER === true (Bug 1 — see file header).
      await expect(pageB.locator('.cm-content').first()).toContainText(
        EDIT_MARKER,
        { timeout: 5_000 },
      );

      // ── Bonus: remote cursor decoration in context B ──────────────────────
      // y-codemirror.next renders .cm-ySelectionCaret / .cm-yCursor when a
      // remote collaborator's caret is in view.  Soft-assert only.
      const cursors = await pageB
        .locator('.cm-ySelectionCaret, .cm-yCursor, .cm-ySelectionInfo')
        .count()
        .catch(() => 0);
      console.log(
        `[yjs-collab] remote cursor decorations visible in context B: ${cursors}`,
      );
      if (cursors === 0) {
        console.warn(
          '[yjs-collab] No remote cursor decoration found — awareness update may not have arrived yet.',
        );
      }

      // No fatal errors after the round-trip.
      expect(errorsA, 'JS exceptions in context A after edit').toEqual([]);
      expect(errorsB, 'JS exceptions in context B after sync').toEqual([]);
    } finally {
      await ctxB.close();
    }
  });
});
