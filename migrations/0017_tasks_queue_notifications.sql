-- Task system tables
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "plan" json,
  "status" text NOT NULL DEFAULT 'draft',
  "depends_on" json DEFAULT '[]',
  "priority" integer NOT NULL DEFAULT 0,
  "progress" integer NOT NULL DEFAULT 0,
  "result" text,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "tasks_user_idx" ON "tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");

CREATE TABLE IF NOT EXISTS "task_steps" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" varchar(36) NOT NULL,
  "order_index" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "output" text,
  "started_at" timestamp,
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "task_steps_task_idx" ON "task_steps" ("task_id");

CREATE TABLE IF NOT EXISTS "task_messages" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" varchar(36) NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "task_messages_task_idx" ON "task_messages" ("task_id");

CREATE TABLE IF NOT EXISTS "task_file_snapshots" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" varchar(36) NOT NULL,
  "filename" text NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "original_content" text NOT NULL DEFAULT '',
  "is_modified" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "task_file_snapshots_task_idx" ON "task_file_snapshots" ("task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "task_file_snapshots_task_file_unique" ON "task_file_snapshots" ("task_id", "filename");

-- Message queue table
CREATE TABLE IF NOT EXISTS "queued_messages" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" varchar(36) NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "content" text NOT NULL,
  "attachments" json,
  "position" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "queued_msg_conv_idx" ON "queued_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "queued_msg_project_user_idx" ON "queued_messages" ("project_id", "user_id");

-- Notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "type" text NOT NULL DEFAULT 'info',
  "title" text NOT NULL,
  "message" text NOT NULL DEFAULT '',
  "link" text,
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL UNIQUE,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "push_enabled" boolean NOT NULL DEFAULT true,
  "agent_complete" boolean NOT NULL DEFAULT true,
  "deployment_status" boolean NOT NULL DEFAULT true,
  "security_alerts" boolean NOT NULL DEFAULT true,
  "billing_alerts" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Canvas system
CREATE TABLE IF NOT EXISTS "canvas_frames" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "name" text NOT NULL DEFAULT 'Frame',
  "x" real NOT NULL DEFAULT 0,
  "y" real NOT NULL DEFAULT 0,
  "width" real NOT NULL DEFAULT 400,
  "height" real NOT NULL DEFAULT 300,
  "content" text NOT NULL DEFAULT '',
  "type" text NOT NULL DEFAULT 'component',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "canvas_frames_project_idx" ON "canvas_frames" ("project_id");

CREATE TABLE IF NOT EXISTS "canvas_annotations" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "frame_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "content" text NOT NULL,
  "x" real NOT NULL DEFAULT 0,
  "y" real NOT NULL DEFAULT 0,
  "resolved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "canvas_annotations_frame_idx" ON "canvas_annotations" ("frame_id");

-- Account warnings & desktop releases
CREATE TABLE IF NOT EXISTS "account_warnings" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'warning',
  "dismissed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_warnings_user_idx" ON "account_warnings" ("user_id");

CREATE TABLE IF NOT EXISTS "desktop_releases" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "version" text NOT NULL,
  "platform" text NOT NULL,
  "download_url" text NOT NULL,
  "release_notes" text NOT NULL DEFAULT '',
  "is_latest" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "desktop_downloads" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "release_id" varchar(36) NOT NULL,
  "user_id" varchar(36),
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Conversions & templates
CREATE TABLE IF NOT EXISTS "conversions" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "source_type" text NOT NULL,
  "target_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "result" json,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversions_project_idx" ON "conversions" ("project_id");

CREATE TABLE IF NOT EXISTS "artifact_templates" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "type" text NOT NULL,
  "template_data" json NOT NULL,
  "is_public" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Deployment feedback
CREATE TABLE IF NOT EXISTS "deployment_feedback" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "deployment_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deployment_feedback_deployment_idx" ON "deployment_feedback" ("deployment_id");
