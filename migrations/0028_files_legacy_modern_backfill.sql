-- 2026-04-29 — Backfill `files` to converge legacy and modern column families.
--
-- The live `files` table carries both legacy and modern column pairs:
--   filename (modern, NOT NULL DEFAULT '')   ↔   name (legacy, nullable)
--   is_directory (modern, default false)     ↔   is_folder (legacy, NOT NULL default false)
--
-- Older rows wrote to `name` / `is_folder`, modern code writes to
-- `filename` / `is_directory`. The schema converged on the modern fields
-- in commit 81680719, but existing rows can still have `filename = ''`
-- with the real value sitting in `name` (or in `path` for tree-position).
-- This migration fills the canonical column from whichever legacy field
-- carries the data, so reads through the modern column return the right
-- value for every row regardless of which writer landed it.
--
-- Idempotent: re-running this migration is a no-op (the WHERE clauses
-- only touch rows whose canonical column is still empty/NULL).
--
-- Rollback-safe: no columns dropped here. The legacy columns remain in
-- place until a later coordinated migration removes them — code reads
-- the canonical column from now on.

UPDATE files
SET filename = COALESCE(NULLIF(TRIM(name), ''), TRIM(LEADING '/' FROM path), '')
WHERE COALESCE(NULLIF(TRIM(filename), ''), '') = ''
  AND (NULLIF(TRIM(name), '') IS NOT NULL OR NULLIF(TRIM(path), '/') IS NOT NULL);

-- Mirror is_folder → is_directory for any row where the modern flag is
-- NULL or false but the legacy flag is true. (is_folder is NOT NULL in
-- the live schema, so no NULL handling needed there.)
UPDATE files
SET is_directory = TRUE
WHERE is_folder = TRUE
  AND (is_directory IS NULL OR is_directory = FALSE);
