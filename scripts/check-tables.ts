import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const tables = process.argv.slice(2);
for (const t of tables) {
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name=$1", [t]);
  console.log(`[${t}]`, r.rows.length ? r.rows.map(r => r.column_name).join(',') : 'MISSING');
}
await c.end();
