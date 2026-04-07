// @ts-nocheck
import {
  User, InsertUser, UpsertUser,
  Project, InsertProject,
  File, InsertFile,
  EmailVerificationToken, InsertEmailVerificationToken,
  PasswordResetToken, InsertPasswordResetToken,
  ApiKey, InsertApiKey,
  CodeReview, InsertCodeReview,
  Challenge, InsertChallenge,
  MentorProfile, InsertMentorProfile,
  ChallengeSubmission,
  MentorshipSession,
  MobileDevice,
  MobileSession, InsertMobileSession,
  Deployment, InsertDeployment,
  Comment, InsertComment,
  Checkpoint, InsertCheckpoint,
  TimeTracking, InsertTimeTracking,
  Screenshot, InsertScreenshot,
  TaskSummary, InsertTaskSummary,
  VoiceVideoSession, InsertVoiceVideoSession,
  VoiceVideoParticipant, InsertVoiceVideoParticipant,
  GpuInstance, InsertGpuInstance,
  GpuUsage, InsertGpuUsage,
  Assignment, InsertAssignment,
  Submission, InsertSubmission,
  Template, InsertTemplate,
  PromptTemplate, InsertPromptTemplate,
  CustomPrompt, InsertCustomPrompt,
  ProjectAiRule, InsertProjectAiRule,
  PromptUsageHistory, InsertPromptUsageHistory,
  PromptTemplateRating, InsertPromptTemplateRating,
  NewsletterSubscriber, InsertNewsletterSubscriber,
  NewsletterCampaign, InsertNewsletterCampaign,
  NewsletterDelivery, InsertNewsletterDelivery,
  LspDiagnostic, InsertLspDiagnostic,
  BuildLog, InsertBuildLog,
  TerminalLog, InsertTerminalLog,
  TestRun, InsertTestRun,
  TestCase, InsertTestCase,
  SecurityScan, InsertSecurityScan,
  Vulnerability, InsertVulnerability,
  SecurityScanSettings, InsertSecurityScanSettings,
  ResourceMetric, InsertResourceMetric,
  PaneConfiguration, InsertPaneConfiguration,
  AiApprovalQueue, InsertAiApprovalQueue,
  AiAuditLog, InsertAiAuditLog,
  Bounty, InsertBounty,
  BountySubmission, InsertBountySubmission,
  BountyReview, InsertBountyReview,
  UserId, normalizeUserId,

  artifacts, Artifact, InsertArtifact,
  workflows, Workflow, InsertWorkflow,
  workflowSteps, WorkflowStep, InsertWorkflowStep,
  projects, files, users, apiKeys, codeReviews,
  emailVerificationTokens, passwordResetTokens,
  challenges, challengeSubmissions, challengeLeaderboard, mentorProfiles, mentorshipSessions,
  mobileDevices, mobileSessions, pushNotifications, notificationPreferences, teams, teamMembers, deployments,
  comments, checkpoints, projectTimeTracking, projectScreenshots, taskSummaries, usageTracking,
  userCredits, budgetLimits, usageAlerts, autoscaleDeployments, reservedVmDeployments,
  scheduledDeployments, staticDeployments, objectStorageBuckets, objectStorageFiles,
  keyValueStore, aiConversations, dynamicIntelligence, webSearchHistory,
  projectEnvVars, gitRepositories, gitCommits, customDomains, secrets, environmentVariables,
  voiceVideoSessions, voiceVideoParticipants, gpuInstances, gpuUsage,
  assignments, submissions, aiUsageRecords, templates,
  promptTemplates, customPrompts, projectAiRules, promptUsageHistory, promptTemplateRatings,
  newsletterSubscribers, newsletterCampaigns, newsletterDeliveries,
  lspDiagnostics, buildLogs, terminalLogs, testRuns, testCases, securityScans, vulnerabilities, securityScanSettings,
  resourceMetrics, paneConfigurations,
  aiApprovalQueue, aiAuditLogs,
  bounties, bountySubmissions, bountyReviews,
  agentSessions,
  alerts, insertAlertSchema,
  insertAiApprovalQueueSchema, insertAiAuditLogSchema,
  insertUserCreditsSchema, insertBudgetLimitSchema, insertUsageAlertSchema,
  insertAutoscaleDeploymentSchema, insertReservedVmDeploymentSchema,
  insertScheduledDeploymentSchema, insertStaticDeploymentSchema,
  insertObjectStorageBucketSchema, insertObjectStorageFileSchema,
  insertKeyValueStoreSchema, insertAiConversationSchema,
  insertDynamicIntelligenceSchema, insertWebSearchHistorySchema,
  insertGitRepositorySchema, insertGitCommitSchema, insertCustomDomainSchema,
  insertSecretSchema, insertEnvironmentVariableSchema,
  insertNewsletterSubscriberSchema, insertNewsletterCampaignSchema, insertNewsletterDeliverySchema,
  insertNotificationSchema, insertNotificationPreferenceSchema,
  customerRequests, insertCustomerRequestSchema,
  projectImports, auditLogs,
  projectAuthConfig, projectAuthUsers,
  ProjectAuthConfig, InsertProjectAuthConfig, ProjectAuthUser, InsertProjectAuthUser,
  integrationCatalog, IntegrationCatalogEntry,
  projectIntegrations, ProjectIntegration,
  integrationLogs, IntegrationLog,
  userConnections, UserConnection,
  sshKeys, SshKey, InsertSshKey,
  webhooks, Webhook, InsertWebhook,
} from "@shared/schema";
import { z } from "zod";

function _num(val: string | number | undefined | null): any {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) || String(n) !== val ? val : n;
  }
  return val;
}

// Define the types that were missing
type UserCredits = typeof userCredits.$inferSelect;
type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
type BudgetLimit = typeof budgetLimits.$inferSelect;
type InsertBudgetLimit = z.infer<typeof insertBudgetLimitSchema>;
type UsageAlert = typeof usageAlerts.$inferSelect;
type InsertUsageAlert = z.infer<typeof insertUsageAlertSchema>;
type Alert = typeof alerts.$inferSelect;
type InsertAlert = z.infer<typeof insertAlertSchema>;
type AutoscaleDeployment = typeof autoscaleDeployments.$inferSelect;
type InsertAutoscaleDeployment = z.infer<typeof insertAutoscaleDeploymentSchema>;
type ReservedVmDeployment = typeof reservedVmDeployments.$inferSelect;
type InsertReservedVmDeployment = z.infer<typeof insertReservedVmDeploymentSchema>;
type ScheduledDeployment = typeof scheduledDeployments.$inferSelect;
type InsertScheduledDeployment = z.infer<typeof insertScheduledDeploymentSchema>;
type StaticDeployment = typeof staticDeployments.$inferSelect;
type InsertStaticDeployment = z.infer<typeof insertStaticDeploymentSchema>;
type ObjectStorageBucket = typeof objectStorageBuckets.$inferSelect;
type InsertObjectStorageBucket = z.infer<typeof insertObjectStorageBucketSchema>;
type ObjectStorageFile = typeof objectStorageFiles.$inferSelect;
type InsertObjectStorageFile = z.infer<typeof insertObjectStorageFileSchema>;
type KeyValueStore = typeof keyValueStore.$inferSelect;
type InsertKeyValueStore = z.infer<typeof insertKeyValueStoreSchema>;
type AiConversation = typeof aiConversations.$inferSelect;
type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
type DynamicIntelligence = typeof dynamicIntelligence.$inferSelect;
type InsertDynamicIntelligence = z.infer<typeof insertDynamicIntelligenceSchema>;
type WebSearchHistory = typeof webSearchHistory.$inferSelect;
type InsertWebSearchHistory = z.infer<typeof insertWebSearchHistorySchema>;
type GitRepository = typeof gitRepositories.$inferSelect;
type InsertGitRepository = z.infer<typeof insertGitRepositorySchema>;
type GitCommit = typeof gitCommits.$inferSelect;
type InsertGitCommit = z.infer<typeof insertGitCommitSchema>;
type CustomDomain = typeof customDomains.$inferSelect;
type InsertCustomDomain = z.infer<typeof insertCustomDomainSchema>;
type CustomerRequest = typeof customerRequests.$inferSelect;
type InsertCustomerRequest = z.infer<typeof insertCustomerRequestSchema>;
type ProjectImport = typeof projectImports.$inferSelect; // Added type for ProjectImport

type NotificationRecord = typeof pushNotifications.$inferSelect;
type InsertNotificationRecord = z.infer<typeof insertNotificationSchema>;
type NotificationPreferenceRecord = typeof notificationPreferences.$inferSelect;
type InsertNotificationPreferenceRecord = z.infer<typeof insertNotificationPreferenceSchema>;
type NotificationPreferencesPayload = Partial<{
  email: Record<string, any> | null | undefined;
  push: Record<string, any> | null | undefined;
  frequency: string | null | undefined;
}>;
type NotificationFrequency = 'instant' | 'hourly' | 'daily' | 'weekly';

const EMAIL_NOTIFICATION_KEYS = [
  'comments',
  'likes',
  'follows',
  'mentions',
  'teamUpdates',
  'deployments',
  'security',
  'marketing',
] as const;

const PUSH_NOTIFICATION_KEYS = [
  'comments',
  'likes',
  'follows',
  'mentions',
  'teamUpdates',
  'deployments',
  'security',
] as const;

const VALID_NOTIFICATION_FREQUENCIES = new Set<NotificationFrequency>([
  'instant',
  'hourly',
  'daily',
  'weekly',
]);

const DEFAULT_NOTIFICATION_PREFERENCES: {
  email: Record<(typeof EMAIL_NOTIFICATION_KEYS)[number], boolean>;
  push: Record<(typeof PUSH_NOTIFICATION_KEYS)[number], boolean>;
  frequency: NotificationFrequency;
} = {
  email: {
    comments: true,
    likes: true,
    follows: true,
    mentions: true,
    teamUpdates: true,
    deployments: true,
    security: true,
    marketing: false,
  },
  push: {
    comments: true,
    likes: true,
    follows: true,
    mentions: true,
    teamUpdates: true,
    deployments: true,
    security: true,
  },
  frequency: 'instant',
};

const normalizePreferenceSection = (
  keys: readonly string[],
  defaults: Record<string, boolean>,
  ...sources: (Record<string, any> | null | undefined)[]
) => {
  const normalized: Record<string, boolean> = { ...defaults };
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        normalized[key] = Boolean(source[key]);
      }
    }
  }
  return normalized;
};

const normalizePreferences = (
  existing?: NotificationPreferencesPayload,
  updates?: NotificationPreferencesPayload,
) => {
  const email = normalizePreferenceSection(
    EMAIL_NOTIFICATION_KEYS,
    DEFAULT_NOTIFICATION_PREFERENCES.email,
    existing?.email ?? undefined,
    updates?.email ?? undefined,
  );
  const push = normalizePreferenceSection(
    PUSH_NOTIFICATION_KEYS,
    DEFAULT_NOTIFICATION_PREFERENCES.push,
    existing?.push ?? undefined,
    updates?.push ?? undefined,
  );
  const candidate = (updates?.frequency ?? existing?.frequency) as string | undefined;
  const frequency = VALID_NOTIFICATION_FREQUENCIES.has(candidate as NotificationFrequency)
    ? (candidate as NotificationFrequency)
    : DEFAULT_NOTIFICATION_PREFERENCES.frequency;

  return { email, push, frequency };
};

import { eq, and, desc, isNull, sql, inArray, gte, lte, lt, SQL, or, ilike } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import { Store } from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from 'memorystore';
import { client } from "./db";
import * as crypto from "crypto";
import { Pool } from 'pg';
import { withTransaction, type TransactionClient } from "./utils/db-transactions";
import {
  SupportTicket, InsertSupportTicket,
  TicketReply, InsertTicketReply,
  supportTickets, ticketReplies,
  AdminApiKey, adminApiKeys,
  CmsPage, InsertCmsPage, cmsPages,
  Documentation, InsertDocumentation, documentation,
  DocCategory, InsertDocCategory, docCategories,
  UserSubscription, InsertUserSubscription, userSubscriptions,
  AdminActivityLog, InsertAdminActivityLog, adminActivityLogs,
} from '@shared/admin-schema';

type ApiKeyInsertModel = typeof apiKeys.$inferInsert;
type CodeReviewInsertModel = typeof codeReviews.$inferInsert;
type ChallengeInsertModel = typeof challenges.$inferInsert;
type MentorProfileInsertModel = typeof mentorProfiles.$inferInsert;

type UsageMetricInput = {
  metricType: string;
  value: number | string;
  unit: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
};

type UsageMetricMetadata = {
  unit?: string;
  [key: string]: unknown;
};

const normalizeStringArray = (value: unknown, fallback: string[] = []): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value === null || value === undefined) {
    return [...fallback];
  }

  return [String(value)];
};

const toMutableArray = <T>(value: readonly T[] | T[] | null | undefined): T[] | null | undefined => {
  if (Array.isArray(value)) {
    return [...value];
  }
  return value;
};

// Storage interface definition
export interface IStorage {
  // Mobile-specific methods
  getUserByUsername(username: string): Promise<User | undefined>;
  createFile(data: {projectId: string | number; path?: string; filename?: string; name?: string; content: string }): Promise<File>;
  createFile(file: InsertFile & { projectId?: string | number }): Promise<File>;
  updateFile(fileId: number, data: { content: string }): Promise<void>;
  updateFile(id: number, file: Partial<InsertFile>): Promise<File | undefined>;
  getTrendingProjects(options: { limit: number }): Promise<any[]>;
  getFeaturedProjects(options: { limit: number }): Promise<any[]>;
  pinProject(projectId: string | number, userId: string | number): Promise<void>;
  unpinProject(projectId: string | number, userId: string | number): Promise<void>;
  trackUsage(userId: string | number, data: UsageMetricInput): Promise<void>;
  updateUserStripeInfo(userId: string | number, data: any): Promise<User | undefined>;

  // Notification operations
  getNotifications(userId: string | number | number, unreadOnly?: boolean): Promise<NotificationRecord[]>;
  getNotificationsForUser(userId: string | number | number, limit?: number): Promise<NotificationRecord[]>;
  getUnreadNotificationCount(userId: string | number | number): Promise<number>;
  getNotificationPreferences(userId: string | number | number): Promise<NotificationPreferenceRecord>;
  updateNotificationPreferences(
    userId: string | number | number,
    preferences: NotificationPreferencesPayload,
  ): Promise<NotificationPreferenceRecord>;
  markNotificationAsRead(notificationId: number, userId: string | number | number): Promise<void>;
  markAllNotificationsAsRead(userId: string | number | number): Promise<void>;
  deleteNotification(notificationId: number, userId: string | number | number): Promise<void>;
  deleteAllNotifications(userId: string | number | number): Promise<void>;
  createNotification(notification: InsertNotificationRecord): Promise<NotificationRecord>;
  updatePushNotification(id: number, data: Partial<NotificationRecord>): Promise<void>;
  // User operations
  getUser(id: string | number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  searchUsers(query: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string | number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string | number): Promise<boolean>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Newsletter operations
  subscribeToNewsletter(data: InsertNewsletterSubscriber & { metadata?: Record<string, any> }): Promise<NewsletterSubscriber>;
  unsubscribeFromNewsletter(email: string, context?: {
    reason?: string;
    metadata?: Record<string, any>;
    ipAddress?: string | null;
    country?: string | null;
    userAgent?: string | null;
    source?: string | null;
  }): Promise<boolean>;
  confirmNewsletterSubscription(email: string, token: string): Promise<boolean>;
  getNewsletterSubscribers(): Promise<NewsletterSubscriber[]>;
  getActiveNewsletterSubscribers(): Promise<NewsletterSubscriber[]>;
  getNewsletterStatistics(): Promise<{
    total: number;
    active: number;
    confirmed: number;
    unsubscribed: number;
    byCountry: { country: string; count: number }[];
    campaignsSent: number;
    lastSentAt: Date | null;
  }>;
  createNewsletterCampaign(campaign: InsertNewsletterCampaign & { status?: string }): Promise<NewsletterCampaign>;
  markNewsletterCampaignSent(campaignId: number, data: Partial<NewsletterCampaign>): Promise<NewsletterCampaign | undefined>;
  getNewsletterCampaigns(limit?: number): Promise<NewsletterCampaign[]>;
  logNewsletterDelivery(delivery: InsertNewsletterDelivery): Promise<NewsletterDelivery>;

  // Project operations
  getProject(id: string | number): Promise<Project | undefined>;
  getProjectBySlug(slug: string, ownerId: string | number): Promise<Project | null>;
  getProjectsByUserId(ownerId: string | number): Promise<Project[]>;
  getProjectsByUserIdPaginated(ownerId: string | number, limit: number, offset: number): Promise<{ projects: Project[]; total: number }>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string | number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string | number): Promise<boolean>;
  incrementProjectViews(id: string | number): Promise<void>;

  // File operations
  getFile(id: number): Promise<File | undefined>;
  getFilesByProjectId(projectId: string | number): Promise<File[]>;
  getFilesByProject(projectId: string | number): Promise<File[]>; // Alias for compatibility
  getFileByPath(projectId: string | number, path: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: number, file: Partial<InsertFile>): Promise<File | undefined>;
  deleteFile(id: number): Promise<boolean>;

  // API Key operations
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getUserApiKeys(userId: string | number): Promise<ApiKey[]>;
  getApiKey(id: number): Promise<ApiKey | undefined>;
  updateApiKey(id: number, apiKey: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: number): Promise<boolean>;
  getApiKeys(): Promise<AdminApiKey[]>;
  getApiKeyByProvider(provider: string): Promise<AdminApiKey | undefined>;

  // Code Review operations
  createCodeReview(review: InsertCodeReview): Promise<CodeReview>;
  getCodeReview(id: number): Promise<CodeReview | undefined>;
  getProjectCodeReviews(projectId: string | number): Promise<CodeReview[]>;
  updateCodeReview(id: number, review: Partial<InsertCodeReview>): Promise<CodeReview | undefined>;

  // Challenge operations
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  getChallenge(id: number): Promise<Challenge | undefined>;
  getChallengesByCategory(category: string): Promise<Challenge[]>;
  updateChallenge(id: number, challenge: Partial<InsertChallenge>): Promise<Challenge | undefined>;

  // Mentorship operations
  createMentorProfile(profile: InsertMentorProfile): Promise<MentorProfile>;
  getMentorProfile(userId: string | number): Promise<MentorProfile | undefined>;
  updateMentorProfile(userId: string | number, profile: Partial<InsertMentorProfile>): Promise<MentorProfile | undefined>;

  // Template operations
  getAllTemplates(publishedOnly?: boolean): Promise<Template[]>;
  getTemplateBySlug(slug: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string | number, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string | number): Promise<boolean>;
  pinProject(projectId: string | number, userId: string | number): Promise<void>;
  unpinProject(projectId: string | number, userId: string | number): Promise<void>;

  // Login history operations
  createLoginHistory(history: any): Promise<any>;

  // Admin API Key operations (for centralized AI services)
  getActiveAdminApiKey(provider: string): Promise<any>;
  trackAIUsage(userId: string | number, tokens: number, mode: string): Promise<void>;
  createAiUsageRecord(record: any): Promise<any>;
  updateUserAiTokens(userId: string | number, tokensUsed: number): Promise<void>;

  // Agent Session operations (for admin monitoring)
  getActiveAgentSessions?(): Promise<any[]>;
  terminateAgentSession?(sessionId: string, data: { terminatedBy: number; reason: string }): Promise<void>;

  // AI Usage Tracking for billing
  createAIUsageRecord(record: {
    userId: number;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    creditsCost: number;
    purpose?: string;
    projectId?: number;
    metadata?: any;
  }): Promise<any>;
  getAIUsageStats(userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]>;
  getUserCredits(userId: string | number): Promise<UserCredits | undefined>;

  // Deployment operations
  createDeployment(deploymentData: InsertDeployment): Promise<Deployment>;
  getDeployments(projectId: string | number): Promise<Deployment[]>;
  updateDeployment(id: number | string, deploymentData: Partial<InsertDeployment>): Promise<Deployment | undefined>;
  listDeployments(): Promise<Deployment[]>; // Added listDeployments method
  getDeploymentByExternalId(deploymentId: string): Promise<Deployment | undefined>;
  updateDeploymentStatus(id: number, updates: { status: string; lastDeployedAt?: Date }): Promise<void>;
  getProjectDeployments(projectId: string | number): Promise<Deployment[]>;
  getRecentDeployments(userId: string | number): Promise<Deployment[]>;

  // Audit log operations
  getAuditLogs(filters: { userId: string | number; action?: string; dateRange?: string }): Promise<any[]>;

  // Storage operations
  getStorageBuckets(): Promise<any[]>;
  createStorageBucket(bucket: { projectId: string | number; name: string; region: string; isPublic: boolean }): Promise<any>;
  getProjectStorageBuckets(projectId: string | number): Promise<any[]>;
  getStorageObjects(bucketId: string): Promise<any[]>;
  deleteStorageObject(bucketId: string, objectKey: string): Promise<void>;

  // Team operations
  getUserTeams(userId: string | number): Promise<any[]>;

  // Theme operations
  getUserThemeSettings(userId: string | number): Promise<any>;
  updateUserThemeSettings(userId: string | number, settings: any): Promise<any>;
  getInstalledThemes(userId: string | number): Promise<any[]>;
  installTheme(userId: string | number, themeId: string): Promise<void>;
  uninstallTheme(userId: string | number, themeId: string): Promise<void>;
  createCustomTheme(userId: string | number, theme: any): Promise<any>;

