import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const projectImports = pgTable('project_imports', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  userId: integer('user_id').notNull().references(() => users.id),
  importType: text('import_type').notNull(), // 'figma', 'bolt', 'lovable'
  sourceUrl: text('source_url').notNull(),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  metadata: jsonb('metadata'), // Store platform-specific data
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  error: text('error'),
});

export const importTemplates = pgTable('import_templates', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  importType: text('import_type').notNull(), // 'figma', 'bolt', 'lovable'
  name: text('name').notNull(),
  description: text('description'),
  mappingRules: jsonb('mapping_rules').notNull(), // Platform-specific mapping rules
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Schemas
export const insertProjectImportSchema = createInsertSchema(projectImports);
export const insertImportTemplateSchema = createInsertSchema(importTemplates);

// Types
export type ProjectImport = typeof projectImports.$inferSelect;
export type InsertProjectImport = z.infer<typeof insertProjectImportSchema>;
export type ImportTemplate = typeof importTemplates.$inferSelect;
export type InsertImportTemplate = z.infer<typeof insertImportTemplateSchema>;

// Import these tables in the main schema
import { projects, users } from '../schema';
