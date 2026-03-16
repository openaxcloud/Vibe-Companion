import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export interface CustomThemeColors {
  background: string;
  text: string;
  accent: string;
  panel: string;
  border: string;
}

export interface CustomTheme {
  name: string;
  colors: CustomThemeColors;
}

export interface KeyboardShortcutOverride {
  action: string;
  keys: string[];
}

export interface UserPreferencesStored {
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  theme?: string;
  agentToolsConfig?: { liteMode?: boolean; webSearch?: boolean; appTesting?: boolean; codeOptimizations?: boolean; architect?: boolean };
  autoCloseBrackets?: boolean;
  indentationDetection?: boolean;
  formatPastedText?: boolean;
  indentationChar?: "spaces" | "tabs";
  indentationSize?: number;
  minimap?: boolean;
  multiselectModifier?: "Alt" | "Ctrl" | "Meta";
  filetreeGitStatus?: boolean;
  semanticTokens?: boolean;
  aiCodeCompletion?: boolean;
  acceptSuggestionOnCommit?: boolean;
  shellBell?: boolean;
  automaticPreview?: boolean;
  forwardPorts?: boolean;
  agentAudioNotification?: boolean;
  agentPushNotification?: boolean;
  accessibleTerminal?: boolean;
  customTheme?: CustomTheme | null;
  communityTheme?: string | null;
  keyboardShortcuts?: Record<string, string | null>;
}

export interface UserPreferences extends Required<Omit<UserPreferencesStored, 'customTheme' | 'communityTheme' | 'agentToolsConfig' | 'keyboardShortcuts'>> {
  customTheme: CustomTheme | null;
  communityTheme: string | null;
  agentToolsConfig: { liteMode: boolean; webSearch: boolean; appTesting: boolean; codeOptimizations: boolean; architect: boolean };
  keyboardShortcuts: Record<string, string | null>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  theme: "dark",
  agentToolsConfig: { liteMode: false, webSearch: false, appTesting: false, codeOptimizations: false, architect: false },
  autoCloseBrackets: true,
  indentationDetection: true,
  formatPastedText: true,
  indentationChar: "spaces",
  indentationSize: 2,
  minimap: true,
  multiselectModifier: "Alt",
  filetreeGitStatus: true,
  semanticTokens: true,
  aiCodeCompletion: true,
  acceptSuggestionOnCommit: true,
  shellBell: false,
  automaticPreview: true,
  forwardPorts: true,
  agentAudioNotification: true,
  agentPushNotification: false,
  accessibleTerminal: false,
  customTheme: null,
  communityTheme: null,
  keyboardShortcuts: {},
};

export interface CommunityThemeDefinition {
  id: string;
  name: string;
  author: string;
  colors: CustomThemeColors;
}

export const COMMUNITY_THEMES: CommunityThemeDefinition[] = [
  { id: "dracula", name: "Dracula", author: "Zeno Rocha", colors: { background: "#282a36", text: "#f8f8f2", accent: "#bd93f9", panel: "#44475a", border: "#6272a4" } },
  { id: "monokai", name: "Monokai", author: "Wimer Hazenberg", colors: { background: "#272822", text: "#f8f8f2", accent: "#a6e22e", panel: "#3e3d32", border: "#75715e" } },
  { id: "nord", name: "Nord", author: "Arctic Ice Studio", colors: { background: "#2e3440", text: "#eceff4", accent: "#88c0d0", panel: "#3b4252", border: "#4c566a" } },
  { id: "solarized-dark", name: "Solarized Dark", author: "Ethan Schoonover", colors: { background: "#002b36", text: "#839496", accent: "#268bd2", panel: "#073642", border: "#586e75" } },
  { id: "github-dark", name: "GitHub Dark", author: "GitHub", colors: { background: "#0d1117", text: "#c9d1d9", accent: "#58a6ff", panel: "#161b22", border: "#30363d" } },
  { id: "one-dark", name: "One Dark", author: "Atom", colors: { background: "#282c34", text: "#abb2bf", accent: "#61afef", panel: "#21252b", border: "#3e4451" } },
  { id: "catppuccin", name: "Catppuccin Mocha", author: "Catppuccin", colors: { background: "#1e1e2e", text: "#cdd6f4", accent: "#cba6f7", panel: "#313244", border: "#45475a" } },
  { id: "tokyo-night", name: "Tokyo Night", author: "enkia", colors: { background: "#1a1b26", text: "#c0caf5", accent: "#7aa2f7", panel: "#24283b", border: "#3b4261" } },
  { id: "gruvbox", name: "Gruvbox Dark", author: "morhetz", colors: { background: "#282828", text: "#ebdbb2", accent: "#fabd2f", panel: "#3c3836", border: "#504945" } },
  { id: "rose-pine", name: "Rosé Pine", author: "Rosé Pine", colors: { background: "#191724", text: "#e0def4", accent: "#c4a7e7", panel: "#1f1d2e", border: "#26233a" } },
  { id: "synthwave", name: "Synthwave '84", author: "Robb Owen", colors: { background: "#2b213a", text: "#e0def4", accent: "#ff7edb", panel: "#34294f", border: "#495495" } },
  { id: "everforest", name: "Everforest", author: "sainnhe", colors: { background: "#2d353b", text: "#d3c6aa", accent: "#a7c080", panel: "#343f44", border: "#475258" } },
];

