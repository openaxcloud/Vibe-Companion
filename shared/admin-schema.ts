import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

// AI Provider Keys for admin panel - DIFFERENT from user api_keys in shared/schema.ts
// NOTE: shared/schema.ts has api_keys for user-generated API keys with userId
// This schema is for admin-managed AI provider credentials (OpenAI, Anthropic, etc.)
// Columns match the actual DB: service, api_key, key_name, provider, usage_count, reset_date
export const adminApiKeys = pgTable("admin_api_keys", {
  id: serial("id").primaryKey(),
  service: text("service"),
  apiKey: text("api_key"),
  isActive: boolean("is_active").default(true),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  provider: varchar("provider", { length: 255 }),
  keyName: varchar("key_name", { length: 255 }),
  resetDate: timestamp("reset_date"),
});

export const insertAdminApiKeySchema = createInsertSchema(adminApiKeys);
export type InsertAdminApiKey = z.infer<typeof insertAdminApiKeySchema>;
export type AdminApiKey = typeof adminApiKeys.$inferSelect;

// CMS Pages - uses SERIAL in DB
export const cmsPages = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  status: varchar("status", { length: 20 }).default("draft"),
  publishedAt: timestamp("published_at"),
  authorId: integer("author_id").references(() => users.id),
  template: varchar("template", { length: 50 }).default("default"),
  customCss: text("custom_css"),
  customJs: text("custom_js"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertCmsPageSchema = createInsertSchema(cmsPages);
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type CmsPage = typeof cmsPages.$inferSelect;

// Documentation - uses SERIAL in DB
export const documentation = pgTable("documentation", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  order: integer("order").default(0),
  status: varchar("status", { length: 20 }).default("draft"),
  version: varchar("version", { length: 20 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  relatedDocs: jsonb("related_docs").$type<number[]>().default([]),
  authorId: integer("author_id").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertDocumentationSchema = createInsertSchema(documentation);
export type InsertDocumentation = z.infer<typeof insertDocumentationSchema>;
export type Documentation = typeof documentation.$inferSelect;

// Documentation Categories - uses SERIAL in DB
export const docCategories = pgTable("doc_categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertDocCategorySchema = createInsertSchema(docCategories);
export type InsertDocCategory = z.infer<typeof insertDocCategorySchema>;
export type DocCategory = typeof docCategories.$inferSelect;

// Support Tickets - uses GENERATED ALWAYS AS IDENTITY in DB
export const supportTickets = pgTable("support_tickets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  ticketNumber: varchar("ticket_number", { length: 20 }).unique().notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }),
  priority: varchar("priority", { length: 20 }).default("normal"),
  status: varchar("status", { length: 20 }).default("open"),
  assignedTo: integer("assigned_to").references(() => users.id),
  tags: jsonb("tags").$type<string[]>().default([]),
  attachments: jsonb("attachments").$type<{url: string, name: string}[]>().default([]),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets);
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

// Support Ticket Replies - uses GENERATED ALWAYS AS IDENTITY in DB
export const ticketReplies = pgTable("ticket_replies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false),
  attachments: jsonb("attachments").$type<{url: string, name: string}[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertTicketReplySchema = createInsertSchema(ticketReplies);
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;

// User Subscriptions - uses SERIAL in DB
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  planId: varchar("plan_id", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("active"),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  cancelledAt: timestamp("cancelled_at"),
  features: jsonb("features").$type<Record<string, any>>().default({}),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Admin Activity Logs - uses SERIAL in DB
export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertAdminActivityLogSchema = createInsertSchema(adminActivityLogs);
export type InsertAdminActivityLog = z.infer<typeof insertAdminActivityLogSchema>;
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
