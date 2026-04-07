import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channels";
import { directConversations } from "./directConversations";
import { users } from "./users";

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),

    channelId: integer("channel_id")
      .references(() => channels.id, { onDelete: "cascade" })
      .notNull(),

    directConversationId: integer("direct_conversation_id").references(
      () => directConversations.id,
      { onDelete: "cascade" }
    ),

    senderId: integer("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    content: text("content").notNull(),

    fileUrl: varchar("file_url", { length: 2048 }),

    imageUrl: varchar("image_url", { length: 2048 }),

    parentMessageId: integer("parent_message_id").references(
      () => messages.id,
      { onDelete: "set null" }
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    channelIdx: index("messages_channel_id_idx").on(table.channelId),
    directConversationIdx: index(
      "messages_direct_conversation_id_idx"
    ).on(table.directConversationId),
    senderIdx: index("messages_sender_id_idx").on(table.senderId),
    parentMessageIdx: index("messages_parent_message_id_idx").on(
      table.parentMessageId
    ),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  })
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  directConversation: one(directConversations, {
    fields: [messages.directConversationId],
    references: [directConversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id],
    relationName: "parent",
  }),
  threadMessages: many(messages, {
    relationName: "parent",
  }),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;