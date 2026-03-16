CREATE TABLE IF NOT EXISTS "mcp_servers" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "name" text NOT NULL,
  "command" text NOT NULL,
  "args" json DEFAULT '[]'::json NOT NULL,
  "env" json DEFAULT '{}'::json NOT NULL,
  "status" text DEFAULT 'stopped' NOT NULL,
  "is_built_in" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_tools" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "server_id" varchar(36) NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "input_schema" json DEFAULT '{}'::json NOT NULL,
  "cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_project_idx" ON "mcp_servers" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_tools_server_idx" ON "mcp_tools" USING btree ("server_id");
