-- 2026-04-27 — Critical-path audit (continued).
-- Found while validating the prompt-to-app + terminal flow:
--   * /ws/terminal connects but immediately fails with
--     `relation "account_env_var_links" does not exist`
--     (terminal materializes a project's env vars on PTY start).
--   * `automations` table missing — non-blocking, just spam at boot.
--   * /api/projects/:id/deployments 500 — same drift as `themes`:
--     legacy table exists (id integer, user_id integer, …) but
--     incompatible with the Drizzle schema (id varchar, user_id
--     varchar, version, deployment_type, …). Legacy table has 11 rows
--     of data so we rename to `deployments_legacy_archived` rather
--     than drop.
--
-- All idempotent.

CREATE TABLE IF NOT EXISTS account_env_vars (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(36) NOT NULL,
  key             TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS account_env_vars_user_id_idx ON account_env_vars (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_env_vars_user_key_unique ON account_env_vars (user_id, key);

CREATE TABLE IF NOT EXISTS account_env_var_links (
  id                 VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  account_env_var_id VARCHAR(36) NOT NULL,
  project_id         VARCHAR(36) NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS account_env_var_links_project_idx ON account_env_var_links (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_env_var_links_unique ON account_env_var_links (account_env_var_id, project_id);

CREATE TABLE IF NOT EXISTS automations (
  id                    VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            VARCHAR(36) NOT NULL,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'cron',
  cron_expression       TEXT,
  webhook_token         TEXT,
  slack_bot_token       TEXT,
  slack_signing_secret  TEXT,
  telegram_bot_token    TEXT,
  bot_status            TEXT DEFAULT 'disconnected',
  script                TEXT NOT NULL DEFAULT '',
  language              TEXT NOT NULL DEFAULT 'javascript',
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at           TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS automations_project_idx ON automations (project_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE deployments RENAME TO deployments_legacy_archived;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS deployments (
  id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          VARCHAR(36) NOT NULL,
  user_id             VARCHAR(36) NOT NULL,
  version             INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'building',
  deployment_type     TEXT NOT NULL DEFAULT 'static',
  build_log           TEXT,
  url                 TEXT,
  build_command       TEXT,
  run_command         TEXT,
  machine_config      JSONB,
  max_machines        INTEGER DEFAULT 1,
  cron_expression     TEXT,
  schedule_description TEXT,
  job_timeout         INTEGER DEFAULT 300,
  public_directory    TEXT DEFAULT 'dist',
  app_type            TEXT DEFAULT 'web_server',
  deployment_secrets  JSONB,
  port_mapping        INTEGER DEFAULT 3000,
  is_private          BOOLEAN NOT NULL DEFAULT FALSE,
  show_badge          BOOLEAN NOT NULL DEFAULT TRUE,
  enable_feedback     BOOLEAN NOT NULL DEFAULT FALSE,
  response_headers    JSONB,
  rewrites            JSONB,
  process_port        INTEGER,
  last_health_check   TIMESTAMP,
  health_status       TEXT DEFAULT 'unknown',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMP
);
CREATE INDEX IF NOT EXISTS deployments_project_idx ON deployments (project_id);
CREATE INDEX IF NOT EXISTS deployments_user_idx ON deployments (user_id);
