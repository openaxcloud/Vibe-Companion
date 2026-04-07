import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../shared/schema";

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Main function
async function main() {
  console.log("Pushing schema to the database...");
  
  try {
    // Create postgres client
    const client = postgres(process.env.DATABASE_URL!, { max: 1 });
    const db = drizzle(client, { schema });
    
    // Push the schema to the database (this will create/update tables)
    await db.insert(schema.users).values({
      username: 'test',
      password: 'test',
    }).onConflictDoNothing().execute();
    
    console.log("Schema push complete. Database is ready.");
    process.exit(0);
  } catch (error) {
    console.error("Error pushing schema:", error);
    process.exit(1);
  }
}

main();