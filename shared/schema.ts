import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull().default(""),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  githubId: text("github_id"),
  preferences: json("preferences").$type<{ fontSize?: number; tabSize?: number; wordWrap?: boolean; theme?: string }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  displayName: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }),
  name: text("name").notNull(),
  language: text("language").notNull().default("javascript"),
  isDemo: boolean("is_demo").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  publishedSlug: text("published_slug"),
  customDomain: text("custom_domain"),
  githubRepo: text("github_repo"),
  isDevFramework: boolean("is_dev_framework").notNull().default(false),
  frameworkDescription: text("framework_description"),
  frameworkCategory: text("framework_category"),
  frameworkCoverUrl: text("framework_cover_url"),
  isOfficialFramework: boolean("is_official_framework").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
]);

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  language: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const frameworkUpdates = pgTable("framework_updates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  frameworkId: varchar("framework_id", { length: 36 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("framework_updates_framework_idx").on(table.frameworkId),
]);
export const insertFrameworkUpdateSchema = createInsertSchema(frameworkUpdates).pick({
  frameworkId: true,
  message: true,
});
export type InsertFrameworkUpdate = z.infer<typeof insertFrameworkUpdateSchema>;
export type FrameworkUpdate = typeof frameworkUpdates.$inferSelect;

export const files = pgTable("files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull().default(""),
  isBinary: boolean("is_binary").notNull().default(false),
  mimeType: text("mime_type"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("files_project_id_idx").on(table.projectId),
]);

export const insertFileSchema = createInsertSchema(files).pick({
  filename: true,
  content: true,
  isBinary: true,
  mimeType: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export const runs = pgTable("runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("pending"),
  language: text("language").notNull(),
  code: text("code").notNull(),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("runs_project_id_idx").on(table.projectId),
  index("runs_user_id_idx").on(table.userId),
]);

export const insertRunSchema = createInsertSchema(runs).pick({
  projectId: true,
  language: true,
  code: true,
});
export type InsertRun = z.infer<typeof insertRunSchema>;
export type Run = typeof runs.$inferSelect;

export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  ownerUserId: varchar("owner_user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  statusCache: text("status_cache").notNull().default("idle"),
}, (table) => [
  uniqueIndex("workspaces_project_id_unique").on(table.projectId),
]);

export const insertWorkspaceSchema = createInsertSchema(workspaces).pick({
  projectId: true,
  ownerUserId: true,
});
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

export const workspaceSessions = pgTable("workspace_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertWorkspaceSessionSchema = createInsertSchema(workspaceSessions).pick({
  workspaceId: true,
  userId: true,
  expiresAt: true,
});
export type InsertWorkspaceSession = z.infer<typeof insertWorkspaceSessionSchema>;
export type WorkspaceSession = typeof workspaceSessions.$inferSelect;

export const gitRepoState = pgTable("git_repo_state", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().unique(),
  packData: text("pack_data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commits = pgTable("commits", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  branchName: text("branch_name").notNull().default("main"),
  message: text("message").notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  parentCommitId: varchar("parent_commit_id", { length: 36 }),
  snapshot: json("snapshot").notNull().$type<Record<string, string>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("commits_project_id_idx").on(table.projectId),
]);

export const insertCommitSchema = createInsertSchema(commits).pick({
  projectId: true,
  branchName: true,
  message: true,
  authorId: true,
  parentCommitId: true,
  snapshot: true,
});
export type InsertCommit = z.infer<typeof insertCommitSchema>;
export type Commit = typeof commits.$inferSelect;

export const branches = pgTable("branches", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  headCommitId: varchar("head_commit_id", { length: 36 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("branches_project_name_unique").on(table.projectId, table.name),
]);

export const insertBranchSchema = createInsertSchema(branches).pick({
  projectId: true,
  name: true,
  headCommitId: true,
  isDefault: true,
});
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

export const executionLogs = pgTable("execution_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }),
  language: text("language").notNull(),
  exitCode: integer("exit_code"),
  durationMs: integer("duration_ms"),
  securityViolation: text("security_violation"),
  codeHash: text("code_hash").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("execution_logs_user_id_idx").on(table.userId),
  index("execution_logs_created_at_idx").on(table.createdAt),
  index("execution_logs_security_violation_idx").on(table.securityViolation),
]);

