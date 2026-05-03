/**
 * SSH Key Lifecycle — Integration Test
 *
 * CI-runnable (no manual cookie required). Uses the same vitest + fetch pattern
 * as tests/e2e-critical-flows.test.ts.
 *
 * Covers:
 *  1. POST /api/ssh-keys — add a generated ed25519 key, verify fingerprint format
 *  2. Real SSH session via ssh2 library:
 *       connect to 127.0.0.1:2222 with generated private key,
 *       run 'echo e2e-ok', verify output contains 'e2e-ok'
 *  3. DELETE /api/ssh-keys/:id — revoke the key
 *  4. SSH rejection — verify a new connection is refused after revocation
 *  5. Agent tool endpoints — list, add, revoke via /api/ssh-keys/agent/*
 *
 * Real SSH steps are skipped when:
 *  - connection-info returns available=false (SSH not configured in this env), OR
 *  - the user has no project to supply as the SSH username
 *
 * Run with: npx vitest run tests/ssh-lifecycle.test.ts
 *
 * Credentials: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars
 * (defaults: admin@test.com / e2e-admin-password, same as other integration tests)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as crypto from 'crypto';

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

let sessionCookie = '';
let csrfToken = '';
let testProjectId: string | null = null;

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Forwarded-Proto': 'https',
  };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/(ecode\.sid|connect\.sid)=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  let data: any;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

/** Build OpenSSH wire-format ed25519 public key from a raw 32-byte key buffer. */
function buildOpensshPublicKey(rawPub: Buffer): string {
  const name = Buffer.from('ssh-ed25519', 'utf8');
  const buf = Buffer.allocUnsafe(4 + name.length + 4 + rawPub.length);
  buf.writeUInt32BE(name.length, 0);
  name.copy(buf, 4);
  buf.writeUInt32BE(rawPub.length, 4 + name.length);
  rawPub.copy(buf, 4 + name.length + 4);
  return `ssh-ed25519 ${buf.toString('base64')} lifecycle-test`;
}

