import { eq, desc, and, or, sql, inArray, notInArray, count, gte, lte, like, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, files, runs, workspaces, workspaceSessions,
  commits, branches, executionLogs, userQuotas, gitRepoState,
  projectEnvVars,
  aiConversations, aiMessages, queuedMessages, aiPlans, aiPlanTasks,
  passwordResetTokens, emailVerifications,
  teams, teamMembers, teamInvites,
  analyticsEvents, deployments,
  customDomains, purchasedDomains, dnsRecords, planConfigs,
  securityScans, securityFindings,
  projectCollaborators, projectInviteLinks,
  storageKv, storageObjects, storageBandwidth, storageBuckets, bucketAccess,
  projectAuthConfig, projectAuthUsers,
  integrationCatalog, projectIntegrations, integrationLogs, userConnections, oauthStates,
  automations, automationRuns,
  workflows, workflowSteps, workflowRuns,
  monitoringMetrics, monitoringAlerts,
  codeThreads, threadComments,
  skills,
  portConfigs,
  deploymentAnalytics,
  frameworkUpdates,
  checkpoints, checkpointPositions,
  accountEnvVars, accountEnvVarLinks,
  tasks, taskSteps, taskMessages, taskFileSnapshots,
  creditUsage, usageRecords,
  slidesData, videoData,
  projectInvites,
  fileVersions,
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
  type AiPlan, type InsertAiPlan,
  type AiPlanTask, type InsertAiPlanTask,
  type PasswordResetToken,
  type EmailVerification,
  type Team, type InsertTeam,
  type TeamMember, type InsertTeamMember,
  type TeamInvite,
  type AnalyticsEvent,
  type Deployment, type InsertDeployment,
  type CustomDomain,
  type PurchasedDomain, type InsertPurchasedDomain,
  type DnsRecord, type InsertDnsRecord,
  type PlanConfig,
  type SecurityScan, type InsertSecurityScan,
  type SecurityFinding, type InsertSecurityFinding,
  type ProjectCollaborator, type InsertProjectCollaborator,
  type ProjectInviteLink, type InsertProjectInviteLink,
  type StorageKv, type InsertStorageKv,
  type StorageObject, type InsertStorageObject,
  type StorageBucket, type InsertStorageBucket,
  type BucketAccess, type InsertBucketAccess,
  type ProjectAuthConfig,
  type LoginHistory,
  loginHistory,
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
  type Skill, type InsertSkill,
  type PortConfig, type InsertPortConfig,
  type DeploymentAnalytic, type InsertDeploymentAnalytic,
  type DeploymentLog, type InsertDeploymentLog,
  type ResourceSnapshot, type InsertResourceSnapshot,
  deploymentLogs, resourceSnapshots,
  type FrameworkUpdate, type InsertFrameworkUpdate,
  type Checkpoint, type InsertCheckpoint, type CheckpointPosition,
  type AccountEnvVar, type AccountEnvVarLink,
  type ConsoleRun, type InsertConsoleRun,
  consoleRuns,
  type Task, type InsertTask,
  type TaskStep, type InsertTaskStep,
  type TaskMessage, type InsertTaskMessage,
  type TaskFileSnapshot, type InsertTaskFileSnapshot,
  type CreditUsage,
  type UsageRecord,
  type AgentMode,
  type ProjectInvite, type InsertProjectInvite,
  type QueuedMessage, type InsertQueuedMessage,
  type McpServer, type InsertMcpServer,
  type McpTool, type InsertMcpTool,
  mcpServers, mcpTools,
  themes, installedThemes,
  type Theme, type InsertTheme,
  type InstalledTheme,
  projectGuests,
  type ProjectGuest, type InsertProjectGuest,
  type ProjectVisibility,
  type SlidesDataRecord, type InsertSlidesData,
  type VideoDataRecord, type InsertVideoData,
  type SlideData, type SlideTheme,
  type VideoScene, type VideoAudioTrack,
  systemModules, systemDeps,
  type SystemModule, type InsertSystemModule,
  type SystemDep, type InsertSystemDep,
  artifactTemplates,
  type ArtifactTemplate, type InsertArtifactTemplate,
  notifications, notificationPreferences,
  type Notification, type InsertNotification,
  type NotificationPreferences, type InsertNotificationPreferences,
  type FileVersion, type InsertFileVersion,
  gitBackups,
  type GitBackup, type InsertGitBackup,
  sshKeys,
  type SshKey, type InsertSshKey,
  mergeStates,
  type MergeState, type InsertMergeState,
  type MergeConflictFile, type MergeResolution,
  accountWarnings,
  type AccountWarning, type InsertAccountWarning,
  artifacts,
  type Artifact, type InsertArtifact,
  desktopReleases, desktopDownloads,
  type DesktopRelease, type InsertDesktopRelease,
  canvasFrames, canvasAnnotations, conversions,
  type CanvasFrame, type InsertCanvasFrame,
  type CanvasAnnotation, type InsertCanvasAnnotation,
  deploymentFeedback,
  type DeploymentFeedback, type InsertDeploymentFeedback,
  type Conversion, type InsertConversion,
  aiCredentialConfigs,
  type AiCredentialConfig, type InsertAiCredentialConfig,
  aiUsageLogs,
  type AiUsageLog, type InsertAiUsageLog,
  PLAN_LIMITS,
  AGENT_MODE_COSTS,
  type UserPreferences, type UserPreferencesStored,
  DEFAULT_PREFERENCES,
} from "@shared/schema";
import { encrypt, decrypt, migrateToEncrypted } from "./encryption";

