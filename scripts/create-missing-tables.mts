import { Pool } from "pg";
import { readFileSync } from "fs";
import * as schema from "../shared/schema.js";
import { getTableConfig } from "drizzle-orm/pg-core";

const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)![1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });

// Map Drizzle column types to SQL
function colToSql(col: any): string {
  let sql = `"${col.name}" `;
  const dt = col.dataType;
  const ct = col.columnType;

  // Type
  if (ct === "PgVarchar") {
    const len = (col as any).length || 36;
    sql += `varchar(${len})`;
  } else if (ct === "PgText") sql += "text";
  else if (ct === "PgInteger") sql += "integer";
  else if (ct === "PgBigInt53" || ct === "PgBigInt64") sql += "bigint";
  else if (ct === "PgBoolean") sql += "boolean";
  else if (ct === "PgTimestamp") sql += "timestamp";
  else if (ct === "PgJson" || ct === "PgJsonb") sql += "jsonb";
  else if (ct === "PgUUID") sql += "uuid";
  else if (ct === "PgReal" || ct === "PgDoublePrecision") sql += "double precision";
  else if (ct === "PgNumeric") sql += "numeric";
  else if (ct === "PgArray") {
    const inner = (col as any).baseColumn?.columnType;
    if (inner === "PgText") sql += "text[]";
    else sql += "text[]"; // fallback
  } else {
    // Fallback for less common types
    sql += "text";
  }

  // PRIMARY KEY
  if (col.primary) sql += " PRIMARY KEY";
  // NOT NULL
  if (col.notNull) sql += " NOT NULL";
  // DEFAULT
  if (col.default !== undefined) {
    const def = col.default;
    if (def === null) sql += " DEFAULT NULL";
    else if (typeof def === "boolean") sql += ` DEFAULT ${def}`;
    else if (typeof def === "number") sql += ` DEFAULT ${def}`;
    else if (typeof def === "string") sql += ` DEFAULT '${def.replace(/'/g, "''")}'`;
    else if (def && typeof def === "object" && (def as any).queryChunks) {
      // SQL expression like sql`gen_random_uuid()`
      const chunks = (def as any).queryChunks.map((c: any) => c.value || c.toString()).join("");
      sql += ` DEFAULT ${chunks}`;
    }
  } else if ((col as any).hasDefault && (col as any).defaultFn === undefined) {
    // defaultNow()
    if (ct === "PgTimestamp") sql += " DEFAULT now()";
  }

  return sql;
}

async function main() {
  const allTables = Object.values(schema).filter(
    (v: any) => v && typeof v === "object" && Symbol.for("drizzle:Name") in (v as any)
  );

  let created = 0, skipped = 0, errors: string[] = [];

  for (const tbl of allTables) {
    try {
      const cfg = getTableConfig(tbl as any);
      const tableName = cfg.name;

      // Check if exists
      const r = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [tableName]);
      if (r.rows.length > 0) { skipped++; continue; }

      const colSqls = cfg.columns.map(colToSql);
      const sql = `CREATE TABLE "${tableName}" (\n  ${colSqls.join(",\n  ")}\n);`;

      console.log(`[create] ${tableName}`);
      await pool.query(sql);
      created++;
    } catch (e: any) {
      errors.push(`${(tbl as any).name || "?"}: ${e.message.split("\n")[0]}`);
    }
  }

  console.log(`\n✓ created: ${created}`);
  console.log(`  skipped (exists): ${skipped}`);
  console.log(`  errors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`    - ${e}`);
  if (errors.length > 10) console.log(`    ... +${errors.length - 10} more`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
