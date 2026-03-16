CREATE TABLE IF NOT EXISTS "themes" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "base_scheme" text NOT NULL DEFAULT 'dark',
  "global_colors" json NOT NULL,
  "syntax_colors" json NOT NULL,
  "is_published" boolean NOT NULL DEFAULT false,
  "install_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "themes_user_idx" ON "themes" ("user_id");
CREATE INDEX IF NOT EXISTS "themes_published_idx" ON "themes" ("is_published");

CREATE TABLE IF NOT EXISTS "installed_themes" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "theme_id" varchar(36) NOT NULL,
  "installed_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "installed_themes_user_idx" ON "installed_themes" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "installed_themes_user_theme_idx" ON "installed_themes" ("user_id", "theme_id");

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_type" text NOT NULL DEFAULT 'web';
