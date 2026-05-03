/**
 * Playwright global setup — creates a valid auth state file by reading an
 * existing session for the e2e test user (id=127, e2e_testuser) directly from
 * the PostgreSQL session store, then signing it with SESSION_SECRET the same
 * way express-session does.  No login API call, no browser needed.
 *
 * Also ensures project 1020 has at least one workflow with a known command
 * so that PTY e2e tests can use a real server-resolved workflowId.
 */
import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Write to /tmp so the file is NEVER inside the project directory and can
// never be accidentally committed to VCS regardless of .gitignore state.
export const AUTH_FILE = '/tmp/e2e-auth-state.json';

export const TEST_EMAIL    = 'e2e_testuser@test.local';
export const TEST_USERNAME = 'e2e_testuser';
export const TEST_PASSWORD = 'TestPass123!';
const E2E_USER_ID  = 127;
const E2E_PROJECT_ID = '1020';

/** Sign a session ID exactly as express-session does. */
function signSid(sid: string, secret: string): string {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');
  return 's:' + sid + '.' + hmac;
}

export default async function globalSetup(_config: FullConfig) {
  // Start with an empty-auth fallback so WS tests can always load the file.
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [], testWorkflowId: null }, null, 2));

  const secret = process.env.SESSION_SECRET;
  const dbUrl  = process.env.DATABASE_URL;
  if (!secret || !dbUrl) {
    console.warn('[global-setup] SESSION_SECRET or DATABASE_URL missing — UI tests will skip');
    return;
  }

  try {
    const { Pool } = (await import('pg')).default
      ? (await import('pg')).default
      : (await import('pg')) as any;

    const pool = new Pool({ connectionString: dbUrl });

    // ── 1. Auth cookie ────────────────────────────────────────────────────
    const { rows } = await pool.query<{ sid: string; sess: any; expire: Date }>(
      `SELECT sid, sess, expire
         FROM user_sessions
        WHERE sess::text LIKE $1
          AND expire > NOW()
        ORDER BY expire DESC
        LIMIT 1`,
      [`%"user":${E2E_USER_ID}%`]
    );

    if (!rows.length) {
      await pool.end();
      console.warn(`[global-setup] No live session for user ${E2E_USER_ID} — UI tests will skip`);
      return;
    }

    const { sid, expire } = rows[0];
    const signed = signSid(sid, secret);
    const expiresUnix = Math.floor(expire.getTime() / 1000);

    // ── 2. Ensure project 1020 has a PTY-testable workflow ───────────────
    // Look for an existing workflow with a shell step command.
    const { rows: wfRows } = await pool.query<{ id: string; command: string }>(
      `SELECT w.id, ws.command
         FROM workflows w
         JOIN workflow_steps ws ON ws.workflow_id = w.id
        WHERE w.project_id = $1
          AND ws.task_type = 'shell'
        ORDER BY w.created_at ASC, ws.order_index ASC
        LIMIT 1`,
      [E2E_PROJECT_ID]
    );

    let testWorkflowId: string | null = null;
    let stdinWorkflowId: string | null = null;

    if (wfRows.length) {
      testWorkflowId = wfRows[0].id;
      console.log(`[global-setup] Reusing workflow ${testWorkflowId} (cmd: ${wfRows[0].command})`);
    } else {
      // Create a minimal workflow with a deterministic echo command so PTY e2e tests
      // can assert real PTY round-trip output without depending on project files.
      const { rows: newWf } = await pool.query<{ id: string }>(
        `INSERT INTO workflows (project_id, name, trigger_event, execution_mode, enabled)
         VALUES ($1, 'E2E PTY Test', 'manual', 'sequential', true)
         RETURNING id`,
        [E2E_PROJECT_ID]
      );
      const wfId = newWf[0].id;
      await pool.query(
        `INSERT INTO workflow_steps (workflow_id, name, command, task_type, order_index, continue_on_error)
         VALUES ($1, 'echo', 'echo PTY_E2E_OK', 'shell', 0, false)`,
        [wfId]
      );
      testWorkflowId = wfId;
      console.log(`[global-setup] Created e2e workflow ${wfId} for project ${E2E_PROJECT_ID}`);
    }

    // ── 3. Ensure a stdin-interactive workflow exists ─────────────────────
    // Command: print READY, read one line from stdin, echo it back prefixed
    // with "ECHO:" so the e2e test can assert the full stdin→stdout round-trip.
    const STDIN_CMD = "printf 'READY\\n' && read LINE && printf 'ECHO:%s\\n' \"$LINE\"";
    const { rows: stdinRows } = await pool.query<{ id: string }>(
      `SELECT w.id
         FROM workflows w
         JOIN workflow_steps ws ON ws.workflow_id = w.id
        WHERE w.project_id = $1
          AND ws.command = $2
        LIMIT 1`,
      [E2E_PROJECT_ID, STDIN_CMD]
    );
    if (stdinRows.length) {
      stdinWorkflowId = stdinRows[0].id;
      console.log(`[global-setup] Reusing stdin workflow ${stdinWorkflowId}`);
    } else {
      const { rows: newStdin } = await pool.query<{ id: string }>(
        `INSERT INTO workflows (project_id, name, trigger_event, execution_mode, enabled)
         VALUES ($1, 'E2E PTY Stdin', 'manual', 'sequential', true)
         RETURNING id`,
        [E2E_PROJECT_ID]
      );
      const sid2 = newStdin[0].id;
      await pool.query(
        `INSERT INTO workflow_steps (workflow_id, name, command, task_type, order_index, continue_on_error)
         VALUES ($1, 'stdin-echo', $2, 'shell', 0, false)`,
        [sid2, STDIN_CMD]
      );
      stdinWorkflowId = sid2;
      console.log(`[global-setup] Created e2e stdin workflow ${sid2} for project ${E2E_PROJECT_ID}`);
    }

    await pool.end();

    // ── 4. Write auth state ───────────────────────────────────────────────
    const state = {
      cookies: [
        {
          name: 'ecode.sid',
          value: signed,
          domain: 'localhost',
          path: '/',
          expires: expiresUnix,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      origins: [] as any[],
      testWorkflowId,
      stdinWorkflowId,
    };

    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
    console.log(`[global-setup] Auth state saved (user=${E2E_USER_ID}, sid=${sid.slice(0, 10)}…, workflowId=${testWorkflowId})`);
  } catch (err) {
    console.warn('[global-setup] Failed:', (err as Error).message, '— UI tests will skip');
  }
}