export const insertExecutionLogSchema = createInsertSchema(executionLogs).pick({
  userId: true,
  projectId: true,
  language: true,
  exitCode: true,
  durationMs: true,
  securityViolation: true,
  codeHash: true,
  ipAddress: true,
});
export type InsertExecutionLog = z.infer<typeof insertExecutionLogSchema>;
export type ExecutionLog = typeof executionLogs.$inferSelect;

export const userQuotas = pgTable("user_quotas", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().unique(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  dailyExecutionsUsed: integer("daily_executions_used").notNull().default(0),
  dailyAiCallsUsed: integer("daily_ai_calls_used").notNull().default(0),
  storageBytes: integer("storage_bytes").notNull().default(0),
  totalExecutions: integer("total_executions").notNull().default(0),
  totalAiCalls: integer("total_ai_calls").notNull().default(0),
  lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserQuotaSchema = createInsertSchema(userQuotas).pick({
  userId: true,
  plan: true,
});
export type InsertUserQuota = z.infer<typeof insertUserQuotaSchema>;
export type UserQuota = typeof userQuotas.$inferSelect;

export const UPLOAD_LIMITS = {
  objectStorage: 10 * 1024 * 1024,
  projectFiles: 2 * 1024 * 1024,
  maxProjectFiles: 10,
} as const;

export const PLAN_LIMITS = {
  free: { dailyExecutions: 50, dailyAiCalls: 20, storageMb: 50, maxProjects: 5, price: 0 },
  pro: { dailyExecutions: 500, dailyAiCalls: 200, storageMb: 5000, maxProjects: 50, price: 1200 },
  team: { dailyExecutions: 2000, dailyAiCalls: 1000, storageMb: 50000, maxProjects: 200, price: 2500 },
} as const;

export const customDomains = pgTable("custom_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  verified: boolean("verified").notNull().default(false),
  verificationToken: text("verification_token").notNull(),
  sslStatus: text("ssl_status").notNull().default("pending"),
  sslExpiresAt: timestamp("ssl_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
}, (table) => [
  index("custom_domains_project_idx").on(table.projectId),
  index("custom_domains_user_idx").on(table.userId),
]);

export const insertCustomDomainSchema = createInsertSchema(customDomains).pick({
  domain: true,
  projectId: true,
  userId: true,
  verificationToken: true,
});
export type InsertCustomDomain = z.infer<typeof insertCustomDomainSchema>;
export type CustomDomain = typeof customDomains.$inferSelect;

export const planConfigs = pgTable("plan_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  plan: text("plan").notNull().unique(),
  dailyExecutions: integer("daily_executions").notNull(),
  dailyAiCalls: integer("daily_ai_calls").notNull(),
  storageMb: integer("storage_mb").notNull(),
  maxProjects: integer("max_projects").notNull(),
  price: integer("price").notNull(),
  description: text("description"),
  features: text("features").array(),
});

export const insertPlanConfigSchema = createInsertSchema(planConfigs).pick({
  plan: true,
  dailyExecutions: true,
  dailyAiCalls: true,
  storageMb: true,
  maxProjects: true,
  price: true,
  description: true,
  features: true,
});
export type InsertPlanConfig = z.infer<typeof insertPlanConfigSchema>;
export type PlanConfig = typeof planConfigs.$inferSelect;

export const projectEnvVars = pgTable("project_env_vars", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  key: text("key").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("env_vars_project_id_idx").on(table.projectId),
  uniqueIndex("env_vars_project_key_unique").on(table.projectId, table.key),
]);

export const insertProjectEnvVarSchema = createInsertSchema(projectEnvVars).pick({
  projectId: true,
  key: true,
  encryptedValue: true,
});
export type InsertProjectEnvVar = z.infer<typeof insertProjectEnvVarSchema>;
export type ProjectEnvVar = typeof projectEnvVars.$inferSelect;

