-- Sync users table with shared/schema.ts (columns added over time that were missing
-- from pre-existing Replit DBs). Idempotent — safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS replit_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSON;
