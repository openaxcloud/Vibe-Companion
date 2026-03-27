CREATE TABLE "git_repo_state" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"pack_data" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "git_repo_state_project_id_unique" UNIQUE("project_id")
);
