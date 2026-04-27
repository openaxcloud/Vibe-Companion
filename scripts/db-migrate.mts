/**
 * Versioned migrations runner.
 *
 * Replaces `drizzle-kit push` (destructive, syncs schema directly to DB
 * potentially dropping columns/tables silently) with a forward-only
 * SQL-file workflow:
 *
 *   1. Author writes a SQL file in migrations/NNNN_description.sql
 *      (or runs `npm run db:generate` to have drizzle-kit produce one
 *      from the schema diff).
 *   2. CI/operator runs `npm run db:migrate` which applies any
 *      previously-unrun .sql files in lexicographic order, recording
 *      each in the `_drizzle_migrations` table.
 *
 * Idempotent: re-running on a fully-migrated DB is a no-op. Safe on
 * already-applied legacy migrations: records them as run and skips.
 */
import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const env = readFileSync(".env", "utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)?.[1].replace(/^["']|["']$/g, "")
  || process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not found in .env or env"); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  // 1. Ensure tracking table exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _drizzle_migrations (
      id varchar(255) PRIMARY KEY,
      hash varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // 2. List migration files in lexicographic order.
  const dir = "migrations";
  const files = readdirSync(dir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  // 3. Read what's already applied.
  const r = await pool.query(`SELECT id, hash FROM _drizzle_migrations`);
  const applied = new Map<string, string>(r.rows.map(row => [row.id, row.hash]));

  // 3a. Bootstrap mode: if tracking is empty BUT the DB already has core
  //     tables (i.e. a long-lived environment that pre-dates this runner),
  //     mark the historical migrations 0000..0024 as already-applied
  //     instead of re-running them. They're not idempotent — they CREATE
  //     bare tables that already exist. Migrations 0025+ were authored
  //     with IF NOT EXISTS / archive-and-recreate guards and ARE safe to
  //     re-run, so we leave them alone.
  if (applied.size === 0) {
    const sentinel = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1`
    );
    if (sentinel.rows.length > 0) {
      console.log("[migrate] bootstrap: DB already has 'users' — marking 0000..0024 as applied without running");
      for (const f of files) {
        const id = f.replace(/\.sql$/, "");
        const idx = parseInt(id.slice(0, 4), 10);
        if (Number.isFinite(idx) && idx <= 24) {
          const hash = createHash("sha256").update(readFileSync(join(dir, f), "utf8")).digest("hex");
          await pool.query(
            `INSERT INTO _drizzle_migrations (id, hash) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
            [id, hash]
          );
          applied.set(id, hash);
        }
      }
      console.log(`[migrate] bootstrap: ${applied.size} historical migrations marked as applied`);
    }
  }

  let ranNew = 0, skipped = 0;
  for (const f of files) {
    const id = f.replace(/\.sql$/, "");
    const sql = readFileSync(join(dir, f), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");

    if (applied.has(id)) {
      if (applied.get(id) !== hash) {
        console.warn(`[migrate] ⚠ ${f} hash changed since it was applied — skipping (manual review needed)`);
      }
      skipped++;
      continue;
    }

    console.log(`[migrate] applying ${f}…`);
    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query(`INSERT INTO _drizzle_migrations (id, hash) VALUES ($1, $2)`, [id, hash]);
      await pool.query("COMMIT");
      console.log(`[migrate] ✓ ${f}`);
      ranNew++;
    } catch (e: any) {
      await pool.query("ROLLBACK").catch(() => {});
      console.error(`[migrate] ✗ ${f}: ${e.message}`);
      throw e;
    }
  }

  console.log(`\n✓ applied ${ranNew} new migrations, ${skipped} already up-to-date`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
