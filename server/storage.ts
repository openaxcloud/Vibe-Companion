import { eq, desc, and, sql, inArray, count, gte } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, files, runs, workspaces, workspaceSessions,
  commits, branches, executionLogs, userQuotas, gitRepoState,
  projectEnvVars,
  aiConversations, aiMessages,
  passwordResetTokens, emailVerifications,
  teams, teamMembers, teamInvites,
  analyticsEvents, deployments,
  customDomains, planConfigs,
  securityScans, securityFindings,
  storageKv, storageObjects,
  projectAuthConfig, projectAuthUsers,
  integrationCatalog, projectIntegrations, integrationLogs,
  automations, automationRuns,
  workflows, workflowSteps, workflowRuns,
  monitoringMetrics, monitoringAlerts,
  codeThreads, threadComments,
  portConfigs,
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
  type SecurityScan, type InsertSecurityScan,
  type SecurityFinding, type InsertSecurityFinding,
  type StorageKv, type InsertStorageKv,
  type StorageObject, type InsertStorageObject,
  type ProjectAuthConfig,
  type ProjectAuthUser,
  type IntegrationCatalogEntry,
  type ProjectIntegration,
  type IntegrationLog,
  type Automation, type InsertAutomation,
  type AutomationRun,
  type Workflow, type InsertWorkflow,
  type WorkflowStep, type InsertWorkflowStep,
  type WorkflowRun,
  type MonitoringMetric,
  type MonitoringAlert, type InsertMonitoringAlert,
  type CodeThread, type InsertCodeThread,
  type ThreadComment, type InsertThreadComment,
  type PortConfig, type InsertPortConfig,
  PLAN_LIMITS,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { githubId?: string; avatarUrl?: string; emailVerified?: boolean }): Promise<User>;
  updateUser(id: string, data: Partial<{ displayName: string; avatarUrl: string; password: string; emailVerified: boolean; githubId: string }>): Promise<User | undefined>;
  getUserPreferences(userId: string): Promise<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }>;
  updateUserPreferences(userId: string, prefs: Partial<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }>): Promise<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(limit?: number, offset?: number): Promise<{ users: User[]; total: number }>;

  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(userId: string, data: InsertProject): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  duplicateProject(id: string, userId: string): Promise<Project | undefined>;
  createProjectFromTemplate(userId: string, data: { name: string; language: string; files: { filename: string; content: string }[] }): Promise<Project>;
  updateProject(id: string, data: Partial<{ name: string; language: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string; githubRepo: string }>): Promise<Project | undefined>;

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

  getGitRepoState(projectId: string): Promise<string | null>;
  saveGitRepoState(projectId: string, packData: string): Promise<void>;

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
  demotePreviousLiveDeployments(projectId: string, excludeDeploymentId: string): Promise<void>;

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

  createSecurityScan(data: InsertSecurityScan): Promise<SecurityScan>;
  getSecurityScan(id: string): Promise<SecurityScan | undefined>;
  updateSecurityScan(id: string, data: Partial<{ status: string; totalFindings: number; critical: number; high: number; medium: number; low: number; info: number; finishedAt: Date }>): Promise<SecurityScan | undefined>;
  getProjectScans(projectId: string): Promise<SecurityScan[]>;
  createSecurityFinding(data: InsertSecurityFinding): Promise<SecurityFinding>;
  createSecurityFindings(data: InsertSecurityFinding[]): Promise<SecurityFinding[]>;
  getScanFindings(scanId: string): Promise<SecurityFinding[]>;

  getStorageKvEntries(projectId: string): Promise<StorageKv[]>;
  getStorageKvEntry(projectId: string, key: string): Promise<StorageKv | undefined>;
  setStorageKvEntry(projectId: string, key: string, value: string): Promise<StorageKv>;
  deleteStorageKvEntry(projectId: string, key: string): Promise<boolean>;

  getStorageObjects(projectId: string): Promise<StorageObject[]>;
  getStorageObject(id: string): Promise<StorageObject | undefined>;
  createStorageObject(data: InsertStorageObject): Promise<StorageObject>;
  deleteStorageObject(id: string): Promise<boolean>;
  getProjectStorageUsage(projectId: string): Promise<{ kvCount: number; kvSizeBytes: number; objectCount: number; objectSizeBytes: number; totalBytes: number }>;

  getProjectAuthConfig(projectId: string): Promise<ProjectAuthConfig | undefined>;
  upsertProjectAuthConfig(projectId: string, data: Partial<{ enabled: boolean; providers: string[]; requireEmailVerification: boolean; sessionDurationHours: number; allowedDomains: string[] }>): Promise<ProjectAuthConfig>;
  getProjectAuthUsers(projectId: string): Promise<ProjectAuthUser[]>;
  createProjectAuthUser(projectId: string, email: string, passwordHash: string, provider: string): Promise<ProjectAuthUser>;
  deleteProjectAuthUser(projectId: string, id: string): Promise<boolean>;

  getIntegrationCatalog(): Promise<IntegrationCatalogEntry[]>;
  seedIntegrationCatalog(): Promise<void>;
  getProjectIntegrations(projectId: string): Promise<(ProjectIntegration & { integration: IntegrationCatalogEntry })[]>;
  connectIntegration(projectId: string, integrationId: string, config: Record<string, string>): Promise<ProjectIntegration>;
  disconnectIntegration(projectId: string, id: string): Promise<boolean>;
  updateIntegrationStatus(id: string, status: string): Promise<ProjectIntegration | undefined>;
  getIntegrationLogs(projectId: string, projectIntegrationId: string, limit?: number): Promise<IntegrationLog[]>;
  addIntegrationLog(projectIntegrationId: string, level: string, message: string): Promise<IntegrationLog>;

  getAutomations(projectId: string): Promise<Automation[]>;
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(data: InsertAutomation & { webhookToken?: string }): Promise<Automation>;
  updateAutomation(id: string, data: Partial<{ name: string; cronExpression: string; script: string; language: string; enabled: boolean; lastRunAt: Date }>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<boolean>;
  getAutomationByWebhookToken(token: string): Promise<Automation | undefined>;
  createAutomationRun(automationId: string, triggeredBy: string): Promise<AutomationRun>;
  updateAutomationRun(id: string, data: Partial<{ status: string; stdout: string; stderr: string; exitCode: number; durationMs: number; finishedAt: Date }>): Promise<AutomationRun | undefined>;
  getAutomationRuns(automationId: string, limit?: number): Promise<AutomationRun[]>;

  getWorkflows(projectId: string): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, data: Partial<{ name: string; triggerEvent: string; enabled: boolean }>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  getWorkflowStep(id: string): Promise<WorkflowStep | undefined>;
  getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  createWorkflowStep(data: InsertWorkflowStep): Promise<WorkflowStep>;
  updateWorkflowStep(id: string, data: Partial<{ name: string; command: string; orderIndex: number; continueOnError: boolean }>): Promise<WorkflowStep | undefined>;
  deleteWorkflowStep(id: string): Promise<boolean>;
  createWorkflowRun(workflowId: string): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, data: Partial<{ status: string; stepResults: any; durationMs: number; finishedAt: Date }>): Promise<WorkflowRun | undefined>;
  getWorkflowRuns(workflowId: string, limit?: number): Promise<WorkflowRun[]>;

  getMonitoringMetrics(projectId: string, limit?: number): Promise<MonitoringMetric[]>;
  recordMonitoringMetric(projectId: string, metricType: string, value: number, metadata?: Record<string, any>): Promise<MonitoringMetric>;
  getMonitoringSummary(projectId: string): Promise<{ requests: number; errors: number; avgResponseMs: number; uptime: number; cpuPercent: number; memoryMb: number }>;
  getMonitoringAlerts(projectId: string): Promise<MonitoringAlert[]>;
  createMonitoringAlert(data: InsertMonitoringAlert): Promise<MonitoringAlert>;
  updateMonitoringAlert(id: string, data: Partial<{ enabled: boolean; lastTriggeredAt: Date }>): Promise<MonitoringAlert | undefined>;
  deleteMonitoringAlert(id: string): Promise<boolean>;

  getCodeThreads(projectId: string): Promise<CodeThread[]>;
  getCodeThread(id: string): Promise<CodeThread | undefined>;
  createCodeThread(data: InsertCodeThread): Promise<CodeThread>;
  updateCodeThread(id: string, data: Partial<{ status: string; resolvedAt: Date }>): Promise<CodeThread | undefined>;
  deleteCodeThread(id: string): Promise<boolean>;
  getThreadComments(threadId: string): Promise<ThreadComment[]>;
  createThreadComment(data: InsertThreadComment): Promise<ThreadComment>;

  getPortConfigs(projectId: string): Promise<PortConfig[]>;
  getPortConfig(id: string): Promise<PortConfig | undefined>;
  createPortConfig(data: InsertPortConfig): Promise<PortConfig>;
  updatePortConfig(id: string, data: Partial<{ label: string; protocol: string; isPublic: boolean }>): Promise<PortConfig | undefined>;
  deletePortConfig(id: string): Promise<boolean>;
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

  async getUserPreferences(userId: string): Promise<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }> {
    const defaults = { fontSize: 14, tabSize: 2, wordWrap: false, theme: "dark" };
    const user = await this.getUser(userId);
    if (!user || !user.preferences) return defaults;
    return { ...defaults, ...user.preferences };
  }

  async updateUserPreferences(userId: string, prefs: Partial<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }>): Promise<{ fontSize: number; tabSize: number; wordWrap: boolean; theme: string }> {
    const current = await this.getUserPreferences(userId);
    const merged = { ...current, ...prefs };
    await db.update(users).set({ preferences: merged }).where(eq(users.id, userId));
    return merged;
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

  async updateProject(id: string, data: Partial<{ name: string; language: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string; githubRepo: string }>): Promise<Project | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.language !== undefined) updates.language = data.language;
    if (data.isPublished !== undefined) updates.isPublished = data.isPublished;
    if (data.publishedSlug !== undefined) updates.publishedSlug = data.publishedSlug;
    if (data.customDomain !== undefined) updates.customDomain = data.customDomain;
    if (data.teamId !== undefined) updates.teamId = data.teamId;
    if (data.githubRepo !== undefined) updates.githubRepo = data.githubRepo;
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

  async getGitRepoState(projectId: string): Promise<string | null> {
    try {
      const [row] = await db.select().from(gitRepoState).where(eq(gitRepoState.projectId, projectId)).limit(1);
      return row ? row.packData : null;
    } catch {
      return null;
    }
  }

  async saveGitRepoState(projectId: string, packData: string): Promise<void> {
    try {
      const [existing] = await db.select({ id: gitRepoState.id }).from(gitRepoState).where(eq(gitRepoState.projectId, projectId)).limit(1);
      if (existing) {
        await db.update(gitRepoState).set({ packData, updatedAt: new Date() }).where(eq(gitRepoState.id, existing.id));
      } else {
        await db.insert(gitRepoState).values({ projectId, packData });
      }
    } catch {
    }
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

  async demotePreviousLiveDeployments(projectId: string, excludeDeploymentId: string): Promise<void> {
    await db.update(deployments)
      .set({ status: "stopped" })
      .where(
        and(
          eq(deployments.projectId, projectId),
          eq(deployments.status, "live"),
          sql`${deployments.id} != ${excludeDeploymentId}`
        )
      );
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

  async createSecurityScan(data: InsertSecurityScan): Promise<SecurityScan> {
    const [scan] = await db.insert(securityScans).values(data).returning();
    return scan;
  }

  async getSecurityScan(id: string): Promise<SecurityScan | undefined> {
    const [scan] = await db.select().from(securityScans).where(eq(securityScans.id, id)).limit(1);
    return scan;
  }

  async updateSecurityScan(id: string, data: Partial<{ status: string; totalFindings: number; critical: number; high: number; medium: number; low: number; info: number; finishedAt: Date }>): Promise<SecurityScan | undefined> {
    const [scan] = await db.update(securityScans).set(data).where(eq(securityScans.id, id)).returning();
    return scan;
  }

  async getProjectScans(projectId: string): Promise<SecurityScan[]> {
    return db.select().from(securityScans).where(eq(securityScans.projectId, projectId)).orderBy(desc(securityScans.createdAt)).limit(20);
  }

  async createSecurityFinding(data: InsertSecurityFinding): Promise<SecurityFinding> {
    const [finding] = await db.insert(securityFindings).values(data).returning();
    return finding;
  }

  async createSecurityFindings(data: InsertSecurityFinding[]): Promise<SecurityFinding[]> {
    if (data.length === 0) return [];
    return db.insert(securityFindings).values(data).returning();
  }

  async getScanFindings(scanId: string): Promise<SecurityFinding[]> {
    return db.select().from(securityFindings).where(eq(securityFindings.scanId, scanId));
  }

  async getStorageKvEntries(projectId: string): Promise<StorageKv[]> {
    return db.select().from(storageKv).where(eq(storageKv.projectId, projectId)).orderBy(storageKv.key);
  }

  async getStorageKvEntry(projectId: string, key: string): Promise<StorageKv | undefined> {
    const [entry] = await db.select().from(storageKv).where(and(eq(storageKv.projectId, projectId), eq(storageKv.key, key))).limit(1);
    return entry;
  }

  async setStorageKvEntry(projectId: string, key: string, value: string): Promise<StorageKv> {
    const existing = await this.getStorageKvEntry(projectId, key);
    if (existing) {
      const [updated] = await db.update(storageKv).set({ value, updatedAt: new Date() }).where(eq(storageKv.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(storageKv).values({ projectId, key, value }).returning();
    return created;
  }

  async deleteStorageKvEntry(projectId: string, key: string): Promise<boolean> {
    const result = await db.delete(storageKv).where(and(eq(storageKv.projectId, projectId), eq(storageKv.key, key))).returning();
    return result.length > 0;
  }

  async getStorageObjects(projectId: string): Promise<StorageObject[]> {
    return db.select().from(storageObjects).where(eq(storageObjects.projectId, projectId)).orderBy(desc(storageObjects.createdAt));
  }

  async getStorageObject(id: string): Promise<StorageObject | undefined> {
    const [obj] = await db.select().from(storageObjects).where(eq(storageObjects.id, id)).limit(1);
    return obj;
  }

  async createStorageObject(data: InsertStorageObject): Promise<StorageObject> {
    const [obj] = await db.insert(storageObjects).values(data).returning();
    return obj;
  }

  async deleteStorageObject(id: string): Promise<boolean> {
    const result = await db.delete(storageObjects).where(eq(storageObjects.id, id)).returning();
    return result.length > 0;
  }

  async getProjectStorageUsage(projectId: string): Promise<{ kvCount: number; kvSizeBytes: number; objectCount: number; objectSizeBytes: number; totalBytes: number }> {
    const kvEntries = await db.select().from(storageKv).where(eq(storageKv.projectId, projectId));
    const kvCount = kvEntries.length;
    const kvSizeBytes = kvEntries.reduce((sum, e) => sum + Buffer.byteLength(e.key + e.value, "utf-8"), 0);
    const objects = await db.select().from(storageObjects).where(eq(storageObjects.projectId, projectId));
    const objectCount = objects.length;
    const objectSizeBytes = objects.reduce((sum, o) => sum + o.sizeBytes, 0);
    return { kvCount, kvSizeBytes, objectCount, objectSizeBytes, totalBytes: kvSizeBytes + objectSizeBytes };
  }

  async getProjectAuthConfig(projectId: string): Promise<ProjectAuthConfig | undefined> {
    const [config] = await db.select().from(projectAuthConfig).where(eq(projectAuthConfig.projectId, projectId)).limit(1);
    return config;
  }

  async upsertProjectAuthConfig(projectId: string, data: Partial<{ enabled: boolean; providers: string[]; requireEmailVerification: boolean; sessionDurationHours: number; allowedDomains: string[] }>): Promise<ProjectAuthConfig> {
    const existing = await this.getProjectAuthConfig(projectId);
    if (existing) {
      const updates: any = {};
      if (data.enabled !== undefined) updates.enabled = data.enabled;
      if (data.providers !== undefined) updates.providers = data.providers;
      if (data.requireEmailVerification !== undefined) updates.requireEmailVerification = data.requireEmailVerification;
      if (data.sessionDurationHours !== undefined) updates.sessionDurationHours = data.sessionDurationHours;
      if (data.allowedDomains !== undefined) updates.allowedDomains = data.allowedDomains;
      const [updated] = await db.update(projectAuthConfig).set(updates).where(eq(projectAuthConfig.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(projectAuthConfig).values({
      projectId,
      enabled: data.enabled ?? false,
      providers: data.providers ?? ["email"],
      requireEmailVerification: data.requireEmailVerification ?? false,
      sessionDurationHours: data.sessionDurationHours ?? 24,
      allowedDomains: data.allowedDomains ?? [],
    }).returning();
    return created;
  }

  async getProjectAuthUsers(projectId: string): Promise<ProjectAuthUser[]> {
    return db.select().from(projectAuthUsers).where(eq(projectAuthUsers.projectId, projectId)).orderBy(desc(projectAuthUsers.createdAt));
  }

  async createProjectAuthUser(projectId: string, email: string, passwordHash: string, provider: string): Promise<ProjectAuthUser> {
    const [user] = await db.insert(projectAuthUsers).values({ projectId, email, passwordHash, provider }).returning();
    return user;
  }

  async deleteProjectAuthUser(projectId: string, id: string): Promise<boolean> {
    const result = await db.delete(projectAuthUsers).where(and(eq(projectAuthUsers.id, id), eq(projectAuthUsers.projectId, projectId))).returning();
    return result.length > 0;
  }

  async getIntegrationCatalog(): Promise<IntegrationCatalogEntry[]> {
    return db.select().from(integrationCatalog).orderBy(integrationCatalog.category, integrationCatalog.name);
  }

  async seedIntegrationCatalog(): Promise<void> {
    const existing = await db.select().from(integrationCatalog).limit(1);
    if (existing.length > 0) return;
    await db.insert(integrationCatalog).values([
      { name: "PostgreSQL", category: "Database", description: "Connect to a PostgreSQL database", icon: "database", envVarKeys: ["DATABASE_URL"] },
      { name: "Redis", category: "Database", description: "In-memory data store for caching", icon: "database", envVarKeys: ["REDIS_URL"] },
      { name: "MongoDB", category: "Database", description: "NoSQL document database", icon: "database", envVarKeys: ["MONGODB_URI"] },
      { name: "OpenAI", category: "AI & ML", description: "GPT models and embeddings API", icon: "sparkles", envVarKeys: ["OPENAI_API_KEY"] },
      { name: "Anthropic", category: "AI & ML", description: "Claude AI assistant API", icon: "sparkles", envVarKeys: ["ANTHROPIC_API_KEY"] },
      { name: "Stripe", category: "Payments", description: "Payment processing and subscriptions", icon: "credit-card", envVarKeys: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"] },
      { name: "GitHub", category: "Developer Tools", description: "Source control and CI/CD integration", icon: "github", envVarKeys: ["GITHUB_TOKEN"] },
      { name: "AWS S3", category: "Cloud Storage", description: "Object storage for files and assets", icon: "cloud", envVarKeys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET"] },
      { name: "SendGrid", category: "Communication", description: "Email delivery service", icon: "mail", envVarKeys: ["SENDGRID_API_KEY"] },
      { name: "Twilio", category: "Communication", description: "SMS and voice communication", icon: "phone", envVarKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] },
      { name: "Firebase", category: "Backend Services", description: "Authentication, database, and hosting", icon: "flame", envVarKeys: ["FIREBASE_API_KEY", "FIREBASE_PROJECT_ID"] },
      { name: "Supabase", category: "Backend Services", description: "Open source Firebase alternative", icon: "zap", envVarKeys: ["SUPABASE_URL", "SUPABASE_ANON_KEY"] },
    ]);
  }

  async getProjectIntegrations(projectId: string): Promise<(ProjectIntegration & { integration: IntegrationCatalogEntry })[]> {
    const rows = await db.select()
      .from(projectIntegrations)
      .innerJoin(integrationCatalog, eq(projectIntegrations.integrationId, integrationCatalog.id))
      .where(eq(projectIntegrations.projectId, projectId));
    return rows.map(r => ({
      ...r.project_integrations,
      integration: r.integration_catalog,
    }));
  }

  async connectIntegration(projectId: string, integrationId: string, config: Record<string, string>): Promise<ProjectIntegration> {
    const [pi] = await db.insert(projectIntegrations).values({
      projectId,
      integrationId,
      status: "connected",
      config,
    }).returning();
    return pi;
  }

  async disconnectIntegration(projectId: string, id: string): Promise<boolean> {
    await db.delete(integrationLogs).where(eq(integrationLogs.projectIntegrationId, id));
    const result = await db.delete(projectIntegrations).where(and(eq(projectIntegrations.id, id), eq(projectIntegrations.projectId, projectId))).returning();
    return result.length > 0;
  }

  async updateIntegrationStatus(id: string, status: string): Promise<ProjectIntegration | undefined> {
    const [updated] = await db.update(projectIntegrations).set({ status }).where(eq(projectIntegrations.id, id)).returning();
    return updated;
  }

  async getIntegrationLogs(projectId: string, projectIntegrationId: string, limit = 50): Promise<IntegrationLog[]> {
    const pi = await db.select().from(projectIntegrations)
      .where(and(eq(projectIntegrations.id, projectIntegrationId), eq(projectIntegrations.projectId, projectId)))
      .limit(1);
    if (pi.length === 0) return [];
    return db.select().from(integrationLogs)
      .where(eq(integrationLogs.projectIntegrationId, projectIntegrationId))
      .orderBy(desc(integrationLogs.createdAt))
      .limit(limit);
  }

  async addIntegrationLog(projectIntegrationId: string, level: string, message: string): Promise<IntegrationLog> {
    const [log] = await db.insert(integrationLogs).values({ projectIntegrationId, level, message }).returning();
    return log;
  }

  async getAutomations(projectId: string): Promise<Automation[]> {
    return db.select().from(automations).where(eq(automations.projectId, projectId)).orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const [a] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
    return a;
  }

  async createAutomation(data: InsertAutomation & { webhookToken?: string }): Promise<Automation> {
    const [a] = await db.insert(automations).values(data).returning();
    return a;
  }

  async updateAutomation(id: string, data: Partial<{ name: string; cronExpression: string; script: string; language: string; enabled: boolean; lastRunAt: Date }>): Promise<Automation | undefined> {
    const [a] = await db.update(automations).set(data).where(eq(automations.id, id)).returning();
    return a;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    await db.delete(automationRuns).where(eq(automationRuns.automationId, id));
    const result = await db.delete(automations).where(eq(automations.id, id)).returning();
    return result.length > 0;
  }

  async getAutomationByWebhookToken(token: string): Promise<Automation | undefined> {
    const [a] = await db.select().from(automations).where(eq(automations.webhookToken, token)).limit(1);
    return a;
  }

  async createAutomationRun(automationId: string, triggeredBy: string): Promise<AutomationRun> {
    const [run] = await db.insert(automationRuns).values({ automationId, triggeredBy, status: "running" }).returning();
    return run;
  }

  async updateAutomationRun(id: string, data: Partial<{ status: string; stdout: string; stderr: string; exitCode: number; durationMs: number; finishedAt: Date }>): Promise<AutomationRun | undefined> {
    const [run] = await db.update(automationRuns).set(data).where(eq(automationRuns.id, id)).returning();
    return run;
  }

  async getAutomationRuns(automationId: string, limit = 20): Promise<AutomationRun[]> {
    return db.select().from(automationRuns).where(eq(automationRuns.automationId, automationId)).orderBy(desc(automationRuns.startedAt)).limit(limit);
  }

  async getWorkflows(projectId: string): Promise<Workflow[]> {
    return db.select().from(workflows).where(eq(workflows.projectId, projectId)).orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [w] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    return w;
  }

  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [w] = await db.insert(workflows).values(data).returning();
    return w;
  }

  async updateWorkflow(id: string, data: Partial<{ name: string; triggerEvent: string; enabled: boolean }>): Promise<Workflow | undefined> {
    const [w] = await db.update(workflows).set(data).where(eq(workflows.id, id)).returning();
    return w;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await db.delete(workflowRuns).where(eq(workflowRuns.workflowId, id));
    await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));
    const result = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    return result.length > 0;
  }

  async getWorkflowStep(id: string): Promise<WorkflowStep | undefined> {
    const [s] = await db.select().from(workflowSteps).where(eq(workflowSteps.id, id));
    return s;
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflowId)).orderBy(workflowSteps.orderIndex);
  }

  async createWorkflowStep(data: InsertWorkflowStep): Promise<WorkflowStep> {
    const [s] = await db.insert(workflowSteps).values(data).returning();
    return s;
  }

  async updateWorkflowStep(id: string, data: Partial<{ name: string; command: string; orderIndex: number; continueOnError: boolean }>): Promise<WorkflowStep | undefined> {
    const [s] = await db.update(workflowSteps).set(data).where(eq(workflowSteps.id, id)).returning();
    return s;
  }

  async deleteWorkflowStep(id: string): Promise<boolean> {
    const result = await db.delete(workflowSteps).where(eq(workflowSteps.id, id)).returning();
    return result.length > 0;
  }

  async createWorkflowRun(workflowId: string): Promise<WorkflowRun> {
    const [run] = await db.insert(workflowRuns).values({ workflowId, status: "running" }).returning();
    return run;
  }

  async updateWorkflowRun(id: string, data: Partial<{ status: string; stepResults: any; durationMs: number; finishedAt: Date }>): Promise<WorkflowRun | undefined> {
    const [run] = await db.update(workflowRuns).set(data).where(eq(workflowRuns.id, id)).returning();
    return run;
  }

  async getWorkflowRuns(workflowId: string, limit = 20): Promise<WorkflowRun[]> {
    return db.select().from(workflowRuns).where(eq(workflowRuns.workflowId, workflowId)).orderBy(desc(workflowRuns.startedAt)).limit(limit);
  }

  async getMonitoringMetrics(projectId: string, limit = 50): Promise<MonitoringMetric[]> {
    return db.select().from(monitoringMetrics).where(eq(monitoringMetrics.projectId, projectId)).orderBy(desc(monitoringMetrics.recordedAt)).limit(limit);
  }

  async recordMonitoringMetric(projectId: string, metricType: string, value: number, metadata?: Record<string, any>): Promise<MonitoringMetric> {
    const [m] = await db.insert(monitoringMetrics).values({ projectId, metricType, value, metadata: metadata || null }).returning();
    return m;
  }

  async getMonitoringSummary(projectId: string): Promise<{ requests: number; errors: number; avgResponseMs: number; uptime: number; cpuPercent: number; memoryMb: number }> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.select().from(monitoringMetrics).where(and(eq(monitoringMetrics.projectId, projectId), gte(monitoringMetrics.recordedAt, last24h)));
    const requests = recent.filter(m => m.metricType === "request_count").reduce((s, m) => s + m.value, 0);
    const errors = recent.filter(m => m.metricType === "error_count").reduce((s, m) => s + m.value, 0);
    const responseTimes = recent.filter(m => m.metricType === "response_time");
    const avgResponseMs = responseTimes.length > 0 ? Math.round(responseTimes.reduce((s, m) => s + m.value, 0) / responseTimes.length) : 0;
    const cpuEntries = recent.filter(m => m.metricType === "cpu_usage");
    const cpuPercent = cpuEntries.length > 0 ? Math.round(cpuEntries[cpuEntries.length - 1].value) : 0;
    const memEntries = recent.filter(m => m.metricType === "memory_usage");
    const memoryMb = memEntries.length > 0 ? memEntries[memEntries.length - 1].value : 0;
    return { requests, errors, avgResponseMs, uptime: errors > 10 ? 99.5 : 100, cpuPercent, memoryMb };
  }

  async getMonitoringAlerts(projectId: string): Promise<MonitoringAlert[]> {
    return db.select().from(monitoringAlerts).where(eq(monitoringAlerts.projectId, projectId)).orderBy(desc(monitoringAlerts.createdAt));
  }

  async createMonitoringAlert(data: InsertMonitoringAlert): Promise<MonitoringAlert> {
    const [a] = await db.insert(monitoringAlerts).values(data).returning();
    return a;
  }

  async updateMonitoringAlert(id: string, data: Partial<{ enabled: boolean; lastTriggeredAt: Date }>): Promise<MonitoringAlert | undefined> {
    const [a] = await db.update(monitoringAlerts).set(data).where(eq(monitoringAlerts.id, id)).returning();
    return a;
  }

  async deleteMonitoringAlert(id: string): Promise<boolean> {
    const result = await db.delete(monitoringAlerts).where(eq(monitoringAlerts.id, id)).returning();
    return result.length > 0;
  }

  async getCodeThreads(projectId: string): Promise<CodeThread[]> {
    return db.select().from(codeThreads).where(eq(codeThreads.projectId, projectId)).orderBy(desc(codeThreads.createdAt));
  }

  async getCodeThread(id: string): Promise<CodeThread | undefined> {
    const [t] = await db.select().from(codeThreads).where(eq(codeThreads.id, id)).limit(1);
    return t;
  }

  async createCodeThread(data: InsertCodeThread): Promise<CodeThread> {
    const [t] = await db.insert(codeThreads).values(data).returning();
    return t;
  }

  async updateCodeThread(id: string, data: Partial<{ status: string; resolvedAt: Date }>): Promise<CodeThread | undefined> {
    const [t] = await db.update(codeThreads).set(data).where(eq(codeThreads.id, id)).returning();
    return t;
  }

  async deleteCodeThread(id: string): Promise<boolean> {
    await db.delete(threadComments).where(eq(threadComments.threadId, id));
    const result = await db.delete(codeThreads).where(eq(codeThreads.id, id)).returning();
    return result.length > 0;
  }

  async getThreadComments(threadId: string): Promise<ThreadComment[]> {
    return db.select().from(threadComments).where(eq(threadComments.threadId, threadId)).orderBy(threadComments.createdAt);
  }

  async createThreadComment(data: InsertThreadComment): Promise<ThreadComment> {
    const [c] = await db.insert(threadComments).values(data).returning();
    return c;
  }

  async getPortConfigs(projectId: string): Promise<PortConfig[]> {
    return db.select().from(portConfigs).where(eq(portConfigs.projectId, projectId)).orderBy(portConfigs.port);
  }

  async getPortConfig(id: string): Promise<PortConfig | undefined> {
    const [p] = await db.select().from(portConfigs).where(eq(portConfigs.id, id)).limit(1);
    return p;
  }

  async createPortConfig(data: InsertPortConfig): Promise<PortConfig> {
    const [p] = await db.insert(portConfigs).values(data).returning();
    return p;
  }

  async updatePortConfig(id: string, data: Partial<{ label: string; protocol: string; isPublic: boolean }>): Promise<PortConfig | undefined> {
    const [p] = await db.update(portConfigs).set(data).where(eq(portConfigs.id, id)).returning();
    return p;
  }

  async deletePortConfig(id: string): Promise<boolean> {
    const result = await db.delete(portConfigs).where(eq(portConfigs.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
