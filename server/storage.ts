import { eq, desc, and, sql, inArray, count, gte } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, files, runs, workspaces, workspaceSessions,
  commits, branches, executionLogs, userQuotas,
  projectEnvVars,
  aiConversations, aiMessages,
  passwordResetTokens, emailVerifications,
  teams, teamMembers, teamInvites,
  analyticsEvents, deployments,
  customDomains, planConfigs,
  type User, type InsertUser,
  type Project, type InsertProject,
  type File, type InsertFile,
  type Run, type InsertRun,
  type Workspace, type InsertWorkspace,
  type WorkspaceSession, type InsertWorkspaceSession,
  type Commit, type InsertCommit,
  type Branch, type InsertBranch,
  type ExecutionLog, type InsertExecutionLog,
  type UserQuota, type InsertUserQuota,
  type ProjectEnvVar,
  type AiConversation, type InsertAiConversation,
  type AiMessage, type InsertAiMessage,
  type PasswordResetToken,
  type EmailVerification,
  type Team, type InsertTeam,
  type TeamMember, type InsertTeamMember,
  type TeamInvite,
  type AnalyticsEvent,
  type Deployment, type InsertDeployment,
  type CustomDomain,
  type PlanConfig,
  PLAN_LIMITS,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { githubId?: string; avatarUrl?: string; emailVerified?: boolean }): Promise<User>;
  updateUser(id: string, data: Partial<{ displayName: string; avatarUrl: string; password: string; emailVerified: boolean; githubId: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(limit?: number, offset?: number): Promise<{ users: User[]; total: number }>;

  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(userId: string, data: InsertProject): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  duplicateProject(id: string, userId: string): Promise<Project | undefined>;
  createProjectFromTemplate(userId: string, data: { name: string; language: string; files: { filename: string; content: string }[] }): Promise<Project>;
  updateProject(id: string, data: Partial<{ name: string; language: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string }>): Promise<Project | undefined>;

  getFiles(projectId: string): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(projectId: string, data: InsertFile): Promise<File>;
  updateFileContent(id: string, content: string): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;
  renameFile(id: string, filename: string): Promise<File | undefined>;

  createRun(userId: string, data: InsertRun): Promise<Run>;
  updateRun(id: string, data: Partial<Run>): Promise<Run | undefined>;
  getRun(id: string): Promise<Run | undefined>;
  getRunsByProject(projectId: string): Promise<Run[]>;

  publishProject(id: string, userId: string): Promise<Project | undefined>;
  getPublishedProject(id: string): Promise<{project: Project, files: File[]} | undefined>;

  getWorkspaceByProject(projectId: string): Promise<Workspace | undefined>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(data: InsertWorkspace): Promise<Workspace>;
  updateWorkspaceStatus(id: string, statusCache: string): Promise<Workspace | undefined>;
  touchWorkspace(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<boolean>;

  createWorkspaceSession(data: InsertWorkspaceSession): Promise<WorkspaceSession>;
  getWorkspaceSession(id: string): Promise<WorkspaceSession | undefined>;

  getDemoProject(): Promise<Project | undefined>;
  seedDemoProject(): Promise<void>;

  createExecutionLog(data: InsertExecutionLog): Promise<ExecutionLog>;
  getExecutionLogs(filters?: { userId?: string; securityViolation?: boolean; limit?: number }): Promise<ExecutionLog[]>;

  getCommits(projectId: string, branchName?: string): Promise<Commit[]>;
  getCommit(id: string): Promise<Commit | undefined>;
  createCommit(data: InsertCommit): Promise<Commit>;
  getBranches(projectId: string): Promise<Branch[]>;
  getBranch(projectId: string, name: string): Promise<Branch | undefined>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranchHead(id: string, headCommitId: string): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;

  getUserQuota(userId: string): Promise<UserQuota>;
  incrementExecution(userId: string): Promise<{ allowed: boolean; quota: UserQuota }>;
  incrementAiCall(userId: string): Promise<{ allowed: boolean; quota: UserQuota }>;
  checkProjectLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }>;
  updateStorageUsage(userId: string): Promise<number>;
  updateUserPlan(userId: string, plan: string, stripeCustomerId?: string, stripeSubscriptionId?: string): Promise<UserQuota | undefined>;

  getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]>;
  getProjectEnvVar(id: string): Promise<ProjectEnvVar | undefined>;
  createProjectEnvVar(projectId: string, key: string, encryptedValue: string): Promise<ProjectEnvVar>;
  updateProjectEnvVar(id: string, encryptedValue: string): Promise<ProjectEnvVar | undefined>;
  deleteProjectEnvVar(id: string): Promise<boolean>;

  getConversation(projectId: string, userId: string): Promise<AiConversation | undefined>;
  getConversationById(id: string): Promise<AiConversation | undefined>;
  createConversation(data: InsertAiConversation): Promise<AiConversation>;
  updateConversation(id: string, data: Partial<{ title: string; model: string }>): Promise<AiConversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  getMessages(conversationId: string): Promise<AiMessage[]>;
  addMessage(data: InsertAiMessage): Promise<AiMessage>;
  addMessages(data: InsertAiMessage[]): Promise<AiMessage[]>;
  clearMessages(conversationId: string): Promise<void>;

  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  usePasswordResetToken(token: string): Promise<boolean>;

  createEmailVerification(userId: string, token: string, expiresAt: Date): Promise<EmailVerification>;
  getEmailVerification(token: string): Promise<EmailVerification | undefined>;
  verifyEmail(token: string): Promise<boolean>;

  createTeam(data: InsertTeam): Promise<Team>;
  getTeam(id: string): Promise<Team | undefined>;
  getTeamBySlug(slug: string): Promise<Team | undefined>;
  getUserTeams(userId: string): Promise<(Team & { role: string })[]>;
  updateTeam(id: string, data: Partial<{ name: string; avatarUrl: string; plan: string }>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;

  addTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<boolean>;
  getTeamMembers(teamId: string): Promise<(TeamMember & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]>;
  updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember | undefined>;

  createTeamInvite(teamId: string, email: string, role: string, invitedBy: string, token: string, expiresAt: Date): Promise<TeamInvite>;
  getTeamInvite(token: string): Promise<TeamInvite | undefined>;
  getTeamInvites(teamId: string): Promise<TeamInvite[]>;
  acceptTeamInvite(token: string): Promise<TeamInvite | undefined>;
  deleteTeamInvite(id: string): Promise<boolean>;

  trackEvent(userId: string | null, event: string, properties?: Record<string, any>): Promise<void>;
  getAnalytics(filters?: { event?: string; userId?: string; since?: Date; limit?: number }): Promise<AnalyticsEvent[]>;
  getAnalyticsSummary(): Promise<{ totalUsers: number; totalProjects: number; totalExecutions: number; totalAiCalls: number; activeToday: number }>;

  createDeployment(data: InsertDeployment): Promise<Deployment>;
  getDeployment(id: string): Promise<Deployment | undefined>;
  getProjectDeployments(projectId: string): Promise<Deployment[]>;
  updateDeployment(id: string, data: Partial<{ status: string; buildLog: string; url: string; finishedAt: Date }>): Promise<Deployment | undefined>;

  createCustomDomain(data: { domain: string; projectId: string; userId: string; verificationToken: string }): Promise<CustomDomain>;
  getCustomDomain(id: string): Promise<CustomDomain | undefined>;
  getCustomDomainByHostname(hostname: string): Promise<CustomDomain | undefined>;
  getProjectCustomDomains(projectId: string): Promise<CustomDomain[]>;
  updateCustomDomain(id: string, data: Partial<{ verified: boolean; verifiedAt: Date; sslStatus: string; sslExpiresAt: Date }>): Promise<CustomDomain | undefined>;
  deleteCustomDomain(id: string, userId: string): Promise<boolean>;

  getPlanConfig(plan: string): Promise<PlanConfig | undefined>;
  getAllPlanConfigs(): Promise<PlanConfig[]>;
  seedPlanConfigs(): Promise<void>;

  getPlanLimits(plan: string): Promise<{ dailyExecutions: number; dailyAiCalls: number; storageMb: number; maxProjects: number; price: number }>;
  getLandingStats(): Promise<{ label: string; value: string }[]>;
  getUserRecentLanguages(userId: string): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
    return user;
  }

  async createUser(data: InsertUser & { githubId?: string; avatarUrl?: string; emailVerified?: boolean }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email,
      password: data.password || "",
      displayName: data.displayName,
      githubId: data.githubId,
      avatarUrl: data.avatarUrl,
      emailVerified: data.emailVerified || false,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ displayName: string; avatarUrl: string; password: string; emailVerified: boolean; githubId: string }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const userProjects = await db.select().from(projects).where(eq(projects.userId, id));
    for (const p of userProjects) {
      await this.deleteProject(p.id, id);
    }
    await db.delete(userQuotas).where(eq(userQuotas.userId, id));
    await db.delete(analyticsEvents).where(eq(analyticsEvents.userId, id));
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const [{ value: total }] = await db.select({ value: count() }).from(users);
    const userList = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    return { users: userList, total };
  }

  async getProjects(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return project;
  }

  async createProject(userId: string, data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values({ ...data, userId }).returning();
    const langDefaults: Record<string, { filename: string; content: string }> = {
      python: { filename: "main.py", content: `print("Hello from E-Code!")\n` },
      javascript: { filename: "index.js", content: `console.log("Hello from E-Code!");\n` },
      typescript: { filename: "index.ts", content: `console.log("Hello from E-Code!");\n` },
      go: { filename: "main.go", content: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from E-Code!")\n}\n` },
      ruby: { filename: "main.rb", content: `puts "Hello from E-Code!"\n` },
      cpp: { filename: "main.cpp", content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from E-Code!" << std::endl;\n    return 0;\n}\n` },
      c: { filename: "main.c", content: `#include <stdio.h>\n\nint main() {\n    printf("Hello from E-Code!\\n");\n    return 0;\n}\n` },
      java: { filename: "Main.java", content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from E-Code!");\n    }\n}\n` },
      rust: { filename: "main.rs", content: `fn main() {\n    println!("Hello from E-Code!");\n}\n` },
      bash: { filename: "main.sh", content: `#!/bin/bash\necho "Hello from E-Code!"\n` },
      html: { filename: "index.html", content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My App</title>\n</head>\n<body>\n  <h1>Hello from E-Code!</h1>\n</body>\n</html>\n` },
    };
    const defaults = langDefaults[data.language || "javascript"] || langDefaults.javascript;
    await db.insert(files).values({ projectId: project.id, filename: defaults.filename, content: defaults.content });
    return project;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
    if (!project) return false;
    const ws = await this.getWorkspaceByProject(id);
    if (ws) {
      await db.delete(workspaceSessions).where(eq(workspaceSessions.workspaceId, ws.id));
      await db.delete(workspaces).where(eq(workspaces.id, ws.id));
    }
    await db.delete(deployments).where(eq(deployments.projectId, id));
    await db.delete(projectEnvVars).where(eq(projectEnvVars.projectId, id));
    await db.delete(commits).where(eq(commits.projectId, id));
    await db.delete(branches).where(eq(branches.projectId, id));
    const convs = await db.select().from(aiConversations).where(eq(aiConversations.projectId, id));
    for (const c of convs) {
      await db.delete(aiMessages).where(eq(aiMessages.conversationId, c.id));
    }
    await db.delete(aiConversations).where(eq(aiConversations.projectId, id));
    await db.delete(files).where(eq(files.projectId, id));
    await db.delete(runs).where(eq(runs.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
    return true;
  }

  async duplicateProject(id: string, userId: string): Promise<Project | undefined> {
    const original = await this.getProject(id);
    if (!original) return undefined;
    const [newProject] = await db.insert(projects).values({
      userId, name: `${original.name} (copy)`, language: original.language,
    }).returning();
    const originalFiles = await this.getFiles(id);
    for (const file of originalFiles) {
      await db.insert(files).values({ projectId: newProject.id, filename: file.filename, content: file.content });
    }
    return newProject;
  }

  async createProjectFromTemplate(userId: string, data: { name: string; language: string; files: { filename: string; content: string }[] }): Promise<Project> {
    const [project] = await db.insert(projects).values({ userId, name: data.name, language: data.language }).returning();
    if (data.files.length > 0) {
      await db.insert(files).values(data.files.map(f => ({ projectId: project.id, filename: f.filename, content: f.content })));
    }
    return project;
  }

  async getFiles(projectId: string): Promise<File[]> {
    return db.select().from(files).where(eq(files.projectId, projectId));
  }

  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    return file;
  }

  async createFile(projectId: string, data: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values({ ...data, projectId }).returning();
    return file;
  }

  async updateFileContent(id: string, content: string): Promise<File | undefined> {
    const [file] = await db.update(files).set({ content, updatedAt: new Date() }).where(eq(files.id, id)).returning();
    if (file) {
      await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, file.projectId));
    }
    return file;
  }

  async renameFile(id: string, filename: string): Promise<File | undefined> {
    const [file] = await db.update(files).set({ filename, updatedAt: new Date() }).where(eq(files.id, id)).returning();
    return file;
  }

  async updateProject(id: string, data: Partial<{ name: string; language: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string }>): Promise<Project | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.language !== undefined) updates.language = data.language;
    if (data.isPublished !== undefined) updates.isPublished = data.isPublished;
    if (data.publishedSlug !== undefined) updates.publishedSlug = data.publishedSlug;
    if (data.customDomain !== undefined) updates.customDomain = data.customDomain;
    if (data.teamId !== undefined) updates.teamId = data.teamId;
    const [project] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    return project;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id)).returning();
    return result.length > 0;
  }

  async createRun(userId: string, data: InsertRun): Promise<Run> {
    const [run] = await db.insert(runs).values({ ...data, userId, status: "running" }).returning();
    return run;
  }

  async updateRun(id: string, data: Partial<Run>): Promise<Run | undefined> {
    const [run] = await db.update(runs).set(data).where(eq(runs.id, id)).returning();
    return run;
  }

  async getRun(id: string): Promise<Run | undefined> {
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    return run;
  }

  async getRunsByProject(projectId: string): Promise<Run[]> {
    return db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.startedAt)).limit(20);
  }

  async publishProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
    if (!project) return undefined;
    const slug = project.publishedSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id.slice(0, 8);
    const [updated] = await db.update(projects)
      .set({ isPublished: !project.isPublished, publishedSlug: slug, updatedAt: new Date() })
      .where(eq(projects.id, id)).returning();
    return updated;
  }

  async getPublishedProject(id: string): Promise<{project: Project, files: File[]} | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.isPublished, true))).limit(1);
    if (!project) return undefined;
    const fileList = await db.select().from(files).where(eq(files.projectId, id));
    return { project, files: fileList };
  }

  async getWorkspaceByProject(projectId: string): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
    return ws;
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    return ws;
  }

  async createWorkspace(data: InsertWorkspace): Promise<Workspace> {
    const [ws] = await db.insert(workspaces).values(data).returning();
    return ws;
  }

  async updateWorkspaceStatus(id: string, statusCache: string): Promise<Workspace | undefined> {
    const [ws] = await db.update(workspaces).set({ statusCache, lastSeenAt: new Date() }).where(eq(workspaces.id, id)).returning();
    return ws;
  }

  async touchWorkspace(id: string): Promise<void> {
    await db.update(workspaces).set({ lastSeenAt: new Date() }).where(eq(workspaces.id, id));
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await db.delete(workspaceSessions).where(eq(workspaceSessions.workspaceId, id));
    const result = await db.delete(workspaces).where(eq(workspaces.id, id)).returning();
    return result.length > 0;
  }

  async createWorkspaceSession(data: InsertWorkspaceSession): Promise<WorkspaceSession> {
    const [session] = await db.insert(workspaceSessions).values(data).returning();
    return session;
  }

  async getWorkspaceSession(id: string): Promise<WorkspaceSession | undefined> {
    const [session] = await db.select().from(workspaceSessions).where(eq(workspaceSessions.id, id)).limit(1);
    return session;
  }

  async getDemoProject(): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.isDemo, true)).limit(1);
    return project;
  }

  async seedDemoProject(): Promise<void> {
    const existing = await this.getDemoProject();
    if (existing) return;
    const [demoProject] = await db.insert(projects).values({
      userId: "demo", name: "hello-world-demo", language: "javascript", isDemo: true,
    }).returning();
    await db.insert(files).values([
      { projectId: demoProject.id, filename: "index.js", content: `// Welcome to Replit!\n// This is a read-only demo project.\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);\n}\n\nconsole.log("\\nHello from Replit!");\n` },
      { projectId: demoProject.id, filename: "utils.js", content: `// Utility functions\n\nfunction formatDate(date) {\n  return new Intl.DateTimeFormat('en-US', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  }).format(date);\n}\n\nconsole.log("Today is:", formatDate(new Date()));\n` },
    ]);
  }

  async getCommits(projectId: string, branchName?: string): Promise<Commit[]> {
    if (branchName) {
      return db.select().from(commits)
        .where(and(eq(commits.projectId, projectId), eq(commits.branchName, branchName)))
        .orderBy(desc(commits.createdAt)).limit(50);
    }
    return db.select().from(commits).where(eq(commits.projectId, projectId)).orderBy(desc(commits.createdAt)).limit(50);
  }

  async getCommit(id: string): Promise<Commit | undefined> {
    const [commit] = await db.select().from(commits).where(eq(commits.id, id)).limit(1);
    return commit;
  }

  async createCommit(data: InsertCommit): Promise<Commit> {
    const [commit] = await db.insert(commits).values(data).returning();
    return commit;
  }

  async getBranches(projectId: string): Promise<Branch[]> {
    return db.select().from(branches).where(eq(branches.projectId, projectId)).orderBy(branches.createdAt);
  }

  async getBranch(projectId: string, name: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches)
      .where(and(eq(branches.projectId, projectId), eq(branches.name, name))).limit(1);
    return branch;
  }

  async createBranch(data: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  }

  async updateBranchHead(id: string, headCommitId: string): Promise<Branch | undefined> {
    const [branch] = await db.update(branches).set({ headCommitId }).where(eq(branches.id, id)).returning();
    return branch;
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id)).returning();
    return result.length > 0;
  }

  async createExecutionLog(data: InsertExecutionLog): Promise<ExecutionLog> {
    const [log] = await db.insert(executionLogs).values(data).returning();
    return log;
  }

  async getExecutionLogs(filters?: { userId?: string; securityViolation?: boolean; limit?: number }): Promise<ExecutionLog[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(executionLogs.userId, filters.userId));
    if (filters?.securityViolation !== undefined) {
      conditions.push(filters.securityViolation ? sql`${executionLogs.securityViolation} IS NOT NULL` : sql`${executionLogs.securityViolation} IS NULL`);
    }
    const query = db.select().from(executionLogs);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(executionLogs.createdAt)).limit(filters?.limit || 100);
    }
    return query.orderBy(desc(executionLogs.createdAt)).limit(filters?.limit || 100);
  }

  private resetIfNewDay(quota: UserQuota): boolean {
    const now = new Date();
    const lastReset = new Date(quota.lastResetAt);
    return now.getUTCDate() !== lastReset.getUTCDate() || now.getUTCMonth() !== lastReset.getUTCMonth() || now.getUTCFullYear() !== lastReset.getUTCFullYear();
  }

  async getUserQuota(userId: string): Promise<UserQuota> {
    let [quota] = await db.select().from(userQuotas).where(eq(userQuotas.userId, userId)).limit(1);
    if (!quota) {
      [quota] = await db.insert(userQuotas).values({ userId, plan: "free" }).returning();
    }
    if (this.resetIfNewDay(quota)) {
      [quota] = await db.update(userQuotas)
        .set({ dailyExecutionsUsed: 0, dailyAiCallsUsed: 0, lastResetAt: new Date(), updatedAt: new Date() })
        .where(eq(userQuotas.userId, userId)).returning();
    }
    return quota;
  }

  async incrementExecution(userId: string): Promise<{ allowed: boolean; quota: UserQuota }> {
    const quota = await this.getUserQuota(userId);
    const limits = await this.getPlanLimits(quota.plan || "free");
    if (quota.dailyExecutionsUsed >= limits.dailyExecutions) return { allowed: false, quota };
    const [updated] = await db.update(userQuotas)
      .set({ dailyExecutionsUsed: quota.dailyExecutionsUsed + 1, totalExecutions: quota.totalExecutions + 1, updatedAt: new Date() })
      .where(eq(userQuotas.userId, userId)).returning();
    return { allowed: true, quota: updated };
  }

  async incrementAiCall(userId: string): Promise<{ allowed: boolean; quota: UserQuota }> {
    const quota = await this.getUserQuota(userId);
    const limits = await this.getPlanLimits(quota.plan || "free");
    if (quota.dailyAiCallsUsed >= limits.dailyAiCalls) return { allowed: false, quota };
    const [updated] = await db.update(userQuotas)
      .set({ dailyAiCallsUsed: quota.dailyAiCallsUsed + 1, totalAiCalls: quota.totalAiCalls + 1, updatedAt: new Date() })
      .where(eq(userQuotas.userId, userId)).returning();
    return { allowed: true, quota: updated };
  }

  async checkProjectLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const quota = await this.getUserQuota(userId);
    const limits = await this.getPlanLimits(quota.plan || "free");
    const userProjects = await db.select().from(projects).where(eq(projects.userId, userId));
    return { allowed: userProjects.length < limits.maxProjects, current: userProjects.length, limit: limits.maxProjects };
  }

  async updateStorageUsage(userId: string): Promise<number> {
    const userProjects = await this.getProjects(userId);
    let totalBytes = 0;
    for (const p of userProjects) {
      const pFiles = await this.getFiles(p.id);
      for (const f of pFiles) totalBytes += (f.content || "").length;
    }
    await db.update(userQuotas).set({ storageBytes: totalBytes, updatedAt: new Date() }).where(eq(userQuotas.userId, userId));
    return totalBytes;
  }

  async updateUserPlan(userId: string, plan: string, stripeCustomerId?: string, stripeSubscriptionId?: string): Promise<UserQuota | undefined> {
    const updates: any = { plan, updatedAt: new Date() };
    if (stripeCustomerId) updates.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) updates.stripeSubscriptionId = stripeSubscriptionId;
    const quota = await this.getUserQuota(userId);
    const [updated] = await db.update(userQuotas).set(updates).where(eq(userQuotas.userId, userId)).returning();
    return updated;
  }

  async getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]> {
    return db.select().from(projectEnvVars).where(eq(projectEnvVars.projectId, projectId));
  }

  async getProjectEnvVar(id: string): Promise<ProjectEnvVar | undefined> {
    const [envVar] = await db.select().from(projectEnvVars).where(eq(projectEnvVars.id, id)).limit(1);
    return envVar;
  }

  async createProjectEnvVar(projectId: string, key: string, encryptedValue: string): Promise<ProjectEnvVar> {
    const [envVar] = await db.insert(projectEnvVars).values({ projectId, key, encryptedValue }).returning();
    return envVar;
  }

  async updateProjectEnvVar(id: string, encryptedValue: string): Promise<ProjectEnvVar | undefined> {
    const [envVar] = await db.update(projectEnvVars).set({ encryptedValue }).where(eq(projectEnvVars.id, id)).returning();
    return envVar;
  }

  async deleteProjectEnvVar(id: string): Promise<boolean> {
    const result = await db.delete(projectEnvVars).where(eq(projectEnvVars.id, id)).returning();
    return result.length > 0;
  }

  async getConversation(projectId: string, userId: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations)
      .where(and(eq(aiConversations.projectId, projectId), eq(aiConversations.userId, userId)))
      .orderBy(desc(aiConversations.updatedAt)).limit(1);
    return conv;
  }

  async getConversationById(id: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
    return conv;
  }

  async createConversation(data: InsertAiConversation): Promise<AiConversation> {
    const [conv] = await db.insert(aiConversations).values(data).returning();
    return conv;
  }

  async updateConversation(id: string, data: Partial<{ title: string; model: string }>): Promise<AiConversation | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.model !== undefined) updates.model = data.model;
    const [conv] = await db.update(aiConversations).set(updates).where(eq(aiConversations.id, id)).returning();
    return conv;
  }

  async deleteConversation(id: string): Promise<boolean> {
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
    const result = await db.delete(aiConversations).where(eq(aiConversations.id, id)).returning();
    return result.length > 0;
  }

  async getMessages(conversationId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(aiMessages.createdAt);
  }

  async addMessage(data: InsertAiMessage): Promise<AiMessage> {
    const [msg] = await db.insert(aiMessages).values(data).returning();
    return msg;
  }

  async addMessages(data: InsertAiMessage[]): Promise<AiMessage[]> {
    if (data.length === 0) return [];
    return db.insert(aiMessages).values(data).returning();
  }

  async clearMessages(conversationId: string): Promise<void> {
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, conversationId));
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [t] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return t;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [t] = await db.select().from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), sql`${passwordResetTokens.usedAt} IS NULL`)).limit(1);
    return t;
  }

  async usePasswordResetToken(token: string): Promise<boolean> {
    const [t] = await db.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.token, token), sql`${passwordResetTokens.usedAt} IS NULL`)).returning();
    return !!t;
  }

  async createEmailVerification(userId: string, token: string, expiresAt: Date): Promise<EmailVerification> {
    const [v] = await db.insert(emailVerifications).values({ userId, token, expiresAt }).returning();
    return v;
  }

  async getEmailVerification(token: string): Promise<EmailVerification | undefined> {
    const [v] = await db.select().from(emailVerifications)
      .where(and(eq(emailVerifications.token, token), sql`${emailVerifications.verifiedAt} IS NULL`)).limit(1);
    return v;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const v = await this.getEmailVerification(token);
    if (!v || new Date() > v.expiresAt) return false;
    await db.update(emailVerifications).set({ verifiedAt: new Date() }).where(eq(emailVerifications.id, v.id));
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, v.userId));
    return true;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(data).returning();
    await db.insert(teamMembers).values({ teamId: team.id, userId: data.ownerId, role: "owner" });
    return team;
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return team;
  }

  async getTeamBySlug(slug: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
    return team;
  }

  async getUserTeams(userId: string): Promise<(Team & { role: string })[]> {
    const memberships = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
    const result: (Team & { role: string })[] = [];
    for (const m of memberships) {
      const team = await this.getTeam(m.teamId);
      if (team) result.push({ ...team, role: m.role });
    }
    return result;
  }

  async updateTeam(id: string, data: Partial<{ name: string; avatarUrl: string; plan: string }>): Promise<Team | undefined> {
    const [team] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    return team;
  }

  async deleteTeam(id: string): Promise<boolean> {
    await db.delete(teamInvites).where(eq(teamInvites.teamId, id));
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    return result.length > 0;
  }

  async addTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [member] = await db.insert(teamMembers).values(data).returning();
    return member;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<boolean> {
    const result = await db.delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).returning();
    return result.length > 0;
  }

  async getTeamMembers(teamId: string): Promise<(TeamMember & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]> {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    const result = [];
    for (const m of members) {
      const user = await this.getUser(m.userId);
      if (user) {
        result.push({ ...m, user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl } });
      }
    }
    return result;
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember | undefined> {
    const [member] = await db.update(teamMembers).set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).returning();
    return member;
  }

  async createTeamInvite(teamId: string, email: string, role: string, invitedBy: string, token: string, expiresAt: Date): Promise<TeamInvite> {
    const [invite] = await db.insert(teamInvites).values({ teamId, email, role, invitedBy, token, expiresAt }).returning();
    return invite;
  }

  async getTeamInvite(token: string): Promise<TeamInvite | undefined> {
    const [invite] = await db.select().from(teamInvites)
      .where(and(eq(teamInvites.token, token), sql`${teamInvites.acceptedAt} IS NULL`)).limit(1);
    return invite;
  }

  async getTeamInvites(teamId: string): Promise<TeamInvite[]> {
    return db.select().from(teamInvites)
      .where(and(eq(teamInvites.teamId, teamId), sql`${teamInvites.acceptedAt} IS NULL`))
      .orderBy(desc(teamInvites.createdAt));
  }

  async acceptTeamInvite(token: string): Promise<TeamInvite | undefined> {
    const invite = await this.getTeamInvite(token);
    if (!invite || new Date() > invite.expiresAt) return undefined;
    const [updated] = await db.update(teamInvites).set({ acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id)).returning();
    return updated;
  }

  async deleteTeamInvite(id: string): Promise<boolean> {
    const result = await db.delete(teamInvites).where(eq(teamInvites.id, id)).returning();
    return result.length > 0;
  }

  async trackEvent(userId: string | null, event: string, properties?: Record<string, any>): Promise<void> {
    await db.insert(analyticsEvents).values({ userId, event, properties: properties || {} });
  }

  async getAnalytics(filters?: { event?: string; userId?: string; since?: Date; limit?: number }): Promise<AnalyticsEvent[]> {
    const conditions = [];
    if (filters?.event) conditions.push(eq(analyticsEvents.event, filters.event));
    if (filters?.userId) conditions.push(eq(analyticsEvents.userId, filters.userId));
    if (filters?.since) conditions.push(gte(analyticsEvents.createdAt, filters.since));
    const query = db.select().from(analyticsEvents);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(analyticsEvents.createdAt)).limit(filters?.limit || 100);
    }
    return query.orderBy(desc(analyticsEvents.createdAt)).limit(filters?.limit || 100);
  }

  async getAnalyticsSummary(): Promise<{ totalUsers: number; totalProjects: number; totalExecutions: number; totalAiCalls: number; activeToday: number }> {
    const [{ value: totalUsers }] = await db.select({ value: count() }).from(users);
    const [{ value: totalProjects }] = await db.select({ value: count() }).from(projects);
    const allQuotas = await db.select().from(userQuotas);
    const totalExecutions = allQuotas.reduce((s, q) => s + q.totalExecutions, 0);
    const totalAiCalls = allQuotas.reduce((s, q) => s + q.totalAiCalls, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ value: activeToday }] = await db.select({ value: count() }).from(analyticsEvents).where(gte(analyticsEvents.createdAt, today));
    return { totalUsers, totalProjects, totalExecutions, totalAiCalls, activeToday };
  }

  async createDeployment(data: InsertDeployment): Promise<Deployment> {
    const [dep] = await db.insert(deployments).values(data).returning();
    return dep;
  }

  async getDeployment(id: string): Promise<Deployment | undefined> {
    const [dep] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    return dep;
  }

  async getProjectDeployments(projectId: string): Promise<Deployment[]> {
    return db.select().from(deployments).where(eq(deployments.projectId, projectId)).orderBy(desc(deployments.createdAt)).limit(20);
  }

  async updateDeployment(id: string, data: Partial<{ status: string; buildLog: string; url: string; finishedAt: Date }>): Promise<Deployment | undefined> {
    const [dep] = await db.update(deployments).set(data).where(eq(deployments.id, id)).returning();
    return dep;
  }

  async createCustomDomain(data: { domain: string; projectId: string; userId: string; verificationToken: string }): Promise<CustomDomain> {
    const [domain] = await db.insert(customDomains).values(data).returning();
    return domain;
  }

  async getCustomDomain(id: string): Promise<CustomDomain | undefined> {
    const [domain] = await db.select().from(customDomains).where(eq(customDomains.id, id)).limit(1);
    return domain;
  }

  async getCustomDomainByHostname(hostname: string): Promise<CustomDomain | undefined> {
    const [domain] = await db.select().from(customDomains).where(eq(customDomains.domain, hostname.toLowerCase())).limit(1);
    return domain;
  }

  async getProjectCustomDomains(projectId: string): Promise<CustomDomain[]> {
    return db.select().from(customDomains).where(eq(customDomains.projectId, projectId)).orderBy(desc(customDomains.createdAt));
  }

  async updateCustomDomain(id: string, data: Partial<{ verified: boolean; verifiedAt: Date; sslStatus: string; sslExpiresAt: Date }>): Promise<CustomDomain | undefined> {
    const [domain] = await db.update(customDomains).set(data).where(eq(customDomains.id, id)).returning();
    return domain;
  }

  async deleteCustomDomain(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(customDomains).where(and(eq(customDomains.id, id), eq(customDomains.userId, userId))).returning();
    return result.length > 0;
  }

  async getPlanConfig(plan: string): Promise<PlanConfig | undefined> {
    const [config] = await db.select().from(planConfigs).where(eq(planConfigs.plan, plan)).limit(1);
    return config;
  }

  async getAllPlanConfigs(): Promise<PlanConfig[]> {
    return db.select().from(planConfigs).orderBy(planConfigs.price);
  }

  async seedPlanConfigs(): Promise<void> {
    const existing = await db.select().from(planConfigs).limit(1);
    if (existing.length > 0) return;
    await db.insert(planConfigs).values([
      {
        plan: "free", dailyExecutions: 50, dailyAiCalls: 20, storageMb: 50, maxProjects: 5, price: 0,
        description: "Perfect for learning and personal projects",
        features: ["5 projects", "50 code executions / day", "20 AI calls / day", "50 MB storage", "JavaScript & Python", "Community support"],
      },
      {
        plan: "pro", dailyExecutions: 500, dailyAiCalls: 200, storageMb: 5000, maxProjects: 50, price: 1200,
        description: "For developers who need more power and flexibility",
        features: ["Unlimited projects", "500 code executions / day", "200 AI calls / day", "5 GB storage", "All languages (Go, Java, C++, Ruby, Bash)", "Priority AI (GPT-4o, Claude, Gemini)", "Custom domains", "Priority support"],
      },
      {
        plan: "team", dailyExecutions: 2000, dailyAiCalls: 1000, storageMb: 50000, maxProjects: 200, price: 2500,
        description: "For teams building together with shared workspaces",
        features: ["Everything in Pro", "Unlimited team members", "Shared projects & workspaces", "Team admin dashboard", "SSO & SAML", "Audit logs", "99.9% uptime SLA", "Dedicated support"],
      },
    ]);
  }

  async getPlanLimits(plan: string): Promise<{ dailyExecutions: number; dailyAiCalls: number; storageMb: number; maxProjects: number; price: number }> {
    const config = await this.getPlanConfig(plan);
    if (config) {
      return { dailyExecutions: config.dailyExecutions, dailyAiCalls: config.dailyAiCalls, storageMb: config.storageMb, maxProjects: config.maxProjects, price: config.price };
    }
    const fallback = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    return { ...fallback };
  }

  async getLandingStats(): Promise<{ label: string; value: string }[]> {
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    const [{ value: projectCount }] = await db.select({ value: count() }).from(projects);
    const languageRows = await db.selectDistinct({ language: projects.language }).from(projects);
    const languageCount = languageRows.length || 10;
    return [
      { value: `${languageCount}+`, label: "Languages" },
      { value: "3", label: "AI Models" },
      { value: `${userCount}+`, label: "Developers" },
      { value: `${projectCount}+`, label: "Projects" },
    ];
  }

  async getUserRecentLanguages(userId: string): Promise<string[]> {
    const recentProjects = await db.select({ language: projects.language })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(10);
    const langs = [...new Set(recentProjects.map(p => p.language.toLowerCase()))];

    const recentActivity = await db.select({ properties: analyticsEvents.properties })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.userId, userId), eq(analyticsEvents.event, "code_executed")))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(20);
    for (const row of recentActivity) {
      const props = row.properties as { language?: string } | null;
      if (props?.language && typeof props.language === "string") {
        const normalized = props.language.toLowerCase();
        if (!langs.includes(normalized)) {
          langs.push(normalized);
        }
      }
    }

    return langs;
  }
}

export const storage = new DatabaseStorage();
