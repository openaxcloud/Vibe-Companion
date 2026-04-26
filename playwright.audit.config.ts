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

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
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
