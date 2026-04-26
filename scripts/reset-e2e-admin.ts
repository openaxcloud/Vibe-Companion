/**
 * Reset / create the e2e admin account so the Playwright suite can log in.
 * Idempotent: creates if missing, resets password if exists.
 *
 * Reads ADMIN_PASSWORD env var (defaults to "e2e-admin-password").
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
const { Client } = pg;

const EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'e2e-admin-password';

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const hash = await bcrypt.hash(PASSWORD, 12);

const r = await c.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [EMAIL]);
if (r.rows.length) {
  await c.query('UPDATE users SET password = $1, email_verified = true, role = $2 WHERE id = $3', [hash, 'admin', r.rows[0].id]);
  console.log(`[e2e] reset password for ${EMAIL} (id=${r.rows[0].id})`);
} else {
  const ins = await c.query(
    'INSERT INTO users (email, username, password, display_name, email_verified, role) VALUES ($1, $2, $3, $4, true, $5) RETURNING id',
    [EMAIL, 'admin', hash, 'Admin', 'admin']
  );
  console.log(`[e2e] created ${EMAIL} (id=${ins.rows[0].id})`);
}
console.log(`[e2e] credentials: ${EMAIL} / ${PASSWORD}`);
// Bump tier so the project-creation rate limit doesn't break the suite.
await c.query("UPDATE users SET subscription_tier='enterprise', is_admin=true WHERE email = $1", [EMAIL]);
console.log(`[e2e] tier=enterprise is_admin=true on ${EMAIL}`);

await c.end();
