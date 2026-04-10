// Project tracking schema for time tracking and screenshots
import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const projectTimeTracking = pgTable('project_time_tracking', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  userId: integer('user_id').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // in seconds
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectScreenshots = pgTable('project_screenshots', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  userId: integer('user_id').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskSummaries = pgTable('task_summaries', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  userId: integer('user_id').notNull(),
  taskDescription: text('task_description').notNull(),
  summary: text('summary').notNull(),
  filesChanged: integer('files_changed').default(0),
  linesAdded: integer('lines_added').default(0),
  linesDeleted: integer('lines_deleted').default(0),
  timeSpent: integer('time_spent'), // in seconds
  completed: boolean('completed').default(false),
  screenshotId: integer('screenshot_id'),
  checkpointId: integer('checkpoint_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertTimeTrackingSchema = createInsertSchema(projectTimeTracking).omit({
  id: true,
  createdAt: true,
});

export const insertScreenshotSchema = createInsertSchema(projectScreenshots).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSummarySchema = createInsertSchema(taskSummaries).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeTracking = z.infer<typeof insertTimeTrackingSchema>;
export type TimeTracking = typeof projectTimeTracking.$inferSelect;

export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof projectScreenshots.$inferSelect;

export type InsertTaskSummary = z.infer<typeof insertTaskSummarySchema>;
export type TaskSummary = typeof taskSummaries.$inferSelect;