// Apply a single .sql file to the live DB. Used because `drizzle-kit push`
// would also drop columns that the live DB has but the schema doesn't.
import 'dotenv/config';
import { readFileSync } from 'fs';
import pg from 'pg';
const { Client } = pg;

const file = process.argv[2];
if (!file) { console.error('usage: tsx scripts/run-migration.ts <path.sql>'); process.exit(1); }
const sql = readFileSync(file, 'utf8');

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query(sql);
  console.log(`[migrate] applied ${file}`);
} catch (e: any) {
  console.error(`[migrate] failed: ${e.message}`);
  process.exit(1);
} finally {
  await c.end();
}
