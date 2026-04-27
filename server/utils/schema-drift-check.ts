/**
 * Boot-time schema drift detector.
 *
 * Compares tables declared in shared/schema.ts (Drizzle pgTable exports) to
 * what actually exists in the live database. Emits a structured warning if
 * drift is detected. Does NOT throw — drift is a known debt state and the
 * platform is designed to limp along when individual tables are missing
 * (each route catches "relation does not exist" and returns 500). The goal
 * here is to make the drift visible at boot so it's never invisible debt.
 *
 * Run manually: `node scripts/audit-schema-drift.mjs`
 * Production hook: called from server/index.ts after DB connect.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../db";

export interface SchemaDriftReport {
  schemaTables: number;
  dbTables: number;
  missingInDb: string[];
  extraInDb: string[];
  driftTotal: number;
}

let cachedReport: SchemaDriftReport | null = null;

export async function detectSchemaDrift(): Promise<SchemaDriftReport> {
  if (cachedReport) return cachedReport;

  const schemaPath = resolve(process.cwd(), "shared/schema.ts");
  const src = readFileSync(schemaPath, "utf8");
  const re = /^export const \w+ = pgTable\(["']([^"']+)["']/gm;
  const schemaTables = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) schemaTables.add(m[1]);

  const { rows } = await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
  const dbTables = new Set(rows.map((r) => r.table_name));

  const missingInDb = [...schemaTables].filter((t) => !dbTables.has(t)).sort();
  const extraInDb = [...dbTables]
    .filter((t) => !schemaTables.has(t))
    .filter((t) => !t.endsWith("_legacy_archived"))
    .sort();

  cachedReport = {
    schemaTables: schemaTables.size,
    dbTables: dbTables.size,
    missingInDb,
    extraInDb,
    driftTotal: missingInDb.length + extraInDb.length,
  };
  return cachedReport;
}

export async function logSchemaDriftAtBoot(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const r = await detectSchemaDrift();
    if (r.driftTotal === 0) {
      console.log(`[schema] ✅ No drift — ${r.schemaTables} tables in sync between shared/schema.ts and the live DB.`);
      return;
    }

    const isProd = process.env.NODE_ENV === "production";
    const head = `[schema] ⚠️  Drift detected (schema=${r.schemaTables} db=${r.dbTables}): ${r.missingInDb.length} missing in DB, ${r.extraInDb.length} extra in DB (excluding *_legacy_archived).`;
    if (isProd) {
      console.warn(head);
      console.warn(`[schema] Run \`node scripts/audit-schema-drift.mjs\` for the full list. Routes that hit a missing table will return 500. Backfill via drizzle-kit migrations or scripted CREATE TABLE statements.`);
    } else {
      console.warn(head);
      const sample = r.missingInDb.slice(0, 5);
      if (sample.length) console.warn(`[schema] Examples missing in DB: ${sample.join(", ")}${r.missingInDb.length > 5 ? ", ..." : ""}`);
    }
  } catch (err: any) {
    console.warn(`[schema] Drift check failed: ${err?.message || err}`);
  }
}