export const DEFAULT_KEYBOARD_SHORTCUTS = [
  { action: "Command Palette", keys: ["Ctrl", "P"] },
  { action: "Command Palette Alt", keys: ["Ctrl", "K"] },
  { action: "Toggle Sidebar", keys: ["Ctrl", "B"] },
  { action: "Keyboard Shortcuts", keys: ["Ctrl", "/"] },
  { action: "Run / Stop", keys: ["F5"] },
  { action: "Run Code", keys: ["Ctrl", "Enter"] },
  { action: "Save File", keys: ["Ctrl", "S"] },
  { action: "New File", keys: ["Ctrl", "N"] },
  { action: "Close Tab", keys: ["Ctrl", "W"] },
  { action: "Accept AI Completion", keys: ["Tab"] },
  { action: "Dismiss AI Completion", keys: ["Escape"] },
  { action: "Toggle Terminal", keys: ["Ctrl", "J"] },
  { action: "Toggle Terminal Alt", keys: ["Ctrl", "`"] },
  { action: "Toggle Preview", keys: ["Ctrl", "\\"] },
  { action: "Search in Files", keys: ["Ctrl", "Shift", "F"] },
  { action: "Search & Replace", keys: ["Ctrl", "H"] },
  { action: "Version Control", keys: ["Ctrl", "Shift", "G"] },
];

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull().default(""),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  githubId: text("github_id"),
  preferences: json("preferences").$type<UserPreferencesStored>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  displayName: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projectVisibilityEnum = ["public", "private", "team"] as const;
export type ProjectVisibility = typeof projectVisibilityEnum[number];

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }),
  name: text("name").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").notNull().default(false),
  language: text("language").notNull().default("javascript"),
  projectType: text("project_type").notNull().default("web-app"),
  visibility: text("visibility").notNull().default("public"),
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
  selectedWorkflowId: varchar("selected_workflow_id", { length: 36 }),
  viewCount: integer("view_count").notNull().default(0),
  forkCount: integer("fork_count").notNull().default(0),
  devUrlPublic: boolean("dev_url_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
]);