export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").default(""),
  model: text("model").notNull().default("gpt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ai_conv_project_idx").on(table.projectId),
  index("ai_conv_user_idx").on(table.userId),
  uniqueIndex("ai_conv_project_user_unique").on(table.projectId, table.userId),
]);

export const insertAiConversationSchema = createInsertSchema(aiConversations).pick({
  projectId: true,
  userId: true,
  title: true,
  model: true,
});
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

export const aiMessages = pgTable("ai_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  fileOps: json("file_ops"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ai_msg_conv_idx").on(table.conversationId),
]);

export const insertAiMessageSchema = createInsertSchema(aiMessages).pick({
  conversationId: true,
  role: true,
  content: true,
  model: true,
  fileOps: true,
});
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type EmailVerification = typeof emailVerifications.$inferSelect;

export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  avatarUrl: text("avatar_url"),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  slug: true,
  ownerId: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const teamMembers = pgTable("team_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("team_member_unique").on(table.teamId, table.userId),
  index("team_members_team_idx").on(table.teamId),
  index("team_members_user_idx").on(table.userId),
]);
export const insertTeamMemberSchema = createInsertSchema(teamMembers).pick({
  teamId: true,
  userId: true,
  role: true,
});
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export const teamInvites = pgTable("team_invites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by", { length: 36 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type TeamInvite = typeof teamInvites.$inferSelect;

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }),
  event: text("event").notNull(),
  properties: json("properties").$type<Record<string, any>>(),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("analytics_user_idx").on(table.userId),
  index("analytics_event_idx").on(table.event),
  index("analytics_created_idx").on(table.createdAt),
]);
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export const deployments = pgTable("deployments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  version: integer("version").notNull().default(0),
  status: text("status").notNull().default("building"),
  buildLog: text("build_log"),
  url: text("url"),
  deploymentType: text("deployment_type").notNull().default("static"),
  buildCommand: text("build_command"),
  runCommand: text("run_command"),
  machineConfig: json("machine_config").$type<{ cpu: number; ram: number }>(),
  maxMachines: integer("max_machines").default(1),
  cronExpression: text("cron_expression"),
  scheduleDescription: text("schedule_description"),
  jobTimeout: integer("job_timeout").default(300),
  publicDirectory: text("public_directory").default("dist"),
  appType: text("app_type").default("web_server"),
  deploymentSecrets: json("deployment_secrets").$type<Record<string, string>>(),
  portMapping: integer("port_mapping").default(3000),
  isPrivate: boolean("is_private").notNull().default(false),
  showBadge: boolean("show_badge").notNull().default(true),
  enableFeedback: boolean("enable_feedback").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("deployments_project_idx").on(table.projectId),
]);
export const insertDeploymentSchema = createInsertSchema(deployments).pick({
  projectId: true,
  userId: true,
  version: true,
  deploymentType: true,
  buildCommand: true,
  runCommand: true,
  machineConfig: true,
  maxMachines: true,
  cronExpression: true,
  scheduleDescription: true,
  jobTimeout: true,
  publicDirectory: true,
  appType: true,
  deploymentSecrets: true,
  portMapping: true,
  isPrivate: true,
  showBadge: true,
  enableFeedback: true,
});
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deployments.$inferSelect;

export const securityScans = pgTable("security_scans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("running"),
  totalFindings: integer("total_findings").notNull().default(0),
  critical: integer("critical").notNull().default(0),
  high: integer("high").notNull().default(0),
  medium: integer("medium").notNull().default(0),
  low: integer("low").notNull().default(0),
  info: integer("info").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("security_scans_project_idx").on(table.projectId),
]);
export const insertSecurityScanSchema = createInsertSchema(securityScans).pick({
  projectId: true,
  userId: true,
});
export type InsertSecurityScan = z.infer<typeof insertSecurityScanSchema>;
export type SecurityScan = typeof securityScans.$inferSelect;

