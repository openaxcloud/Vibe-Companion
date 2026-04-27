import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5099';
const EMAIL = 'admin@test.com';
const PASS  = 'e2e-admin-password';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleMsgs = [];
const failures = [];
const responses = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => failures.push(`pageerror: ${e.message}\n${e.stack||''}`));
page.on('requestfailed', r => failures.push(`reqfail ${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => {
  const u = r.url();
  if (!u.startsWith(BASE)) return;
  responses.push(`${r.status()} ${r.request().method()} ${u.replace(BASE,'')}`);
});

const csrfRes = await page.request.get(`${BASE}/api/csrf-token`);
const csrf = (await csrfRes.json().catch(()=>null))?.csrfToken;
const lr = await page.request.post(`${BASE}/api/auth/login`, {
  data: { email: EMAIL, password: PASS },
  headers: csrf ? { 'x-csrf-token': csrf } : {},
});
console.log('login:', lr.status());

const list = await page.request.get(`${BASE}/api/projects`);
const arr  = await list.json();
const pid  = arr[0].id;
console.log('using project id:', pid);

await page.goto(`${BASE}/project/${pid}`, { waitUntil: 'commit', timeout: 30000 });
console.log('after goto (commit): readyState=', await page.evaluate(() => document.readyState));

const t0 = Date.now();
let mounted = false;
let lastRootSize = 0;
while (Date.now() - t0 < 60000) {
  const rootSize = await page.evaluate(() => (document.getElementById('root')?.innerHTML || '').length);
  if (rootSize !== lastRootSize) {
    console.log(`t+${Date.now()-t0}ms rootHtml=${rootSize}b`);
    lastRootSize = rootSize;
  }
  mounted = await page.$('[data-ide-layout="unified"]') !== null;
  if (mounted) break;
  await page.waitForTimeout(500);
}
console.log(`mounted=${mounted} after ${Date.now()-t0}ms`);

const snapshot = await page.evaluate(() => ({
  rootHtml: (document.getElementById('root')?.innerHTML || '').slice(0, 6000),
  bodyClasses: document.body.className,
  loadingText: document.body.innerText.match(/Loading[^\n]{0,80}/)?.[0],
  url: location.href,
}));
console.log('--- DOM snapshot ---');
console.log('url:', snapshot.url);
console.log('bodyClasses:', snapshot.bodyClasses);
console.log('loadingText:', snapshot.loadingText);
console.log('rootHtml (first 6kb):');
console.log(snapshot.rootHtml || '(EMPTY)');

console.log('\n--- ALL responses (last 60) ---');
for (const r of responses.slice(-60)) console.log(' ', r);

console.log('\n--- console (last 80) ---');
for (const c of consoleMsgs.slice(-80)) console.log(' ', c.slice(0, 350));

console.log('\n--- failures ---');
for (const f of failures) console.log(' ', f.slice(0, 600));

await page.screenshot({ path: '/tmp/splash-diagnostic.png' });
console.log('\nscreenshot: /tmp/splash-diagnostic.png');
await browser.close();
