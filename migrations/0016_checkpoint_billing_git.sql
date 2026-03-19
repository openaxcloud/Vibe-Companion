-- Add billing tracking and git integration to checkpoints
ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "size_bytes" integer NOT NULL DEFAULT 0;
ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "credits_cost" real NOT NULL DEFAULT 0;
ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "git_commit_hash" text;
