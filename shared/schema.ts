import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, bigint, boolean, uniqueIndex, index, json, real, serial } from "drizzle-orm/pg-core";
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
  keyboardMode?: boolean;
  keyboardModePromptDismissed?: boolean;
}

export interface UserPreferences extends Required<Omit<UserPreferencesStored, 'customTheme' | 'communityTheme' | 'agentToolsConfig' | 'keyboardShortcuts'>> {
  customTheme: CustomTheme | null;
  communityTheme: string | null;
  agentToolsConfig: { liteMode: boolean; webSearch: boolean; appTesting: boolean; codeOptimizations: boolean; architect: boolean };
  keyboardShortcuts: Record<string, string | null>;
  keyboardMode: boolean;
  keyboardModePromptDismissed: boolean;
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
  keyboardMode: false,
  keyboardModePromptDismissed: false,
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
  username: text("username").unique(),
  usernameChangedAt: timestamp("username_changed_at"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  githubId: text("github_id"),
  googleId: text("google_id"),
  appleId: text("apple_id"),
  twitterId: text("twitter_id"),
  replitId: text("replit_id"),
  isBanned: boolean("is_banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  credits: integer("credits").notNull().default(0),
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

export const OUTPUT_TYPES = ["web", "mobile", "slides", "animation", "design", "data-visualization", "automation", "3d-game", "document", "spreadsheet"] as const;
export type OutputType = typeof OUTPUT_TYPES[number];

export const ARTIFACT_TYPES = ["web-app", "mobile-app", "slides", "animation", "data-viz", "3d-game", "document", "spreadsheet", "design", "automation"] as const;
export type ArtifactType = typeof ARTIFACT_TYPES[number];

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
  outputType: text("output_type").notNull().default("web"),
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
  enableFeedback: boolean("enable_feedback").notNull().default(false),
  bootstrapPrompt: text("bootstrap_prompt"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
]);

export const projectTypeEnum = z.enum(["web-app", "slides", "video", "animation"]);
export type ProjectType = z.infer<typeof projectTypeEnum>;

export const outputTypeEnum = z.enum(OUTPUT_TYPES);

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  language: true,
  projectType: true,
  outputType: true,
  visibility: true,
}).extend({
  visibility: z.enum(projectVisibilityEnum).optional().default("public"),
  projectType: projectTypeEnum.default("web-app"),
  outputType: outputTypeEnum.optional().default("web"),
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const artifacts = pgTable("artifacts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  type: text("type").notNull().default("web-app"),
  name: text("name").notNull(),
  entryFile: text("entry_file"),
  settings: json("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("artifacts_project_id_idx").on(table.projectId),
]);

export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true });
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type Artifact = typeof artifacts.$inferSelect;

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
  artifactId: varchar("artifact_id", { length: 36 }),
  filename: text("filename").notNull(),
  content: text("content").notNull().default(""),
  isBinary: boolean("is_binary").notNull().default(false),
  mimeType: text("mime_type"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("files_project_id_idx").on(table.projectId),
  index("files_artifact_id_idx").on(table.artifactId),
]);

