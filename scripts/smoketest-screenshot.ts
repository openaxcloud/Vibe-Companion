/**
 * Mounts the smoketest-generated todo app in a temp Vite project,
 * boots it headless, navigates with Playwright, and saves a screenshot
 * to docs/demo-screenshot.png.
 *
 * Usage:
 *   MODEL=claude-opus-4-7 npx tsx scripts/smoketest-screenshot.ts
 */

import 'dotenv/config';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const MODEL = process.env.MODEL || 'claude-opus-4-7';
const SRC = `/tmp/e-code-smoketest/${MODEL}/files`;
const TARGET = '/tmp/e-code-smoketest-app';

if (!existsSync(SRC)) {
  console.error(`[screenshot] no smoketest output at ${SRC} — run smoketest-generation.ts first`);
  process.exit(1);
}

console.log(`[screenshot] mounting ${SRC} → ${TARGET}`);
execSync(`rm -rf ${TARGET}`);
mkdirSync(TARGET, { recursive: true });
cpSync(SRC, TARGET, { recursive: true });

// Make sure package.json has a dev script
const pkgPath = join(TARGET, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  // Always force port 5174 + strict so we don't collide with the IDE on 5173.
  pkg.scripts.dev = 'vite --port 5174 --strictPort --host 0.0.0.0';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
} else {
  console.error('[screenshot] no package.json in generated app — cannot run');
  process.exit(1);
}

console.log('[screenshot] npm install (this may take a moment)…');
try {
  execSync('npm install --no-audit --no-fund --silent', { cwd: TARGET, stdio: 'inherit', timeout: 180_000 });
} catch (e) {
  console.error('[screenshot] npm install failed; continuing anyway in case it partial-succeeded');
}

console.log('[screenshot] booting Vite dev server on :5174…');
const dev = spawn('npm', ['run', 'dev'], { cwd: TARGET, env: process.env });
let viteOutput = '';
dev.stdout.on('data', d => { viteOutput += d.toString(); process.stdout.write(`[vite] ${d}`); });
dev.stderr.on('data', d => { viteOutput += d.toString(); process.stderr.write(`[vite!] ${d}`); });

// Wait for the server to be reachable (max 30s).
const started = Date.now();
while (Date.now() - started < 30_000) {
  try {
    const res = await fetch('http://localhost:5174/');
    if (res.ok) break;
  } catch {}
  await new Promise(r => setTimeout(r, 500));
}

console.log('[screenshot] launching Playwright…');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

let success = false;
try {
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15_000 });
  await page.waitForTimeout(1500); // let entry animations settle
  await page.screenshot({ path: 'docs/demo-screenshot.png', fullPage: true });
  console.log('[screenshot] saved docs/demo-screenshot.png (light mode)');

  // Try to flip dark mode if a toggle exists.
  const toggle = await page.$('[data-testid*="theme"], button:has-text("Dark"), button:has-text("Light"), [aria-label*="theme" i], [aria-label*="dark" i]');
  if (toggle) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/demo-screenshot-dark.png', fullPage: true });
    console.log('[screenshot] saved docs/demo-screenshot-dark.png');
  }
  success = true;
} catch (e: any) {
  console.error(`[screenshot] error: ${e.message}`);
  // Save the failure page for debugging
  try { await page.screenshot({ path: 'docs/demo-screenshot.png', fullPage: true }); } catch {}
}

await browser.close();
dev.kill('SIGTERM');
setTimeout(() => dev.kill('SIGKILL'), 2000);

process.exit(success ? 0 : 1);
