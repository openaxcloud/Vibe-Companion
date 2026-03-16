-- Migration: Add internalPort, externalPort, exposeLocalhost to port_configs
-- Non-destructive: deterministically assigns unique external ports per project

ALTER TABLE port_configs ADD COLUMN IF NOT EXISTS internal_port integer;
ALTER TABLE port_configs ADD COLUMN IF NOT EXISTS external_port integer;
ALTER TABLE port_configs ADD COLUMN IF NOT EXISTS expose_localhost boolean NOT NULL DEFAULT false;

-- Backfill internal_port from existing port column
UPDATE port_configs SET internal_port = port WHERE internal_port IS NULL;

-- Step 1: Set external_port = port where port is already in the allowed list
-- and no other row in the same project already claimed that external_port
WITH ranked AS (
  SELECT id, project_id, port,
         ROW_NUMBER() OVER (PARTITION BY project_id, port ORDER BY created_at) AS rn
  FROM port_configs
  WHERE external_port IS NULL
    AND port IN (80, 3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081)
)
UPDATE port_configs pc SET external_port = pc.port
FROM ranked r
WHERE pc.id = r.id AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM port_configs other
    WHERE other.project_id = pc.project_id AND other.external_port = pc.port AND other.id != pc.id
  );

-- Step 2: For all remaining rows with NULL external_port,
-- assign unique external ports per project from the allowed list
WITH allowed_ports AS (
  SELECT unnest(ARRAY[80, 3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081]) AS ep,
         generate_series(1, 14) AS idx
),
used_ports AS (
  SELECT project_id, external_port AS ep FROM port_configs WHERE external_port IS NOT NULL
),
unassigned AS (
  SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY port, created_at) AS rn
  FROM port_configs
  WHERE external_port IS NULL
),
available AS (
  SELECT ap.ep, u.project_id,
         ROW_NUMBER() OVER (PARTITION BY u.project_id ORDER BY ap.idx) AS slot
  FROM allowed_ports ap
  CROSS JOIN (SELECT DISTINCT project_id FROM unassigned) u
  WHERE NOT EXISTS (
    SELECT 1 FROM used_ports up WHERE up.project_id = u.project_id AND up.ep = ap.ep
  )
),
assignments AS (
  SELECT un.id, av.ep AS new_external_port
  FROM unassigned un
  JOIN available av ON av.project_id = un.project_id AND av.slot = un.rn
)
UPDATE port_configs pc SET external_port = a.new_external_port
FROM assignments a WHERE pc.id = a.id;

-- Step 3: For any remaining rows that exceeded the 14 allowed slots per project,
-- mark them as non-public (is_public = false) and assign a fallback external_port
-- using their internal_port value. This preserves the data without deletion.
UPDATE port_configs SET external_port = internal_port, is_public = false
WHERE external_port IS NULL;

-- Step 4: Resolve any (project_id, internal_port) duplicates by incrementing
-- internal_port on later entries (preserves all rows)
WITH dupes AS (
  SELECT id, project_id, internal_port,
         ROW_NUMBER() OVER (PARTITION BY project_id, internal_port ORDER BY created_at) AS rn
  FROM port_configs
)
UPDATE port_configs pc SET internal_port = pc.internal_port + d.rn - 1
FROM dupes d WHERE pc.id = d.id AND d.rn > 1;

-- Step 5: Resolve any (project_id, external_port) duplicates similarly
WITH dupes AS (
  SELECT id, project_id, external_port,
         ROW_NUMBER() OVER (PARTITION BY project_id, external_port ORDER BY created_at) AS rn
  FROM port_configs
)
UPDATE port_configs pc SET external_port = pc.external_port + d.rn - 1, is_public = false
FROM dupes d WHERE pc.id = d.id AND d.rn > 1;

-- Make columns NOT NULL after backfill (all rows now have values)
ALTER TABLE port_configs ALTER COLUMN internal_port SET NOT NULL;
ALTER TABLE port_configs ALTER COLUMN external_port SET NOT NULL;

-- Add unique indexes for concurrent safety
CREATE UNIQUE INDEX IF NOT EXISTS port_configs_project_internal_unique ON port_configs (project_id, internal_port);
CREATE UNIQUE INDEX IF NOT EXISTS port_configs_project_external_unique ON port_configs (project_id, external_port);
