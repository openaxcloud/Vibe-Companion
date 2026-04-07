#!/bin/bash
set -e

npm install --legacy-peer-deps
npx drizzle-kit push --force || true

node -e "
const { Pool } = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  await p.query(\`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(36) NOT NULL,
      category text NOT NULL DEFAULT 'system',
      title text NOT NULL,
      message text NOT NULL DEFAULT '',
      is_read boolean NOT NULL DEFAULT false,
      action_url text,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  \`);
  await p.query('CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id)');
  await p.query(\`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(36) NOT NULL UNIQUE,
      agent boolean NOT NULL DEFAULT true,
      billing boolean NOT NULL DEFAULT true,
      deployment boolean NOT NULL DEFAULT true,
      security boolean NOT NULL DEFAULT true,
      team boolean NOT NULL DEFAULT true,
      system boolean NOT NULL DEFAULT true
    )
  \`);
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS description text');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_url text');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT \\'web-app\\'');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT \\'public\\'');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS selected_workflow_id varchar(36)');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS dev_url_public boolean NOT NULL DEFAULT true');
  await p.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()');
  console.log('DB schema sync complete');
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"

NODE_OPTIONS="--max-old-space-size=8192" timeout 90 npx vite build
