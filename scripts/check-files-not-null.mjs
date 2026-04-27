import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='files' ORDER BY ordinal_position"
);
for (const row of r.rows) console.log(`  ${row.column_name.padEnd(15)} ${row.data_type.padEnd(25)} null=${row.is_nullable} default=${row.column_default}`);
await c.end();
