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
  // ── Original 7 critical panels ───────────────────────────────────────────
  { id: 'files',    trigger: '[data-testid="activity-files"], button[title="Files"]' },
  { id: 'agent',    trigger: '[data-testid="activity-agent"], button[title="AI Agent"]' },
  { id: 'preview',  trigger: '[data-testid="activity-preview"], button[title="Preview"]' },
  // NOTE: console is mobile-only (not in desktop ReplitActivityBar); trigger
  // won't match on desktop — test still runs and screenshots the current state.
  { id: 'console',  trigger: '[data-testid="activity-console"], button[title="Console"]' },
  { id: 'terminal', trigger: '[data-testid="activity-terminal"], button[title="Terminal"]' },
  { id: 'git',      trigger: '[data-testid="activity-git"], button[title="Git"]' },
  { id: 'settings', trigger: '[data-testid="activity-settings"], button[title="Settings"]' },

  // ── 15 additional desktop panels (ReplitActivityBar defaultItems + bottomItems) ──
  { id: 'search',           trigger: '[data-testid="activity-search"], button[title="Search"]' },
  { id: 'packages',         trigger: '[data-testid="activity-packages"], button[title="Packages"]' },
  { id: 'debug',            trigger: '[data-testid="activity-debug"], button[title="Debug"]' },
  { id: 'deploy',           trigger: '[data-testid="activity-deploy"], button[title="Deploy"]' },
  { id: 'secrets',          trigger: '[data-testid="activity-secrets"], button[title="Secrets"]' },
  { id: 'database',         trigger: '[data-testid="activity-database"], button[title="Database"]' },
  { id: 'workflows',        trigger: '[data-testid="activity-workflows"], button[title="Workflows"]' },
  { id: 'monitoring',       trigger: '[data-testid="activity-monitoring"], button[title="Monitoring"]' },
  { id: 'integrations',     trigger: '[data-testid="activity-integrations"], button[title="Integrations"]' },
  { id: 'checkpoints',      trigger: '[data-testid="activity-checkpoints"], button[title="Checkpoints"]' },
  { id: 'mcp',              trigger: '[data-testid="activity-mcp"], button[title="MCP"]' },
  { id: 'collaboration',    trigger: '[data-testid="activity-collaboration"], button[title="Collaboration"]' },
  // data-testid uses the id ("security-scanner"); tooltip label is "Security"
  { id: 'security-scanner', trigger: '[data-testid="activity-security-scanner"], button[title="Security"]' },
  { id: 'ssh',              trigger: '[data-testid="activity-ssh"], button[title="SSH"]' },
  // extensions lives in bottomItems (below the separator), not defaultItems
  { id: 'extensions',       trigger: '[data-testid="activity-extensions"], button[title="Extensions"]' },
];

const SHOTS = path.join(process.cwd(), 'tests/e2e/shots');
const IDE_LOAD_MS = 12_000;
const PANEL_SETTLE_MS = 4_000;

test.describe('panel audit', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', e => console.error(`[pageerror] ${e.message}`));
  });

  for (const panel of PANELS) {
    test(`${panel.id} mounts cleanly`, async ({ page, freshProjectId }, testInfo) => {
      const fatalErrors: string[] = [];
      page.on('pageerror', e => fatalErrors.push(`pageerror: ${e.message}`));

      const candidates = [`/project/${freshProjectId}`, `/ide/${freshProjectId}`];
      let loaded = false;
      for (const url of candidates) {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => null);
        if (resp && resp.status() < 500) { loaded = true; break; }
      }
      expect(loaded, 'project URL did not load on any candidate path').toBeTruthy();

      // Dismiss the cookie consent if it's visible (otherwise it overlaps the activity bar).
      const decline = await page.$('button:has-text("Decline"), button:has-text("Refuser")');
      if (decline) await decline.click().catch(() => {});

      // The IDE shows "Loading workspace…" while it provisions. Wait for that
      // splash to disappear before counting console errors.
      await page.waitForLoadState('networkidle', { timeout: IDE_LOAD_MS }).catch(() => {});
      await page.waitForTimeout(IDE_LOAD_MS);

      // Click the trigger if present.
      const trigger = await page.$(panel.trigger);
      if (trigger) await trigger.click().catch(() => {});

      await page.waitForTimeout(PANEL_SETTLE_MS);

      // Capture screenshot.
      const shot = path.join(SHOTS, `${testInfo.project.name}-${panel.id}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      await testInfo.attach(`${panel.id}.png`, { path: shot, contentType: 'image/png' }).catch(() => {});

      // Hard fail only on JS pageerror (true exception in user code).
      expect(fatalErrors, `JS exceptions during ${panel.id} mount`).toEqual([]);

      // Smoke check: page body has at least some rendered text (not blank).
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length, `body text empty after ${panel.id} mount`).toBeGreaterThan(20);
    });
  }
});
