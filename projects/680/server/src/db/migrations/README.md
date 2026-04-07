# Database Migrations with drizzle-kit

This document explains how database migrations are generated and applied in this project using drizzle and drizzle-kit.

The examples assume:
- You are in the `server` directory
- You have Node.js and npm (or pnpm/yarn) installed
- Environment variables for the database are correctly configured

Adjust paths and commands as needed for your setup.

---

## Overview

We use:
- drizzle-orm for type-safe database access
- drizzle-kit as our schema/migration tool
- SQL migration files committed to source control

Migrations are:
- Generated from the TypeScript schema
- Stored in versioned SQL files
- Applied via the drizzle CLI or at application startup

---

## Key Files and Directories

- drizzle.config.ts
  - drizzle-kit configuration
  - Points to:
    - Database connection details
    - Schema source files
    - Migrations output directory

- src/db/schema/*
  - Source of truth for database schema
  - Tables, enums, relations, etc. are defined here in TypeScript
  - Any schema change begins here

- src/db/migrations/*
  - Contains SQL migration files
  - Each migration file is immutable once merged
  - File naming is timestamp-based for ordering

---

## Installation

Install drizzle packages in the server project:

npm:
  npm install drizzle-orm drizzle-kit
  npm install -D @types/node ts-node typescript

or pnpm:
  pnpm add drizzle-orm drizzle-kit
  pnpm add -D @types/node ts-node typescript

or yarn:
  yarn add drizzle-orm drizzle-kit
  yarn add -D @types/node ts-node typescript

Ensure you have a `tsconfig.json` at the project root if not already present.

---

## Configuration (drizzle.config.ts)

Typical configuration (for reference; actual file may differ):

- Specifies:
  - schema: path to TS schema files
  - out: output folder for SQL migrations (e.g., "src/db/migrations")
  - driver: database driver (e.g., "pg" for Postgres)
  - dbCredentials: connection URL or components

When you change schema files, drizzle-kit uses this config to generate migrations.

If you change any of:
- Database name/URL
- Schema file locations
- Output directory

then update drizzle.config.ts accordingly.

---

## Environment Variables

drizzle-kit usually reads database connection information from environment variables or directly from drizzle.config.ts.

Common variables:
- DATABASE_URL or DB_URL or POSTGRES_URL (depending on your config)

Typical Postgres-style URL:
postgresql://USER:PASSWORD@HOST:PORT/DB_NAME

Set the env variables before running any commands:

On macOS/Linux:
  export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

On Windows (PowerShell):
  $env:DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

You may also have a `.env` file at the `server` root. If so, ensure:
- drizzle.config.ts is configured to load from `.env` (e.g., using dotenv), or
- Your migration scripts load env variables before running drizzle-kit

---

## Development Workflow

High-level steps:

1. Update the TypeScript schema in `src/db/schema`
2. Generate a new migration
3. Review the generated SQL
4. Apply the migration to your local database
5. Commit both:
   - Schema changes (TypeScript)
   - Generated SQL migration files

Never manually edit existing migration files after they have been applied to shared environments (e.g., dev/staging/prod).

---

## Generating Migrations

After modifying the schema files under `src/db/schema`, generate a migration.

Common command (adjust to your package manager and script setup):

If using npx directly:
  npx drizzle-kit generate

If you have a package.json script (recommended):

In package.json:
  "scripts": {
    "db:generate": "drizzle-kit generate"
  }

Then run:
  npm run db:generate
  # or
  pnpm db:generate
  # or
  yarn db:generate

drizzle-kit will:
- Compare the current database schema (if reachable) or previous snapshots with the TypeScript schema
- Create a new SQL migration in `src/db/migrations` (or your configured path)
- Name it with a timestamp prefix to ensure order

Example output file:
  src/db/migrations/20250101094500_add_users_table.sql

---

## Reviewing Generated SQL

Always review each new migration file before applying or committing it.

Check for:
- Dropping columns/tables that might accidentally delete data
- Unintended type changes or constraints
- Index/constraint names and whether they match your conventions

If the generated SQL is incorrect:
- Fix your schema definition in `src/db/schema`
- Delete the just-generated migration file
- Re-run the generation command

Avoid editing the SQL migration manually unless you fully understand the implications.

---

## Applying Migrations (Local Development)

You can apply migrations in two main ways:

1. Via drizzle-kit migrate command
2. Via application startup logic (if implemented)

### Option 1: Using drizzle-kit migrate

If configured in drizzle.config.ts with proper db credentials:

Directly:
  npx drizzle-kit migrate

Or via package.json script:
  "scripts": {
    "db:migrate": "drizzle-kit migrate"
  }

Then:
  npm run db:migrate
  # or
  pnpm db:migrate
  # or
  yarn db:migrate

This:
- Connects to the target database
- Applies any pending SQL migrations in order
- Records applied migrations (typically in a drizzle-specific metadata table)

### Option 2: Application Startup

Some projects:
- Use drizzle ORM programmatically to run migrations at startup
- Or run a separate `node`/`ts-node` script that calls drizzle’s migration API

If your project includes such a script (e.g., `src/db/runMigrations.ts`), you might have scripts like:

  "scripts": {
    "db:migrate:app": "ts-node src/db/runMigrations.ts"
  }

Use that instead of or in addition to drizzle-kit migrate, depending on your setup.

Check your package.json and src/db directory for an existing migration runner script.

---

## Typical Local Workflow Example

1. Start from an up-to-date main branch:
   - git pull origin main
   - npm install (or pnpm/yarn)

2. Reset and prepare your local DB (optional but common for new features):
   - Drop and recreate database if needed
   - Ensure DATABASE_URL is set

3. Apply existing migrations:
   npm run db:migrate

4. Make schema changes:
   - Edit/create files in src/db/schema
   - Add tables, columns, indexes, relations, enums, etc.

5. Generate a migration:
   npm run db:generate

6. Review the new SQL file in src/db/migrations.

7. Apply the new migration locally:
   npm run db:migrate

8. Run tests and app to ensure everything works.

9. Commit:
   - Schema changes (TS)
   - New SQL migration file(s)
   - Any related code (models, services, etc.)

---

## Handling Common Scenarios

### Adding a New Table

1. Create a new schema file in src/db/schema (or extend an existing one)
2. Define your table and columns using drizzle-orm
3. Generate migration:
   npm run db:generate
4. Review and then apply migrations:
   npm run db:migrate

### Modifying an Existing Column

1. Change the column definition in the schema
2. Generate migration
3. Carefully review the SQL (look for data-destructive operations)
4. Apply migration

If you need to preserve and transform data, you may have to:
- Adjust the generated SQL manually, or
- Use a custom SQL statement for data copying, default filling, etc.

### Renaming Columns or Tables

drizzle-kit may treat renames as drop-and-add operations, which can delete data.

For safe renames:
- Consider writing manual SQL in a new migration:
  - ALTER TABLE ... RENAME COLUMN ...
  - ALTER TABLE ... RENAME TO ...
- Or plan a two-step migration:
  - Add new column
  - Backfill data
  - Drop old column in a subsequent migration, once safe

Always test on a copy of your data before applying to shared environments.

---

## Migrations in CI/CD

Typical CI pipeline includes:

1. Install dependencies
2. Set DATABASE_URL to a temporary CI database
3. Run:
   npm run db:migrate
4. Run tests

For production deployment:

- Migrations may be:
  - Run as a pre-deploy or post-deploy step
  - Run manually before deploying new code
- Ensure the same migration files are used across all environments
- Never re-generate or modify existing migrations after they have run in production

---

## Best Practices

- Source of Truth:
  - Treat `src/db/schema` (TypeScript) as your primary schema definition
  - Migrations are generated from it and then become the immutable history

- Never edit applied migrations:
  - Once applied to any shared environment (dev/stage/prod), consider that migration locked
  - For changes, create a new migration

- Always review SQL:
  - Especially for ALTER TABLE operations
  - Look for data loss risks

- Keep migrations small and focused:
  - One logical change per migration when