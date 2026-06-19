-- Migration 0028: RBAC role constraints on project_collaborators and project_invites
-- Adds CHECK constraints so only owner/editor/viewer (and legacy admin) are accepted.
-- Safe to run multiple times (DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT).

-- project_collaborators: valid roles are 'owner', 'editor', 'viewer', 'admin' (legacy)
DO $$
BEGIN
  BEGIN
    ALTER TABLE project_collaborators
      ADD CONSTRAINT project_collaborators_role_check
      CHECK (role IN ('owner', 'editor', 'viewer', 'admin'));
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- constraint already exists
  END;
END $$;

-- project_invites: roles sent out are 'editor' or 'viewer' only
DO $$
BEGIN
  BEGIN
    ALTER TABLE project_invites
      ADD CONSTRAINT project_invites_role_check
      CHECK (role IN ('editor', 'viewer'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Normalise any existing rows that have stale/invalid roles.
-- 'member' → 'editor', anything else unrecognised → 'viewer'.
UPDATE project_collaborators
  SET role = CASE
    WHEN role IN ('owner', 'editor', 'viewer', 'admin') THEN role
    WHEN role = 'member' THEN 'editor'
    ELSE 'viewer'
  END
WHERE role NOT IN ('owner', 'editor', 'viewer', 'admin');

UPDATE project_invites
  SET role = CASE
    WHEN role IN ('editor', 'viewer') THEN role
    ELSE 'viewer'
  END
WHERE role NOT IN ('editor', 'viewer');
