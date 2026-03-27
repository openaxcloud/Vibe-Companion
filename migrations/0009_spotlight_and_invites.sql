-- Spotlight: add project metadata columns
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "fork_count" integer NOT NULL DEFAULT 0;

-- Spotlight: create project invites table
CREATE TABLE IF NOT EXISTS "project_invites" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'viewer',
  "invited_by" varchar(36) NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_invites_project_idx" ON "project_invites" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "project_invites_project_email_unique" ON "project_invites" ("project_id", "email");
