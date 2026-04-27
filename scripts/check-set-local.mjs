import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query('BEGIN');
try {
  await c.query("SET LOCAL app.tenant_id = '1'");
  console.log('SET LOCAL app.tenant_id ok');
} catch (e) { console.log('SET LOCAL ERROR:', e.message); }
await c.query('COMMIT');
await c.end();