export const projectTypeEnum = z.enum(["web-app", "slides", "video"]);
export type ProjectType = z.infer<typeof projectTypeEnum>;

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  language: true,
  projectType: true,
  visibility: true,
}).extend({
  visibility: z.enum(projectVisibilityEnum).optional().default("public"),
  projectType: projectTypeEnum.default("web-app"),
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const projectGuests = pgTable("project_guests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  invitedBy: varchar("invited_by", { length: 36 }).notNull(),
  token: text("token").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("project_guests_project_idx").on(table.projectId),
  index("project_guests_email_idx").on(table.email),
  index("project_guests_user_idx").on(table.userId),
]);
export const insertProjectGuestSchema = createInsertSchema(projectGuests).pick({
  projectId: true,
  email: true,
  role: true,
  invitedBy: true,
});
export type InsertProjectGuest = z.infer<typeof insertProjectGuestSchema>;
export type ProjectGuest = typeof projectGuests.$inferSelect;

export interface SlideContentBlock {
  id: string;
  type: "title" | "body" | "image" | "code" | "list";
  content: string;
  imageUrl?: string;
  language?: string;
  style?: Record<string, string>;
}

export interface SlideData {
  id: string;
  order: number;
  layout: "title" | "content" | "two-column" | "image-full" | "blank";
  blocks: SlideContentBlock[];
  notes?: string;
  backgroundColor?: string;
}

export interface SlideTheme {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  accentColor: string;
}

export const slidesData = pgTable("slides_data", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  slides: json("slides").$type<SlideData[]>().notNull().default([]),
  theme: json("theme").$type<SlideTheme>().notNull().default({
    name: "default",
    primaryColor: "#0079F2",
    secondaryColor: "#7C65CB",
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    fontFamily: "Inter, system-ui, sans-serif",
    accentColor: "#0CCE6B",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("slides_data_project_idx").on(table.projectId),
  uniqueIndex("slides_data_project_unique").on(table.projectId),
]);

export const insertSlidesDataSchema = createInsertSchema(slidesData).omit({ id: true, updatedAt: true });
export type InsertSlidesData = z.infer<typeof insertSlidesDataSchema>;
export type SlidesDataRecord = typeof slidesData.$inferSelect;

export interface VideoScene {
  id: string;
  order: number;
  duration: number;
  backgroundColor: string;
  elements: VideoElement[];
  transition: "none" | "fade" | "slide-left" | "slide-right" | "zoom" | "dissolve";
}

export interface VideoElement {
  id: string;
  type: "text" | "image" | "shape" | "overlay";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  endTime: number;
  style?: Record<string, string>;
  animation?: "none" | "fade-in" | "slide-up" | "scale" | "typewriter";
}

export interface VideoAudioTrack {
  id: string;
  name: string;
  url?: string;
  volume: number;
  loop?: boolean;
}

export const videoData = pgTable("video_data", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  scenes: json("scenes").$type<VideoScene[]>().notNull().default([]),
  audioTracks: json("audio_tracks").$type<VideoAudioTrack[]>().notNull().default([]),
  resolution: json("resolution").$type<{ width: number; height: number }>().notNull().default({ width: 1920, height: 1080 }),
  fps: integer("fps").notNull().default(30),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("video_data_project_idx").on(table.projectId),
  uniqueIndex("video_data_project_unique").on(table.projectId),
]);

export const insertVideoDataSchema = createInsertSchema(videoData).omit({ id: true, updatedAt: true });
export type InsertVideoData = z.infer<typeof insertVideoDataSchema>;
export type VideoDataRecord = typeof videoData.$inferSelect;

export const projectInvites = pgTable("project_invites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  invitedBy: varchar("invited_by", { length: 36 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("project_invites_project_idx").on(table.projectId),
  uniqueIndex("project_invites_project_email_unique").on(table.projectId, table.email),
]);
export const insertProjectInviteSchema = createInsertSchema(projectInvites).pick({
  projectId: true,
  email: true,
  role: true,
  invitedBy: true,
});
export type InsertProjectInvite = z.infer<typeof insertProjectInviteSchema>;
export type ProjectInvite = typeof projectInvites.$inferSelect;

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

export const fileVersions = pgTable("file_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  content: text("content").notNull(),
  versionNumber: integer("version_number").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("file_versions_file_version_idx").on(table.fileId, table.versionNumber),
  index("file_versions_project_created_idx").on(table.projectId, table.createdAt),
]);

