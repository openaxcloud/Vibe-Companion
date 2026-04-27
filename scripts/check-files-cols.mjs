import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='files' ORDER BY ordinal_position");
for (const row of r.rows) console.log(' ', row.column_name, row.data_type);
await c.end();
