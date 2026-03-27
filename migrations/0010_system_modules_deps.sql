CREATE TABLE IF NOT EXISTS "system_modules" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "name" text NOT NULL,
  "version" text
);

CREATE TABLE IF NOT EXISTS "system_deps" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "name" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "system_modules_project_idx" ON "system_modules" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "system_deps_project_idx" ON "system_deps" USING btree ("project_id");