export const insertFileVersionSchema = createInsertSchema(fileVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;

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
  dailyCreditsUsed: integer("daily_credits_used").notNull().default(0),
  storageBytes: integer("storage_bytes").notNull().default(0),
  totalExecutions: integer("total_executions").notNull().default(0),
  totalAiCalls: integer("total_ai_calls").notNull().default(0),
  agentMode: text("agent_mode").notNull().default("economy"),
  codeOptimizationsEnabled: boolean("code_optimizations_enabled").notNull().default(false),
  creditAlertThreshold: integer("credit_alert_threshold").notNull().default(80),
  lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creditUsage = pgTable("credit_usage", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  mode: text("mode").notNull(),
  model: text("model").notNull(),
  creditCost: integer("credit_cost").notNull(),
  endpoint: text("endpoint").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditUsageSchema = createInsertSchema(creditUsage).omit({ id: true, createdAt: true });
export type InsertCreditUsage = z.infer<typeof insertCreditUsageSchema>;
export type CreditUsage = typeof creditUsage.$inferSelect;

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
  free: { dailyExecutions: 50, dailyAiCalls: 20, dailyCredits: 100, storageMb: 50, maxProjects: 5, price: 0 },
  pro: { dailyExecutions: 500, dailyAiCalls: 200, dailyCredits: 1000, storageMb: 5000, maxProjects: 50, price: 1200 },
  team: { dailyExecutions: 2000, dailyAiCalls: 1000, dailyCredits: 5000, storageMb: 50000, maxProjects: 200, price: 2500 },
} as const;

export const AGENT_MODE_COSTS = {
  economy: 1,
  power: 3,
  turbo: 6,
} as const;

export type AgentMode = "economy" | "power" | "turbo";

export type TopAgentMode = "lite" | "autonomous" | "max";
export type AutonomousTier = "economy" | "power";

export const TOP_AGENT_MODE_CONFIG = {
  lite: { label: "Lite", description: "Fast, focused single-file edits", cost: 1, color: "#F5A623", maxTokens: 4096 },
  autonomous: { label: "Autonomous", description: "Full agent capabilities", cost: 1, color: "#7C65CB", maxTokens: 16384 },
  max: { label: "Max", description: "Extended context, multi-step planning", cost: 6, color: "#0079F2", maxTokens: 32768 },
} as const;

export const AUTONOMOUS_TIER_CONFIG = {
  economy: { label: "Economy", description: "Standard models, 1 credit/call", cost: 1, color: "#0CCE6B" },
  power: { label: "Power", description: "Best models, 3 credits/call", cost: 3, color: "#0079F2" },
} as const;

export const AGENT_MODE_MODELS: Record<AgentMode, Record<string, string>> = {
  economy: { claude: "claude-sonnet-4-6", gpt: "gpt-4o-mini", gemini: "gemini-2.0-flash" },
  power: { claude: "claude-sonnet-4-6", gpt: "gpt-4o", gemini: "gemini-2.5-flash" },
  turbo: { claude: "claude-sonnet-4-6", gpt: "gpt-4o", gemini: "gemini-2.5-flash" },
};

export const TOP_AGENT_MODE_MODELS: Record<TopAgentMode, Record<string, string>> = {
  lite: { claude: "claude-sonnet-4-6", gpt: "gpt-4o-mini", gemini: "gemini-2.0-flash" },
  autonomous: { claude: "claude-sonnet-4-6", gpt: "gpt-4o", gemini: "gemini-2.5-flash" },
  max: { claude: "claude-sonnet-4-6", gpt: "gpt-4o", gemini: "gemini-2.5-flash" },
};

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
  uniqueIndex("ai_conv_project_user_title_unique").on(table.projectId, table.userId, table.title),
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

export const aiPlans = pgTable("ai_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull().default(""),
  status: text("status").notNull().default("draft"),
  model: text("model").notNull().default("gpt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ai_plan_project_idx").on(table.projectId),
  index("ai_plan_user_idx").on(table.userId),
]);

export const insertAiPlanSchema = createInsertSchema(aiPlans).pick({
  projectId: true,
  userId: true,
  title: true,
  model: true,
  status: true,
});
export type InsertAiPlan = z.infer<typeof insertAiPlanSchema>;
export type AiPlan = typeof aiPlans.$inferSelect;

export const aiPlanTasks = pgTable("ai_plan_tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  complexity: text("complexity").notNull().default("medium"),
  dependsOn: text("depends_on").array().default([]),
  status: text("status").notNull().default("pending"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ai_plan_task_plan_idx").on(table.planId),
]);

