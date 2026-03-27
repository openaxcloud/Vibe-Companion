CREATE TABLE IF NOT EXISTS "ssh_keys" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "label" text NOT NULL,
  "public_key" text NOT NULL,
  "fingerprint" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ssh_keys_user_id_idx" ON "ssh_keys" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ssh_keys_user_fingerprint_unique" ON "ssh_keys" ("user_id", "fingerprint");
