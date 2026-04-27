-- 2026-04-27 — Critical-path audit, follow-up to 0021.
-- After unblocking the IDE splash (commit 1cfed00f) and fixing the
-- React Rules-of-Hooks violation in UnifiedIDELayout.tsx, prompt-to-app
-- crashed on `relation "ai_plans" does not exist`. /api/themes and
-- /api/themes/installed also 500'd on every IDE load.
--
-- Drift detected on `themes`: a legacy table existed (id integer,
-- slug, name, author_id integer, …) totally incompatible with the
-- Drizzle schema (id varchar, user_id varchar, title, base_scheme,
-- global_colors jsonb, …). The legacy table was empty (0 rows
-- confirmed via scripts/check-themes-rows.mjs), so we rename it to
-- `themes_legacy_archived` (preserve in case some legacy code path
-- still grep's for it) and recreate the new schema.
--
-- All idempotent.

CREATE TABLE IF NOT EXISTS ai_plans (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  model       TEXT NOT NULL DEFAULT 'gpt',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_plan_project_idx ON ai_plans (project_id);
CREATE INDEX IF NOT EXISTS ai_plan_user_idx ON ai_plans (user_id);

DO $$
BEGIN
  -- Only rename if the legacy schema is still in place (id integer).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'themes' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE themes RENAME TO themes_legacy_archived;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS themes (
  id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(36) NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  base_scheme   TEXT NOT NULL DEFAULT 'dark',
  global_colors JSONB NOT NULL,
  syntax_colors JSONB NOT NULL,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  install_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS themes_user_idx ON themes (user_id);
CREATE INDEX IF NOT EXISTS themes_published_idx ON themes (is_published);

CREATE TABLE IF NOT EXISTS installed_themes (
  id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      VARCHAR(36) NOT NULL,
  theme_id     VARCHAR(36) NOT NULL,
  installed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS installed_themes_user_theme_idx ON installed_themes (user_id, theme_id);
CREATE INDEX IF NOT EXISTS installed_themes_user_idx ON installed_themes (user_id);
