// Comments schema for projects and files
import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  fileId: integer('file_id'),
  authorId: integer('author_id').notNull(),
  content: text('content').notNull(),
  lineNumber: integer('line_number'),
  resolved: boolean('resolved').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;