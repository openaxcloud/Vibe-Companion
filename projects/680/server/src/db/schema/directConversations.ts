import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  text,
  integer,
  boolean,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { directMessages } from './directMessages';

export const directConversations = pgTable(
  'direct_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    isGroup: boolean('is_group').notNull().default(false),
    title: text('title'),
    topic: text('topic'),
    metadata: text('metadata'),
  },
  (table) => {
    return {
      createdByIdx: uniqueIndex('direct_conversations_created_by_id_idx').on(
        table.createdById,
        table.id,
      ),
    };
  },
);

export const directConversationParticipants = pgTable(
  'direct_conversation_participants',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => directConversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    role: text('role').notNull().default('member'),
    isMuted: boolean('is_muted').notNull().default(false),
    muteUntil: timestamp('mute_until', { withTimezone: true }),
    unreadCount: integer('unread_count').notNull().default(0),
  },
  (table) => {
    return {
      pk: primaryKey({
        name: 'direct_conversation_participants_pk',
        columns: [table.conversationId, table.userId],
      }),
      conversationUserIdx: uniqueIndex(
        'direct_conversation_participants_conversation_id_user_id_idx',
      ).on(table.conversationId, table.userId),
      userIdx: uniqueIndex(
        'direct_conversation_participants_user_id_conversation_id_idx',
      ).on(table.userId, table.conversationId),
    };
  },
);

export const directConversationsRelations = relations(
  directConversations,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [directConversations.createdById],
      references: [users.id],
      relationName: 'directConversationsCreatedBy',
    }),
    participants: many(directConversationParticipants, {
      relationName: 'conversationParticipants',
    }),
    messages: many(directMessages, {
      relationName: 'conversationMessages',
    }),
  }),
);

export const directConversationParticipantsRelations = relations(
  directConversationParticipants,
  ({ one }) => ({
    conversation: one(directConversations, {
      fields: [directConversationParticipants.conversationId],
      references: [directConversations.id],
      relationName: 'conversationParticipants',
    }),
    user: one(users, {
      fields: [directConversationParticipants.userId],
      references: [users.id],
      relationName: 'userConversationParticipants',
    }),
  }),
);

export type DirectConversation = typeof directConversations.$inferSelect;
export type NewDirectConversation = typeof directConversations.$inferInsert;

export type DirectConversationParticipant =
  typeof directConversationParticipants.$inferSelect;
export type NewDirectConversationParticipant =
  typeof directConversationParticipants.$inferInsert;