export const insertFileSchema = createInsertSchema(files).pick({
  filename: true,
  content: true,
  isBinary: true,
  mimeType: true,
  artifactId: true,
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

export const backupTriggerEnum = ["commit", "deploy", "agent", "manual"] as const;
export type BackupTrigger = typeof backupTriggerEnum[number];

export const gitBackups = pgTable("git_backups", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  version: integer("version").notNull(),
  data: text("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  triggerType: text("trigger_type").notNull().$type<BackupTrigger>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("git_backups_project_version_idx").on(table.projectId, table.version),
]);

export const insertGitBackupSchema = createInsertSchema(gitBackups).pick({
  projectId: true,
  version: true,
  data: true,
  sizeBytes: true,
  triggerType: true,
});
export type InsertGitBackup = z.infer<typeof insertGitBackupSchema>;
export type GitBackup = typeof gitBackups.$inferSelect;

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
  monthlyCreditsIncluded: integer("monthly_credits_included").notNull().default(0),
  monthlyCreditsUsed: integer("monthly_credits_used").notNull().default(0),
  overageEnabled: boolean("overage_enabled").notNull().default(false),
  overageCreditsUsed: integer("overage_credits_used").notNull().default(0),
  billingCycleStart: timestamp("billing_cycle_start").notNull().defaultNow(),
  lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creditUsage = pgTable("credit_usage", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  creditCost: integer("credits_used").notNull(),
  mode: text("agent_mode").notNull(),
  model: text("model").notNull(),
  endpoint: text("endpoint"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditUsageSchema = createInsertSchema(creditUsage).omit({ id: true, createdAt: true });
export type InsertCreditUsage = z.infer<typeof insertCreditUsageSchema>;
export type CreditUsage = typeof creditUsage.$inferSelect;

export const usageRecords = pgTable("usage_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  actionType: text("action").notNull(),
  creditCost: integer("credits_used").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("usage_records_user_idx").on(table.userId),
]);
export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({ id: true, createdAt: true });
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;

export const USAGE_ACTION_TYPES = {
  AI_CALL: "ai_call",
  CODE_EXECUTION: "code_execution",
  DEPLOYMENT: "deployment",
  STORAGE: "storage",
} as const;
export type UsageActionType = typeof USAGE_ACTION_TYPES[keyof typeof USAGE_ACTION_TYPES];

export const USAGE_COSTS = {
  [USAGE_ACTION_TYPES.AI_CALL]: { economy: 1, power: 3, turbo: 6 },
  [USAGE_ACTION_TYPES.CODE_EXECUTION]: 2,
  [USAGE_ACTION_TYPES.DEPLOYMENT]: 5,
  [USAGE_ACTION_TYPES.STORAGE]: 0,
} as const;

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
  objectStorageByPlan: {
    free: 10 * 1024 * 1024,
    pro: 50 * 1024 * 1024,
    team: 100 * 1024 * 1024,
  },
} as const;

export const PLAN_LIMITS = {
  free: { dailyExecutions: 50, dailyAiCalls: 20, dailyCredits: 100, storageMb: 50, maxProjects: 5, price: 0, monthlyCredits: 0 },
  pro: { dailyExecutions: 500, dailyAiCalls: 200, dailyCredits: 1000, storageMb: 5000, maxProjects: 50, price: 1200, monthlyCredits: 2000 },
  team: { dailyExecutions: 2000, dailyAiCalls: 1000, dailyCredits: 5000, storageMb: 50000, maxProjects: 200, price: 2500, monthlyCredits: 5000 },
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
  max: { label: "Max", description: "Extended context, multi-step planning", cost: 6, color: "#0079F2", maxTokens: 16384 },
} as const;

export const AUTONOMOUS_TIER_CONFIG = {
  economy: { label: "Economy", description: "Standard models, 1 credit/call", cost: 1, color: "#0CCE6B" },
  power: { label: "Power", description: "Best models, 3 credits/call", cost: 3, color: "#0079F2" },
} as const;

export const MODEL_TOKEN_PRICING: Record<string, { input: number; output: number; label: string; creditsPerMillionInput: number; creditsPerMillionOutput: number }> = {
  "gpt-4.1": { input: 0.002, output: 0.008, label: "GPT-4.1", creditsPerMillionInput: 200, creditsPerMillionOutput: 800 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016, label: "GPT-4.1 Mini", creditsPerMillionInput: 40, creditsPerMillionOutput: 160 },
  "gpt-4.1-nano": { input: 0.0001, output: 0.0004, label: "GPT-4.1 Nano", creditsPerMillionInput: 10, creditsPerMillionOutput: 40 },
  "o4-mini": { input: 0.0011, output: 0.0044, label: "o4-mini", creditsPerMillionInput: 110, creditsPerMillionOutput: 440 },
  "o3": { input: 0.01, output: 0.04, label: "o3", creditsPerMillionInput: 1000, creditsPerMillionOutput: 4000 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015, label: "Claude Sonnet 4.6", creditsPerMillionInput: 300, creditsPerMillionOutput: 1500 },
  "claude-opus-4-7": { input: 0.015, output: 0.075, label: "Claude Opus 4.7", creditsPerMillionInput: 1500, creditsPerMillionOutput: 7500 },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004, label: "Claude Haiku 4.5", creditsPerMillionInput: 80, creditsPerMillionOutput: 400 },
  "gemini-2.5-pro": { input: 0.00125, output: 0.01, label: "Gemini 2.5 Pro", creditsPerMillionInput: 125, creditsPerMillionOutput: 1000 },
  "gemini-2.5-flash": { input: 0.0000375, output: 0.00015, label: "Gemini 2.5 Flash", creditsPerMillionInput: 4, creditsPerMillionOutput: 15 },
};

export const SERVICE_CREDIT_COSTS: Record<string, number> = {
  "tavily-search": 2,
  "brave-image-search": 3,
  "dalle-3-image": 20,
  "elevenlabs-tts": 10,
  "nanobanana-video": 15,
  "code-execution": 1,
};

export const OVERAGE_RATE_PER_CREDIT = 0.01;

export function calculateTokenCredits(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_TOKEN_PRICING[model] || MODEL_TOKEN_PRICING["gpt-4o-mini"];
  const costCents = (inputTokens * pricing.input / 1000) + (outputTokens * pricing.output / 1000);
  return Math.max(1, Math.round(costCents * 100));
}

export function getProviderPricing(provider: string): { input: number; output: number } {
  const providerMap: Record<string, { input: number; output: number }> = {
    anthropic: { input: 0.003, output: 0.015 },
    openai: { input: 0.0025, output: 0.01 },
    google: { input: 0.00015, output: 0.0006 },
    openrouter: { input: 0.0025, output: 0.01 },
    perplexity: { input: 0.001, output: 0.005 },
    mistral: { input: 0.001, output: 0.003 },
  };
  return providerMap[provider] || providerMap.openai;
}

// All OpenAI entries use direct provider models (gpt-4o / gpt-4o-mini) via
// OPENAI_API_KEY, not Replit ModelFarm's gpt-4.1 family.
export const AGENT_MODE_MODELS: Record<AgentMode, Record<string, string>> = {
  economy: { claude: "claude-sonnet-4-6", gpt: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
  power: { claude: "claude-opus-4-7", gpt: "gpt-4o", gemini: "gemini-2.5-pro" },
  turbo: { claude: "claude-opus-4-7", gpt: "o3", gemini: "gemini-2.5-pro" },
};

export const TOP_AGENT_MODE_MODELS: Record<TopAgentMode, Record<string, string>> = {
  lite: { claude: "claude-sonnet-4-6", gpt: "gpt-4o-mini", gemini: "gemini-2.5-flash" },
  autonomous: { claude: "claude-sonnet-4-6", gpt: "gpt-4o", gemini: "gemini-2.5-flash" },
  max: { claude: "claude-opus-4-7", gpt: "o3", gemini: "gemini-2.5-pro" },
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

export const purchasedDomains = pgTable("purchased_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  tld: text("tld").notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }),
  purchasePrice: integer("purchase_price").notNull(),
  renewalPrice: integer("renewal_price").notNull(),
  status: text("status").notNull().default("active"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  whoisPrivacy: boolean("whois_privacy").notNull().default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("purchased_domains_user_idx").on(table.userId),
  index("purchased_domains_project_idx").on(table.projectId),
]);

export const insertPurchasedDomainSchema = createInsertSchema(purchasedDomains).omit({
  id: true,
  createdAt: true,
});
export type InsertPurchasedDomain = z.infer<typeof insertPurchasedDomainSchema>;
export type PurchasedDomain = typeof purchasedDomains.$inferSelect;

export const dnsRecords = pgTable("dns_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id", { length: 36 }).notNull(),
  recordType: text("record_type").notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  ttl: integer("ttl").notNull().default(3600),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("dns_records_domain_idx").on(table.domainId),
]);

export const insertDnsRecordSchema = createInsertSchema(dnsRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertDnsRecord = z.infer<typeof insertDnsRecordSchema>;
export type DnsRecord = typeof dnsRecords.$inferSelect;

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
  title: text("title").notNull().default(""),
  model: text("model").notNull().default("gpt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ai_conv_project_idx").on(table.projectId),
  index("ai_conv_user_idx").on(table.userId),
  index("ai_conv_project_user_title_idx").on(table.projectId, table.userId, table.title),
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
  dependsOn: text("depends_on").array().default([]),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ai_plan_task_plan_idx").on(table.planId),
]);

