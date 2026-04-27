import { Pool } from "pg";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].replace(/^["']|["']$/g,"");
const pool = new Pool({ connectionString: url });
try {
  const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notification_preferences' ORDER BY ordinal_position`);
  console.log("Columns:", r.rows.map(x=>x.column_name+":"+x.data_type).join(", ") || "(none — table missing)");
} finally { await pool.end(); }
