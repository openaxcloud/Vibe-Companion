import { Pool, PoolConfig } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let dbInstance: Database | null = null;

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
};

const createPool = (): Pool => {
  const connectionString = getDatabaseUrl();

  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(
      process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000
    ),
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
          }
        : undefined,
  };

  return new Pool(config);
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const db: Database = (() => {
  if (!dbInstance) {
    pool = getPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
})();

export const closeDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
};