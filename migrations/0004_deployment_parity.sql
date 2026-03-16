ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "deployment_type" text NOT NULL DEFAULT 'static';
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "build_command" text;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "run_command" text;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "machine_config" json;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "max_machines" integer DEFAULT 1;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "cron_expression" text;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "schedule_description" text;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "job_timeout" integer DEFAULT 300;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "public_directory" text DEFAULT 'dist';
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "app_type" text DEFAULT 'web_server';
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "deployment_secrets" json;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "port_mapping" integer DEFAULT 3000;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "is_private" boolean NOT NULL DEFAULT false;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "show_badge" boolean NOT NULL DEFAULT true;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "enable_feedback" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "deployment_analytics" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "deployment_id" varchar(36) NOT NULL,
  "path" text DEFAULT '/',
  "referrer" text DEFAULT '',
  "user_agent" text DEFAULT '',
  "visitor_id" varchar(64),
  "ip_hash" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "deployment_analytics_project_idx" ON "deployment_analytics" ("project_id");
CREATE INDEX IF NOT EXISTS "deployment_analytics_deployment_idx" ON "deployment_analytics" ("deployment_id");
CREATE INDEX IF NOT EXISTS "deployment_analytics_created_idx" ON "deployment_analytics" ("created_at");
