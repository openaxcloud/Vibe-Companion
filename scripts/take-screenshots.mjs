import puppeteer from 'puppeteer-core';

const APP_URL = `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
const CHROME_PATH = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
const OUTPUT_DIR = '/home/runner/workspace/client/public/docs-images';
console.log('Using URL:', APP_URL);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
    defaultViewport: { width: 1400, height: 900 },
  });

  try {
    const page = await browser.newPage();
    
    // Dismiss cookie consent
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('cookieConsent', 'accepted');
    });

    // Navigate to app first
    console.log('Loading app...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Login via fetch in browser context (cookies will be set properly over HTTPS)
    const screenshotEmail = process.env.SCREENSHOT_EMAIL || 'docscreenshot@ecode.dev';
    const screenshotPassword = process.env.SCREENSHOT_PASSWORD || '';
    if (!screenshotPassword) {
      console.error('SCREENSHOT_PASSWORD env var is required');
      process.exit(1);
    }
    console.log('Logging in via browser fetch...');
    const loginResult = await page.evaluate(async (email, password) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          recaptchaToken: 'test'
        })
      });
      return { status: r.status, body: await r.text() };
    }, screenshotEmail, screenshotPassword);
    console.log('Login:', loginResult.status);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Verify auth
    const authCheck = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return { status: r.status, body: await r.text() };
    });
    console.log('Auth check:', authCheck.status, authCheck.body.substring(0, 80));
    
    const isAuthenticated = authCheck.status === 200;

    async function screenshot(name, url, waitTime = 3000) {
      console.log(`Taking ${name}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, waitTime));
      try {
        const btn = await page.$('[data-testid="button-accept-cookies"]');
        if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 500)); }
      } catch (e) {}
      await page.screenshot({ path: `${OUTPUT_DIR}/${name}.png`, type: 'png' });
      console.log(`  -> ${name}.png`);
    }

    // Take all screenshots
    await screenshot('landing', APP_URL);
    await screenshot('pricing', `${APP_URL}/pricing`);
    await screenshot('mcp-directory', `${APP_URL}/mcp-directory`);
    
    if (isAuthenticated) {
      await screenshot('dashboard', `${APP_URL}/dashboard`, 4000);
      await screenshot('settings', `${APP_URL}/settings`);
      await screenshot('themes', `${APP_URL}/themes`);
      await screenshot('frameworks', `${APP_URL}/frameworks`);
      await screenshot('community', `${APP_URL}/community`);
      await screenshot('help-center', `${APP_URL}/help`);
      
      // IDE project
      const projects = await page.evaluate(async () => {
        try { const r = await fetch('/api/projects'); if (r.ok) return await r.json(); } catch(e) {}
        return [];
      });
      console.log('Projects:', projects?.length || 0);
      
      if (Array.isArray(projects) && projects.length > 0) {
        await screenshot('ide', `${APP_URL}/project/${projects[0].id}`, 5000);
      } else {
        const csrfRes = await page.evaluate(async () => {
          const r = await fetch('/api/csrf-token'); return r.ok ? await r.json() : null;
        });
        if (csrfRes?.csrfToken) {
          const cr = await page.evaluate(async (token) => {
            const r = await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
              credentials: 'include',
              body: JSON.stringify({ name: 'my-portfolio', language: 'TypeScript', description: 'Portfolio website' })
            });
            return { status: r.status, body: await r.text() };
          }, csrfRes.csrfToken);
          console.log('Create project:', cr.status);
          if (cr.status >= 200 && cr.status < 300) {
            const proj = JSON.parse(cr.body);
            await screenshot('ide', `${APP_URL}/project/${proj.id}`, 5000);
          }
        }
      }
    } else {
      console.log('Not authenticated - only taking public page screenshots');
    }

    // Login page screenshot (unauthenticated)
    const page2 = await browser.newPage();
    await page2.evaluateOnNewDocument(() => { localStorage.setItem('cookieConsent', 'accepted'); });
    await page2.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page2.screenshot({ path: `${OUTPUT_DIR}/login.png`, type: 'png' });
    console.log('  -> login.png');

    console.log('\nAll done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
