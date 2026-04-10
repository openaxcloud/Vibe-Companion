import { db, client } from "./db";
import * as schema from "@shared/schema";
import { getTableName } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve } from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createLogger } from './utils/logger';

const logger = createLogger('db-init');
const scryptAsync = promisify(scrypt);

const CORE_TABLES: string[] = [
  schema.users,
  schema.projects,
  schema.files,
  schema.deployments,
].map((t) => getTableName(t));

async function verifyCoreTablesExist(): Promise<{ ok: boolean; missing: string[] }> {
  try {
    const rows = await client`
      SELECT table_name::text
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${CORE_TABLES})
    `;
    const found = new Set(rows.map((r: any) => r.table_name));
    const missing = CORE_TABLES.filter((t) => !found.has(t));
    return { ok: missing.length === 0, missing };
  } catch (error: any) {
    logger.error('[DB Init] Core table verification query failed:', error.message);
    return { ok: false, missing: [...CORE_TABLES] };
  }
}

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

let migrationsEnsured = false;

/**
 * Ensure preferred_ai_model column exists in users table
 * This is a critical migration for multi-provider AI model selection
 * Runs automatically at startup - idempotent and safe
 */
async function ensurePreferredAiModelColumn() {
  try {
    // Check if column exists
    const [result] = await client`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'preferred_ai_model'
      ) as "exists";
    `;

    if (!result?.exists) {
      logger.info('[DB Init] Creating preferred_ai_model column...');
      
      // Create column with ALTER TABLE (safe, idempotent)
      await client`
        ALTER TABLE users 
        ADD COLUMN preferred_ai_model varchar;
      `;
      
      logger.info('[DB Init] ✓ preferred_ai_model column created successfully');
    } else {
      logger.info('[DB Init] ✓ preferred_ai_model column already exists');
    }
  } catch (error: any) {
    // Log error but don't crash - column might already exist
    logger.warn('[DB Init] Failed to ensure preferred_ai_model column:', error.message);
  }
}

async function ensureDatabaseMigrated(force = false) {
  if (migrationsEnsured && !force) {
    return;
  }

  const migrationsFolder = resolve(process.cwd(), "migrations");

  if (!existsSync(migrationsFolder)) {
    logger.warn(
      `Database migrations folder not found at ${migrationsFolder}. ` +
      "Automatic migration skipped. Run `npm run db:push` to create the schema manually.",
    );
    migrationsEnsured = true;
    return;
  }

  let isFreshDatabase = force;

  if (!isFreshDatabase) {
    try {
      const [row] = await client`
        select exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'users'
        ) as "exists";
      `;

      isFreshDatabase = !row?.exists;
    } catch (error) {
      logger.warn("Failed to inspect database schema, attempting automatic migration", error);
      isFreshDatabase = true;
    }
  }

  try {
    await migrate(db, { migrationsFolder });
    migrationsEnsured = true;
  } catch (migrationError: any) {
    // Check if error is due to existing enum types (which is safe to ignore)
    const errorMessage = migrationError?.message || '';
    const causeMessage = migrationError?.cause?.message || '';
    const fullErrorText = errorMessage + ' ' + causeMessage;
    
    const isEnumExistsError = fullErrorText.includes('already exists') && 
                               (fullErrorText.includes('type') || fullErrorText.includes('enum') || fullErrorText.includes('CREATE TYPE'));
    
    if (isEnumExistsError) {
      migrationsEnsured = true;
    } else {
      logger.error("Automatic database migration failed:", migrationError);
      throw migrationError;
    }
  }
}

// Initialize the database with default data
export async function initializeDatabase() {
  let retries = 3;
  let lastError = null;
  
  while (retries > 0) {
    try {
      await ensureDatabaseMigrated();
      
      await ensurePreferredAiModelColumn();

      const verification = await verifyCoreTablesExist();
      if (!verification.ok) {
        logger.warn(`[DB Init] Missing core tables: ${verification.missing.join(', ')}. Attempting migration...`);
        migrationsEnsured = false;
        await ensureDatabaseMigrated(true);
        const recheck = await verifyCoreTablesExist();
        if (!recheck.ok) {
          throw new Error(`Core tables still missing after migration: ${recheck.missing.join(', ')}`);
        }
      }
      logger.info('[DB Init] Core table verification passed');

      // Check if tables are created by checking if we have any users
      const users = await db.select().from(schema.users);
      if (users && users.length > 0) {
        return;
      }
    
    // Create admin user
    const adminPassword = await hashPassword("admin");
    const [admin] = await db.insert(schema.users).values({
      username: "admin",
      password: adminPassword,
      email: "admin@plot.local",
      displayName: "Administrator",
      bio: "Platform administrator"
    }).returning();
    
    // Create demo user
    const demoPassword = await hashPassword("password");
    const [demo] = await db.insert(schema.users).values({
      username: "demo",
      password: demoPassword,
      email: "demo@plot.local",
      displayName: "Demo User",
      bio: "Demo account for testing"
    }).returning();
    
    // Create a demo project
    const [project] = await db.insert(schema.projects).values({
      name: "My First Project",
      description: "A sample project to get started with PLOT",
      visibility: "private",
      language: "javascript",
      ownerId: demo.id
    }).returning();
    
    // Create some sample files
    await db.insert(schema.files).values({
      name: "index.html",
      path: "/index.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Welcome to PLOT</h1>
    <p>Your coding journey starts here</p>
  </header>
  
  <main>
    <p>This is a simple HTML page to help you get started.</p>
    <button id="myButton">Click Me!</button>
  </main>
  
  <script src="script.js"></script>
</body>
</html>`,
      isDirectory: false,
      projectId: project.id
    });
    
    await db.insert(schema.files).values({
      name: "styles.css",
      path: "/styles.css",
      content: `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 20px;
  color: #333;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

h1 {
  color: #0070F3;
}

button {
  background-color: #0070F3;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #005cc5;
}`,
      isDirectory: false,
      projectId: project.id
    });
    
    await db.insert(schema.files).values({
      name: "script.js",
      path: "/script.js",
      content: `// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const button = document.getElementById('myButton');
  
  // Add a click event listener
  button.addEventListener('click', function() {
    alert('Hello from PLOT! Your JavaScript is working!');
  });
});`,
      isDirectory: false,
      projectId: project.id
    });
    
      return; // Success - exit the function
      
    } catch (error) {
      lastError = error;
      logger.error(`Database initialization attempt failed:`, error.message);

      if (error?.code === '42P01' || /relation ".+" does not exist/.test(error?.message || "")) {
        // Table is missing even after our initial migration attempt. Force rerun migrations.
        try {
          logger.warn("Detected missing tables after initialization attempt. Retrying migrations...");
          migrationsEnsured = false; // allow ensureDatabaseMigrated to run again
          await ensureDatabaseMigrated(true);
        } catch (migrationError) {
          logger.error("Forced migration retry failed:", migrationError.message);
        }
      }

      retries--;

      if (retries > 0) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
      }
    }
  }
  
  // All retries failed
  logger.error("Failed to initialize database after all retries:", lastError);
  // Don't throw - let the server continue running
  // Database operations will fail gracefully when accessed
}