export const securityFindings = pgTable("security_findings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id", { length: 36 }).notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  file: text("file").notNull(),
  line: integer("line"),
  code: text("code"),
  suggestion: text("suggestion"),
}, (table) => [
  index("security_findings_scan_idx").on(table.scanId),
]);
export const insertSecurityFindingSchema = createInsertSchema(securityFindings).pick({
  scanId: true,
  severity: true,
  title: true,
  description: true,
  file: true,
  line: true,
  code: true,
  suggestion: true,
});
export type InsertSecurityFinding = z.infer<typeof insertSecurityFindingSchema>;
export type SecurityFinding = typeof securityFindings.$inferSelect;

export const storageKv = pgTable("storage_kv", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("storage_kv_project_key_unique").on(table.projectId, table.key),
  index("storage_kv_project_idx").on(table.projectId),
]);
export const insertStorageKvSchema = createInsertSchema(storageKv).pick({
  projectId: true,
  key: true,
  value: true,
});
export type InsertStorageKv = z.infer<typeof insertStorageKvSchema>;
export type StorageKv = typeof storageKv.$inferSelect;

export const storageObjects = pgTable("storage_objects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("storage_objects_project_idx").on(table.projectId),
])
export const insertStorageObjectSchema = createInsertSchema(storageObjects).pick({
  projectId: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
});
export type InsertStorageObject = z.infer<typeof insertStorageObjectSchema>;
export type StorageObject = typeof storageObjects.$inferSelect;

export const projectAuthConfig = pgTable("project_auth_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  providers: json("providers").notNull().$type<string[]>().default(["email"]),
  requireEmailVerification: boolean("require_email_verification").notNull().default(false),
  sessionDurationHours: integer("session_duration_hours").notNull().default(24),
  allowedDomains: json("allowed_domains").$type<string[]>().default([]),
}, (table) => [
  index("auth_config_project_idx").on(table.projectId),
]);
export type ProjectAuthConfig = typeof projectAuthConfig.$inferSelect;

export const projectAuthUsers = pgTable("project_auth_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull().default(""),
  provider: text("provider").notNull().default("email"),
  verified: boolean("verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("auth_users_project_idx").on(table.projectId),
  uniqueIndex("auth_users_project_email_unique").on(table.projectId, table.email),
]);
export type ProjectAuthUser = typeof projectAuthUsers.$inferSelect;

export const integrationCatalog = pgTable("integration_catalog", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("plug"),
  envVarKeys: json("env_var_keys").notNull().$type<string[]>().default([]),
});
export type IntegrationCatalogEntry = typeof integrationCatalog.$inferSelect;

export const projectIntegrations = pgTable("project_integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("connected"),
  config: json("config").$type<Record<string, string>>().default({}),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
}, (table) => [
  index("proj_integrations_project_idx").on(table.projectId),
  uniqueIndex("proj_integrations_unique").on(table.projectId, table.integrationId),
])
export type ProjectIntegration = typeof projectIntegrations.$inferSelect;

export const integrationLogs = pgTable("integration_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectIntegrationId: varchar("project_integration_id", { length: 36 }).notNull(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("integration_logs_pi_idx").on(table.projectIntegrationId),
]);
export type IntegrationLog = typeof integrationLogs.$inferSelect;

export const automations = pgTable("automations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("cron"),
  cronExpression: text("cron_expression"),
  webhookToken: text("webhook_token"),
  slackBotToken: text("slack_bot_token"),
  slackSigningSecret: text("slack_signing_secret"),
  telegramBotToken: text("telegram_bot_token"),
  botStatus: text("bot_status").default("disconnected"),
  script: text("script").notNull().default(""),
  language: text("language").notNull().default("javascript"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("automations_project_idx").on(table.projectId),
]);
export const insertAutomationSchema = createInsertSchema(automations).pick({
  projectId: true,
  name: true,
  type: true,
  cronExpression: true,
  script: true,
  language: true,
  enabled: true,
  slackBotToken: true,
  slackSigningSecret: true,
  telegramBotToken: true,
});
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

