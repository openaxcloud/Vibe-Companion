-- 0026_notifications_realign.sql
-- Same kind of drift as 0025: live `notifications` table has the legacy
-- shape (id integer, user_id integer, type, entity_type, entity_id,
-- from_user_id, read, …) — Drizzle expects (id varchar(36), user_id
-- varchar(36), category, title, message, is_read, action_url, metadata).
-- Symptom: GET /api/notifications → 500 "column 'category' does not exist".
-- Same archive-and-recreate pattern as deployments/themes in 0023.

BEGIN;

DO $$
DECLARE
  has_category boolean;
  has_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications'
  ) INTO has_table;

  IF has_table THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'category'
    ) INTO has_category;

    IF NOT has_category THEN
      EXECUTE 'ALTER TABLE notifications RENAME TO notifications_legacy_archived';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar(36) NOT NULL,
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  metadata jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at);

COMMIT;