export const insertAiPlanTaskSchema = createInsertSchema(aiPlanTasks).pick({
  planId: true,
  title: true,
  description: true,
  complexity: true,
  dependsOn: true,
  status: true,
  orderIndex: true,
});
export type InsertAiPlanTask = z.infer<typeof insertAiPlanTaskSchema>;
export type AiPlanTask = typeof aiPlanTasks.$inferSelect;

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
  deploymentType: text("deployment_type").notNull().default("static"),
  buildLog: text("build_log"),
  url: text("url"),
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
  processPort: integer("process_port"),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").default("unknown"),
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
  category: text("category").notNull().default("sast"),
  isDirect: boolean("is_direct"),
  hidden: boolean("hidden").notNull().default(false),
  hiddenAt: timestamp("hidden_at"),
  agentSessionId: varchar("agent_session_id", { length: 36 }),
}, (table) => [
  index("security_findings_scan_idx").on(table.scanId),
  index("security_findings_hidden_idx").on(table.hidden),
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
  category: true,
  isDirect: true,
});
export type InsertSecurityFinding = z.infer<typeof insertSecurityFindingSchema>;
export type SecurityFinding = typeof securityFindings.$inferSelect;

export const projectCollaborators = pgTable("project_collaborators", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  role: text("role").notNull().default("editor"),
  addedBy: varchar("added_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("project_collab_unique").on(table.projectId, table.userId),
  index("project_collab_project_idx").on(table.projectId),
  index("project_collab_user_idx").on(table.userId),
]);
export const insertProjectCollaboratorSchema = createInsertSchema(projectCollaborators).pick({
  projectId: true,
  userId: true,
  role: true,
  addedBy: true,
});
export type InsertProjectCollaborator = z.infer<typeof insertProjectCollaboratorSchema>;
export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;

export const projectInviteLinks = pgTable("project_invite_links", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  token: text("token").notNull().unique(),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  role: text("role").notNull().default("editor"),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("project_invite_project_idx").on(table.projectId),
]);
export const insertProjectInviteLinkSchema = createInsertSchema(projectInviteLinks).pick({
  projectId: true,
  token: true,
  createdBy: true,
  role: true,
  maxUses: true,
  expiresAt: true,
});
export type InsertProjectInviteLink = z.infer<typeof insertProjectInviteLinkSchema>;
export type ProjectInviteLink = typeof projectInviteLinks.$inferSelect;

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
  executionMode: text("execution_mode").notNull().default("sequential"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("workflows_project_idx").on(table.projectId),
]);
export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  projectId: true,
  name: true,
  triggerEvent: true,
  executionMode: true,
  enabled: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  taskType: text("task_type").notNull().default("shell"),
  orderIndex: integer("order_index").notNull().default(0),
  continueOnError: boolean("continue_on_error").notNull().default(false),
}, (table) => [
  index("workflow_steps_workflow_idx").on(table.workflowId),
]);
export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).pick({
  workflowId: true,
  name: true,
  command: true,
  taskType: true,
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
  isPublic: boolean("is_public").notNull().default(true),
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

export const TASK_LIMITS = {
  free: { maxParallelTasks: 2 },
  pro: { maxParallelTasks: 10 },
  team: { maxParallelTasks: 10 },
} as const;

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  plan: json("plan").$type<string[]>(),
  status: text("status").notNull().default("draft"),
  dependsOn: json("depends_on").$type<string[]>().default([]),
  priority: integer("priority").notNull().default(0),
  progress: integer("progress").notNull().default(0),
  result: text("result"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("tasks_project_idx").on(table.projectId),
  index("tasks_user_idx").on(table.userId),
  index("tasks_status_idx").on(table.status),
]);

export const insertTaskSchema = createInsertSchema(tasks).pick({
  projectId: true,
  userId: true,
  title: true,
  description: true,
  plan: true,
  dependsOn: true,
  priority: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const taskSteps = pgTable("task_steps", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("pending"),
  output: text("output"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("task_steps_task_idx").on(table.taskId),
]);

export const insertTaskStepSchema = createInsertSchema(taskSteps).pick({
  taskId: true,
  orderIndex: true,
  title: true,
  description: true,
});
export type InsertTaskStep = z.infer<typeof insertTaskStepSchema>;
export type TaskStep = typeof taskSteps.$inferSelect;

export const taskMessages = pgTable("task_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("task_messages_task_idx").on(table.taskId),
]);

export const insertTaskMessageSchema = createInsertSchema(taskMessages).pick({
  taskId: true,
  role: true,
  content: true,
});
export type InsertTaskMessage = z.infer<typeof insertTaskMessageSchema>;
export type TaskMessage = typeof taskMessages.$inferSelect;

export const taskFileSnapshots = pgTable("task_file_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull().default(""),
  originalContent: text("original_content").notNull().default(""),
  isModified: boolean("is_modified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("task_file_snapshots_task_idx").on(table.taskId),
  uniqueIndex("task_file_snapshots_task_file_unique").on(table.taskId, table.filename),
]);

export const insertTaskFileSnapshotSchema = createInsertSchema(taskFileSnapshots).pick({
  taskId: true,
  filename: true,
  content: true,
  originalContent: true,
});
export type InsertTaskFileSnapshot = z.infer<typeof insertTaskFileSnapshotSchema>;
export type TaskFileSnapshot = typeof taskFileSnapshots.$inferSelect;

export const queuedMessages = pgTable("queued_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  content: text("content").notNull(),
  attachments: json("attachments").$type<{ id: string; name: string; type: string; content: string; mimeType: string; size: number }[]>(),
  position: integer("position").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("queued_msg_conv_idx").on(table.conversationId),
  index("queued_msg_project_user_idx").on(table.projectId, table.userId),
]);

export const insertQueuedMessageSchema = createInsertSchema(queuedMessages).pick({
  conversationId: true,
  projectId: true,
  userId: true,
  content: true,
  attachments: true,
  position: true,
});
export type InsertQueuedMessage = z.infer<typeof insertQueuedMessageSchema>;
export type QueuedMessage = typeof queuedMessages.$inferSelect;

export const mcpServers = pgTable("mcp_servers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  args: json("args").$type<string[]>().notNull().default([]),
  env: json("env").$type<Record<string, string>>().notNull().default({}),
  status: text("status").notNull().default("stopped"),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("mcp_servers_project_idx").on(table.projectId),
]);
export const insertMcpServerSchema = createInsertSchema(mcpServers).pick({
  projectId: true,
  name: true,
  command: true,
  args: true,
  env: true,
  isBuiltIn: true,
});
export type InsertMcpServer = z.infer<typeof insertMcpServerSchema>;
export type McpServer = typeof mcpServers.$inferSelect;

