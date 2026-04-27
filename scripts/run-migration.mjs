import { Pool } from "pg";
import { readFileSync } from "fs";
const sqlFile = process.argv[2];
if (!sqlFile) { console.error("usage: node run-migration.mjs <sql-file>"); process.exit(1); }
const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });
const sql = readFileSync(sqlFile,"utf8");
try {
  console.log(`[migrate] running ${sqlFile}`);
  await pool.query(sql);
  console.log(`[migrate] ✓ done`);
} catch (e) {
  console.error(`[migrate] ✗ failed: ${e.message}`);
  process.exit(1);
} finally {
  await pool.end();
}
