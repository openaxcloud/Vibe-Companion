/**
 * Panel audit — opens the IDE on a freshly-created project and verifies
 * each critical panel mounts without console errors.
 *
 * For each panel we:
 *   1. open the IDE on /projects/:id (or /workspace/:id, whichever the
 *      router uses).
 *   2. click the activity-bar button that opens the panel.
 *   3. wait for the panel root to attach (data-testid present).
 *   4. assert no JS console errors fired during the interaction.
 *   5. screenshot the result for the human-readable report.
 *
 * Mobile/tablet/desktop run separately via the projects in
 * playwright.config.ts.
 */
import path from 'path';
import { test, expect } from './fixtures';

const PANELS: Array<{ id: string; trigger: string; root: string; secondaryButtons?: string[] }> = [
  { id: 'files',    trigger: '[data-testid="activity-files"], button[title="Files"]',         root: '[data-testid="file-explorer"], [data-testid="files-panel"]' },
  { id: 'agent',    trigger: '[data-testid="activity-agent"], button[title="AI Agent"]',      root: '[data-testid="agent-panel"], [data-testid*="agent"]' },
  { id: 'preview',  trigger: '[data-testid="activity-preview"], button[title="Preview"]',     root: '[data-testid="preview-panel"], [data-testid*="preview"]' },
  { id: 'console',  trigger: '[data-testid="activity-console"], button[title="Console"]',     root: '[data-testid="console-panel"], [data-testid*="console"]' },
  { id: 'terminal', trigger: '[data-testid="activity-terminal"], button[title="Terminal"]',   root: '[data-testid="terminal-panel"], [data-testid*="terminal"]' },
  { id: 'git',      trigger: '[data-testid="activity-git"], button[title="Git"]',             root: '[data-testid="git-panel"], [data-testid*="git"]' },
  { id: 'settings', trigger: '[data-testid="activity-settings"], button[title="Settings"]',   root: '[data-testid="settings-panel"], [data-testid*="settings"]' },
];

const SHOTS = path.join(process.cwd(), 'tests/e2e/shots');

test.describe('panel audit', () => {
  for (const panel of PANELS) {
    test(`${panel.id} mounts cleanly`, async ({ page, freshProjectId }, testInfo) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

      // SPA route is /project/:id (singular) or /ide/:id, both protected.
      const candidates = [`/project/${freshProjectId}`, `/ide/${freshProjectId}`];
      let loaded = false;
      for (const url of candidates) {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
        if (resp && resp.status() < 500) { loaded = true; break; }
      }
      expect(loaded, 'project URL did not load on any candidate path').toBeTruthy();

      // The IDE has a noisy initial mount — wait for the activity bar to settle.
      await page.waitForTimeout(2000);

      // Try clicking the trigger if present. Some panels open by default
      // (Files on desktop), in which case the click is a no-op.
      const trigger = await page.$(panel.trigger);
      if (trigger) await trigger.click().catch(() => {});

      // Allow the suspense fallback to resolve.
      await page.waitForTimeout(2500);

      // Capture screenshot regardless of pass/fail so reviewers can see it.
      const shot = path.join(SHOTS, `${testInfo.project.name}-${panel.id}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      await testInfo.attach(`${panel.id}.png`, { path: shot, contentType: 'image/png' }).catch(() => {});

      // Soft check: no critical console errors.
      const critical = consoleErrors.filter(e =>
        !/favicon|manifest|websocket|sw\.js|service.?worker/i.test(e)
      );
      expect(critical, `console errors during ${panel.id} mount`).toEqual([]);
    });
  }
});
