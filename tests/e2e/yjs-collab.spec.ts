/**
 * Playwright E2E spec: Y.js real-time collaboration over /ws/collab.
 *
 * Two browser contexts open the same project simultaneously.
 * Context A types a sentinel string; context B must receive it within 5 s
 * via the Y.js CRDT pipeline wired by the central WebSocket upgrade dispatcher.
 *
 * ── KNOWN BUG FOUND DURING AUTHORING ────────────────────────────────────────
 * server/collaboration.ts uses `projectConnections: Map<projectId, Map<userId, conn>>`
 * — one entry per userId per project. When two contexts authenticate as the
 * SAME user, the second `addCollaborator` call overwrites the first WebSocket.
 * `broadcastBinaryToCollaborators` then skips every entry whose uid matches the
 * sender, which is ALL entries for a shared admin account. Result: updates from
 * context A are applied to the server-side Y.Doc but never forwarded to context B.
 *
 * Fix: key the map on WebSocket connection (or a per-tab session token) rather
 * than userId. See server/collaboration.ts:addCollaborator (lines 176-181).
 *
 * The sync assertion below is therefore expected to FAIL when both contexts use
 * the same user (default admin). Supply E2E_COLLAB_EMAIL + E2E_COLLAB_PASSWORD
 * pointing at a different user to get a passing run.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run:
 *   BASE_URL=http://localhost:5099 npx playwright test \
 *     --config=playwright.audit.config.ts --grep yjs
 */

import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect, login, getOrCreateProject, ADMIN_EMAIL, ADMIN_PASSWORD } from './fixtures';

// Second collaborator credentials — falls back to admin if not set (exposes the bug).
const COLLAB_EMAIL    = process.env.E2E_COLLAB_EMAIL    ?? ADMIN_EMAIL;
const COLLAB_PASSWORD = process.env.E2E_COLLAB_PASSWORD ?? ADMIN_PASSWORD;
const SAME_USER       = COLLAB_EMAIL === ADMIN_EMAIL;

const IDE_LOAD_MS    = 14_000;
const COLLAB_SYNC_MS =  5_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to a project IDE, dismiss cookie banners, wait for the unified
 * layout to mount.  Tries both /project/:id and /ide/:id in case routing
 * differs between deployments.
 */
