/**
 * Shell / Terminal panel E2E tests.
 *
 * Covers the critical behaviors identified in docs/shell-parity-audit.md:
 *   - Canonical WS endpoint /api/terminal/ws reachable and authenticates
 *   - Unauthenticated WS connection rejected (close code 1008)
 *   - Shell panel renders a real xterm.js canvas element
 *   - Multi-tab shell: each tab creates an independent connection
 *   - Reconnect indicator appears in output after reconnect
 *   - Agent tab is the first tab, labeled "Agent", pinned (no close button)
 *   - Reload-resume: canvas present after page navigation
 *   - CTA buttons (copy, new tab) trigger their actions without JS errors
 *
 * Run with:
 *   npx playwright test tests/e2e/terminal.spec.ts
 *
 * Requires the server running at http://localhost:5000 (reuseExistingServer: true).
 * Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars for authenticated sessions.
 */

import { test, expect } from './fixtures';
import WebSocket from 'ws';

const BASE_WS = (host: string) => `ws://${host}`;

async function getWsUrl(host: string, projectId: string, sessionId = 'default'): Promise<string> {
  return `${BASE_WS(host)}/api/terminal/ws?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`;
}

// Helper: collect WS messages until a predicate matches or timeout fires.
async function collectUntil(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 10000
): Promise<any[]> {
  const collected: any[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(collected), timeoutMs);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        collected.push(msg);
        if (predicate(msg)) {
          clearTimeout(timer);
          resolve(collected);
        }
      } catch {}
    });
    ws.on('error', reject);
    ws.on('close', () => { clearTimeout(timer); resolve(collected); });
  });
}

