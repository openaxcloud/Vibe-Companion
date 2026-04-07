-- Drizzle SQL migration: add AI UX preference columns to dynamic_intelligence
-- Idempotent: uses IF NOT EXISTS to allow repeated runs safely

ALTER TABLE dynamic_intelligence
  ADD COLUMN IF NOT EXISTS improve_prompt_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_tab_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_resume_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_checkpoints boolean DEFAULT true;