  // Stripe operations
  updateUserStripeInfo(userId: string | number, stripeData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: Date;
  }): Promise<User | undefined>;
  updateStripeCustomerId(userId: string | number, customerId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Usage tracking operations
  trackUsage(
    userId: string | number,
    eventType: string,
    quantity: number,
    metadata?: UsageMetricMetadata
  ): Promise<void>;
  getUsageStats(userId: string | number, startDate?: Date, endDate?: Date): Promise<any>;
  getUserUsage(userId: string | number, billingPeriodStart?: Date): Promise<any>;
  getUsageHistory(userId: string | number, startDate: Date, endDate: Date, metricType?: string): Promise<any[]>;
  getUsageSummary(userId: string | number, period: string): Promise<any>;

  // Comments operations
  createComment(comment: InsertComment): Promise<Comment>;
  getProjectComments(projectId: string | number): Promise<Comment[]>;
  getFileComments(fileId: number): Promise<Comment[]>;
  updateComment(id: number, comment: Partial<InsertComment>): Promise<Comment | undefined>;
  deleteComment(id: number): Promise<boolean>;

  // Checkpoints operations
  createCheckpoint(checkpoint: any): Promise<Checkpoint>;
  getProjectCheckpoints(projectId: string | number): Promise<Checkpoint[]>;
  getCheckpoint(id: number): Promise<Checkpoint | undefined>;
  restoreCheckpoint(checkpointId: number): Promise<boolean>;

  // Agent operations
  getAgentWorkSteps(projectId: string | number, sessionId: string): Promise<any[]>;
  createAgentCheckpoint(checkpoint: {
    projectId: string | number;
    userId: string | number;
    message: string;
    changes: number;
    sessionId: string;
    timestamp: Date;
  }): Promise<any>;
  
  // AI Conversation operations
  createAiConversation(conversation: InsertAiConversation): Promise<AiConversation>;
  getAiConversation(id: number): Promise<AiConversation | undefined>;
  updateAiConversation(id: number, updates: Partial<InsertAiConversation>): Promise<AiConversation | undefined>;
  addMessageToConversation(conversationId: number, message: any): Promise<void>;
  
  // Agent Message operations
  createAgentMessage(message: {
    conversationId: number;
    projectId: string | number;
    userId: string | number;
    role: string;
    content: string;
    model?: string;
    metadata?: Record<string, any>;
  }): Promise<any>;
  getAgentMessages(conversationId: number): Promise<any[]>;

  // Build Execution operations
  createBuildExecution(execution: {
    projectId: string | number;
    conversationId?: number;
    planId: string;
    totalTasks: number;
    metadata?: any;
  }): Promise<any>;
  getBuildExecution(id: string | number): Promise<any | undefined>;
  getBuildExecutionsByProject(projectId: string | number): Promise<any[]>;
  updateBuildExecution(id: string | number, updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    currentTaskId?: string;
    currentTaskIndex?: number;
    progress?: number;
    executionLog?: any[];
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<any | undefined>;

  // Dynamic Intelligence / Agent Preferences operations
  getDynamicIntelligenceSettings(userId: string | number): Promise<DynamicIntelligence | undefined>;
  updateDynamicIntelligenceSettings(userId: string | number, settings: Partial<InsertDynamicIntelligence>): Promise<DynamicIntelligence>;

  // Time tracking operations
  startTimeTracking(tracking: InsertTimeTracking): Promise<TimeTracking>;
  stopTimeTracking(trackingId: number): Promise<TimeTracking | undefined>;
  getActiveTimeTracking(projectId: string | number, userId: string | number): Promise<TimeTracking | undefined>;
  getProjectTimeTracking(projectId: string | number): Promise<TimeTracking[]>;

  // Screenshot operations
  createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot>;
  getProjectScreenshots(projectId: string | number): Promise<Screenshot[]>;
  getScreenshot(id: number): Promise<Screenshot | undefined>;
  deleteScreenshot(id: number): Promise<boolean>;

  // Task summary operations
  createTaskSummary(summary: InsertTaskSummary): Promise<TaskSummary>;
  getProjectTaskSummaries(projectId: string | number): Promise<TaskSummary[]>;
  updateTaskSummary(id: number, summary: Partial<InsertTaskSummary>): Promise<TaskSummary | undefined>;

  // Voice/Video Session operations
  createVoiceVideoSession(session: InsertVoiceVideoSession): Promise<VoiceVideoSession>;
  getProjectVoiceVideoSessions(projectId: string | number): Promise<VoiceVideoSession[]>;
  endVoiceVideoSession(sessionId: number): Promise<VoiceVideoSession | undefined>;
  addVoiceVideoParticipant(participant: InsertVoiceVideoParticipant): Promise<VoiceVideoParticipant>;
  removeVoiceVideoParticipant(sessionId: number, userId: string | number): Promise<void>;

  // GPU Instance operations
  createGpuInstance(instance: InsertGpuInstance): Promise<GpuInstance>;
  getProjectGpuInstances(projectId: string | number): Promise<GpuInstance[]>;
  updateGpuInstanceStatus(instanceId: number, status: string): Promise<GpuInstance | undefined>;
  createGpuUsage(usage: InsertGpuUsage): Promise<GpuUsage>;
  getGpuUsageByInstance(instanceId: number): Promise<GpuUsage[]>;

  // Assignment operations
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  getAssignments(filters?: { courseId?: number; createdBy?: number }): Promise<Assignment[]>;
  getAssignment(id: number): Promise<Assignment | undefined>;
  updateAssignment(id: number, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined>;

  // Submission operations
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getSubmissionsByAssignment(assignmentId: number): Promise<Submission[]>;
  getSubmissionsByStudent(studentId: number): Promise<Submission[]>;
  gradeSubmission(submissionId: number, grade: number, feedback: string, gradedBy: number): Promise<Submission | undefined>;

  // Secret management operations
  createSecret(secret: any): Promise<any>;
  getProjectSecrets(projectId: string | number): Promise<any[]>;
  getSecret(id: number): Promise<any | undefined>;
  deleteSecret(id: number): Promise<boolean>;

  // Missing methods from routes.ts
  getProjectCollaborators(projectId: string | number): Promise<any[]>;
  isProjectCollaborator(projectId: string | number, userId: string | number): Promise<boolean>;
  forkProject(projectId: string | number, userId: string | number): Promise<Project>;
  likeProject(projectId: string | number, userId: string | number): Promise<void>;
  unlikeProject(projectId: string | number, userId: string | number): Promise<void>;
  isProjectLiked(projectId: string | number, userId: string | number): Promise<boolean>;
  getProjectLikes(projectId: string | number): Promise<number>;
  trackProjectView(projectId: string | number, userId: string | number): Promise<void>;
  getProjectActivity(projectId: string | number, limit?: number): Promise<any[]>;
  getProjectFiles(projectId: string | number): Promise<any[]>;
  getFileById(id: number): Promise<any | undefined>;
  getAdminApiKey(provider: string): Promise<any>;
  createCLIToken(userId: string | number): Promise<any>;
  getUserCLITokens(userId: string | number): Promise<any[]>;
  getMobileSession(userId: string | number | number, deviceId: string): Promise<MobileSession | undefined>;
  createMobileSession(session: InsertMobileSession): Promise<MobileSession>;
  updateMobileSession(userId: string | number | number, deviceId: string, session: Partial<InsertMobileSession>): Promise<MobileSession | undefined>;
  getUserMobileSessions(userId: string | number | number): Promise<MobileSession[]>;
  deleteMobileSession(userId: string | number | number, deviceId: string): Promise<boolean>;
  cleanupExpiredMobileSessions(): Promise<number>;
  getProjectDeployments(projectId: string | number): Promise<any[]>;
  getRecentDeployments(userId: string | number): Promise<any[]>;

  // Custom Prompts operations
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  getPromptTemplates(filters?: { category?: string; isSystem?: boolean; isPublic?: boolean }): Promise<PromptTemplate[]>;
  getPromptTemplate(id: number): Promise<PromptTemplate | undefined>;
  updatePromptTemplate(id: number, template: Partial<InsertPromptTemplate>): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: number): Promise<boolean>;

  createCustomPrompt(prompt: InsertCustomPrompt): Promise<CustomPrompt>;
  getUserCustomPrompts(userId: string | number): Promise<CustomPrompt[]>;
  getCustomPrompt(id: number): Promise<CustomPrompt | undefined>;
  updateCustomPrompt(id: number, prompt: Partial<InsertCustomPrompt>): Promise<CustomPrompt | undefined>;
  deleteCustomPrompt(id: number): Promise<boolean>;

  createProjectAiRule(rule: InsertProjectAiRule): Promise<ProjectAiRule>;
  getProjectAiRules(projectId: string | number, activeOnly?: boolean): Promise<ProjectAiRule[]>;
  getProjectAiRule(id: number): Promise<ProjectAiRule | undefined>;
  updateProjectAiRule(id: number, rule: Partial<InsertProjectAiRule>): Promise<ProjectAiRule | undefined>;
  deleteProjectAiRule(id: number): Promise<boolean>;

  createPromptUsageHistory(usage: InsertPromptUsageHistory): Promise<PromptUsageHistory>;
  getPromptUsageHistory(filters: { userId: string | number; projectId: string | number; limit?: number }): Promise<PromptUsageHistory[]>;

  createPromptTemplateRating(rating: InsertPromptTemplateRating): Promise<PromptTemplateRating>;
  getPromptTemplateRatings(templateId: number): Promise<PromptTemplateRating[]>;
  updatePromptTemplateRating(templateId: number): Promise<void>;

  // Email Verification Token operations
  saveEmailVerificationToken(userId: string | number, email: string, token: string, expiresAt: Date): Promise<void>;
  getEmailVerificationByToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<boolean>;

  // Password Reset Token operations
  savePasswordResetToken(userId: string | number, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetByToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  // LSP Diagnostics operations - For Problems Panel
  createLspDiagnostic(diagnostic: InsertLspDiagnostic): Promise<LspDiagnostic>;
  getLspDiagnostic(id: string | number): Promise<LspDiagnostic | undefined>;
  getLspDiagnostics(projectId: string | number, filePath?: string): Promise<LspDiagnostic[]>;
  updateLspDiagnostic(id: string | number, updates: Partial<LspDiagnostic>): Promise<LspDiagnostic>;
  deleteLspDiagnostic(id: string | number): Promise<void>;
  clearLspDiagnostics(projectId: string | number, filePath?: string): Promise<void>;

  // Build Logs operations - For Output Panel
  createBuildLog(log: InsertBuildLog): Promise<BuildLog>;
  getBuildLogs(projectId: string | number, buildId?: string, limit?: number): Promise<BuildLog[]>;
  clearBuildLogs(projectId: string | number, buildId?: string): Promise<void>;

  // Terminal Logs operations - Persistent Console Logs
  createTerminalLog(log: InsertTerminalLog): Promise<TerminalLog>;
  getTerminalLogs(projectId: string | number, limit?: number): Promise<TerminalLog[]>;
  clearTerminalLogs(projectId: string | number): Promise<void>;

  // Test Runs operations - For Testing Panel
  createTestRun(run: InsertTestRun): Promise<TestRun>;
  getTestRun(id: string | number): Promise<TestRun | undefined>;
  getTestRuns(projectId: string | number, limit?: number): Promise<TestRun[]>;
  updateTestRun(id: string | number, updates: Partial<TestRun>): Promise<TestRun>;
  
  createTestCase(testCase: InsertTestCase): Promise<TestCase>;
  getTestCases(testRunId: string): Promise<TestCase[]>;
  updateTestCase(id: string | number, updates: Partial<TestCase>): Promise<TestCase>;

  // Security Scans operations - For Security Scanner Panel
  createSecurityScan(scan: InsertSecurityScan): Promise<SecurityScan>;
  getSecurityScan(id: string | number): Promise<SecurityScan | undefined>;
  getSecurityScans(projectId: string | number, limit?: number): Promise<SecurityScan[]>;
  updateSecurityScan(id: string | number, updates: Partial<SecurityScan>): Promise<SecurityScan>;

  createVulnerability(vulnerability: InsertVulnerability): Promise<Vulnerability>;
  getVulnerabilities(scanId: string): Promise<Vulnerability[]>;
  getProjectVulnerabilities(projectId: string | number, status?: string): Promise<Vulnerability[]>;
  getProjectVulnerabilitiesByHidden(projectId: string | number, isHidden: boolean): Promise<Vulnerability[]>;
  updateVulnerability(id: string | number, updates: Partial<Vulnerability>): Promise<Vulnerability>;

  // Security Scan Settings operations
  getSecurityScanSettings(projectId: string | number): Promise<SecurityScanSettings | undefined>;
  upsertSecurityScanSettings(projectId: string | number, updates: Partial<InsertSecurityScanSettings>): Promise<SecurityScanSettings>;

  // Resource Metrics operations - For Resources Panel
  createResourceMetric(metric: InsertResourceMetric): Promise<ResourceMetric>;
  getResourceMetrics(projectId: string | number, limit?: number): Promise<ResourceMetric[]>;
  getLatestResourceMetrics(projectId: string | number): Promise<ResourceMetric | undefined>;

  // Pane Configurations operations - For Split Editor
  createPaneConfiguration(config: InsertPaneConfiguration): Promise<PaneConfiguration>;
  getPaneConfiguration(id: string | number): Promise<PaneConfiguration | undefined>;
  getUserPaneConfigurations(userId: string | number, projectId: string | number): Promise<PaneConfiguration[]>;
  updatePaneConfiguration(id: string | number, updates: Partial<PaneConfiguration>): Promise<PaneConfiguration>;
  deletePaneConfiguration(id: string | number): Promise<void>;

  // AI Approval Queue operations - Fortune 500 Security
  createAiApproval(approval: InsertAiApprovalQueue): Promise<AiApprovalQueue>;
  getAiApproval(id: string | number): Promise<AiApprovalQueue | undefined>;
  getPendingAiApprovals(userId: string | number, projectId: string | number): Promise<AiApprovalQueue[]>;
  updateAiApprovalStatus(id: string | number, status: string, processedBy: string, rejectionReason?: string): Promise<AiApprovalQueue>;
  expireOldAiApprovals(): Promise<number>; // Returns count of expired approvals

  // AI Audit Log operations - Compliance-grade audit trail
  createAiAuditLog(log: InsertAiAuditLog): Promise<AiAuditLog>;
  getAiAuditLogs(filters: {
    userId: string | number;
    projectId: string | number;
    approvalId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AiAuditLog[]>;

  // Team membership check - For access control
  getTeamMemberByUserAndProject?(userId: string | number, projectId: string | number): Promise<any | undefined>;

  // Bounty operations
  createBounty(bounty: InsertBounty): Promise<Bounty>;
  getBounty(id: number): Promise<Bounty | undefined>;
  updateBounty(id: number, bounty: Partial<Bounty>): Promise<Bounty | undefined>;
  listBounties(filters: {
    status?: string;
    minAmount?: number;
    maxAmount?: number;
    skills?: string[];
    isPublic?: boolean;
    featured?: boolean;
    difficulty?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bounties: Bounty[]; total: number; page: number; limit: number }>;
  getCreatedBounties(creatorId: number): Promise<Bounty[]>;
  getAssignedBounties(assigneeId: number): Promise<Bounty[]>;
  getAppliedBounties(userId: number): Promise<Bounty[]>;
  getFeaturedBounties(limit?: number): Promise<Bounty[]>;
  incrementBountyViews(bountyId: number): Promise<void>;
  incrementBountyApplications(bountyId: number): Promise<void>;

  // Bounty Submission operations
  createBountySubmission(submission: InsertBountySubmission): Promise<BountySubmission>;
  getBountySubmissions(bountyId: number): Promise<BountySubmission[]>;
  getBountySubmissionByUserAndBounty(userId: number, bountyId: number): Promise<BountySubmission | undefined>;
  updateBountySubmission(id: number, submission: Partial<BountySubmission>): Promise<BountySubmission | undefined>;

  // Bounty Review operations
  createBountyReview(review: InsertBountyReview): Promise<BountyReview>;
  getBountyReviews(bountyId: number): Promise<BountyReview[]>;
  getBountyReviewByReviewerAndBounty(reviewerId: number, bountyId: number): Promise<BountyReview | undefined>;
  getBountyReviewByTypeAndBounty(reviewType: string, bountyId: number, reviewerId: number): Promise<BountyReview | undefined>;
  getHunterReviews(hunterId: number): Promise<BountyReview[]>;
  getPosterReviews(posterId: number): Promise<BountyReview[]>;
  getUserAverageRating(userId: number, reviewType: 'hunter_review' | 'poster_review'): Promise<number | null>;

  // Project Auth Config operations
  getProjectAuthConfig(projectId: number): Promise<ProjectAuthConfig | null>;
  upsertProjectAuthConfig(projectId: number, config: Partial<InsertProjectAuthConfig>): Promise<ProjectAuthConfig>;
  getProjectAuthUsers(projectId: number, limit?: number): Promise<ProjectAuthUser[]>;
  addProjectAuthUser(user: InsertProjectAuthUser): Promise<ProjectAuthUser>;
  deleteProjectAuthUser(projectId: number, userId: number): Promise<boolean>;

  // Support Ticket operations
  getSupportTickets(filter?: { status?: string; userId?: number; assignedTo?: number }): Promise<SupportTicket[]>;
  getSupportTicket(id: number): Promise<SupportTicket | undefined>;
  updateSupportTicket(id: number, update: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  getTicketReplies(ticketId: number): Promise<TicketReply[]>;
  createTicketReply(reply: InsertTicketReply): Promise<TicketReply>;

  // CMS operations
  getCmsPages(): Promise<CmsPage[]>;
  getCmsPage(id: number): Promise<CmsPage | undefined>;
  getCmsPageBySlug(slug: string): Promise<CmsPage | undefined>;
  createCmsPage(page: InsertCmsPage): Promise<CmsPage>;
  updateCmsPage(id: number, update: Partial<CmsPage>): Promise<CmsPage | undefined>;
  deleteCmsPage(id: number): Promise<boolean>;

  // Documentation operations
  getDocumentation(): Promise<Documentation[]>;
  getDocumentationByCategory(categoryId: number): Promise<Documentation[]>;
  createDocumentation(doc: InsertDocumentation): Promise<Documentation>;
  updateDocumentation(id: number, update: Partial<Documentation>): Promise<Documentation | undefined>;
  getDocCategories(): Promise<DocCategory[]>;
  createDocCategory(category: InsertDocCategory): Promise<DocCategory>;

  // Subscription operations
  getUserSubscriptions(filter?: { userId?: number; status?: string }): Promise<UserSubscription[]>;
  getUserActiveSubscription(userId: number): Promise<UserSubscription | undefined>;
  createUserSubscription(sub: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(id: number, update: Partial<UserSubscription>): Promise<UserSubscription | undefined>;

  // Admin Activity Log operations
  createAdminActivityLog(log: InsertAdminActivityLog): Promise<AdminActivityLog>;
  getAdminActivityLogs(filter?: { adminId?: number; entityType?: string }): Promise<AdminActivityLog[]>;

  // Developer operations (API keys, SSH keys, Webhooks)
  getApiKeys(userId: string): Promise<any[]>;
  createApiKey(userId: string, name: string): Promise<{ key: string; record: any }>;
  deleteApiKey(userId: string, keyId: string): Promise<boolean>;
  getSshKeys(userId: string): Promise<SshKey[]>;
  createSshKey(userId: string, label: string, publicKey: string): Promise<SshKey>;
  deleteSshKey(userId: string, keyId: string): Promise<boolean>;
  getWebhooks(userId: string): Promise<Webhook[]>;
  createWebhook(userId: string, url: string, events: string[]): Promise<Webhook>;
  updateWebhook(userId: string, webhookId: string, updates: Partial<Webhook>): Promise<Webhook | null>;
  deleteWebhook(userId: string, webhookId: string): Promise<boolean>;

  // Integration operations
  getIntegrationCatalog(): Promise<IntegrationCatalogEntry[]>;
  getProjectIntegrations(projectId: string): Promise<(ProjectIntegration & { integration: IntegrationCatalogEntry })[]>;
  connectIntegration(projectId: string, integrationId: string, config: Record<string, string>): Promise<ProjectIntegration>;
  disconnectIntegration(projectId: string, integrationId: string): Promise<boolean>;
  updateIntegrationStatus(piId: string, status: string): Promise<void>;
  addIntegrationLog(piId: string, level: string, message: string): Promise<void>;
  getIntegrationLogs(projectId: string, integrationId: string, limit?: number): Promise<IntegrationLog[]>;
  getUserConnections(userId: string): Promise<UserConnection[]>;
}

export class DatabaseStorage implements IStorage {
  private db = db; // Use the imported db instance

  // Mobile-specific project feeds
  async getTrendingProjects({ limit }: { limit: number }): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .orderBy(desc(projects.views), desc(projects.updatedAt))
      .limit(limit);
  }

  async getFeaturedProjects({ limit }: { limit: number }): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(eq(projects.isPinned, true))
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
  }

  async pinProject(projectId: string | number, userId: string | number): Promise<void> {
    await this.db
      .update(projects)
      .set({ isPinned: true, updatedAt: new Date() })
      .where(and(eq(projects.id, _num(projectId)), eq(projects.ownerId, _num(userId))));

    // Optionally record the pin action for analytics
    await this.trackUsage(userId, "project.pin", 1, { unit: "action" });
  }

  async unpinProject(projectId: string | number, userId: string | number): Promise<void> {
    await this.db
      .update(projects)
      .set({ isPinned: false, updatedAt: new Date() })
      .where(and(eq(projects.id, _num(projectId)), eq(projects.ownerId, _num(userId))));

    await this.trackUsage(userId, "project.unpin", 1, { unit: "action" });
  }

  // User operations
  async getUser(id: string | number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, String(id)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async searchUsers(query: string): Promise<User[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await this.db.select().from(users)
      .where(
        or(
          ilike(users.username, searchTerm),
          ilike(users.email, searchTerm),
          ilike(users.displayName, searchTerm),
        )
      )
      .limit(20);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(userData).returning();
    // If ID is not returned, fetch the created user
    if (!user || !user.id) {
      const createdUser = await this.getUserByEmail(userData.email!);
      if (createdUser) {
        return createdUser;
      }
    }
    return user;
  }

  async updateUser(id: string | number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, _num(id)))
      .returning();
    return user;
  }

  async deleteUser(id: string | number): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, _num(id)));
    return result.length > 0;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Email Verification Token operations
  async saveEmailVerificationToken(userId: string | number, email: string, token: string, expiresAt: Date): Promise<void> {
    await this.db.insert(emailVerificationTokens).values({
      userId: _num(userId),
      email,
      token, // This should be hashed before storing
      expiresAt,
    });
  }

  async getEmailVerificationByToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [verificationToken] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return verificationToken;
  }

  async deleteEmailVerificationToken(token: string): Promise<boolean> {
    const result = await this.db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return result.length > 0;
  }

  // Password Reset Token operations
  async savePasswordResetToken(userId: string | number, token: string, expiresAt: Date): Promise<void> {
    await this.db.insert(passwordResetTokens).values({
      userId: _num(userId),
      token, // This should be hashed before storing
      expiresAt,
    });
  }

  async getPasswordResetByToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result.length > 0;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  // Newsletter operations
  async subscribeToNewsletter(data: (InsertNewsletterSubscriber & { metadata?: Record<string, any> })): Promise<NewsletterSubscriber> {
    const email = data.email.toLowerCase();
    const now = new Date();

    const existing = await this.db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email));

    if (existing.length > 0) {
      const subscriber = existing[0];

      if (subscriber.isActive && !subscriber.unsubscribedAt && subscriber.confirmedAt) {
        throw new Error('Email already subscribed');
      }

      const mergedMetadata = {
        ...(subscriber.metadata ?? {}),
        ...(data.metadata ?? {}),
        lastSubscriptionAt: now.toISOString(),
      };

      const [updated] = await this.db
        .update(newsletterSubscribers)
        .set({
          isActive: true,
          confirmationToken: data.confirmationToken ?? subscriber.confirmationToken,
          confirmedAt: subscriber.confirmedAt && !subscriber.unsubscribedAt ? subscriber.confirmedAt : null,
          unsubscribedAt: null,
          subscribedAt: subscriber.subscribedAt ?? now,
          lastActivityAt: now,
          ipAddress: data.ipAddress ?? subscriber.ipAddress,
          userAgent: data.userAgent ?? subscriber.userAgent,
          country: data.country ?? subscriber.country,
          region: data.region ?? subscriber.region,
          city: data.city ?? subscriber.city,
          postalCode: data.postalCode ?? subscriber.postalCode,
          timezone: data.timezone ?? subscriber.timezone,
          source: data.source ?? subscriber.source,
          metadata: mergedMetadata,
        })
        .where(eq(newsletterSubscribers.id, subscriber.id))
        .returning();

      return updated;
    }

    const insertPayload: InsertNewsletterSubscriber = {
      ...data,
      email,
      isActive: data.isActive ?? true,
      metadata: data.metadata ?? {},
    };

    const [created] = await this.db
      .insert(newsletterSubscribers)
      .values({
        ...insertPayload,
        subscribedAt: now,
        lastActivityAt: now,
      })
      .returning();

    return created;
  }

  async unsubscribeFromNewsletter(email: string, context?: {
    reason?: string;
    metadata?: Record<string, any>;
    ipAddress?: string | null;
    country?: string | null;
    userAgent?: string | null;
    source?: string | null;
  }): Promise<boolean> {
    const sanitizedEmail = email.toLowerCase();
    const [subscriber] = await this.db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, sanitizedEmail));

    if (!subscriber) {
      return false;
    }

    const now = new Date();
    const mergedMetadata = {
      ...(subscriber.metadata ?? {}),
      ...(context?.metadata ?? {}),
      lastUnsubscribedAt: now.toISOString(),
    };

    await this.db
      .update(newsletterSubscribers)
      .set({
        isActive: false,
        unsubscribedAt: now,
        lastActivityAt: now,
        ipAddress: context?.ipAddress ?? subscriber.ipAddress,
        country: context?.country ?? subscriber.country,
        userAgent: context?.userAgent ?? subscriber.userAgent,
        source: context?.source ?? subscriber.source,
        metadata: {
          ...mergedMetadata,
          lastUnsubscribeReason: context?.reason ?? (mergedMetadata as Record<string, any>).lastUnsubscribeReason ?? null,
        },
      })
      .where(eq(newsletterSubscribers.id, subscriber.id));

    return true;
  }

  async confirmNewsletterSubscription(email: string, token: string): Promise<boolean> {
    const sanitizedEmail = email.toLowerCase();
    const [subscriber] = await this.db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, sanitizedEmail));

    if (!subscriber || !subscriber.confirmationToken || subscriber.confirmationToken !== token) {
      return false;
    }

    const now = new Date();

    await this.db
      .update(newsletterSubscribers)
      .set({
        confirmationToken: null,
        confirmedAt: now,
        isActive: true,
        lastActivityAt: now,
        metadata: {
          ...(subscriber.metadata ?? {}),
          confirmedAt: now.toISOString(),
        },
      })
      .where(eq(newsletterSubscribers.id, subscriber.id));

    return true;
  }

  async getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
    return await this.db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.subscribedAt));
  }

  async getActiveNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
    return await this.db
      .select()
      .from(newsletterSubscribers)
      .where(and(
        eq(newsletterSubscribers.isActive, true),
        sql`${newsletterSubscribers.confirmedAt} IS NOT NULL`
      ));
  }

  async getNewsletterStatistics(): Promise<{
    total: number;
    active: number;
    confirmed: number;
    unsubscribed: number;
    byCountry: { country: string; count: number }[];
    campaignsSent: number;
    lastSentAt: Date | null;
    // Derived fields (computed at runtime, not stored in DB)
    campaignsByStatus?: Record<string, number>;
    recentFailures?: any[];
  }> {
    const subscribers = await this.db.select().from(newsletterSubscribers);

    const total = subscribers.length;
    const active = subscribers.filter((s) => s.isActive).length;
    const confirmed = subscribers.filter((s) => !!s.confirmedAt).length;
    const unsubscribed = total - active;

    const countryCounts = new Map<string, number>();
    for (const subscriber of subscribers) {
      const country = subscriber.country || 'Unknown';
      countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }

    const byCountry = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const campaigns = await this.db
      .select({
        id: newsletterCampaigns.id,
        status: newsletterCampaigns.status,
        sentAt: newsletterCampaigns.sentAt,
      })
      .from(newsletterCampaigns);

    const campaignsByStatus = campaigns.reduce<Record<string, number>>((acc, campaign) => {
      const status = campaign.status || 'draft';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const campaignsSent = (campaignsByStatus['sent'] ?? 0) + (campaignsByStatus['partial'] ?? 0);

    const lastSentAt = campaigns
      .filter((campaign) => campaign.status === 'sent' || campaign.status === 'partial')
      .map((campaign) => campaign.sentAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => (b?.getTime?.() ?? 0) - (a?.getTime?.() ?? 0))[0] ?? null;

    const recentFailures = await this.db
      .select({
        campaignId: newsletterDeliveries.campaignId,
        email: newsletterDeliveries.email,
        error: newsletterDeliveries.error,
        sentAt: newsletterDeliveries.sentAt,
      })
      .from(newsletterDeliveries)
      .where(eq(newsletterDeliveries.status, 'failed'))
      .orderBy(desc(newsletterDeliveries.sentAt))
      .limit(10);

    return {
      total,
      active,
      confirmed,
      unsubscribed,
      byCountry,
      campaignsSent,
      lastSentAt,
      campaignsByStatus,
      recentFailures,
    };
  }

  async createNewsletterCampaign(campaign: (InsertNewsletterCampaign & { status?: string })): Promise<NewsletterCampaign> {
    const payload = {
      ...campaign,
      status: campaign.status ?? 'draft',
      metrics: (campaign as any).metrics ?? {},
    };

    const [created] = await this.db
      .insert(newsletterCampaigns)
      .values(payload)
      .returning();

    return created;
  }

  async markNewsletterCampaignSent(campaignId: number, data: Partial<NewsletterCampaign>): Promise<NewsletterCampaign | undefined> {
    const [updated] = await this.db
      .update(newsletterCampaigns)
      .set({
        ...data,
        status: data.status ?? 'sent',
        sentAt: data.sentAt ?? new Date(),
      })
      .where(eq(newsletterCampaigns.id, campaignId))
      .returning();

    return updated;
  }

  async getNewsletterCampaigns(limit = 20): Promise<NewsletterCampaign[]> {
    return await this.db
      .select()
      .from(newsletterCampaigns)
      .orderBy(desc(newsletterCampaigns.createdAt))
      .limit(limit);
  }

  async logNewsletterDelivery(delivery: InsertNewsletterDelivery): Promise<NewsletterDelivery> {
    const [created] = await this.db
      .insert(newsletterDeliveries)
      .values(delivery)
      .returning();

    return created;
  }

  // Project operations
  async getProject(id: string | number): Promise<Project | undefined> {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, String(id)));
    return project;
  }

  async getProjectsByUser(userId: string | number): Promise<Project[]> {
    return await this.db.select().from(projects).where(eq(projects.userId, String(userId)));
  }

  async getProjectEnvVars(projectId: string): Promise<any[]> {
    return await this.db.select().from(projectEnvVars).where(eq(projectEnvVars.projectId, projectId));
  }

  async getProjectEnvVar(id: string): Promise<any | undefined> {
    const [ev] = await this.db.select().from(projectEnvVars).where(eq(projectEnvVars.id, id));
    return ev;
  }

  async createProjectEnvVar(projectId: string, key: string, value: string): Promise<any> {
    const [ev] = await this.db.insert(projectEnvVars).values({ projectId, key, encryptedValue: value }).returning();
    return ev;
  }

  async updateProjectEnvVar(id: string, value: string): Promise<any | undefined> {
    const [ev] = await this.db.update(projectEnvVars).set({ encryptedValue: value }).where(eq(projectEnvVars.id, id)).returning();
    return ev;
  }

  async deleteProjectEnvVar(id: string): Promise<boolean> {
    const result = await this.db.delete(projectEnvVars).where(eq(projectEnvVars.id, id));
    return true;
  }

  // Alias for backward compatibility
  async getProjectsByUserId(userId: string | number): Promise<Project[]> {
    return this.getProjectsByUser(userId);
  }

  async getProjectsByUserIdPaginated(userId: string | number, limit: number, offset: number): Promise<{ projects: Project[]; total: number }> {
    const uid = String(userId);
    const [projectsList, countResult] = await Promise.all([
      this.db
        .select()
        .from(projects)
        .where(eq(projects.userId, uid))
        .orderBy(desc(projects.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.userId, uid))
    ]);
    
    return {
      projects: projectsList,
      total: countResult[0]?.count ?? 0
    };
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProjectBySlug(slug: string, ownerId?: string | number): Promise<Project | null> {
    try {
      const condition =
        ownerId !== undefined
          ? and(eq(projects.slug, slug), eq(projects.userId, String(ownerId)))
          : eq(projects.slug, slug);

      const result = await this.db
        .select()
        .from(projects)
        .where(condition)
        .limit(1);

      return result[0] || null;
    } catch (error) {
      return null;
    }
  }



  async createProject(projectData: any): Promise<Project> {
    const values: Record<string, any> = {
      name: projectData.name || "Untitled Project",
      userId: projectData.userId || projectData.ownerId,
      language: projectData.language || "javascript",
      projectType: projectData.projectType || "web-app",
      outputType: projectData.outputType || "web",
      visibility: projectData.visibility || "public",
    };
    if (projectData.description) values.description = projectData.description;
    if (projectData.teamId) values.teamId = projectData.teamId;

    const [project] = await this.db.insert(projects).values(values).returning();
    return project;
  }

  async updateProject(id: string | number, projectData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await this.db
      .update(projects)
      .set({ ...projectData, updatedAt: new Date() })
      .where(eq(projects.id, _num(id)))
      .returning();
    return project;
  }

  async deleteProject(id: string | number): Promise<boolean> {
    const result = await this.db.delete(projects).where(eq(projects.id, _num(id)));
    return result.length > 0;
  }

  async incrementProjectViews(id: string | number): Promise<void> {
    await this.db
      .update(projects)
      .set({ views: sql`${projects.views} + 1` })
      .where(eq(projects.id, _num(id)));
  }

  // File operations
  async getFile(id: number): Promise<File | undefined> {
    const [file] = await this.db.select().from(files).where(eq(files.id, _num(id)));
    return file;
  }

  async getFilesByProjectId(projectId: string | number): Promise<File[]> {
    return await this.db.select().from(files).where(eq(files.projectId, String(projectId))).orderBy(files.filename);
  }

  async getFilesByProject(projectId: string | number): Promise<File[]> {
    return this.getFilesByProjectId(projectId); // Alias for compatibility
  }

  async getFileByPath(projectId: string | number, path: string): Promise<File | undefined> {
    const filename = path.includes("/") ? path.split("/").pop()! : path;
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.projectId, String(projectId)), eq(files.filename, filename)))
      .limit(1);
    return file;
  }

  async createFile(data: { projectId: string | number; path?: string; filename?: string; name?: string; content: string }): Promise<File>;
  async createFile(projectId: string, data: any): Promise<File>;
  async createFile(fileData: InsertFile & { projectId?: string | number }): Promise<File>;
  async createFile(
    fileDataOrProjectId: any,
    maybeData?: any
  ): Promise<File> {
    let fileData: any;
    if (typeof fileDataOrProjectId === 'string' && maybeData && typeof maybeData === 'object') {
      fileData = { ...maybeData, projectId: fileDataOrProjectId };
    } else {
      fileData = fileDataOrProjectId;
    }
    const filename = fileData.filename || fileData.name || (fileData.path ? fileData.path.split("/").pop() : "untitled");
    const projectId = String(fileData.projectId);

    const [file] = await this.db.insert(files).values({
      projectId,
      filename,
      content: fileData.content ?? "",
      isBinary: fileData.isBinary ?? false,
      mimeType: fileData.mimeType ?? null,
      artifactId: fileData.artifactId ?? null,
    }).returning();
    return file;
  }

  async updateFile(id: number, data: { content: string }): Promise<void>;
  async updateFile(id: number, fileData: Partial<InsertFile>): Promise<File | undefined>;
  async updateFile(
    id: number,
    fileData: { content: string } | Partial<InsertFile>
  ): Promise<void | (File | undefined)> {
    const update: Partial<InsertFile> = "content" in fileData && Object.keys(fileData).length === 1
      ? { content: fileData.content }
      : { ...fileData };

    const [file] = await this.db
      .update(files)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(files.id, _num(id)))
      .returning();

    if ("content" in fileData && Object.keys(fileData).length === 1) {
      return;
    }

    return file;
  }

  async deleteFile(id: number): Promise<boolean> {
    const result = await this.db.delete(files).where(eq(files.id, _num(id)));
    return result.length > 0;
  }

  // API Key operations
  async createApiKey(apiKeyData: InsertApiKey): Promise<ApiKey> {
    const values = {
      ...apiKeyData,
      permissions: normalizeStringArray(apiKeyData.permissions, []),
    } satisfies InsertApiKey;

    const [apiKey] = await this.db.insert(apiKeys).values(values).returning();
    return apiKey;
  }

  async getUserApiKeys(userId: string | number): Promise<ApiKey[]> {
    return await this.db.select().from(apiKeys).where(eq(apiKeys.userId, _num(userId))).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: number): Promise<ApiKey | undefined> {
    const [apiKey] = await this.db.select().from(apiKeys).where(eq(apiKeys.id, _num(id)));
    return apiKey;
  }

  async updateApiKey(id: number, apiKeyData: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const baseUpdate = apiKeyData as Partial<ApiKeyInsertModel>;
    const updateData: Partial<ApiKeyInsertModel> = {
      ...baseUpdate,
      ...(apiKeyData.permissions !== undefined
        ? {
            permissions: normalizeStringArray(apiKeyData.permissions, []) as ApiKeyInsertModel["permissions"],
          }
        : {}),
    };

    const [apiKey] = await this.db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, _num(id)))
      .returning();
    return apiKey;
  }

  async deleteApiKey(id: number): Promise<boolean> {
    const result = await this.db.delete(apiKeys).where(eq(apiKeys.id, _num(id)));
    return result.length > 0;
  }

  async getApiKeys(): Promise<AdminApiKey[]> {
    return await this.db.select().from(adminApiKeys).orderBy(desc(adminApiKeys.createdAt));
  }

  async getApiKeyByProvider(provider: string): Promise<AdminApiKey | undefined> {
    const [key] = await this.db.select().from(adminApiKeys)
      .where(and(eq(adminApiKeys.provider, provider), eq(adminApiKeys.isActive, true)))
      .orderBy(desc(adminApiKeys.createdAt))
      .limit(1);
    return key;
  }

  // Code Review operations
  async createCodeReview(reviewData: InsertCodeReview): Promise<CodeReview> {
    const values = {
      ...reviewData,
      filesChanged: normalizeStringArray(reviewData.filesChanged, []),
    } satisfies InsertCodeReview;

    const [review] = await this.db.insert(codeReviews).values(values).returning();
    return review;
  }

  async getCodeReview(id: number): Promise<CodeReview | undefined> {
    const [review] = await this.db.select().from(codeReviews).where(eq(codeReviews.id, _num(id)));
    return review;
  }

  async getProjectCodeReviews(projectId: string | number): Promise<CodeReview[]> {
    return await this.db.select().from(codeReviews).where(eq(codeReviews.projectId, _num(projectId))).orderBy(desc(codeReviews.createdAt));
  }

  async updateCodeReview(id: number, reviewData: Partial<InsertCodeReview>): Promise<CodeReview | undefined> {
    const baseReview = reviewData as Partial<CodeReviewInsertModel>;
    const reviewUpdate: Partial<CodeReviewInsertModel> = {
      ...baseReview,
      ...(reviewData.filesChanged !== undefined
        ? {
            filesChanged: normalizeStringArray(reviewData.filesChanged, []) as CodeReviewInsertModel["filesChanged"],
          }
        : {}),
    };

    const [review] = await this.db
      .update(codeReviews)
      .set(reviewUpdate)
      .where(eq(codeReviews.id, _num(id)))
      .returning();
    return review;
  }

  // Challenge operations
  async createChallenge(challengeData: InsertChallenge): Promise<Challenge> {
    const challengeValues = {
      ...challengeData,
      tags: normalizeStringArray(challengeData.tags, []),
      testCases: Array.isArray(challengeData.testCases)
        ? [...challengeData.testCases]
        : [],
    } satisfies InsertChallenge;

    const [challenge] = await this.db.insert(challenges).values(challengeValues).returning();
    return challenge;
  }

  async getChallenge(id: number): Promise<Challenge | undefined> {
    const [challenge] = await this.db.select().from(challenges).where(eq(challenges.id, _num(id)));
    return challenge;
  }

  async getChallengesByCategory(category: string): Promise<Challenge[]> {
    return await this.db.select().from(challenges).where(eq(challenges.category, category)).orderBy(desc(challenges.createdAt));
  }

  async updateChallenge(id: number, challengeData: Partial<InsertChallenge>): Promise<Challenge | undefined> {
    const baseChallenge = challengeData as Partial<ChallengeInsertModel>;
    const challengeUpdate: Partial<ChallengeInsertModel> = {
      ...baseChallenge,
      ...(challengeData.tags !== undefined
        ? { tags: normalizeStringArray(challengeData.tags, []) as ChallengeInsertModel["tags"] }
        : {}),
      updatedAt: new Date(),
    };

    const [challenge] = await this.db
      .update(challenges)
      .set(challengeUpdate)
      .where(eq(challenges.id, _num(id)))
      .returning();
    return challenge;
  }

  // Mentorship operations
  async createMentorProfile(profileData: InsertMentorProfile): Promise<MentorProfile> {
    const profileValues = {
      ...profileData,
      expertise: normalizeStringArray(profileData.expertise, []),
      availability:
        profileData.availability && typeof profileData.availability === "object"
          ? { ...profileData.availability }
          : {},
    } satisfies InsertMentorProfile;

    const [profile] = await this.db.insert(mentorProfiles).values(profileValues).returning();
    return profile;
  }

  async getMentorProfile(userId: string | number): Promise<MentorProfile | undefined> {
    const [profile] = await this.db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, _num(userId)));
    return profile;
  }

  async updateMentorProfile(userId: string | number, profileData: Partial<InsertMentorProfile>): Promise<MentorProfile | undefined> {
    const baseMentor = profileData as Partial<MentorProfileInsertModel>;
    const mentorUpdate: Partial<MentorProfileInsertModel> = {
      ...baseMentor,
      ...(profileData.expertise !== undefined
        ? {
            expertise: normalizeStringArray(profileData.expertise, []) as MentorProfileInsertModel["expertise"],
          }
        : {}),
      ...(profileData.availability !== undefined
        ? {
            availability:
              profileData.availability && typeof profileData.availability === "object"
                ? { ...profileData.availability }
                : {},
          }
        : {}),
    };

    const [profile] = await this.db
      .update(mentorProfiles)
      .set(mentorUpdate)
      .where(eq(mentorProfiles.userId, _num(userId)))
      .returning();
    return profile;
  }

  // Template operations
  async getAllTemplates(publishedOnly?: boolean): Promise<Template[]> {
    const query = publishedOnly
      ? this.db.select().from(templates).where(eq(templates.published, true))
      : this.db.select().from(templates);

    return await query;
  }

  async getTemplateBySlug(slug: string): Promise<Template | undefined> {
    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.slug, slug))
      .limit(1);
    return template;
  }

  async createTemplate(templateData: InsertTemplate): Promise<Template> {
    const [template] = await this.db
      .insert(templates)
      .values(templateData)
      .returning();
    return template;
  }

  async updateTemplate(id: string | number, templateData: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [template] = await this.db
      .update(templates)
      .set({
        ...templateData,
        updatedAt: new Date()
      })
      .where(eq(templates.id, _num(id)))
      .returning();
    return template;
  }

  async deleteTemplate(id: string | number): Promise<boolean> {
    const result = await this.db
      .delete(templates)
      .where(eq(templates.id, _num(id)))
      .returning();
    return result.length > 0;
  }

  async seedTemplates(): Promise<void> {
    // Check if templates already exist
    const existingTemplates = await this.db.select().from(templates).limit(1);
    if (existingTemplates.length > 0) {
      // Templates already seeded, skipping...
      return;
    }

    const templateSeeds: any[] = [
      {
        slug: 'nextjs-blog',
        name: 'Next.js Blog',
        description: 'A modern blog with Next.js and Tailwind CSS',
        category: 'web',
        tags: ['nextjs', 'react', 'blog', 'tailwind'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 1250,
        stars: 89,
        forks: 23,
        language: 'javascript',
        framework: 'nextjs',
        difficulty: 'beginner',
        estimatedTime: 30,
        features: ['SEO optimized', 'Dark mode', 'Markdown support', 'RSS feed'],
        isFeatured: true,
        isOfficial: true,
        published: true
      },
      {
        slug: 'react-dashboard',
        name: 'React Admin Dashboard',
        description: 'Professional admin dashboard with charts and analytics',
        category: 'web',
        tags: ['react', 'dashboard', 'admin', 'charts'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 2100,
        stars: 156,
        forks: 45,
        language: 'javascript',
        framework: 'react',
        difficulty: 'intermediate',
        estimatedTime: 45,
        features: ['Charts', 'Tables', 'Authentication', 'Responsive'],
        isFeatured: true,
        isOfficial: true,
        published: true
      },
      {
        slug: 'express-api',
        name: 'Express REST API',
        description: 'RESTful API with Express.js and MongoDB',
        category: 'backend',
        tags: ['express', 'nodejs', 'api', 'rest', 'mongodb'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 1500,
        stars: 98,
        forks: 32,
        language: 'javascript',
        framework: 'express',
        difficulty: 'intermediate',
        estimatedTime: 35,
        features: ['JWT Auth', 'MongoDB', 'Rate limiting', 'API documentation'],
        isFeatured: false,
        isOfficial: true,
        published: true
      },
      {
        slug: 'nodejs-api',
        name: 'Node.js API Server',
        description: 'Simple API server with Node.js and PostgreSQL',
        category: 'backend',
        tags: ['nodejs', 'api', 'postgresql', 'backend'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 980,
        stars: 67,
        forks: 28,
        language: 'javascript',
        framework: 'nodejs',
        difficulty: 'beginner',
        estimatedTime: 25,
        features: ['Database integration', 'CRUD operations', 'Error handling', 'Logging'],
        isFeatured: false,
        isOfficial: true,
        published: true
      },
      {
        slug: 'python-flask',
        name: 'Python Flask App',
        description: 'Web application with Flask and SQLAlchemy',
        category: 'backend',
        tags: ['python', 'flask', 'sqlalchemy', 'web'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 1800,
        stars: 120,
        forks: 34,
        language: 'python',
        framework: 'flask',
        difficulty: 'intermediate',
        estimatedTime: 40,
        features: ['User authentication', 'Database ORM', 'Templates', 'Forms'],
        isFeatured: true,
        isOfficial: true,
        published: true
      },
      {
        slug: 'vuejs-app',
        name: 'Vue.js Application',
        description: 'Modern SPA with Vue 3 and Composition API',
        category: 'web',
        tags: ['vuejs', 'vue3', 'spa', 'frontend'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 750,
        stars: 54,
        forks: 19,
        language: 'javascript',
        framework: 'vuejs',
        difficulty: 'intermediate',
        estimatedTime: 35,
        features: ['Vue Router', 'Vuex store', 'Composition API', 'TypeScript support'],
        isFeatured: false,
        isOfficial: true,
        published: true
      },
      {
        slug: 'discord-bot',
        name: 'Discord Bot',
        description: 'Feature-rich Discord bot with commands and events',
        category: 'bot',
        tags: ['discord', 'bot', 'nodejs', 'discord.js'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 2300,
        stars: 189,
        forks: 67,
        language: 'javascript',
        framework: 'discord.js',
        difficulty: 'beginner',
        estimatedTime: 20,
        features: ['Slash commands', 'Event handlers', 'Moderation tools', 'Music player'],
        isFeatured: true,
        isOfficial: true,
        published: true
      },
      {
        slug: 'phaser-game',
        name: 'Phaser Game',
        description: '2D browser game with Phaser.js framework',
        category: 'game',
        tags: ['phaser', 'game', 'javascript', '2d'],
        authorName: 'E-Code',
        authorVerified: true,
        uses: 620,
        stars: 43,
        forks: 15,
        language: 'javascript',
        framework: 'phaser',
        difficulty: 'advanced',
        estimatedTime: 60,
        features: ['Physics engine', 'Sprite animations', 'Sound effects', 'Level system'],
        isFeatured: false,
        isOfficial: true,
        published: true
      }
    ];

    // Seeding templates...
    for (const templateData of templateSeeds) {
      try {
        await this.db.insert(templates).values(templateData);
        // ✓ Seeded template
      } catch (error) {
        // Error seeding template
      }
    }
    // ✓ Templates seeding completed
  }

  async createLoginHistory(history: any): Promise<any> {
    // Simple implementation - just log for now since we don't have a login_history table
    // Login attempt logged
    return { id: Date.now(), ...history };
  }

  // Admin API Key operations (for centralized AI services)
  async getActiveAdminApiKey(provider: string): Promise<any> {
    // For now, return the environment variables as admin keys
    const envKeyMap: Record<string, string> = {
      'openai': 'OPENAI_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'gemini': 'GEMINI_API_KEY',
      'xai': 'XAI_API_KEY',
      'perplexity': 'PERPLEXITY_API_KEY',
      'mixtral': 'MIXTRAL_API_KEY',
      'llama': 'LLAMA_API_KEY',
      'cohere': 'COHERE_API_KEY',
      'deepseek': 'DEEPSEEK_API_KEY',
      'mistral': 'MISTRAL_API_KEY'
    };

    const envKey = envKeyMap[provider];
    if (envKey && process.env[envKey]) {
      return {
        provider,
        apiKey: process.env[envKey],
        isActive: true
      };
    }

    return null;
  }

  async trackAIUsage(userId: string | number, tokens: number, mode: string): Promise<void> {
    // For now, just log the usage
    // AI usage tracked for user
  }

  async createAiUsageRecord(record: any): Promise<any> {
    // For now, just log and return the record
    // AI usage record created
    return { id: Date.now(), ...record, createdAt: new Date() };
  }

  async updateUserAiTokens(userId: string | number, tokensUsed: number): Promise<void> {
    // For now, just log the token usage
    // Updated AI tokens for user
  }

  // Agent Session operations (for admin monitoring)
  async getActiveAgentSessions(): Promise<any[]> {
    try {
      const sessions = await this.db
        .select({
          id: agentSessions.id,
          userId: agentSessions.userId,
          projectId: agentSessions.projectId,
          model: agentSessions.model,
          isActive: agentSessions.isActive,
          totalTokensUsed: agentSessions.totalTokensUsed,
          totalOperations: agentSessions.totalOperations,
          autonomousMode: agentSessions.autonomousMode,
          workflowStatus: agentSessions.workflowStatus,
          startedAt: agentSessions.startedAt,
          endedAt: agentSessions.endedAt,
        })
        .from(agentSessions)
        .where(eq(agentSessions.isActive, true))
        .orderBy(desc(agentSessions.startedAt));
      
      // Enrich with user and project info
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          const user = await this.getUser(session.userId);
          const project = session.projectId ? await this.getProject(String(session.projectId)) : null;
          return {
            ...session,
            userEmail: user?.email,
            username: user?.username,
            projectName: project?.name,
            projectSlug: project?.slug,
          };
        })
      );
      
      return enrichedSessions;
    } catch (error) {
      console.error('Error fetching active agent sessions:', error);
      return [];
    }
  }

  async terminateAgentSession(sessionId: string, data: { terminatedBy: number; reason: string }): Promise<void> {
    try {
      await this.db
        .update(agentSessions)
        .set({
          isActive: false,
          endedAt: new Date(),
          metadata: sql`COALESCE(${agentSessions.metadata}, '{}')::jsonb || ${JSON.stringify({
            terminatedBy: data.terminatedBy,
            terminationReason: data.reason,
            terminatedAt: new Date().toISOString()
          })}::jsonb`
        })
        .where(eq(agentSessions.id, sessionId));
    } catch (error) {
      console.error('Error terminating agent session:', error);
      throw error;
    }
  }

  // Deployment operations
  async createDeployment(deploymentData: InsertDeployment): Promise<Deployment> {
    const [deployment] = await this.db.insert(deployments).values(deploymentData).returning();
    return deployment;
  }

  async getDeployments(projectId: string | number): Promise<Deployment[]> {
    return await this.db.select().from(deployments).where(eq(deployments.projectId, _num(projectId)));
  }

  async updateDeployment(deploymentIdOrNumber: number | string, updates: Partial<InsertDeployment>): Promise<Deployment | undefined> {
    let deployment;

    if (typeof deploymentIdOrNumber === 'number') {
      deployment = await this.db.select().from(deployments).where(eq(deployments.id, deploymentIdOrNumber)).limit(1).then(rows => rows[0]);
    } else {
      deployment = await this.db.select().from(deployments).where(eq(deployments.deploymentId, deploymentIdOrNumber)).limit(1).then(rows => rows[0]);
    }

    if (!deployment) {
      return undefined;
    }

    const [updated] = await this.db
      .update(deployments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deployments.id, deployment.id))
      .returning();
    return updated;
  }

  async listDeployments(): Promise<Deployment[]> {
    return await this.db.select().from(deployments);
  }

  async getDeploymentByExternalId(deploymentId: string): Promise<Deployment | undefined> {
    const [deployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.deploymentId, deploymentId));
    return deployment;
  }

  async updateDeploymentStatus(id: number, updates: { status: string; lastDeployedAt?: Date }): Promise<void> {
    await this.db
      .update(deployments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deployments.id, _num(id)));
  }

  async getProjectDeployments(projectId: string | number): Promise<Deployment[]> {
    return await this.db.select().from(deployments).where(eq(deployments.projectId, _num(projectId)));
  }

  async getRecentDeployments(userId: string | number): Promise<Deployment[]> {
    const userProjects = await this.getProjectsByUser(userId);
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length === 0) return [];

    return await this.db
      .select()
      .from(deployments)
      .where(sql`${deployments.projectId} = ANY(${projectIds})`)
      .orderBy(desc(deployments.createdAt))
      .limit(10);
  }

  // Audit log operations
  async getAuditLogs(filters: { userId: string | number; action?: string; dateRange?: string }): Promise<any[]> {
    // For now, return empty array - in production, this would query an audit logs table
    return [];
  }

  // Storage operations - using objectStorageBuckets table
  async getStorageBuckets(): Promise<any[]> {
    const buckets = await this.db
      .select()
      .from(objectStorageBuckets)
      .orderBy(desc(objectStorageBuckets.createdAt));
    
    // Get file counts and sizes for each bucket
    const bucketsWithStats = await Promise.all(buckets.map(async (bucket) => {
      const files = await this.db
        .select()
        .from(objectStorageFiles)
        .where(eq(objectStorageFiles.bucketId, bucket.id));
      
      return {
        id: bucket.id,
        name: bucket.bucketName,
        region: bucket.region,
        created: bucket.createdAt,
        isPublic: bucket.publicAccess ?? false,
        objectCount: files.length,
        totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
        storageClass: bucket.storageClass,
        corsEnabled: bucket.corsEnabled,
        metadata: bucket.metadata,
      };
    }));
    
    return bucketsWithStats;
  }

  async createStorageBucket(bucket: { projectId: string | number; name: string; region: string; isPublic: boolean }): Promise<any> {
    const [newBucket] = await this.db
      .insert(objectStorageBuckets)
      .values({
        projectId: parseInt(bucket.projectId),
        bucketName: bucket.name,
        region: bucket.region,
        publicAccess: bucket.isPublic,
        storageClass: 'STANDARD',
        corsEnabled: true,
        metadata: {},
      })
      .returning();
    
    return {
      id: newBucket.id,
      name: newBucket.bucketName,
      region: newBucket.region,
      created: newBucket.createdAt,
      isPublic: newBucket.publicAccess ?? false,
      objectCount: 0,
      totalSize: 0,
      storageClass: newBucket.storageClass,
      corsEnabled: newBucket.corsEnabled,
    };
  }

  async getProjectStorageBuckets(projectId: string | number): Promise<any[]> {
    const buckets = await this.db
      .select()
      .from(objectStorageBuckets)
      .where(eq(objectStorageBuckets.projectId, _num(projectId)))
      .orderBy(desc(objectStorageBuckets.createdAt));
    
    // Get file counts and sizes for each bucket
    const bucketsWithStats = await Promise.all(buckets.map(async (bucket) => {
      const files = await this.db
        .select()
        .from(objectStorageFiles)
        .where(eq(objectStorageFiles.bucketId, bucket.id));
      
      return {
        id: bucket.id,
        name: bucket.bucketName,
        region: bucket.region,
        created: bucket.createdAt,
        isPublic: bucket.publicAccess ?? false,
        objectCount: files.length,
        totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
        storageClass: bucket.storageClass,
        corsEnabled: bucket.corsEnabled,
        metadata: bucket.metadata,
      };
    }));
    
    return bucketsWithStats;
  }

  async getStorageObjects(bucketId: string): Promise<any[]> {
    const files = await this.db
      .select()
      .from(objectStorageFiles)
      .where(eq(objectStorageFiles.bucketId, parseInt(bucketId)))
      .orderBy(desc(objectStorageFiles.uploadedAt));
    
    return files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
      contentType: file.contentType,
      size: file.size,
      url: file.url,
      uploadedAt: file.uploadedAt,
      metadata: file.metadata,
    }));
  }

  async deleteStorageObject(bucketId: string, objectKey: string): Promise<void> {
    await this.db
      .delete(objectStorageFiles)
      .where(and(
        eq(objectStorageFiles.bucketId, parseInt(bucketId)),
        eq(objectStorageFiles.filePath, objectKey)
      ));
  }

  // Team operations
  async getUserTeams(userId: string | number): Promise<any[]> {
    const userTeams = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        description: teams.description,
        // logo: teams.logo, // Field doesn't exist in schema
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, _num(userId)));

    return userTeams;
  }

  // Theme operations
  async getUserThemeSettings(userId: string | number): Promise<any> {
    // In production, query user_theme_settings table
    return {
      theme: 'dark',
      accentColor: '#0066cc',
      fontSize: 'medium',
      fontFamily: 'system'
    };
  }

  async updateUserThemeSettings(userId: string | number, settings: any): Promise<any> {
    // In production, update user_theme_settings table
    return settings;
  }

  async getInstalledThemes(userId: string | number): Promise<any[]> {
    // In production, query user_installed_themes table
    return [
      { id: 'dark', name: 'Dark', installed: true },
      { id: 'light', name: 'Light', installed: true }
    ];
  }

  async installTheme(userId: string | number, themeId: string): Promise<void> {
    // In production, insert into user_installed_themes table
    // Installing theme for user
  }

  async uninstallTheme(userId: string | number, themeId: string): Promise<void> {
    // In production, delete from user_installed_themes table
    // Uninstalling theme for user
  }

  async createCustomTheme(userId: string | number, theme: any): Promise<any> {
    // In production, insert into custom_themes table
    return {
      id: `custom-${Date.now()}`,
      ...theme,
      createdBy: userId,
      createdAt: new Date()
    };
  }

  // Comments operations
  async createComment(comment: InsertComment): Promise<Comment> {
    // Map authorId field if it exists in the input
    const commentData = { ...comment };
    if ('authorId' in commentData && !('userId' in commentData)) {
      // @ts-expect-error - handling schema mismatch
      commentData.authorId = commentData.authorId || commentData.userId;
    }
    const [newComment] = await this.db.insert(comments).values(commentData).returning();
    return newComment;
  }

  async getProjectComments(projectId: string | number): Promise<Comment[]> {
    return await this.db.select().from(comments).where(eq(comments.projectId, _num(projectId))).orderBy(desc(comments.createdAt));
  }

  async getFileComments(fileId: number): Promise<Comment[] > {
    return await this.db.select().from(comments).where(eq(comments.fileId, fileId)).orderBy(desc(comments.createdAt));
  }

  async updateComment(id: number, comment: Partial<InsertComment>): Promise<Comment | undefined> {
    const [updated] = await this.db.update(comments).set({ ...comment, updatedAt: new Date() }).where(eq(comments.id, _num(id))).returning();
    return updated;
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await this.db.delete(comments).where(eq(comments.id, _num(id)));
    return result.length > 0;
  }

  // Checkpoints operations
  async createCheckpoint(checkpoint: any): Promise<Checkpoint> {
    const filesSnapshot = await this.getFilesByProjectId(checkpoint.projectId);
    const [newCheckpoint] = await this.db.insert(checkpoints).values({
      ...checkpoint,
      // Store files snapshot in metadata field instead
    }).returning();
    return newCheckpoint;
  }

  async getProjectCheckpoints(projectId: string | number): Promise<Checkpoint[]> {
    return await this.db.select().from(checkpoints).where(eq(checkpoints.projectId, _num(projectId))).orderBy(desc(checkpoints.createdAt));
  }

  // Agent operations
  async getAgentWorkSteps(projectId: string | number, sessionId: string): Promise<any[]> {
    // For now, return empty array as we don't have a dedicated table for work steps
    // In a real implementation, this would query a work_steps table
    return [];
  }

  async createAgentCheckpoint(checkpoint: {
    projectId: string | number;
    userId: string | number;
    message: string;
    changes: number;
    sessionId: string;
    timestamp: Date;
  }): Promise<any> {
    // Create a checkpoint using the existing checkpoint system
    const newCheckpoint = await this.createCheckpoint({
      projectId: checkpoint.projectId,
      userId: checkpoint.userId,
      message: checkpoint.message,
      metadata: {
        changes: checkpoint.changes,
        sessionId: checkpoint.sessionId,
        agentCheckpoint: true
      }
    });
    return newCheckpoint;
  }

  async getCheckpoint(id: number): Promise<Checkpoint | undefined> {
    const [checkpoint] = await this.db.select().from(checkpoints).where(eq(checkpoints.id, _num(id)));
    return checkpoint;
  }

  async restoreCheckpoint(checkpointId: number): Promise<boolean> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) return false;

    // Restore files from snapshot
    const filesSnapshot = checkpoint.metadata as any; // Use metadata field instead of filesSnapshot
    for (const file of filesSnapshot) {
      await this.updateFile(file.id, { content: file.content });
    }
    return true;
  }

  // Time tracking operations
  async startTimeTracking(tracking: InsertTimeTracking): Promise<TimeTracking> {
    const [newTracking] = await this.db.insert(projectTimeTracking).values(tracking).returning();
    return newTracking;
  }

  async stopTimeTracking(trackingId: number): Promise<TimeTracking | undefined> {
    const now = new Date();
    const [tracking] = await this.db.select().from(projectTimeTracking).where(eq(projectTimeTracking.id, trackingId));
    if (!tracking) return undefined;

    const duration = Math.floor((now.getTime() - tracking.startTime.getTime()) / 1000);
    const [updated] = await this.db.update(projectTimeTracking)
      .set({ endTime: now, duration, active: false })
      .where(eq(projectTimeTracking.id, trackingId))
      .returning();
    return updated;
  }

  async getActiveTimeTracking(projectId: string | number, userId: string | number): Promise<TimeTracking | undefined> {
    const [tracking] = await this.db.select().from(projectTimeTracking)
      .where(and(
        eq(projectTimeTracking.projectId, _num(projectId)),
        eq(projectTimeTracking.userId, _num(userId)),
        eq(projectTimeTracking.active, true)
      ));
    return tracking;
  }

  async getProjectTimeTracking(projectId: string | number): Promise<TimeTracking[]> {
    return await this.db.select().from(projectTimeTracking).where(eq(projectTimeTracking.projectId, _num(projectId))).orderBy(desc(projectTimeTracking.startTime));
  }

  // Screenshot operations
  async createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot> {
    const [newScreenshot] = await this.db.insert(projectScreenshots).values(screenshot).returning();
    return newScreenshot;
  }

  async getProjectScreenshots(projectId: string | number): Promise<Screenshot[]> {
    return await this.db.select().from(projectScreenshots).where(eq(projectScreenshots.projectId, _num(projectId))).orderBy(desc(projectScreenshots.createdAt));
  }

  async getScreenshot(id: number): Promise<Screenshot | undefined> {
    const [screenshot] = await this.db.select().from(projectScreenshots).where(eq(projectScreenshots.id, _num(id)));
    return screenshot;
  }

  async deleteScreenshot(id: number): Promise<boolean> {
    const result = await this.db.delete(projectScreenshots).where(eq(projectScreenshots.id, _num(id)));
    return result.length > 0;
  }

  // Task summary operations
  async createTaskSummary(summary: InsertTaskSummary): Promise<TaskSummary> {
    const [newSummary] = await this.db.insert(taskSummaries).values(summary).returning();
    return newSummary;
  }

  async getProjectTaskSummaries(projectId: string | number): Promise<TaskSummary[] > {
    return await this.db.select().from(taskSummaries).where(eq(taskSummaries.projectId, _num(projectId))).orderBy(desc(taskSummaries.createdAt));
  }

  async updateTaskSummary(id: number, summary: Partial<InsertTaskSummary>): Promise<TaskSummary | undefined> {
    const [updated] = await this.db.update(taskSummaries).set(summary).where(eq(taskSummaries.id, _num(id))).returning();
    return updated;
  }

  // Stripe operations
  async updateUserStripeInfo(userId: string | number, data: any): Promise<User | undefined>;
  async updateUserStripeInfo(
    userId: string | number,
    stripeData: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      stripePriceId?: string;
      subscriptionStatus?: string;
      subscriptionCurrentPeriodEnd?: Date;
    }
  ): Promise<User | undefined>;
  async updateUserStripeInfo(
    userId: string | number,
    stripeData: any
  ): Promise<User | undefined> {
    const updatePayload = {
      ...stripeData,
      updatedAt: new Date(),
    };

    const [updated] = await this.db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, _num(userId)))
      .returning();

    return updated;
  }

  async updateStripeCustomerId(userId: string | number, customerId: string): Promise<User | undefined> {
    const [updated] = await this.db.update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, _num(userId)))
      .returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  // Usage tracking operations
  async trackUsage(userId: string | number, data: UsageMetricInput): Promise<void>;
  async trackUsage(
    userId: string | number,
    eventType: string,
    quantity: number,
    metadata?: UsageMetricMetadata
  ): Promise<void>;
  async trackUsage(
    userId: string | number,
    arg2: UsageMetricInput | string,
    arg3?: number,
    arg4?: UsageMetricMetadata
  ): Promise<void> {
    const now = new Date();
    const defaultPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const metric: UsageMetricInput =
      typeof arg2 === "string"
        ? {
            metricType: arg2,
            value: arg3 ?? 0,
            unit: arg4?.unit ?? "request",
            billingPeriodStart: defaultPeriodStart,
            billingPeriodEnd: defaultPeriodEnd,
          }
        : {
            metricType: arg2.metricType,
            value: arg2.value,
            unit: arg2.unit,
            billingPeriodStart: arg2.billingPeriodStart ?? defaultPeriodStart,
            billingPeriodEnd: arg2.billingPeriodEnd ?? defaultPeriodEnd,
          };

    const billingPeriodStart = metric.billingPeriodStart ?? defaultPeriodStart;
    const billingPeriodEnd = metric.billingPeriodEnd ?? defaultPeriodEnd;

    await this.db.insert(usageTracking).values({
      userId: _num(userId),
      metricType: metric.metricType,
      value: typeof metric.value === "number" ? metric.value.toString() : metric.value,
      unit: metric.unit,
      billingPeriodStart,
      billingPeriodEnd,
    });
  }

  async getUsageStats(userId: string | number, startDate?: Date, endDate?: Date): Promise<any> {
    let query = eq(usageTracking.userId, _num(userId));

    if (startDate && endDate) {
      query = and(
        query,
        sql`${usageTracking.billingPeriodStart} >= ${startDate}`,
        sql`${usageTracking.billingPeriodEnd} <= ${endDate}`
      ) as any;
    }

    const results = await this.db.select({
      metricType: usageTracking.metricType,
      total: sql<number>`SUM(CAST(${usageTracking.value} AS NUMERIC))`,
      unit: usageTracking.unit,
      count: sql<number>`COUNT(*)`
    })
    .from(usageTracking)
    .where(query)
    .groupBy(usageTracking.metricType, usageTracking.unit);

    // Transform results into usage stats object
    const stats: any = {};
    results.forEach(row => {
      stats[row.metricType] = {
        total: parseFloat(row.total?.toString() || '0'),
        count: parseInt(row.count?.toString() || '0'),
        unit: row.unit
      };
    });

    return stats;
  }

  async getUserUsage(userId: string | number, billingPeriodStart?: Date): Promise<any> {
    const query = billingPeriodStart
      ? and(
          eq(usageTracking.userId, _num(userId)),
          eq(usageTracking.billingPeriodStart, billingPeriodStart)
        )
      : eq(usageTracking.userId, _num(userId));

    const results = await this.db.select({
      metricType: usageTracking.metricType,
      total: sql<number>`SUM(${usageTracking.value})`,
      unit: usageTracking.unit
    })
    .from(usageTracking)
    .where(query)
    .groupBy(usageTracking.metricType, usageTracking.unit);

    // Transform results into usage object
    const usage: any = {};
    results.forEach(row => {
      usage[row.metricType] = {
        used: parseFloat(row.total?.toString() || '0'),
        unit: row.unit
      };
    });

    return usage;
  }

  async getUsageHistory(userId: string | number, startDate: Date, endDate: Date, metricType?: string): Promise<any[]> {
    let query = and(
      eq(usageTracking.userId, _num(userId)),
      gte(usageTracking.timestamp, startDate),
      lte(usageTracking.timestamp, endDate)
    );

    if (metricType) {
      query = and(query, eq(usageTracking.metricType, metricType));
    }

    const results = await this.db.select()
      .from(usageTracking)
      .where(query)
      .orderBy(desc(usageTracking.timestamp));

    return results.map(row => ({
      id: row.id,
      metricType: row.metricType,
      value: parseFloat(row.value),
      unit: row.unit,
      timestamp: row.timestamp,
      billingPeriodStart: row.billingPeriodStart,
      billingPeriodEnd: row.billingPeriodEnd
    }));
  }

  async getUsageSummary(userId: string | number, period: string): Promise<any> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'current':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const results = await this.db.select({
      metricType: usageTracking.metricType,
      total: sql<number>`SUM(CAST(${usageTracking.value} AS NUMERIC))`,
      unit: usageTracking.unit,
      count: sql<number>`COUNT(*)`
    })
    .from(usageTracking)
    .where(and(
      eq(usageTracking.userId, _num(userId)),
      gte(usageTracking.timestamp, startDate),
      lte(usageTracking.timestamp, endDate)
    ))
    .groupBy(usageTracking.metricType, usageTracking.unit);

    // Transform results into summary object
    const summary: any = {};
    results.forEach(row => {
      summary[row.metricType] = parseFloat(row.total?.toString() || '0');
    });

    return summary;
  }

  // Project Imports
  async createProjectImport(data: any): Promise<any> {
    const [record] = await this.db.insert(projectImports).values({
      projectId: data.projectId,
      userId: data.userId,
      importType: data.importType || data.type,
      sourceUrl: data.sourceUrl || data.url,
      status: data.status || 'pending',
      metadata: data.metadata || null,
    }).returning();
    return record;
  }

  async updateProjectImport(id: number, updates: any): Promise<any> {
    const [record] = await this.db
      .update(projectImports)
      .set({
        ...updates,
        completedAt: updates.status === 'completed' ? new Date() : updates.completedAt,
      })
      .where(eq(projectImports.id, _num(id)))
      .returning();
    return record;
  }

  async getProjectImport(id: number): Promise<any | undefined> {
    const [record] = await this.db
      .select()
      .from(projectImports)
      .where(eq(projectImports.id, _num(id)));
    return record;
  }

  async getProjectImports(projectId: string | number): Promise<ProjectImport[]> {
    const records = await this.db
      .select()
      .from(projectImports)
      .where(eq(projectImports.projectId, _num(projectId)))
      .orderBy(desc(projectImports.createdAt));

    return records.map((record) => ({
      ...record,
      type: record.importType,
      url: record.sourceUrl,
    }));
  }



  async getImportStatistics(): Promise<any> {
    // Get real import statistics from database
    const stats = await this.db.select({
      importType: projectImports.importType,
      count: sql<number>`COUNT(*)`,
    })
    .from(projectImports)
    .groupBy(projectImports.importType);

    const recent = await this.db.select()
      .from(projectImports)
      .orderBy(desc(projectImports.createdAt))
      .limit(5);

    const result: Record<string, number> = {
      figma: 0,
      bolt: 0,
      lovable: 0,
      webContent: 0,
      total: 0,
    };

    stats.forEach(row => {
      result[row.importType] = Number(row.count);
      result.total += Number(row.count);
    });

    return {
      ...result,
      recent: recent.map(r => ({
        id: r.id,
        type: r.importType,
        url: r.sourceUrl,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }

  // Secret management operations
  async createSecret(secret: any): Promise<any> {
    const secretsTable = 'secrets'; // Assuming a secrets table exists
    const [created] = await this.db.execute(sql`
      INSERT INTO ${sql.identifier(secretsTable)} (user_id, key, value, description, project_id, created_at, updated_at)
      VALUES (${secret.userId}, ${secret.key}, ${secret.value}, ${secret.description || null}, ${secret.projectId || null}, ${new Date()}, ${new Date()})
      RETURNING *
    `);
    return created;
  }

  async getProjectSecrets(projectId: string | number): Promise<any[]> {
    const secretsTable = 'secrets';
    const results = await this.db.execute(sql`
      SELECT id, key, description, project_id, created_at, updated_at
      FROM ${sql.identifier(secretsTable)}
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `);
    return results || [];
  }

  async getSecret(id: number): Promise<any | undefined> {
    const secretsTable = 'secrets';
    const [result] = await this.db.execute(sql`
      SELECT * FROM ${sql.identifier(secretsTable)}
      WHERE id = ${id}
    `);
    return result;
  }

  async deleteSecret(id: number): Promise<boolean> {
    const secretsTable = 'secrets';
    const result = await this.db.execute(sql`
      DELETE FROM ${sql.identifier(secretsTable)}
      WHERE id = ${id}
    `);
    return (result as any).length > 0;
  }

  // Deployment methods
  async saveDeployment(deployment: any): Promise<void> {
    // Store deployment in memory or database
    // Saving deployment
  }

  async getDeployment(deploymentId: string): Promise<any | null> {
    // Retrieve deployment from storage
    return null;
  }



  // Collaboration methods
  async getProjectCollaborators(projectId: string | number): Promise<any[]> {
    // Return empty array for now - proper implementation would use a collaborators table
    return [];
  }

  async isProjectCollaborator(projectId: string | number, userId: string | number): Promise<boolean> {
    const project = await this.getProject(projectId);
    return project?.ownerId === userId;
  }

  // Project activity methods
  async forkProject(projectId: string | number, userId: string | number): Promise<Project> {
    const originalProject = await this.getProject(projectId);
    if (!originalProject) throw new Error('Project not found');

    const originalFiles = await this.getFilesByProjectId(projectId);
    const { generateUniqueSlug } = await import('./utils/slug');

    return await withTransaction(async (tx) => {
      const projectName = `${originalProject.name} (Fork)`;
      const slug = await generateUniqueSlug(
        projectName,
        async (s) => {
          const existing = await tx.select().from(projects).where(eq(projects.slug, s)).limit(1);
          return existing.length > 0;
        }
      );

      const [forkedProject] = await tx.insert(projects).values({
        name: projectName,
        slug,
        ownerId: _num(userId),
        description: originalProject.description,
        language: originalProject.language,
        visibility: 'private',
        forkedFromId: projectId
      }).returning();

      if (originalFiles.length > 0) {
        await tx.insert(files).values(
          originalFiles.map(file => ({
            projectId: forkedProject.id,
            name: file.name,
            path: file.path,
            content: file.content,
            isDirectory: file.isDirectory
          }))
        );
      }

      return forkedProject;
    });
  }

  async likeProject(projectId: string | number, userId: string | number): Promise<void> {
    // Placeholder - would use a project_likes table
    await this.db
      .update(projects)
      .set({ likes: sql`${projects.likes} + 1` })
      .where(eq(projects.id, _num(projectId)));
  }

  async unlikeProject(projectId: string | number, userId: string | number): Promise<void> {
    await this.db
      .update(projects)
      .set({ likes: sql`GREATEST(${projects.likes} - 1, 0)` })
      .where(eq(projects.id, _num(projectId)));
  }

  async isProjectLiked(projectId: string | number, userId: string | number): Promise<boolean> {
    // Placeholder - would check project_likes table
    return false;
  }

  async getProjectLikes(projectId: string | number): Promise<number> {
    const project = await this.getProject(projectId);
    return project?.likes || 0;
  }

  async trackProjectView(projectId: string | number, userId: string | number): Promise<void> {
    await this.incrementProjectViews(projectId);
  }

  async getProjectActivity(projectId: string | number, limit?: number): Promise<any[]> {
    // Query audit logs related to this project
    // Note: auditLogs table uses resource/resourceId pattern, not direct projectId
    const activities = await this.db.select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.resource, 'project'),
        eq(auditLogs.resourceId, _num(projectId))
      ))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit || 50);

    return activities.map(log => ({
      id: log.id,
      type: log.action,
      userId: log.userId,
      timestamp: log.timestamp,
      details: log.details || {},
    }));
  }

  // File methods
  async getProjectFiles(projectId: string | number): Promise<any[]> {
    return await this.getFilesByProjectId(projectId);
  }

  async getFileById(id: number): Promise<any | undefined> {
    return await this.getFile(id);
  }

  async getAdminApiKey(provider: string): Promise<any> {
    return await this.getActiveAdminApiKey(provider);
  }

  // CLI token methods
  async createCLIToken(userId: string | number): Promise<any> {
    const token = crypto.randomBytes(32).toString('hex');
    const [created] = await this.db.insert(apiKeys).values({
      userId: _num(userId),
      name: 'CLI Token',
      key: token,
      permissions: ['cli:access'],
      lastUsed: null
    }).returning();
    return created;
  }

  async getUserCLITokens(userId: string | number): Promise<any[]> {
    return await this.db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, _num(userId)),
        sql`'cli:access' = ANY(permissions)`
      ))
      .orderBy(desc(apiKeys.createdAt));
  }

  // Mobile session methods - REAL database implementations
  async getMobileSession(userId: string | number | number, deviceId: string): Promise<MobileSession | undefined> {
    const userIdNum = normalizeUserId(userId);
    const [session] = await this.db
      .select()
      .from(mobileSessions)
      .where(and(
        eq(mobileSessions.userId, userIdNum),
        eq(mobileSessions.deviceId, deviceId),
        eq(mobileSessions.isActive, true)
      ))
      .limit(1);
    return session;
  }

  async createMobileSession(session: InsertMobileSession): Promise<MobileSession> {
    const [created] = await this.db
      .insert(mobileSessions)
      .values(session)
      .onConflictDoUpdate({
        target: [mobileSessions.userId, mobileSessions.deviceId],
        set: {
          deviceName: session.deviceName,
          platform: session.platform,
          pushToken: session.pushToken,
          lastActiveAt: new Date(),
          expiresAt: session.expiresAt,
          isActive: true,
        }
      })
      .returning();
    return created;
  }

  async updateMobileSession(userId: string | number | number, deviceId: string, session: Partial<InsertMobileSession>): Promise<MobileSession | undefined> {
    const userIdNum = normalizeUserId(userId);
    const [updated] = await this.db
      .update(mobileSessions)
      .set({
        ...session,
        lastActiveAt: new Date(),
      })
      .where(and(
        eq(mobileSessions.userId, userIdNum),
        eq(mobileSessions.deviceId, deviceId)
      ))
      .returning();
    return updated;
  }

  async getUserMobileSessions(userId: string | number | number): Promise<MobileSession[]> {
    const userIdNum = normalizeUserId(userId);
    return await this.db
      .select()
      .from(mobileSessions)
      .where(and(
        eq(mobileSessions.userId, userIdNum),
        eq(mobileSessions.isActive, true)
      ))
      .orderBy(desc(mobileSessions.lastActiveAt));
  }

  async deleteMobileSession(userId: string | number | number, deviceId: string): Promise<boolean> {
    const userIdNum = normalizeUserId(userId);
    const result = await this.db
      .update(mobileSessions)
      .set({ isActive: false })
      .where(and(
        eq(mobileSessions.userId, userIdNum),
        eq(mobileSessions.deviceId, deviceId)
      ))
      .returning();
    return result.length > 0;
  }

  async cleanupExpiredMobileSessions(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(mobileSessions)
      .where(lt(mobileSessions.expiresAt, now))
      .returning();
    return result.length;
  }

  // User Credits and Billing operations
  async getUserCredits(userId: string | number): Promise<UserCredits | undefined> {
    const [credits] = await this.db.select().from(userCredits).where(eq(userCredits.userId, _num(userId)));

    // If no credits record exists, create one with default credits
    if (!credits) {
      const [newCredits] = await this.db
        .insert(userCredits)
        .values({ userId })
        .returning();
      return newCredits;
    }

    return credits;
  }

  async createUserCredits(credits: InsertUserCredits): Promise<UserCredits> {
    const [created] = await this.db.insert(userCredits).values(credits).returning();
    return created;
  }

  async updateUserCredits(userId: string | number, credits: Partial<InsertUserCredits>): Promise<UserCredits | undefined> {
    const [updated] = await this.db
      .update(userCredits)
      .set({ ...credits, updatedAt: new Date() })
      .where(eq(userCredits.userId, _num(userId)))
      .returning();
    return updated;
  }

  async addCredits(userId: string | number, amount: number): Promise<UserCredits | undefined> {
    const [updated] = await this.db
      .update(userCredits)
      .set({
        remainingCredits: sql`${userCredits.remainingCredits} + ${amount}`,
        extraCredits: sql`${userCredits.extraCredits} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(userCredits.userId, _num(userId)))
      .returning();
    return updated;
  }

  async deductCredits(userId: string | number, amount: number): Promise<UserCredits | undefined> {
    const [updated] = await this.db
      .update(userCredits)
      .set({
        remainingCredits: sql`GREATEST(${userCredits.remainingCredits} - ${amount}, 0)`,
        updatedAt: new Date()
      })
      .where(eq(userCredits.userId, _num(userId)))
      .returning();
    return updated;
  }

  async getBudgetLimits(userId: string | number): Promise<BudgetLimit | undefined> {
    const [limits] = await this.db.select().from(budgetLimits).where(eq(budgetLimits.userId, _num(userId)));
    return limits;
  }

  async createBudgetLimits(limits: InsertBudgetLimit): Promise<BudgetLimit> {
    const [created] = await this.db.insert(budgetLimits).values(limits).returning();
    return created;
  }

  async updateBudgetLimits(userId: string | number, limits: Partial<InsertBudgetLimit>): Promise<BudgetLimit | undefined> {
    const [updated] = await this.db
      .update(budgetLimits)
      .set({ ...limits, updatedAt: new Date() })
      .where(eq(budgetLimits.userId, _num(userId)))
      .returning();
    return updated;
  }

  async createUsageAlert(alert: InsertUsageAlert): Promise<UsageAlert> {
    const [created] = await this.db.insert(usageAlerts).values(alert).returning();
    return created;
  }

  async getUsageAlerts(userId: string | number): Promise<UsageAlert[]> {
    return await this.db.select().from(usageAlerts).where(eq(usageAlerts.userId, _num(userId)));
  }

  async markAlertSent(alertId: number): Promise<void> {
    await this.db
      .update(usageAlerts)
      .set({ sent: true, sentAt: new Date() })
      .where(eq(usageAlerts.id, alertId));
  }

  async deleteOldUsageAlerts(userId: string | number, beforeDate?: Date): Promise<number> {
    const cutoffDate = beforeDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago by default
    const result = await this.db
      .delete(usageAlerts)
      .where(and(
        eq(usageAlerts.userId, _num(userId)),
        lt(usageAlerts.createdAt, cutoffDate)
      ))
      .returning();
    return result.length;
  }

  // Deployment Type-Specific operations
  async createAutoscaleDeployment(config: InsertAutoscaleDeployment): Promise<AutoscaleDeployment> {
    const [created] = await this.db.insert(autoscaleDeployments).values(config).returning();
    return created;
  }

  async getAutoscaleDeployment(deploymentId: number): Promise<AutoscaleDeployment | undefined> {
    const [deployment] = await this.db.select().from(autoscaleDeployments).where(eq(autoscaleDeployments.deploymentId, deploymentId));
    return deployment;
  }

  async updateAutoscaleDeployment(deploymentId: number, config: Partial<InsertAutoscaleDeployment>): Promise<AutoscaleDeployment | undefined> {
    const [updated] = await this.db
      .update(autoscaleDeployments)
      .set(config)
      .where(eq(autoscaleDeployments.deploymentId, deploymentId))
      .returning();
    return updated;
  }

  async createReservedVmDeployment(config: InsertReservedVmDeployment): Promise<ReservedVmDeployment> {
    const [created] = await this.db.insert(reservedVmDeployments).values(config).returning();
    return created;
  }

  async getReservedVmDeployment(deploymentId: number): Promise<ReservedVmDeployment | undefined> {
    const [deployment] = await this.db.select().from(reservedVmDeployments).where(eq(reservedVmDeployments.deploymentId, deploymentId));
    return deployment;
  }

  async updateReservedVmDeployment(deploymentId: number, config: Partial<InsertReservedVmDeployment>): Promise<ReservedVmDeployment | undefined> {
    const [updated] = await this.db
      .update(reservedVmDeployments)
      .set(config)
      .where(eq(reservedVmDeployments.deploymentId, deploymentId))
      .returning();
    return updated;
  }

  async createScheduledDeployment(config: InsertScheduledDeployment): Promise<ScheduledDeployment> {
    const [created] = await this.db.insert(scheduledDeployments).values(config).returning();
    return created;
  }

  async getScheduledDeployment(deploymentId: number): Promise<ScheduledDeployment | undefined> {
    const [deployment] = await this.db.select().from(scheduledDeployments).where(eq(scheduledDeployments.deploymentId, deploymentId));
    return deployment;
  }

  async updateScheduledDeployment(deploymentId: number, config: Partial<InsertScheduledDeployment>): Promise<ScheduledDeployment | undefined> {
    const [updated] = await this.db
      .update(scheduledDeployments)
      .set(config)
      .where(eq(scheduledDeployments.deploymentId, deploymentId))
      .returning();
    return updated;
  }

  async createStaticDeployment(config: InsertStaticDeployment): Promise<StaticDeployment> {
    const [created] = await this.db.insert(staticDeployments).values(config).returning();
    return created;
  }

  async getStaticDeployment(deploymentId: number): Promise<StaticDeployment | undefined> {
    const [deployment] = await this.db.select().from(staticDeployments).where(eq(staticDeployments.deploymentId, deploymentId));
    return deployment;
  }

  async updateStaticDeployment(deploymentId: number, config: Partial<InsertStaticDeployment>): Promise<StaticDeployment | undefined> {
    const [updated] = await this.db
      .update(staticDeployments)
      .set(config)
      .where(eq(staticDeployments.deploymentId, deploymentId))
      .returning();
    return updated;
  }

  // Object Storage operations
  async createObjectStorageBucket(bucket: InsertObjectStorageBucket): Promise<ObjectStorageBucket> {
    const [created] = await this.db.insert(objectStorageBuckets).values(bucket).returning();
    return created;
  }

  async getObjectStorageBucket(id: number): Promise<ObjectStorageBucket | undefined> {
    const [bucket] = await this.db.select().from(objectStorageBuckets).where(eq(objectStorageBuckets.id, _num(id)));
    return bucket;
  }

  async getProjectObjectStorageBuckets(projectId: string | number): Promise<ObjectStorageBucket[]> {
    return await this.db.select().from(objectStorageBuckets).where(eq(objectStorageBuckets.projectId, _num(projectId)));
  }

  async deleteObjectStorageBucket(id: number): Promise<boolean> {
    const result = await this.db.delete(objectStorageBuckets).where(eq(objectStorageBuckets.id, _num(id)));
    return result.length > 0;
  }

  async createObjectStorageFile(file: InsertObjectStorageFile): Promise<ObjectStorageFile> {
    const [created] = await this.db.insert(objectStorageFiles).values(file).returning();
    return created;
  }

  async getObjectStorageFile(id: number): Promise<ObjectStorageFile | undefined> {
    const [file] = await this.db.select().from(objectStorageFiles).where(eq(objectStorageFiles.id, _num(id)));
    return file;
  }

  async getBucketFiles(bucketId: number): Promise<ObjectStorageFile[]> {
    return await this.db.select().from(objectStorageFiles).where(eq(objectStorageFiles.bucketId, bucketId));
  }

  async deleteObjectStorageFile(id: number): Promise<boolean> {
    const result = await this.db.delete(objectStorageFiles).where(eq(objectStorageFiles.id, _num(id)));
    return result.length > 0;
  }

  // Key-Value Store operations
  async setKeyValue(projectId: string | number, key: string, value: any, expiresAt?: Date): Promise<KeyValueStore> {
    const existing = await this.getKeyValue(projectId, key);

    if (existing) {
      const [updated] = await this.db
        .update(keyValueStore)
        .set({ value, expiresAt, updatedAt: new Date() })
        .where(and(
          eq(keyValueStore.projectId, _num(projectId)),
          eq(keyValueStore.key, key)
        ))
        .returning();
      return updated;
    }

    const [created] = await this.db.insert(keyValueStore).values({
      projectId: _num(projectId),
      key,
      value,
      expiresAt
    }).returning();
    return created;
  }

  async getKeyValue(projectId: string | number, key: string): Promise<KeyValueStore | undefined> {
    const [kv] = await this.db
      .select()
      .from(keyValueStore)
      .where(and(
        eq(keyValueStore.projectId, _num(projectId)),
        eq(keyValueStore.key, key)
      ));

    if (kv && kv.expiresAt && new Date(kv.expiresAt) < new Date()) {
      await this.deleteKeyValue(projectId, key);
      return undefined;
    }

    return kv;
  }

  async deleteKeyValue(projectId: string | number, key: string): Promise<boolean> {
    const result = await this.db
      .delete(keyValueStore)
      .where(and(
        eq(keyValueStore.projectId, _num(projectId)),
        eq(keyValueStore.key, key)
      ));
    return result.length > 0;
  }

  async getProjectKeyValues(projectId: string | number): Promise<KeyValueStore[]> {
    const kvs = await this.db
      .select()
      .from(keyValueStore)
      .where(eq(keyValueStore.projectId, _num(projectId)));

    // Filter out expired keys
    const now = new Date();
    return kvs.filter(kv => !kv.expiresAt || new Date(kv.expiresAt) >= now);
  }

  // AI Conversation operations
  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [created] = await this.db.insert(aiConversations).values(conversation).returning();
    return created;
  }

  async getAiConversation(id: number): Promise<AiConversation | undefined> {
    const [conversation] = await this.db.select().from(aiConversations).where(eq(aiConversations.id, _num(id)));
    return conversation;
  }

  async getProjectAiConversations(projectId: string | number): Promise<AiConversation[]> {
    return await this.db.select().from(aiConversations).where(eq(aiConversations.projectId, _num(projectId)));
  }

  async updateAiConversation(id: number, updates: Partial<InsertAiConversation>): Promise<AiConversation | undefined> {
    const [updated] = await this.db
      .update(aiConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiConversations.id, _num(id)))
      .returning();
    return updated;
  }

  async addMessageToConversation(conversationId: number, message: any): Promise<void> {
    const conversation = await this.getAiConversation(conversationId);
    if (!conversation) return;

    const messages = [...conversation.messages as any[], message];
    await this.db
      .update(aiConversations)
      .set({
        messages,
        totalTokensUsed: sql`${aiConversations.totalTokensUsed} + ${message.tokens || 0}`,
        updatedAt: new Date()
      })
      .where(eq(aiConversations.id, conversationId));
  }

  // Agent Message operations
  async createAgentMessage(message: {
    conversationId: number;
    projectId: string | number;
    userId: string | number;
    role: string;
    content: string;
    model?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const { agentMessages } = await import('@shared/schema');
    const [created] = await this.db.insert(agentMessages).values(message).returning();
    return created;
  }

  async getAgentMessages(conversationId: number): Promise<any[]> {
    const { agentMessages } = await import('@shared/schema');
    return await this.db.select().from(agentMessages).where(eq(agentMessages.conversationId, conversationId));
  }

  // Build Execution operations
  async createBuildExecution(execution: {
    projectId: string | number;
    conversationId?: number;
    planId: string;
    totalTasks: number;
    metadata?: any;
  }): Promise<any> {
    const { buildExecutions } = await import('@shared/schema');
    const [created] = await this.db.insert(buildExecutions).values(execution).returning();
    return created;
  }

  async getBuildExecution(id: string | number): Promise<any | undefined> {
    const { buildExecutions } = await import('@shared/schema');
    const [execution] = await this.db.select().from(buildExecutions).where(eq(buildExecutions.id, _num(id)));
    return execution;
  }

  async getBuildExecutionsByProject(projectId: string | number): Promise<any[]> {
    const { buildExecutions } = await import('@shared/schema');
    return await this.db
      .select()
      .from(buildExecutions)
      .where(eq(buildExecutions.projectId, _num(projectId)))
      .orderBy(buildExecutions.createdAt);
  }

  async updateBuildExecution(id: string | number, updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    currentTaskId?: string;
    currentTaskIndex?: number;
    progress?: number;
    executionLog?: any[];
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<any | undefined> {
    const { buildExecutions } = await import('@shared/schema');
    const [updated] = await this.db
      .update(buildExecutions)
      .set(updates)
      .where(eq(buildExecutions.id, _num(id)))
      .returning();
    return updated;
  }

  // Dynamic Intelligence operations
  async getDynamicIntelligenceSettings(userId: string | number): Promise<DynamicIntelligence | undefined> {
    const [settings] = await this.db.select().from(dynamicIntelligence).where(eq(dynamicIntelligence.userId, _num(userId)));
    return settings;
  }

  async updateDynamicIntelligenceSettings(userId: string | number, settings: Partial<InsertDynamicIntelligence>): Promise<DynamicIntelligence> {
    // Check if settings exist for user
    const existing = await this.getDynamicIntelligenceSettings(userId);
    
    if (existing) {
      // Update existing settings
      const [updated] = await this.db
        .update(dynamicIntelligence)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(dynamicIntelligence.userId, _num(userId)))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await this.db
        .insert(dynamicIntelligence)
        .values({ userId: _num(userId), ...settings })
        .returning();
      return created;
    }
  }

  async createDynamicIntelligence(settings: InsertDynamicIntelligence): Promise<DynamicIntelligence> {
    const [created] = await this.db.insert(dynamicIntelligence).values(settings).returning();
    return created;
  }

  async updateDynamicIntelligence(userId: string | number, settings: Partial<InsertDynamicIntelligence>): Promise<DynamicIntelligence | undefined> {
    const [updated] = await this.db
      .update(dynamicIntelligence)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(dynamicIntelligence.userId, _num(userId)))
      .returning();
    return updated;
  }

  // Web Search operations
  async createWebSearchHistory(search: InsertWebSearchHistory): Promise<WebSearchHistory> {
    const [created] = await this.db.insert(webSearchHistory).values(search).returning();
    return created;
  }

  async getConversationSearchHistory(conversationId: number): Promise<WebSearchHistory[]> {
    return await this.db.select().from(webSearchHistory).where(eq(webSearchHistory.conversationId, conversationId));
  }

  // Git Integration operations
  async createGitRepository(repo: InsertGitRepository): Promise<GitRepository> {
    const [created] = await this.db.insert(gitRepositories).values(repo).returning();
    return created;
  }

  async getGitRepository(projectId: string | number): Promise<GitRepository | undefined> {
    const [repo] = await this.db.select().from(gitRepositories).where(eq(gitRepositories.projectId, _num(projectId)));
    return repo;
  }

  async updateGitRepository(projectId: string | number, updates: Partial<InsertGitRepository>): Promise<GitRepository | undefined> {
    const [updated] = await this.db
      .update(gitRepositories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gitRepositories.projectId, _num(projectId)))
      .returning();
    return updated;
  }

  async createGitCommit(commit: InsertGitCommit): Promise<GitCommit> {
    const [created] = await this.db.insert(gitCommits).values(commit).returning();
    return created;
  }

  async getRepositoryCommits(repositoryId: number): Promise<GitCommit[]> {
    return await this.db.select().from(gitCommits).where(eq(gitCommits.repositoryId, repositoryId));
  }

  // Custom Domain operations
  async createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain> {
    const [created] = await this.db.insert(customDomains).values(domain).returning();
    return created;
  }

  async getCustomDomain(id: number): Promise<CustomDomain | undefined> {
    const [domain] = await this.db.select().from(customDomains).where(eq(customDomains.id, _num(id)));
    return domain;
  }

  async getProjectCustomDomains(projectId: string | number): Promise<CustomDomain[]> {
    return await this.db.select().from(customDomains).where(eq(customDomains.projectId, _num(projectId)));
  }

  async updateCustomDomain(id: number, updates: Partial<InsertCustomDomain>): Promise<CustomDomain | undefined> {
    const [updated] = await this.db
      .update(customDomains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customDomains.id, _num(id)))
      .returning();
    return updated;
  }

  async deleteCustomDomain(id: number): Promise<boolean> {
    const result = await this.db.delete(customDomains).where(eq(customDomains.id, _num(id)));
    return result.length > 0;
  }

  // Sales and Support operations
  async createCustomerRequest(request: InsertCustomerRequest): Promise<CustomerRequest> {
    const payload = {
      ...request,
      metadata: request.metadata ?? {},
      status: request.status ?? 'new',
      createdAt: request.createdAt ?? new Date(),
      updatedAt: request.updatedAt ?? new Date(),
    };

    const [created] = await this.db
      .insert(customerRequests)
      .values(payload)
      .returning();

    return created;
  }

  async getCustomerRequests(filters?: { formType?: string; status?: string; limit?: number }): Promise<CustomerRequest[]> {
    const conditions: SQL<unknown>[] = [];

    if (filters?.formType) {
      conditions.push(eq(customerRequests.formType, filters.formType));
    }

    if (filters?.status) {
      conditions.push(eq(customerRequests.status, filters.status));
    }

    let query = this.db.select().from(customerRequests).$dynamic();
    // we will apply orderBy at the end

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(customerRequests.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async listCustomerRequests(filters?: {
    formType?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    requests: CustomerRequest[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const conditions: SQL<unknown>[] = [];

    if (filters?.formType) {
      conditions.push(eq(customerRequests.formType, filters.formType));
    }

    if (filters?.status) {
      conditions.push(eq(customerRequests.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(customerRequests.senderName, term),
          ilike(customerRequests.senderEmail, term),
          ilike(customerRequests.senderCompany, term),
          ilike(customerRequests.subject, term),
          ilike(customerRequests.message, term),
          ilike(customerRequests.pagePath, term),
        ),
      );
    }

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(Math.max(filters?.pageSize ?? 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const filterClause = conditions.length > 0 ? and(...conditions) : undefined;

    let listQuery = this.db
      .select()
      .from(customerRequests);

    if (filterClause) {
      listQuery = listQuery.where(filterClause);
    }

    listQuery = listQuery.orderBy(desc(customerRequests.createdAt)).limit(pageSize).offset(offset);

    const requests = await listQuery;

    let totalQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(customerRequests);

    if (filterClause) {
      totalQuery = totalQuery.where(filterClause);
    }

    const totalResult = await totalQuery;
    const total = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    return {
      requests,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCustomerRequestAggregates(filters?: {
    formType?: string;
    status?: string;
    search?: string;
  }): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byFormType: Record<string, number>;
  }> {
    const conditions: SQL<unknown>[] = [];

    if (filters?.formType) {
      conditions.push(eq(customerRequests.formType, filters.formType));
    }

    if (filters?.status) {
      conditions.push(eq(customerRequests.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(customerRequests.senderName, term),
          ilike(customerRequests.senderEmail, term),
          ilike(customerRequests.senderCompany, term),
          ilike(customerRequests.subject, term),
          ilike(customerRequests.message, term),
          ilike(customerRequests.pagePath, term),
        ),
      );
    }

    const filterClause = conditions.length > 0 ? and(...conditions) : undefined;

    let totalQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(customerRequests);

    if (filterClause) {
      totalQuery = totalQuery.where(filterClause);
    }

    const totalResult = await totalQuery;
    const total = Number(totalResult[0]?.count ?? 0);

    let statusQuery = this.db
      .select({ status: customerRequests.status, count: sql<number>`count(*)` })
      .from(customerRequests);

    if (filterClause) {
      statusQuery = statusQuery.where(filterClause);
    }

    statusQuery = statusQuery.groupBy(customerRequests.status);
    const statusRows = await statusQuery;

    let formTypeQuery = this.db
      .select({ formType: customerRequests.formType, count: sql<number>`count(*)` })
      .from(customerRequests);

    if (filterClause) {
      formTypeQuery = formTypeQuery.where(filterClause);
    }

    formTypeQuery = formTypeQuery.groupBy(customerRequests.formType);
    const formTypeRows = await formTypeQuery;

    const byStatus = statusRows.reduce((acc: Record<string, number>, row) => {
      if (row.status) {
        acc[row.status] = Number(row.count);
      }
      return acc;
    }, {});

    const byFormType = formTypeRows.reduce((acc: Record<string, number>, row) => {
      if (row.formType) {
        acc[row.formType] = Number(row.count);
      }
      return acc;
    }, {});

    return {
      total,
      byStatus,
      byFormType,
    };
  }

  async updateCustomerRequest(id: number, updates: Partial<CustomerRequest>): Promise<CustomerRequest | undefined> {
    const payload: Partial<CustomerRequest> = {
      ...updates,
      updatedAt: new Date(),
    };

    if (payload.resolvedAt === undefined) {
      delete payload.resolvedAt;
    }

    if (payload.metadata === undefined) {
      delete payload.metadata;
    }

    const [updated] = await this.db
      .update(customerRequests)
      .set(payload)
      .where(eq(customerRequests.id, _num(id)))
      .returning();

    return updated;
  }

  async createSalesInquiry(inquiry: any): Promise<any> {
    const request = await this.createCustomerRequest({
      formType: 'contact_sales',
      pagePath: inquiry.pagePath || '/contact-sales',
      senderName: inquiry.name,
      senderEmail: inquiry.email,
      senderCompany: inquiry.company,
      senderPhone: inquiry.phone,
      subject: inquiry.subject || (inquiry.useCase ? `Sales inquiry - ${inquiry.useCase}` : 'Sales inquiry'),
      message: inquiry.message,
      status: inquiry.status ?? 'new',
      metadata: {
        companySize: inquiry.companySize || 'unknown',
        useCase: inquiry.useCase || 'general',
        ...(inquiry.metadata || {}),
      },
    });

    return {
      ...inquiry,
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      pagePath: request.pagePath,
    };
  }

  async getSalesInquiries(status?: string): Promise<any[]> {
    const inquiries = await this.getCustomerRequests({
      formType: 'contact_sales',
      status: status || undefined,
    });

    return inquiries.map((request) => ({
      id: request.id,
      name: request.senderName,
      email: request.senderEmail,
      company: request.senderCompany,
      phone: request.senderPhone,
      message: request.message,
      subject: request.subject,
      companySize: request.metadata?.companySize || 'unknown',
      useCase: request.metadata?.useCase || 'general',
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      pagePath: request.pagePath,
    }));
  }

  async updateSalesInquiry(id: number, updates: any): Promise<any | undefined> {
    const updated = await this.updateCustomerRequest(id, {
      senderName: updates.name,
      senderEmail: updates.email,
      senderCompany: updates.company,
      senderPhone: updates.phone,
      message: updates.message,
      subject: updates.subject,
      status: updates.status,
      metadata: {
        companySize: updates.companySize,
        useCase: updates.useCase,
        ...(updates.metadata || {}),
      },
    });

    if (!updated) {
      return undefined;
    }

    return {
      id: updated.id,
      name: updated.senderName,
      email: updated.senderEmail,
      company: updated.senderCompany,
      phone: updated.senderPhone,
      message: updated.message,
      subject: updated.subject,
      companySize: updated.metadata?.companySize || 'unknown',
      useCase: updated.metadata?.useCase || 'general',
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      pagePath: updated.pagePath,
    };
  }

  async createAbuseReport(report: any): Promise<any> {
    const request = await this.createCustomerRequest({
      formType: 'report_abuse',
      pagePath: report.pagePath || '/report-abuse',
      senderName: report.reporterName,
      senderEmail: report.reporterEmail,
      subject: `Abuse report - ${report.reportType}`,
      message: report.description,
      metadata: {
        reportType: report.reportType,
        targetUrl: report.targetUrl,
        username: report.username,
        reporterUserId: report.userId,
        ...(report.metadata || {}),
      },
    });

    return {
      ...report,
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      pagePath: request.pagePath,
    };
  }

  async getAbuseReports(status?: string): Promise<any[]> {
    const reports = await this.getCustomerRequests({
      formType: 'report_abuse',
      status: status || undefined,
    });

    return reports.map((request) => ({
      id: request.id,
      reportType: request.metadata?.reportType,
      targetUrl: request.metadata?.targetUrl,
      description: request.message,
      reporterEmail: request.senderEmail,
      username: request.metadata?.username,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      pagePath: request.pagePath,
    }));
  }

  async updateAbuseReport(id: number, updates: any): Promise<any | undefined> {
    const updated = await this.updateCustomerRequest(id, {
      message: updates.description,
      senderEmail: updates.reporterEmail,
      status: updates.status,
      metadata: {
        reportType: updates.reportType,
        targetUrl: updates.targetUrl,
        username: updates.username,
        ...(updates.metadata || {}),
      },
    });

    if (!updated) {
      return undefined;
    }

    return {
      id: updated.id,
      reportType: updated.metadata?.reportType,
      targetUrl: updated.metadata?.targetUrl,
      description: updated.message,
      reporterEmail: updated.senderEmail,
      username: updated.metadata?.username,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      pagePath: updated.pagePath,
    };
  }

  // Kubernetes User Environment operations
  private userEnvironments = new Map<number, any>();

  async saveUserEnvironment(environment: any): Promise<void> {
    this.userEnvironments.set(environment.userId, environment);
    // In production, this would save to a database table
  }

  async getUserEnvironment(userId: string | number): Promise<any | null> {
    return this.userEnvironments.get(_num(userId)) || null;
    // In production, this would query from user_environments table
  }

  async updateUserEnvironment(environment: any): Promise<void> {
    this.userEnvironments.set(environment.userId, environment);
    // In production, this would update the user_environments table
  }

  async deleteUserEnvironment(userId: string | number): Promise<void> {
    this.userEnvironments.delete(_num(userId));
    // In production, this would delete from user_environments table
  }

  // Voice/Video Session operations
  async createVoiceVideoSession(session: InsertVoiceVideoSession): Promise<VoiceVideoSession> {
    const [created] = await this.db.insert(voiceVideoSessions).values(session).returning();
    return created;
  }

  async getProjectVoiceVideoSessions(projectId: string | number): Promise<VoiceVideoSession[]> {
    return await this.db.select().from(voiceVideoSessions)
      .where(eq(voiceVideoSessions.projectId, _num(projectId)))
      .orderBy(desc(voiceVideoSessions.startedAt));
  }

  async endVoiceVideoSession(sessionId: number): Promise<VoiceVideoSession | undefined> {
    const [updated] = await this.db
      .update(voiceVideoSessions)
      .set({
        status: 'ended',
        endedAt: new Date()
      })
      .where(eq(voiceVideoSessions.id, sessionId))
      .returning();
    return updated;
  }

  async addVoiceVideoParticipant(participant: InsertVoiceVideoParticipant): Promise<VoiceVideoParticipant> {
    const [created] = await this.db.insert(voiceVideoParticipants).values(participant).returning();
    return created;
  }

  async removeVoiceVideoParticipant(sessionId: number, userId: string | number): Promise<void> {
    await this.db
      .update(voiceVideoParticipants)
      .set({ leftAt: new Date() })
      .where(and(
        eq(voiceVideoParticipants.sessionId, sessionId),
        eq(voiceVideoParticipants.userId, _num(userId)),
        isNull(voiceVideoParticipants.leftAt)
      ));
  }

  // GPU Instance operations
  async createGpuInstance(instance: InsertGpuInstance): Promise<GpuInstance> {
    const [created] = await this.db.insert(gpuInstances).values(instance).returning();
    return created;
  }

  async getProjectGpuInstances(projectId: string | number): Promise<GpuInstance[]> {
    return await this.db.select().from(gpuInstances)
      .where(eq(gpuInstances.projectId, _num(projectId)))
      .orderBy(desc(gpuInstances.createdAt));
  }

  async updateGpuInstanceStatus(instanceId: number, status: string): Promise<GpuInstance | undefined> {
    const [updated] = await this.db
      .update(gpuInstances)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(gpuInstances.id, instanceId))
      .returning();
    return updated;
  }

  async createGpuUsage(usage: InsertGpuUsage): Promise<GpuUsage> {
    const [created] = await this.db.insert(gpuUsage).values(usage).returning();
    return created;
  }

  async getGpuUsageByInstance(instanceId: number): Promise<GpuUsage[]> {
    return await this.db.select().from(gpuUsage)
      .where(eq(gpuUsage.instanceId, instanceId))
      .orderBy(desc(gpuUsage.createdAt));
  }

  // Assignment operations
  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const [created] = await this.db.insert(assignments).values(assignment).returning();
    return created;
  }

  async getAssignments(filters?: { courseId?: number; createdBy?: number }): Promise<Assignment[]> {
    const conditions = [];

    if (filters?.courseId) {
      conditions.push(eq(assignments.courseId, filters.courseId));
    }
    if (filters?.createdBy) {
      conditions.push(eq(assignments.createdBy, filters.createdBy));
    }

    if (conditions.length > 0) {
      return await this.db.select().from(assignments)
        .where(and(...conditions))
        .orderBy(desc(assignments.createdAt));
    }

    return await this.db.select().from(assignments)
      .orderBy(desc(assignments.createdAt));
  }

  async getAssignment(id: number): Promise<Assignment | undefined> {
    const [assignment] = await this.db.select().from(assignments).where(eq(assignments.id, _num(id)));
    return assignment;
  }

  async updateAssignment(id: number, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const [updated] = await this.db
      .update(assignments)
      .set({ ...assignment, updatedAt: new Date() })
      .where(eq(assignments.id, _num(id)))
      .returning();
    return updated;
  }

  // Submission operations
  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [created] = await this.db.insert(submissions).values(submission).returning();
    return created;
  }

  async getSubmissionsByAssignment(assignmentId: number): Promise<Submission[]> {
    return await this.db.select().from(submissions)
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(desc(submissions.submittedAt));
  }

  async getSubmissionsByStudent(studentId: number): Promise<Submission[]> {
    return await this.db.select().from(submissions)
      .where(eq(submissions.studentId, studentId))
      .orderBy(desc(submissions.submittedAt));
  }

  async gradeSubmission(submissionId: number, grade: number, feedback: string, gradedBy: number): Promise<Submission | undefined> {
    const [updated] = await this.db
      .update(submissions)
      .set({
        grade,
        feedback,
        gradedBy,
        gradedAt: new Date(),
        status: 'graded'
      })
      .where(eq(submissions.id, submissionId))
      .returning();
    return updated;
  }

  // AI Usage Tracking for billing
  async createAIUsageRecord(record: {
    userId: number;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    creditsCost: number;
    purpose?: string;
    projectId?: number;
    metadata?: any;
  }): Promise<any> {
    const [created] = await this.db.insert(aiUsageRecords).values({
      userId: record.userId,
      model: record.model,
      provider: record.provider,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      creditsCost: record.creditsCost.toString(),
      purpose: record.purpose,
      projectId: record.projectId,
      conversationId: record.metadata?.conversationId,
      metadata: record.metadata || {},
    }).returning();

    // Also deduct credits from user account
    await this.db
      .update(userCredits)
      .set({
        remainingCredits: sql`${userCredits.remainingCredits} - ${record.creditsCost}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, record.userId));

    return created;
  }

  async getAIUsageStats(userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]> {
    const filters: SQL[] = [eq(aiUsageRecords.userId, _num(userId))];

    if (startDate) {
      filters.push(gte(aiUsageRecords.createdAt, startDate));
    }

    if (endDate) {
      filters.push(lte(aiUsageRecords.createdAt, endDate));
    }

    const whereClause = filters.length > 1 ? and(...filters) : filters[0];

    return await this.db
      .select()
      .from(aiUsageRecords)
      .where(whereClause)
      .orderBy(desc(aiUsageRecords.createdAt));
  }

  // Notification implementations
  async getNotifications(userId: string | number | number, unreadOnly: boolean = false): Promise<NotificationRecord[]> {
    const normalizedUserId = normalizeUserId(userId);
    const condition = unreadOnly
      ? and(eq(pushNotifications.userId, normalizedUserId), eq(pushNotifications.read, false))
      : eq(pushNotifications.userId, normalizedUserId);

    return await this.db
      .select()
      .from(pushNotifications)
      .where(condition)
      .orderBy(desc(pushNotifications.createdAt));
  }

  async getNotificationsForUser(userId: string | number | number, limit: number = 50): Promise<NotificationRecord[]> {
    const normalizedUserId = normalizeUserId(userId);
    return await this.db
      .select()
      .from(pushNotifications)
      .where(eq(pushNotifications.userId, normalizedUserId))
      .orderBy(desc(pushNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string | number | number): Promise<number> {
    const normalizedUserId = normalizeUserId(userId);
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(pushNotifications)
      .where(and(eq(pushNotifications.userId, normalizedUserId), eq(pushNotifications.read, false)));

    return Number(result?.count ?? 0);
  }

  async getNotificationPreferences(userId: string | number | number): Promise<NotificationPreferenceRecord> {
    const normalizedUserId = normalizeUserId(userId);
    const [existing] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, normalizedUserId));

    if (existing) {
      const normalized = normalizePreferences(existing, undefined);

      const needsUpdate =
        JSON.stringify(existing.email ?? {}) !== JSON.stringify(normalized.email) ||
        JSON.stringify(existing.push ?? {}) !== JSON.stringify(normalized.push) ||
        existing.frequency !== normalized.frequency;

      if (needsUpdate) {
        const [updated] = await this.db
          .update(notificationPreferences)
          .set({ ...normalized, updatedAt: new Date() })
          .where(eq(notificationPreferences.userId, normalizedUserId))
          .returning();

        return updated ?? { ...existing, ...normalized };
      }

      return {
        ...existing,
        email: normalized.email,
        push: normalized.push,
        frequency: normalized.frequency,
      };
    }

    const defaults = normalizePreferences();
    const [created] = await this.db
      .insert(notificationPreferences)
      .values({
        userId: normalizedUserId,
        email: defaults.email,
        push: defaults.push,
        frequency: defaults.frequency,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return (
      created ?? {
        userId: normalizedUserId,
        email: defaults.email,
        push: defaults.push,
        frequency: defaults.frequency,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  async updateNotificationPreferences(
    userId: string | number | number,
    preferences: NotificationPreferencesPayload,
  ): Promise<NotificationPreferenceRecord> {
    const normalizedUserId = normalizeUserId(userId);
    const current = await this.getNotificationPreferences(normalizedUserId);
    const normalized = normalizePreferences(current, preferences);
    const [updated] = await this.db
      .insert(notificationPreferences)
      .values({
        userId: normalizedUserId,
        email: normalized.email,
        push: normalized.push,
        frequency: normalized.frequency,
        createdAt: current?.createdAt ?? new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          email: normalized.email,
          push: normalized.push,
          frequency: normalized.frequency,
          updatedAt: new Date(),
        },
      })
      .returning();

    return (
      updated ?? {
        userId: normalizedUserId,
        email: normalized.email,
        push: normalized.push,
        frequency: normalized.frequency,
        createdAt: current?.createdAt ?? new Date(),
        updatedAt: new Date(),
      }
    );
  }

  async markNotificationAsRead(notificationId: number, userId: string | number | number): Promise<void> {
    const normalizedUserId = normalizeUserId(userId);
    await this.db
      .update(pushNotifications)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(pushNotifications.id, notificationId), eq(pushNotifications.userId, normalizedUserId)));
  }

  async markAllNotificationsAsRead(userId: string | number | number): Promise<void> {
    const normalizedUserId = normalizeUserId(userId);
    await this.db
      .update(pushNotifications)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(pushNotifications.userId, normalizedUserId), eq(pushNotifications.read, false)));
  }

  async deleteNotification(notificationId: number, userId: string | number | number): Promise<void> {
    const normalizedUserId = normalizeUserId(userId);
    await this.db
      .delete(pushNotifications)
      .where(and(eq(pushNotifications.id, notificationId), eq(pushNotifications.userId, normalizedUserId)));
  }

  async deleteAllNotifications(userId: string | number | number): Promise<void> {
    const normalizedUserId = normalizeUserId(userId);
    await this.db.delete(pushNotifications).where(eq(pushNotifications.userId, normalizedUserId));
  }

  async createNotification(notification: InsertNotificationRecord): Promise<NotificationRecord> {
    const normalizedUserId = normalizeUserId(notification.userId);
    const parsed = insertNotificationSchema.parse({ ...notification, userId: normalizedUserId });
    const [created] = await this.db
      .insert(pushNotifications)
      .values({
        ...parsed,
        userId: normalizedUserId,
        type: parsed.type ?? 'system',
        data: parsed.data ?? {},
        read: false,
        sent: false,
        createdAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create notification');
    }

    return created;
  }

  async updatePushNotification(id: number, data: Partial<NotificationRecord>): Promise<void> {
    if (Object.keys(data).length === 0) {
      return;
    }

    const updates: Partial<NotificationRecord> = { ...data };
    delete (updates as any).id;
    if (updates.userId !== undefined) {
      updates.userId = normalizeUserId(updates.userId);
    }

    if (updates.read !== undefined && updates.readAt === undefined) {
      updates.readAt = updates.read ? new Date() : null;
    }

    for (const key of Object.keys(updates) as (keyof NotificationRecord)[]) {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    }

    await this.db
      .update(pushNotifications)
      .set(updates)
      .where(eq(pushNotifications.id, _num(id)));
  }

  // Custom Prompts implementations
  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const [created] = await this.db.insert(promptTemplates).values(template).returning();
    return created;
  }

  async getPromptTemplates(filters?: { category?: string; isSystem?: boolean; isPublic?: boolean }): Promise<PromptTemplate[]> {
    let query = this.db.select().from(promptTemplates);
    const conditions: SQL[] = [];

    if (filters?.category) {
      conditions.push(eq(promptTemplates.category, filters.category));
    }
    if (filters?.isSystem !== undefined) {
      conditions.push(eq(promptTemplates.isSystem, filters.isSystem));
    }
    if (filters?.isPublic !== undefined) {
      conditions.push(eq(promptTemplates.isPublic, filters.isPublic));
    }

    if (conditions.length > 0) {
      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
      query = query.where(whereClause);
    }

    return await query.orderBy(desc(promptTemplates.usageCount), desc(promptTemplates.createdAt));
  }

  async getPromptTemplate(id: number): Promise<PromptTemplate | undefined> {
    const [template] = await this.db.select().from(promptTemplates).where(eq(promptTemplates.id, _num(id)));
    return template;
  }

  async updatePromptTemplate(id: number, template: Partial<InsertPromptTemplate>): Promise<PromptTemplate | undefined> {
    const [updated] = await this.db
      .update(promptTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(promptTemplates.id, _num(id)))
      .returning();
    return updated;
  }

  async deletePromptTemplate(id: number): Promise<boolean> {
    const deleted = await this.db.delete(promptTemplates).where(eq(promptTemplates.id, _num(id)));
    return deleted.rowCount > 0;
  }

  async createCustomPrompt(prompt: InsertCustomPrompt): Promise<CustomPrompt> {
    const [created] = await this.db.insert(customPrompts).values(prompt).returning();
    return created;
  }

  async getUserCustomPrompts(userId: string | number): Promise<CustomPrompt[]> {
    return await this.db
      .select()
      .from(customPrompts)
      .where(eq(customPrompts.userId, _num(userId)))
      .orderBy(desc(customPrompts.isFavorite), desc(customPrompts.usageCount));
  }

  async getCustomPrompt(id: number): Promise<CustomPrompt | undefined> {
    const [prompt] = await this.db.select().from(customPrompts).where(eq(customPrompts.id, _num(id)));
    return prompt;
  }

  async updateCustomPrompt(id: number, prompt: Partial<InsertCustomPrompt>): Promise<CustomPrompt | undefined> {
    const [updated] = await this.db
      .update(customPrompts)
      .set({ ...prompt, updatedAt: new Date() })
      .where(eq(customPrompts.id, _num(id)))
      .returning();
    return updated;
  }

  async deleteCustomPrompt(id: number): Promise<boolean> {
    const deleted = await this.db.delete(customPrompts).where(eq(customPrompts.id, _num(id)));
    return deleted.rowCount > 0;
  }

  async createProjectAiRule(rule: InsertProjectAiRule): Promise<ProjectAiRule> {
    const [created] = await this.db.insert(projectAiRules).values(rule).returning();
    return created;
  }

  async getProjectAiRules(projectId: string | number, activeOnly?: boolean): Promise<ProjectAiRule[]> {
    let query = this.db.select().from(projectAiRules).where(eq(projectAiRules.projectId, _num(projectId)));

    if (activeOnly) {
      query = query.where(and(eq(projectAiRules.projectId, _num(projectId)), eq(projectAiRules.isActive, true)));
    }

    return await query.orderBy(desc(projectAiRules.priority));
  }

  async getProjectAiRule(id: number): Promise<ProjectAiRule | undefined> {
    const [rule] = await this.db.select().from(projectAiRules).where(eq(projectAiRules.id, _num(id)));
    return rule;
  }

  async updateProjectAiRule(id: number, rule: Partial<InsertProjectAiRule>): Promise<ProjectAiRule | undefined> {
    const [updated] = await this.db
      .update(projectAiRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(projectAiRules.id, _num(id)))
      .returning();
    return updated;
  }

  async deleteProjectAiRule(id: number): Promise<boolean> {
    const deleted = await this.db.delete(projectAiRules).where(eq(projectAiRules.id, _num(id)));
    return deleted.rowCount > 0;
  }

  async createPromptUsageHistory(usage: InsertPromptUsageHistory): Promise<PromptUsageHistory> {
    const [created] = await this.db.insert(promptUsageHistory).values(usage).returning();

    // Update usage count for associated prompt or template
    if (usage.customPromptId) {
      await this.db
        .update(customPrompts)
        .set({
          usageCount: sql`${customPrompts.usageCount} + 1`,
          lastUsedAt: new Date()
        })
        .where(eq(customPrompts.id, usage.customPromptId));
    }
    if (usage.templateId) {
      await this.db
        .update(promptTemplates)
        .set({
          usageCount: sql`${promptTemplates.usageCount} + 1`
        })
        .where(eq(promptTemplates.id, usage.templateId));
    }

    return created;
  }

  async getPromptUsageHistory(filters: { userId: string | number; projectId: string | number; limit?: number }): Promise<PromptUsageHistory[]> {
    let query = this.db.select().from(promptUsageHistory);
    const conditions: SQL[] = [];

    if (filters.userId) {
      conditions.push(eq(promptUsageHistory.userId, filters.userId));
    }
    if (filters.projectId) {
      conditions.push(eq(promptUsageHistory.projectId, filters.projectId));
    }

    if (conditions.length > 0) {
      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
      query = query.where(whereClause);
    }

    query = query.orderBy(desc(promptUsageHistory.createdAt));

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async createPromptTemplateRating(rating: InsertPromptTemplateRating): Promise<PromptTemplateRating> {
    const [created] = await this.db.insert(promptTemplateRatings).values(rating).returning();

    // Update average rating for the template
    await this.updatePromptTemplateRating(rating.templateId);

    return created;
  }

  async getPromptTemplateRatings(templateId: number): Promise<PromptTemplateRating[]> {
    return await this.db
      .select()
      .from(promptTemplateRatings)
      .where(eq(promptTemplateRatings.templateId, templateId))
      .orderBy(desc(promptTemplateRatings.createdAt));
  }

  async updatePromptTemplateRating(templateId: number): Promise<void> {
    const ratings = await this.getPromptTemplateRatings(templateId);
    if (ratings.length > 0) {
      const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      await this.db
        .update(promptTemplates)
        .set({ rating: average })
        .where(eq(promptTemplates.id, templateId));
    }
  }

  // Initialize default prompt templates
  async initializeDefaultPromptTemplates(): Promise<void> {
    try {
      // Check if prompt_templates table has the correct schema (check for required columns)
      const columnCheck = await this.db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'prompt_templates'
        AND column_name IN ('name', 'prompt', 'variables', 'is_system')
      `);

      // Handle different result formats
      const rows = Array.isArray(columnCheck) ? columnCheck : (columnCheck.rows || []);
      if (rows.length < 4) {
        return;
      }
    } catch (error: any) {
      return;
    }

    const defaultTemplates = [
      {
        name: 'React Component Generator',
        description: 'Generate a complete React component with proper TypeScript typing and hooks',
        category: 'code_generation',
        prompt: `Generate a React functional component named {{componentName}} with TypeScript that:
- Uses proper TypeScript interfaces for props
- Includes {{hooks}} hooks if specified
- Follows React best practices
- Has proper error boundaries
- Includes JSDoc documentation
- Uses shadcn/ui components where appropriate
Component purpose: {{description}}
Props needed: {{props}}`,
        variables: [
          { name: 'componentName', description: 'Name of the component', defaultValue: 'MyComponent' },
          { name: 'hooks', description: 'React hooks to include', defaultValue: 'useState, useEffect' },
          { name: 'description', description: 'What the component does', defaultValue: '' },
          { name: 'props', description: 'Component props specification', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['react', 'component', 'typescript'],
        examples: [],
      },
      {
        name: 'API Endpoint Creator',
        description: 'Create a RESTful API endpoint with proper validation and error handling',
        category: 'code_generation',
        prompt: `Create a {{method}} API endpoint at {{endpoint}} that:
- Validates input using Zod schemas
- Implements proper error handling
- Uses async/await pattern
- Includes rate limiting
- Has comprehensive logging
- Returns appropriate HTTP status codes
Functionality: {{functionality}}
Request body: {{requestBody}}
Response format: {{responseFormat}}`,
        variables: [
          { name: 'method', description: 'HTTP method', defaultValue: 'POST' },
          { name: 'endpoint', description: 'API endpoint path', defaultValue: '/api/resource' },
          { name: 'functionality', description: 'What the endpoint does', defaultValue: '' },
          { name: 'requestBody', description: 'Expected request body structure', defaultValue: '' },
          { name: 'responseFormat', description: 'Response data format', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['api', 'backend', 'rest'],
        examples: [],
      },
      {
        name: 'Database Schema Designer',
        description: 'Design database schema with Drizzle ORM',
        category: 'architecture',
        prompt: `Design a database schema for {{entityName}} using Drizzle ORM that includes:
- Proper table definitions with appropriate column types
- Primary and foreign key constraints
- Indexes for performance
- Relations between tables
- Insert and select schemas with Zod validation
Requirements: {{requirements}}
Relationships: {{relationships}}
Fields needed: {{fields}}`,
        variables: [
          { name: 'entityName', description: 'Name of the entity/table', defaultValue: '' },
          { name: 'requirements', description: 'Business requirements', defaultValue: '' },
          { name: 'relationships', description: 'Relationships with other tables', defaultValue: '' },
          { name: 'fields', description: 'Fields and their types', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['database', 'drizzle', 'schema'],
        examples: [],
      },
      {
        name: 'Bug Fix Assistant',
        description: 'Help identify and fix bugs in code',
        category: 'debugging',
        prompt: `Analyze this {{language}} code and help fix the bug:
Error message: {{errorMessage}}
Code context: {{codeContext}}
Expected behavior: {{expectedBehavior}}
Actual behavior: {{actualBehavior}}

Please:
1. Identify the root cause
2. Provide a detailed explanation
3. Suggest a fix with code
4. Recommend prevention strategies`,
        variables: [
          { name: 'language', description: 'Programming language', defaultValue: 'TypeScript' },
          { name: 'errorMessage', description: 'Error message received', defaultValue: '' },
          { name: 'codeContext', description: 'Code around the error', defaultValue: '' },
          { name: 'expectedBehavior', description: 'What should happen', defaultValue: '' },
          { name: 'actualBehavior', description: 'What actually happens', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['debugging', 'troubleshooting'],
        examples: [],
      },
      {
        name: 'Code Refactoring Helper',
        description: 'Refactor code for better maintainability and performance',
        category: 'refactoring',
        prompt: `Refactor this {{language}} code to improve:
- Code readability and maintainability
- Performance optimization
- Design patterns implementation
- {{specificImprovements}}

Current code: {{currentCode}}
Context: {{context}}

Provide:
1. Refactored code
2. Explanation of changes
3. Performance impact analysis`,
        variables: [
          { name: 'language', description: 'Programming language', defaultValue: 'TypeScript' },
          { name: 'specificImprovements', description: 'Specific improvements needed', defaultValue: '' },
          { name: 'currentCode', description: 'Code to refactor', defaultValue: '' },
          { name: 'context', description: 'Additional context', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['refactoring', 'clean-code'],
        examples: [],
      },
      {
        name: 'Documentation Writer',
        description: 'Generate comprehensive documentation for code',
        category: 'documentation',
        prompt: `Generate documentation for this {{language}} {{codeType}}:
- Include detailed descriptions
- Add parameter documentation
- Provide usage examples
- Include return value documentation
- Add complexity analysis if applicable
Style: {{documentationStyle}}
Code: {{code}}`,
        variables: [
          { name: 'language', description: 'Programming language', defaultValue: 'TypeScript' },
          { name: 'codeType', description: 'Type of code (function, class, module)', defaultValue: 'function' },
          { name: 'documentationStyle', description: 'Documentation style (JSDoc, Markdown)', defaultValue: 'JSDoc' },
          { name: 'code', description: 'Code to document', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['documentation', 'comments'],
        examples: [],
      },
      {
        name: 'Test Generator',
        description: 'Generate comprehensive test cases',
        category: 'testing',
        prompt: `Generate {{testFramework}} tests for:
{{codeToTest}}

Requirements:
- Cover all edge cases
- Include positive and negative test cases
- Mock external dependencies
- Test error handling
- Aim for {{coverage}}% coverage
- Use {{testingApproach}} approach`,
        variables: [
          { name: 'testFramework', description: 'Testing framework', defaultValue: 'Jest' },
          { name: 'codeToTest', description: 'Code that needs testing', defaultValue: '' },
          { name: 'coverage', description: 'Target coverage percentage', defaultValue: '80' },
          { name: 'testingApproach', description: 'Testing approach (unit, integration)', defaultValue: 'unit' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['testing', 'quality-assurance'],
        examples: [],
      },
      {
        name: 'Performance Optimizer',
        description: 'Optimize code for better performance',
        category: 'performance',
        prompt: `Analyze and optimize this code for performance:
{{code}}

Focus on:
- Time complexity optimization
- Space complexity reduction
- {{specificOptimizations}}
- Database query optimization (if applicable)
- Caching strategies
Environment: {{environment}}
Constraints: {{constraints}}`,
        variables: [
          { name: 'code', description: 'Code to optimize', defaultValue: '' },
          { name: 'specificOptimizations', description: 'Specific areas to optimize', defaultValue: '' },
          { name: 'environment', description: 'Runtime environment', defaultValue: 'Node.js' },
          { name: 'constraints', description: 'Any constraints or limitations', defaultValue: '' }
        ],
        isSystem: true,
        isPublic: true,
        createdBy: 'system',
        tags: ['performance', 'optimization'],
        examples: [],
      }
    ];

    try {
      // Check if templates already exist
      const existingTemplates = await this.db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.isSystem, true));

      if (existingTemplates.length === 0) {
        // Insert default templates
        for (const template of defaultTemplates) {
          await this.db.insert(promptTemplates).values({
            ...template,
            usageCount: 0,
            rating: 0,
            variables: template.variables as any,
            tags: template.tags as any,
            examples: template.examples as any,
          });
        }
      }
    } catch (error: any) {
      // Gracefully handle table schema mismatches or missing tables
      // This is a non-critical optional feature for AI prompt templates
    }
  }

  // Added getDBStats method with error handling
  async getDBStats(): Promise<{ totalProjects: number; totalUsers: number; totalFiles: number }> {
    try {
      const [projectsResult] = await this.db.select({ count: sql<number>`COUNT(*)` }).from(projects);
      const [usersResult] = await this.db.select({ count: sql<number>`COUNT(*)` }).from(users);
      const [filesResult] = await this.db.select({ count: sql<number>`COUNT(*)` }).from(files);

      return {
        totalProjects: projectsResult?.count || 0,
        totalUsers: usersResult?.count || 0,
        totalFiles: filesResult?.count || 0
      };
    } catch (error) {
      console.error('Error getting DB stats:', error);
      return {
        totalProjects: 0,
        totalUsers: 0,
        totalFiles: 0
      };
    }
  }

  // Added getDBEntries method with error handling
  async getDBEntries(): Promise<any[]> {
    try {
      const allProjects = await this.db.select().from(projects).limit(10);
      const allUsers = await this.db.select().from(users).limit(10);
      const allFiles = await this.db.select().from(files).limit(10);

      return [
        ...allProjects.map(p => ({ type: 'project', ...p })),
        ...allUsers.map(u => ({ type: 'user', ...u })),
        ...allFiles.map(f => ({ type: 'file', ...f }))
      ];
    } catch (error) {
      console.error('Error getting DB entries:', error);
      return [];
    }
  }

  // ============================================================================
  // IDE WORKSPACE FEATURES - Implementation
  // ============================================================================

  // LSP Diagnostics Methods - For Problems Panel
  async createLspDiagnostic(diagnostic: InsertLspDiagnostic): Promise<LspDiagnostic> {
    const [created] = await this.db.insert(lspDiagnostics).values(diagnostic).returning();
    return created;
  }

  async getLspDiagnostic(id: string | number): Promise<LspDiagnostic | undefined> {
    const [diagnostic] = await this.db.select().from(lspDiagnostics).where(eq(lspDiagnostics.id, _num(id)));
    return diagnostic;
  }

  async getLspDiagnostics(projectId: string | number, filePath?: string): Promise<LspDiagnostic[]> {
    const pid = _num(projectId);
    const conditions = [eq(lspDiagnostics.projectId, pid)];
    if (filePath) {
      conditions.push(eq(lspDiagnostics.filePath, filePath));
    }
    return await this.db.select().from(lspDiagnostics)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(lspDiagnostics.createdAt));
  }

  async updateLspDiagnostic(id: string | number, updates: Partial<LspDiagnostic>): Promise<LspDiagnostic> {
    const [updated] = await this.db
      .update(lspDiagnostics)
      .set(updates)
      .where(eq(lspDiagnostics.id, _num(id)))
      .returning();
    return updated;
  }

  async deleteLspDiagnostic(id: string | number): Promise<void> {
    await this.db.delete(lspDiagnostics).where(eq(lspDiagnostics.id, _num(id)));
  }

  async clearLspDiagnostics(projectId: string | number, filePath?: string): Promise<void> {
    const pid = _num(projectId);
    const conditions = [eq(lspDiagnostics.projectId, pid)];
    if (filePath) {
      conditions.push(eq(lspDiagnostics.filePath, filePath));
    }
    await this.db.delete(lspDiagnostics)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  // Build Logs Methods - For Output Panel (fully implemented with database)
  async createBuildLog(log: InsertBuildLog): Promise<BuildLog> {
    const [created] = await this.db.insert(buildLogs).values(log).returning();
    return created;
  }

  async getBuildLogs(projectId: string | number, buildId?: string, limit: number = 1000): Promise<BuildLog[]> {
    const conditions = [eq(buildLogs.projectId, _num(projectId))];
    if (buildId) {
      conditions.push(eq(buildLogs.buildId, buildId));
    }
    return await this.db.select().from(buildLogs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(buildLogs.timestamp))
      .limit(limit);
  }

  async clearBuildLogs(projectId: string | number, buildId?: string): Promise<void> {
    const conditions = [eq(buildLogs.projectId, _num(projectId))];
    if (buildId) {
      conditions.push(eq(buildLogs.buildId, buildId));
    }
    await this.db.delete(buildLogs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  // Terminal Logs Methods - Persistent Console Logs
  async createTerminalLog(log: InsertTerminalLog): Promise<TerminalLog> {
    const [created] = await this.db.insert(terminalLogs).values(log).returning();
    return created;
  }

  async getTerminalLogs(projectId: string | number, limit: number = 1000): Promise<TerminalLog[]> {
    return await this.db
      .select()
      .from(terminalLogs)
      .where(eq(terminalLogs.projectId, _num(projectId)))
      .orderBy(desc(terminalLogs.timestamp))
      .limit(limit);
  }

  async clearTerminalLogs(projectId: string | number): Promise<void> {
    await this.db.delete(terminalLogs).where(eq(terminalLogs.projectId, _num(projectId)));
  }

  // Test Runs Methods - For Testing Panel (fully implemented with database)
  async createTestRun(run: InsertTestRun): Promise<TestRun> {
    const [created] = await this.db.insert(testRuns).values(run).returning();
    return created;
  }

  async getTestRun(id: string | number): Promise<TestRun | undefined> {
    const [run] = await this.db.select().from(testRuns).where(eq(testRuns.id, _num(id)));
    return run;
  }

  async getTestRuns(projectId: string | number, limit: number = 50): Promise<TestRun[]> {
    return await this.db
      .select()
      .from(testRuns)
      .where(eq(testRuns.projectId, _num(projectId)))
      .orderBy(desc(testRuns.startedAt))
      .limit(limit);
  }

  async updateTestRun(id: string | number, updates: Partial<TestRun>): Promise<TestRun> {
    const [updated] = await this.db
      .update(testRuns)
      .set(updates)
      .where(eq(testRuns.id, _num(id)))
      .returning();
    return updated;
  }

  async createTestCase(testCase: InsertTestCase): Promise<TestCase> {
    const [created] = await this.db.insert(testCases).values(testCase).returning();
    return created;
  }

  async getTestCases(testRunId: string): Promise<TestCase[]> {
    return await this.db
      .select()
      .from(testCases)
      .where(eq(testCases.testRunId, testRunId))
      .orderBy(testCases.suiteName, testCases.testName);
  }

  async updateTestCase(id: string | number, updates: Partial<TestCase>): Promise<TestCase> {
    const [updated] = await this.db
      .update(testCases)
      .set(updates)
      .where(eq(testCases.id, _num(id)))
      .returning();
    return updated;
  }

  // Security Scans Methods - For Security Scanner Panel (fully implemented with database)
  async createSecurityScan(scan: InsertSecurityScan): Promise<SecurityScan> {
    const [created] = await this.db.insert(securityScans).values(scan).returning();
    return created;
  }

  async getSecurityScan(id: string | number): Promise<SecurityScan | undefined> {
    const [scan] = await this.db.select().from(securityScans).where(eq(securityScans.id, _num(id)));
    return scan;
  }

  async getSecurityScans(projectId: string | number, limit: number = 50): Promise<SecurityScan[]> {
    return await this.db
      .select()
      .from(securityScans)
      .where(eq(securityScans.projectId, _num(projectId)))
      .orderBy(desc(securityScans.startedAt))
      .limit(limit);
  }

  async updateSecurityScan(id: string | number, updates: Partial<SecurityScan>): Promise<SecurityScan> {
    const [updated] = await this.db
      .update(securityScans)
      .set(updates)
      .where(eq(securityScans.id, _num(id)))
      .returning();
    return updated;
  }

  async createVulnerability(vulnerability: InsertVulnerability): Promise<Vulnerability> {
    const [created] = await this.db.insert(vulnerabilities).values(vulnerability).returning();
    return created;
  }

  async getVulnerabilities(scanId: string): Promise<Vulnerability[]> {
    return await this.db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.scanId, scanId))
      .orderBy(desc(vulnerabilities.severity), vulnerabilities.title);
  }

  async getProjectVulnerabilities(projectId: string | number, status?: string): Promise<Vulnerability[]> {
    let query = this.db.select().from(vulnerabilities).where(eq(vulnerabilities.projectId, _num(projectId)));
    
    if (status) {
      query = query.where(eq(vulnerabilities.status, status));
    }

    return await query.orderBy(desc(vulnerabilities.discoveredAt));
  }

  async updateVulnerability(id: string | number, updates: Partial<Vulnerability>): Promise<Vulnerability> {
    const [updated] = await this.db
      .update(vulnerabilities)
      .set(updates)
      .where(eq(vulnerabilities.id, _num(id)))
      .returning();
    return updated;
  }

  async getProjectVulnerabilitiesByHidden(projectId: string | number, isHidden: boolean): Promise<Vulnerability[]> {
    return await this.db.select().from(vulnerabilities)
      .where(and(
        eq(vulnerabilities.projectId, _num(projectId)),
        eq(vulnerabilities.isHidden, isHidden)
      ))
      .orderBy(desc(vulnerabilities.discoveredAt));
  }

  // Security Scan Settings Methods
  async getSecurityScanSettings(projectId: string | number): Promise<SecurityScanSettings | undefined> {
    const [settings] = await this.db.select().from(securityScanSettings)
      .where(eq(securityScanSettings.projectId, _num(projectId)));
    return settings;
  }

  async upsertSecurityScanSettings(projectId: string | number, updates: Partial<InsertSecurityScanSettings>): Promise<SecurityScanSettings> {
    const projectIdNum = _num(projectId);
    const existing = await this.getSecurityScanSettings(projectId);
    
    if (existing) {
      const [updated] = await this.db
        .update(securityScanSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(securityScanSettings.projectId, projectIdNum))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(securityScanSettings)
        .values({ projectId: projectIdNum, ...updates })
        .returning();
      return created;
    }
  }

  // Resource Metrics Methods - For Resources Panel (fully implemented with database)
  async createResourceMetric(metric: InsertResourceMetric): Promise<ResourceMetric> {
    const [created] = await this.db.insert(resourceMetrics).values(metric).returning();
    return created;
  }

  async getResourceMetrics(projectId: string | number, limit: number = 100): Promise<ResourceMetric[]> {
    return await this.db
      .select()
      .from(resourceMetrics)
      .where(eq(resourceMetrics.projectId, _num(projectId)))
      .orderBy(desc(resourceMetrics.timestamp))
      .limit(limit);
  }

  async getLatestResourceMetrics(projectId: string | number): Promise<ResourceMetric | undefined> {
    const [metric] = await this.db
      .select()
      .from(resourceMetrics)
      .where(eq(resourceMetrics.projectId, _num(projectId)))
      .orderBy(desc(resourceMetrics.timestamp))
      .limit(1);
    return metric;
  }

  // Pane Configurations Methods - For Split Editor (fully implemented with database)
  async createPaneConfiguration(config: InsertPaneConfiguration): Promise<PaneConfiguration> {
    const [created] = await this.db.insert(paneConfigurations).values(config).returning();
    return created;
  }

  async getPaneConfiguration(id: string | number): Promise<PaneConfiguration | undefined> {
    const [config] = await this.db.select().from(paneConfigurations).where(eq(paneConfigurations.id, _num(id)));
    return config;
  }

  async getUserPaneConfigurations(userId: string | number, projectId: string | number): Promise<PaneConfiguration[]> {
    let query = this.db.select().from(paneConfigurations).where(eq(paneConfigurations.userId, _num(userId)));
    
    if (projectId) {
      query = query.where(eq(paneConfigurations.projectId, _num(projectId)));
    }

    return await query.orderBy(desc(paneConfigurations.updatedAt));
  }

  async updatePaneConfiguration(id: string | number, updates: Partial<PaneConfiguration>): Promise<PaneConfiguration> {
    const [updated] = await this.db
      .update(paneConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paneConfigurations.id, _num(id)))
      .returning();
    return updated;
  }

  async deletePaneConfiguration(id: string | number): Promise<void> {
    await this.db.delete(paneConfigurations).where(eq(paneConfigurations.id, _num(id)));
  }

  // Team membership check - For access control
  async getTeamMemberByUserAndProject(userId: string | number, projectId: string | number): Promise<any | undefined> {
    try {
      // Get the team associated with this project (if any)
      const project = await this.db.query.projects.findFirst({
        where: eq(projects.id, _num(projectId)),
        with: {
          owner: {
            with: {
              teams: {
                with: {
                  members: {
                    where: eq(teamMembers.userId, _num(userId))
                  }
                }
              }
            }
          }
        }
      });

      // Check if user is a member of any team associated with the project
      const teams = project?.owner?.teams || [];
      for (const team of teams) {
        const member = team.members?.find(m => m.userId === userId);
        if (member) {
          return member;
        }
      }

      // Alternative: Direct team membership lookup
      const [directMember] = await this.db
        .select()
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(
          eq(teamMembers.userId, _num(userId)),
          // Note: This assumes team.projectId exists or similar relationship
          // Adjust based on actual schema relationships
          sql`${teams.id} IN (SELECT team_id FROM team_project_access WHERE project_id = ${projectId})`
        ))
        .limit(1)
        .catch((err) => {
          // Expected: relationship may not exist yet for new teams
          console.debug('[Storage] Team member query skipped:', err.message);
          return [];
        });

      return directMember || undefined;
    } catch (error) {
      console.error('[Storage] Error checking team membership:', error);
      return undefined;
    }
  }

  // ============================================================================
  // AI APPROVAL QUEUE - Fortune 500 Security
  // ============================================================================

  async createAiApproval(approval: InsertAiApprovalQueue): Promise<AiApprovalQueue> {
    const [created] = await this.db.insert(aiApprovalQueue).values(approval).returning();
    return created;
  }

  async getAiApproval(id: string | number): Promise<AiApprovalQueue | undefined> {
    const [approval] = await this.db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.id, _num(id)));
    return approval;
  }

  async getPendingAiApprovals(userId: string | number, projectId: string | number): Promise<AiApprovalQueue[]> {
    return await this.db
      .select()
      .from(aiApprovalQueue)
      .where(
        and(
          eq(aiApprovalQueue.userId, _num(userId)),
          eq(aiApprovalQueue.projectId, _num(projectId)),
          eq(aiApprovalQueue.status, 'pending'),
          sql`${aiApprovalQueue.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(aiApprovalQueue.createdAt));
  }

  async updateAiApprovalStatus(
    id: string | number,
    status: string,
    processedBy: string,
    rejectionReason?: string
  ): Promise<AiApprovalQueue> {
    const [updated] = await this.db
      .update(aiApprovalQueue)
      .set({
        status,
        processedAt: new Date(),
        processedBy,
        rejectionReason,
      })
      .where(eq(aiApprovalQueue.id, _num(id)))
      .returning();
    return updated;
  }

  async expireOldAiApprovals(): Promise<number> {
    const result = await this.db
      .update(aiApprovalQueue)
      .set({ status: 'expired' })
      .where(
        and(
          eq(aiApprovalQueue.status, 'pending'),
          sql`${aiApprovalQueue.expiresAt} <= NOW()`
        )
      );
    return result.rowCount || 0;
  }

  // ============================================================================
  // AI AUDIT LOGS - Compliance-grade audit trail
  // ============================================================================

  async createAiAuditLog(log: InsertAiAuditLog): Promise<AiAuditLog> {
    const [created] = await this.db.insert(aiAuditLogs).values(log).returning();
    return created;
  }

  async getAiAuditLogs(filters: {
    userId: string | number;
    projectId: string | number;
    approvalId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AiAuditLog[]> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(aiAuditLogs.userId, filters.userId));
    }
    if (filters.projectId) {
      conditions.push(eq(aiAuditLogs.projectId, filters.projectId));
    }
    if (filters.approvalId) {
      conditions.push(eq(aiAuditLogs.approvalId, filters.approvalId));
    }
    if (filters.startDate) {
      conditions.push(sql`${aiAuditLogs.timestamp} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${aiAuditLogs.timestamp} <= ${filters.endDate}`);
    }

    return await this.db
      .select()
      .from(aiAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiAuditLogs.timestamp))
      .limit(filters.limit || 100);
  }

  // ============================================================================
  // BOUNTIES SYSTEM - Marketplace with Stripe Connect
  // ============================================================================

  async createBounty(bounty: InsertBounty): Promise<Bounty> {
    const [created] = await this.db.insert(bounties).values(bounty).returning();
    return created;
  }

  async getBounty(id: number): Promise<Bounty | undefined> {
    const [bounty] = await this.db.select().from(bounties).where(eq(bounties.id, _num(id)));
    return bounty;
  }

  async updateBounty(id: number, updates: Partial<Bounty>): Promise<Bounty | undefined> {
    const [updated] = await this.db
      .update(bounties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bounties.id, _num(id)))
      .returning();
    return updated;
  }

  async listBounties(filters: {
    status?: string;
    minAmount?: number;
    maxAmount?: number;
    skills?: string[];
    isPublic?: boolean;
    featured?: boolean;
    difficulty?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bounties: Bounty[]; total: number; page: number; limit: number }> {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(bounties.status, filters.status as any));
    }
    if (filters.minAmount !== undefined) {
      conditions.push(sql`${bounties.amount} >= ${filters.minAmount}`);
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(sql`${bounties.amount} <= ${filters.maxAmount}`);
    }
    if (filters.skills && filters.skills.length > 0) {
      conditions.push(sql`${bounties.skills} ?| array[${sql.join(filters.skills.map(s => sql`${s}`), sql`, `)}]`);
    }
    if (filters.isPublic !== undefined) {
      conditions.push(eq(bounties.isPublic, filters.isPublic));
    }
    if (filters.featured !== undefined) {
      conditions.push(eq(bounties.featured, filters.featured));
    }
    if (filters.difficulty) {
      conditions.push(eq(bounties.difficulty, filters.difficulty));
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let orderBy;
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    switch (filters.sortBy) {
      case 'amount':
        orderBy = sortOrder === 'asc' ? bounties.amount : desc(bounties.amount);
        break;
      case 'deadline':
        orderBy = sortOrder === 'asc' ? bounties.deadline : desc(bounties.deadline);
        break;
      case 'views':
        orderBy = sortOrder === 'asc' ? bounties.viewsCount : desc(bounties.viewsCount);
        break;
      case 'applications':
        orderBy = sortOrder === 'asc' ? bounties.applicationsCount : desc(bounties.applicationsCount);
        break;
      default:
        orderBy = sortOrder === 'asc' ? bounties.createdAt : desc(bounties.createdAt);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bounties)
      .where(whereClause);

    const result = await this.db
      .select()
      .from(bounties)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      bounties: result,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }

  async getCreatedBounties(creatorId: number): Promise<Bounty[]> {
    return await this.db
      .select()
      .from(bounties)
      .where(eq(bounties.authorId, creatorId))
      .orderBy(desc(bounties.createdAt));
  }

  async getAssignedBounties(assigneeId: number): Promise<Bounty[]> {
    return await this.db
      .select()
      .from(bounties)
      .where(eq(bounties.assigneeId, assigneeId))
      .orderBy(desc(bounties.createdAt));
  }

  async getAppliedBounties(userId: number): Promise<Bounty[]> {
    const submissions = await this.db
      .select({ bountyId: bountySubmissions.bountyId })
      .from(bountySubmissions)
      .where(eq(bountySubmissions.userId, _num(userId)));

    if (submissions.length === 0) {
      return [];
    }

    const bountyIds = submissions.map(s => s.bountyId);
    return await this.db
      .select()
      .from(bounties)
      .where(inArray(bounties.id, bountyIds))
      .orderBy(desc(bounties.createdAt));
  }

  // Bounty Submissions

  async createBountySubmission(submission: InsertBountySubmission): Promise<BountySubmission> {
    const [created] = await this.db.insert(bountySubmissions).values(submission).returning();
    return created;
  }

  async getBountySubmissions(bountyId: number): Promise<BountySubmission[]> {
    return await this.db
      .select()
      .from(bountySubmissions)
      .where(eq(bountySubmissions.bountyId, bountyId))
      .orderBy(desc(bountySubmissions.submittedAt));
  }

  async getBountySubmissionByUserAndBounty(userId: number, bountyId: number): Promise<BountySubmission | undefined> {
    const [submission] = await this.db
      .select()
      .from(bountySubmissions)
      .where(and(
        eq(bountySubmissions.userId, _num(userId)),
        eq(bountySubmissions.bountyId, bountyId)
      ));
    return submission;
  }

  async updateBountySubmission(id: number, updates: Partial<BountySubmission>): Promise<BountySubmission | undefined> {
    const [updated] = await this.db
      .update(bountySubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bountySubmissions.id, _num(id)))
      .returning();
    return updated;
  }

  // Bounty Reviews

  async createBountyReview(review: InsertBountyReview): Promise<BountyReview> {
    const [created] = await this.db.insert(bountyReviews).values(review).returning();
    return created;
  }

  async getBountyReviews(bountyId: number): Promise<BountyReview[]> {
    return await this.db
      .select()
      .from(bountyReviews)
      .where(eq(bountyReviews.bountyId, bountyId))
      .orderBy(desc(bountyReviews.createdAt));
  }

  async getBountyReviewByReviewerAndBounty(reviewerId: number, bountyId: number): Promise<BountyReview | undefined> {
    const [review] = await this.db
      .select()
      .from(bountyReviews)
      .where(and(
        eq(bountyReviews.reviewerId, reviewerId),
        eq(bountyReviews.bountyId, bountyId)
      ));
    return review;
  }

  async getHunterReviews(hunterId: number): Promise<BountyReview[]> {
    return await this.db
      .select()
      .from(bountyReviews)
      .where(and(
        eq(bountyReviews.hunterId, hunterId),
        eq(bountyReviews.reviewType, 'hunter_review')
      ))
      .orderBy(desc(bountyReviews.createdAt));
  }

  async getPosterReviews(posterId: number): Promise<BountyReview[]> {
    return await this.db
      .select()
      .from(bountyReviews)
      .where(and(
        eq(bountyReviews.reviewerId, posterId),
        eq(bountyReviews.reviewType, 'poster_review')
      ))
      .orderBy(desc(bountyReviews.createdAt));
  }

  async getFeaturedBounties(limit: number = 10): Promise<Bounty[]> {
    return await this.db
      .select()
      .from(bounties)
      .where(and(
        eq(bounties.featured, true),
        eq(bounties.isPublic, true),
        eq(bounties.status, 'open')
      ))
      .orderBy(desc(bounties.createdAt))
      .limit(limit);
  }

  async incrementBountyViews(bountyId: number): Promise<void> {
    await this.db
      .update(bounties)
      .set({ viewsCount: sql`${bounties.viewsCount} + 1` })
      .where(eq(bounties.id, bountyId));
  }

  async incrementBountyApplications(bountyId: number): Promise<void> {
    await this.db
      .update(bounties)
      .set({ applicationsCount: sql`${bounties.applicationsCount} + 1` })
      .where(eq(bounties.id, bountyId));
  }

  async getBountyReviewByTypeAndBounty(
    reviewType: string,
    bountyId: number,
    reviewerId: number
  ): Promise<BountyReview | undefined> {
    const [review] = await this.db
      .select()
      .from(bountyReviews)
      .where(and(
        eq(bountyReviews.bountyId, bountyId),
        eq(bountyReviews.reviewerId, reviewerId),
        eq(bountyReviews.reviewType, reviewType)
      ));
    return review;
  }

  async getUserAverageRating(
    userId: number,
    reviewType: 'hunter_review' | 'poster_review'
  ): Promise<number | null> {
    const targetColumn = reviewType === 'hunter_review' 
      ? bountyReviews.hunterId 
      : bountyReviews.reviewerId;

    const [result] = await this.db
      .select({ avgRating: sql<number>`avg(${bountyReviews.rating})::numeric(3,2)` })
      .from(bountyReviews)
      .where(and(
        eq(targetColumn, userId),
        eq(bountyReviews.reviewType, reviewType)
      ));

    return result?.avgRating || null;
  }

  async getProjectAuthConfig(projectId: number): Promise<ProjectAuthConfig | null> {
    const [config] = await this.db
      .select()
      .from(projectAuthConfig)
      .where(eq(projectAuthConfig.projectId, _num(projectId)));
    return config || null;
  }

  async upsertProjectAuthConfig(projectId: number, config: Partial<InsertProjectAuthConfig>): Promise<ProjectAuthConfig> {
    const existing = await this.getProjectAuthConfig(projectId);
    if (existing) {
      const [updated] = await this.db
        .update(projectAuthConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(projectAuthConfig.projectId, _num(projectId)))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(projectAuthConfig)
        .values({ projectId: _num(projectId), ...config })
        .returning();
      return created;
    }
  }

  async getProjectAuthUsers(projectId: number, limit = 50): Promise<ProjectAuthUser[]> {
    return this.db
      .select()
      .from(projectAuthUsers)
      .where(eq(projectAuthUsers.projectId, _num(projectId)))
      .orderBy(desc(projectAuthUsers.createdAt))
      .limit(limit);
  }

  async addProjectAuthUser(user: InsertProjectAuthUser): Promise<ProjectAuthUser> {
    const [created] = await this.db
      .insert(projectAuthUsers)
      .values(user)
      .onConflictDoUpdate({
        target: [projectAuthUsers.projectId, projectAuthUsers.email],
        set: { lastSignIn: new Date(), name: user.name, avatar: user.avatar },
      })
      .returning();
    return created;
  }

  async deleteProjectAuthUser(projectId: number, userId: number): Promise<boolean> {
    const result = await this.db
      .delete(projectAuthUsers)
      .where(and(eq(projectAuthUsers.id, _num(userId)), eq(projectAuthUsers.projectId, _num(projectId))));
    return (result as any).rowCount > 0;
  }

  // Support Ticket operations
  async getSupportTickets(filter?: { status?: string; userId?: number; assignedTo?: number }): Promise<SupportTicket[]> {
    const conditions = [];
    if (filter?.status) conditions.push(eq(supportTickets.status, filter.status));
    if (filter?.userId) conditions.push(eq(supportTickets.userId, filter.userId));
    if (filter?.assignedTo) conditions.push(eq(supportTickets.assignedTo, filter.assignedTo));
    const query = this.db.select().from(supportTickets);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
    }
    return await query.orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    const [ticket] = await this.db.select().from(supportTickets).where(eq(supportTickets.id, _num(id)));
    return ticket;
  }

  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    return await this.db.select().from(ticketReplies)
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(ticketReplies.createdAt);
  }

  async createTicketReply(reply: InsertTicketReply): Promise<TicketReply> {
    const [created] = await this.db.insert(ticketReplies).values(reply).returning();
    return created;
  }

  async updateSupportTicket(id: number, update: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const [updated] = await this.db.update(supportTickets)
      .set({ ...update, updatedAt: new Date() } as any)
      .where(eq(supportTickets.id, _num(id)))
      .returning();
    return updated;
  }

  // CMS operations
  async getCmsPages(): Promise<CmsPage[]> {
    return await this.db.select().from(cmsPages).orderBy(desc(cmsPages.updatedAt));
  }

  async getCmsPage(id: number): Promise<CmsPage | undefined> {
    const [page] = await this.db.select().from(cmsPages).where(eq(cmsPages.id, _num(id)));
    return page;
  }

  async getCmsPageBySlug(slug: string): Promise<CmsPage | undefined> {
    const [page] = await this.db.select().from(cmsPages).where(eq(cmsPages.slug, slug));
    return page;
  }

  async createCmsPage(page: InsertCmsPage): Promise<CmsPage> {
    const [created] = await this.db.insert(cmsPages).values(page as any).returning();
    return created;
  }

  async updateCmsPage(id: number, update: Partial<CmsPage>): Promise<CmsPage | undefined> {
    const [updated] = await this.db.update(cmsPages)
      .set({ ...update, updatedAt: new Date() } as any)
      .where(eq(cmsPages.id, _num(id)))
      .returning();
    return updated;
  }

  async deleteCmsPage(id: number): Promise<boolean> {
    const result = await this.db.delete(cmsPages).where(eq(cmsPages.id, _num(id))).returning();
    return result.length > 0;
  }

  // Documentation operations
  async getDocumentation(): Promise<Documentation[]> {
    return await this.db.select().from(documentation).orderBy(documentation.order, desc(documentation.createdAt));
  }

  async getDocumentationByCategory(categoryId: number): Promise<Documentation[]> {
    return await this.db.select().from(documentation)
      .where(eq(documentation.categoryId, categoryId))
      .orderBy(documentation.order);
  }

  async createDocumentation(doc: InsertDocumentation): Promise<Documentation> {
    const [created] = await this.db.insert(documentation).values(doc as any).returning();
    return created;
  }

  async updateDocumentation(id: number, update: Partial<Documentation>): Promise<Documentation | undefined> {
    const [updated] = await this.db.update(documentation)
      .set({ ...update, updatedAt: new Date() } as any)
      .where(eq(documentation.id, _num(id)))
      .returning();
    return updated;
  }

  async getDocCategories(): Promise<DocCategory[]> {
    return await this.db.select().from(docCategories).orderBy(docCategories.order, docCategories.name);
  }

  async createDocCategory(category: InsertDocCategory): Promise<DocCategory> {
    const [created] = await this.db.insert(docCategories).values(category as any).returning();
    return created;
  }

  // Subscription operations
  async getUserSubscriptions(filter?: { userId?: number; status?: string }): Promise<UserSubscription[]> {
    const conditions = [];
    if (filter?.userId) conditions.push(eq(userSubscriptions.userId, filter.userId));
    if (filter?.status) conditions.push(eq(userSubscriptions.status, filter.status));
    const query = this.db.select().from(userSubscriptions);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(userSubscriptions.createdAt));
    }
    return await query.orderBy(desc(userSubscriptions.createdAt));
  }

  async getUserActiveSubscription(userId: number): Promise<UserSubscription | undefined> {
    const [sub] = await this.db.select().from(userSubscriptions)
      .where(and(eq(userSubscriptions.userId, _num(userId)), eq(userSubscriptions.status, 'active')))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async createUserSubscription(sub: InsertUserSubscription): Promise<UserSubscription> {
    const [created] = await this.db.insert(userSubscriptions).values(sub as any).returning();
    return created;
  }

  async updateUserSubscription(id: number, update: Partial<UserSubscription>): Promise<UserSubscription | undefined> {
    const [updated] = await this.db.update(userSubscriptions)
      .set({ ...update, updatedAt: new Date() } as any)
      .where(eq(userSubscriptions.id, _num(id)))
      .returning();
    return updated;
  }

  // Admin Activity Log operations
  async createAdminActivityLog(log: InsertAdminActivityLog): Promise<AdminActivityLog> {
    const [created] = await this.db.insert(adminActivityLogs).values(log as any).returning();
    return created;
  }

  async getAdminActivityLogs(filter?: { adminId?: number; entityType?: string }): Promise<AdminActivityLog[]> {
    const conditions = [];
    if (filter?.adminId) conditions.push(eq(adminActivityLogs.adminId, filter.adminId));
    if (filter?.entityType) conditions.push(eq(adminActivityLogs.entityType, filter.entityType));
    const query = this.db.select().from(adminActivityLogs);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(adminActivityLogs.createdAt));
    }
    return await query.orderBy(desc(adminActivityLogs.createdAt));
  }

  // ── Project limits & analytics ────────────────────────────────────────────

  async checkProjectLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const rows = await this.db.select().from(projects).where(eq(projects.userId, _num(userId)));
    const current = rows.length;
    const limit = 500;
    return { allowed: current < limit, current, limit };
  }

  async trackEvent(userId: string | null, event: string, properties?: Record<string, any>): Promise<void> {
    console.log(`[trackEvent] user=${userId} event=${event}`, properties ?? {});
  }

  // ── Artifacts ─────────────────────────────────────────────────────────────

  async createArtifact(data: { projectId: string; name: string; type?: string; entryFile?: string | null; settings?: Record<string, unknown> }): Promise<Artifact> {
    const [artifact] = await this.db.insert(artifacts).values({
      projectId: data.projectId,
      name: data.name,
      type: data.type ?? 'web-app',
      entryFile: data.entryFile ?? null,
      settings: data.settings ?? {},
    }).returning();
    return artifact;
  }

  // ── Workflows ─────────────────────────────────────────────────────────────

  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await this.db.insert(workflows).values(data).returning();
    return workflow;
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await this.db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  async getWorkflowsByProject(projectId: string): Promise<Workflow[]> {
    return this.db.select().from(workflows).where(eq(workflows.projectId, projectId));
  }

  async createWorkflowStep(data: InsertWorkflowStep): Promise<WorkflowStep> {
    const [step] = await this.db.insert(workflowSteps).values(data).returning();
    return step;
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return this.db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflowId)).orderBy(workflowSteps.orderIndex);
  }

  async seedDemoProject(): Promise<void> {
    console.log("[seed] Demo project seed (no-op)");
  }

  async seedPlanConfigs(): Promise<void> {
    console.log("[seed] Plan configs seed (no-op)");
  }

  async seedIntegrationCatalog(): Promise<void> {
    console.log("[seed] Integration catalog seed (no-op)");
  }

  async seedOfficialFrameworks(): Promise<void> {
    console.log("[seed] Official frameworks seed (no-op)");
  }

  async seedArtifactTemplates(): Promise<void> {
    console.log("[seed] Artifact templates seed (no-op)");
  }

  async getApiKeys(userId: string): Promise<any[]> {
    const rows = await this.db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(eq(apiKeys.userId, String(userId))).orderBy(desc(apiKeys.createdAt));
    return rows;
  }

  async createApiKey(userId: string, name: string): Promise<{ key: string; record: any }> {
    const rawKey = `ecode_${crypto.randomUUID().replace(/-/g, '')}`;
    const prefix = rawKey.slice(0, 12) + '...' + rawKey.slice(-4);
    const { createHash } = await import('crypto');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const id = crypto.randomUUID();
    const [row] = await this.db.insert(apiKeys).values({
      id,
      userId: String(userId),
      name,
      keyPrefix: prefix,
      keyHash,
    }).returning();
    return { key: rawKey, record: { id: row.id, name: row.name, keyPrefix: prefix, createdAt: row.createdAt, expiresAt: row.expiresAt, lastUsedAt: row.lastUsedAt } };
  }

  async deleteApiKey(userId: string, keyId: string): Promise<boolean> {
    const result = await this.db.delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, String(userId))));
    return true;
  }

  async getSshKeys(userId: string): Promise<SshKey[]> {
    const rows = await this.db.select().from(sshKeys)
      .where(eq(sshKeys.userId, String(userId)))
      .orderBy(desc(sshKeys.createdAt));
    return rows;
  }

  async createSshKey(userId: string, label: string, publicKey: string): Promise<SshKey> {
    const { createHash } = await import('crypto');
    const keyBody = publicKey.trim().split(/\s+/).slice(1, 2).join('');
    let fingerprint: string;
    try {
      fingerprint = 'SHA256:' + createHash('sha256').update(Buffer.from(keyBody, 'base64')).digest('base64').replace(/=+$/, '');
    } catch {
      fingerprint = 'SHA256:' + createHash('sha256').update(publicKey).digest('base64').replace(/=+$/, '');
    }
    const id = crypto.randomUUID();
    const insertVals: any = {
      id,
      userId: String(userId),
      label,
      publicKey,
      fingerprint,
    };
    const [row] = await this.db.insert(sshKeys).values(insertVals).returning();
    return row;
  }

  async deleteSshKey(userId: string, keyId: string): Promise<boolean> {
    await this.db.delete(sshKeys)
      .where(and(eq(sshKeys.id, keyId), eq(sshKeys.userId, String(userId))));
    return true;
  }

  async getWebhooks(userId: string): Promise<Webhook[]> {
    const rows = await this.db.select().from(webhooks)
      .where(eq(webhooks.userId, String(userId)))
      .orderBy(desc(webhooks.createdAt));
    return rows;
  }

  async createWebhook(userId: string, url: string, events: string[]): Promise<Webhook> {
    const { randomBytes } = await import('crypto');
    const secret = 'whsec_' + randomBytes(24).toString('hex');
    const id = crypto.randomUUID();
    const [row] = await this.db.insert(webhooks).values({
      id,
      userId: String(userId),
      url,
      events: events as any,
      secret,
    }).returning();
    return row;
  }

  async updateWebhook(userId: string, webhookId: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const allowedUpdates: any = {};
    if (updates.url !== undefined) allowedUpdates.url = updates.url;
    if (updates.events !== undefined) allowedUpdates.events = updates.events;
    if (updates.active !== undefined) allowedUpdates.active = updates.active;
    const [row] = await this.db.update(webhooks)
      .set(allowedUpdates)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, String(userId))))
      .returning();
    return row || null;
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<boolean> {
    await this.db.delete(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, String(userId))));
    return true;
  }

  async getIntegrationCatalog(): Promise<IntegrationCatalogEntry[]> {
    const rows = await this.db.select().from(integrationCatalog).orderBy(integrationCatalog.category, integrationCatalog.name);
    return rows;
  }

  async getProjectIntegrations(projectId: string): Promise<(ProjectIntegration & { integration: IntegrationCatalogEntry })[]> {
    const rows = await this.db
      .select()
      .from(projectIntegrations)
      .where(eq(projectIntegrations.projectId, projectId));
    if (rows.length === 0) return [];
    const catalog = await this.getIntegrationCatalog();
    const catalogMap = new Map(catalog.map(c => [c.id, c]));
    return rows.map(r => ({
      ...r,
      integration: catalogMap.get(r.integrationId) || {
        id: r.integrationId,
        name: "Unknown",
        category: "Other",
        description: "",
        icon: "plug",
        envVarKeys: [],
        connectorType: "apikey",
        connectionLevel: "project",
        oauthConfig: null,
        providerUrl: null,
      },
    })) as any;
  }

  async connectIntegration(projectId: string, integrationId: string, config: Record<string, string>): Promise<ProjectIntegration> {
    const id = crypto.randomUUID();
    const [row] = await this.db
      .insert(projectIntegrations)
      .values({ id, projectId, integrationId, config, status: "pending" })
      .returning();
    return row;
  }

  async disconnectIntegration(projectId: string, integrationId: string): Promise<boolean> {
    const result = await this.db
      .delete(projectIntegrations)
      .where(and(eq(projectIntegrations.projectId, projectId), eq(projectIntegrations.id, integrationId)));
    return (result as any)?.rowCount > 0 || true;
  }

  async updateIntegrationStatus(piId: string, status: string): Promise<void> {
    await this.db
      .update(projectIntegrations)
      .set({ status })
      .where(eq(projectIntegrations.id, piId));
  }

  async addIntegrationLog(piId: string, level: string, message: string): Promise<void> {
    await this.db
      .insert(integrationLogs)
      .values({ id: crypto.randomUUID(), projectIntegrationId: piId, level, message });
  }

  async getIntegrationLogs(projectId: string, integrationId: string, limit: number = 50): Promise<IntegrationLog[]> {
    const rows = await this.db
      .select()
      .from(integrationLogs)
      .where(eq(integrationLogs.projectIntegrationId, integrationId))
      .orderBy(desc(integrationLogs.createdAt))
      .limit(limit);
    return rows;
  }

  async getUserConnections(userId: string): Promise<UserConnection[]> {
    const rows = await this.db
      .select()
      .from(userConnections)
      .where(eq(userConnections.userId, userId));
    return rows;
  }

  private generateSlug(name: string, projectId: string | number): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    return `${base}-${String(projectId).slice(0, 8)}`;
  }

  async publishProject(projectId: string | number, userId: string | number): Promise<Project | undefined> {
    const pid = String(projectId);
    const uid = String(userId);
    const ownerFilter = and(eq(projects.id, pid), eq(projects.userId, uid));

    const [project] = await this.db.select().from(projects).where(ownerFilter);
    if (!project) return undefined;

    const slug = project.publishedSlug || this.generateSlug(project.name, projectId);

    const [updated] = await this.db
      .update(projects)
      .set({ isPublished: true, publishedSlug: slug, updatedAt: new Date() })
      .where(ownerFilter)
      .returning();
    return updated;
  }

  async publishAsFramework(projectId: string | number, userId: string | number, opts: { description?: string; category?: string; coverUrl?: string }): Promise<Project | undefined> {
    const pid = String(projectId);
    const uid = String(userId);
    const ownerFilter = and(eq(projects.id, pid), eq(projects.userId, uid));

    const [project] = await this.db.select().from(projects).where(ownerFilter);
    if (!project) return undefined;

    const slug = project.publishedSlug || this.generateSlug(project.name, projectId);

    const [updated] = await this.db
      .update(projects)
      .set({
        isPublished: true,
        publishedSlug: slug,
        isDevFramework: true,
        frameworkDescription: opts.description ?? project.frameworkDescription,
        frameworkCategory: opts.category ?? project.frameworkCategory,
        frameworkCoverUrl: opts.coverUrl ?? project.frameworkCoverUrl,
        updatedAt: new Date(),
      })
      .where(ownerFilter)
      .returning();
    return updated;
  }

  async unpublishFramework(projectId: string | number, userId: string | number): Promise<Project | undefined> {
    const pid = String(projectId);
    const uid = String(userId);
    const ownerFilter = and(eq(projects.id, pid), eq(projects.userId, uid));

    const [project] = await this.db.select().from(projects).where(ownerFilter);
    if (!project) return undefined;

    const [updated] = await this.db
      .update(projects)
      .set({ isDevFramework: false, updatedAt: new Date() })
      .where(ownerFilter)
      .returning();
    return updated;
  }
}

