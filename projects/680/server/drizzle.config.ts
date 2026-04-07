import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for drizzle config.");
}

const schemaDir = process.env.DRIZZLE_SCHEMA_DIR || "./server/db/schema";
const migrationsDir = process.env.DRIZZLE_MIGRATIONS_DIR || "./server/db/migrations";

export default {
  schema: schemaDir,
  out: migrationsDir,
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
  verbose: process.env.DRIZZLE_VERBOSE === "true",
  strict: true,
} satisfies Config;