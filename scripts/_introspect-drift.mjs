#!/usr/bin/env node
// One-shot introspection helper for the P0 #3/#4 + P2 #14 drift fix.
// Reads DATABASE_URL from .env and prints \d-style column info for the
// tables we care about, so we can converge the Drizzle schema against
// reality instead of guessing.
//
// Run: node scripts/_introspect-drift.mjs

import 'dotenv/config';
import pg from 'pg';

const TABLES = ['users', 'projects', 'files', 'agent_plans'];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const table of TABLES) {
    const { rows: cols } = await client.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n=== ${table} (${cols.length} columns) ===`);
    if (cols.length === 0) {
      console.log('  [table not found in public schema]');
      continue;
    }
    for (const c of cols) {
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
      const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      console.log(`  ${c.column_name.padEnd(28)} ${(c.data_type + len).padEnd(28)}${nullable}${def}`);
    }

    const { rows: idxs } = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1`,
      [table]
    );
    if (idxs.length) {
      console.log(`  -- indexes:`);
      for (const i of idxs) console.log(`     ${i.indexname}: ${i.indexdef}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
