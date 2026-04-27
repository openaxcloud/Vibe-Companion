import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
for (const t of ['themes', 'installed_themes', 'ai_plans']) {
  try {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${r.rows[0].n} rows`);
  } catch (e) { console.log(`${t}: ${e.message}`); }
}
await c.end();