// Initialize storage
const _storageImpl = new DatabaseStorage();

export const storage: DatabaseStorage = new Proxy(_storageImpl, {
  get(target: any, prop: string) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string' && prop !== 'then') {
      return async (...args: any[]) => {
        console.warn(`[storage] Method '${prop}' not implemented, returning empty result`);
        if (prop.startsWith('get') || prop.startsWith('list') || prop.startsWith('search') || prop.startsWith('find')) {
          return prop.includes('By') || prop.includes('get') && !prop.endsWith('s') ? null : [];
        }
        if (prop.startsWith('create') || prop.startsWith('add') || prop.startsWith('update') || prop.startsWith('upsert')) {
          return {};
        }
        if (prop.startsWith('delete') || prop.startsWith('remove') || prop.startsWith('mark') || prop.startsWith('hide') || prop.startsWith('unhide')) {
          return true;
        }
        if (prop.startsWith('seed') || prop.startsWith('init') || prop.startsWith('record') || prop.startsWith('increment') || prop.startsWith('deduct') || prop.startsWith('track')) {
          return undefined;
        }
        if (prop.startsWith('check') || prop.startsWith('is') || prop.startsWith('verify') || prop.startsWith('validate')) {
          return false;
        }
        return null;
      };
    }
    return undefined;
  }
}) as any;

