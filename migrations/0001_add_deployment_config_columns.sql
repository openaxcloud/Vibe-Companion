ALTER TABLE deployments ADD COLUMN IF NOT EXISTS response_headers json;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rewrites json;
