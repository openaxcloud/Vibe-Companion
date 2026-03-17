CREATE TABLE IF NOT EXISTS ai_credential_configs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(36) NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'managed',
  api_key TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_cred_project_provider_idx ON ai_credential_configs(project_id, provider);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost INTEGER NOT NULL DEFAULT 0,
  credential_mode TEXT NOT NULL DEFAULT 'managed',
  endpoint TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON ai_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_project_idx ON ai_usage_logs(project_id);
