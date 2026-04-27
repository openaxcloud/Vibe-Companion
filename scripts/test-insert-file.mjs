import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  const r = await c.query(
    `INSERT INTO files (project_id, filename, content, is_binary) VALUES ($1, $2, $3, $4) RETURNING id, project_id, filename, content`,
    ['993', 'test-direct.txt', 'hello', false]
  );
  console.log('inserted:', r.rows[0]);
  await c.query('DELETE FROM files WHERE id = $1', [r.rows[0].id]);
  console.log('cleaned up');
} catch (e) {
  console.log('INSERT failed:', e.message);
  console.log('  detail:', e.detail);
}
await c.end();
