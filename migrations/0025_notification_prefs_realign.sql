-- 0025_notification_prefs_realign.sql
-- Live `notification_preferences` table has a totally different shape from
-- the Drizzle schema (legacy: id integer, user_id integer, comment/star/follow/
-- mention/newsletter columns; Drizzle: id varchar(36), user_id varchar(36),
-- agent/billing/deployment/security/team/system columns). Every post-deploy /
-- post-team-invite notification was failing silently with "column 'agent'
-- does not exist". This rebuilds the table to match Drizzle.
--
-- Same pattern as 0023's deployments/themes legacy archive.

BEGIN;

-- 1. Archive the legacy table for forensics, drop only if it exists with
--    the legacy shape (we detect via the absence of the `agent` column).
DO $$
DECLARE
  has_agent_col boolean;
  has_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'notification_preferences'
  ) INTO has_table;

  IF has_table THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notification_preferences' AND column_name = 'agent'
    ) INTO has_agent_col;

    IF NOT has_agent_col THEN
      -- Legacy shape — archive
      EXECUTE 'ALTER TABLE notification_preferences RENAME TO notification_preferences_legacy_archived';
    END IF;
  END IF;
END $$;

-- 2. Create the table matching shared/schema.ts:notificationPreferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar(36) NOT NULL,
  agent boolean NOT NULL DEFAULT true,
  billing boolean NOT NULL DEFAULT true,
  deployment boolean NOT NULL DEFAULT true,
  security boolean NOT NULL DEFAULT true,
  team boolean NOT NULL DEFAULT true,
  system boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_prefs_user_unique
  ON notification_preferences (user_id);

COMMIT;
