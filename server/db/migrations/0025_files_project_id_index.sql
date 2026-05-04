-- perf: the files table had no index on project_id, causing a full sequential
-- scan on every getFiles(projectId) call (measured: 6.3 s under load on a
-- table with ~50 k rows).  CONCURRENTLY avoids an ACCESS EXCLUSIVE lock so
-- existing reads/writes are not blocked during the build.
CREATE INDEX CONCURRENTLY IF NOT EXISTS files_project_id_idx
  ON files (project_id);