export const automationRuns = pgTable("automation_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("running"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  durationMs: integer("duration_ms"),
  triggeredBy: text("triggered_by").notNull().default("cron"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("automation_runs_automation_idx").on(table.automationId),
]);
export type AutomationRun = typeof automationRuns.$inferSelect;

export const workflows = pgTable("workflows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  triggerEvent: text("trigger_event").notNull().default("manual"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("workflows_project_idx").on(table.projectId),
]);
export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  projectId: true,
  name: true,
  triggerEvent: true,
  enabled: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  continueOnError: boolean("continue_on_error").notNull().default(false),
}, (table) => [
  index("workflow_steps_workflow_idx").on(table.workflowId),
]);
export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).pick({
  workflowId: true,
  name: true,
  command: true,
  orderIndex: true,
  continueOnError: true,
});
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;

export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("running"),
  stepResults: json("step_results").$type<{ stepId: string; name: string; status: string; stdout: string; stderr: string; exitCode: number; durationMs: number }[]>(),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("workflow_runs_workflow_idx").on(table.workflowId),
]);
export type WorkflowRun = typeof workflowRuns.$inferSelect;

export const monitoringMetrics = pgTable("monitoring_metrics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  metricType: text("metric_type").notNull(),
  value: integer("value").notNull().default(0),
  metadata: json("metadata").$type<Record<string, any>>(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => [
  index("monitoring_metrics_project_idx").on(table.projectId),
  index("monitoring_metrics_type_idx").on(table.metricType),
]);
export type MonitoringMetric = typeof monitoringMetrics.$inferSelect;

export const monitoringAlerts = pgTable("monitoring_alerts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  metricType: text("metric_type").notNull(),
  condition: text("condition").notNull().default("gt"),
  threshold: integer("threshold").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("monitoring_alerts_project_idx").on(table.projectId),
]);
export const insertMonitoringAlertSchema = createInsertSchema(monitoringAlerts).pick({
  projectId: true,
  name: true,
  metricType: true,
  condition: true,
  threshold: true,
  enabled: true,
});
export type InsertMonitoringAlert = z.infer<typeof insertMonitoringAlertSchema>;
export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;

export const codeThreads = pgTable("code_threads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  filename: text("filename").notNull(),
  lineNumber: integer("line_number"),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("code_threads_project_idx").on(table.projectId),
  index("code_threads_file_idx").on(table.filename),
]);
export const insertCodeThreadSchema = createInsertSchema(codeThreads).pick({
  projectId: true,
  userId: true,
  filename: true,
  lineNumber: true,
  title: true,
});
export type InsertCodeThread = z.infer<typeof insertCodeThreadSchema>;
export type CodeThread = typeof codeThreads.$inferSelect;

export const threadComments = pgTable("thread_comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("thread_comments_thread_idx").on(table.threadId),
]);
export const insertThreadCommentSchema = createInsertSchema(threadComments).pick({
  threadId: true,
  userId: true,
  content: true,
});
export type InsertThreadComment = z.infer<typeof insertThreadCommentSchema>;
export type ThreadComment = typeof threadComments.$inferSelect;

export const skills = pgTable("skills", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("skills_project_idx").on(table.projectId),
]);
export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

export const portConfigs = pgTable("port_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  port: integer("port").notNull(),
  label: text("label").notNull().default(""),
  protocol: text("protocol").notNull().default("http"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("port_configs_project_idx").on(table.projectId),
  uniqueIndex("port_configs_project_port_unique").on(table.projectId, table.port),
]);
export const insertPortConfigSchema = createInsertSchema(portConfigs).pick({
  projectId: true,
  port: true,
  label: true,
  protocol: true,
  isPublic: true,
});
export type InsertPortConfig = z.infer<typeof insertPortConfigSchema>;
export type PortConfig = typeof portConfigs.$inferSelect;

