import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { messages } from "./messages";

export const reactionTypeEnum = pgEnum("reaction_type", [
  "like",
  "love",
  "laugh",
  "surprised",
  "sad",
  "angry",
  "custom",
]);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    reactionType: reactionTypeEnum("reaction_type").notNull(),
    emoji: text("emoji"),
    emojiName: text("emoji_name"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id], name: "reactions_pkey" }),

    userMessageUnique: index("reactions_user_message_reaction_idx").on(
      table.userId,
      table.messageId,
      table.reactionType,
      table.emoji
    ),

    userIdIdx: index("reactions_user_id_idx").on(table.userId),
    messageIdIdx: index("reactions_message_id_idx").on(table.messageId),
    reactionTypeIdx: index("reactions_reaction_type_idx").on(
      table.reactionType
    ),
    createdAtIdx: index("reactions_created_at_idx").on(table.createdAt),
  })
);

export const reactionsRelations = relations(reactions, ({ one }) => ({
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id],
  }),
}));

export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;