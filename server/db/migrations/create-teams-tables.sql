-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo TEXT,
  owner_id INTEGER NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  member_limit INTEGER NOT NULL DEFAULT 5,
  storage_limit INTEGER NOT NULL DEFAULT 10737418240,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  invited_by INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(team_id, user_id)
);

-- Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  invited_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create team_projects table
CREATE TABLE IF NOT EXISTS team_projects (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  added_by INTEGER NOT NULL,
  visibility VARCHAR(50) NOT NULL DEFAULT 'team',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, project_id)
);

-- Create team_workspaces table
CREATE TABLE IF NOT EXISTS team_workspaces (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create workspace_projects table
CREATE TABLE IF NOT EXISTS workspace_projects (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, project_id)
);

-- Create team_activity table
CREATE TABLE IF NOT EXISTS team_activity (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_projects_team_id ON team_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_project_id ON team_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_team_id ON team_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_workspace_projects_workspace_id ON workspace_projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_team_id ON team_activity(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created_at ON team_activity(created_at DESC);