export const deploymentAnalytics = pgTable("deployment_analytics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  deploymentId: varchar("deployment_id", { length: 36 }),
  path: text("path").notNull().default("/"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  visitorId: text("visitor_id"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("deployment_analytics_project_idx").on(table.projectId),
  index("deployment_analytics_created_idx").on(table.createdAt),
]);
export const insertDeploymentAnalyticSchema = createInsertSchema(deploymentAnalytics).pick({
  projectId: true,
  deploymentId: true,
  path: true,
  referrer: true,
  userAgent: true,
  visitorId: true,
  ipHash: true,
});
export type InsertDeploymentAnalytic = z.infer<typeof insertDeploymentAnalyticSchema>;
export type DeploymentAnalytic = typeof deploymentAnalytics.$inferSelect;

export interface CheckpointStateSnapshot {
  files: { filename: string; content: string }[];
  envVars: { key: string; encryptedValue: string }[];
  storageKv: { key: string; value: string }[];
  storageObjectsMeta: { filename: string; mimeType: string; sizeBytes: number; storagePath?: string }[];
  aiConversations: { userId?: string; title: string; model: string; messages: { role: string; content: string; model?: string }[] }[];
  projectConfig: { name: string; language: string };
  packages: string[];
}

export const checkpoints = pgTable("checkpoints", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("manual"),
  trigger: text("trigger").notNull().default("manual"),
  stateSnapshot: json("state_snapshot").notNull().$type<CheckpointStateSnapshot>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("checkpoints_project_idx").on(table.projectId),
  index("checkpoints_created_idx").on(table.createdAt),
]);
export const insertCheckpointSchema = createInsertSchema(checkpoints).pick({
  projectId: true,
  userId: true,
  description: true,
  type: true,
  trigger: true,
  stateSnapshot: true,
});
export type InsertCheckpoint = z.infer<typeof insertCheckpointSchema>;
export type Checkpoint = typeof checkpoints.$inferSelect;

export const checkpointPositions = pgTable("checkpoint_positions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().unique(),
  currentCheckpointId: varchar("current_checkpoint_id", { length: 36 }),
  divergedFromId: varchar("diverged_from_id", { length: 36 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type CheckpointPosition = typeof checkpointPositions.$inferSelect;

export const accountEnvVars = pgTable("account_env_vars", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  key: text("key").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("account_env_vars_user_id_idx").on(table.userId),
  uniqueIndex("account_env_vars_user_key_unique").on(table.userId, table.key),
]);

export const insertAccountEnvVarSchema = createInsertSchema(accountEnvVars).pick({
  userId: true,
  key: true,
  encryptedValue: true,
});
export type InsertAccountEnvVar = z.infer<typeof insertAccountEnvVarSchema>;
export type AccountEnvVar = typeof accountEnvVars.$inferSelect;

export const accountEnvVarLinks = pgTable("account_env_var_links", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  accountEnvVarId: varchar("account_env_var_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("account_env_var_links_project_idx").on(table.projectId),
  uniqueIndex("account_env_var_links_unique").on(table.accountEnvVarId, table.projectId),
]);

export const insertAccountEnvVarLinkSchema = createInsertSchema(accountEnvVarLinks).pick({
  accountEnvVarId: true,
  projectId: true,
});
export type InsertAccountEnvVarLink = z.infer<typeof insertAccountEnvVarLinkSchema>;
export type AccountEnvVarLink = typeof accountEnvVarLinks.$inferSelect;

export const consoleRuns = pgTable("console_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  command: text("command").notNull(),
  status: text("status").notNull().default("running"),
  logs: json("logs").$type<{ id: number; text: string; type: "info" | "error" | "success" }[]>().notNull().default([]),
  exitCode: integer("exit_code"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("console_runs_project_id_idx").on(table.projectId),
  index("console_runs_started_at_idx").on(table.startedAt),
]);
export const insertConsoleRunSchema = createInsertSchema(consoleRuns).pick({
  projectId: true,
  command: true,
});
export type InsertConsoleRun = z.infer<typeof insertConsoleRunSchema>;
export type ConsoleRun = typeof consoleRuns.$inferSelect;
