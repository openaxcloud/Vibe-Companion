ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_dev_framework" boolean NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "framework_description" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "framework_category" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "framework_cover_url" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_official_framework" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "framework_updates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" varchar(36) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "framework_updates_framework_idx" ON "framework_updates" ("framework_id");