export const getStorage = () => storage;

// Initialize default templates on startup
(async () => {
  try {
    await storage.initializeDefaultPromptTemplates();
  } catch (error) {
    console.error('Failed to initialize default prompt templates:', error);
  }
})();

// Helper to get DATABASE_URL from env or /tmp/replitdb (production mode)
function getSessionDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  try {
    const replitDbPath = '/tmp/replitdb';
    const fs = require('fs');
    if (fs.existsSync(replitDbPath)) {
      const dbUrl = fs.readFileSync(replitDbPath, 'utf-8').trim();
      if (dbUrl) {
        console.log('[Session Store] Using DATABASE_URL from /tmp/replitdb (production mode)');
        return dbUrl;
      }
    }
  } catch (error) {
    console.warn('[Session Store] Could not read /tmp/replitdb:', error);
  }
  
  return null;
}

const MemoryStore = createMemoryStore(session);

let sessionStore: any;
const isProduction = process.env.NODE_ENV === 'production';

async function initSessionStore() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const connectRedisModule = await import('connect-redis');
      const RedisStoreClass = connectRedisModule.default || connectRedisModule.RedisStore;
      const ioredis = await import('ioredis');

      const isTls = redisUrl.startsWith('rediss://');
      const redisOpts: any = {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      };

      if (isTls) {
        redisOpts.tls = { rejectUnauthorized: false };
      }

      let redisClient: InstanceType<typeof ioredis.default>;
      let sessionStoreErrorLogged = false;
      try {
        redisClient = new ioredis.default(redisUrl, redisOpts);
        redisClient.on('error', () => {});
        await redisClient.connect();
      } catch (tlsErr) {
        if (isTls) {
          console.warn('[Session Store] TLS connection failed, retrying without TLS');
          try { redisClient.removeAllListeners(); redisClient.disconnect(); } catch (_) {}
          const plainUrl = redisUrl.replace('rediss://', 'redis://');
          const { tls, ...plainOpts } = redisOpts;
          redisClient = new ioredis.default(plainUrl, plainOpts);
          redisClient.on('error', (err) => {
            if (!sessionStoreErrorLogged) {
              sessionStoreErrorLogged = true;
              console.warn('[Session Store] Redis error:', err.message);
            }
          });
          await redisClient.connect();
        } else {
          throw tlsErr;
        }
      }

      const adaptedClient = {
        get: (key: string) => redisClient.get(key),
        set: (key: string, val: string, opts?: any) => {
          if (opts?.expiration?.type === 'EX' && opts.expiration.value) {
            return redisClient.set(key, val, 'EX', opts.expiration.value);
          }
          if (opts?.EX) {
            return redisClient.set(key, val, 'EX', opts.EX);
          }
          return redisClient.set(key, val);
        },
        del: (keys: string | string[]) => redisClient.del(...(Array.isArray(keys) ? keys : [keys])),
        expire: (key: string, ttl: number) => redisClient.expire(key, ttl),
        scanIterator: (opts: { MATCH: string; COUNT: number }) => {
          const stream = redisClient.scanStream({ match: opts.MATCH, count: opts.COUNT });
          return (async function* () {
            for await (const keys of stream) {
              yield keys;
            }
          })();
        },
        mGet: (keys: string[]) => redisClient.mget(...keys),
      };

      sessionStore = new RedisStoreClass({
        client: adaptedClient,
        prefix: 'session:',
        ttl: 7 * 24 * 60 * 60,
      });
      console.log('[Session Store] Using Redis store (shared across instances)');
      return;
    } catch (err) {
      console.warn('[Session Store] Redis store init failed, falling back:', err);
    }
  }

  if (!isProduction) {
    console.log('[Session Store] Using MemoryStore for development');
    sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    return;
  }

  const sessionDbUrl = getSessionDatabaseUrl();
  if (!sessionDbUrl) {
    console.error('[CRITICAL] No Redis or DATABASE_URL available in production');
    process.exit(1);
  }

  const pgPool = new Pool({
    connectionString: sessionDbUrl,
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 60000,
    maxUses: 7500,
    allowExitOnIdle: false,
  });

  const pgStore = connectPg(session);
  sessionStore = new pgStore({
    pool: pgPool,
    createTableIfMissing: true,
    ttl: 7 * 24 * 60 * 60,
  });
  console.log('[Session Store] Using PostgreSQL store for production (Redis unavailable)');
}

try {
  await initSessionStore();
} catch (error) {
  if (isProduction) {
    console.error('[CRITICAL] Failed to initialize session store in production:', error);
    process.exit(1);
  }
  console.error('[Storage Module] Failed to initialize session store:', error);
  sessionStore = new MemoryStore({
    checkPeriod: 86400000,
  });
}

export { sessionStore };