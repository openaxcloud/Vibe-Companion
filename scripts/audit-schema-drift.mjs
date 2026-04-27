#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const SCHEMA_SRC = readFileSync("shared/schema.ts", "utf8");
const TABLE_RE = /^export const \w+ = pgTable\(["']([^"']+)["']/gm;
const schemaTables = new Set();
let m;
while ((m = TABLE_RE.exec(SCHEMA_SRC))) schemaTables.add(m[1]);

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const { rows } = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
);
const dbTables = new Set(rows.map((r) => r.table_name));
await pool.end();

const missingInDb = [...schemaTables].filter((t) => !dbTables.has(t)).sort();
const extraInDb = [...dbTables]
  .filter((t) => !schemaTables.has(t))
  .filter((t) => !t.endsWith("_legacy_archived"))
  .sort();

const summary = {
  schemaTables: schemaTables.size,
  dbTables: dbTables.size,
  missingInDb: missingInDb.length,
  extraInDb: extraInDb.length,
  driftTotal: missingInDb.length + extraInDb.length,
};

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      { summary, missingInDb, extraInDb },
      null,
      2,
    ),
  );
} else {
  console.log("Schema drift audit");
  console.log("==================");
  console.log(`shared/schema.ts:     ${summary.schemaTables} tables`);
  console.log(`live DB:              ${summary.dbTables} tables`);
  console.log(`Missing in DB:        ${summary.missingInDb} (declared but absent)`);
  console.log(`Extra in DB:          ${summary.extraInDb} (present but not in schema)`);
  console.log(`Total drift:          ${summary.driftTotal}`);
  console.log("");
  if (missingInDb.length) {
    console.log("--- Missing in DB ---");
    for (const t of missingInDb) console.log(`  - ${t}`);
    console.log("");
  }
  if (extraInDb.length) {
    console.log("--- Extra in DB (excluding *_legacy_archived) ---");
    for (const t of extraInDb) console.log(`  + ${t}`);
  }
}

process.exit(summary.driftTotal > 0 ? 1 : 0);
