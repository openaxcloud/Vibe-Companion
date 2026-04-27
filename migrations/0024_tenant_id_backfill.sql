-- 2026-04-27 — Critical-path audit (continued).
-- The persistence-engine.ts tenant-isolation layer queries
-- `WHERE projects.tenant_id = $1`, but most existing project rows
-- were created before tenant_id was populated. With tenant_id NULL,
-- the WHERE clause never matches → /api/projects/:id/files/:fileId
-- returns 500 (never finds the project after passing the access
-- check).
--
-- Backfill: for personal projects, tenant_id = owner_id (legacy int)
-- — that's the architecture the persistence engine assumes.

UPDATE projects
SET tenant_id = owner_id
WHERE tenant_id IS NULL
  AND owner_id IS NOT NULL;

-- Newer projects (created via the new Drizzle path) only have user_id
-- set — owner_id stays NULL. Cast and copy from there.
UPDATE projects
SET tenant_id = NULLIF(user_id, '')::int
WHERE tenant_id IS NULL
  AND user_id ~ '^[0-9]+$';

-- Same for new INSERTs that omit tenant_id but have user_id only.
CREATE OR REPLACE FUNCTION sync_project_tenant_id_v2() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS NOT NULL THEN
    NEW.tenant_id := NEW.owner_id;
  ELSIF NEW.user_id ~ '^[0-9]+$' THEN
    NEW.tenant_id := NULLIF(NEW.user_id, '')::int;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_tenant_id_sync ON projects;
DROP TRIGGER IF EXISTS projects_tenant_id_sync_v2 ON projects;
CREATE TRIGGER projects_tenant_id_sync_v2
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_tenant_id_v2();

-- Trigger so any new INSERT that omits tenant_id still gets it from
-- owner_id. (Belt-and-suspenders: storage.createProject already sets
-- tenant_id but legacy paths might not.)
CREATE OR REPLACE FUNCTION sync_project_tenant_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.tenant_id := NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_tenant_id_sync ON projects;
CREATE TRIGGER projects_tenant_id_sync
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_tenant_id();
