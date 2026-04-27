import { Pool } from "pg";
import { readFileSync } from "fs";

const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });

const schemaText = readFileSync("shared/schema.ts","utf8");
const tables = [];
const tableRe = /export const (\w+) = pgTable\(\s*["'`](\w+)["'`]\s*,\s*\{([\s\S]*?)\}\s*(?:,\s*\([\s\S]*?\))?\s*\)\s*;/g;
let m;
while ((m = tableRe.exec(schemaText)) !== null) {
  const [_, varName, dbName, body] = m;
  const colRe = /(\w+)\s*:\s*\w+\(\s*["'`](\w+)["'`]/g;
  const cols = [];
  let cm;
  while ((cm = colRe.exec(body)) !== null) cols.push(cm[2]);
  tables.push({ varName, dbName, cols });
}

const missing = [];
for (const { varName, dbName, cols } of tables) {
  const r = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [dbName]);
  if (r.rows.length === 0) missing.push({ varName, dbName });
}
console.log(JSON.stringify(missing, null, 2));
await pool.end();