export const mcpTools = pgTable("mcp_tools", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  inputSchema: json("input_schema").$type<Record<string, any>>().notNull().default({}),
  cachedAt: timestamp("cached_at").notNull().defaultNow(),
}, (table) => [
  index("mcp_tools_server_idx").on(table.serverId),
]);
export const insertMcpToolSchema = createInsertSchema(mcpTools).pick({
  serverId: true,
  name: true,
  description: true,
  inputSchema: true,
});
export type InsertMcpTool = z.infer<typeof insertMcpToolSchema>;
export type McpTool = typeof mcpTools.$inferSelect;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const globalColorsSchema = z.object({
  background: hexColor.default("#0E1525"),
  outline: hexColor.default("#2B3245"),
  foreground: hexColor.default("#F5F9FC"),
  primary: hexColor.default("#0079F2"),
  positive: hexColor.default("#0CCE6B"),
  negative: hexColor.default("#F44747"),
});
export type GlobalColors = z.infer<typeof globalColorsSchema>;

export const syntaxColorsSchema = z.object({
  variableNames: hexColor.default("#F5F9FC"),
  variableDefinitions: hexColor.default("#CFD7E6"),
  functionReferences: hexColor.default("#56B6C2"),
  functionDefinitions: hexColor.default("#56B6C2"),
  keywords: hexColor.default("#FF6166"),
  propertyNames: hexColor.default("#56B6C2"),
  propertyDefinitions: hexColor.default("#CFD7E6"),
  functionProperties: hexColor.default("#56B6C2"),
  tagNames: hexColor.default("#FF6166"),
  typeNames: hexColor.default("#FFCB6B"),
  classNames: hexColor.default("#FFCB6B"),
  attributeNames: hexColor.default("#FFCB6B"),
  comments: hexColor.default("#676D7E"),
  strings: hexColor.default("#0CCE6B"),
  numbers: hexColor.default("#FF9940"),
  booleans: hexColor.default("#FF9940"),
  regularExpressions: hexColor.default("#56B6C2"),
  operators: hexColor.default("#FF6166"),
  brackets: hexColor.default("#CFD7E6"),
});
export type SyntaxColors = z.infer<typeof syntaxColorsSchema>;

