CREATE TABLE IF NOT EXISTS "checkpoints" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "type" text NOT NULL DEFAULT 'manual',
  "trigger" text NOT NULL DEFAULT 'manual',
  "state_snapshot" json NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "checkpoints_project_idx" ON "checkpoints" ("project_id");
CREATE INDEX IF NOT EXISTS "checkpoints_created_idx" ON "checkpoints" ("created_at");

CREATE TABLE IF NOT EXISTS "checkpoint_positions" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL UNIQUE,
  "current_checkpoint_id" varchar(36),
  "diverged_from_id" varchar(36),
  "updated_at" timestamp DEFAULT now() NOT NULL
);
