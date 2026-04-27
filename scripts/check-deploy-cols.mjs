import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
for (const t of ['deployments', 'automations', 'account_env_vars', 'account_env_var_links']) {
  const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
  console.log(`-- ${t} (${r.rowCount} cols) --`);
  for (const row of r.rows) console.log(' ', row.column_name, row.data_type);
}
await c.end();
