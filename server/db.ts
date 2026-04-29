import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on("error", (err) => {
  console.warn("[db.pool] idle client error (will be replaced):", err?.message || err);
});

export const db = drizzle(pool, { schema });
