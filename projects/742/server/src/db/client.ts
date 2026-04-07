import { Pool, PoolConfig } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let dbInstance: Database | null = null;

const createPoolConfig = (): PoolConfig => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 10000),
  };

  if (process.env.NODE_ENV === "production") {
    config.ssl = {
      rejectUnauthorized:
        process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : true,
    };
  }

  return config;
};

const createPool = (): Pool => {
  if (pool) return pool;
  pool = new Pool(createPoolConfig());

  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("Unexpected error on idle PostgreSQL client", err);
  });

  return pool;
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const db: Database = (() => {
  if (!dbInstance) {
    const activePool = getPool();
    dbInstance = drizzle(activePool, { schema });
  }
  return dbInstance;
})();

export const closePool = async (): Promise<void> => {
  if (!pool) return;

  const currentPool = pool;
  pool = null;
  dbInstance = null;

  await currentPool.end();
};

export const withDb = async <T>(
  callback: (db: Database) => Promise<T> | T
): Promise<T> => {
  try {
    return await callback(db);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Database operation failed", error);
    throw error;
  }
};

process.on("beforeExit", async () => {
  try {
    await closePool();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error while closing PostgreSQL pool on beforeExit", error);
  }
});

process.on("SIGINT", async () => {
  try {
    await closePool();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error while closing PostgreSQL pool on SIGINT", error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  try {
    await closePool();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error while closing PostgreSQL pool on SIGTERM", error);
  } finally {
    process.exit(0);
  }
});