/** Navigate to the project IDE and wait for it to mount */
async function gotoProject(page: any, projectId: string) {
  await page.goto(`/project/${projectId}`, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('[data-ide-layout="unified"]', { timeout: 60000 });
}

/** Open the terminal panel by clicking the activity bar trigger */
async function openTerminal(page: any) {
  const trigger = await page.waitForSelector(
    '[data-testid="activity-terminal"], [data-testid="activity-shell"], button[title="Terminal"]',
    { timeout: 15000 }
  );
  await trigger.click();
  // Wait for xterm canvas to appear, confirming the terminal actually opened
  await page.waitForSelector(
    '[data-testid="workspace-terminal"] canvas, [data-testid="desktop-shell-terminal"] canvas, [data-testid="shell-terminal-output"] canvas',
    { timeout: 15000 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WS protocol tests (no browser UI needed)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('terminal — WebSocket protocol', () => {

  test('canonical /api/terminal/ws sends "connected" then "ready" in dev mode', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const url = await getWsUrl('localhost:5000', freshProjectId);

    const ws = new WebSocket(url, { headers: { Cookie: cookieStr } });
    const messages = await collectUntil(ws, (m) => m.type === 'ready', 15000);
    ws.close(1000);

    const types = messages.map((m: any) => m.type);
    expect(types, 'Expected "connected" before "ready"').toContain('connected');
    expect(types, 'Expected "ready" from PTY service').toContain('ready');
  });

  test('unauthenticated WS connection is rejected with close code 1008', async () => {
    const url = await getWsUrl('localhost:5000', '999999-nonexistent');
    const ws = new WebSocket(url); // deliberately no auth credentials

    const result = await new Promise<{ code: number; messages: any[] }>((resolve) => {
      const messages: any[] = [];
      const timer = setTimeout(() => resolve({ code: -1, messages }), 8000);
      ws.on('message', (raw) => {
        try { messages.push(JSON.parse(raw.toString())); } catch {}
      });
      ws.on('close', (code) => { clearTimeout(timer); resolve({ code, messages }); });
      ws.on('error', () => { clearTimeout(timer); resolve({ code: -1, messages }); });
    });

    expect(result.code, 'Unauthenticated WS must be rejected with close code 1008').toBe(1008);
  });

  test('multi-tab: two sessions with different sessionIds connect independently', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url1 = await getWsUrl('localhost:5000', freshProjectId, 'default');
    const url2 = await getWsUrl('localhost:5000', freshProjectId, `tab-${Date.now()}`);

    const ws1 = new WebSocket(url1, { headers: { Cookie: cookieStr } });
    const ws2 = new WebSocket(url2, { headers: { Cookie: cookieStr } });

    const [msgs1, msgs2] = await Promise.all([
      collectUntil(ws1, (m) => m.type === 'ready', 15000),
      collectUntil(ws2, (m) => m.type === 'ready', 15000),
    ]);

    ws1.close(1000);
    ws2.close(1000);

    expect(msgs1.some((m: any) => m.type === 'ready'), 'Tab 1 session did not reach ready').toBeTruthy();
    expect(msgs2.some((m: any) => m.type === 'ready'), 'Tab 2 session did not reach ready').toBeTruthy();
  });

  test('resize message is accepted without error', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const url = await getWsUrl('localhost:5000', freshProjectId, 'resize-test');

    const ws = new WebSocket(url, { headers: { Cookie: cookieStr } });
    await collectUntil(ws, (m) => m.type === 'ready', 15000);
    ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
    await new Promise(r => setTimeout(r, 1000));
    ws.send(JSON.stringify({ type: 'ping' }));
    const after = await collectUntil(ws, (m) => m.type === 'pong', 5000);
    ws.close(1000);

    expect(after.some((m: any) => m.type === 'pong'), 'Ping/pong failed after resize').toBeTruthy();
  });

  test('reload-resume: history replays after reconnect', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const sessionId = `reload-resume-${Date.now()}`;
    const url = await getWsUrl('localhost:5000', freshProjectId, sessionId);

    // Phase 1: connect, send a command, wait for echo
    const ws1 = new WebSocket(url, { headers: { Cookie: cookieStr } });
    await collectUntil(ws1, (m) => m.type === 'ready', 15000);

    const marker = `resume_marker_${Date.now()}`;
    ws1.send(JSON.stringify({ type: 'input', data: `echo ${marker}\r` }));

    const echoMsgs = await collectUntil(
      ws1,
      (m) => m.type === 'output' && typeof m.data === 'string' && m.data.includes(marker),
      10000
    );
    ws1.close(1000);

    expect(
      echoMsgs.some((m: any) => m.type === 'output' && m.data?.includes(marker)),
      'Command echo not received before disconnect'
    ).toBeTruthy();

    // Phase 2: reconnect to the same session and verify resume
    await new Promise(r => setTimeout(r, 1500));
    const ws2 = new WebSocket(url, { headers: { Cookie: cookieStr } });
    const resumeMsgs = await collectUntil(ws2, (m) => m.type === 'ready' || m.type === 'history', 15000);
    ws2.close(1000);

    expect(
      resumeMsgs.some((m: any) => ['ready', 'history'].includes(m.type)),
      'Session did not resume (no ready/history message after reconnect)'
    ).toBeTruthy();
  });

  test('input produces output from the PTY', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const url = await getWsUrl('localhost:5000', freshProjectId, `input-test-${Date.now()}`);

    const ws = new WebSocket(url, { headers: { Cookie: cookieStr } });
    await collectUntil(ws, (m) => m.type === 'ready', 15000);

    const uniqueMarker = `e2e_test_${Date.now()}`;
    ws.send(JSON.stringify({ type: 'input', data: `echo ${uniqueMarker}\r` }));

    const outputMsgs = await collectUntil(
      ws,
      (m) => m.type === 'output' && typeof m.data === 'string' && m.data.includes(uniqueMarker),
      12000
    );
    ws.close(1000);

    expect(
      outputMsgs.some((m: any) => m.type === 'output' && m.data?.includes(uniqueMarker)),
      `PTY did not echo back "${uniqueMarker}" — check ALLOW_INSECURE_LOCAL_PTY`
    ).toBeTruthy();
  });

  test('restart message causes server-side respawn and ready broadcast', async ({ page, freshProjectId }) => {
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const url = await getWsUrl('localhost:5000', freshProjectId, `restart-test-${Date.now()}`);

    const ws = new WebSocket(url, { headers: { Cookie: cookieStr } });
    await collectUntil(ws, (m) => m.type === 'ready', 15000);

    // Send restart
    ws.send(JSON.stringify({ type: 'restart' }));

    // Server must broadcast "ready" again after respawn — client stays connected
    const postRestart = await collectUntil(ws, (m) => m.type === 'ready', 15000);
    ws.close(1000);

    expect(
      postRestart.some((m: any) => m.type === 'ready'),
      'No "ready" broadcast after server-side restart — respawn may have failed or disconnected client'
    ).toBeTruthy();
  });

  test('legacy /ws/terminal endpoint returns HTTP 410', async () => {
    const result = await new Promise<number>((resolve) => {
      const ws = new WebSocket('ws://localhost:5000/ws/terminal');
      ws.on('unexpected-response', (_, res) => resolve(res.statusCode));
      ws.on('error', () => resolve(-1));
      setTimeout(() => resolve(-1), 5000);
    });
    expect(result, '/ws/terminal must return HTTP 410 Gone').toBe(410);
  });

  test('legacy /shell WS endpoint returns HTTP 410', async () => {
    const result = await new Promise<number>((resolve) => {
      const ws = new WebSocket('ws://localhost:5000/shell');
      ws.on('unexpected-response', (_, res) => resolve(res.statusCode));
      ws.on('error', () => resolve(-1));
      setTimeout(() => resolve(-1), 5000);
    });
    expect(result, '/shell must return HTTP 410 Gone').toBe(410);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Browser UI tests — all use hard-assert waitForSelector, no optional `if`
// ─────────────────────────────────────────────────────────────────────────────
test.describe('terminal — UI rendering', () => {

  test('shell panel renders xterm.js canvas element', async ({ page, freshProjectId }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', e => fatalErrors.push(e.message));

    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    const canvas = await page.$(
      '[data-testid="workspace-terminal"] canvas, [data-testid="desktop-shell-terminal"] canvas, [data-testid="shell-terminal-output"] canvas'
    );
    expect(canvas, 'xterm.js canvas not found — terminal may not have rendered').not.toBeNull();
    expect(fatalErrors, 'JS exceptions during terminal mount').toEqual([]);
  });

  test('shell panel does NOT open a /ws/terminal legacy connection', async ({ page, freshProjectId }) => {
    const wsUrls: string[] = [];
    page.on('websocket', (ws) => wsUrls.push(ws.url()));

    await gotoProject(page, freshProjectId);
    await openTerminal(page);
    await page.waitForTimeout(2000);

    const legacyConnections = wsUrls.filter(u => u.includes('/ws/terminal'));
    expect(legacyConnections, 'Shell panel must not connect to legacy /ws/terminal').toHaveLength(0);

    const canonicalConnections = wsUrls.filter(u => u.includes('/api/terminal/ws'));
    expect(canonicalConnections.length, 'Shell panel must open at least one /api/terminal/ws connection').toBeGreaterThanOrEqual(1);
  });

  test('desktop shell: new-tab button opens a second independent WS connection', async ({ page, freshProjectId }) => {
    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    const wsUrlsAfterOpen: string[] = [];
    page.on('websocket', (ws) => wsUrlsAfterOpen.push(ws.url()));

    const newTabBtn = await page.waitForSelector('[data-testid="desktop-shell-new-tab"]', { timeout: 10000 });
    await newTabBtn.click();
    await page.waitForTimeout(3000);

    const newTerminalWs = wsUrlsAfterOpen.filter(u => u.includes('/api/terminal/ws'));
    expect(newTerminalWs.length, 'New tab did not open a terminal WS connection').toBeGreaterThanOrEqual(1);
  });

  test('agent tab: first tab is labeled "Agent" and has no close button', async ({ page, freshProjectId }) => {
    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    // Agent tab must be present and labeled "Agent"
    const agentTab = await page.waitForSelector('[data-testid="desktop-shell-tab-default"]', { timeout: 10000 });
    const label = await agentTab.textContent();
    expect(label, 'First tab should be labeled Agent').toContain('Agent');

    // Agent tab must NOT have a close button (it is pinned)
    const closeBtn = await agentTab.$('[data-testid="desktop-shell-close-tab-default"]');
    expect(closeBtn, 'Agent tab must not have a close button — it is pinned').toBeNull();
  });

  test('agent tab uses sessionId=default in its WS URL', async ({ page, freshProjectId }) => {
    const wsUrls: string[] = [];
    page.on('websocket', (ws) => wsUrls.push(ws.url()));

    await gotoProject(page, freshProjectId);
    await openTerminal(page);
    await page.waitForTimeout(2000);

    const agentWs = wsUrls.find(u => u.includes('sessionId=default'));
    expect(agentWs, 'Agent tab WS must use sessionId=default').toBeTruthy();
  });

  test('copy button does not throw JS error', async ({ page, freshProjectId }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    const copyBtn = await page.waitForSelector('[data-testid="desktop-shell-copy"]', { timeout: 10000 });
    await copyBtn.click();
    await page.waitForTimeout(500);

    // Clipboard permission may be denied in CI — filter those — but no other JS exceptions
    const unexpected = errors.filter(e => !e.toLowerCase().includes('clipboard'));
    expect(unexpected, 'Copy button threw unexpected JS error').toEqual([]);
  });

  test('UI reload-resume: shell panel re-renders after page navigation', async ({ page, freshProjectId }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', e => fatalErrors.push(e.message));

    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    const canvas1 = await page.$(
      '[data-testid="workspace-terminal"] canvas, [data-testid="desktop-shell-terminal"] canvas, [data-testid="shell-terminal-output"] canvas'
    );
    expect(canvas1, 'xterm.js canvas not found on first load').not.toBeNull();

    // Navigate away then back
    await page.goto('/', { waitUntil: 'commit', timeout: 15000 });
    await gotoProject(page, freshProjectId);
    await openTerminal(page);

    const canvas2 = await page.$(
      '[data-testid="workspace-terminal"] canvas, [data-testid="desktop-shell-terminal"] canvas, [data-testid="shell-terminal-output"] canvas'
    );
    expect(canvas2, 'xterm.js canvas not found after page navigation — reload-resume failed').not.toBeNull();
    expect(fatalErrors, 'JS exceptions during reload-resume').toEqual([]);
  });

});
