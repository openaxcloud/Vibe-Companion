-- Publishing Analytics & Monitoring Migration
-- Adds new columns to deployment_analytics, creates deployment_logs and resource_snapshots tables

ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "status_code" integer;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "browser" text;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "device" text;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "os" text;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "visitor_id" text;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "ip_hash" text;
ALTER TABLE "deployment_analytics" ADD COLUMN IF NOT EXISTS "country" text;

CREATE TABLE IF NOT EXISTS "deployment_logs" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "deployment_id" varchar(36),
  "level" text NOT NULL DEFAULT 'info',
  "message" text NOT NULL,
  "source" text NOT NULL DEFAULT 'stdout',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resource_snapshots" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "cpu_percent" integer NOT NULL DEFAULT 0,
  "memory_mb" integer NOT NULL DEFAULT 0,
  "heap_mb" integer,
  "recorded_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_deployment_analytics_project_created" ON "deployment_analytics" ("project_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_deployment_logs_project_created" ON "deployment_logs" ("project_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_resource_snapshots_project_recorded" ON "resource_snapshots" ("project_id", "recorded_at" DESC);