export const insertAiPlanTaskSchema = createInsertSchema(aiPlanTasks).pick({
  planId: true,
  title: true,
  description: true,
  dependsOn: true,
  status: true,
  sortOrder: true,
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
  responseHeaders: json("response_headers").$type<Array<{ path: string; name: string; value: string }>>(),
  rewrites: json("rewrites").$type<Array<{ from: string; to: string }>>(),
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
  responseHeaders: true,
  rewrites: true,
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

export const storageBuckets = pgTable("storage_buckets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerUserId: varchar("owner_user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertStorageBucketSchema = createInsertSchema(storageBuckets).pick({
  name: true,
  ownerUserId: true,
});
export type InsertStorageBucket = z.infer<typeof insertStorageBucketSchema>;
export type StorageBucket = typeof storageBuckets.$inferSelect;

export const bucketAccess = pgTable("bucket_access", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  bucketId: varchar("bucket_id", { length: 36 }).notNull().references(() => storageBuckets.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (table) => [
  index("bucket_access_bucket_idx").on(table.bucketId),
  index("bucket_access_project_idx").on(table.projectId),
]);
export const insertBucketAccessSchema = createInsertSchema(bucketAccess).pick({
  bucketId: true,
  projectId: true,
});
export type InsertBucketAccess = z.infer<typeof insertBucketAccessSchema>;
export type BucketAccess = typeof bucketAccess.$inferSelect;

export const storageObjects = pgTable("storage_objects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  bucketId: varchar("bucket_id", { length: 36 }).references(() => storageBuckets.id),
  folderPath: text("folder_path").notNull().default(""),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("storage_objects_project_idx").on(table.projectId),
  index("storage_objects_bucket_idx").on(table.bucketId),
]);
export const insertStorageObjectSchema = createInsertSchema(storageObjects).pick({
  projectId: true,
  bucketId: true,
  folderPath: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
});
export type InsertStorageObject = z.infer<typeof insertStorageObjectSchema>;
export type StorageObject = typeof storageObjects.$inferSelect;

export const storageBandwidth = pgTable("storage_bandwidth", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  bytesDownloaded: bigint("bytes_downloaded", { mode: "number" }).notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("storage_bandwidth_project_idx").on(table.projectId),
  index("storage_bandwidth_period_idx").on(table.projectId, table.periodStart),
]);
export type StorageBandwidth = typeof storageBandwidth.$inferSelect;

export const STORAGE_PLAN_LIMITS = {
  free: { storageMb: 50, bandwidthGb: 1 },
  pro: { storageMb: 5000, bandwidthGb: 100 },
  team: { storageMb: 50000, bandwidthGb: 500 },
} as const;

export const projectAuthConfig = pgTable("project_auth_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  providers: json("providers").notNull().$type<string[]>().default(["email"]),
  requireEmailVerification: boolean("require_email_verification").notNull().default(false),
  sessionDurationHours: integer("session_duration_hours").notNull().default(24),
  allowedDomains: json("allowed_domains").$type<string[]>().default([]),
  appName: text("app_name"),
  appIconUrl: text("app_icon_url"),
}, (table) => [
  index("auth_config_project_idx").on(table.projectId),
]);
export type ProjectAuthConfig = typeof projectAuthConfig.$inferSelect;

export const loginHistory = pgTable("login_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  ip: text("ip_address"),
  provider: text("provider").notNull().default("email"),
  userAgent: text("user_agent"),
}, (table) => [
  index("login_history_user_idx").on(table.userId),
]);
export type LoginHistory = typeof loginHistory.$inferSelect;

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

export const connectorTypeEnum = ["oauth", "apikey", "managed"] as const;
export type ConnectorType = typeof connectorTypeEnum[number];

export const connectionLevelEnum = ["account", "project"] as const;
export type ConnectionLevel = typeof connectionLevelEnum[number];

export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export const integrationCatalog = pgTable("integration_catalog", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("plug"),
  envVarKeys: json("env_var_keys").notNull().$type<string[]>().default([]),
  connectorType: text("connector_type").notNull().default("apikey"),
  connectionLevel: text("connection_level").notNull().default("project"),
  oauthConfig: json("oauth_config").$type<OAuthConfig>(),
  providerUrl: text("provider_url"),
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

export const userConnections = pgTable("user_connections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).notNull(),
  status: text("status").notNull().default("connected"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  metadata: json("metadata").$type<Record<string, string>>().default({}),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
}, (table) => [
  index("user_connections_user_idx").on(table.userId),
  uniqueIndex("user_connections_unique").on(table.userId, table.integrationId),
]);
export type UserConnection = typeof userConnections.$inferSelect;

export const oauthStates = pgTable("oauth_states", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  state: text("state").notNull().unique(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("oauth_states_state_idx").on(table.state),
]);
export type OAuthState = typeof oauthStates.$inferSelect;

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

export const ALLOWED_EXTERNAL_PORTS = [80, 3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081] as const;
export const BLOCKED_PORTS = [22, 8283] as const;

export const portConfigs = pgTable("port_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  port: integer("port").notNull(),
  internalPort: integer("internal_port").notNull(),
  externalPort: integer("external_port").notNull(),
  label: text("label").notNull().default(""),
  protocol: text("protocol").notNull().default("http"),
  isPublic: boolean("is_public").notNull().default(false),
  exposeLocalhost: boolean("expose_localhost").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("port_configs_project_idx").on(table.projectId),
  uniqueIndex("port_configs_project_port_unique").on(table.projectId, table.port),
  uniqueIndex("port_configs_project_internal_unique").on(table.projectId, table.internalPort),
  uniqueIndex("port_configs_project_external_unique").on(table.projectId, table.externalPort),
]);
export const insertPortConfigSchema = createInsertSchema(portConfigs).pick({
  projectId: true,
  port: true,
  internalPort: true,
  externalPort: true,
  label: true,
  protocol: true,
  isPublic: true,
  exposeLocalhost: true,
});
export type InsertPortConfig = z.infer<typeof insertPortConfigSchema>;
export type PortConfig = typeof portConfigs.$inferSelect;

