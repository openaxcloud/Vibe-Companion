-- Migration: Add storage bucket system for App Storage v2
-- Creates storage_buckets, bucket_access tables and extends storage_objects

CREATE TABLE IF NOT EXISTS storage_buckets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  owner_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bucket_access (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bucket_id VARCHAR(36) NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
  project_id VARCHAR(36) NOT NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bucket_id, project_id)
);

ALTER TABLE storage_objects ADD COLUMN IF NOT EXISTS bucket_id VARCHAR(36) REFERENCES storage_buckets(id);
ALTER TABLE storage_objects ADD COLUMN IF NOT EXISTS folder_path TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage_objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_bucket_id ON bucket_access(bucket_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_project_id ON bucket_access(project_id);

-- Backfill Phase 1: Create a default bucket for each project with orphaned objects
-- Only processes projects that have a valid project->user relationship (INNER JOIN)
-- Projects without a valid user are skipped safely (objects remain with null bucket_id)
DO $$
DECLARE
  proj RECORD;
  new_bucket_id VARCHAR(36);
BEGIN
  FOR proj IN
    SELECT DISTINCT so.project_id, p.user_id AS owner_id
    FROM storage_objects so
    INNER JOIN projects p ON p.id = so.project_id
    WHERE so.bucket_id IS NULL
      AND so.project_id != '__folder__'
      AND p.user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM bucket_access ba WHERE ba.project_id = so.project_id
      )
  LOOP
    new_bucket_id := gen_random_uuid()::text;

    INSERT INTO storage_buckets (id, name, owner_user_id)
    VALUES (new_bucket_id, 'Default Bucket', proj.owner_id);

    INSERT INTO bucket_access (bucket_id, project_id)
    VALUES (new_bucket_id, proj.project_id)
    ON CONFLICT (bucket_id, project_id) DO NOTHING;

    UPDATE storage_objects
    SET bucket_id = new_bucket_id
    WHERE project_id = proj.project_id
      AND bucket_id IS NULL
      AND project_id != '__folder__';
  END LOOP;
END $$;

-- Backfill Phase 2: Assign remaining orphaned objects whose project already has
-- a bucket_access entry (from a previously created bucket)
UPDATE storage_objects so
SET bucket_id = (
  SELECT ba.bucket_id
  FROM bucket_access ba
  WHERE ba.project_id = so.project_id
  ORDER BY ba.granted_at ASC
  LIMIT 1
)
WHERE so.bucket_id IS NULL
  AND so.project_id != '__folder__'
  AND EXISTS (
    SELECT 1 FROM bucket_access ba WHERE ba.project_id = so.project_id
  );
