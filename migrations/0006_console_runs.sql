CREATE TABLE IF NOT EXISTS "console_runs" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "command" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "logs" json DEFAULT '[]'::json NOT NULL,
  "exit_code" integer,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_runs_project_id_idx" ON "console_runs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_runs_started_at_idx" ON "console_runs" USING btree ("started_at");
