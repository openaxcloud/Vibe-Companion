import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
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
  name: text("name").notNull(),
  language: text("language").notNull().default("javascript"),
  isDemo: boolean("is_demo").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
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

export const files = pgTable("files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("files_project_id_idx").on(table.projectId),
]);

export const insertFileSchema = createInsertSchema(files).pick({
  filename: true,
  content: true,
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

export const PLAN_LIMITS = {
  free: { dailyExecutions: 50, dailyAiCalls: 20, storageMb: 50, maxProjects: 5 },
  pro: { dailyExecutions: 500, dailyAiCalls: 200, storageMb: 500, maxProjects: 50 },
} as const;