export const themes = pgTable("themes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  baseScheme: text("base_scheme").notNull().default("dark"),
  globalColors: json("global_colors").$type<GlobalColors>().notNull(),
  syntaxColors: json("syntax_colors").$type<SyntaxColors>().notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  installCount: integer("install_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("themes_user_idx").on(table.userId),
  index("themes_published_idx").on(table.isPublished),
]);

export const insertThemeSchema = createInsertSchema(themes).pick({
  title: true,
  description: true,
  baseScheme: true,
}).extend({
  globalColors: globalColorsSchema,
  syntaxColors: syntaxColorsSchema,
});
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themes.$inferSelect;

export const installedThemes = pgTable("installed_themes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  themeId: varchar("theme_id", { length: 36 }).notNull(),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("installed_themes_user_theme_idx").on(table.userId, table.themeId),
  index("installed_themes_user_idx").on(table.userId),
]);
export type InstalledTheme = typeof installedThemes.$inferSelect;

export const DEFAULT_DARK_GLOBAL_COLORS: GlobalColors = {
  background: "#0E1525",
  outline: "#2B3245",
  foreground: "#F5F9FC",
  primary: "#0079F2",
  positive: "#0CCE6B",
  negative: "#F44747",
};

export const DEFAULT_LIGHT_GLOBAL_COLORS: GlobalColors = {
  background: "#FFFFFF",
  outline: "#D1D5DB",
  foreground: "#0F172A",
  primary: "#0079F2",
  positive: "#16A34A",
  negative: "#DC2626",
};

export const DEFAULT_DARK_SYNTAX_COLORS: SyntaxColors = {
  variableNames: "#F5F9FC",
  variableDefinitions: "#CFD7E6",
  functionReferences: "#56B6C2",
  functionDefinitions: "#56B6C2",
  keywords: "#FF6166",
  propertyNames: "#56B6C2",
  propertyDefinitions: "#CFD7E6",
  functionProperties: "#56B6C2",
  tagNames: "#FF6166",
  typeNames: "#FFCB6B",
  classNames: "#FFCB6B",
  attributeNames: "#FFCB6B",
  comments: "#676D7E",
  strings: "#0CCE6B",
  numbers: "#FF9940",
  booleans: "#FF9940",
  regularExpressions: "#56B6C2",
  operators: "#FF6166",
  brackets: "#CFD7E6",
};

export const DEFAULT_LIGHT_SYNTAX_COLORS: SyntaxColors = {
  variableNames: "#0F172A",
  variableDefinitions: "#334155",
  functionReferences: "#0891B2",
  functionDefinitions: "#0891B2",
  keywords: "#DC2626",
  propertyNames: "#0891B2",
  propertyDefinitions: "#334155",
  functionProperties: "#0891B2",
  tagNames: "#DC2626",
  typeNames: "#B45309",
  classNames: "#B45309",
  attributeNames: "#B45309",
  comments: "#94A3B8",
  strings: "#16A34A",
  numbers: "#D97706",
  booleans: "#D97706",
  regularExpressions: "#0891B2",
  operators: "#DC2626",
  brackets: "#475569",
};

export const systemModules = pgTable("system_modules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  version: text("version"),
}, (table) => [
  index("system_modules_project_idx").on(table.projectId),
]);
export const insertSystemModuleSchema = createInsertSchema(systemModules).pick({
  projectId: true,
  name: true,
  version: true,
});
export type InsertSystemModule = z.infer<typeof insertSystemModuleSchema>;
export type SystemModule = typeof systemModules.$inferSelect;

export const systemDeps = pgTable("system_deps", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
}, (table) => [
  index("system_deps_project_idx").on(table.projectId),
]);
export const insertSystemDepSchema = createInsertSchema(systemDeps).pick({
  projectId: true,
  name: true,
});
export type InsertSystemDep = z.infer<typeof insertSystemDepSchema>;
export type SystemDep = typeof systemDeps.$inferSelect;