export const deploymentAnalytics = pgTable("deployment_analytics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  deploymentId: varchar("deployment_id", { length: 36 }),
  path: text("path").notNull().default("/"),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  browser: text("browser"),
  device: text("device"),
  os: text("os"),
  country: text("country"),
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
  statusCode: true,
  durationMs: true,
  referrer: true,
  userAgent: true,
  browser: true,
  device: true,
  os: true,
  country: true,
  visitorId: true,
  ipHash: true,
});
export type InsertDeploymentAnalytic = z.infer<typeof insertDeploymentAnalyticSchema>;
export type DeploymentAnalytic = typeof deploymentAnalytics.$inferSelect;

export const deploymentLogs = pgTable("deployment_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  deploymentId: varchar("deployment_id", { length: 36 }),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  source: text("source").default("runtime"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("deployment_logs_project_idx").on(table.projectId),
  index("deployment_logs_created_idx").on(table.createdAt),
]);
export const insertDeploymentLogSchema = createInsertSchema(deploymentLogs).pick({
  projectId: true,
  deploymentId: true,
  level: true,
  message: true,
  source: true,
});
export type InsertDeploymentLog = z.infer<typeof insertDeploymentLogSchema>;
export type DeploymentLog = typeof deploymentLogs.$inferSelect;

export const resourceSnapshots = pgTable("resource_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  cpuPercent: integer("cpu_percent").notNull().default(0),
  memoryMb: integer("memory_mb").notNull().default(0),
  heapMb: integer("heap_mb"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => [
  index("resource_snapshots_project_idx").on(table.projectId),
  index("resource_snapshots_recorded_idx").on(table.recordedAt),
]);
export const insertResourceSnapshotSchema = createInsertSchema(resourceSnapshots).pick({
  projectId: true,
  cpuPercent: true,
  memoryMb: true,
  heapMb: true,
});
export type InsertResourceSnapshot = z.infer<typeof insertResourceSnapshotSchema>;
export type ResourceSnapshot = typeof resourceSnapshots.$inferSelect;

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
  aiDescription: text("ai_description"),
  type: text("type").notNull().default("manual"),
  trigger: text("trigger").notNull().default("manual"),
  triggerType: text("trigger_type").notNull().default("manual"),
  stateSnapshot: json("state_snapshot").notNull().$type<CheckpointStateSnapshot>(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  creditsCost: real("credits_cost").notNull().default(0),
  gitCommitHash: text("git_commit_hash"),
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
  sizeBytes: true,
  creditsCost: true,
  gitCommitHash: true,
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
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  output: text("output"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("task_steps_task_idx").on(table.taskId),
]);

export const insertTaskStepSchema = createInsertSchema(taskSteps).pick({
  taskId: true,
  sortOrder: true,
  title: true,
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
  command: text("command").notNull().default(""),
  args: json("args").$type<string[]>().notNull().default([]),
  env: json("env").$type<Record<string, string>>().notNull().default({}),
  baseUrl: text("base_url"),
  headers: json("headers").$type<Record<string, string>>().notNull().default({}),
  serverType: text("server_type").notNull().default("stdio"),
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
  baseUrl: true,
  headers: true,
  serverType: true,
  isBuiltIn: true,
});
export type InsertMcpServer = z.infer<typeof insertMcpServerSchema>;
export type McpServer = typeof mcpServers.$inferSelect;

export const MCP_DIRECTORY_SERVERS = [
  { id: "atlassian", name: "Atlassian", description: "Connect to Jira, Confluence, and other Atlassian products", icon: "clipboard", baseUrl: "https://mcp.atlassian.com/v1/sse", category: "Project Management" },
  { id: "amplitude", name: "Amplitude", description: "Analytics and product intelligence platform", icon: "bar-chart", baseUrl: "https://mcp.amplitude.com/v1/sse", category: "Analytics" },
  { id: "granola", name: "Granola", description: "AI-powered meeting notes and knowledge management", icon: "book-open", baseUrl: "https://mcp.granola.ai/v1/sse", category: "Productivity" },
  { id: "linear", name: "Linear", description: "Issue tracking and project management for software teams", icon: "git-branch", baseUrl: "https://mcp.linear.app/v1/sse", category: "Project Management" },
  { id: "miro", name: "Miro", description: "Visual collaboration and whiteboarding platform", icon: "layout", baseUrl: "https://mcp.miro.com/v1/sse", category: "Productivity" },
  { id: "notion", name: "Notion", description: "All-in-one workspace for notes, docs, and databases", icon: "book-open", baseUrl: "https://mcp.notion.so/v1/sse", category: "Productivity" },
  { id: "posthog", name: "PostHog", description: "Product analytics, feature flags, and session replay", icon: "bar-chart", baseUrl: "https://mcp.posthog.com/v1/sse", category: "Analytics" },
  { id: "sentry", name: "Sentry", description: "Error monitoring and performance tracking", icon: "zap", baseUrl: "https://mcp.sentry.io/v1/sse", category: "Developer Tools" },
  { id: "stripe", name: "Stripe", description: "Payment processing and financial infrastructure", icon: "credit-card", baseUrl: "https://mcp.stripe.com/v1/sse", category: "Payments" },
] as const;

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

export const notificationCategoryEnum = ["agent", "billing", "deployment", "security", "team", "system"] as const;
export type NotificationCategory = typeof notificationCategoryEnum[number];

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  category: text("category").notNull().default("system"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  actionUrl: text("action_url"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.isRead),
  index("notifications_created_idx").on(table.createdAt),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  agent: boolean("agent").notNull().default(true),
  billing: boolean("billing").notNull().default(true),
  deployment: boolean("deployment").notNull().default(true),
  security: boolean("security").notNull().default(true),
  team: boolean("team").notNull().default(true),
  system: boolean("system").notNull().default(true),
}, (table) => [
  uniqueIndex("notification_prefs_user_unique").on(table.userId),
]);

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

