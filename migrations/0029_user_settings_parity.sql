-- 0029_user_settings_parity.sql
-- Adds location column to users table and creates user_api_tokens table
-- for the user settings parity audit (Task #148).

ALTER TABLE users ADD COLUMN IF NOT EXISTS location varchar;

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  last_used_at timestamp,
  expires_at timestamp
);

CREATE INDEX IF NOT EXISTS user_api_tokens_user_id_idx ON user_api_tokens(user_id);
