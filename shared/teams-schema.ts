import { pgTable, text, integer, timestamp, boolean, varchar, uuid, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// #115 FIXED: Define roleEnum for teams (matches shared/schema.ts)
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member', 'viewer']);

// Teams table
// NOTE (#113-114): This is a duplicate of teams table in shared/schema.ts.
// The canonical version is in shared/schema.ts. This file provides extended team features.
// Consider consolidating these definitions in a future refactoring.
export const teams = pgTable('teams', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  logo: text('logo'),
  ownerId: integer('owner_id').notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // free, pro, enterprise
  settings: jsonb('settings').default({}),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  memberLimit: integer('member_limit').notNull().default(5),
  storageLimit: integer('storage_limit').notNull().default(10737418240), // 10GB default
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Team members table
export const teamMembers = pgTable('team_members', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').notNull(),
  userId: integer('user_id').notNull(),
  role: roleEnum('role').notNull().default('member'), // #115 FIXED: Changed from varchar to roleEnum
  permissions: jsonb('permissions').default({}),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  invitedBy: integer('invited_by'),
  isActive: boolean('is_active').notNull().default(true)
});

// Team invitations table
export const teamInvitations = pgTable('team_invitations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  invitedBy: integer('invited_by').notNull(),
  token: uuid('token').notNull().defaultRandom(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Team projects table (links projects to teams)
export const teamProjects = pgTable('team_projects', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').notNull(),
  projectId: integer('project_id').notNull(),
  addedBy: integer('added_by').notNull(),
  visibility: varchar('visibility', { length: 50 }).notNull().default('team'), // team, public
  permissions: jsonb('permissions').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Team workspaces table
export const teamWorkspaces = pgTable('team_workspaces', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  settings: jsonb('settings').default({}),
  isDefault: boolean('is_default').notNull().default(false),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Workspace projects (projects within a workspace)
export const workspaceProjects = pgTable('workspace_projects', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer('workspace_id').notNull(),
  projectId: integer('project_id').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Team activity log
export const teamActivity = pgTable('team_activity', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').notNull(),
  userId: integer('user_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Schema exports
export const insertTeamSchema = createInsertSchema(teams);
export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const insertTeamInvitationSchema = createInsertSchema(teamInvitations);
export const insertTeamProjectSchema = createInsertSchema(teamProjects);
export const insertTeamWorkspaceSchema = createInsertSchema(teamWorkspaces);
export const insertWorkspaceProjectSchema = createInsertSchema(workspaceProjects);
export const insertTeamActivitySchema = createInsertSchema(teamActivity);

// Type exports
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type TeamProject = typeof teamProjects.$inferSelect;
export type TeamWorkspace = typeof teamWorkspaces.$inferSelect;
export type WorkspaceProject = typeof workspaceProjects.$inferSelect;
export type TeamActivity = typeof teamActivity.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type InsertTeamProject = z.infer<typeof insertTeamProjectSchema>;
export type InsertTeamWorkspace = z.infer<typeof insertTeamWorkspaceSchema>;
export type InsertWorkspaceProject = z.infer<typeof insertWorkspaceProjectSchema>;
export type InsertTeamActivity = z.infer<typeof insertTeamActivitySchema>;

// Permission types
export interface TeamPermissions {
  canInviteMembers?: boolean;
  canRemoveMembers?: boolean;
  canManageProjects?: boolean;
  canManageWorkspaces?: boolean;
  canManageBilling?: boolean;
  canDeleteTeam?: boolean;
}

export interface ProjectPermissions {
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canManageCollaborators?: boolean;
  canDeploy?: boolean;
}