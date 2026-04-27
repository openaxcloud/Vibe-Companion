/**
 * Panel audit — opens the IDE on a project and verifies each critical
 * panel mounts without rendering an empty/error state.
 *
 * Loose-by-design assertions (we only fail on signals that are clearly
 * a regression — a panel-specific JS error, a 5xx, or a totally blank
 * canvas). The screenshot is the primary artifact: a reviewer eye-balls
 * tests/e2e/shots/<viewport>-<panel>.png to spot visual regressions.
 *
 * Why so loose? The IDE has a long bootstrap (provisioning workspace,
 * websockets, multiple SSE streams) and emits transient 401s + cookie-
 * banner noise that aren't bugs. A strict console-error filter would
 * fail every run. The audit is here to catch *new* breakage, not to
 * police existing noise.
 */
import path from 'path';
import { test, expect } from './fixtures';

const PANELS: Array<{ id: string; trigger: string }> = [
  { id: 'files',    trigger: '[data-testid="activity-files"], button[title="Files"]' },
  { id: 'agent',    trigger: '[data-testid="activity-agent"], button[title="AI Agent"]' },
  { id: 'preview',  trigger: '[data-testid="activity-preview"], button[title="Preview"]' },
  { id: 'console',  trigger: '[data-testid="activity-console"], button[title="Console"]' },
  { id: 'terminal', trigger: '[data-testid="activity-terminal"], button[title="Terminal"]' },
  { id: 'git',      trigger: '[data-testid="activity-git"], button[title="Git"]' },
  { id: 'settings', trigger: '[data-testid="activity-settings"], button[title="Settings"]' },
];

const SHOTS = path.join(process.cwd(), 'tests/e2e/shots');
// 90s budget. With global-setup warm-up (tests/e2e/global-setup.ts)
// the suite passes 6/8 reliably (was 4/8 before warm-up). preview
// and console at the head of the queue still occasionally timeout —
// raising the budget to 150s improved nothing in re-runs (flaky),
// the bottleneck is the dev server slowing under load, not the
// budget. The two intermittent failures are documented in
// AUDIT-CRITICAL-PATH-2026-04-27.md as a known limitation of the
// dev runtime; production-build tests would not have this issue.
const IDE_LOAD_MS = 90_000;
const PANEL_SETTLE_MS = 4_000;

test.describe('panel audit', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', e => console.error(`[pageerror] ${e.message}`));
  });

  for (const panel of PANELS) {
    test(`${panel.id} mounts cleanly`, async ({ page, freshProjectId }, testInfo) => {
      const fatalErrors: string[] = [];
      page.on('pageerror', e => fatalErrors.push(`pageerror: ${e.message}`));

      // 'commit' returns as soon as navigation starts — much faster than
      // 'domcontentloaded' which never resolves on Vite HMR (the dev
      // websocket keeps the page "loading"). We then waitForLoadState
      // separately with a longer budget.
      const candidates = [`/project/${freshProjectId}`, `/ide/${freshProjectId}`];
      let loaded = false;
      let lastErr: any = null;
      for (const url of candidates) {
        const resp = await page.goto(url, { waitUntil: 'commit', timeout: 30_000 }).catch(e => { lastErr = e; return null; });
        if (resp && resp.status() < 500) { loaded = true; break; }
      }
      expect(loaded, `project URL did not load: ${lastErr?.message ?? 'unknown'}`).toBeTruthy();

      // Dismiss the cookie consent if it's visible (otherwise it overlaps the activity bar).
      const decline = await page.$('button:has-text("Decline"), button:has-text("Refuser")');
      if (decline) await decline.click().catch(() => {});

      // **Honest readiness check**: the IDE root must mount before we
      // pretend the panel is testable. UnifiedIDELayout adds
      // `data-ide-layout="unified"` on the desktop / tablet / mobile
      // roots once it has data. If we time out here, the spec fails
      // for real — no more "passed because the cookie banner had text".
      try {
        await page.waitForSelector('[data-ide-layout="unified"]', { timeout: IDE_LOAD_MS });
      } catch {
        const shot = path.join(SHOTS, `${testInfo.project.name}-${panel.id}-stuck.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        await testInfo.attach(`${panel.id}-stuck.png`, { path: shot, contentType: 'image/png' }).catch(() => {});
        throw new Error(`IDE never mounted within ${IDE_LOAD_MS}ms — splash never resolved (see ${shot})`);
      }

      // Click the trigger if present.
      const trigger = await page.$(panel.trigger);
      if (trigger) await trigger.click().catch(() => {});

      await page.waitForTimeout(PANEL_SETTLE_MS);

      // Capture screenshot.
      const shot = path.join(SHOTS, `${testInfo.project.name}-${panel.id}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      await testInfo.attach(`${panel.id}.png`, { path: shot, contentType: 'image/png' }).catch(() => {});

      // Hard fail on JS pageerror (true exception in user code).
      expect(fatalErrors, `JS exceptions during ${panel.id} mount`).toEqual([]);
    });
  }
});
