import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  "SELECT id, name, user_id, owner_id, tenant_id FROM projects WHERE id IN (993, 777) ORDER BY id"
);
console.table(r.rows);
const f = await c.query(
  "SELECT id, project_id, filename FROM files WHERE project_id IN (993, 777) ORDER BY id"
);
console.log('files:'); console.table(f.rows);
await c.end();
