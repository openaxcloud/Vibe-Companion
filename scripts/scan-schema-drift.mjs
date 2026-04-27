import { Pool } from "pg";
import { readFileSync } from "fs";
import * as schema from "../shared/schema.js";
import { getTableConfig } from "drizzle-orm/pg-core";

const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });

const tables = Object.values(schema).filter(
  v => v && typeof v === "object" && Symbol.for("drizzle:Name") in v
);

const drifts = [];
const missing = [];
for (const tbl of tables) {
  const cfg = getTableConfig(tbl);
  const dbName = cfg.name;
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [dbName]);
  if (r.rows.length === 0) { missing.push(dbName); continue; }
  const liveCols = new Set(r.rows.map(x => x.column_name));
  const expectedCols = cfg.columns.map(c => c.name);
  const missingCols = expectedCols.filter(c => !liveCols.has(c));
  const extras = [...liveCols].filter(c => !expectedCols.includes(c));
  if (missingCols.length > 0) drifts.push({ dbName, missing: missingCols, extras });
}
console.log(`\n=== ${missing.length} TABLES MISSING ===`);
for (const t of missing) console.log(`  - ${t}`);
console.log(`\n=== ${drifts.length} TABLES WITH COLUMN DRIFT ===`);
for (const d of drifts) {
  console.log(`  - ${d.dbName}`);
  console.log(`    missing in DB: ${d.missing.join(", ")}`);
  if (d.extras.length > 0) console.log(`    extras in DB:  ${d.extras.slice(0, 8).join(", ")}${d.extras.length > 8 ? "..." : ""}`);
}
await pool.end();
