CREATE TABLE "credit_usage" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"mode" text NOT NULL,
	"model" text NOT NULL,
	"credit_cost" integer NOT NULL,
	"endpoint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "slack_bot_token" text;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "slack_signing_secret" text;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "telegram_bot_token" text;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "bot_status" text DEFAULT 'disconnected';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "is_binary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD COLUMN "daily_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD COLUMN "agent_mode" text DEFAULT 'economy' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD COLUMN "code_optimizations_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD COLUMN "credit_alert_threshold" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" json;--> statement-breakpoint
CREATE INDEX "skills_project_idx" ON "skills" USING btree ("project_id");