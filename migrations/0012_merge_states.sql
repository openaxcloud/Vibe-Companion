CREATE TABLE IF NOT EXISTS "merge_states" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" varchar NOT NULL,
  "branch" varchar NOT NULL,
  "local_oid" varchar,
  "remote_oid" varchar,
  "conflicts" json DEFAULT '[]'::json NOT NULL,
  "resolutions" json DEFAULT '[]'::json NOT NULL,
  "status" varchar DEFAULT 'in_progress' NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "merge_states_project_id_unique" ON "merge_states" ("project_id");
