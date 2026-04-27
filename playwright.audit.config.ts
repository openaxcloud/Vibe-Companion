/**
 * Playwright config for the panel audit suite.
 *
 * Three viewports cover the layouts the IDE renders separately
 * (UnifiedIDELayout.tsx has distinct desktop/tablet/mobile branches).
 *
 * BASE_URL points at the dev server. Start it manually with
 * `npm run dev` (PORT=5099 recommended) before running specs.
 *
 * This is kept separate from the existing playwright.config.ts so we
 * don't disturb the legacy CHROMIUM_PATH / port-5000 wiring used by
 * background-testing-service.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname_compat = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  // global-setup pre-warms the Vite dev-server module graph so each
  // spec hits cached chunks. Without it the first 4 specs hit a 30-
  // 40s cold-load and timed out while terminal/git/settings passed.
  globalSetup: path.join(__dirname_compat, 'tests/e2e/global-setup.ts'),
  // 180s per test: 90s mount + 4s settle + screenshot + login
  // round-trip, plus a margin for slow runs.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5099',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { ...devices['iPad Pro'], viewport: { width: 1024, height: 1366 } } },
    { name: 'mobile', use: { ...devices['iPhone 14 Pro'], viewport: { width: 390, height: 844 } } },
  ],
});