export const sshKeys = pgTable("ssh_keys", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  label: text("label").notNull(),
  publicKey: text("public_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ssh_keys_user_id_idx").on(table.userId),
  uniqueIndex("ssh_keys_user_fingerprint_unique").on(table.userId, table.fingerprint),
]);

export const insertSshKeySchema = createInsertSchema(sshKeys).pick({
  label: true,
  publicKey: true,
});
export type InsertSshKey = z.infer<typeof insertSshKeySchema>;
export type SshKey = typeof sshKeys.$inferSelect;

export interface MergeConflictFile {
  filename: string;
  oursContent: string;
  theirsContent: string;
  mergedContent: string;
}

export interface MergeResolution {
  filename: string;
  resolvedContent: string;
}

export const mergeStates = pgTable("merge_states", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().unique(),
  branch: text("branch").notNull().default("main"),
  localOid: text("local_oid").notNull(),
  remoteOid: text("remote_oid").notNull(),
  conflicts: json("conflicts").$type<MergeConflictFile[]>().notNull().default([]),
  resolutions: json("resolutions").$type<MergeResolution[]>().notNull().default([]),
  status: text("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("merge_states_project_idx").on(table.projectId),
]);

export const insertMergeStateSchema = createInsertSchema(mergeStates).omit({ id: true, createdAt: true });
export type InsertMergeState = z.infer<typeof insertMergeStateSchema>;
export type MergeState = typeof mergeStates.$inferSelect;

export const accountWarnings = pgTable("account_warnings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  reason: text("reason").notNull(),
  severity: text("severity").notNull().default("low"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
}, (table) => [
  index("account_warnings_user_idx").on(table.userId),
]);
export const insertAccountWarningSchema = createInsertSchema(accountWarnings).omit({ id: true, issuedAt: true });
export type InsertAccountWarning = z.infer<typeof insertAccountWarningSchema>;
export type AccountWarning = typeof accountWarnings.$inferSelect;

export const desktopReleases = pgTable("desktop_releases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull(),
  platform: text("platform").notNull(),
  downloadUrl: text("download_url").notNull(),
  changelog: text("changelog"),
  fileSize: integer("file_size"),
  sha512: text("sha512"),
  isLatest: boolean("is_latest").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("desktop_releases_version_idx").on(table.version),
  index("desktop_releases_platform_idx").on(table.platform),
  index("desktop_releases_latest_idx").on(table.isLatest),
]);

export const insertDesktopReleaseSchema = createInsertSchema(desktopReleases).omit({ id: true, createdAt: true });
export type InsertDesktopRelease = z.infer<typeof insertDesktopReleaseSchema>;
export type DesktopRelease = typeof desktopReleases.$inferSelect;

export const desktopDownloads = pgTable("desktop_downloads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(),
  version: text("version").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("desktop_downloads_platform_idx").on(table.platform),
]);

export const canvasFrames = pgTable("canvas_frames", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  name: text("name").notNull().default("Untitled Frame"),
  htmlContent: text("html_content").notNull().default(""),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  width: integer("width").notNull().default(400),
  height: integer("height").notNull().default(300),
  zIndex: integer("z_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("canvas_frames_project_idx").on(table.projectId),
]);

export const insertCanvasFrameSchema = createInsertSchema(canvasFrames).omit({ id: true, createdAt: true });
export type InsertCanvasFrame = z.infer<typeof insertCanvasFrameSchema>;
export type CanvasFrame = typeof canvasFrames.$inferSelect;

export const canvasAnnotationTypeEnum = ["sticky", "text", "image"] as const;
export type CanvasAnnotationType = typeof canvasAnnotationTypeEnum[number];

export const canvasAnnotations = pgTable("canvas_annotations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  type: text("type").notNull().default("sticky"),
  content: text("content").notNull().default(""),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  width: integer("width").notNull().default(200),
  height: integer("height").notNull().default(150),
  color: text("color").notNull().default("#FBBF24"),
  zIndex: integer("z_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("canvas_annotations_project_idx").on(table.projectId),
]);

export const insertCanvasAnnotationSchema = createInsertSchema(canvasAnnotations).omit({ id: true, createdAt: true });
export type InsertCanvasAnnotation = z.infer<typeof insertCanvasAnnotationSchema>;
export type CanvasAnnotation = typeof canvasAnnotations.$inferSelect;
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

export const CONVERSION_STATUSES = ["pending", "analyzing", "generating", "complete", "failed"] as const;
export type ConversionStatus = typeof CONVERSION_STATUSES[number];

export const conversions = pgTable("conversions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  frameId: varchar("frame_id", { length: 36 }).notNull(),
  targetArtifactType: text("target_artifact_type").notNull(),
  artifactId: varchar("artifact_id", { length: 36 }),
  status: text("status").notNull().default("pending"),
  designTokens: json("design_tokens").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("conversions_project_idx").on(table.projectId),
  index("conversions_frame_idx").on(table.frameId),
]);

export const insertConversionSchema = createInsertSchema(conversions).omit({ id: true, createdAt: true });
export type InsertConversion = z.infer<typeof insertConversionSchema>;
export type Conversion = typeof conversions.$inferSelect;

export const artifactTemplates = pgTable("artifact_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  outputType: text("output_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  files: json("files").$type<{ filename: string; content: string }[]>().notNull().default([]),
  dependencies: json("dependencies").$type<Record<string, string>>().notNull().default({}),
  buildCommand: text("build_command"),
  runCommand: text("run_command"),
  systemPromptHint: text("system_prompt_hint"),
}, (table) => [
  index("artifact_templates_output_type_idx").on(table.outputType),
]);

