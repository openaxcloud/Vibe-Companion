-- Production Database Performance Indexes
-- Created for Fortune 500-grade performance optimization
-- These indexes dramatically improve query performance for frequently accessed data

-- User indexes for authentication and lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Project indexes for dashboard and search
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_language ON projects(language);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_projects_forked_from ON projects(forked_from_id) WHERE forked_from_id IS NOT NULL;

-- File indexes for editor performance
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(project_id, path);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);

-- Deployment indexes
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at DESC);

-- Comment indexes for social features
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Collaboration indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_project_id ON collaboration_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_created_by ON collaboration_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);

-- API Key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Security log indexes
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_result ON security_logs(result);

-- AI Approval Queue indexes
CREATE INDEX IF NOT EXISTS idx_ai_approval_queue_user_id ON ai_approval_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_approval_queue_project_id ON ai_approval_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_approval_queue_status ON ai_approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_approval_queue_created_at ON ai_approval_queue(created_at DESC);

-- AI Audit Log indexes
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id ON ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_project_id ON ai_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_action_type ON ai_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_timestamp ON ai_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_approval_id ON ai_audit_logs(approval_id) WHERE approval_id IS NOT NULL;

-- Marketplace template indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_category ON marketplace_templates(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_featured ON marketplace_templates(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_verified ON marketplace_templates(is_verified) WHERE is_verified = true;

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_projects_owner_visibility ON projects(owner_id, visibility);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read = false;

-- Partial indexes for better performance on specific queries
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(id) WHERE locked_until IS NOT NULL AND locked_until > NOW();
CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON users(id) WHERE two_factor_enabled = true;

COMMENT ON INDEX idx_projects_search IS 'Full-text search index for project names and descriptions';
COMMENT ON INDEX idx_projects_owner_visibility IS 'Composite index for user dashboard queries';
COMMENT ON INDEX idx_notifications_user_unread IS 'Optimized index for fetching unread notifications';