function hexColorDistance(hex1: string, hex2: string): number {
  const toRgb = (h: string) => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = toRgb(hex1);
  const [r2, g2, b2] = toRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByDisplayName(displayName: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  getUserByTwitterId(twitterId: string): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { githubId?: string; googleId?: string; appleId?: string; twitterId?: string; replitId?: string; avatarUrl?: string; emailVerified?: boolean }): Promise<User>;
  updateUser(id: string, data: Partial<{ displayName: string; avatarUrl: string; password: string; emailVerified: boolean; githubId: string; googleId: string; appleId: string; twitterId: string; replitId: string; isBanned: boolean; bannedAt: Date | null; banReason: string | null }>): Promise<User | undefined>;
  getUserPreferences(userId: string): Promise<UserPreferences>;
  updateUserPreferences(userId: string, prefs: Partial<UserPreferencesStored>): Promise<UserPreferences>;
  getKeyboardShortcuts(userId: string): Promise<Record<string, string | null>>;
  updateKeyboardShortcuts(userId: string, shortcuts: Record<string, string | null>): Promise<Record<string, string | null>>;
  getPaneLayout(userId: string, projectId: string): Promise<Record<string, unknown> | null>;
  savePaneLayout(userId: string, projectId: string, layout: Record<string, unknown>): Promise<void>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(limit?: number, offset?: number): Promise<{ users: User[]; total: number }>;
  banUser(id: string, reason: string): Promise<User | undefined>;
  unbanUser(id: string): Promise<User | undefined>;
  recordLogin(userId: string, ip: string | null, provider: string, userAgent: string | null): Promise<LoginHistory>;
  getLoginHistory(userId: string, limit?: number): Promise<LoginHistory[]>;

  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(userId: string, data: InsertProject): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  duplicateProject(id: string, userId: string): Promise<Project | undefined>;
  createProjectFromTemplate(userId: string, data: { name: string; language: string; projectType?: string; outputType?: string; visibility?: string; files: { filename: string; content: string }[] }): Promise<Project>;
  updateProject(id: string, data: Partial<{ name: string; description: string; coverImageUrl: string; isPublic: boolean; language: string; projectType: string; outputType: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string; githubRepo: string; visibility: string; selectedWorkflowId: string | null; devUrlPublic: boolean }>): Promise<Project | undefined>;

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

  createConsoleRun(data: InsertConsoleRun): Promise<ConsoleRun>;
  updateConsoleRun(id: string, data: Partial<ConsoleRun>): Promise<ConsoleRun | undefined>;
  getConsoleRun(id: string): Promise<ConsoleRun | undefined>;
  getConsoleRunsByProject(projectId: string, limit?: number): Promise<ConsoleRun[]>;
  clearConsoleRuns(projectId: string, excludeRunId?: string): Promise<void>;

  publishProject(id: string, userId: string): Promise<Project | undefined>;
  getPublishedProject(id: string): Promise<{project: Project, files: File[]} | undefined>;

  getProjectGuests(projectId: string): Promise<ProjectGuest[]>;
  addProjectGuest(projectId: string, email: string, role: string, invitedBy: string): Promise<ProjectGuest>;
  removeProjectGuest(guestId: string, projectId: string): Promise<boolean>;
  acceptProjectGuestInvite(token: string, userId: string): Promise<ProjectGuest | undefined>;
  getProjectGuestByEmail(projectId: string, email: string): Promise<ProjectGuest | undefined>;
  getProjectGuestByUserId(projectId: string, userId: string): Promise<ProjectGuest | undefined>;
  isProjectGuest(projectId: string, userId: string): Promise<boolean>;

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
  getAllCommits(projectId: string, branchName?: string): Promise<Commit[]>;
  getCommitCount(projectId: string, branchName?: string): Promise<number>;
  getCommitsPaginated(projectId: string, branchName: string, limit: number, offset: number): Promise<Commit[]>;
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
  checkCreditsAvailable(userId: string, estimatedCost: number): Promise<{ allowed: boolean; quota: UserQuota }>;
  deductCredits(userId: string, mode: AgentMode, model?: string, endpoint?: string, overrideCost?: number): Promise<{ allowed: boolean; quota: UserQuota; creditCost: number }>;
  getCreditHistory(userId: string, days?: number): Promise<CreditUsage[]>;
  updateAgentPreferences(userId: string, data: Partial<{ agentMode: string; codeOptimizationsEnabled: boolean; creditAlertThreshold: number }>): Promise<UserQuota>;
  checkProjectLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }>;
  updateStorageUsage(userId: string): Promise<number>;
  updateUserPlan(userId: string, plan: string, stripeCustomerId?: string | null, stripeSubscriptionId?: string | null): Promise<UserQuota | undefined>;

  recordUsage(userId: string, actionType: string, creditCost: number, description?: string): Promise<UsageRecord>;
  getUsageForCycle(userId: string, cycleStart?: Date): Promise<UsageRecord[]>;
  getUsageBreakdown(userId: string, cycleStart?: Date): Promise<Record<string, number>>;
  getBillingHistory(userId: string, months?: number): Promise<{ cycleStart: Date; cycleEnd: Date; totalCredits: number; breakdown: Record<string, number> }[]>;
  deductMonthlyCredits(userId: string, creditCost: number, actionType: string, description?: string): Promise<{ allowed: boolean; quota: UserQuota; isOverage: boolean }>;
  deductMonthlyCreditsFromRoute(userId: string, creditCost: number, actionType: string, model?: string): Promise<{ allowed: boolean; quota: UserQuota; isOverage: boolean }>;
  reportStripeUsage(userId: string, credits: number): Promise<void>;
  resetBillingCycle(userId: string): Promise<UserQuota>;
  setOverageEnabled(userId: string, enabled: boolean): Promise<UserQuota>;

  getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]>;
  getProjectEnvVar(id: string): Promise<ProjectEnvVar | undefined>;
  createProjectEnvVar(projectId: string, key: string, value: string): Promise<ProjectEnvVar>;
  updateProjectEnvVar(id: string, value: string): Promise<ProjectEnvVar | undefined>;
  deleteProjectEnvVar(id: string): Promise<boolean>;
  deleteProjectEnvVarsByProject(projectId: string): Promise<number>;
  bulkUpsertProjectEnvVars(projectId: string, vars: Record<string, string>): Promise<ProjectEnvVar[]>;

  getAccountEnvVars(userId: string): Promise<AccountEnvVar[]>;
  getAccountEnvVar(id: string): Promise<AccountEnvVar | undefined>;
  createAccountEnvVar(userId: string, key: string, value: string): Promise<AccountEnvVar>;
  updateAccountEnvVar(id: string, value: string): Promise<AccountEnvVar | undefined>;
  deleteAccountEnvVar(id: string): Promise<boolean>;

  getAccountEnvVarLinks(projectId: string): Promise<(AccountEnvVarLink & { key: string; encryptedValue: string })[]>;
  linkAccountEnvVar(accountEnvVarId: string, projectId: string): Promise<AccountEnvVarLink>;
  unlinkAccountEnvVar(accountEnvVarId: string, projectId: string): Promise<boolean>;
  getLinkedProjectIds(accountEnvVarId: string): Promise<string[]>;
  migrateExistingEnvVarsToEncrypted(): Promise<void>;

  getConversation(projectId: string, userId: string): Promise<AiConversation | undefined>;
  getPlanConversation(projectId: string, userId: string): Promise<AiConversation | undefined>;
  getConversationById(id: string): Promise<AiConversation | undefined>;
  createConversation(data: InsertAiConversation): Promise<AiConversation>;
  updateConversation(id: string, data: Partial<{ title: string; model: string }>): Promise<AiConversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  getMessages(conversationId: string): Promise<AiMessage[]>;
  addMessage(data: InsertAiMessage): Promise<AiMessage>;
  addMessages(data: InsertAiMessage[]): Promise<AiMessage[]>;
  clearMessages(conversationId: string): Promise<void>;

  getQueuedMessages(projectId: string, userId: string): Promise<QueuedMessage[]>;
  createQueuedMessage(data: InsertQueuedMessage): Promise<QueuedMessage>;
  updateQueuedMessage(id: string, projectId: string, userId: string, data: Partial<{ content: string; attachments: any; position: number; status: string }>): Promise<QueuedMessage | undefined>;
  reorderQueuedMessages(updates: { id: string; position: number }[], projectId: string, userId: string): Promise<void>;
  deleteQueuedMessage(id: string, projectId: string, userId: string): Promise<boolean>;
  clearQueuedMessages(projectId: string, userId: string): Promise<void>;
  dequeueNextMessage(projectId: string, userId: string): Promise<QueuedMessage | undefined>;

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
  updateDeployment(id: string, data: Partial<{ status: string; buildLog: string; url: string; finishedAt: Date; deploymentType: string; buildCommand: string; runCommand: string; machineConfig: { cpu: number; ram: number }; maxMachines: number; cronExpression: string; scheduleDescription: string; jobTimeout: number; publicDirectory: string; appType: string; deploymentSecrets: Record<string, string>; isPrivate: boolean; showBadge: boolean; enableFeedback: boolean; processPort: number; lastHealthCheck: Date; healthStatus: string; responseHeaders: Array<{ path: string; name: string; value: string }>; rewrites: Array<{ from: string; to: string }> }>): Promise<Deployment | undefined>;
  demotePreviousLiveDeployments(projectId: string, excludeDeploymentId: string): Promise<void>;

  createDeploymentAnalytic(data: InsertDeploymentAnalytic): Promise<DeploymentAnalytic>;
  getDeploymentAnalytics(projectId: string, since?: Date): Promise<DeploymentAnalytic[]>;
  getDeploymentAnalyticsSummary(projectId: string, since?: Date): Promise<{ pageViews: number; uniqueVisitors: number; topReferrers: { referrer: string; count: number }[]; trafficByDay: { date: string; views: number }[] }>;
  getDeploymentAnalyticsAggregated(projectId: string, since?: Date): Promise<{
    pageViews: number;
    uniqueVisitors: number;
    topUrls: { url: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
    statusDistribution: { status: number; count: number }[];
    durationHistogram: { bucket: string; count: number }[];
    topBrowsers: { browser: string; count: number }[];
    topDevices: { device: string; count: number }[];
    topCountries: { country: string; count: number }[];
    trafficByDay: { date: string; views: number }[];
  }>;

  createDeploymentLog(data: InsertDeploymentLog): Promise<DeploymentLog>;
  getDeploymentLogs(projectId: string, options?: { errorsOnly?: boolean; search?: string; since?: Date; until?: Date; limit?: number }): Promise<DeploymentLog[]>;

  createResourceSnapshot(data: InsertResourceSnapshot): Promise<ResourceSnapshot>;
  getResourceSnapshots(projectId: string, since?: Date, limit?: number): Promise<ResourceSnapshot[]>;

  createCustomDomain(data: { domain: string; projectId: string; userId: string; verificationToken: string }): Promise<CustomDomain>;
  getCustomDomain(id: string): Promise<CustomDomain | undefined>;
  getCustomDomainByHostname(hostname: string): Promise<CustomDomain | undefined>;
  getProjectCustomDomains(projectId: string): Promise<CustomDomain[]>;
  updateCustomDomain(id: string, data: Partial<{ verified: boolean; verifiedAt: Date; sslStatus: string; sslExpiresAt: Date }>): Promise<CustomDomain | undefined>;
  deleteCustomDomain(id: string, userId: string): Promise<boolean>;

  createPurchasedDomain(data: InsertPurchasedDomain): Promise<PurchasedDomain>;
  getPurchasedDomain(id: string): Promise<PurchasedDomain | undefined>;
  getPurchasedDomainByName(domain: string): Promise<PurchasedDomain | undefined>;
  getUserPurchasedDomains(userId: string): Promise<PurchasedDomain[]>;
  getProjectPurchasedDomains(projectId: string): Promise<PurchasedDomain[]>;
  updatePurchasedDomain(id: string, data: Partial<{ projectId: string | null; status: string; autoRenew: boolean; expiresAt: Date }>): Promise<PurchasedDomain | undefined>;
  deletePurchasedDomain(id: string): Promise<boolean>;

  createDnsRecord(data: InsertDnsRecord): Promise<DnsRecord>;
  getDnsRecord(id: string): Promise<DnsRecord | undefined>;
  getDomainDnsRecords(domainId: string): Promise<DnsRecord[]>;
  updateDnsRecord(id: string, data: Partial<{ recordType: string; name: string; value: string; ttl: number }>): Promise<DnsRecord | undefined>;
  deleteDnsRecord(id: string): Promise<boolean>;

  getPlanConfig(plan: string): Promise<PlanConfig | undefined>;
  getAllPlanConfigs(): Promise<PlanConfig[]>;
  seedPlanConfigs(): Promise<void>;

  getPlanLimits(plan: string): Promise<{ dailyExecutions: number; dailyAiCalls: number; dailyCredits: number; storageMb: number; maxProjects: number; price: number; monthlyCredits: number }>;
  getLandingStats(): Promise<{ label: string; value: string }[]>;
  getUserRecentLanguages(userId: string): Promise<string[]>;

  createSecurityScan(data: InsertSecurityScan): Promise<SecurityScan>;
  getSecurityScan(id: string): Promise<SecurityScan | undefined>;
  updateSecurityScan(id: string, data: Partial<{ status: string; totalFindings: number; critical: number; high: number; medium: number; low: number; info: number; finishedAt: Date }>): Promise<SecurityScan | undefined>;
  getProjectScans(projectId: string): Promise<SecurityScan[]>;
  createSecurityFinding(data: InsertSecurityFinding): Promise<SecurityFinding>;
  createSecurityFindings(data: InsertSecurityFinding[]): Promise<SecurityFinding[]>;
  getScanFindings(scanId: string, hidden?: boolean): Promise<SecurityFinding[]>;
  hideSecurityFinding(id: string): Promise<SecurityFinding | undefined>;
  unhideSecurityFinding(id: string): Promise<SecurityFinding | undefined>;
  setFindingAgentSession(id: string, agentSessionId: string): Promise<SecurityFinding | undefined>;

  getProjectCollaborators(projectId: string): Promise<(ProjectCollaborator & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]>;
  addProjectCollaborator(data: InsertProjectCollaborator): Promise<ProjectCollaborator>;
  removeProjectCollaborator(projectId: string, userId: string): Promise<boolean>;
  isProjectCollaborator(projectId: string, userId: string): Promise<boolean>;

  createProjectInviteLink(data: InsertProjectInviteLink): Promise<ProjectInviteLink>;
  getProjectInviteLink(token: string): Promise<ProjectInviteLink | undefined>;
  getProjectInviteLinks(projectId: string): Promise<ProjectInviteLink[]>;
  useProjectInviteLink(token: string): Promise<ProjectInviteLink | undefined>;
  deactivateProjectInviteLink(id: string, projectId: string): Promise<boolean>;

  getStorageKvEntries(projectId: string): Promise<StorageKv[]>;
  getStorageKvEntry(projectId: string, key: string): Promise<StorageKv | undefined>;
  setStorageKvEntry(projectId: string, key: string, value: string): Promise<StorageKv>;
  deleteStorageKvEntry(projectId: string, key: string): Promise<boolean>;

  getStorageObjects(projectId: string): Promise<StorageObject[]>;
  getStorageObject(id: string): Promise<StorageObject | undefined>;
  createStorageObject(data: InsertStorageObject): Promise<StorageObject>;
  deleteStorageObject(id: string): Promise<boolean>;
  getProjectStorageUsage(projectId: string): Promise<{ kvCount: number; kvSizeBytes: number; objectCount: number; objectSizeBytes: number; totalBytes: number; planLimit: number; bucketUsage: Array<{ bucketId: string; bucketName: string; objectCount: number; sizeBytes: number }> }>;
  trackBandwidth(projectId: string, bytes: number): Promise<void>;
  getProjectBandwidth(projectId: string): Promise<{ bytesDownloaded: number; downloadCount: number; periodStart: string; periodEnd: string }>;

  createBucket(name: string, ownerUserId: string): Promise<StorageBucket>;
  getBucket(id: string): Promise<StorageBucket | undefined>;
  listBuckets(userId: string): Promise<StorageBucket[]>;
  listProjectBuckets(projectId: string): Promise<StorageBucket[]>;
  deleteBucket(id: string): Promise<boolean>;
  renameBucket(id: string, newName: string): Promise<StorageBucket | undefined>;
  grantBucketAccess(bucketId: string, projectId: string): Promise<BucketAccess>;
  revokeBucketAccess(bucketId: string, projectId: string): Promise<boolean>;
  getBucketAccessList(bucketId: string): Promise<BucketAccess[]>;
  copyObject(objectId: string, destFolderPath: string, destFilename: string): Promise<StorageObject>;
  moveObject(objectId: string, destFolderPath: string): Promise<StorageObject | undefined>;
  objectExists(bucketId: string, folderPath: string, filename: string): Promise<boolean>;
  listObjectsFiltered(bucketId: string, options: { prefix?: string; matchGlob?: string; maxResults?: number; startOffset?: number; endOffset?: number; folderPath?: string }): Promise<StorageObject[]>;
  getObjectsByFolder(bucketId: string, folderPath: string): Promise<StorageObject[]>;
  createFolder(bucketId: string, folderPath: string): Promise<StorageObject>;
  deleteFolder(bucketId: string, folderPath: string): Promise<boolean>;
  getOrCreateDefaultBucket(projectId: string, userId: string): Promise<StorageBucket>;
  backfillStorageBuckets(): Promise<void>;

  getProjectAuthConfig(projectId: string): Promise<ProjectAuthConfig | undefined>;
  upsertProjectAuthConfig(projectId: string, data: Partial<{ enabled: boolean; providers: string[]; requireEmailVerification: boolean; sessionDurationHours: number; allowedDomains: string[]; appName: string | null; appIconUrl: string | null }>): Promise<ProjectAuthConfig>;
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
  createAutomation(data: InsertAutomation & { webhookToken?: string; botStatus?: string }): Promise<Automation>;
  updateAutomation(id: string, data: Partial<{ name: string; cronExpression: string; script: string; language: string; enabled: boolean; lastRunAt: Date; slackBotToken: string; slackSigningSecret: string; telegramBotToken: string; botStatus: string }>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<boolean>;
  getAutomationByWebhookToken(token: string): Promise<Automation | undefined>;
  createAutomationRun(automationId: string, triggeredBy: string): Promise<AutomationRun>;
  updateAutomationRun(id: string, data: Partial<{ status: string; stdout: string; stderr: string; exitCode: number; durationMs: number; finishedAt: Date }>): Promise<AutomationRun | undefined>;
  getAutomationRuns(automationId: string, limit?: number): Promise<AutomationRun[]>;

  getWorkflows(projectId: string): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, data: Partial<{ name: string; triggerEvent: string; executionMode: string; enabled: boolean }>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  getWorkflowsByTrigger(projectId: string, triggerEvent: string): Promise<Workflow[]>;
  getWorkflowStep(id: string): Promise<WorkflowStep | undefined>;
  getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  createWorkflowStep(data: InsertWorkflowStep): Promise<WorkflowStep>;
  updateWorkflowStep(id: string, data: Partial<{ name: string; command: string; taskType: string; orderIndex: number; continueOnError: boolean }>): Promise<WorkflowStep | undefined>;
  deleteWorkflowStep(id: string): Promise<boolean>;
  bulkUpdateStepOrder(updates: { id: string; orderIndex: number }[]): Promise<void>;
  createWorkflowRun(workflowId: string): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, data: Partial<{ status: string; stepResults: any; durationMs: number; finishedAt: Date }>): Promise<WorkflowRun | undefined>;
  getWorkflowRuns(workflowId: string, limit?: number): Promise<WorkflowRun[]>;

  getMonitoringMetrics(projectId: string, limit?: number): Promise<MonitoringMetric[]>;
  recordMonitoringMetric(projectId: string, metricType: string, value: number, metadata?: Record<string, any>): Promise<MonitoringMetric>;
  getMonitoringSummary(projectId: string): Promise<{ requests: number; errors: number; avgResponseMs: number; uptime: number; cpuPercent: number; memoryMb: number } | null>;
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
  updatePortConfig(id: string, data: Partial<{ label: string; protocol: string; isPublic: boolean; exposeLocalhost: boolean }>): Promise<PortConfig | undefined>;
  deletePortConfig(id: string): Promise<boolean>;

  getSkills(projectId: string): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | undefined>;
  createSkill(data: InsertSkill): Promise<Skill>;
  updateSkill(id: string, data: Partial<{ name: string; description: string; content: string; isActive: boolean }>): Promise<Skill | undefined>;
  deleteSkill(id: string): Promise<boolean>;
  getActiveSkills(projectId: string): Promise<Skill[]>;

  getFrameworks(filters?: { search?: string; category?: string; language?: string }): Promise<(Project & { authorName?: string })[]>;
  getFramework(id: string): Promise<(Project & { authorName?: string }) | undefined>;
  publishAsFramework(id: string, userId: string, data: { description?: string; category?: string; coverUrl?: string }): Promise<Project | undefined>;
  unpublishFramework(id: string, userId: string): Promise<Project | undefined>;
  getFrameworkUpdates(frameworkId: string): Promise<FrameworkUpdate[]>;
  createFrameworkUpdate(frameworkId: string, message: string): Promise<FrameworkUpdate>;
  seedOfficialFrameworks(): Promise<void>;

  getCheckpoints(projectId: string): Promise<Checkpoint[]>;
  getCheckpoint(id: string): Promise<Checkpoint | undefined>;
  createCheckpoint(data: InsertCheckpoint): Promise<Checkpoint>;
  deleteCheckpoint(id: string): Promise<boolean>;
  getCheckpointPosition(projectId: string): Promise<CheckpointPosition | undefined>;
  setCheckpointPosition(projectId: string, checkpointId: string | null, divergedFromId?: string | null): Promise<void>;

  getProjectTasks(projectId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<{ title: string; description: string; plan: string[]; status: string; progress: number; result: string; errorMessage: string; startedAt: Date; completedAt: Date }>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  getTaskSteps(taskId: string): Promise<TaskStep[]>;
  createTaskStep(data: InsertTaskStep): Promise<TaskStep>;
  updateTaskStep(id: string, data: Partial<{ status: string; output: string; startedAt: Date; completedAt: Date }>): Promise<TaskStep | undefined>;

  getTaskMessages(taskId: string): Promise<TaskMessage[]>;
  addTaskMessage(data: InsertTaskMessage): Promise<TaskMessage>;

  getTaskFileSnapshots(taskId: string): Promise<TaskFileSnapshot[]>;
  createTaskFileSnapshot(data: InsertTaskFileSnapshot): Promise<TaskFileSnapshot>;
  updateTaskFileSnapshot(taskId: string, filename: string, content: string): Promise<TaskFileSnapshot | undefined>;
  deleteTaskFileSnapshots(taskId: string): Promise<void>;

  getProjectInvites(projectId: string): Promise<ProjectInvite[]>;
  createProjectInvite(data: InsertProjectInvite): Promise<ProjectInvite>;
  updateProjectInvite(id: string, projectId: string, data: Partial<{ role: string; status: string }>): Promise<ProjectInvite | undefined>;
  deleteProjectInvite(id: string, projectId: string): Promise<boolean>;
  getProjectInviteByIdAndProject(id: string, projectId: string): Promise<ProjectInvite | undefined>;
  getPendingInvitesForEmail(email: string): Promise<ProjectInvite[]>;
  getAcceptedInviteForProject(projectId: string, email: string): Promise<ProjectInvite | undefined>;
  getPendingInvitesWithProjects(email: string): Promise<(ProjectInvite & { projectName: string; inviterEmail: string })[]>;
  incrementProjectViewCount(projectId: string): Promise<void>;
  incrementProjectForkCount(projectId: string): Promise<void>;

  getMcpServers(projectId: string): Promise<McpServer[]>;
  getMcpServer(id: string): Promise<McpServer | undefined>;
  createMcpServer(data: InsertMcpServer): Promise<McpServer>;
  updateMcpServer(id: string, data: Partial<{ name: string; command: string; args: string[]; env: Record<string, string>; baseUrl: string; headers: Record<string, string>; serverType: string; status: string }>): Promise<McpServer | undefined>;
  deleteMcpServer(id: string): Promise<boolean>;

  getMcpTools(serverId: string): Promise<McpTool[]>;
  getMcpToolsByProject(projectId: string): Promise<(McpTool & { serverName: string })[]>;
  createMcpTool(data: InsertMcpTool): Promise<McpTool>;
  deleteMcpToolsByServer(serverId: string): Promise<number>;

  getPlans(projectId: string): Promise<AiPlan[]>;
  getPlan(id: string): Promise<AiPlan | undefined>;
  getLatestPlan(projectId: string, userId: string): Promise<AiPlan | undefined>;
  createPlan(data: InsertAiPlan): Promise<AiPlan>;
  updatePlan(id: string, data: Partial<{ title: string; status: string }>): Promise<AiPlan | undefined>;
  deletePlan(id: string): Promise<boolean>;
  getPlanTasks(planId: string): Promise<AiPlanTask[]>;
  createPlanTask(data: InsertAiPlanTask): Promise<AiPlanTask>;
  createPlanTasks(data: InsertAiPlanTask[]): Promise<AiPlanTask[]>;
  updatePlanTask(id: string, data: Partial<{ title: string; description: string; complexity: string; status: string; orderIndex: number }>): Promise<AiPlanTask | undefined>;
  deletePlanTasks(planId: string): Promise<boolean>;
  replacePlanAtomically(params: {
    projectId: string;
    userId: string;
    title: string;
    model: string;
    tasks: Array<{ title: string; description: string; complexity: string; dependsOn: string[] }>;
    userMessage: string;
    assistantMessage: string;
  }): Promise<{ plan: AiPlan; createdTasks: AiPlanTask[] }>;

  createTheme(userId: string, data: InsertTheme): Promise<Theme>;
  getTheme(id: string): Promise<Theme | undefined>;
  getUserThemes(userId: string): Promise<Theme[]>;
  updateTheme(id: string, userId: string, data: Partial<InsertTheme>): Promise<Theme | undefined>;
  deleteTheme(id: string, userId: string): Promise<boolean>;
  publishTheme(id: string, userId: string): Promise<Theme | undefined>;
  unpublishTheme(id: string, userId: string): Promise<Theme | undefined>;
  installTheme(userId: string, themeId: string): Promise<InstalledTheme>;
  uninstallTheme(userId: string, themeId: string): Promise<boolean>;
  getInstalledThemes(userId: string): Promise<Theme[]>;
  exploreThemes(filters?: { search?: string; baseScheme?: string; authorId?: string; color?: string }): Promise<(Theme & { authorName?: string })[]>;

  getSlidesData(projectId: string): Promise<SlidesDataRecord | undefined>;
  createSlidesData(data: InsertSlidesData): Promise<SlidesDataRecord>;
  updateSlidesData(projectId: string, data: Partial<{ slides: SlideData[]; theme: SlideTheme }>): Promise<SlidesDataRecord | undefined>;
  deleteSlidesData(projectId: string): Promise<boolean>;

  getVideoData(projectId: string): Promise<VideoDataRecord | undefined>;
  createVideoData(data: InsertVideoData): Promise<VideoDataRecord>;
  updateVideoData(projectId: string, data: Partial<{ scenes: VideoScene[]; audioTracks: VideoAudioTrack[]; resolution: { width: number; height: number }; fps: number }>): Promise<VideoDataRecord | undefined>;
  deleteVideoData(projectId: string): Promise<boolean>;

  getNotifications(userId: string, limit?: number, offset?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<number>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, data: Partial<{ agent: boolean; billing: boolean; deployment: boolean; security: boolean; team: boolean; system: boolean }>): Promise<NotificationPreferences>;

  getSystemModules(projectId: string): Promise<SystemModule[]>;
  createSystemModule(data: InsertSystemModule): Promise<SystemModule>;
  deleteSystemModule(id: string): Promise<boolean>;
  getSystemDeps(projectId: string): Promise<SystemDep[]>;
  createSystemDep(data: InsertSystemDep): Promise<SystemDep>;
  deleteSystemDep(id: string): Promise<boolean>;

  createFileVersion(data: InsertFileVersion): Promise<FileVersion>;
  getFileVersions(fileId: string, limit?: number, offset?: number): Promise<FileVersion[]>;
  getFileVersion(id: string): Promise<FileVersion | undefined>;
  getFileVersionCount(fileId: string): Promise<number>;
  getLatestFileVersionNumber(fileId: string): Promise<number>;
  deleteOldFileVersions(fileId: string, keepCount: number): Promise<number>;
  purgeFileVersionsOlderThan(days: number): Promise<number>;

  getGitBackups(projectId: string): Promise<GitBackup[]>;
  getGitBackupByVersion(projectId: string, version: number): Promise<GitBackup | undefined>;
  getLatestGitBackup(projectId: string): Promise<GitBackup | undefined>;
  getLatestGitBackupVersion(projectId: string): Promise<number>;
  createGitBackup(data: InsertGitBackup): Promise<GitBackup>;
  pruneGitBackups(projectId: string, keepCount: number): Promise<number>;
  getStaleBackupProjects(maxAgeHours: number): Promise<{ projectId: string; lastBackupAt: Date | null }[]>;

  createSshKey(userId: string, label: string, publicKey: string, fingerprint: string): Promise<SshKey>;
  listSshKeysByUser(userId: string): Promise<SshKey[]>;
  deleteSshKey(id: string, userId: string): Promise<boolean>;
  findSshKeyByFingerprint(fingerprint: string): Promise<SshKey | undefined>;

  getArtifactTemplates(outputType?: string): Promise<ArtifactTemplate[]>;
  getArtifactTemplate(id: string): Promise<ArtifactTemplate | undefined>;
  createArtifactTemplate(data: InsertArtifactTemplate): Promise<ArtifactTemplate>;
  seedArtifactTemplates(): Promise<void>;

  getMergeState(projectId: string): Promise<MergeState | undefined>;
  saveMergeState(data: InsertMergeState): Promise<MergeState>;
  updateMergeResolution(projectId: string, resolution: MergeResolution): Promise<MergeState | undefined>;
  deleteMergeState(projectId: string): Promise<boolean>;

  getDeletedProjects(userId: string): Promise<Project[]>;
  softDeleteProject(id: string, userId: string): Promise<boolean>;
  restoreProject(id: string, userId: string): Promise<Project | undefined>;
  restoreProjectByTitle(title: string, userId: string): Promise<Project | undefined>;
  purgeOldDeletedProjects(daysOld: number): Promise<number>;

  getAccountWarnings(userId: string): Promise<AccountWarning[]>;
  createAccountWarning(data: InsertAccountWarning): Promise<AccountWarning>;

  getUserByUsername(username: string): Promise<User | undefined>;
  changeUsername(userId: string, username: string): Promise<User | undefined>;

  searchProjects(userId: string, query: string): Promise<Project[]>;
  searchTemplates(query: string): Promise<{ id: string; name: string; language: string }[]>;
  searchCodeAcrossProjects(userId: string, query: string): Promise<{ projectId: string; projectName: string; filename: string; line: string }[]>;
  searchUsers(query: string): Promise<Pick<User, 'id' | 'displayName' | 'username' | 'avatarUrl'>[]>;

  getArtifacts(projectId: string): Promise<Artifact[]>;
  getArtifact(id: string): Promise<Artifact | undefined>;
  createArtifact(data: InsertArtifact): Promise<Artifact>;
  updateArtifact(id: string, data: Partial<{ name: string; type: string; entryFile: string; settings: Record<string, unknown> }>): Promise<Artifact | undefined>;
  deleteArtifact(id: string): Promise<boolean>;

  getLatestDesktopReleases(): Promise<DesktopRelease[]>;
  getDesktopReleasesByVersion(version: string): Promise<DesktopRelease[]>;
  createDesktopRelease(data: InsertDesktopRelease): Promise<DesktopRelease>;
  trackDesktopDownload(platform: string, version: string): Promise<void>;

  getCanvasFrames(projectId: string): Promise<CanvasFrame[]>;
  getCanvasFrame(id: string): Promise<CanvasFrame | undefined>;
  createCanvasFrame(data: InsertCanvasFrame): Promise<CanvasFrame>;
  updateCanvasFrame(id: string, projectId: string, data: Partial<{ name: string; htmlContent: string; x: number; y: number; width: number; height: number; zIndex: number }>): Promise<CanvasFrame | undefined>;
  deleteCanvasFrame(id: string, projectId: string): Promise<boolean>;

  getConversions(projectId: string): Promise<Conversion[]>;
  getConversion(id: string): Promise<Conversion | undefined>;
  createConversion(data: InsertConversion): Promise<Conversion>;
  updateConversion(id: string, data: Partial<{ status: string; artifactId: string; designTokens: Record<string, unknown>; error: string }>): Promise<Conversion | undefined>;

  getCanvasAnnotations(projectId: string): Promise<CanvasAnnotation[]>;
  getCanvasAnnotation(id: string): Promise<CanvasAnnotation | undefined>;
  createCanvasAnnotation(data: InsertCanvasAnnotation): Promise<CanvasAnnotation>;
  updateCanvasAnnotation(id: string, projectId: string, data: Partial<{ type: string; content: string; x: number; y: number; width: number; height: number; color: string; zIndex: number }>): Promise<CanvasAnnotation | undefined>;
  deleteCanvasAnnotation(id: string, projectId: string): Promise<boolean>;

  createDeploymentFeedback(data: InsertDeploymentFeedback): Promise<DeploymentFeedback>;
  getDeploymentFeedback(projectId: string, status?: string): Promise<DeploymentFeedback[]>;
  getDeploymentFeedbackById(id: string): Promise<DeploymentFeedback | undefined>;
  updateDeploymentFeedbackStatus(id: string, projectId: string, status: string): Promise<DeploymentFeedback | undefined>;
  deleteDeploymentFeedback(id: string, projectId: string): Promise<boolean>;

  getAiCredentialConfigs(projectId: string): Promise<AiCredentialConfig[]>;
  getAiCredentialConfig(projectId: string, provider: string): Promise<AiCredentialConfig | undefined>;
  upsertAiCredentialConfig(projectId: string, provider: string, mode: string, apiKey?: string | null): Promise<AiCredentialConfig>;
  deleteAiCredentialConfig(projectId: string, provider: string): Promise<boolean>;

  logAiUsage(data: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogs(userId: string, filters?: { projectId?: string; provider?: string; since?: Date; limit?: number }): Promise<AiUsageLog[]>;
  getAiUsageSummary(userId: string, since?: Date): Promise<{ provider: string; totalInputTokens: number; totalOutputTokens: number; totalCost: number; callCount: number }[]>;
  getAiUsageByProject(userId: string, since?: Date): Promise<{ projectId: string; provider: string; totalCost: number; callCount: number }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByDisplayName(displayName: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.displayName, displayName)).limit(1);
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

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId)).limit(1);
    return user;
  }

  async getUserByTwitterId(twitterId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.twitterId, twitterId)).limit(1);
    return user;
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId)).limit(1);
    return user;
  }

  async createUser(data: InsertUser & { githubId?: string; googleId?: string; appleId?: string; twitterId?: string; replitId?: string; avatarUrl?: string; emailVerified?: boolean }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email,
      password: data.password || "",
      displayName: data.displayName,
      githubId: data.githubId,
      googleId: data.googleId,
      appleId: data.appleId,
      twitterId: data.twitterId,
      replitId: data.replitId,
      avatarUrl: data.avatarUrl,
      emailVerified: data.emailVerified || false,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ displayName: string; avatarUrl: string; password: string; emailVerified: boolean; githubId: string; googleId: string; appleId: string; twitterId: string; replitId: string; isBanned: boolean; bannedAt: Date | null; banReason: string | null }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async banUser(id: string, reason: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({
      isBanned: true,
      bannedAt: new Date(),
      banReason: reason,
    }).where(eq(users.id, id)).returning();
    return user;
  }

  async unbanUser(id: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({
      isBanned: false,
      bannedAt: null,
      banReason: null,
    }).where(eq(users.id, id)).returning();
    return user;
  }

  async recordLogin(userId: string, ip: string | null, provider: string, userAgent: string | null): Promise<LoginHistory> {
    const [record] = await db.insert(loginHistory).values({
      userId,
      ip,
      provider,
      userAgent,
    }).returning();
    return record;
  }

  async getLoginHistory(userId: string, limit: number = 50): Promise<LoginHistory[]> {
    return db.select().from(loginHistory).where(eq(loginHistory.userId, userId)).orderBy(desc(loginHistory.createdAt)).limit(limit);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.getUser(userId);
    if (!user || !user.preferences) return { ...DEFAULT_PREFERENCES };
    const prefs = user.preferences as any;
    return {
      ...DEFAULT_PREFERENCES,
      ...prefs,
      agentToolsConfig: { ...DEFAULT_PREFERENCES.agentToolsConfig, ...(prefs.agentToolsConfig || {}) },
      keyboardShortcuts: prefs.keyboardShortcuts || {},
    };
  }

  async updateUserPreferences(userId: string, prefs: Partial<UserPreferencesStored>): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    const merged = {
      ...current,
      ...prefs,
      agentToolsConfig: prefs.agentToolsConfig
        ? { ...current.agentToolsConfig, ...prefs.agentToolsConfig }
        : current.agentToolsConfig,
      keyboardShortcuts: prefs.keyboardShortcuts !== undefined
        ? prefs.keyboardShortcuts
        : current.keyboardShortcuts,
    };
    await db.update(users).set({ preferences: merged }).where(eq(users.id, userId));
    return merged;
  }

  async getKeyboardShortcuts(userId: string): Promise<Record<string, string | null>> {
    const prefs = await this.getUserPreferences(userId);
    return prefs.keyboardShortcuts || {};
  }

  async updateKeyboardShortcuts(userId: string, shortcuts: Record<string, string | null>): Promise<Record<string, string | null>> {
    const prefs = await this.getUserPreferences(userId);
    const merged = { ...prefs, keyboardShortcuts: shortcuts };
    await db.update(users).set({ preferences: merged }).where(eq(users.id, userId));
    return shortcuts;
  }

  async getPaneLayout(userId: string, projectId: string): Promise<Record<string, unknown> | null> {
    const user = await this.getUser(userId);
    if (!user || !user.preferences) return null;
    const prefs = user.preferences as Record<string, unknown>;
    const layouts = (prefs.paneLayouts || {}) as Record<string, unknown>;
    const layout = layouts[projectId];
    return layout ? layout as Record<string, unknown> : null;
  }

  async savePaneLayout(userId: string, projectId: string, layout: Record<string, unknown>): Promise<void> {
    const user = await this.getUser(userId);
    const prefs = (user?.preferences || {}) as Record<string, unknown>;
    const layouts = ((prefs.paneLayouts || {}) as Record<string, unknown>);
    layouts[projectId] = layout;
    const merged = { ...prefs, paneLayouts: layouts };
    await db.update(users).set({ preferences: merged as any }).where(eq(users.id, userId));
  }

  async deleteUser(id: string): Promise<boolean> {
    const userProjects = await db.select().from(projects).where(eq(projects.userId, id));
    for (const p of userProjects) {
      await this.deleteProject(p.id, id);
    }
    await db.delete(usageRecords).where(eq(usageRecords.userId, id));
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
    return db.select().from(projects).where(and(eq(projects.userId, userId), sql`${projects.deletedAt} IS NULL`)).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(
      and(eq(projects.id, id), sql`${projects.deletedAt} IS NULL`)
    ).limit(1);
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
    const { generateEcodeContent, getEcodeFilename } = await import("./ecodeTemplates");
    await db.insert(files).values({ projectId: project.id, filename: getEcodeFilename(), content: generateEcodeContent(data.name, data.language || "javascript") });
    try {
      const providers = ["openai", "anthropic", "google", "openrouter"];
      await db.insert(aiCredentialConfigs).values(providers.map(p => ({ projectId: project.id, provider: p, mode: "managed" })));
    } catch (err: any) {
      console.error("[storage] Failed to create AI credential configs for project:", project.id, err?.message);
    }
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
    await db.delete(frameworkUpdates).where(eq(frameworkUpdates.frameworkId, id));
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
      userId, name: `${original.name} (copy)`, language: original.language, projectType: original.projectType,
    }).returning();
    const originalFiles = await this.getFiles(id);
    let hasEcode = false;
    for (const file of originalFiles) {
      if (file.filename === "ecode.md") hasEcode = true;
      await db.insert(files).values({ projectId: newProject.id, filename: file.filename, content: file.content });
    }
    if (!hasEcode) {
      const { generateEcodeContent } = await import("./ecodeTemplates");
      await db.insert(files).values({ projectId: newProject.id, filename: "ecode.md", content: generateEcodeContent(newProject.name, original.language) });
    }
    return newProject;
  }

  async createProjectFromTemplate(userId: string, data: { name: string; language: string; projectType?: string; outputType?: string; visibility?: string; files: { filename: string; content: string }[] }): Promise<Project> {
    const [project] = await db.insert(projects).values({
      userId,
      name: data.name,
      language: data.language,
      projectType: data.projectType || "web-app",
      outputType: data.outputType || "web",
      visibility: data.visibility || "public",
    }).returning();
    const hasEcode = data.files.some(f => f.filename === "ecode.md");
    const filesToInsert = [...data.files];
    if (!hasEcode) {
      const { generateEcodeContent } = await import("./ecodeTemplates");
      filesToInsert.push({ filename: "ecode.md", content: generateEcodeContent(data.name, data.language) });
    }
    if (filesToInsert.length > 0) {
      await db.insert(files).values(filesToInsert.map(f => ({ projectId: project.id, filename: f.filename, content: f.content })));
    }
    try {
      const providers = ["openai", "anthropic", "google", "openrouter"];
      await db.insert(aiCredentialConfigs).values(providers.map(p => ({ projectId: project.id, provider: p, mode: "managed" })));
    } catch (err: any) {
      console.error("[storage] Failed to create AI credential configs for template project:", project.id, err?.message);
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

  async updateProject(id: string, data: Partial<{ name: string; description: string; coverImageUrl: string; isPublic: boolean; language: string; projectType: string; isPublished: boolean; publishedSlug: string; customDomain: string; teamId: string; githubRepo: string; visibility: string; selectedWorkflowId: string | null; devUrlPublic: boolean; outputType: string }>): Promise<Project | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl;
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic;
    if (data.language !== undefined) updates.language = data.language;
    if (data.projectType !== undefined) updates.projectType = data.projectType;
    if (data.isPublished !== undefined) updates.isPublished = data.isPublished;
    if (data.publishedSlug !== undefined) updates.publishedSlug = data.publishedSlug;
    if (data.customDomain !== undefined) updates.customDomain = data.customDomain;
    if (data.teamId !== undefined) updates.teamId = data.teamId;
    if (data.githubRepo !== undefined) updates.githubRepo = data.githubRepo;
    if (data.visibility !== undefined) updates.visibility = data.visibility;
    if ('selectedWorkflowId' in data) updates.selectedWorkflowId = data.selectedWorkflowId;
    if (data.devUrlPublic !== undefined) updates.devUrlPublic = data.devUrlPublic;
    if (data.outputType !== undefined) updates.outputType = data.outputType;
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

  async createConsoleRun(data: InsertConsoleRun): Promise<ConsoleRun> {
    const [run] = await db.insert(consoleRuns).values(data).returning();
    return run;
  }

  async updateConsoleRun(id: string, data: Partial<ConsoleRun>): Promise<ConsoleRun | undefined> {
    const [run] = await db.update(consoleRuns).set(data).where(eq(consoleRuns.id, id)).returning();
    return run;
  }

  async getConsoleRun(id: string): Promise<ConsoleRun | undefined> {
    const [run] = await db.select().from(consoleRuns).where(eq(consoleRuns.id, id)).limit(1);
    return run;
  }

  async getConsoleRunsByProject(projectId: string, limit: number = 50): Promise<ConsoleRun[]> {
    return db.select().from(consoleRuns).where(eq(consoleRuns.projectId, projectId)).orderBy(desc(consoleRuns.startedAt)).limit(limit);
  }

  async clearConsoleRuns(projectId: string, excludeRunId?: string): Promise<void> {
    if (excludeRunId) {
      await db.delete(consoleRuns).where(
        and(eq(consoleRuns.projectId, projectId), sql`${consoleRuns.id} != ${excludeRunId}`)
      );
    } else {
      await db.delete(consoleRuns).where(eq(consoleRuns.projectId, projectId));
    }
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
      .where(and(eq(projects.id, id), or(eq(projects.isPublished, true), eq(projects.isPublic, true)))).limit(1);
    if (!project) return undefined;
    const fileList = await db.select().from(files).where(eq(files.projectId, id));
    return { project, files: fileList };
  }

  async getProjectGuests(projectId: string): Promise<ProjectGuest[]> {
    return db.select().from(projectGuests).where(eq(projectGuests.projectId, projectId)).orderBy(desc(projectGuests.createdAt));
  }

  async addProjectGuest(projectId: string, email: string, role: string, invitedBy: string): Promise<ProjectGuest> {
    const token = crypto.randomUUID();
    const [guest] = await db.insert(projectGuests).values({ projectId, email, role, invitedBy, token }).returning();
    return guest;
  }

  async removeProjectGuest(guestId: string, projectId: string): Promise<boolean> {
    const result = await db.delete(projectGuests).where(and(eq(projectGuests.id, guestId), eq(projectGuests.projectId, projectId))).returning();
    return result.length > 0;
  }

  async acceptProjectGuestInvite(token: string, userId: string): Promise<ProjectGuest | undefined> {
    const [guest] = await db.update(projectGuests).set({ userId, acceptedAt: new Date() }).where(eq(projectGuests.token, token)).returning();
    return guest;
  }

  async getProjectGuestByEmail(projectId: string, email: string): Promise<ProjectGuest | undefined> {
    const [guest] = await db.select().from(projectGuests).where(and(eq(projectGuests.projectId, projectId), eq(projectGuests.email, email))).limit(1);
    return guest;
  }

  async getProjectGuestByUserId(projectId: string, userId: string): Promise<ProjectGuest | undefined> {
    const [guest] = await db.select().from(projectGuests).where(and(eq(projectGuests.projectId, projectId), eq(projectGuests.userId, userId))).limit(1);
    return guest;
  }

  async isProjectGuest(projectId: string, userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    const [guest] = await db.select().from(projectGuests).where(
      and(
        eq(projectGuests.projectId, projectId),
        sql`(${projectGuests.userId} = ${userId} OR ${projectGuests.email} = ${user.email})`
      )
    ).limit(1);
    return !!guest;
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
      { projectId: demoProject.id, filename: "index.js", content: `// Welcome to E-Code!\n// This is a read-only demo project.\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);\n}\n\nconsole.log("\\nHello from E-Code!");\n` },
      { projectId: demoProject.id, filename: "utils.js", content: `// Utility functions\n\nfunction formatDate(date) {\n  return new Intl.DateTimeFormat('en-US', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  }).format(date);\n}\n\nconsole.log("Today is:", formatDate(new Date()));\n` },
    ]);
  }

  async getGitRepoState(projectId: string): Promise<string | null> {
    try {
      const [row] = await db.select().from(gitRepoState).where(eq(gitRepoState.projectId, projectId)).limit(1);
      return row ? row.packData : null;
    } catch (err: any) {
      console.error("[storage] Failed to get git repo state for project:", projectId, err?.message);
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
    } catch (err: any) {
      console.error("[storage] Failed to save git repo state for project:", projectId, err?.message);
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

  async getAllCommits(projectId: string, branchName?: string): Promise<Commit[]> {
    if (branchName) {
      return db.select().from(commits)
        .where(and(eq(commits.projectId, projectId), eq(commits.branchName, branchName)))
        .orderBy(desc(commits.createdAt));
    }
    return db.select().from(commits).where(eq(commits.projectId, projectId)).orderBy(desc(commits.createdAt));
  }

  async getCommitCount(projectId: string, branchName?: string): Promise<number> {
    const condition = branchName
      ? and(eq(commits.projectId, projectId), eq(commits.branchName, branchName))
      : eq(commits.projectId, projectId);
    const [result] = await db.select({ value: count() }).from(commits).where(condition);
    return result?.value ?? 0;
  }

  async getCommitsPaginated(projectId: string, branchName: string, lim: number, offset: number): Promise<Commit[]> {
    return db.select().from(commits)
      .where(and(eq(commits.projectId, projectId), eq(commits.branchName, branchName)))
      .orderBy(desc(commits.createdAt))
      .limit(lim)
      .offset(offset);
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
        .set({ dailyExecutionsUsed: 0, dailyAiCallsUsed: 0, dailyCreditsUsed: 0, lastResetAt: new Date(), updatedAt: new Date() })
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

  async checkCreditsAvailable(userId: string, estimatedCost: number): Promise<{ allowed: boolean; quota: UserQuota }> {
    const quota = await this.getUserQuota(userId);
    const limits = await this.getPlanLimits(quota.plan || "free");
    const allowed = (quota.dailyCreditsUsed + estimatedCost) <= limits.dailyCredits;
    return { allowed, quota };
  }

  async deductCredits(userId: string, mode: AgentMode, model?: string, endpoint?: string, overrideCost?: number): Promise<{ allowed: boolean; quota: UserQuota; creditCost: number }> {
    const quota = await this.getUserQuota(userId);
    const limits = await this.getPlanLimits(quota.plan || "free");
    const creditCost = overrideCost !== undefined ? Math.max(1, overrideCost) : (AGENT_MODE_COSTS[mode] || 1);

    if (mode === "turbo" && (quota.plan === "free" || !quota.plan)) {
      return { allowed: false, quota, creditCost };
    }

    const result = await db.update(userQuotas)
      .set({
        dailyCreditsUsed: sql`${userQuotas.dailyCreditsUsed} + ${creditCost}`,
        dailyAiCallsUsed: sql`${userQuotas.dailyAiCallsUsed} + 1`,
        totalAiCalls: sql`${userQuotas.totalAiCalls} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userQuotas.userId, userId),
        sql`${userQuotas.dailyCreditsUsed} + ${creditCost} <= ${limits.dailyCredits}`
      ))
      .returning();

    if (result.length === 0) {
      return { allowed: false, quota, creditCost };
    }

    await db.insert(creditUsage).values({ userId, mode, model, creditCost, endpoint } as any);
    return { allowed: true, quota: result[0], creditCost };
  }

  async getCreditHistory(userId: string, days: number = 7): Promise<CreditUsage[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return db.select().from(creditUsage)
      .where(and(eq(creditUsage.userId, userId), gte(creditUsage.createdAt, since)))
      .orderBy(desc(creditUsage.createdAt));
  }

  async updateAgentPreferences(userId: string, data: Partial<{ agentMode: string; codeOptimizationsEnabled: boolean; creditAlertThreshold: number }>): Promise<UserQuota> {
    const quota = await this.getUserQuota(userId);
    const updates: any = { updatedAt: new Date() };
    if (data.agentMode !== undefined) updates.agentMode = data.agentMode;
    if (data.codeOptimizationsEnabled !== undefined) updates.codeOptimizationsEnabled = data.codeOptimizationsEnabled;
    if (data.creditAlertThreshold !== undefined) updates.creditAlertThreshold = data.creditAlertThreshold;
    const [updated] = await db.update(userQuotas).set(updates).where(eq(userQuotas.userId, userId)).returning();
    return updated;
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

  async updateUserPlan(userId: string, plan: string, stripeCustomerId?: string | null, stripeSubscriptionId?: string | null): Promise<UserQuota | undefined> {
    const planKey = plan as keyof typeof PLAN_LIMITS;
    const monthlyCredits = PLAN_LIMITS[planKey]?.monthlyCredits || 0;
    const updates: Record<string, unknown> = { plan, updatedAt: new Date(), monthlyCreditsIncluded: monthlyCredits };
    if (stripeCustomerId !== undefined) updates.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId !== undefined) updates.stripeSubscriptionId = stripeSubscriptionId;
    await this.getUserQuota(userId);
    const [updated] = await db.update(userQuotas).set(updates).where(eq(userQuotas.userId, userId)).returning();
    return updated;
  }

  async recordUsage(userId: string, actionType: string, creditCost: number, description?: string): Promise<UsageRecord> {
    const [record] = await db.insert(usageRecords).values({
      userId,
      actionType: description ? `${actionType}:${description}` : actionType,
      creditCost,
      metadata: description ? { description } : null,
    }).returning();
    return record;
  }

  async getUsageForCycle(userId: string, cycleStart?: Date): Promise<UsageRecord[]> {
    const quota = await this.getUserQuota(userId);
    const start = cycleStart || quota.billingCycleStart;
    return db.select().from(usageRecords)
      .where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, start)))
      .orderBy(desc(usageRecords.createdAt));
  }

  async getUsageBreakdown(userId: string, cycleStart?: Date): Promise<Record<string, number>> {
    const records = await this.getUsageForCycle(userId, cycleStart);
    const breakdown: Record<string, number> = {};
    for (const r of records) {
      breakdown[r.actionType] = (breakdown[r.actionType] || 0) + r.creditCost;
    }
    return breakdown;
  }

  async getBillingHistory(userId: string, months: number = 6): Promise<{ cycleStart: Date; cycleEnd: Date; totalCredits: number; breakdown: Record<string, number> }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const records = await db.select().from(usageRecords)
      .where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, since)))
      .orderBy(desc(usageRecords.createdAt));

    const cycleMap = new Map<string, { cycleStart: Date; records: UsageRecord[] }>();
    for (const r of records) {
      const d = new Date(r.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cycleStart = new Date(d.getFullYear(), d.getMonth(), 1);
      if (!cycleMap.has(monthKey)) {
        cycleMap.set(monthKey, { cycleStart, records: [] });
      }
      cycleMap.get(monthKey)!.records.push(r);
    }

    return Array.from(cycleMap.values()).map(({ cycleStart, records: recs }) => {
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
      const breakdown: Record<string, number> = {};
      let totalCredits = 0;
      for (const r of recs) {
        breakdown[r.actionType] = (breakdown[r.actionType] || 0) + r.creditCost;
        totalCredits += r.creditCost;
      }
      return { cycleStart, cycleEnd, totalCredits, breakdown };
    });
  }

  async deductMonthlyCredits(userId: string, creditCost: number, actionType: string, description?: string): Promise<{ allowed: boolean; quota: UserQuota; isOverage: boolean }> {
    const quota = await this.getUserQuota(userId);

    if (this.shouldResetBillingCycle(quota)) {
      await this.resetBillingCycle(userId);
      return this.deductMonthlyCredits(userId, creditCost, actionType, description);
    }

    const remaining = quota.monthlyCreditsIncluded - quota.monthlyCreditsUsed;

    if (remaining >= creditCost) {
      const [updated] = await db.update(userQuotas)
        .set({
          monthlyCreditsUsed: sql`${userQuotas.monthlyCreditsUsed} + ${creditCost}`,
          updatedAt: new Date(),
        })
        .where(eq(userQuotas.userId, userId)).returning();
      await this.recordUsage(userId, actionType, creditCost, description);
      return { allowed: true, quota: updated, isOverage: false };
    }

    if (remaining > 0 && quota.overageEnabled) {
      const overagePortion = creditCost - remaining;
      const [updated] = await db.update(userQuotas)
        .set({
          monthlyCreditsUsed: sql`${userQuotas.monthlyCreditsIncluded}`,
          overageCreditsUsed: sql`${userQuotas.overageCreditsUsed} + ${overagePortion}`,
          updatedAt: new Date(),
        })
        .where(eq(userQuotas.userId, userId)).returning();
      await this.recordUsage(userId, actionType, creditCost, description);
      return { allowed: true, quota: updated, isOverage: true };
    }

    if (remaining <= 0 && quota.overageEnabled) {
      const [updated] = await db.update(userQuotas)
        .set({
          overageCreditsUsed: sql`${userQuotas.overageCreditsUsed} + ${creditCost}`,
          updatedAt: new Date(),
        })
        .where(eq(userQuotas.userId, userId)).returning();
      await this.recordUsage(userId, actionType, creditCost, description);
      return { allowed: true, quota: updated, isOverage: true };
    }

    return { allowed: false, quota, isOverage: false };
  }

  private shouldResetBillingCycle(quota: UserQuota): boolean {
    const now = new Date();
    const cycleStart = new Date(quota.billingCycleStart);
    const nextCycle = new Date(cycleStart);
    nextCycle.setMonth(nextCycle.getMonth() + 1);
    return now >= nextCycle;
  }

  async resetBillingCycle(userId: string): Promise<UserQuota> {
    const [updated] = await db.update(userQuotas)
      .set({
        monthlyCreditsUsed: 0,
        overageCreditsUsed: 0,
        billingCycleStart: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userQuotas.userId, userId)).returning();
    return updated;
  }

  async setOverageEnabled(userId: string, enabled: boolean): Promise<UserQuota> {
    const [updated] = await db.update(userQuotas)
      .set({ overageEnabled: enabled, updatedAt: new Date() })
      .where(eq(userQuotas.userId, userId)).returning();
    return updated;
  }

  async deductMonthlyCreditsFromRoute(userId: string, creditCost: number, actionType: string, model?: string): Promise<{ allowed: boolean; quota: UserQuota; isOverage: boolean }> {
    const result = await this.deductMonthlyCredits(userId, creditCost, actionType, model ? `${actionType}:${model}` : actionType);
    if (result.isOverage && result.allowed) {
      this.reportStripeUsage(userId, creditCost).catch((err) => {
        console.error("[billing] Failed to report Stripe usage:", err?.message);
      });
    }
    return result;
  }

  async reportStripeUsage(userId: string, credits: number): Promise<void> {
    try {
      const quota = await this.getUserQuota(userId);
      if (!quota.stripeSubscriptionId) return;

      const { getUncachableStripeClient, isStripeConfigured } = await import("./stripeClient");
      const configured = await isStripeConfigured();
      if (!configured) return;
      const stripe = await getUncachableStripeClient();

      const subscription = await stripe.subscriptions.retrieve(quota.stripeSubscriptionId);
      const meteredItem = subscription.items.data.find((item: any) => {
        const price = item.price;
        return price?.recurring?.usage_type === "metered";
      });

      if (meteredItem) {
        await (stripe.subscriptionItems as any).createUsageRecord(meteredItem.id, {
          quantity: credits,
          timestamp: Math.floor(Date.now() / 1000),
          action: "increment",
        });
      }
    } catch (err: any) {
      console.error("[billing] Stripe metered usage report failed:", err?.message);
    }
  }

  async getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]> {
    return db.select().from(projectEnvVars).where(eq(projectEnvVars.projectId, projectId));
  }

  async getProjectEnvVar(id: string): Promise<ProjectEnvVar | undefined> {
    const [envVar] = await db.select().from(projectEnvVars).where(eq(projectEnvVars.id, id)).limit(1);
    return envVar;
  }

  async createProjectEnvVar(projectId: string, key: string, value: string): Promise<ProjectEnvVar> {
    const encryptedValue = encrypt(value);
    const [envVar] = await db.insert(projectEnvVars).values({ projectId, key, encryptedValue }).returning();
    return envVar;
  }

  async updateProjectEnvVar(id: string, value: string): Promise<ProjectEnvVar | undefined> {
    const encryptedValue = encrypt(value);
    const [envVar] = await db.update(projectEnvVars).set({ encryptedValue }).where(eq(projectEnvVars.id, id)).returning();
    return envVar;
  }

  async deleteProjectEnvVar(id: string): Promise<boolean> {
    const result = await db.delete(projectEnvVars).where(eq(projectEnvVars.id, id)).returning();
    return result.length > 0;
  }

  async deleteProjectEnvVarsByProject(projectId: string): Promise<number> {
    const result = await db.delete(projectEnvVars).where(eq(projectEnvVars.projectId, projectId)).returning();
    return result.length;
  }

  async bulkUpsertProjectEnvVars(projectId: string, vars: Record<string, string>): Promise<ProjectEnvVar[]> {
    const results: ProjectEnvVar[] = [];
    for (const [key, value] of Object.entries(vars)) {
      const encryptedValue = encrypt(value);
      const existing = await db.select().from(projectEnvVars)
        .where(and(eq(projectEnvVars.projectId, projectId), eq(projectEnvVars.key, key)))
        .limit(1);
      if (existing.length > 0) {
        const [updated] = await db.update(projectEnvVars)
          .set({ encryptedValue })
          .where(eq(projectEnvVars.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(projectEnvVars)
          .values({ projectId, key, encryptedValue })
          .returning();
        results.push(created);
      }
    }
    return results;
  }

  async getAccountEnvVars(userId: string): Promise<AccountEnvVar[]> {
    return db.select().from(accountEnvVars).where(eq(accountEnvVars.userId, userId));
  }

  async getAccountEnvVar(id: string): Promise<AccountEnvVar | undefined> {
    const [envVar] = await db.select().from(accountEnvVars).where(eq(accountEnvVars.id, id)).limit(1);
    return envVar;
  }

  async createAccountEnvVar(userId: string, key: string, value: string): Promise<AccountEnvVar> {
    const encryptedValue = encrypt(value);
    const [envVar] = await db.insert(accountEnvVars).values({ userId, key, encryptedValue }).returning();
    return envVar;
  }

  async updateAccountEnvVar(id: string, value: string): Promise<AccountEnvVar | undefined> {
    const encryptedValue = encrypt(value);
    const [envVar] = await db.update(accountEnvVars).set({ encryptedValue }).where(eq(accountEnvVars.id, id)).returning();
    return envVar;
  }

  async deleteAccountEnvVar(id: string): Promise<boolean> {
    await db.delete(accountEnvVarLinks).where(eq(accountEnvVarLinks.accountEnvVarId, id));
    const result = await db.delete(accountEnvVars).where(eq(accountEnvVars.id, id)).returning();
    return result.length > 0;
  }

  async getAccountEnvVarLinks(projectId: string): Promise<(AccountEnvVarLink & { key: string; encryptedValue: string })[]> {
    const links = await db.select({
      id: accountEnvVarLinks.id,
      accountEnvVarId: accountEnvVarLinks.accountEnvVarId,
      projectId: accountEnvVarLinks.projectId,
      createdAt: accountEnvVarLinks.createdAt,
      key: accountEnvVars.key,
      encryptedValue: accountEnvVars.encryptedValue,
    })
      .from(accountEnvVarLinks)
      .innerJoin(accountEnvVars, eq(accountEnvVarLinks.accountEnvVarId, accountEnvVars.id))
      .where(eq(accountEnvVarLinks.projectId, projectId));
    return links;
  }

  async linkAccountEnvVar(accountEnvVarId: string, projectId: string): Promise<AccountEnvVarLink> {
    const [link] = await db.insert(accountEnvVarLinks).values({ accountEnvVarId, projectId }).returning();
    return link;
  }

  async unlinkAccountEnvVar(accountEnvVarId: string, projectId: string): Promise<boolean> {
    const result = await db.delete(accountEnvVarLinks)
      .where(and(eq(accountEnvVarLinks.accountEnvVarId, accountEnvVarId), eq(accountEnvVarLinks.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async getLinkedProjectIds(accountEnvVarId: string): Promise<string[]> {
    const links = await db.select({ projectId: accountEnvVarLinks.projectId })
      .from(accountEnvVarLinks)
      .where(eq(accountEnvVarLinks.accountEnvVarId, accountEnvVarId));
    return links.map(l => l.projectId);
  }

  async getConversation(projectId: string, userId: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.projectId, projectId),
        eq(aiConversations.userId, userId),
        sql`${aiConversations.title} != '__plan__'`
      ))
      .orderBy(desc(aiConversations.updatedAt)).limit(1);
    return conv;
  }

  async getPlanConversation(projectId: string, userId: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.projectId, projectId),
        eq(aiConversations.userId, userId),
        eq(aiConversations.title, "__plan__")
      ))
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
    await db.delete(queuedMessages).where(eq(queuedMessages.conversationId, id));
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

  async getQueuedMessages(projectId: string, userId: string): Promise<QueuedMessage[]> {
    return db.select().from(queuedMessages)
      .where(and(eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId), eq(queuedMessages.status, "pending")))
      .orderBy(queuedMessages.position);
  }

  async createQueuedMessage(data: InsertQueuedMessage): Promise<QueuedMessage> {
    const [msg] = await db.insert(queuedMessages).values(data).returning();
    return msg;
  }

  async updateQueuedMessage(id: string, projectId: string, userId: string, data: Partial<{ content: string; attachments: any; position: number; status: string }>): Promise<QueuedMessage | undefined> {
    const updates: any = {};
    if (data.content !== undefined) updates.content = data.content;
    if (data.attachments !== undefined) updates.attachments = data.attachments;
    if (data.position !== undefined) updates.position = data.position;
    if (data.status !== undefined) updates.status = data.status;
    const [msg] = await db.update(queuedMessages).set(updates)
      .where(and(eq(queuedMessages.id, id), eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId)))
      .returning();
    return msg;
  }

  async reorderQueuedMessages(updates: { id: string; position: number }[], projectId: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx.update(queuedMessages).set({ position: u.position })
          .where(and(eq(queuedMessages.id, u.id), eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId)));
      }
    });
  }

  async deleteQueuedMessage(id: string, projectId: string, userId: string): Promise<boolean> {
    const result = await db.delete(queuedMessages)
      .where(and(eq(queuedMessages.id, id), eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async clearQueuedMessages(projectId: string, userId: string): Promise<void> {
    await db.delete(queuedMessages).where(and(eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId)));
  }

  async dequeueNextMessage(projectId: string, userId: string): Promise<QueuedMessage | undefined> {
    return await db.transaction(async (tx) => {
      const [msg] = await tx.select().from(queuedMessages)
        .where(and(eq(queuedMessages.projectId, projectId), eq(queuedMessages.userId, userId), eq(queuedMessages.status, "pending")))
        .orderBy(queuedMessages.position)
        .limit(1);
      if (msg) {
        await tx.update(queuedMessages).set({ status: "processing" }).where(eq(queuedMessages.id, msg.id));
      }
      return msg;
    });
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

  async updateDeployment(id: string, data: Partial<{ status: string; buildLog: string; url: string; finishedAt: Date; deploymentType: string; buildCommand: string; runCommand: string; machineConfig: { cpu: number; ram: number }; maxMachines: number; cronExpression: string; scheduleDescription: string; jobTimeout: number; publicDirectory: string; appType: string; deploymentSecrets: Record<string, string>; isPrivate: boolean; showBadge: boolean; enableFeedback: boolean; processPort: number; lastHealthCheck: Date; healthStatus: string; responseHeaders: Array<{ path: string; name: string; value: string }>; rewrites: Array<{ from: string; to: string }> }>): Promise<Deployment | undefined> {
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

  async createDeploymentAnalytic(data: InsertDeploymentAnalytic): Promise<DeploymentAnalytic> {
    const [analytic] = await db.insert(deploymentAnalytics).values(data).returning();
    return analytic;
  }

  async getDeploymentAnalytics(projectId: string, since?: Date): Promise<DeploymentAnalytic[]> {
    if (since) {
      return db.select().from(deploymentAnalytics)
        .where(and(eq(deploymentAnalytics.projectId, projectId), gte(deploymentAnalytics.createdAt, since)))
        .orderBy(desc(deploymentAnalytics.createdAt))
        .limit(1000);
    }
    return db.select().from(deploymentAnalytics)
      .where(eq(deploymentAnalytics.projectId, projectId))
      .orderBy(desc(deploymentAnalytics.createdAt))
      .limit(1000);
  }

  async getDeploymentAnalyticsSummary(projectId: string, since?: Date): Promise<{ pageViews: number; uniqueVisitors: number; topReferrers: { referrer: string; count: number }[]; trafficByDay: { date: string; views: number }[] }> {
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const analytics = await this.getDeploymentAnalytics(projectId, sinceDate);

    const pageViews = analytics.length;
    const uniqueVisitorSet = new Set(analytics.map(a => a.visitorId || a.ipHash).filter(Boolean));
    const uniqueVisitors = uniqueVisitorSet.size;

    const referrerMap = new Map<string, number>();
    for (const a of analytics) {
      if (a.referrer) {
        referrerMap.set(a.referrer, (referrerMap.get(a.referrer) || 0) + 1);
      }
    }
    const topReferrers = Array.from(referrerMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dayMap = new Map<string, number>();
    for (const a of analytics) {
      const date = new Date(a.createdAt).toISOString().slice(0, 10);
      dayMap.set(date, (dayMap.get(date) || 0) + 1);
    }
    const trafficByDay = Array.from(dayMap.entries())
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { pageViews, uniqueVisitors, topReferrers, trafficByDay };
  }

  async getDeploymentAnalyticsAggregated(projectId: string, since?: Date): Promise<{
    pageViews: number;
    uniqueVisitors: number;
    topUrls: { url: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
    statusDistribution: { status: number; count: number }[];
    durationHistogram: { bucket: string; count: number }[];
    topBrowsers: { browser: string; count: number }[];
    topDevices: { device: string; count: number }[];
    topCountries: { country: string; count: number }[];
    trafficByDay: { date: string; views: number }[];
  }> {
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sinceStr = sinceDate.toISOString();

    const totalsResult = await db.execute(sql`
      SELECT COUNT(*)::int AS page_views,
             COUNT(DISTINCT COALESCE(visitor_id, ip_hash))::int AS unique_visitors
      FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp
    `);
    const totalsRows = Array.isArray(totalsResult) ? totalsResult : (totalsResult as any).rows ?? [];
    const totals = totalsRows[0] as { page_views: number; unique_visitors: number } | undefined;

    const pageViews = totals?.page_views || 0;
    const uniqueVisitors = totals?.unique_visitors || 0;

    const topUrlRows = await db.execute(sql`
      SELECT path AS url, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp
      GROUP BY path ORDER BY count DESC LIMIT 10
    `);

    const topReferrerRows = await db.execute(sql`
      SELECT referrer, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer ORDER BY count DESC LIMIT 10
    `);

    const statusRows = await db.execute(sql`
      SELECT status_code AS status, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND status_code IS NOT NULL
      GROUP BY status_code ORDER BY count DESC
    `);

    const durationRows = await db.execute(sql`
      SELECT
        CASE
          WHEN duration_ms < 100 THEN '0-100ms'
          WHEN duration_ms < 500 THEN '100-500ms'
          WHEN duration_ms < 1000 THEN '500ms-1s'
          WHEN duration_ms < 3000 THEN '1-3s'
          ELSE '3s+'
        END AS bucket,
        COUNT(*)::int AS count
      FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND duration_ms IS NOT NULL
      GROUP BY bucket ORDER BY MIN(duration_ms)
    `);

    const browserRows = await db.execute(sql`
      SELECT browser, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND browser IS NOT NULL
      GROUP BY browser ORDER BY count DESC LIMIT 10
    `);

    const deviceRows = await db.execute(sql`
      SELECT device, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND device IS NOT NULL
      GROUP BY device ORDER BY count DESC LIMIT 10
    `);

    const countryRows = await db.execute(sql`
      SELECT country, COUNT(*)::int AS count FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT 10
    `);

    const trafficRows = await db.execute(sql`
      SELECT created_at::date::text AS date, COUNT(*)::int AS views FROM deployment_analytics
      WHERE project_id = ${projectId} AND created_at >= ${sinceStr}::timestamp
      GROUP BY created_at::date ORDER BY date
    `);

    const asArray = (rows: unknown): Record<string, unknown>[] => Array.isArray(rows) ? rows : (rows as { rows?: Record<string, unknown>[] })?.rows || [];

    return {
      pageViews,
      uniqueVisitors,
      topUrls: asArray(topUrlRows).map((r: Record<string, unknown>) => ({ url: String(r.url || ""), count: Number(r.count) })),
      topReferrers: asArray(topReferrerRows).map((r: Record<string, unknown>) => ({ referrer: String(r.referrer || ""), count: Number(r.count) })),
      statusDistribution: asArray(statusRows).map((r: Record<string, unknown>) => ({ status: Number(r.status), count: Number(r.count) })),
      durationHistogram: asArray(durationRows).map((r: Record<string, unknown>) => ({ bucket: String(r.bucket || ""), count: Number(r.count) })),
      topBrowsers: asArray(browserRows).map((r: Record<string, unknown>) => ({ browser: String(r.browser || ""), count: Number(r.count) })),
      topDevices: asArray(deviceRows).map((r: Record<string, unknown>) => ({ device: String(r.device || ""), count: Number(r.count) })),
      topCountries: asArray(countryRows).map((r: Record<string, unknown>) => ({ country: String(r.country || ""), count: Number(r.count) })),
      trafficByDay: asArray(trafficRows).map((r: Record<string, unknown>) => ({ date: String(r.date || ""), views: Number(r.views) })),
    };
  }

  async createDeploymentLog(data: InsertDeploymentLog): Promise<DeploymentLog> {
    const [log] = await db.insert(deploymentLogs).values(data).returning();
    return log;
  }

  async getDeploymentLogs(projectId: string, options?: { errorsOnly?: boolean; search?: string; since?: Date; until?: Date; limit?: number }): Promise<DeploymentLog[]> {
    const conditions = [eq(deploymentLogs.projectId, projectId)];
    if (options?.errorsOnly) conditions.push(eq(deploymentLogs.level, "error"));
    if (options?.since) conditions.push(gte(deploymentLogs.createdAt, options.since));
    if (options?.until) {
      conditions.push(lte(deploymentLogs.createdAt, options.until));
    }
    if (options?.search) {
      conditions.push(sql`${deploymentLogs.message} ILIKE ${'%' + options.search + '%'}`);
    }
    return db.select().from(deploymentLogs).where(and(...conditions)).orderBy(desc(deploymentLogs.createdAt)).limit(options?.limit || 200);
  }

  async createResourceSnapshot(data: InsertResourceSnapshot): Promise<ResourceSnapshot> {
    const [snap] = await db.insert(resourceSnapshots).values(data).returning();
    return snap;
  }

  async getResourceSnapshots(projectId: string, since?: Date, limit = 200): Promise<ResourceSnapshot[]> {
    const sinceDate = since || new Date(Date.now() - 6 * 60 * 60 * 1000);
    return db.select().from(resourceSnapshots)
      .where(and(eq(resourceSnapshots.projectId, projectId), gte(resourceSnapshots.recordedAt, sinceDate)))
      .orderBy(resourceSnapshots.recordedAt)
      .limit(limit);
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

  async createPurchasedDomain(data: InsertPurchasedDomain): Promise<PurchasedDomain> {
    const [domain] = await db.insert(purchasedDomains).values(data).returning();
    return domain;
  }

  async getPurchasedDomain(id: string): Promise<PurchasedDomain | undefined> {
    const [domain] = await db.select().from(purchasedDomains).where(eq(purchasedDomains.id, id)).limit(1);
    return domain;
  }

  async getPurchasedDomainByName(domain: string): Promise<PurchasedDomain | undefined> {
    const [d] = await db.select().from(purchasedDomains).where(eq(purchasedDomains.domain, domain.toLowerCase())).limit(1);
    return d;
  }

  async getUserPurchasedDomains(userId: string): Promise<PurchasedDomain[]> {
    return db.select().from(purchasedDomains).where(eq(purchasedDomains.userId, userId)).orderBy(desc(purchasedDomains.createdAt));
  }

  async getProjectPurchasedDomains(projectId: string): Promise<PurchasedDomain[]> {
    return db.select().from(purchasedDomains).where(eq(purchasedDomains.projectId, projectId)).orderBy(desc(purchasedDomains.createdAt));
  }

  async updatePurchasedDomain(id: string, data: Partial<{ projectId: string | null; status: string; autoRenew: boolean; expiresAt: Date }>): Promise<PurchasedDomain | undefined> {
    const [domain] = await db.update(purchasedDomains).set(data).where(eq(purchasedDomains.id, id)).returning();
    return domain;
  }

  async deletePurchasedDomain(id: string): Promise<boolean> {
    const result = await db.delete(purchasedDomains).where(eq(purchasedDomains.id, id)).returning();
    return result.length > 0;
  }

  async createDnsRecord(data: InsertDnsRecord): Promise<DnsRecord> {
    const [record] = await db.insert(dnsRecords).values(data).returning();
    return record;
  }

  async getDnsRecord(id: string): Promise<DnsRecord | undefined> {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, id)).limit(1);
    return record;
  }

  async getDomainDnsRecords(domainId: string): Promise<DnsRecord[]> {
    return db.select().from(dnsRecords).where(eq(dnsRecords.domainId, domainId)).orderBy(desc(dnsRecords.createdAt));
  }

  async updateDnsRecord(id: string, data: Partial<{ recordType: string; name: string; value: string; ttl: number }>): Promise<DnsRecord | undefined> {
    const [record] = await db.update(dnsRecords).set(data).where(eq(dnsRecords.id, id)).returning();
    return record;
  }

  async deleteDnsRecord(id: string): Promise<boolean> {
    const result = await db.delete(dnsRecords).where(eq(dnsRecords.id, id)).returning();
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

  async getPlanLimits(plan: string): Promise<{ dailyExecutions: number; dailyAiCalls: number; dailyCredits: number; storageMb: number; maxProjects: number; price: number; monthlyCredits: number }> {
    const config = await this.getPlanConfig(plan);
    const planKey = plan as keyof typeof PLAN_LIMITS;
    if (config) {
      const credits = PLAN_LIMITS[planKey]?.dailyCredits || PLAN_LIMITS.free.dailyCredits;
      const monthly = PLAN_LIMITS[planKey]?.monthlyCredits || 0;
      return { dailyExecutions: config.dailyExecutions, dailyAiCalls: config.dailyAiCalls, dailyCredits: credits, storageMb: config.storageMb, maxProjects: config.maxProjects, price: config.price, monthlyCredits: monthly };
    }
    const fallback = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
    return { ...fallback };
  }

  async getLandingStats(): Promise<{ label: string; value: string }[]> {
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    const [{ value: projectCount }] = await db.select({ value: count() }).from(projects);
    const languageRows = await db.selectDistinct({ language: projects.language }).from(projects);
    const languageCount = languageRows.length;

    const configuredAiModels: string[] = [];
    if (process.env.OPENAI_API_KEY) configuredAiModels.push("openai");
    if (process.env.ANTHROPIC_API_KEY) configuredAiModels.push("anthropic");
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) configuredAiModels.push("gemini");
    const aiModelCount = configuredAiModels.length;

    return [
      { value: languageCount > 0 ? `${languageCount}+` : "0", label: "Languages" },
      { value: aiModelCount > 0 ? `${aiModelCount}` : "0", label: "AI Models" },
      { value: userCount > 0 ? `${userCount}+` : "0", label: "Developers" },
      { value: projectCount > 0 ? `${projectCount}+` : "0", label: "Projects" },
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

  async getScanFindings(scanId: string, hidden?: boolean): Promise<SecurityFinding[]> {
    if (hidden !== undefined) {
      return db.select().from(securityFindings).where(and(eq(securityFindings.scanId, scanId), eq(securityFindings.hidden, hidden)));
    }
    return db.select().from(securityFindings).where(eq(securityFindings.scanId, scanId));
  }

  async getProjectCollaborators(projectId: string): Promise<(ProjectCollaborator & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]> {
    const collabs = await db.select().from(projectCollaborators).where(eq(projectCollaborators.projectId, projectId));
    const results: (ProjectCollaborator & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[] = [];
    for (const c of collabs) {
      const [u] = await db.select({ id: users.id, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, c.userId)).limit(1);
      if (u) results.push({ ...c, user: u });
    }
    return results;
  }

  async addProjectCollaborator(data: InsertProjectCollaborator): Promise<ProjectCollaborator> {
    const [collab] = await db.insert(projectCollaborators).values(data).onConflictDoNothing().returning();
    if (!collab) {
      const [existing] = await db.select().from(projectCollaborators).where(and(eq(projectCollaborators.projectId, data.projectId), eq(projectCollaborators.userId, data.userId))).limit(1);
      return existing;
    }
    return collab;
  }

  async removeProjectCollaborator(projectId: string, userId: string): Promise<boolean> {
    const result = await db.delete(projectCollaborators).where(and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId))).returning();
    return result.length > 0;
  }

  async isProjectCollaborator(projectId: string, userId: string): Promise<boolean> {
    const [row] = await db.select({ id: projectCollaborators.id }).from(projectCollaborators).where(and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId))).limit(1);
    return !!row;
  }

  async createProjectInviteLink(data: InsertProjectInviteLink): Promise<ProjectInviteLink> {
    const [link] = await db.insert(projectInviteLinks).values(data).returning();
    return link;
  }

  async getProjectInviteLink(token: string): Promise<ProjectInviteLink | undefined> {
    const [link] = await db.select().from(projectInviteLinks).where(eq(projectInviteLinks.token, token)).limit(1);
    return link;
  }

  async getProjectInviteLinks(projectId: string): Promise<ProjectInviteLink[]> {
    return db.select().from(projectInviteLinks).where(and(eq(projectInviteLinks.projectId, projectId), eq(projectInviteLinks.isActive, true)));
  }

  async useProjectInviteLink(token: string): Promise<ProjectInviteLink | undefined> {
    const [link] = await db.update(projectInviteLinks)
      .set({ useCount: sql`${projectInviteLinks.useCount} + 1` })
      .where(and(eq(projectInviteLinks.token, token), eq(projectInviteLinks.isActive, true)))
      .returning();
    return link;
  }

  async deactivateProjectInviteLink(id: string, projectId: string): Promise<boolean> {
    const result = await db.update(projectInviteLinks).set({ isActive: false }).where(and(eq(projectInviteLinks.id, id), eq(projectInviteLinks.projectId, projectId))).returning();
    return result.length > 0;
  }

  async hideSecurityFinding(id: string): Promise<SecurityFinding | undefined> {
    const [finding] = await db.update(securityFindings).set({ hidden: true, hiddenAt: new Date() }).where(eq(securityFindings.id, id)).returning();
    return finding;
  }

  async unhideSecurityFinding(id: string): Promise<SecurityFinding | undefined> {
    const [finding] = await db.update(securityFindings).set({ hidden: false, hiddenAt: null }).where(eq(securityFindings.id, id)).returning();
    return finding;
  }

  async setFindingAgentSession(id: string, agentSessionId: string): Promise<SecurityFinding | undefined> {
    const [finding] = await db.update(securityFindings).set({ agentSessionId }).where(eq(securityFindings.id, id)).returning();
    return finding;
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

  async getProjectStorageUsage(projectId: string): Promise<{ kvCount: number; kvSizeBytes: number; objectCount: number; objectSizeBytes: number; totalBytes: number; planLimit: number; bucketUsage: Array<{ bucketId: string; bucketName: string; objectCount: number; sizeBytes: number }> }> {
    const kvEntries = await db.select().from(storageKv).where(eq(storageKv.projectId, projectId));
    const kvCount = kvEntries.length;
    const kvSizeBytes = kvEntries.reduce((sum, e) => sum + Buffer.byteLength(e.key + e.value, "utf-8"), 0);

    const projectBuckets = await this.listProjectBuckets(projectId);
    const bucketIds = projectBuckets.map(b => b.id);

    let allObjects: (typeof storageObjects.$inferSelect)[] = [];
    if (bucketIds.length > 0) {
      allObjects = await db.select().from(storageObjects).where(
        and(
          inArray(storageObjects.bucketId, bucketIds),
          sql`${storageObjects.mimeType} != 'application/x-directory'`
        )
      );
    }
    const legacyObjects = await db.select().from(storageObjects).where(
      and(
        eq(storageObjects.projectId, projectId),
        sql`${storageObjects.bucketId} IS NULL`,
        sql`${storageObjects.mimeType} != 'application/x-directory'`
      )
    );
    const combinedObjects = [...allObjects, ...legacyObjects];
    const objectCount = combinedObjects.length;
    const objectSizeBytes = combinedObjects.reduce((sum, o) => sum + o.sizeBytes, 0);

    const project = await this.getProject(projectId);
    let planLimit = 50 * 1024 * 1024;
    if (project) {
      const quota = await this.getUserQuota(project.userId);
      const plan = (quota?.plan || "free") as "free" | "pro" | "team";
      const { STORAGE_PLAN_LIMITS } = await import("@shared/schema");
      const limits = STORAGE_PLAN_LIMITS[plan] || STORAGE_PLAN_LIMITS.free;
      planLimit = limits.storageMb * 1024 * 1024;
    }

    const bucketUsage: Array<{ bucketId: string; bucketName: string; objectCount: number; sizeBytes: number }> = [];
    for (const b of projectBuckets) {
      const bucketObjs = allObjects.filter(o => o.bucketId === b.id);
      bucketUsage.push({ bucketId: b.id, bucketName: b.name, objectCount: bucketObjs.length, sizeBytes: bucketObjs.reduce((s, o) => s + o.sizeBytes, 0) });
    }
    return { kvCount, kvSizeBytes, objectCount, objectSizeBytes, totalBytes: kvSizeBytes + objectSizeBytes, planLimit, bucketUsage };
  }

  async trackBandwidth(projectId: string, bytes: number): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [existing] = await db.select().from(storageBandwidth)
      .where(and(
        eq(storageBandwidth.projectId, projectId),
        eq(storageBandwidth.periodStart, periodStart),
      )).limit(1);

    if (existing) {
      await db.update(storageBandwidth).set({
        bytesDownloaded: sql`${storageBandwidth.bytesDownloaded} + ${bytes}`,
        downloadCount: sql`${storageBandwidth.downloadCount} + 1`,
        updatedAt: now,
      }).where(eq(storageBandwidth.id, existing.id));
    } else {
      await db.insert(storageBandwidth).values({
        projectId,
        periodStart,
        periodEnd,
        bytesDownloaded: bytes,
        downloadCount: 1,
      });
    }
  }

  async getProjectBandwidth(projectId: string): Promise<{ bytesDownloaded: number; downloadCount: number; periodStart: string; periodEnd: string }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [record] = await db.select().from(storageBandwidth)
      .where(and(
        eq(storageBandwidth.projectId, projectId),
        eq(storageBandwidth.periodStart, periodStart),
      )).limit(1);

    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (record) {
      return {
        bytesDownloaded: record.bytesDownloaded,
        downloadCount: record.downloadCount,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
    }
    return {
      bytesDownloaded: 0,
      downloadCount: 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }

  async createBucket(name: string, ownerUserId: string): Promise<StorageBucket> {
    const [bucket] = await db.insert(storageBuckets).values({ name, ownerUserId }).returning();
    return bucket;
  }

  async getBucket(id: string): Promise<StorageBucket | undefined> {
    const [bucket] = await db.select().from(storageBuckets).where(eq(storageBuckets.id, id)).limit(1);
    return bucket;
  }

  async listBuckets(userId: string): Promise<StorageBucket[]> {
    return db.select().from(storageBuckets).where(eq(storageBuckets.ownerUserId, userId)).orderBy(desc(storageBuckets.createdAt));
  }

  async listProjectBuckets(projectId: string): Promise<StorageBucket[]> {
    const accessRows = await db.select().from(bucketAccess).where(eq(bucketAccess.projectId, projectId));
    if (accessRows.length === 0) return [];
    const bucketIds = accessRows.map(a => a.bucketId);
    return db.select().from(storageBuckets).where(inArray(storageBuckets.id, bucketIds)).orderBy(desc(storageBuckets.createdAt));
  }

  async deleteBucket(id: string): Promise<boolean> {
    const objects = await db.select().from(storageObjects).where(eq(storageObjects.bucketId, id));
    const { unlink, rm } = await import("fs/promises");
    for (const obj of objects) {
      try { await unlink(obj.storagePath); } catch {}
    }
    await db.delete(storageObjects).where(eq(storageObjects.bucketId, id));
    await db.delete(bucketAccess).where(eq(bucketAccess.bucketId, id));
    const result = await db.delete(storageBuckets).where(eq(storageBuckets.id, id)).returning();
    const bucketDir = (await import("path")).join(process.cwd(), ".storage", "buckets", id);
    try { await rm(bucketDir, { recursive: true, force: true }); } catch {}
    return result.length > 0;
  }

  async renameBucket(id: string, newName: string): Promise<StorageBucket | undefined> {
    const [bucket] = await db.update(storageBuckets).set({ name: newName }).where(eq(storageBuckets.id, id)).returning();
    return bucket;
  }

  async grantBucketAccess(bucketId: string, projectId: string): Promise<BucketAccess> {
    const existing = await db.select().from(bucketAccess).where(and(eq(bucketAccess.bucketId, bucketId), eq(bucketAccess.projectId, projectId))).limit(1);
    if (existing.length > 0) return existing[0];
    const [access] = await db.insert(bucketAccess).values({ bucketId, projectId }).returning();
    return access;
  }

  async revokeBucketAccess(bucketId: string, projectId: string): Promise<boolean> {
    const result = await db.delete(bucketAccess).where(and(eq(bucketAccess.bucketId, bucketId), eq(bucketAccess.projectId, projectId))).returning();
    return result.length > 0;
  }

  async getBucketAccessList(bucketId: string): Promise<BucketAccess[]> {
    return db.select().from(bucketAccess).where(eq(bucketAccess.bucketId, bucketId));
  }

  async copyObject(objectId: string, destFolderPath: string, destFilename: string): Promise<StorageObject> {
    const obj = await this.getStorageObject(objectId);
    if (!obj) throw new Error("Object not found");
    const { copyFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const destDir = path.join(process.cwd(), ".storage", "buckets", obj.bucketId || "default", destFolderPath);
    await mkdir(destDir, { recursive: true });
    const safeName = destFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destPath = path.join(destDir, `${Date.now()}_${safeName}`);
    await copyFile(obj.storagePath, destPath);
    const [newObj] = await db.insert(storageObjects).values({
      projectId: obj.projectId,
      bucketId: obj.bucketId,
      folderPath: destFolderPath,
      filename: destFilename,
      mimeType: obj.mimeType,
      sizeBytes: obj.sizeBytes,
      storagePath: destPath,
    }).returning();
    return newObj;
  }

  async moveObject(objectId: string, destFolderPath: string): Promise<StorageObject | undefined> {
    const obj = await this.getStorageObject(objectId);
    if (!obj) return undefined;
    const { rename, mkdir } = await import("fs/promises");
    const path = await import("path");
    const destDir = path.join(process.cwd(), ".storage", "buckets", obj.bucketId || "default", destFolderPath);
    await mkdir(destDir, { recursive: true });
    const basename = path.basename(obj.storagePath);
    const destPath = path.join(destDir, basename);
    try { await rename(obj.storagePath, destPath); } catch {
      const { copyFile, unlink } = await import("fs/promises");
      await copyFile(obj.storagePath, destPath);
      try { await unlink(obj.storagePath); } catch {}
    }
    const [updated] = await db.update(storageObjects).set({ folderPath: destFolderPath, storagePath: destPath }).where(eq(storageObjects.id, objectId)).returning();
    return updated;
  }

  async objectExists(bucketId: string, folderPath: string, filename: string): Promise<boolean> {
    const [obj] = await db.select().from(storageObjects).where(and(
      eq(storageObjects.bucketId, bucketId),
      eq(storageObjects.folderPath, folderPath),
      eq(storageObjects.filename, filename)
    )).limit(1);
    return !!obj;
  }

  async listObjectsFiltered(bucketId: string, options: { prefix?: string; matchGlob?: string; maxResults?: number; startOffset?: number; endOffset?: number; folderPath?: string }): Promise<StorageObject[]> {
    const conditions: SQL[] = [eq(storageObjects.bucketId, bucketId)];
    if (options.folderPath !== undefined) {
      conditions.push(eq(storageObjects.folderPath, options.folderPath));
    }
    if (options.prefix) {
      conditions.push(like(storageObjects.filename, `${options.prefix}%`));
    }

    let query = db.select().from(storageObjects)
      .where(and(...conditions))
      .orderBy(storageObjects.filename);

    const start = options.startOffset || 0;
    if (start > 0) {
      query = query.offset(start) as typeof query;
    }
    const limit = options.maxResults || (options.endOffset ? options.endOffset - start : undefined);
    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    let results = await query;

    if (options.matchGlob) {
      const globToRegex = (glob: string) => new RegExp("^" + glob.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      const re = globToRegex(options.matchGlob);
      results = results.filter(o => re.test(o.filename));
    }

    return results;
  }

  async getObjectsByFolder(bucketId: string, folderPath: string): Promise<StorageObject[]> {
    return db.select().from(storageObjects).where(and(
      eq(storageObjects.bucketId, bucketId),
      eq(storageObjects.folderPath, folderPath)
    )).orderBy(storageObjects.filename);
  }

  async createFolder(bucketId: string, folderPath: string): Promise<StorageObject> {
    const { mkdir } = await import("fs/promises");
    const path = await import("path");
    const dirPath = path.join(process.cwd(), ".storage", "buckets", bucketId, folderPath);
    await mkdir(dirPath, { recursive: true });
    const parentFolder = folderPath.includes("/") ? folderPath.substring(0, folderPath.lastIndexOf("/")) : "";
    const folderName = folderPath.includes("/") ? folderPath.substring(folderPath.lastIndexOf("/") + 1) : folderPath;
    const [obj] = await db.insert(storageObjects).values({
      projectId: "__folder__",
      bucketId,
      folderPath: parentFolder,
      filename: folderName,
      mimeType: "application/x-directory",
      sizeBytes: 0,
      storagePath: dirPath,
    }).returning();
    return obj;
  }

  async deleteFolder(bucketId: string, folderPath: string): Promise<boolean> {
    const allObjects = await db.select().from(storageObjects).where(eq(storageObjects.bucketId, bucketId));
    const { unlink, rm } = await import("fs/promises");
    const path = await import("path");
    const toDelete = allObjects.filter(o =>
      o.folderPath === folderPath ||
      o.folderPath.startsWith(folderPath + "/") ||
      (o.mimeType === "application/x-directory" && o.folderPath === (folderPath.includes("/") ? folderPath.substring(0, folderPath.lastIndexOf("/")) : "") && o.filename === (folderPath.includes("/") ? folderPath.substring(folderPath.lastIndexOf("/") + 1) : folderPath))
    );
    for (const obj of toDelete) {
      if (obj.mimeType !== "application/x-directory") {
        try { await unlink(obj.storagePath); } catch {}
      }
      await db.delete(storageObjects).where(eq(storageObjects.id, obj.id));
    }
    const dirPath = path.join(process.cwd(), ".storage", "buckets", bucketId, folderPath);
    try { await rm(dirPath, { recursive: true, force: true }); } catch {}
    return toDelete.length > 0;
  }

  async getOrCreateDefaultBucket(projectId: string, userId: string): Promise<StorageBucket> {
    const projectBuckets = await this.listProjectBuckets(projectId);
    if (projectBuckets.length > 0) return projectBuckets[0];
    const bucket = await this.createBucket("default", userId);
    await this.grantBucketAccess(bucket.id, projectId);
    return bucket;
  }

  async backfillStorageBuckets(): Promise<void> {
    const orphanObjects = await db.select().from(storageObjects).where(
      sql`${storageObjects.bucketId} IS NULL`
    );
    if (orphanObjects.length === 0) return;
    const projectIds = [...new Set(orphanObjects.map(o => o.projectId))];
    for (const pid of projectIds) {
      if (pid === "__folder__") continue;
      const project = await this.getProject(pid);
      if (!project) continue;
      const bucket = await this.getOrCreateDefaultBucket(pid, project.userId);
      await db.update(storageObjects).set({ bucketId: bucket.id }).where(
        and(eq(storageObjects.projectId, pid), sql`${storageObjects.bucketId} IS NULL`)
      );
    }
  }

  async getProjectAuthConfig(projectId: string): Promise<ProjectAuthConfig | undefined> {
    const [config] = await db.select().from(projectAuthConfig).where(eq(projectAuthConfig.projectId, projectId)).limit(1);
    return config;
  }

  async upsertProjectAuthConfig(projectId: string, data: Partial<{ enabled: boolean; providers: string[]; requireEmailVerification: boolean; sessionDurationHours: number; allowedDomains: string[]; appName: string | null; appIconUrl: string | null }>): Promise<ProjectAuthConfig> {
    const existing = await this.getProjectAuthConfig(projectId);
    if (existing) {
      const updates: any = {};
      if (data.enabled !== undefined) updates.enabled = data.enabled;
      if (data.providers !== undefined) updates.providers = data.providers;
      if (data.requireEmailVerification !== undefined) updates.requireEmailVerification = data.requireEmailVerification;
      if (data.sessionDurationHours !== undefined) updates.sessionDurationHours = data.sessionDurationHours;
      if (data.allowedDomains !== undefined) updates.allowedDomains = data.allowedDomains;
      if (data.appName !== undefined) updates.appName = data.appName;
      if (data.appIconUrl !== undefined) updates.appIconUrl = data.appIconUrl;
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
      appName: data.appName ?? null,
      appIconUrl: data.appIconUrl ?? null,
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
    const entries = [
      // Google Workspace (5 connectors)
      { name: "Google Drive", category: "Google Workspace", description: "Cloud file storage, sharing, and collaboration", icon: "cloud", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/drive"] }, providerUrl: "https://drive.google.com" },
      { name: "Google Docs", category: "Google Workspace", description: "Create and edit documents with real-time collaboration", icon: "book-open", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/documents"] }, providerUrl: "https://docs.google.com" },
      { name: "Google Sheets", category: "Google Workspace", description: "Cloud spreadsheet with real-time collaboration", icon: "table", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/spreadsheets"] }, providerUrl: "https://sheets.google.com" },
      { name: "Google Calendar", category: "Google Workspace", description: "Calendar scheduling and event management", icon: "calendar", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/calendar"] }, providerUrl: "https://calendar.google.com" },
      { name: "Gmail", category: "Google Workspace", description: "Send and read emails programmatically", icon: "mail", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/gmail.modify"] }, providerUrl: "https://mail.google.com" },

      // Microsoft 365 (3 connectors)
      { name: "OneDrive", category: "Microsoft 365", description: "Cloud file storage and sharing via Microsoft Graph", icon: "cloud", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scopes: ["Files.ReadWrite.All"] }, providerUrl: "https://onedrive.live.com" },
      { name: "Microsoft Outlook", category: "Microsoft 365", description: "Email, calendar, and contacts via Microsoft Graph", icon: "mail", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scopes: ["Mail.ReadWrite", "Calendars.ReadWrite"] }, providerUrl: "https://outlook.live.com" },
      { name: "SharePoint", category: "Microsoft 365", description: "Document management and team collaboration", icon: "globe", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scopes: ["Sites.ReadWrite.All"] }, providerUrl: "https://sharepoint.com" },

      // Developer Tools (5 connectors)
      { name: "GitHub", category: "Developer Tools", description: "Source control, CI/CD, and repository management", icon: "github", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", scopes: ["repo", "read:user"] }, providerUrl: "https://github.com" },
      { name: "Linear", category: "Developer Tools", description: "Streamlined issue tracking and project management", icon: "layout", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://linear.app/oauth/authorize", tokenUrl: "https://api.linear.app/oauth/token", scopes: ["read", "write"] }, providerUrl: "https://linear.app" },
      { name: "Jira", category: "Developer Tools", description: "Agile project management and issue tracking", icon: "clipboard", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://auth.atlassian.com/authorize", tokenUrl: "https://auth.atlassian.com/oauth/token", scopes: ["read:jira-work", "write:jira-work"] }, providerUrl: "https://www.atlassian.com/software/jira" },
      { name: "Asana", category: "Developer Tools", description: "Work management and team collaboration platform", icon: "clipboard", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://app.asana.com/-/oauth_authorize", tokenUrl: "https://app.asana.com/-/oauth_token", scopes: ["default"] }, providerUrl: "https://asana.com" },
      { name: "Confluence", category: "Developer Tools", description: "Team wiki and knowledge base", icon: "book-open", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://auth.atlassian.com/authorize", tokenUrl: "https://auth.atlassian.com/oauth/token", scopes: ["read:confluence-content.all", "write:confluence-content"] }, providerUrl: "https://www.atlassian.com/software/confluence" },

      // Cloud Storage (2 connectors)
      { name: "Dropbox", category: "Cloud Storage", description: "Cloud file hosting and synchronization", icon: "cloud", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://www.dropbox.com/oauth2/authorize", tokenUrl: "https://api.dropboxapi.com/oauth2/token", scopes: ["files.content.read", "files.content.write"] }, providerUrl: "https://dropbox.com" },
      { name: "Box", category: "Cloud Storage", description: "Secure cloud content management and sharing", icon: "cloud", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://account.box.com/api/oauth2/authorize", tokenUrl: "https://api.box.com/oauth2/token", scopes: ["root_readwrite"] }, providerUrl: "https://box.com" },

      // Communication (6 connectors)
      { name: "AgentMail", category: "Communication", description: "AI-native email infrastructure for agents", icon: "mail", envVarKeys: ["AGENTMAIL_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://agentmail.to" },
      { name: "Discord", category: "Communication", description: "Community chat, voice, and bot platform", icon: "message-circle", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://discord.com/api/oauth2/authorize", tokenUrl: "https://discord.com/api/oauth2/token", scopes: ["bot", "guilds"] }, providerUrl: "https://discord.com" },
      { name: "Resend", category: "Communication", description: "Modern email API for developers", icon: "send", envVarKeys: ["RESEND_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://resend.com" },
      { name: "SendGrid", category: "Communication", description: "Email delivery and marketing campaigns", icon: "mail", envVarKeys: ["SENDGRID_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://sendgrid.com" },
      { name: "Slack", category: "Communication", description: "Team messaging and workflow automation", icon: "message-square", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", scopes: ["chat:write", "channels:read", "users:read"] }, providerUrl: "https://slack.com" },
      { name: "Twilio", category: "Communication", description: "SMS, voice, and messaging APIs", icon: "phone", envVarKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://twilio.com" },

      // CRM & Sales (3 connectors)
      { name: "Salesforce", category: "CRM & Sales", description: "Enterprise CRM and sales automation platform", icon: "users", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://login.salesforce.com/services/oauth2/authorize", tokenUrl: "https://login.salesforce.com/services/oauth2/token", scopes: ["full", "refresh_token"] }, providerUrl: "https://salesforce.com" },
      { name: "HubSpot", category: "CRM & Sales", description: "CRM, marketing, sales, and service platform", icon: "users", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://app.hubspot.com/oauth/authorize", tokenUrl: "https://api.hubapi.com/oauth/v1/token", scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"] }, providerUrl: "https://hubspot.com" },
      { name: "Zendesk", category: "CRM & Sales", description: "Customer support and ticketing system", icon: "users", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://{subdomain}.zendesk.com/oauth/authorizations/new", tokenUrl: "https://{subdomain}.zendesk.com/oauth/tokens", scopes: ["read", "write"] }, providerUrl: "https://zendesk.com" },

      // Payments (2 connectors)
      { name: "RevenueCat", category: "Payments", description: "In-app subscription and purchase management", icon: "credit-card", envVarKeys: ["REVENUECAT_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://revenuecat.com" },
      { name: "Stripe", category: "Payments", description: "Payment processing, subscriptions, and billing", icon: "credit-card", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://connect.stripe.com/oauth/authorize", tokenUrl: "https://connect.stripe.com/oauth/token", scopes: ["read_write"] }, providerUrl: "https://stripe.com" },

      // AI & Media (5 connectors)
      { name: "ElevenLabs", category: "AI & Media", description: "AI voice synthesis and text-to-speech", icon: "sparkles", envVarKeys: ["ELEVENLABS_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://elevenlabs.io" },
      { name: "OpenAI", category: "AI & Media", description: "GPT models and embeddings API", icon: "sparkles", envVarKeys: ["OPENAI_API_KEY"], connectorType: "managed" as const, connectionLevel: "project" as const, providerUrl: "https://openai.com" },
      { name: "Anthropic", category: "AI & Media", description: "Claude AI assistant API", icon: "sparkles", envVarKeys: ["ANTHROPIC_API_KEY"], connectorType: "managed" as const, connectionLevel: "project" as const, providerUrl: "https://anthropic.com" },
      { name: "Perplexity AI", category: "AI & Media", description: "AI-powered search and answer engine with citations", icon: "sparkles", envVarKeys: ["PERPLEXITY_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://perplexity.ai" },
      { name: "Mistral AI", category: "AI & Media", description: "Fast, efficient language models for NLP tasks", icon: "sparkles", envVarKeys: ["MISTRAL_API_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://mistral.ai" },

      // Productivity (3 connectors)
      { name: "Notion", category: "Productivity", description: "All-in-one workspace for notes, docs, and databases", icon: "book-open", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://api.notion.com/v1/oauth/authorize", tokenUrl: "https://api.notion.com/v1/oauth/token", scopes: [] }, providerUrl: "https://notion.so" },
      { name: "Spotify", category: "Productivity", description: "Music streaming API for playlists and playback", icon: "music", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://accounts.spotify.com/authorize", tokenUrl: "https://accounts.spotify.com/api/token", scopes: ["playlist-read-private", "user-library-read"] }, providerUrl: "https://spotify.com" },
      { name: "Todoist", category: "Productivity", description: "Task management and to-do list app", icon: "clipboard", envVarKeys: [], connectorType: "oauth" as const, connectionLevel: "account" as const, oauthConfig: { authUrl: "https://todoist.com/oauth/authorize", tokenUrl: "https://todoist.com/oauth/access_token", scopes: ["data:read_write"] }, providerUrl: "https://todoist.com" },

      // Database (3 connectors)
      { name: "PostgreSQL", category: "Database", description: "Connect to a PostgreSQL database", icon: "database", envVarKeys: ["DATABASE_URL"], connectorType: "managed" as const, connectionLevel: "project" as const, providerUrl: "https://postgresql.org" },
      { name: "Redis", category: "Database", description: "In-memory data store for caching", icon: "database", envVarKeys: ["REDIS_URL"], connectorType: "managed" as const, connectionLevel: "project" as const, providerUrl: "https://redis.io" },
      { name: "MongoDB", category: "Database", description: "NoSQL document database", icon: "database", envVarKeys: ["MONGODB_URI"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://mongodb.com" },

      // Backend Services (2 connectors)
      { name: "Firebase", category: "Backend Services", description: "Authentication, database, and hosting", icon: "flame", envVarKeys: ["FIREBASE_API_KEY", "FIREBASE_PROJECT_ID"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://firebase.google.com" },
      { name: "Supabase", category: "Backend Services", description: "Open source Firebase alternative", icon: "zap", envVarKeys: ["SUPABASE_URL", "SUPABASE_ANON_KEY"], connectorType: "apikey" as const, connectionLevel: "project" as const, providerUrl: "https://supabase.com" },

      // Authentication
      { name: "E-Code Auth", category: "Authentication", description: "Sign in with E-Code — zero-setup OAuth for deployed apps", icon: "user-check", envVarKeys: [] },
    ];
    for (const entry of entries) {
      await db.insert(integrationCatalog).values(entry).onConflictDoUpdate({
        target: integrationCatalog.name,
        set: {
          category: entry.category,
          description: entry.description,
          icon: entry.icon,
          envVarKeys: entry.envVarKeys,
          connectorType: entry.connectorType,
          connectionLevel: entry.connectionLevel,
          oauthConfig: entry.oauthConfig || null,
          providerUrl: entry.providerUrl || null,
        },
      });
    }
    const validNames = entries.map(e => e.name);
    await db.delete(integrationCatalog).where(notInArray(integrationCatalog.name, validNames));
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
      status: "pending",
      config,
    }).returning();
    return pi;
  }

  async disconnectIntegration(projectId: string, id: string): Promise<boolean> {
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

  async createOAuthState(data: { state: string; userId: string; projectId: string; integrationId: string; expiresAt: Date }): Promise<void> {
    await db.insert(oauthStates).values(data);
  }

  async validateAndConsumeOAuthState(state: string): Promise<{ userId: string; projectId: string; integrationId: string } | null> {
    const [row] = await db.select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1);
    if (!row) return null;
    await db.delete(oauthStates).where(eq(oauthStates.id, row.id));
    if (row.expiresAt < new Date()) return null;
    return { userId: row.userId, projectId: row.projectId, integrationId: row.integrationId };
  }

  async getUserConnections(userId: string): Promise<(typeof userConnections.$inferSelect & { integration: IntegrationCatalogEntry })[]> {
    const rows = await db.select()
      .from(userConnections)
      .innerJoin(integrationCatalog, eq(userConnections.integrationId, integrationCatalog.id))
      .where(eq(userConnections.userId, userId));
    return rows.map(r => ({
      ...r.user_connections,
      integration: r.integration_catalog,
    }));
  }

  async createUserConnection(userId: string, integrationId: string, data: { accessToken?: string; refreshToken?: string; tokenExpiresAt?: Date; status?: string; metadata?: Record<string, string> }): Promise<typeof userConnections.$inferSelect> {
    const status = data.status || "connected";
    const [conn] = await db.insert(userConnections).values({
      userId,
      integrationId,
      status,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      metadata: data.metadata || {},
    }).onConflictDoUpdate({
      target: [userConnections.userId, userConnections.integrationId],
      set: {
        status,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        metadata: data.metadata || {},
        connectedAt: new Date(),
      },
    }).returning();
    return conn;
  }

  async disconnectUserConnection(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(userConnections).where(and(eq(userConnections.id, id), eq(userConnections.userId, userId))).returning();
    return result.length > 0;
  }

  async getUserConnectionForIntegration(userId: string, integrationId: string): Promise<typeof userConnections.$inferSelect | undefined> {
    const [conn] = await db.select().from(userConnections).where(and(eq(userConnections.userId, userId), eq(userConnections.integrationId, integrationId))).limit(1);
    return conn;
  }

  async getAutomations(projectId: string): Promise<Automation[]> {
    return db.select().from(automations).where(eq(automations.projectId, projectId)).orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const [a] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
    return a;
  }

  async createAutomation(data: InsertAutomation & { webhookToken?: string; botStatus?: string }): Promise<Automation> {
    const [a] = await db.insert(automations).values(data).returning();
    return a;
  }

  async updateAutomation(id: string, data: Partial<{ name: string; cronExpression: string; script: string; language: string; enabled: boolean; lastRunAt: Date; slackBotToken: string; slackSigningSecret: string; telegramBotToken: string; botStatus: string }>): Promise<Automation | undefined> {
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

  async updateWorkflow(id: string, data: Partial<{ name: string; triggerEvent: string; executionMode: string; enabled: boolean }>): Promise<Workflow | undefined> {
    const [w] = await db.update(workflows).set(data).where(eq(workflows.id, id)).returning();
    return w;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await db.delete(workflowRuns).where(eq(workflowRuns.workflowId, id));
    await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));
    const result = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    return result.length > 0;
  }

  async getWorkflowsByTrigger(projectId: string, triggerEvent: string): Promise<Workflow[]> {
    return db.select().from(workflows).where(and(eq(workflows.projectId, projectId), eq(workflows.triggerEvent, triggerEvent), eq(workflows.enabled, true)));
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

  async updateWorkflowStep(id: string, data: Partial<{ name: string; command: string; taskType: string; orderIndex: number; continueOnError: boolean }>): Promise<WorkflowStep | undefined> {
    const [s] = await db.update(workflowSteps).set(data).where(eq(workflowSteps.id, id)).returning();
    return s;
  }

  async deleteWorkflowStep(id: string): Promise<boolean> {
    const result = await db.delete(workflowSteps).where(eq(workflowSteps.id, id)).returning();
    return result.length > 0;
  }

  async bulkUpdateStepOrder(updates: { id: string; orderIndex: number }[]): Promise<void> {
    for (const u of updates) {
      await db.update(workflowSteps).set({ orderIndex: u.orderIndex }).where(eq(workflowSteps.id, u.id));
    }
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

  async getMonitoringSummary(projectId: string): Promise<{ requests: number; errors: number; avgResponseMs: number; uptime: number; cpuPercent: number; memoryMb: number } | null> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.select().from(monitoringMetrics).where(and(eq(monitoringMetrics.projectId, projectId), gte(monitoringMetrics.recordedAt, last24h)));
    if (recent.length === 0) return null;
    const requests = recent.filter(m => m.metricType === "request_count").reduce((s, m) => s + m.value, 0);
    const errors = recent.filter(m => m.metricType === "error_count").reduce((s, m) => s + m.value, 0);
    const responseTimes = recent.filter(m => m.metricType === "response_time");
    const avgResponseMs = responseTimes.length > 0 ? Math.round(responseTimes.reduce((s, m) => s + m.value, 0) / responseTimes.length) : 0;
    const cpuEntries = recent.filter(m => m.metricType === "cpu_usage");
    const cpuPercent = cpuEntries.length > 0 ? Math.round(cpuEntries[cpuEntries.length - 1].value) : 0;
    const memEntries = recent.filter(m => m.metricType === "memory_usage");
    const memoryMb = memEntries.length > 0 ? memEntries[memEntries.length - 1].value : 0;
    const uptimeEntries = recent.filter(m => m.metricType === "uptime");
    const uptime = uptimeEntries.length > 0 ? Math.round(uptimeEntries[uptimeEntries.length - 1].value * 100) / 100 : 100;
    return { requests, errors, avgResponseMs, uptime, cpuPercent, memoryMb };
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

  async updatePortConfig(id: string, data: Partial<{ label: string; protocol: string; isPublic: boolean; exposeLocalhost: boolean }>): Promise<PortConfig | undefined> {
    const [p] = await db.update(portConfigs).set(data).where(eq(portConfigs.id, id)).returning();
    return p;
  }

  async deletePortConfig(id: string): Promise<boolean> {
    const result = await db.delete(portConfigs).where(eq(portConfigs.id, id)).returning();
    return result.length > 0;
  }

  async getSkills(projectId: string): Promise<Skill[]> {
    return db.select().from(skills).where(eq(skills.projectId, projectId)).orderBy(desc(skills.createdAt));
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    const [s] = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
    return s;
  }

  async createSkill(data: InsertSkill): Promise<Skill> {
    const [s] = await db.insert(skills).values(data).returning();
    return s;
  }

  async updateSkill(id: string, data: Partial<{ name: string; description: string; content: string; isActive: boolean }>): Promise<Skill | undefined> {
    const [s] = await db.update(skills).set(data).where(eq(skills.id, id)).returning();
    return s;
  }

  async deleteSkill(id: string): Promise<boolean> {
    const result = await db.delete(skills).where(eq(skills.id, id)).returning();
    return result.length > 0;
  }

  async getActiveSkills(projectId: string): Promise<Skill[]> {
    return db.select().from(skills).where(and(eq(skills.projectId, projectId), eq(skills.isActive, true))).orderBy(skills.name);
  }

  async getFrameworks(filters?: { search?: string; category?: string; language?: string }): Promise<(Project & { authorName?: string })[]> {
    const conditions = [eq(projects.isDevFramework, true)];
    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(projects.frameworkCategory, filters.category));
    }
    if (filters?.language) {
      conditions.push(eq(projects.language, filters.language));
    }

    let results = await db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.updatedAt));

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.frameworkDescription && p.frameworkDescription.toLowerCase().includes(term))
      );
    }

    const enriched: (Project & { authorName?: string })[] = [];
    for (const p of results) {
      const user = await this.getUser(p.userId);
      enriched.push({ ...p, authorName: user?.displayName || user?.email || "Unknown" });
    }
    return enriched;
  }

  async getFramework(id: string): Promise<(Project & { authorName?: string }) | undefined> {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.isDevFramework, true))).limit(1);
    if (!project) return undefined;
    const user = await this.getUser(project.userId);
    return { ...project, authorName: user?.displayName || user?.email || "Unknown" };
  }

  async publishAsFramework(id: string, userId: string, data: { description?: string; category?: string; coverUrl?: string }): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
    if (!project) return undefined;
    const [updated] = await db.update(projects).set({
      isDevFramework: true,
      isPublished: true,
      frameworkDescription: data.description || null,
      frameworkCategory: data.category || null,
      frameworkCoverUrl: data.coverUrl || null,
      publishedSlug: project.publishedSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id.slice(0, 8),
      updatedAt: new Date(),
    }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async unpublishFramework(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
    if (!project) return undefined;
    const [updated] = await db.update(projects).set({
      isDevFramework: false,
      frameworkDescription: null,
      frameworkCategory: null,
      frameworkCoverUrl: null,
      updatedAt: new Date(),
    }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async getFrameworkUpdates(frameworkId: string): Promise<FrameworkUpdate[]> {
    return db.select().from(frameworkUpdates).where(eq(frameworkUpdates.frameworkId, frameworkId)).orderBy(desc(frameworkUpdates.createdAt));
  }

  async createFrameworkUpdate(frameworkId: string, message: string): Promise<FrameworkUpdate> {
    const [update] = await db.insert(frameworkUpdates).values({ frameworkId, message }).returning();
    return update;
  }

  async seedOfficialFrameworks(): Promise<void> {
    const { PROJECT_TEMPLATES } = await import("./templates");
    const SYSTEM_USER_ID = "system";

    let [systemUser] = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);
    if (!systemUser) {
      [systemUser] = await db.insert(users).values({
        id: SYSTEM_USER_ID,
        email: "system@e-code.dev",
        password: "",
        displayName: "E-Code Official",
        emailVerified: true,
      }).onConflictDoNothing().returning();
      if (!systemUser) {
        [systemUser] = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);
      }
    }

    for (const tmpl of PROJECT_TEMPLATES) {
      const existing = await db.select().from(projects).where(
        and(eq(projects.name, tmpl.name), eq(projects.isOfficialFramework, true))
      ).limit(1);
      if (existing.length > 0) continue;

      const [proj] = await db.insert(projects).values({
        userId: SYSTEM_USER_ID,
        name: tmpl.name,
        language: tmpl.language,
        isPublished: true,
        isDevFramework: true,
        isOfficialFramework: true,
        frameworkDescription: tmpl.description,
        frameworkCategory: this.inferCategory(tmpl.language),
        publishedSlug: tmpl.id,
      }).returning();

      for (const f of tmpl.files) {
        await db.insert(files).values({ projectId: proj.id, filename: f.filename, content: f.content });
      }
    }
  }

  private inferCategory(language: string): string {
    const map: Record<string, string> = {
      typescript: "frontend",
      javascript: "backend",
      python: "backend",
      go: "backend",
      rust: "systems",
      cpp: "systems",
      java: "backend",
      ruby: "scripting",
      bash: "scripting",
      html: "frontend",
      c: "systems",
    };
    return map[language.toLowerCase()] || "other";
  }

  async getCheckpoints(projectId: string): Promise<Checkpoint[]> {
    return db.select().from(checkpoints).where(eq(checkpoints.projectId, projectId)).orderBy(desc(checkpoints.createdAt));
  }

  async getCheckpoint(id: string): Promise<Checkpoint | undefined> {
    const [cp] = await db.select().from(checkpoints).where(eq(checkpoints.id, id)).limit(1);
    return cp;
  }

  async createCheckpoint(data: InsertCheckpoint): Promise<Checkpoint> {
    const [cp] = await db.insert(checkpoints).values(data).returning();
    return cp;
  }

  async deleteCheckpoint(id: string): Promise<boolean> {
    const result = await db.delete(checkpoints).where(eq(checkpoints.id, id)).returning();
    return result.length > 0;
  }

  async getCheckpointPosition(projectId: string): Promise<CheckpointPosition | undefined> {
    const [pos] = await db.select().from(checkpointPositions).where(eq(checkpointPositions.projectId, projectId)).limit(1);
    return pos;
  }

  async setCheckpointPosition(projectId: string, checkpointId: string | null, divergedFromId?: string | null): Promise<void> {
    const existing = await this.getCheckpointPosition(projectId);
    const updateData: Record<string, unknown> = { currentCheckpointId: checkpointId, updatedAt: new Date() };
    if (divergedFromId !== undefined) {
      updateData.divergedFromId = divergedFromId;
    }
    if (existing) {
      await db.update(checkpointPositions).set(updateData).where(eq(checkpointPositions.projectId, projectId));
    } else {
      await db.insert(checkpointPositions).values({ projectId, currentCheckpointId: checkpointId, divergedFromId: divergedFromId ?? null });
    }
  }

  async getProjectInvites(projectId: string): Promise<ProjectInvite[]> {
    return db.select().from(projectInvites).where(eq(projectInvites.projectId, projectId)).orderBy(desc(projectInvites.createdAt));
  }

  async createProjectInvite(data: InsertProjectInvite): Promise<ProjectInvite> {
    const [invite] = await db.insert(projectInvites).values(data).returning();
    return invite;
  }

  async updateProjectInvite(id: string, projectId: string, data: Partial<{ role: string; status: string }>): Promise<ProjectInvite | undefined> {
    const updates: any = {};
    if (data.role !== undefined) updates.role = data.role;
    if (data.status !== undefined) updates.status = data.status;
    const [invite] = await db.update(projectInvites).set(updates).where(and(eq(projectInvites.id, id), eq(projectInvites.projectId, projectId))).returning();
    return invite;
  }

  async getProjectInviteByIdAndProject(id: string, projectId: string): Promise<ProjectInvite | undefined> {
    const [invite] = await db.select().from(projectInvites).where(and(eq(projectInvites.id, id), eq(projectInvites.projectId, projectId))).limit(1);
    return invite;
  }

  async getPendingInvitesForEmail(email: string): Promise<ProjectInvite[]> {
    return db.select().from(projectInvites).where(and(eq(projectInvites.email, email), eq(projectInvites.status, "pending"))).orderBy(desc(projectInvites.createdAt));
  }

  async getAcceptedInviteForProject(projectId: string, email: string): Promise<ProjectInvite | undefined> {
    const [invite] = await db.select().from(projectInvites).where(and(eq(projectInvites.projectId, projectId), eq(projectInvites.email, email), eq(projectInvites.status, "accepted"))).limit(1);
    return invite;
  }

  async deleteProjectInvite(id: string, projectId: string): Promise<boolean> {
    const result = await db.delete(projectInvites).where(and(eq(projectInvites.id, id), eq(projectInvites.projectId, projectId))).returning();
    return result.length > 0;
  }

  async getPendingInvitesWithProjects(email: string): Promise<(ProjectInvite & { projectName: string; inviterEmail: string })[]> {
    const invites = await db.select().from(projectInvites).where(and(eq(projectInvites.email, email.toLowerCase()), eq(projectInvites.status, "pending")));
    const enriched = await Promise.all(invites.map(async (inv) => {
      const proj = await this.getProject(inv.projectId);
      const inviter = await this.getUser(inv.invitedBy);
      return { ...inv, projectName: proj?.name || "Unknown", inviterEmail: inviter?.email || "Unknown" };
    }));
    return enriched;
  }

  async incrementProjectViewCount(projectId: string): Promise<void> {
    await db.update(projects).set({ viewCount: sql`${projects.viewCount} + 1` }).where(eq(projects.id, projectId));
  }

  async incrementProjectForkCount(projectId: string): Promise<void> {
    await db.update(projects).set({ forkCount: sql`${projects.forkCount} + 1` }).where(eq(projects.id, projectId));
  }

  async getMcpServers(projectId: string): Promise<McpServer[]> {
    return db.select().from(mcpServers).where(eq(mcpServers.projectId, projectId)).orderBy(mcpServers.createdAt);
  }

  async getMcpServer(id: string): Promise<McpServer | undefined> {
    const [server] = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
    return server;
  }

  async createMcpServer(data: InsertMcpServer): Promise<McpServer> {
    const [server] = await db.insert(mcpServers).values(data).returning();
    return server;
  }

  async updateMcpServer(id: string, data: Partial<{ name: string; command: string; args: string[]; env: Record<string, string>; baseUrl: string; headers: Record<string, string>; serverType: string; status: string }>): Promise<McpServer | undefined> {
    const [server] = await db.update(mcpServers).set(data).where(eq(mcpServers.id, id)).returning();
    return server;
  }

  async deleteMcpServer(id: string): Promise<boolean> {
    await db.delete(mcpTools).where(eq(mcpTools.serverId, id));
    const result = await db.delete(mcpServers).where(eq(mcpServers.id, id)).returning();
    return result.length > 0;
  }

  async getMcpTools(serverId: string): Promise<McpTool[]> {
    return db.select().from(mcpTools).where(eq(mcpTools.serverId, serverId));
  }

  async getMcpToolsByProject(projectId: string): Promise<(McpTool & { serverName: string })[]> {
    const servers = await this.getMcpServers(projectId);
    if (servers.length === 0) return [];
    const serverIds = servers.map(s => s.id);
    const tools = await db.select().from(mcpTools).where(inArray(mcpTools.serverId, serverIds));
    const serverMap = new Map(servers.map(s => [s.id, s.name]));
    return tools.map(t => ({ ...t, serverName: serverMap.get(t.serverId) || "unknown" }));
  }

  async createMcpTool(data: InsertMcpTool): Promise<McpTool> {
    const [tool] = await db.insert(mcpTools).values(data).returning();
    return tool;
  }

  async deleteMcpToolsByServer(serverId: string): Promise<number> {
    const result = await db.delete(mcpTools).where(eq(mcpTools.serverId, serverId)).returning();
    return result.length;
  }

  async migrateExistingEnvVarsToEncrypted(): Promise<void> {
    try {
      const allProjectEnvVars = await db.select().from(projectEnvVars);
      let migratedCount = 0;
      for (const ev of allProjectEnvVars) {
        const migrated = migrateToEncrypted(ev.encryptedValue);
        if (migrated !== ev.encryptedValue) {
          await db.update(projectEnvVars).set({ encryptedValue: migrated }).where(eq(projectEnvVars.id, ev.id));
          migratedCount++;
        }
      }

      try {
        const allAccountEnvVars = await db.select().from(accountEnvVars);
        for (const ev of allAccountEnvVars) {
          const migrated = migrateToEncrypted(ev.encryptedValue);
          if (migrated !== ev.encryptedValue) {
            await db.update(accountEnvVars).set({ encryptedValue: migrated }).where(eq(accountEnvVars.id, ev.id));
            migratedCount++;
          }
        }
      } catch {
      }

      if (migratedCount > 0) {
        console.log(`[migration] Migrated ${migratedCount} env vars to encrypted format`);
      }
    } catch (err: any) {
      console.error(`[migration] Failed to migrate env vars: ${err.message}`);
    }
  }

  async getProjectTasks(projectId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return t;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [t] = await db.insert(tasks).values(data).returning();
    return t;
  }

  async updateTask(id: string, data: Partial<{ title: string; description: string; plan: string[]; status: string; progress: number; result: string; errorMessage: string; startedAt: Date; completedAt: Date }>): Promise<Task | undefined> {
    const [t] = await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return t;
  }

  async deleteTask(id: string): Promise<boolean> {
    await db.delete(taskFileSnapshots).where(eq(taskFileSnapshots.taskId, id));
    await db.delete(taskMessages).where(eq(taskMessages.taskId, id));
    await db.delete(taskSteps).where(eq(taskSteps.taskId, id));
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  async getTaskSteps(taskId: string): Promise<TaskStep[]> {
    return db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(taskSteps.orderIndex);
  }

  async createTaskStep(data: InsertTaskStep): Promise<TaskStep> {
    const [s] = await db.insert(taskSteps).values(data).returning();
    return s;
  }

  async updateTaskStep(id: string, data: Partial<{ status: string; output: string; startedAt: Date; completedAt: Date }>): Promise<TaskStep | undefined> {
    const [s] = await db.update(taskSteps).set(data).where(eq(taskSteps.id, id)).returning();
    return s;
  }

  async getTaskMessages(taskId: string): Promise<TaskMessage[]> {
    return db.select().from(taskMessages).where(eq(taskMessages.taskId, taskId)).orderBy(taskMessages.createdAt);
  }

  async addTaskMessage(data: InsertTaskMessage): Promise<TaskMessage> {
    const [m] = await db.insert(taskMessages).values(data).returning();
    return m;
  }

  async getTaskFileSnapshots(taskId: string): Promise<TaskFileSnapshot[]> {
    return db.select().from(taskFileSnapshots).where(eq(taskFileSnapshots.taskId, taskId)).orderBy(taskFileSnapshots.filename);
  }

  async createTaskFileSnapshot(data: InsertTaskFileSnapshot): Promise<TaskFileSnapshot> {
    const [s] = await db.insert(taskFileSnapshots).values(data).returning();
    return s;
  }

  async updateTaskFileSnapshot(taskId: string, filename: string, content: string): Promise<TaskFileSnapshot | undefined> {
    const [s] = await db.update(taskFileSnapshots)
      .set({ content, isModified: true })
      .where(and(eq(taskFileSnapshots.taskId, taskId), eq(taskFileSnapshots.filename, filename)))
      .returning();
    return s;
  }

  async deleteTaskFileSnapshots(taskId: string): Promise<void> {
    await db.delete(taskFileSnapshots).where(eq(taskFileSnapshots.taskId, taskId));
  }

  async getPlans(projectId: string): Promise<AiPlan[]> {
    return db.select().from(aiPlans).where(eq(aiPlans.projectId, projectId)).orderBy(desc(aiPlans.createdAt));
  }

  async getPlan(id: string): Promise<AiPlan | undefined> {
    const [plan] = await db.select().from(aiPlans).where(eq(aiPlans.id, id)).limit(1);
    return plan;
  }

  async getLatestPlan(projectId: string, userId: string): Promise<AiPlan | undefined> {
    const [plan] = await db.select().from(aiPlans)
      .where(and(eq(aiPlans.projectId, projectId), eq(aiPlans.userId, userId)))
      .orderBy(desc(aiPlans.createdAt))
      .limit(1);
    return plan;
  }

  async createPlan(data: InsertAiPlan): Promise<AiPlan> {
    const [plan] = await db.insert(aiPlans).values(data).returning();
    return plan;
  }

  async updatePlan(id: string, data: Partial<{ title: string; status: string }>): Promise<AiPlan | undefined> {
    const [plan] = await db.update(aiPlans).set({ ...data, updatedAt: new Date() }).where(eq(aiPlans.id, id)).returning();
    return plan;
  }

  async deletePlan(id: string): Promise<boolean> {
    await db.delete(aiPlanTasks).where(eq(aiPlanTasks.planId, id));
    const result = await db.delete(aiPlans).where(eq(aiPlans.id, id)).returning();
    return result.length > 0;
  }

  async getPlanTasks(planId: string): Promise<AiPlanTask[]> {
    return db.select().from(aiPlanTasks).where(eq(aiPlanTasks.planId, planId)).orderBy(aiPlanTasks.orderIndex);
  }

  async createPlanTask(data: InsertAiPlanTask): Promise<AiPlanTask> {
    const [task] = await db.insert(aiPlanTasks).values(data).returning();
    return task;
  }

  async createPlanTasks(data: InsertAiPlanTask[]): Promise<AiPlanTask[]> {
    if (data.length === 0) return [];
    return db.insert(aiPlanTasks).values(data).returning();
  }

  async updatePlanTask(id: string, data: Partial<{ title: string; description: string; complexity: string; status: string; orderIndex: number }>): Promise<AiPlanTask | undefined> {
    const [task] = await db.update(aiPlanTasks).set(data).where(eq(aiPlanTasks.id, id)).returning();
    return task;
  }

  async deletePlanTasks(planId: string): Promise<boolean> {
    const result = await db.delete(aiPlanTasks).where(eq(aiPlanTasks.planId, planId)).returning();
    return result.length > 0;
  }

  async replacePlanAtomically(params: {
    projectId: string;
    userId: string;
    title: string;
    model: string;
    tasks: Array<{ title: string; description: string; complexity: string; dependsOn: string[] }>;
    userMessage: string;
    assistantMessage: string;
  }): Promise<{ plan: AiPlan; createdTasks: AiPlanTask[] }> {
    return db.transaction(async (tx) => {
      const existingPlans = await tx.select().from(aiPlans)
        .where(and(eq(aiPlans.projectId, params.projectId), eq(aiPlans.userId, params.userId)));
      for (const old of existingPlans) {
        await tx.delete(aiPlanTasks).where(eq(aiPlanTasks.planId, old.id));
        await tx.delete(aiPlans).where(eq(aiPlans.id, old.id));
      }

      const [plan] = await tx.insert(aiPlans).values({
        projectId: params.projectId,
        userId: params.userId,
        title: params.title,
        model: params.model,
        status: "draft",
      }).returning();

      const createdTasks = params.tasks.length > 0
        ? await tx.insert(aiPlanTasks).values(
            params.tasks.map((t, i) => ({
              planId: plan.id,
              title: t.title,
              description: t.description,
              complexity: t.complexity,
              dependsOn: t.dependsOn.map(String),
              status: "pending" as const,
              orderIndex: i,
            }))
          ).returning()
        : [];

      const existingConvs = await tx.select().from(aiConversations)
        .where(and(
          eq(aiConversations.projectId, params.projectId),
          eq(aiConversations.userId, params.userId),
          eq(aiConversations.title, "__plan__")
        ));
      let convId: string;
      if (existingConvs.length > 0) {
        convId = existingConvs[0].id;
        await tx.delete(aiMessages).where(eq(aiMessages.conversationId, convId));
      } else {
        const [conv] = await tx.insert(aiConversations).values({
          projectId: params.projectId,
          userId: params.userId,
          title: "__plan__",
          model: params.model,
        }).returning();
        convId = conv.id;
      }
      await tx.insert(aiMessages).values([
        { conversationId: convId, role: "user", content: params.userMessage },
        { conversationId: convId, role: "assistant", content: params.assistantMessage, model: params.model },
      ]);

      return { plan, createdTasks };
    });
  }

  async createTheme(userId: string, data: InsertTheme): Promise<Theme> {
    const [theme] = await db.insert(themes).values({
      userId,
      title: data.title,
      description: data.description || "",
      baseScheme: data.baseScheme || "dark",
      globalColors: data.globalColors,
      syntaxColors: data.syntaxColors,
    }).returning();
    return theme;
  }

  async getTheme(id: string): Promise<Theme | undefined> {
    const [theme] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
    return theme;
  }

  async getUserThemes(userId: string): Promise<Theme[]> {
    return db.select().from(themes).where(eq(themes.userId, userId)).orderBy(desc(themes.createdAt));
  }

  async updateTheme(id: string, userId: string, data: Partial<InsertTheme>): Promise<Theme | undefined> {
    const updateData: Partial<typeof themes.$inferInsert> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.baseScheme !== undefined) updateData.baseScheme = data.baseScheme;
    if (data.globalColors !== undefined) updateData.globalColors = data.globalColors;
    if (data.syntaxColors !== undefined) updateData.syntaxColors = data.syntaxColors;
    const [theme] = await db.update(themes).set(updateData)
      .where(and(eq(themes.id, id), eq(themes.userId, userId))).returning();
    return theme;
  }

  async deleteTheme(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(themes).where(and(eq(themes.id, id), eq(themes.userId, userId))).returning();
    if (result.length > 0) {
      await db.delete(installedThemes).where(eq(installedThemes.themeId, id));
      return true;
    }
    return false;
  }

  async publishTheme(id: string, userId: string): Promise<Theme | undefined> {
    const [theme] = await db.update(themes).set({ isPublished: true, updatedAt: new Date() })
      .where(and(eq(themes.id, id), eq(themes.userId, userId))).returning();
    return theme;
  }

  async unpublishTheme(id: string, userId: string): Promise<Theme | undefined> {
    const [theme] = await db.update(themes).set({ isPublished: false, updatedAt: new Date() })
      .where(and(eq(themes.id, id), eq(themes.userId, userId))).returning();
    return theme;
  }

  async installTheme(userId: string, themeId: string): Promise<InstalledTheme> {
    const [existing] = await db.select().from(installedThemes)
      .where(and(eq(installedThemes.userId, userId), eq(installedThemes.themeId, themeId))).limit(1);
    if (existing) return existing;
    const [installed] = await db.insert(installedThemes).values({ userId, themeId }).returning();
    await db.update(themes).set({ installCount: sql`${themes.installCount} + 1` }).where(eq(themes.id, themeId));
    return installed;
  }

  async uninstallTheme(userId: string, themeId: string): Promise<boolean> {
    const result = await db.delete(installedThemes)
      .where(and(eq(installedThemes.userId, userId), eq(installedThemes.themeId, themeId))).returning();
    if (result.length > 0) {
      await db.update(themes).set({ installCount: sql`GREATEST(${themes.installCount} - 1, 0)` }).where(eq(themes.id, themeId));
    }
    return result.length > 0;
  }

  async getInstalledThemes(userId: string): Promise<Theme[]> {
    const installed = await db.select({ themeId: installedThemes.themeId })
      .from(installedThemes).where(eq(installedThemes.userId, userId));
    if (installed.length === 0) return [];
    const themeIds = installed.map(i => i.themeId);
    return db.select().from(themes).where(inArray(themes.id, themeIds));
  }

  async exploreThemes(filters?: { search?: string; baseScheme?: string; authorId?: string; color?: string }): Promise<(Theme & { authorName?: string })[]> {
    const conditions = [eq(themes.isPublished, true)];
    if (filters?.baseScheme) conditions.push(eq(themes.baseScheme, filters.baseScheme));
    if (filters?.authorId) conditions.push(eq(themes.userId, filters.authorId));

    const results = await db.select({
      theme: themes,
      authorName: users.displayName,
    }).from(themes)
      .leftJoin(users, eq(themes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(themes.installCount));

    let mapped = results.map(r => ({ ...r.theme, authorName: r.authorName || "Anonymous" }));
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      mapped = mapped.filter(t => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) || (t.authorName || "").toLowerCase().includes(s));
    }
    if (filters?.color) {
      const target = filters.color.toLowerCase();
      mapped = mapped.filter(t => {
        const gc = t.globalColors;
        const allColors = [gc.background, gc.outline, gc.foreground, gc.primary, gc.positive, gc.negative].map(c => c.toLowerCase());
        return allColors.some(c => c === target || hexColorDistance(c, target) < 60);
      });
    }
    return mapped;
  }

  async getSlidesData(projectId: string): Promise<SlidesDataRecord | undefined> {
    const [record] = await db.select().from(slidesData).where(eq(slidesData.projectId, projectId)).limit(1);
    return record;
  }

  async createSlidesData(data: InsertSlidesData): Promise<SlidesDataRecord> {
    const [record] = await db.insert(slidesData).values(data).returning();
    return record;
  }

  async updateSlidesData(projectId: string, data: Partial<{ slides: SlideData[]; theme: SlideTheme }>): Promise<SlidesDataRecord | undefined> {
    const [record] = await db.update(slidesData).set({ ...data, updatedAt: new Date() }).where(eq(slidesData.projectId, projectId)).returning();
    return record;
  }

  async deleteSlidesData(projectId: string): Promise<boolean> {
    const result = await db.delete(slidesData).where(eq(slidesData.projectId, projectId)).returning();
    return result.length > 0;
  }

  async getVideoData(projectId: string): Promise<VideoDataRecord | undefined> {
    const [record] = await db.select().from(videoData).where(eq(videoData.projectId, projectId)).limit(1);
    return record;
  }

  async createVideoData(data: InsertVideoData): Promise<VideoDataRecord> {
    const [record] = await db.insert(videoData).values(data).returning();
    return record;
  }

  async updateVideoData(projectId: string, data: Partial<{ scenes: VideoScene[]; audioTracks: VideoAudioTrack[]; resolution: { width: number; height: number }; fps: number }>): Promise<VideoDataRecord | undefined> {
    const [record] = await db.update(videoData).set({ ...data, updatedAt: new Date() }).where(eq(videoData.projectId, projectId)).returning();
    return record;
  }

  async deleteVideoData(projectId: string): Promise<boolean> {
    const result = await db.delete(videoData).where(eq(videoData.projectId, projectId)).returning();
    return result.length > 0;
  }

  async createFileVersion(data: InsertFileVersion): Promise<FileVersion> {
    const [version] = await db.insert(fileVersions).values(data).returning();
    return version;
  }

  async getFileVersions(fileId: string, limit: number = 200, offset: number = 0): Promise<FileVersion[]> {
    return db.select().from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.versionNumber))
      .limit(limit)
      .offset(offset);
  }

  async getFileVersion(id: string): Promise<FileVersion | undefined> {
    const [version] = await db.select().from(fileVersions).where(eq(fileVersions.id, id)).limit(1);
    return version;
  }

  async getFileVersionCount(fileId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.fileId, fileId));
    return result?.count ?? 0;
  }

  async getLatestFileVersionNumber(fileId: string): Promise<number> {
    const [result] = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${fileVersions.versionNumber}), 0)` })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId));
    return result?.maxVersion ?? 0;
  }

  async deleteOldFileVersions(fileId: string, keepCount: number): Promise<number> {
    const versionsToKeep = await db.select({ id: fileVersions.id })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.versionNumber))
      .limit(keepCount);
    const keepIds = versionsToKeep.map(v => v.id);
    if (keepIds.length === 0) return 0;
    const deleted = await db.delete(fileVersions)
      .where(and(
        eq(fileVersions.fileId, fileId),
        sql`${fileVersions.id} NOT IN (${sql.join(keepIds.map(id => sql`${id}`), sql`, `)})`
      ))
      .returning();
    return deleted.length;
  }

  async purgeFileVersionsOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db.delete(fileVersions)
      .where(sql`${fileVersions.createdAt} < ${cutoff}`)
      .returning({ id: fileVersions.id });
    return result.length;
  }

  async getNotifications(userId: string, limit = 50, offset = 0): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count ?? 0;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(data).returning();
    return n;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const [n] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return n;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.rowCount ?? 0;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const [existing] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    if (existing) return existing;
    const [created] = await db.insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [refetch] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return refetch;
  }

  async updateNotificationPreferences(userId: string, data: Partial<{ agent: boolean; billing: boolean; deployment: boolean; security: boolean; team: boolean; system: boolean }>): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    const [updated] = await db.update(notificationPreferences)
      .set(data)
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return updated || existing;
  }

  async getSystemModules(projectId: string): Promise<SystemModule[]> {
    return db.select().from(systemModules).where(eq(systemModules.projectId, projectId));
  }

  async createSystemModule(data: InsertSystemModule): Promise<SystemModule> {
    const [m] = await db.insert(systemModules).values(data).returning();
    return m;
  }

  async deleteSystemModule(id: string): Promise<boolean> {
    const result = await db.delete(systemModules).where(eq(systemModules.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSystemDeps(projectId: string): Promise<SystemDep[]> {
    return db.select().from(systemDeps).where(eq(systemDeps.projectId, projectId));
  }

  async createSystemDep(data: InsertSystemDep): Promise<SystemDep> {
    const [d] = await db.insert(systemDeps).values(data).returning();
    return d;
  }

  async deleteSystemDep(id: string): Promise<boolean> {
    const result = await db.delete(systemDeps).where(eq(systemDeps.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getGitBackups(projectId: string): Promise<GitBackup[]> {
    return db.select().from(gitBackups).where(eq(gitBackups.projectId, projectId)).orderBy(desc(gitBackups.version));
  }

  async getGitBackupByVersion(projectId: string, version: number): Promise<GitBackup | undefined> {
    const [backup] = await db.select().from(gitBackups)
      .where(and(eq(gitBackups.projectId, projectId), eq(gitBackups.version, version)))
      .limit(1);
    return backup;
  }

  async getLatestGitBackup(projectId: string): Promise<GitBackup | undefined> {
    const [backup] = await db.select().from(gitBackups)
      .where(eq(gitBackups.projectId, projectId))
      .orderBy(desc(gitBackups.version))
      .limit(1);
    return backup;
  }

  async getLatestGitBackupVersion(projectId: string): Promise<number> {
    const [result] = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${gitBackups.version}), 0)` })
      .from(gitBackups)
      .where(eq(gitBackups.projectId, projectId));
    return result?.maxVersion ?? 0;
  }

  async createGitBackup(data: InsertGitBackup): Promise<GitBackup> {
    const [backup] = await db.insert(gitBackups).values(data as any).returning();
    return backup;
  }

  async pruneGitBackups(projectId: string, keepCount: number): Promise<number> {
    const allBackups = await db.select({ id: gitBackups.id })
      .from(gitBackups)
      .where(eq(gitBackups.projectId, projectId))
      .orderBy(desc(gitBackups.version));

    if (allBackups.length <= keepCount) return 0;

    const toDelete = allBackups.slice(keepCount).map(b => b.id);
    if (toDelete.length === 0) return 0;

    const result = await db.delete(gitBackups).where(inArray(gitBackups.id, toDelete));
    return result.rowCount ?? 0;
  }

  async getStaleBackupProjects(maxAgeHours: number): Promise<{ projectId: string; lastBackupAt: Date | null }[]> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const allProjects = await db.select({ id: projects.id }).from(projects);
    const results: { projectId: string; lastBackupAt: Date | null }[] = [];

    for (const p of allProjects) {
      const [latest] = await db.select({ createdAt: gitBackups.createdAt })
        .from(gitBackups)
        .where(eq(gitBackups.projectId, p.id))
        .orderBy(desc(gitBackups.version))
        .limit(1);

      if (!latest || new Date(latest.createdAt) < cutoff) {
        results.push({ projectId: p.id, lastBackupAt: latest ? new Date(latest.createdAt) : null });
      }
    }
    return results;
  }

  async createSshKey(userId: string, label: string, publicKey: string, fingerprint: string): Promise<SshKey> {
    const [key] = await db.insert(sshKeys).values({ userId, label, publicKey, fingerprint }).returning();
    return key;
  }

  async listSshKeysByUser(userId: string): Promise<SshKey[]> {
    return db.select().from(sshKeys).where(eq(sshKeys.userId, userId)).orderBy(desc(sshKeys.createdAt));
  }

  async deleteSshKey(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(sshKeys).where(and(eq(sshKeys.id, id), eq(sshKeys.userId, userId))).returning();
    return result.length > 0;
  }

  async findSshKeyByFingerprint(fingerprint: string): Promise<SshKey | undefined> {
    const [key] = await db.select().from(sshKeys).where(eq(sshKeys.fingerprint, fingerprint)).limit(1);
    return key;
  }

  async getArtifactTemplates(outputType?: string): Promise<ArtifactTemplate[]> {
    if (outputType) {
      return db.select().from(artifactTemplates).where(eq(artifactTemplates.outputType, outputType));
    }
    return db.select().from(artifactTemplates);
  }

  async getArtifactTemplate(id: string): Promise<ArtifactTemplate | undefined> {
    const [template] = await db.select().from(artifactTemplates).where(eq(artifactTemplates.id, id)).limit(1);
    return template;
  }

  async createArtifactTemplate(data: InsertArtifactTemplate): Promise<ArtifactTemplate> {
    const [template] = await db.insert(artifactTemplates).values(data).returning();
    return template;
  }

  async seedArtifactTemplates(): Promise<void> {
    const existing = await db.select().from(artifactTemplates).limit(1);
    if (existing.length > 0) return;

    const templates: InsertArtifactTemplate[] = [
      {
        outputType: "web",
        name: "Web App",
        description: "React/Vite full-stack web application",
        files: [],
        dependencies: {},
        buildCommand: "npm run build",
        runCommand: "npm run dev",
        systemPromptHint: "Generate a modern React web application with Vite. Use clean component architecture, modern CSS, and responsive design.",
      },
      {
        outputType: "mobile",
        name: "Mobile App",
        description: "Responsive PWA with mobile-first layout",
        files: [],
        dependencies: {},
        buildCommand: "npm run build",
        runCommand: "npm run dev",
        systemPromptHint: "Generate a responsive PWA with mobile-first layout. Include viewport meta, manifest.json, and service worker stub. Use touch-friendly UI patterns.",
      },
      {
        outputType: "slides",
        name: "Presentation",
        description: "Reveal.js slide presentation with speaker notes",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate an HTML presentation using Reveal.js via CDN. Include multiple slides with transitions, speaker notes, and presenter mode navigation.",
      },
      {
        outputType: "animation",
        name: "Animation",
        description: "CSS/JS animation with timeline controls",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate a canvas/CSS/SVG animation with interactive controls (play/pause/speed) and requestAnimationFrame. Include a timeline editor interface.",
      },
      {
        outputType: "design",
        name: "Design",
        description: "Static HTML/CSS visual-first layout",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate an interactive design tool or visual canvas with drawing tools, color pickers, and export functionality. Focus on visual-first layout.",
      },
      {
        outputType: "data-visualization",
        name: "Data Visualization",
        description: "D3/Chart.js interactive dashboard",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate a data dashboard using Chart.js or D3.js via CDN with sample datasets, interactive charts, filters, and responsive layout.",
      },
      {
        outputType: "automation",
        name: "Automation",
        description: "Node.js automation scripts with scheduling",
        files: [],
        dependencies: {},
        runCommand: "node index.js",
        systemPromptHint: "Generate Node.js automation scripts with file processing, scheduling (cron-like), logging, error handling, and configurable parameters.",
      },
      {
        outputType: "3d-game",
        name: "3D Game",
        description: "Three.js project with game loop",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate a 3D game using Three.js via CDN. Include camera controls, basic physics, game loop with requestAnimationFrame, and play/pause controls.",
      },
      {
        outputType: "document",
        name: "Document Editor",
        description: "Rich text editor with PDF export",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate a rich text or Markdown editor with formatting toolbar, live preview, and export to HTML/PDF. Include templates and keyboard shortcuts.",
      },
      {
        outputType: "spreadsheet",
        name: "Spreadsheet",
        description: "Data grid with formulas and CSV support",
        files: [],
        dependencies: {},
        runCommand: "open index.html",
        systemPromptHint: "Generate an interactive data grid with formula support (SUM, AVG, COUNT), sorting, filtering, CSV import/export, and cell formatting.",
      },
    ];

    for (const template of templates) {
      await db.insert(artifactTemplates).values(template).onConflictDoNothing();
    }
  }

  async getMergeState(projectId: string): Promise<MergeState | undefined> {
    const [state] = await db.select().from(mergeStates).where(eq(mergeStates.projectId, projectId)).limit(1);
    return state;
  }

  async saveMergeState(data: InsertMergeState): Promise<MergeState> {
    await db.delete(mergeStates).where(eq(mergeStates.projectId, data.projectId));
    const [state] = await db.insert(mergeStates).values(data).returning();
    return state;
  }

  async updateMergeResolution(projectId: string, resolution: MergeResolution): Promise<MergeState | undefined> {
    const existing = await this.getMergeState(projectId);
    if (!existing) return undefined;
    const resolutions = [...(existing.resolutions || [])];
    const idx = resolutions.findIndex(r => r.filename === resolution.filename);
    if (idx >= 0) {
      resolutions[idx] = resolution;
    } else {
      resolutions.push(resolution);
    }
    const [updated] = await db.update(mergeStates)
      .set({ resolutions })
      .where(eq(mergeStates.projectId, projectId))
      .returning();
    return updated;
  }

  async deleteMergeState(projectId: string): Promise<boolean> {
    const result = await db.delete(mergeStates).where(eq(mergeStates.projectId, projectId));
    return (result.rowCount ?? 0) > 0;
  }

  async getDeletedProjects(userId: string): Promise<Project[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return db.select().from(projects).where(
      and(eq(projects.userId, userId), sql`${projects.deletedAt} IS NOT NULL`, gte(projects.deletedAt, thirtyDaysAgo))
    ).orderBy(desc(projects.deletedAt));
  }

  async softDeleteProject(id: string, userId: string): Promise<boolean> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
    if (!project) return false;
    await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, id));
    return true;
  }

  async restoreProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId), sql`${projects.deletedAt} IS NOT NULL`)).limit(1);
    if (!project) return undefined;
    const [restored] = await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, id)).returning();
    return restored;
  }

  async restoreProjectByTitle(title: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.userId, userId), sql`${projects.deletedAt} IS NOT NULL`, sql`LOWER(${projects.name}) = LOWER(${title})`))
      .orderBy(desc(projects.deletedAt)).limit(1);
    if (!project) return undefined;
    const [restored] = await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, project.id)).returning();
    return restored;
  }

  async purgeOldDeletedProjects(daysOld: number): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const toDelete = await db.select().from(projects).where(
      and(sql`${projects.deletedAt} IS NOT NULL`, sql`${projects.deletedAt} < ${cutoff}`)
    );
    for (const p of toDelete) {
      await this.deleteProject(p.id, p.userId);
    }
    return toDelete.length;
  }

  async getAccountWarnings(userId: string): Promise<AccountWarning[]> {
    return db.select().from(accountWarnings).where(eq(accountWarnings.userId, userId)).orderBy(desc(accountWarnings.issuedAt));
  }

  async createAccountWarning(data: InsertAccountWarning): Promise<AccountWarning> {
    const [warning] = await db.insert(accountWarnings).values(data).returning();
    return warning;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`).limit(1);
    return user;
  }

  async changeUsername(userId: string, username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return undefined;
    if (user.usernameChangedAt) return undefined;
    const existing = await this.getUserByUsername(username);
    if (existing && existing.id !== userId) return undefined;
    const [updated] = await db.update(users).set({ username, usernameChangedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async searchProjects(userId: string, query: string): Promise<Project[]> {
    return db.select().from(projects).where(
      and(eq(projects.userId, userId), sql`${projects.deletedAt} IS NULL`, sql`${projects.name} ILIKE ${'%' + query + '%'}`)
    ).limit(20);
  }

  async searchTemplates(query: string): Promise<{ id: string; name: string; language: string }[]> {
    const { getAllTemplates } = await import("./templates");
    const all = getAllTemplates();
    const q = query.toLowerCase();
    return all
      .filter((t: any) => t.name.toLowerCase().includes(q) || t.language?.toLowerCase().includes(q))
      .slice(0, 20)
      .map((t: any) => ({ id: t.id, name: t.name, language: t.language || "javascript" }));
  }

  async searchCodeAcrossProjects(userId: string, query: string): Promise<{ projectId: string; projectName: string; filename: string; line: string }[]> {
    const userProjects = await this.getProjects(userId);
    const results: { projectId: string; projectName: string; filename: string; line: string }[] = [];
    for (const p of userProjects.slice(0, 50)) {
      const projectFiles = await db.select().from(files).where(
        and(eq(files.projectId, p.id), sql`${files.content} ILIKE ${'%' + query + '%'}`)
      ).limit(5);
      for (const f of projectFiles) {
        const lines = f.content.split('\n');
        const matchLine = lines.find(l => l.toLowerCase().includes(query.toLowerCase()));
        results.push({ projectId: p.id, projectName: p.name, filename: f.filename, line: matchLine?.trim() || '' });
      }
      if (results.length >= 30) break;
    }
    return results.slice(0, 30);
  }

  async searchUsers(query: string): Promise<Pick<User, 'id' | 'displayName' | 'username' | 'avatarUrl'>[]> {
    return db.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(or(
        sql`${users.displayName} ILIKE ${'%' + query + '%'}`,
        sql`${users.username} ILIKE ${'%' + query + '%'}`
      ))
      .limit(20);
  }

  async getArtifacts(projectId: string): Promise<Artifact[]> {
    return db.select().from(artifacts).where(eq(artifacts.projectId, projectId)).orderBy(artifacts.createdAt);
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
    return artifact;
  }

  async createArtifact(data: InsertArtifact): Promise<Artifact> {
    const [artifact] = await db.insert(artifacts).values(data).returning();
    return artifact;
  }

  async updateArtifact(id: string, data: Partial<{ name: string; type: string; entryFile: string; settings: Record<string, unknown> }>): Promise<Artifact | undefined> {
    const [artifact] = await db.update(artifacts).set(data).where(eq(artifacts.id, id)).returning();
    return artifact;
  }

  async deleteArtifact(id: string): Promise<boolean> {
    const result = await db.delete(artifacts).where(eq(artifacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getLatestDesktopReleases(): Promise<DesktopRelease[]> {
    return db.select().from(desktopReleases).where(eq(desktopReleases.isLatest, true));
  }

  async getDesktopReleasesByVersion(version: string): Promise<DesktopRelease[]> {
    return db.select().from(desktopReleases).where(eq(desktopReleases.version, version));
  }

  async createDesktopRelease(data: InsertDesktopRelease): Promise<DesktopRelease> {
    if (data.isLatest) {
      await db.update(desktopReleases)
        .set({ isLatest: false })
        .where(and(
          eq(desktopReleases.platform, data.platform),
          eq(desktopReleases.isLatest, true)
        ));
    }
    const [release] = await db.insert(desktopReleases).values(data).returning();
    return release;
  }

  async trackDesktopDownload(platform: string, version: string): Promise<void> {
    await db.insert(desktopDownloads).values({ platform, version });
  }

  async getCanvasFrames(projectId: string): Promise<CanvasFrame[]> {
    return db.select().from(canvasFrames).where(eq(canvasFrames.projectId, projectId));
  }

  async getCanvasFrame(id: string): Promise<CanvasFrame | undefined> {
    const [frame] = await db.select().from(canvasFrames).where(eq(canvasFrames.id, id)).limit(1);
    return frame;
  }

  async createCanvasFrame(data: InsertCanvasFrame): Promise<CanvasFrame> {
    const [frame] = await db.insert(canvasFrames).values(data).returning();
    return frame;
  }

  async updateCanvasFrame(id: string, projectId: string, data: Partial<{ name: string; htmlContent: string; x: number; y: number; width: number; height: number; zIndex: number }>): Promise<CanvasFrame | undefined> {
    const [frame] = await db.update(canvasFrames).set(data).where(and(eq(canvasFrames.id, id), eq(canvasFrames.projectId, projectId))).returning();
    return frame;
  }

  async deleteCanvasFrame(id: string, projectId: string): Promise<boolean> {
    const result = await db.delete(canvasFrames).where(and(eq(canvasFrames.id, id), eq(canvasFrames.projectId, projectId))).returning();
    return result.length > 0;
  }

  async getCanvasAnnotations(projectId: string): Promise<CanvasAnnotation[]> {
    return db.select().from(canvasAnnotations).where(eq(canvasAnnotations.projectId, projectId));
  }

  async getCanvasAnnotation(id: string): Promise<CanvasAnnotation | undefined> {
    const [annotation] = await db.select().from(canvasAnnotations).where(eq(canvasAnnotations.id, id)).limit(1);
    return annotation;
  }

  async createCanvasAnnotation(data: InsertCanvasAnnotation): Promise<CanvasAnnotation> {
    const [annotation] = await db.insert(canvasAnnotations).values(data).returning();
    return annotation;
  }

  async updateCanvasAnnotation(id: string, projectId: string, data: Partial<{ type: string; content: string; x: number; y: number; width: number; height: number; color: string; zIndex: number }>): Promise<CanvasAnnotation | undefined> {
    const [annotation] = await db.update(canvasAnnotations).set(data).where(and(eq(canvasAnnotations.id, id), eq(canvasAnnotations.projectId, projectId))).returning();
    return annotation;
  }

  async deleteCanvasAnnotation(id: string, projectId: string): Promise<boolean> {
    const result = await db.delete(canvasAnnotations).where(and(eq(canvasAnnotations.id, id), eq(canvasAnnotations.projectId, projectId))).returning();
    return result.length > 0;
  }

  async createDeploymentFeedback(data: InsertDeploymentFeedback): Promise<DeploymentFeedback> {
    const [feedback] = await db.insert(deploymentFeedback).values(data).returning();
    return feedback;
  }

  async getDeploymentFeedback(projectId: string, status?: string): Promise<DeploymentFeedback[]> {
    if (status) {
      return db.select().from(deploymentFeedback)
        .where(and(eq(deploymentFeedback.projectId, projectId), eq(deploymentFeedback.status, status)))
        .orderBy(desc(deploymentFeedback.createdAt));
    }
    return db.select().from(deploymentFeedback)
      .where(eq(deploymentFeedback.projectId, projectId))
      .orderBy(desc(deploymentFeedback.createdAt));
  }

  async getDeploymentFeedbackById(id: string): Promise<DeploymentFeedback | undefined> {
    const [feedback] = await db.select().from(deploymentFeedback).where(eq(deploymentFeedback.id, id)).limit(1);
    return feedback;
  }

  async updateDeploymentFeedbackStatus(id: string, projectId: string, status: string): Promise<DeploymentFeedback | undefined> {
    const [feedback] = await db.update(deploymentFeedback)
      .set({ status, resolvedAt: status === "resolved" ? new Date() : null })
      .where(and(eq(deploymentFeedback.id, id), eq(deploymentFeedback.projectId, projectId)))
      .returning();
    return feedback;
  }

  async deleteDeploymentFeedback(id: string, projectId: string): Promise<boolean> {
    const result = await db.delete(deploymentFeedback).where(and(eq(deploymentFeedback.id, id), eq(deploymentFeedback.projectId, projectId))).returning();
    return result.length > 0;
  }

  async getConversions(projectId: string): Promise<Conversion[]> {
    return db.select().from(conversions).where(eq(conversions.projectId, projectId)).orderBy(desc(conversions.createdAt));
  }

  async getConversion(id: string): Promise<Conversion | undefined> {
    const [conversion] = await db.select().from(conversions).where(eq(conversions.id, id)).limit(1);
    return conversion;
  }

  async createConversion(data: InsertConversion): Promise<Conversion> {
    const [conversion] = await db.insert(conversions).values(data).returning();
    return conversion;
  }

  async updateConversion(id: string, data: Partial<{ status: string; artifactId: string; designTokens: Record<string, unknown>; error: string }>): Promise<Conversion | undefined> {
    const [conversion] = await db.update(conversions).set(data).where(eq(conversions.id, id)).returning();
    return conversion;
  }


  async getAiCredentialConfigs(projectId: string): Promise<AiCredentialConfig[]> {
    return db.select().from(aiCredentialConfigs).where(eq(aiCredentialConfigs.projectId, projectId));
  }

  async getAiCredentialConfig(projectId: string, provider: string): Promise<AiCredentialConfig | undefined> {
    const [config] = await db.select().from(aiCredentialConfigs)
      .where(and(eq(aiCredentialConfigs.projectId, projectId), eq(aiCredentialConfigs.provider, provider)))
      .limit(1);
    return config;
  }

  async upsertAiCredentialConfig(projectId: string, provider: string, mode: string, apiKey?: string | null): Promise<AiCredentialConfig> {
    const encryptedKey = apiKey ? encrypt(apiKey) : null;
    const existing = await this.getAiCredentialConfig(projectId, provider);
    if (existing) {
      const [updated] = await db.update(aiCredentialConfigs)
        .set({ mode, apiKey: encryptedKey ?? existing.apiKey, updatedAt: new Date() })
        .where(eq(aiCredentialConfigs.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(aiCredentialConfigs)
      .values({ projectId, provider, mode, apiKey: encryptedKey })
      .returning();
    return created;
  }

  async deleteAiCredentialConfig(projectId: string, provider: string): Promise<boolean> {
    const result = await db.delete(aiCredentialConfigs)
      .where(and(eq(aiCredentialConfigs.projectId, projectId), eq(aiCredentialConfigs.provider, provider)))
      .returning();
    return result.length > 0;
  }

  async logAiUsage(data: InsertAiUsageLog): Promise<AiUsageLog> {
    const [log] = await db.insert(aiUsageLogs).values(data).returning();
    return log;
  }

  async getAiUsageLogs(userId: string, filters?: { projectId?: string; provider?: string; since?: Date; limit?: number }): Promise<AiUsageLog[]> {
    const conditions = [eq(aiUsageLogs.userId, userId)];
    if (filters?.projectId) conditions.push(eq(aiUsageLogs.projectId, filters.projectId));
    if (filters?.provider) conditions.push(eq(aiUsageLogs.provider, filters.provider));
    if (filters?.since) conditions.push(gte(aiUsageLogs.createdAt, filters.since));
    return db.select().from(aiUsageLogs)
      .where(and(...conditions))
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(filters?.limit ?? 100);
  }

  async getAiUsageSummary(userId: string, since?: Date): Promise<{ provider: string; totalInputTokens: number; totalOutputTokens: number; totalCost: number; callCount: number }[]> {
    const conditions = [eq(aiUsageLogs.userId, userId)];
    if (since) conditions.push(gte(aiUsageLogs.createdAt, since));
    const rows = await db.select({
      provider: aiUsageLogs.provider,
      totalInputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
      totalCost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
      callCount: sql<number>`count(*)::int`,
    }).from(aiUsageLogs)
      .where(and(...conditions))
      .groupBy(aiUsageLogs.provider);
    return rows;
  }

  async getAiUsageByProject(userId: string, since?: Date): Promise<{ projectId: string; provider: string; totalCost: number; callCount: number }[]> {
    const conditions = [eq(aiUsageLogs.userId, userId)];
    if (since) conditions.push(gte(aiUsageLogs.createdAt, since));
    const rows = await db.select({
      projectId: aiUsageLogs.projectId,
      provider: aiUsageLogs.provider,
      totalCost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
      callCount: sql<number>`count(*)::int`,
    }).from(aiUsageLogs)
      .where(and(...conditions))
      .groupBy(aiUsageLogs.projectId, aiUsageLogs.provider);
    return rows as any;
  }
}

export const storage = new DatabaseStorage();
