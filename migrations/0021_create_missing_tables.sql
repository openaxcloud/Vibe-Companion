-- 2026-04-27 — Create the tables still missing from the live DB so
-- GET /api/projects/:id stops 500-ing on `relation "project_invites"
-- does not exist`. That 500 was the root cause of the IDE freezing on
-- the "Loading workspace..." splash (Phase A audit).
--
-- All idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS) so it's safe to re-run after partial application.
--
-- Note: the projects table has a long-standing dual-column drift
-- (`owner_id integer` legacy + `user_id varchar NOT NULL` from the
-- Drizzle schema). The Drizzle code path uses `user_id`, so the IDE
-- works once `project_invites` exists — we leave `owner_id` in place
-- to avoid breaking anything that still reads it.

CREATE TABLE IF NOT EXISTS project_invites (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  VARCHAR(36) NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer',
  invited_by  VARCHAR(36) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_invites_project_idx ON project_invites (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS project_invites_project_email_unique ON project_invites (project_id, email);

CREATE TABLE IF NOT EXISTS community_replies (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      VARCHAR NOT NULL,
  user_id      VARCHAR NOT NULL,
  author_name  TEXT NOT NULL DEFAULT 'Anonymous',
  content      TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS community_replies_post_idx ON community_replies (post_id);

CREATE TABLE IF NOT EXISTS community_likes (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     VARCHAR NOT NULL,
  user_id     VARCHAR NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS community_likes_unique ON community_likes (post_id, user_id);

CREATE TABLE IF NOT EXISTS plan_configs (
  id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  plan              TEXT NOT NULL UNIQUE,
  daily_executions  INTEGER NOT NULL,
  daily_ai_calls    INTEGER NOT NULL,
  storage_mb        INTEGER NOT NULL,
  max_projects      INTEGER NOT NULL,
  price             INTEGER NOT NULL,
  description       TEXT,
  features          TEXT[]
);

CREATE TABLE IF NOT EXISTS integration_catalog (
  id                 VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL UNIQUE,
  category           TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  icon               TEXT NOT NULL DEFAULT 'plug',
  env_var_keys       JSON NOT NULL DEFAULT '[]'::json,
  connector_type     TEXT NOT NULL DEFAULT 'apikey',
  connection_level   TEXT NOT NULL DEFAULT 'project',
  oauth_config       JSON,
  provider_url       TEXT
);

CREATE TABLE IF NOT EXISTS artifact_templates (
  id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  output_type         TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  files               JSON NOT NULL DEFAULT '[]'::json,
  dependencies        JSON NOT NULL DEFAULT '{}'::json,
  build_command       TEXT,
  run_command         TEXT,
  system_prompt_hint  TEXT
);
CREATE INDEX IF NOT EXISTS artifact_templates_output_type_idx ON artifact_templates (output_type);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL,
  email       TEXT,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id);

-- project_collaborators is missing the `added_by` column declared in the
-- Drizzle schema. The live DB has integer IDs (legacy), so we add the
-- column as VARCHAR with a default of '' to keep INSERTs working until
-- the data is backfilled.
ALTER TABLE project_collaborators ADD COLUMN IF NOT EXISTS added_by VARCHAR(36) NOT NULL DEFAULT '';
