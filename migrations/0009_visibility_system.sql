-- Add visibility column to projects (backfill from isPublished)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- Backfill: unpublished projects become private
UPDATE projects SET visibility = 'private' WHERE is_published = false AND visibility = 'public';

-- Create project_guests table for invited guest access
CREATE TABLE IF NOT EXISTS project_guests (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by VARCHAR(36) NOT NULL,
  token TEXT NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_guests_project_idx ON project_guests(project_id);
CREATE INDEX IF NOT EXISTS project_guests_email_idx ON project_guests(email);
CREATE INDEX IF NOT EXISTS project_guests_user_idx ON project_guests(user_id);
