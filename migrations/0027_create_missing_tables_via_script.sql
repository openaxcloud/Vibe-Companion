-- 0027_create_missing_tables_via_script.sql
-- This migration is a marker. The actual table creation was done via
-- `npx tsx scripts/create-missing-tables.mts`, which iterates every
-- pgTable() declaration in shared/schema.ts and runs CREATE TABLE
-- (skipping any that already exist).
--
-- Why a script and not raw SQL: 103 tables × ~10-30 columns each = a
-- ~3000-line SQL file that goes stale every time someone adds a column
-- to shared/schema.ts. The script always reflects the current Drizzle
-- declarations and is idempotent (skips existing tables).
--
-- To re-apply on a fresh DB:
--   npx tsx scripts/create-missing-tables.mts
--
-- The script does NOT touch tables that already exist with drifted
-- columns — those need targeted realign migrations (see 0023, 0025,
-- 0026 for the pattern).

SELECT 1;
