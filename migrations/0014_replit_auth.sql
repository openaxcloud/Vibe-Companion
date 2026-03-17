ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "replit_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_replit_id_unique" ON "users" ("replit_id") WHERE "replit_id" IS NOT NULL;
