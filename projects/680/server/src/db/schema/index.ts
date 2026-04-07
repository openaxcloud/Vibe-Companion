import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { memberships } from "./memberships";
import { invitations } from "./invitations";
import { apiKeys } from "./apiKeys";
import { sessions } from "./sessions";
import { auditLogs } from "./auditLogs";
import { featureFlags } from "./featureFlags";
import { organizationFeatureFlags } from "./organizationFeatureFlags";
import { webhooks } from "./webhooks";
import { webhookDeliveries } from "./webhookDeliveries";
import { files } from "./files";
import { fileLinks } from "./fileLinks";
import { tasks } from "./tasks";
import { taskComments } from "./taskComments";
import { taskAssignees } from "./taskAssignees";

export {
  users,
  organizations,
  projects,
  memberships,
  invitations,
  apiKeys,
  sessions,
  auditLogs,
  featureFlags,
  organizationFeatureFlags,
  webhooks,
  webhookDeliveries,
  files,
  fileLinks,
  tasks,
  taskComments,
  taskAssignees,
};

export const usersRelations = relations(users, ({ one, many }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  invitations: many(invitations),
  tasksCreated: many(tasks, { relationName: "tasksCreatedBy" }),
  tasksUpdated: many(tasks, { relationName: "tasksUpdatedBy" }),
  taskComments: many(taskComments),
  taskAssignees: many(taskAssignees),
  files: many(files, { relationName: "filesUploadedBy" }),
  webhooks: many(webhooks, { relationName: "webhooksCreatedBy" }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
  invitations: many(invitations),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  organizationFeatureFlags: many(organizationFeatureFlags),
  webhooks: many(webhooks, { relationName: "webhooksOrganization" }),
  files: many(files, { relationName: "filesOrganization" }),
  tasks: many(tasks),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
  files: many(files, { relationName: "filesProject" }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [invitations.invitedByUserId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ many }) => ({
  organizationFeatureFlags: many(organizationFeatureFlags),
}));

export const organizationFeatureFlagsRelations = relations(
  organizationFeatureFlags,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationFeatureFlags.organizationId],
      references: [organizations.id],
    }),
    featureFlag: one(featureFlags, {
      fields: [organizationFeatureFlags.featureFlagId],
      references: [featureFlags.id],
    }),
  })
);

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [webhooks.createdByUserId],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [webhooks.id],
    }),
  })
);

export const filesRelations = relations(files, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [files.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  uploadedBy: one(users, {
    fields: [files.uploadedByUserId],
    references: [users.id],
  }),
  links: many(fileLinks),
}));

export const fileLinksRelations = relations(fileLinks, ({ one }) => ({
  file: one(files, {
    fields: [fileLinks.fileId],
    references: [files.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdByUserId],
    references: [users.id],
    relationName: "tasksCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [tasks.updatedByUserId],
    references: [users.id],
    relationName: "tasksUpdatedBy",
  }),
  comments: many(taskComments),
  assignees: many(taskAssignees),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}));