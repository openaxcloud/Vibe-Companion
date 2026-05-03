-- 0030_notification_extra_fields.sql
-- Adds three new notification preference columns introduced in Task #148.
-- Uses IF NOT EXISTS so it is safe to re-run even if the columns were
-- added manually during development (they already exist on dev DB).

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS project_updates  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comments_mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS newsletter        boolean NOT NULL DEFAULT false;