async function openIDE(page: Page, projectId: string): Promise<void> {
  for (const url of [`/project/${projectId}`, `/ide/${projectId}`]) {
    const resp = await page
      .goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      .catch(() => null);
    if (resp && resp.status() < 500) break;
  }

  const consent = await page.$('button:has-text("Decline"), button:has-text("Refuser")');
  if (consent) await consent.click().catch(() => {});

  await page
    .waitForSelector('[data-ide-layout="unified"]', { timeout: IDE_LOAD_MS })
    .catch(() => {});

  // Extra settle time for WebSocket connections and React hydration.
  await page.waitForLoadState('networkidle', { timeout: IDE_LOAD_MS }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/**
 * Open the Files panel and click on index.js (the default file for a
 * JavaScript project).  Falls back to the first visible file button if
 * index.js cannot be found.
 */
async function openIndexJs(page: Page): Promise<void> {
  // Reveal the file panel.
  const trigger = await page.$(
    '[data-testid="activity-files"], button[title="Files"]',
  );
  if (trigger) await trigger.click().catch(() => {});
  await page.waitForTimeout(1_000);

  // Try the explicit filename first.
  const indexJs = page.locator(
    '[data-testid="desktop-left-panel"] button, [data-testid="desktop-left-panel"] [role="button"]',
  ).filter({ hasText: /^index\.js$/i });

  const count = await indexJs.count();
  if (count > 0) {
    await indexJs.first().click();
  } else {
    // Fallback: click the first non-folder button in the file tree.
    const anyFile = page.locator(
      '[data-testid="desktop-left-panel"] button',
    ).first();
    await anyFile.click().catch(() => {});
  }

  // Wait for the editor to become visible.
  await page.waitForSelector(
    '[data-testid="code-editor"], [data-testid="editor-codemirror-wrapper"], .cm-editor',
    { timeout: 8_000 },
  ).catch(() => {});
  await page.waitForTimeout(1_500);
}

/**
 * Locate the CodeMirror contenteditable area and type `text` into it,
 * replacing whatever is already there.
 */
async function typeInEditor(page: Page, text: string): Promise<void> {
  const content = page.locator('.cm-content').first();
  await content.click({ timeout: 5_000 });
  // Select all existing content so we start from a clean slate.
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text, { delay: 30 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('yjs collab', () => {
  // Force desktop viewport so the full IDE layout renders.
  test.use({ viewport: { width: 1280, height: 800 } });

  /**
   * Health-check: verify the central dispatcher routes /ws/collab correctly.
   *
   * An authenticated WebSocket to /ws/collab?projectId=X must open (101 upgrade).
   * If it fails, the dispatcher lost the handler — likely a regression of the
   * fix introduced around commit 545becb3.
   */
  test('dispatcher /ws/collab is wired (yjs health)', async ({ page, freshProjectId }) => {
    // Navigate first so the cookie jar is populated and the WS carries the session.
    await openIDE(page, freshProjectId);

    const didConnect = await page.evaluate(async (projectId: string) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(
          `${proto}//${location.host}/ws/collab?projectId=${projectId}`,
        );
        const timer = setTimeout(() => { ws.close(); resolve(false); }, 5_000);
        ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(true); };
        // onclose fires after onopen for a clean server-initiated close — still pass.
        ws.onerror = () => { clearTimeout(timer); resolve(false); };
      });
    }, freshProjectId);

    expect(
      didConnect,
      '[REGRESSION] /ws/collab WebSocket did not open.\n' +
      'The central upgrade dispatcher may have lost its /ws/collab handler.\n' +
      'Check server/routes/legacy-websocket.ts and server/websocket/central-upgrade-dispatcher.ts.',
    ).toBe(true);
  });

  /**
   * Real-time edit propagation test.
   *
   * Context A types a sentinel string in the CodeMirror editor.
   * Context B must see it in its own editor within COLLAB_SYNC_MS.
   *
   * When COLLAB_EMAIL === ADMIN_EMAIL (default), this test reveals the
   * single-WS-per-userId bug described in the file header — the sync assertion
   * will fail.  Set E2E_COLLAB_EMAIL to a different user to get a passing run.
   */
  test('edit in context A propagates to context B within 5s (yjs sync)', async ({
    browser,
    freshProjectId,
  }) => {
    const sentinel = `__yjs_e2e_${Date.now()}__`;

    // ── Spin up two independent browser contexts ────────────────────────────
    const ctxA: BrowserContext = await browser.newContext();
    const ctxB: BrowserContext = await browser.newContext();
    const pageA: Page = await ctxA.newPage();
    const pageB: Page = await ctxB.newPage();

    // Collect JS errors from both windows to fail loud on regressions.
    const errorsA: string[] = [];
    const errorsB: string[] = [];
    pageA.on('pageerror', e => errorsA.push(e.message));
    pageB.on('pageerror', e => errorsB.push(e.message));

    try {
      // ── Authenticate ──────────────────────────────────────────────────────
      await login(pageA, ADMIN_EMAIL, ADMIN_PASSWORD);
      await login(pageB, COLLAB_EMAIL, COLLAB_PASSWORD);

      if (SAME_USER) {
        console.warn(
          '[yjs-collab] WARNING: both contexts use the same user (' + ADMIN_EMAIL + ').\n' +
          'The server keys projectConnections by userId, so updates from context A are\n' +
          'NOT broadcast to context B.  Set E2E_COLLAB_EMAIL to a distinct user to fix.\n' +
          'This test is expected to fail on the sync assertion.',
        );
      }

      // ── Open IDE in both contexts ─────────────────────────────────────────
      await Promise.all([
        openIDE(pageA, freshProjectId),
        openIDE(pageB, freshProjectId),
      ]);

      // Verify no fatal JS errors during bootstrap.
      expect(errorsA, 'JS exceptions in context A during IDE load').toEqual([]);
      expect(errorsB, 'JS exceptions in context B during IDE load').toEqual([]);

      // ── Open index.js in both contexts ────────────────────────────────────
      await Promise.all([
        openIndexJs(pageA),
        openIndexJs(pageB),
      ]);

      // Allow Y.js sync step 0/1 handshake to complete on both sides.
      await pageA.waitForTimeout(2_000);
      await pageB.waitForTimeout(2_000);

      // ── Context A: type sentinel into the editor ──────────────────────────
      await typeInEditor(pageA, sentinel);

      // Brief pause for the Y.js update to reach the server.
      await pageA.waitForTimeout(500);

      // ── Context B: assert the sentinel text appears within 5 s ────────────
      //
      // NOTE: this assertion FAILS when SAME_USER === true due to the
      // broadcastBinaryToCollaborators bug (see file header).  That failure is
      // intentional and documents the bug.
      const editorB = pageB.locator('.cm-content').first();
      await expect(editorB).toContainText(sentinel, { timeout: COLLAB_SYNC_MS });

      // ── Bonus: cursor presence in context B ───────────────────────────────
      //
      // When context A's caret is live, y-codemirror.next renders a remote
      // cursor widget with class .cm-ySelectionInfo in context B's editor.
      // Only assertable when the Y.js sync actually worked.
      const remoteCursor = pageB.locator('.cm-ySelectionInfo, [class*="ySelectionInfo"]');
      // Soft check — absence of cursor is informational, not a hard failure, because
      // cursor rendering requires the awareness sub-protocol and a focused caret.
      const cursorCount = await remoteCursor.count();
      console.log(
        `[yjs-collab] Remote cursor widgets visible in context B: ${cursorCount}`,
      );

      // No fatal errors after the edit round-trip.
      expect(errorsA, 'JS exceptions in context A after edit').toEqual([]);
      expect(errorsB, 'JS exceptions in context B after sync').toEqual([]);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