export const insertArtifactTemplateSchema = createInsertSchema(artifactTemplates).omit({ id: true });
export type InsertArtifactTemplate = z.infer<typeof insertArtifactTemplateSchema>;
export type ArtifactTemplate = typeof artifactTemplates.$inferSelect;

export const deploymentFeedback = pgTable("deployment_feedback", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  deploymentId: varchar("deployment_id", { length: 36 }),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  content: text("content").notNull(),
  attachments: json("attachments").$type<string[]>().default([]),
  pageUrl: text("page_url"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("deployment_feedback_project_idx").on(table.projectId),
  index("deployment_feedback_status_idx").on(table.status),
]);
export const insertDeploymentFeedbackSchema = createInsertSchema(deploymentFeedback).pick({
  projectId: true,
  deploymentId: true,
  visitorName: true,
  visitorEmail: true,
  content: true,
  attachments: true,
  pageUrl: true,
});
export type InsertDeploymentFeedback = z.infer<typeof insertDeploymentFeedbackSchema>;
export type DeploymentFeedback = typeof deploymentFeedback.$inferSelect;

export const AI_PROVIDERS = ["openai", "anthropic", "google", "openrouter"] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

export const AI_CREDENTIAL_MODES = ["managed", "byok"] as const;
export type AiCredentialMode = typeof AI_CREDENTIAL_MODES[number];

export const aiCredentialConfigs = pgTable("ai_credential_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull().default("managed"),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("ai_cred_configs_project_idx").on(table.projectId),
  uniqueIndex("ai_cred_configs_project_provider_unique").on(table.projectId, table.provider),
]);

export const insertAiCredentialConfigSchema = createInsertSchema(aiCredentialConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiCredentialConfig = z.infer<typeof insertAiCredentialConfigSchema>;
export type AiCredentialConfig = typeof aiCredentialConfigs.$inferSelect;

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  projectId: varchar("project_id", { length: 36 }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  endpoint: text("endpoint"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCost: real("cost_cents").notNull().default(0),
  credentialMode: text("credential_mode").notNull().default("managed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ai_usage_logs_user_idx").on(table.userId),
  index("ai_usage_logs_project_idx").on(table.projectId),
  index("ai_usage_logs_created_idx").on(table.createdAt),
]);

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({ id: true, createdAt: true });
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  authorName: text("author_name").notNull().default("Anonymous"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  likes: integer("likes").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_posts_user_idx").on(table.userId),
  index("community_posts_created_idx").on(table.createdAt),
]);

export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({ id: true, likes: true, replyCount: true, createdAt: true });
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;

export const communityReplies = pgTable("community_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  authorName: text("author_name").notNull().default("Anonymous"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("community_replies_post_idx").on(table.postId),
]);

export const insertCommunityReplySchema = createInsertSchema(communityReplies).omit({ id: true, createdAt: true });
export type InsertCommunityReply = z.infer<typeof insertCommunityReplySchema>;
export type CommunityReply = typeof communityReplies.$inferSelect;

export const communityLikes = pgTable("community_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("community_likes_unique").on(table.postId, table.userId),
]);

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: text("email"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("support_tickets_user_idx").on(table.userId),
]);

