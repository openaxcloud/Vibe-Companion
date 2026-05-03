import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
    launchOptions: {
      // In CI we rely on Playwright's bundled Chromium (installed via
      // `npx playwright install`). On Replit we use the Nix-provided
      // chromium binary. Set CHROMIUM_PATH to override; set
      // PLAYWRIGHT_USE_BUNDLED=1 to skip executablePath entirely.
      ...(process.env.PLAYWRIGHT_USE_BUNDLED
        ? {}
        : {
            executablePath:
              process.env.CHROMIUM_PATH ||
              '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
          }),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5000,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
