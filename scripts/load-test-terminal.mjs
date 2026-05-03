/**
 * Terminal Load Test — with PTY-ready validation and event-loop lag measurement
 *
 * Opens N concurrent WebSocket sessions to /api/terminal/ws,
 * streams output, and reports:
 *   - PTY-ready rate (primary metric — requires type:"ready" from server)
 *   - Connect latency and open→ready latency (p50/p95/p99)
 *   - Message throughput & byte count
 *   - Event-loop lag (sampled via setInterval delta every 100 ms)
 *   - Max event-loop lag (fail > 500 ms is a red flag)
 *
 * Auth priority:
 *   1. LOAD_TEST_COOKIE env var  — explicit session cookie
 *   2. E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars — auto-login
 *   3. Default credentials admin@test.com / e2e-admin-password — auto-login
 *
 * Usage:
 *   node scripts/load-test-terminal.mjs [--sessions 500] [--duration 20] \
 *     [--host localhost:5000] [--projectId 1]
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import https from 'https';
import http from 'http';

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
}

const SESSION_COUNT = parseInt(arg('sessions', '50'), 10);
const DURATION_S = parseInt(arg('duration', '10'), 10);
const HOST = arg('host', 'localhost:5000');
const IS_LOCAL = HOST.startsWith('localhost') || HOST.startsWith('127.');
const WS_PROTOCOL = IS_LOCAL ? 'ws' : 'wss';
const HTTP_PROTOCOL = IS_LOCAL ? 'http' : 'https';
const BASE_URL = `${WS_PROTOCOL}://${HOST}/api/terminal/ws`;
const BASE_HTTP = `${HTTP_PROTOCOL}://${HOST}`;
const PROJECT_ID = arg('projectId', '1');

// ── Auth: get session cookie ─────────────────────────────────────
async function httpJsonWithHeaders(method, path, body, cookieStr, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const client = IS_LOCAL ? http : https;
    const url = new URL(`${BASE_HTTP}${path}`);
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (IS_LOCAL ? 5000 : 443),
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookieStr ? { Cookie: cookieStr } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const setCookie = [].concat(res.headers['set-cookie'] || []);
        resolve({ statusCode: res.statusCode, body: data, setCookie });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getSessionCookie() {
  if (process.env.LOAD_TEST_COOKIE) {
    console.log('Auth:       LOAD_TEST_COOKIE env var');
    return process.env.LOAD_TEST_COOKIE;
  }
  const email = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
  const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';
  console.log(`Auth:       auto-login as ${email}`);
  try {
    // Step 1: GET /api/csrf-token — establishes a session, sets ecode.csrf cookie
    const csrfResp = await httpJsonWithHeaders('GET', '/api/csrf-token', null, '');
    let csrfToken = '';
    try { csrfToken = JSON.parse(csrfResp.body)?.csrfToken || ''; } catch {}

    // Extract session cookie from Set-Cookie (e.g. "ecode.csrf=abc123; ...")
    const sessionCookie = csrfResp.setCookie
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    if (!sessionCookie) {
      console.warn('Auth warning: no session cookie from /api/csrf-token. Sessions may not reach PTY-ready.');
      return '';
    }

    // Step 2: POST /api/auth/login — carry the session cookie, send CSRF token as header
    const loginResp = await httpJsonWithHeaders(
      'POST', '/api/auth/login',
      { email, password },
      sessionCookie,
      csrfToken ? { 'x-csrf-token': csrfToken } : {}
    );

    if (loginResp.statusCode >= 400) {
      console.warn(`Auth warning: login returned ${loginResp.statusCode}: ${loginResp.body.slice(0, 120)}`);
      return '';
    }

    // After login, session is regenerated → take the NEW ecode.sid from login response.
    // Fall back to the original session cookie if login didn't set a new one.
    const postLoginCookies = loginResp.setCookie
      .map(c => c.split(';')[0].trim())
      .filter(Boolean);
    // Merge: original cookies + post-login cookies (post-login wins on same name)
    const cookieMap = new Map();
    [...csrfResp.setCookie, ...loginResp.setCookie].forEach(raw => {
      const pair = raw.split(';')[0].trim();
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) cookieMap.set(pair.slice(0, eqIdx), pair);
    });
    const finalCookie = Array.from(cookieMap.values()).join('; ');
    console.log(`Auth:       session cookie obtained (${finalCookie.length} chars, cookies: ${Array.from(cookieMap.keys()).join(', ')})`);
    return finalCookie;
  } catch (err) {
    console.warn(`Auth warning: login failed (${err.message}). Sessions may not reach PTY-ready.`);
    return '';
  }
}

const COOKIE = await getSessionCookie();

console.log(`\n=== Terminal Load Test ===`);
console.log(`Sessions:   ${SESSION_COUNT}`);
console.log(`Duration:   ${DURATION_S}s`);
console.log(`Target:     ${BASE_URL}`);
console.log(`Project:    ${PROJECT_ID}`);
console.log('');

const stats = {
  opened: 0,    // WS open (handshake)
  ready: 0,     // received type:"ready" — confirms authenticated PTY is live
  failed: 0,
  messages: 0,
  bytes: 0,
  latencies: [],      // open→ready latency per session
  readyLatencies: [], // open→ready latency per session
  errors: [],
  // Event-loop lag tracking
  lagSamples: [],
  maxLag: 0,
};

// ── Event-loop lag monitor ──────────────────────────────────────
// Samples the gap between scheduled and actual setInterval wakeup every 100ms.
// A large gap means the event loop is stalled (CPU-bound or blocked).
let lagMonitorInterval;
{
  let lastSample = performance.now();
  lagMonitorInterval = setInterval(() => {
    const now = performance.now();
    const lag = Math.max(0, (now - lastSample) - 100);
    stats.lagSamples.push(lag);
    if (lag > stats.maxLag) stats.maxLag = lag;
    lastSample = now;
  }, 100);
  lagMonitorInterval.unref?.(); // don't prevent process exit
}

const startTime = performance.now();

function createSession(index) {
  const sessionId = `load-test-${index}-${Date.now()}`;
  const url = `${BASE_URL}?projectId=${PROJECT_ID}&sessionId=${encodeURIComponent(sessionId)}`;
  const connectStart = performance.now();

  const headers = COOKIE ? { Cookie: COOKIE } : {};
  const ws = new WebSocket(url, { headers });

  let openedAt = 0;

  ws.on('open', () => {
    stats.opened++;
    openedAt = performance.now();
    stats.latencies.push(openedAt - connectStart);

    // Send initial resize so the PTY knows the terminal dimensions
    ws.send(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
  });

  ws.on('message', (data) => {
    stats.messages++;
    stats.bytes += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data.toString());

    // Track PTY readiness: "ready" means auth succeeded and the PTY is live.
    // This is the only meaningful success signal beyond the WS handshake.
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ready') {
        stats.ready++;
        stats.readyLatencies.push(performance.now() - (openedAt || connectStart));
        // Send a command to confirm PTY is actually processing input
        ws.send(JSON.stringify({ type: 'input', data: `echo load_test_${index}_ok\r` }));
      }
    } catch {}
  });

  ws.on('error', (err) => {
    stats.failed++;
    stats.errors.push(err.message);
  });

  ws.on('close', (code) => {
    // Codes 1000 and 1001 are clean closes; anything else is an error
    if (code !== 1000 && code !== 1001 && code !== undefined) {
      // Don't double-count if already counted in 'error'
    }
  });

  return ws;
}

// Open all sessions with a 10ms stagger to avoid thundering herd
console.log(`Opening ${SESSION_COUNT} sessions (10ms stagger)...`);
const sockets = [];
for (let i = 0; i < SESSION_COUNT; i++) {
  await new Promise(r => setTimeout(r, 10));
  sockets.push(createSession(i));
}
console.log(`All sessions initiated. Holding open for ${DURATION_S}s...`);

// Periodic status line
const reportInterval = setInterval(() => {
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  const openCount = sockets.filter(ws => ws.readyState === WebSocket.OPEN).length;
  process.stdout.write(
    `\r[${elapsed}s] open=${openCount}/${SESSION_COUNT} msgs=${stats.messages} ` +
    `bytes=${(stats.bytes / 1024).toFixed(0)}KB lag=${stats.maxLag.toFixed(0)}ms`
  );
}, 500);

await new Promise(r => setTimeout(r, DURATION_S * 1000));

clearInterval(reportInterval);
clearInterval(lagMonitorInterval);
console.log('\n');

// Graceful close
console.log('Closing sessions...');
for (const ws of sockets) {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(1000, 'load test complete');
  }
}
await new Promise(r => setTimeout(r, 2000));

// ── Final report ─────────────────────────────────────────────────
const totalDuration = (performance.now() - startTime) / 1000;
const p50 = percentile(stats.latencies, 50);
const p95 = percentile(stats.latencies, 95);
const p99 = percentile(stats.latencies, 99);
const medianLag = percentile(stats.lagSamples, 50);
const p95Lag = percentile(stats.lagSamples, 95);

// ready rate is the true success metric: WS open is necessary but not sufficient
const readyRate = stats.ready / SESSION_COUNT;
const openRate  = stats.opened / SESSION_COUNT;
const lagOk = stats.maxLag < 500;

// ready→output latency
const p50ready = stats.readyLatencies.length ? percentile(stats.readyLatencies, 50) : 0;
const p95ready = stats.readyLatencies.length ? percentile(stats.readyLatencies, 95) : 0;
const p99ready = stats.readyLatencies.length ? percentile(stats.readyLatencies, 99) : 0;

console.log('=== Results ===');
console.log(`Duration:              ${totalDuration.toFixed(2)}s`);
console.log(`Sessions opened:       ${stats.opened}/${SESSION_COUNT} (${(openRate * 100).toFixed(1)}% handshake)`);
console.log(`Sessions PTY-ready:    ${stats.ready}/${SESSION_COUNT} (${(readyRate * 100).toFixed(1)}% authenticated PTY live) ← primary metric`);
console.log(`Sessions failed:       ${stats.failed}`);
console.log(`Messages received:     ${stats.messages}`);
console.log(`Data received:         ${(stats.bytes / 1024 / 1024).toFixed(2)} MB`);
console.log('');
console.log('Connect latency (open):');
console.log(`  p50: ${p50.toFixed(1)} ms`);
console.log(`  p95: ${p95.toFixed(1)} ms`);
console.log(`  p99: ${p99.toFixed(1)} ms`);
console.log('');
console.log('PTY ready latency (open → ready):');
console.log(`  p50: ${p50ready.toFixed(1)} ms`);
console.log(`  p95: ${p95ready.toFixed(1)} ms`);
console.log(`  p99: ${p99ready.toFixed(1)} ms`);
console.log('');
console.log('Event-loop lag:');
console.log(`  median: ${medianLag.toFixed(1)} ms`);
console.log(`  p95:    ${p95Lag.toFixed(1)} ms`);
console.log(`  max:    ${stats.maxLag.toFixed(1)} ms  ${lagOk ? '✓ ok' : '⚠ HIGH'}`);

if (stats.errors.length > 0) {
  console.log(`\nErrors (first 10):`);
  stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
}

// Pass requires ≥95% of sessions reaching PTY-ready (not just WS open)
const passed = readyRate >= 0.95 && lagOk;
console.log(`\nResult: ${passed ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Target: ≥95% of ${SESSION_COUNT} sessions PTY-ready · max event-loop lag < 500ms`);

process.exit(passed ? 0 : 1);

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
