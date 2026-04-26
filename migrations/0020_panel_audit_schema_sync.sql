-- 2026-04-26 — Panel audit schema sync
--
-- The live DB had drifted from the Drizzle schema in shared/schema.ts:
--   - ai_usage_logs:    table missing entirely (legacy-ai-usage-tracking
--                       router failed to load every boot)
--   - project_env_vars: table missing (env-var migration loop logged
--                       "relation does not exist" on every boot)
--   - system_settings:  exists with extra columns (description, encrypted,
--                       created_at) that the schema doesn't declare. The
--                       Slack alert service was inserting `description`
--                       which IS in the live DB but NOT in the schema,
--                       causing a confusing "null value in column id"
--                       error. Aligning the schema is safer than dropping
--                       the columns from prod.
--
-- This migration is idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF
-- NOT EXISTS) so it's safe to re-run.

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(36) NOT NULL,
  project_id      VARCHAR(36),
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  endpoint        TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_cents      REAL NOT NULL DEFAULT 0,
  credential_mode TEXT NOT NULL DEFAULT 'managed',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_idx    ON ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_project_idx ON ai_usage_logs (project_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx ON ai_usage_logs (created_at);

CREATE TABLE IF NOT EXISTS project_env_vars (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      VARCHAR(36) NOT NULL,
  key             TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS env_vars_project_id_idx ON project_env_vars (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS env_vars_project_key_unique ON project_env_vars (project_id, key);
