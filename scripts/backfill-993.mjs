import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `UPDATE projects
   SET tenant_id = NULLIF(user_id, '')::int
   WHERE tenant_id IS NULL
     AND user_id ~ '^[0-9]+$'
   RETURNING id, user_id, tenant_id`
);
console.log('backfilled', r.rowCount, 'rows');
for (const row of r.rows.slice(0, 10)) console.log(' ', row);
await c.end();
