-- Fix workspace bootstrap failure: missing columns and tables that the
-- server code (workspace-bootstrap.router.ts, teams.router.ts) assumes
-- exist but were never migrated. Idempotent.

-- 1. projects.bootstrap_prompt — stored with each AI-generated project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bootstrap_prompt TEXT;

-- 2. artifacts table — created per project to hold generated app metadata
CREATE TABLE IF NOT EXISTS artifacts (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  VARCHAR(36)  NOT NULL,
  type        TEXT         NOT NULL DEFAULT 'web-app',
  name        TEXT         NOT NULL,
  entry_file  TEXT,
  settings    JSON         DEFAULT '{}',
  created_at  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifacts_project_id_idx ON artifacts(project_id);

-- 3. team_workspaces.description — schema.ts expects this column
ALTER TABLE team_workspaces ADD COLUMN IF NOT EXISTS description TEXT;
