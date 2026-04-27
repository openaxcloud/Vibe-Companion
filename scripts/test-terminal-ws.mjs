import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';

// Reuse the cookie file Playwright/curl tests already populated.
// If it doesn't exist, log in via curl first.
const COOKIES = '/tmp/cookies-e2e.txt';
if (!fs.existsSync(COOKIES) || fs.statSync(COOKIES).size < 100) {
  execSync(`curl -s -c ${COOKIES} -X POST http://localhost:5099/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@test.com","password":"e2e-admin-password"}'`);
}

// Read Netscape cookie file → extract ecode.sid + ecode.csrf as a Cookie header.
const lines = fs.readFileSync(COOKIES, 'utf8').split('\n');
const jar = {};
for (let ln of lines) {
  if (!ln) continue;
  if (ln.startsWith('#HttpOnly_')) ln = ln.slice('#HttpOnly_'.length);
  else if (ln.startsWith('#')) continue;
  const parts = ln.split('\t');
  if (parts.length < 7) continue;
  jar[parts[5]] = parts[6];
}
const cookie = Object.entries(jar)
  .filter(([k]) => /^ecode\./.test(k))
  .map(([k, v]) => `${k}=${v}`)
  .join('; ');
console.log('cookie:', cookie || '(empty!)');

const ws = new WebSocket(`ws://localhost:5099/ws/terminal?projectId=993`, {
  headers: { Cookie: cookie },
});
ws.on('open', () => {
  console.log('WS open');
  ws.send(JSON.stringify({ type: 'init', cols: 80, rows: 24, projectId: '993' }));
  setTimeout(() => ws.send(JSON.stringify({ type: 'data', data: 'echo terminal_ok\n' })), 500);
});
ws.on('message', m => console.log('MSG:', m.toString().slice(0, 300)));
ws.on('close', (code, reason) => { console.log('WS close', code, reason.toString()); process.exit(0); });
ws.on('error', e => { console.log('WS error', e.message); process.exit(1); });
setTimeout(() => { ws.close(); }, 5000);
