CREATE TABLE IF NOT EXISTS "account_env_vars" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "key" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_env_vars_user_id_idx" ON "account_env_vars" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_env_vars_user_key_unique" ON "account_env_vars" USING btree ("user_id","key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_env_var_links" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_env_var_id" varchar(36) NOT NULL,
  "project_id" varchar(36) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_env_var_links_project_idx" ON "account_env_var_links" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_env_var_links_unique" ON "account_env_var_links" USING btree ("account_env_var_id","project_id");
