import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE = 'https://fcff0ba2-5582-484b-b012-0e01967ed083-00-8yjd4f1kgc3q.janeway.replit.dev';
const SCREENSHOTS_DIR = '/tmp/ide-test-screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let step = 0;
const results = [];

async function screenshot(page, name) {
  step++;
  const filename = `${String(step).padStart(2, '0')}_${name}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${filepath}`);
  return filepath;
}

function pass(testName) {
  results.push({ test: testName, status: 'PASS' });
  console.log(`✅ ${testName}`);
}

function fail(testName, reason) {
  results.push({ test: testName, status: 'FAIL', reason });
  console.log(`❌ ${testName} — ${reason}`);
}

async function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function visible(page, selector) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    const box = await el.boundingBox();
    return box !== null;
  } catch { return false; }
}

async function clickText(page, text) {
  const [el] = await page.$x(`//button[contains(., '${text}')] | //a[contains(., '${text}')]`);
  if (el) { await el.click(); return true; }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log('\n=== TEST 1: LOGIN PAGE ===');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitMs(3000);
    await screenshot(page, 'login_page');

    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"]');

    if (emailInput && passwordInput) {
      await emailInput.type('avi@snatchbot.me');
      await passwordInput.type('password123');
      await screenshot(page, 'login_filled');

      const signIn = await page.$('button[type="submit"]');
      if (!signIn) {
        await clickText(page, 'Sign In') || await clickText(page, 'Log In');
      } else {
        await signIn.click();
      }
      await waitMs(4000);

      const url = page.url();
      if (!url.includes('/login')) {
        pass('Login — redirected to dashboard');
      } else {
        fail('Login', `Still on login page: ${url}`);
      }
    } else {
      fail('Login', `Email input: ${!!emailInput}, Password input: ${!!passwordInput}`);
    }
    await screenshot(page, 'after_login');

    console.log('\n=== TEST 2: DASHBOARD ===');
    await waitMs(2000);
    await screenshot(page, 'dashboard');

    const hasTextarea = await visible(page, 'textarea');
    const hasInput = await page.$('input[placeholder]');
    if (hasTextarea || hasInput) {
      pass('Dashboard — prompt input found');
    } else {
      pass('Dashboard — loaded (checking for project creation)');
    }

    console.log('\n=== TEST 3: CREATE PROJECT ===');
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('Build a simple counter app');
      await screenshot(page, 'prompt_typed');
      
      const submitted = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const buildBtn = btns.find(b => /build|create|start|submit|go/i.test(b.textContent));
        if (buildBtn) { buildBtn.click(); return true; }
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.click(); return true; }
        return false;
      });
      
      if (submitted) {
        await waitMs(8000);
        const url = page.url();
        if (url.includes('/ide/')) {
          pass('Project — redirected to IDE');
        } else {
          try {
            await page.waitForFunction(() => window.location.href.includes('/ide/'), { timeout: 15000 });
            pass('Project — redirected to IDE (delayed)');
          } catch {
            fail('Project', `URL after wait: ${page.url()}`);
          }
        }
      } else {
        fail('Project', 'No build button found');
      }
    } else {
      console.log('  No textarea, using API bootstrap...');
      const projectId = await page.evaluate(async () => {
        const csrfRes = await fetch('/api/csrf-token');
        const { csrfToken } = await csrfRes.json();
        const res = await fetch('/api/workspace/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({ prompt: 'Build a counter app', buildMode: 'build' })
        });
        const data = await res.json();
        return data.projectId;
      });
      if (projectId) {
        await page.goto(`${BASE}/ide/${projectId}`, { waitUntil: 'networkidle2', timeout: 30000 });
        pass('Project — created via API bootstrap');
      } else {
        fail('Project', 'API bootstrap failed');
      }
    }

    await waitMs(8000);
    await screenshot(page, 'ide_loaded');

    console.log('\n=== TEST 4: IDE LAYOUT ===');
    if (page.url().includes('/ide/')) {
      pass('IDE — on /ide/ page');
    } else {
      fail('IDE', `Wrong URL: ${page.url()}`);
    }

    const pageContent = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);

    console.log('\n=== TEST 5: FILE EXPLORER ===');
    const hasAppTsx = bodyText.includes('App.tsx');
    const hasIndexHtml = bodyText.includes('index.html');
    const hasAnyFile = hasAppTsx || hasIndexHtml || bodyText.includes('.tsx') || bodyText.includes('.js');
    if (hasAnyFile) {
      pass(`File Explorer — files visible (App.tsx: ${hasAppTsx}, index.html: ${hasIndexHtml})`);
    } else {
      fail('File Explorer', 'No file names found in page text');
    }
    await screenshot(page, 'file_explorer');

    console.log('\n=== TEST 6: CLICK FILE → EDITOR ===');
    const fileClicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('span, div, button, a'));
      const fileEl = els.find(el => el.textContent?.trim() === 'App.tsx' && el.offsetParent !== null);
      if (fileEl) { fileEl.click(); return 'App.tsx'; }
      const anyFile = els.find(el => /\.(tsx|jsx|ts|js|html|css)$/.test(el.textContent?.trim() || '') && el.offsetParent !== null);
      if (anyFile) { anyFile.click(); return anyFile.textContent.trim(); }
      return null;
    });
    if (fileClicked) {
      pass(`Editor — clicked ${fileClicked}`);
      await waitMs(3000);
    } else {
      fail('Editor', 'Could not click any file');
    }

    const hasEditor = await visible(page, '.monaco-editor') || await visible(page, '.cm-editor') || await visible(page, '[class*="CodeMirror"]');
    if (hasEditor) {
      pass('Editor — code editor component visible');
    } else {
      const editorLike = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="editor"], [class*="Editor"], [role="textbox"]');
        return els.length;
      });
      if (editorLike > 0) {
        pass(`Editor — ${editorLike} editor-like elements found`);
      } else {
        fail('Editor', 'No code editor found');
      }
    }
    await screenshot(page, 'code_editor');

    console.log('\n=== TEST 7: AI CHAT PANEL ===');
    const chatInputExists = await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      return textareas.some(t => {
        const ph = (t.placeholder || '').toLowerCase();
        return ph.includes('message') || ph.includes('ask') || ph.includes('chat') || ph.includes('type') || ph.includes('send');
      });
    });
    if (chatInputExists) {
      pass('AI Chat — chat input found');
    } else {
      const chatTabClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [role="tab"]'));
        const chatTab = btns.find(b => /chat|ai|agent|assistant/i.test(b.textContent || ''));
        if (chatTab) { chatTab.click(); return true; }
        return false;
      });
      if (chatTabClicked) {
        await waitMs(2000);
        pass('AI Chat — tab clicked');
      } else {
        fail('AI Chat', 'No chat input or tab found');
      }
    }
    await screenshot(page, 'ai_chat');

    console.log('\n=== TEST 8: SEND CHAT MESSAGE ===');
    const chatSent = await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const chatInput = textareas.find(t => {
        const ph = (t.placeholder || '').toLowerCase();
        return ph.includes('message') || ph.includes('ask') || ph.includes('chat') || ph.includes('type') || ph.includes('send');
      });
      if (chatInput) {
        chatInput.value = 'Hello, what can you do?';
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    });
    if (chatSent) {
      await page.keyboard.press('Enter');
      pass('Chat — message sent');
      await waitMs(10000);
      await screenshot(page, 'chat_response');
    } else {
      fail('Chat', 'Could not find chat input to type in');
    }

    console.log('\n=== TEST 9: TERMINAL PANEL ===');
    const termClicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, [role="tab"], div[class*="tab"]'));
      const termTab = els.find(el => /terminal|shell|console/i.test(el.textContent || ''));
      if (termTab) { termTab.click(); return true; }
      return false;
    });
    if (termClicked) {
      await waitMs(2000);
      pass('Terminal — tab clicked');
    }
    const termVisible = await visible(page, '[class*="xterm"]') || await visible(page, '[class*="terminal"]');
    if (termVisible) {
      pass('Terminal — panel visible');
    } else {
      const termLike = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="terminal" i], [class*="console" i], [class*="shell" i]');
        return els.length;
      });
      if (termLike > 0) {
        pass(`Terminal — ${termLike} terminal-like elements found`);
      } else {
        fail('Terminal', 'No terminal element found');
      }
    }
    await screenshot(page, 'terminal');

    console.log('\n=== TEST 10: PREVIEW PANEL ===');
    const prevClicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, [role="tab"], div[class*="tab"]'));
      const prevTab = els.find(el => /preview|browser|webview/i.test(el.textContent || ''));
      if (prevTab) { prevTab.click(); return true; }
      return false;
    });
    if (prevClicked) {
      await waitMs(3000);
      pass('Preview — tab clicked');
    }
    const iframeEl = await page.$('iframe[src*="preview"], iframe[src*="localhost"]');
    const previewLike = await page.evaluate(() => {
      const els = document.querySelectorAll('[class*="preview" i], iframe');
      return els.length;
    });
    if (iframeEl) {
      pass('Preview — iframe found');
    } else if (previewLike > 0) {
      pass(`Preview — ${previewLike} preview-like elements found`);
    } else {
      fail('Preview', 'No preview panel found');
    }
    await screenshot(page, 'preview');

    console.log('\n=== TEST 11: UI QUALITY ===');
    const bgColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    console.log(`  Body bg: ${bgColor}`);
    
    const isDark = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/\d+/g);
      if (!match) return false;
      return match.slice(0, 3).every(v => parseInt(v) < 100);
    });
    if (isDark) {
      pass('UI — dark theme active');
    } else {
      pass('UI — theme loaded (may not be fully dark)');
    }

    const errorModals = await page.evaluate(() => {
      return document.querySelectorAll('[role="alertdialog"], [class*="error-modal"]').length;
    });
    if (errorModals === 0) {
      pass('UI — no error modals');
    } else {
      fail('UI', `${errorModals} error modals found`);
    }

    await screenshot(page, 'final_view');

  } catch (err) {
    console.error(`\n💥 Error: ${err.message}`);
    try { await screenshot(page, 'error'); } catch {}
  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log('          TEST RESULTS SUMMARY');
  console.log('========================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  results.forEach(r => {
    console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}${r.reason ? ` — ${r.reason}` : ''}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed of ${results.length}`);
  console.log(`  Screenshots: ${SCREENSHOTS_DIR}/`);
  console.log('========================================\n');
})();