export const revokedTokens = pgTable("revoked_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull(),
  userId: varchar("user_id").notNull(),
  revokedAt: timestamp("revoked_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const rateLimitViolations = pgTable("rate_limit_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  ip: text("ip"),
  endpoint: text("endpoint").notNull(),
  violationType: text("violation_type").notNull().default("rate_limit"),
  count: integer("count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiStripeUsageQueue = pgTable("ai_stripe_usage_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  credits: integer("credits").notNull(),
  provider: text("provider"),
  model: text("model"),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id"),
  userId: varchar("user_id"),
  claudeSessionId: varchar("claude_session_id", { length: 255 }),
  sessionToken: text("session_token"),
  model: text("model"),
  isActive: boolean("is_active").default(true),
  autonomousMode: boolean("autonomous_mode").default(false),
  riskThreshold: text("risk_threshold").default("medium"),
  autoApproveActions: boolean("auto_approve_actions").default(false),
  workflowStatus: text("workflow_status").default("idle"),
  context: json("context"),
  mode: text("mode").default("chat"),
  status: text("status").default("active"),
  metadata: json("metadata"),
  totalTokensUsed: integer("total_tokens_used").default(0),
  totalOperations: integer("total_operations").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentAuditTrail = pgTable("agent_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentStepCache = pgTable("agent_step_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  stepHash: text("step_hash").notNull(),
  result: json("result"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiUsageMetering = pgTable("ai_usage_metering", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cost: real("cost").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const autoCheckpointFiles = pgTable("auto_checkpoint_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  checkpointId: varchar("checkpoint_id").notNull(),
  filename: text("filename").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const browserTestExecutions = pgTable("browser_test_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  testName: text("test_name").notNull(),
  status: text("status").notNull().default("pending"),
  result: json("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const buildLogs = pgTable("build_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  deploymentId: varchar("deployment_id"),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengeLeaderboard = pgTable("challenge_leaderboard", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  challengeId: varchar("challenge_id").notNull(),
  score: integer("score").notNull().default(0),
  rank: integer("rank"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checkpointDatabase = pgTable("checkpoint_database", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  checkpointId: varchar("checkpoint_id").notNull(),
  dbSnapshot: json("db_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const environmentVariables = pgTable("environment_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLspDiagnosticSchema = z.object({
  projectId: z.string(),
  fileId: z.string().optional(),
  filename: z.string(),
  diagnostics: z.any(),
});

export const mobileBuildRequestSchema = z.object({
  projectId: z.string(),
  platform: z.enum(["ios", "android"]).default("android"),
  buildType: z.enum(["debug", "release"]).default("debug"),
});

export const networkingDomains = pgTable("networking_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("pending"),
  sslStatus: text("ssl_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payAsYouGoQueue = pgTable("pay_as_you_go_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectExtensions = pgTable("project_extensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  extensionId: varchar("extension_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  author: text("author"),
  version: text("version"),
  category: text("category"),
  icon: text("icon"),
  npmPackage: text("npm_package"),
  enabled: boolean("enabled").notNull().default(true),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectSettings = pgTable("project_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  key: text("key").notNull(),
  value: json("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectWorkflows = pgTable("project_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  triggerEvent: text("trigger_event"),
  config: json("config"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: varchar("assignee_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const runnerWorkspaces = pgTable("runner_workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  status: text("status").notNull().default("idle"),
  port: integer("port"),
  pid: integer("pid"),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  invitedBy: varchar("invited_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const videoProjects = pgTable("video_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  config: json("config"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voiceVideoParticipants = pgTable("voice_video_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("participant"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
});

export const AI_MODELS = {
  "gpt-4.1": { provider: "openai", name: "GPT-4.1", maxTokens: 1047576 },
  "gpt-4.1-mini": { provider: "openai", name: "GPT-4.1 Mini", maxTokens: 1047576 },
  "gpt-4.1-nano": { provider: "openai", name: "GPT-4.1 Nano", maxTokens: 1047576 },
  "o4-mini": { provider: "openai", name: "o4-mini", maxTokens: 200000 },
  "o3": { provider: "openai", name: "o3", maxTokens: 200000 },
  "claude-sonnet-4-6": { provider: "anthropic", name: "Claude Sonnet 4.6", maxTokens: 200000 },
  "claude-opus-4-7": { provider: "anthropic", name: "Claude Opus 4.7", maxTokens: 1000000 },
  "claude-haiku-4-5-20251001": { provider: "anthropic", name: "Claude Haiku 4.5", maxTokens: 200000 },
  "gemini-2.5-pro": { provider: "gemini", name: "Gemini 2.5 Pro", maxTokens: 1000000 },
  "gemini-2.5-flash": { provider: "gemini", name: "Gemini 2.5 Flash", maxTokens: 1000000 },
} as const;

export const autoCheckpoints = pgTable("auto_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  label: text("label"),
  status: text("status").notNull().default("created"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const autonomousActions = pgTable("autonomous_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  action: text("action").notNull(),
  status: text("status").notNull().default("pending"),
  result: json("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengeSubmissions = pgTable("challenge_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull(),
  userId: varchar("user_id").notNull(),
  code: text("code"),
  status: text("status").notNull().default("submitted"),
  score: integer("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checkpointFiles = pgTable("checkpoint_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkpointId: varchar("checkpoint_id").notNull(),
  projectId: varchar("project_id").notNull(),
  filename: text("filename").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deploymentMetrics = pgTable("deployment_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  deploymentId: varchar("deployment_id"),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deviceTokens = pgTable("device_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform").notNull().default("web"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fileOperations = pgTable("file_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id"),
  operation: text("operation").notNull(),
  filename: text("filename").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertResourceMetricSchema = z.object({
  projectId: z.string(),
  cpu: z.number().optional(),
  memory: z.number().optional(),
  disk: z.number().optional(),
  network: z.number().optional(),
});

export const mobileBuilds = pgTable("mobile_builds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  platform: text("platform").notNull().default("android"),
  buildType: text("build_type").notNull().default("debug"),
  status: text("status").notNull().default("pending"),
  artifactUrl: text("artifact_url"),
  logs: text("logs"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const networkingPorts = pgTable("networking_ports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  port: integer("port").notNull(),
  protocol: text("protocol").notNull().default("tcp"),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectDatabaseBackups = pgTable("project_database_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  filename: text("filename").notNull(),
  size: integer("size"),
  status: text("status").notNull().default("created"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const securityLogs = pgTable("security_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  event: text("event").notNull(),
  ip: text("ip"),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storageMetricsHistory = pgTable("storage_metrics_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  metricType: text("metric_type").notNull(),
  value: real("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamWorkspaces = pgTable("team_workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const templateCategories = pgTable("template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const testArtifacts = pgTable("test_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").notNull(),
  type: text("type").notNull(),
  path: text("path"),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const testingSessionRecordings = pgTable("testing_session_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  recording: json("recording"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageAlerts = pgTable("usage_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  alertType: text("alert_type").notNull(),
  threshold: real("threshold"),
  currentValue: real("current_value"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  eventType: text("event_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voiceVideoSessions = pgTable("voice_video_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  hostId: varchar("host_id").notNull(),
  status: text("status").notNull().default("active"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const workflowTasks = pgTable("workflow_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  config: json("config"),
  result: json("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: text("difficulty").notNull().default("medium"),
  category: text("category"),
  starterCode: text("starter_code"),
  testCases: json("test_cases"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checkpointRestores = pgTable("checkpoint_restores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkpointId: varchar("checkpoint_id").notNull(),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commandExecutions = pgTable("command_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  command: text("command").notNull(),
  exitCode: integer("exit_code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const elementSelectors = pgTable("element_selectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  selector: text("selector").notNull(),
  label: text("label"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVulnerabilitySchema = z.object({
  projectId: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  title: z.string(),
  description: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().optional(),
});

export const maxAutonomySessions = pgTable("max_autonomy_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("active"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const mobileDevices = pgTable("mobile_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  platform: text("platform").notNull(),
  model: text("model"),
  osVersion: text("os_version"),
  appVersion: text("app_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  tags: json("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectDatabases = pgTable("project_databases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  engine: text("engine").notNull().default("postgresql"),
  connectionString: text("connection_string"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const templateRatings = pgTable("template_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageLedger = pgTable("usage_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entryType: text("entry_type").notNull(),
  amount: real("amount").notNull(),
  balance: real("balance"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webSearchHistory = pgTable("web_search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  query: text("query").notNull(),
  results: json("results"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collaborationSessions = pgTable("collaboration_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  hostId: varchar("host_id").notNull(),
  status: text("status").notNull().default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityCategories = pgTable("community_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deploymentSnapshots = pgTable("deployment_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  deploymentId: varchar("deployment_id"),
  snapshot: json("snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBountyReviewSchema = z.object({
  bountyId: z.string(),
  reviewerId: z.string(),
  status: z.enum(["approved", "rejected", "needs_revision"]).default("approved"),
  feedback: z.string().optional(),
});

export const maxAutonomyTasks = pgTable("max_autonomy_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  projectId: varchar("project_id").notNull(),
  task: text("task").notNull(),
  status: text("status").notNull().default("pending"),
  result: json("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pushNotifications = pgTable("push_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  data: json("data"),
  sent: boolean("sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessionRecordings = pgTable("session_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  events: json("events"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const templateTags = pgTable("template_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const toolExecutions = pgTable("tool_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  tool: text("tool").notNull(),
  input: json("input"),
  output: json("output"),
  status: text("status").notNull().default("success"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).optional(),
  name: z.string().optional(),
});

export const autonomyMessageQueue = pgTable("autonomy_message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityComments = pgTable("community_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBountySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  amount: z.number(),
  currency: z.string().default("USD"),
  projectId: z.string().optional(),
  deadline: z.string().optional(),
});

export const sessionParticipants = pgTable("session_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("participant"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
});

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id"),
  framework: text("framework"),
  language: text("language"),
  config: json("config"),
  thumbnail: text("thumbnail"),
  featured: boolean("featured").notNull().default(false),
  uses: integer("uses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const toolRegistry = pgTable("tool_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  schema: json("schema"),
  handler: text("handler"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentWorkflows = pgTable("agent_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  steps: json("steps"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collaborationMessages = pgTable("collaboration_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityPostBookmarks = pgTable("community_post_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBountySubmissionSchema = z.object({
  bountyId: z.string(),
  userId: z.string(),
  description: z.string().optional(),
  repositoryUrl: z.string().optional(),
  demoUrl: z.string().optional(),
});

export const agentPlans = pgTable("agent_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  plan: json("plan"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityPostLikes = pgTable("community_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiTokenUsage = pgTable("ai_token_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cost: real("cost"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiTaskClassifications = pgTable("ai_task_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: text("task_type").notNull(),
  classification: text("classification").notNull(),
  confidence: real("confidence").notNull().default(0),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type AiTaskClassification = typeof aiTaskClassifications.$inferSelect;
export type InsertAiTaskClassification = typeof aiTaskClassifications.$inferInsert;

export const agentTasks = pgTable("agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  result: json("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiProviderHealth = pgTable("ai_provider_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("healthy"),
  latency: real("latency"),
  errorRate: real("error_rate"),
  lastCheck: timestamp("last_check").notNull().defaultNow(),
});

export const aiRequestQueue = pgTable("ai_request_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  prompt: text("prompt"),
  status: text("status").notNull().default("queued"),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  condition: text("condition").notNull(),
  threshold: real("threshold"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix"),
  scopes: json("scopes"),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiUsage = pgTable("api_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code"),
  latency: integer("latency"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("assigned"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: varchar("resource_id"),
  details: json("details"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authAttempts = pgTable("auth_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email"),
  ip: text("ip"),
  success: boolean("success").notNull(),
  method: text("method").notNull().default("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content"),
  authorId: varchar("author_id"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const codeReviews = pgTable("code_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id"),
  filename: text("filename"),
  diff: text("diff"),
  feedback: text("feedback"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  userId: varchar("user_id").notNull(),
  title: text("title"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DbMcpServer = {
  id: string;
  projectId: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
};

export const deploymentEnvironments = pgTable("deployment_environments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  config: json("config"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deploymentStrategies = pgTable("deployment_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  strategy: text("strategy").notNull().default("rolling"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ElementSelector = typeof elementSelectors.$inferSelect;
export type InsertElementSelector = typeof elementSelectors.$inferInsert;
export type SessionRecording = typeof sessionRecordings.$inferSelect;
export type InsertSessionRecording = typeof sessionRecordings.$inferInsert;

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  level: text("level").notNull().default("error"),
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMobileSessionSchema = z.object({
  deviceId: z.string(),
  platform: z.string().default("android"),
  appVersion: z.string().optional(),
});
export type MobileSession = { id: string; deviceId: string; platform: string; appVersion?: string; createdAt: Date };

export const mentorProfiles = pgTable("mentor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  expertise: json("expertise"),
  bio: text("bio"),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mentorshipSessions = pgTable("mentorship_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull(),
  menteeId: varchar("mentee_id").notNull(),
  status: text("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const monitoringEvents = pgTable("monitoring_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  message: text("message"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  resource: text("resource"),
  action: text("action"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectSlidesCollection = pgTable("project_slides_collection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  slides: json("slides"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewApprovals = pgTable("review_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull(),
  approverId: varchar("approver_id").notNull(),
  status: text("status").notNull().default("approved"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewComments = pgTable("review_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  line: integer("line"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewIssues = pgTable("review_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull(),
  severity: text("severity").notNull().default("warning"),
  title: text("title").notNull(),
  description: text("description"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  permissions: json("permissions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scalingPolicies = pgTable("scaling_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  metric: text("metric").notNull(),
  minInstances: integer("min_instances").notNull().default(1),
  maxInstances: integer("max_instances").notNull().default(5),
  targetValue: real("target_value"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const securityEvents = pgTable("security_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  details: json("details"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  bountyId: varchar("bounty_id"),
  description: text("description"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  value: json("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const terminalLogs = pgTable("terminal_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sessionId: varchar("session_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  feature: text("feature").notNull(),
  count: integer("count").notNull().default(1),
  period: text("period"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const visitorFeedback = pgTable("visitor_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email"),
  message: text("message").notNull(),
  rating: integer("rating"),
  page: text("page"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voiceCommandSettings = pgTable("voice_command_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  language: text("language").notNull().default("en"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentSkills = pgTable("agent_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  handler: text("handler"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
