import { Pool } from "pg";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });
try {
  for (const t of ["notifications", "storage_objects"]) {
    const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log(`${t}: ${r.rows.length === 0 ? "(missing)" : r.rows.map(x=>x.column_name+":"+x.data_type).join(", ")}`);
  }
} finally { await pool.end(); }
