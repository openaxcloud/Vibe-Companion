// Comprehensive Checkpoints schema for version control with AI context and database state
// NOTE (#113-114): This is a duplicate of checkpoints table in shared/schema.ts.
// The canonical version is in shared/schema.ts which has more fields (Replit Agent 3 style).
// Consider consolidating these definitions in a future refactoring.
import { pgTable, serial, text, integer, timestamp, json, boolean, numeric } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const checkpoints = pgTable('checkpoints', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  userId: integer('user_id').notNull(),
  message: text('message').notNull(),
  
  // Comprehensive snapshots
  filesSnapshot: json('files_snapshot').notNull(), // JSON snapshot of all files at this point
  aiConversationContext: json('ai_conversation_context').notNull(), // Full AI chat history and context
  databaseSnapshot: json('database_snapshot'), // Database schema and data snapshot
  environmentVariables: json('environment_variables'), // Environment variables snapshot
  
  // Agent work tracking
  agentTaskDescription: text('agent_task_description'),
  agentActionsPerformed: json('agent_actions_performed'), // List of actions taken by agent
  filesModified: integer('files_modified').default(0),
  linesOfCodeWritten: integer('lines_of_code_written').default(0),
  
  // Effort-based pricing metrics
  effortScore: numeric('effort_score').default('1.0'), // Multiplier for pricing (1.0 = simple, 5.0 = complex)
  tokensUsed: integer('tokens_used').default(0),
  executionTimeMs: integer('execution_time_ms').default(0),
  apiCallsCount: integer('api_calls_count').default(0),
  costInCents: integer('cost_in_cents').default(0), // Calculated cost based on effort
  
  // Checkpoint metadata
  isAutomatic: boolean('is_automatic').default(true), // True if created by agent, false if manual
  parentCheckpointId: integer('parent_checkpoint_id'), // For branching
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertCheckpointSchema = createInsertSchema(checkpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertCheckpoint = z.infer<typeof insertCheckpointSchema>;
export type Checkpoint = typeof checkpoints.$inferSelect;