/** Compute SHA256 fingerprint matching ssh-keygen -lf format. */
function computeFingerprint(publicKey: string): string {
  const blob = Buffer.from(publicKey.trim().split(/\s+/)[1], 'base64');
  const hash = crypto.createHash('sha256').update(blob).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

/**
 * Attempt a real SSH connection using the ssh2 library.
 * Always connects to 127.0.0.1 (the SSH server's local address).
 * The provided `port` comes from the connection-info endpoint.
 */
async function trySSHConnection(
  port: number,
  username: string,
  privateKeyPem: string,
  command: string,
  timeoutMs = 10_000,
): Promise<{ success: boolean; output: string; error: string }> {
  let ssh2Pkg: any;
  try {
    ssh2Pkg = await import('ssh2');
  } catch {
    return { success: false, output: '', error: 'ssh2 module not available' };
  }

  const Client = ssh2Pkg.Client ?? ssh2Pkg.default?.Client;
  if (!Client) {
    return { success: false, output: '', error: 'ssh2 Client not found in module' };
  }

  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let settled = false;

    const settle = (result: { success: boolean; output: string; error: string }) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      conn.end();
      settle({ success: false, output, error: `Timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    conn.on('ready', () => {
      conn.exec(command, (err: Error | undefined, stream: any) => {
        if (err) {
          conn.end();
          settle({ success: false, output, error: err.message });
          return;
        }
        stream.on('data', (d: Buffer) => { output += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
        stream.on('close', () => {
          conn.end();
          settle({ success: true, output: output.trim(), error: '' });
        });
      });
    });

    conn.on('error', (err: Error) => {
      settle({ success: false, output, error: err.message });
    });

    conn.connect({
      host: '127.0.0.1',
      port,
      username,
      privateKey: privateKeyPem,
      readyTimeout: timeoutMs,
      hostVerifier: () => true,
    });
  });
}

// ── Setup: authenticate and resolve test project ─────────────────────────────
beforeAll(async () => {
  // CSRF
  const { data: csrfData } = await api('GET', '/api/csrf-token');
  csrfToken = csrfData?.csrfToken ?? '';

  // Login
  const { status: loginStatus } = await api('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (loginStatus !== 200) {
    console.warn(
      `[ssh-lifecycle] Login failed (${loginStatus}). ` +
      `Run scripts/reset-e2e-admin.ts to provision the admin account.`,
    );
    return;
  }

  // Find or create a project for the SSH username
  const { status: listStatus, data: listData } = await api('GET', '/api/projects');
  if (listStatus === 200) {
    const projects = Array.isArray(listData) ? listData : (listData?.projects ?? []);
    if (projects.length > 0) {
      testProjectId = String(projects[0].id);
    }
  }

  if (!testProjectId) {
    const { status: createStatus, data: createData } = await api('POST', '/api/projects', {
      name: `ssh-lifecycle-${Date.now()}`,
      language: 'javascript',
      visibility: 'private',
    });
    if (createStatus === 200 || createStatus === 201) {
      testProjectId = String(createData?.id ?? createData?.project?.id ?? '');
    }
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('SSH Key Lifecycle', () => {
  it('GET /api/ssh-keys/connection-info returns valid shape (no projectId)', async () => {
    const { status, data } = await api('GET', '/api/ssh-keys/connection-info');
    expect(status, `connection-info unexpectedly returned ${status}`).not.toBe(404);
    expect(status).toBe(200);
    expect(typeof data.available).toBe('boolean');
    if (data.available) {
      // Without projectId: user/vscodeUrl/cursorUrl must be null.
      expect(data.user).toBeNull();
      expect(data.vscodeUrl).toBeNull();
      expect(data.cursorUrl).toBeNull();
    } else {
      expect(typeof data.reason).toBe('string');
    }
  });

  it('GET /api/ssh-keys/connection-info with owned projectId returns non-null user + deep links', async () => {
    if (!testProjectId) {
      console.log('  [skip] No project available; skipping projectId ownership assertion');
      return;
    }

    const { status, data } = await api('GET', `/api/ssh-keys/connection-info?projectId=${testProjectId}`);
    expect(status, `connection-info with projectId unexpectedly returned ${status}`).not.toBe(404);
    expect(status).toBe(200);
    expect(typeof data.available).toBe('boolean');

    if (data.available) {
      // With an owned projectId the endpoint MUST populate user and deep links.
      expect(data.user).toBe(testProjectId);
      expect(typeof data.host).toBe('string');
      expect(data.host!.length).toBeGreaterThan(0);
      expect(data.port).toBeGreaterThanOrEqual(1);
      expect(data.port).toBeLessThanOrEqual(65535);
      expect(data.vscodeUrl).toMatch(new RegExp(`^vscode://vscode-remote/ssh-remote\\+${testProjectId}@`));
      expect(data.cursorUrl).toMatch(new RegExp(`^cursor://vscode-remote/ssh-remote\\+${testProjectId}@`));
    } else {
      // SSH unavailable (env not configured / sshd not bound) — still valid.
      expect(typeof data.reason).toBe('string');
    }
  });

  it('GET /api/ssh-keys/connection-info rejects non-owned projectId with 400 or 403', async () => {
    const { status } = await api('GET', '/api/ssh-keys/connection-info?projectId=nonexistent-project-id');
    // Must be 400 (not found) — never 200 with another user's project data.
    expect(status).toBe(400);
  });

  it('rejects unsupported key type (ssh-dss) with 400', async () => {
    const { status } = await api('POST', '/api/ssh-keys', {
      label: 'bad-type',
      publicKey: 'ssh-dss AAAA bad',
    });
    expect(status).toBe(400);
  });

  it('rejects key with no base64 blob with 400', async () => {
    const { status } = await api('POST', '/api/ssh-keys', {
      label: 'no-blob',
      publicKey: 'ssh-ed25519',
    });
    expect(status).toBe(400);
  });

  describe('key add → SSH session → delete → rejection', () => {
    let addedKeyId: string;
    let privateKeyPem: string;
    let publicKey: string;
    let expectedFingerprint: string;
    let sshPort = 2222;
    let sshAvailable = false;

    beforeAll(async () => {
      // Check SSH availability
      if (testProjectId) {
        const { data: ci } = await api('GET', `/api/ssh-keys/connection-info?projectId=${testProjectId}`);
        sshAvailable = ci?.available === true;
        sshPort = ci?.port ?? 2222;
      }

      // Generate key pair
      const { privateKey, publicKey: pubDer } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      privateKeyPem = privateKey as string;
      const rawPub = (pubDer as unknown as Buffer).slice(-32);
      publicKey = buildOpensshPublicKey(rawPub);
      expectedFingerprint = computeFingerprint(publicKey);
    });

    it('POST /api/ssh-keys adds ed25519 key and returns correct fingerprint', async () => {
      const { status, data } = await api('POST', '/api/ssh-keys', {
        label: 'lifecycle-test-key',
        publicKey,
      });
      // 404 here means the route doesn't exist — catch regression immediately.
      expect(status, `POST /api/ssh-keys unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.fingerprint).toBe(expectedFingerprint);
      expect(data.keyType).toBe('ssh-ed25519');
      addedKeyId = data.id;
    });

    it('key appears in GET /api/ssh-keys list with correct fields', async () => {
      const { status, data } = await api('GET', '/api/ssh-keys');
      expect(status, `GET /api/ssh-keys unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      const found = data.find((k: any) => k.id === addedKeyId);
      expect(found).toBeTruthy();
      expect(found.fingerprint).toBe(expectedFingerprint);
      expect(found.keyType).toBe('ssh-ed25519');
      expect('lastUsed' in found).toBe(true);
    });

    it('POST /api/ssh-keys/test-connection returns reachable boolean', async () => {
      const { status, data } = await api('POST', '/api/ssh-keys/test-connection');
      expect(status, `POST /api/ssh-keys/test-connection unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(200);
      expect(typeof data.reachable).toBe('boolean');
    });

    it('duplicate key returns 409', async () => {
      const { status } = await api('POST', '/api/ssh-keys', {
        label: 'duplicate',
        publicKey,
      });
      expect(status).toBe(409);
    });

    it('real SSH session: connect → run command → verify output', async () => {
      if (!sshAvailable) {
        console.log('  [skip] SSH available=false; skipping real SSH session test');
        return;
      }
      if (!testProjectId) {
        console.log('  [skip] No project available; skipping real SSH session test');
        return;
      }
      if (!addedKeyId) {
        throw new Error('Key was not added in prior step — cannot test SSH session');
      }

      const result = await trySSHConnection(sshPort, testProjectId, privateKeyPem, 'echo e2e-ok');
      expect(result.success, `SSH connect failed: ${result.error}`).toBe(true);
      expect(result.output).toContain('e2e-ok');
    });

    it('DELETE /api/ssh-keys/:id removes key', async () => {
      if (!addedKeyId) return; // skip if prior add failed
      const { status } = await api('DELETE', `/api/ssh-keys/${addedKeyId}`);
      // 404 here means the DELETE route doesn't exist at all — distinct from
      // the expected 404 returned when the key has already been deleted.
      expect(status, `DELETE /api/ssh-keys/:id route missing (404 before first delete)`).not.toBe(404);
      expect(status).toBe(200);
    });

    it('key no longer in list after delete', async () => {
      if (!addedKeyId) return;
      const { data } = await api('GET', '/api/ssh-keys');
      const stillPresent = Array.isArray(data) && data.some((k: any) => k.id === addedKeyId);
      expect(stillPresent).toBe(false);
    });

    it('real SSH rejected after key deletion', async () => {
      if (!sshAvailable || !testProjectId || !addedKeyId) {
        console.log('  [skip] Conditions not met for post-delete rejection test');
        return;
      }
      const result = await trySSHConnection(sshPort, testProjectId, privateKeyPem, 'echo e2e-ok', 6_000);
      expect(result.success, 'SSH should be rejected after key deletion').toBe(false);
    });

    it('second DELETE returns 404', async () => {
      if (!addedKeyId) return;
      const { status } = await api('DELETE', `/api/ssh-keys/${addedKeyId}`);
      expect(status).toBe(404);
    });
  });

  describe('agent tool endpoints', () => {
    let agentKeyId: string;

    it('GET /api/ssh-keys/agent/list returns {keys:[...]}', async () => {
      const { status, data } = await api('GET', '/api/ssh-keys/agent/list');
      expect(status, `GET /api/ssh-keys/agent/list unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(200);
      expect(Array.isArray(data.keys)).toBe(true);
    });

    it('POST /api/ssh-keys/agent/add adds key with lastUsed field (publicKey form)', async () => {
      const { publicKey: pubDer } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const agentPubKey = buildOpensshPublicKey((pubDer as unknown as Buffer).slice(-32));

      const { status, data } = await api('POST', '/api/ssh-keys/agent/add', {
        label: 'agent-lifecycle-key',
        publicKey: agentPubKey,
      });
      expect(status, `POST /api/ssh-keys/agent/add (publicKey) unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect('lastUsed' in data).toBe(true);
      agentKeyId = data.id;
    });

    it('POST /api/ssh-keys/agent/add also accepts snake_case public_key', async () => {
      const { publicKey: pubDer } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const snakePubKey = buildOpensshPublicKey((pubDer as unknown as Buffer).slice(-32));

      const { status, data } = await api('POST', '/api/ssh-keys/agent/add', {
        label: 'agent-snake-key',
        public_key: snakePubKey,   // snake_case — AI tool-call convention
      });
      expect(status, `POST /api/ssh-keys/agent/add (public_key) unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      // Clean up the snake_case test key
      await api('DELETE', `/api/ssh-keys/agent/revoke/${data.id}`);
    });

    it('DELETE /api/ssh-keys/agent/revoke/:id revokes key', async () => {
      if (!agentKeyId) return;
      const { status } = await api('DELETE', `/api/ssh-keys/agent/revoke/${agentKeyId}`);
      expect(status, `DELETE /api/ssh-keys/agent/revoke/:id unexpectedly returned ${status}`).not.toBe(404);
      expect(status).toBe(200);
    });

    it('revoked key absent from agent/list', async () => {
      if (!agentKeyId) return;
      const { data } = await api('GET', '/api/ssh-keys/agent/list');
      const still = (data.keys as any[]).some((k: any) => k.id === agentKeyId);
      expect(still).toBe(false);
    });
  });

  describe('legacy bridge regression guard', () => {
    it('server/ssh/ssh-manager.ts does NOT export initializeSSHConnection', async () => {
      // Guard against accidental re-introduction of the removed RCE bridge.
      // The bridge ran exec(data.toString()) on unauthenticated TCP socket bytes.
      // If this test starts failing, stop and audit the change before merging.
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const src = readFileSync(
        resolve(process.cwd(), 'server/ssh/ssh-manager.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/initializeSSHConnection\s*\(/);
      // Strip comment lines before checking for exec pattern — comments may
      // reference the removed code for documentation purposes.
      const nonCommentLines = src
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
        .join('\n');
      expect(nonCommentLines).not.toMatch(/exec\s*\(\s*data\.toString/);
    });

    it('no unauthenticated socket exec bridge in any server/ssh file', async () => {
      const { readdirSync, readFileSync, statSync } = await import('fs');
      const { resolve, join } = await import('path');
      const sshDir = resolve(process.cwd(), 'server/ssh');
      const files = readdirSync(sshDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
        .filter((f) => statSync(join(sshDir, f)).isFile());

      for (const file of files) {
        const content = readFileSync(join(sshDir, file), 'utf8');
        // The exact pattern from the removed bridge
        expect(content, `Found exec(data.toString()) in server/ssh/${file}`).not.toMatch(
          /\.on\(['"]data['"].*exec\s*\(/s,
        );
      }
    });
  });
});
