import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const tables = ['ai_usage_logs', 'system_settings', 'project_env_vars', 'session', 'user_sessions'];
for (const t of tables) {
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
  console.log(`\n[${t}]`);
  console.log(r.rows.length ? r.rows.map(r => r.column_name).join(', ') : 'MISSING');
}
await c.end();
