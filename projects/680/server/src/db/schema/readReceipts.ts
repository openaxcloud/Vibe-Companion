import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
  sql,
  index,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { users } from "./users";
import { channels } from "./channels";
import { directMessageThreads } from "./directMessageThreads";
import { messages } from "./messages";

export const readReceipts = pgTable(
  "read_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),

    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

    dmThreadId: uuid("dm_thread_id").references(() => directMessageThreads.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

    lastReadMessageId: uuid("last_read_message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    lastReadAt: timestamp("last_read_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.lastReadMessageId],
      name: "read_receipts_pkey",
    }),

    userChannelUnique: index("read_receipts_user_channel_idx").on(
      table.userId,
      table.channelId
    ),

    userDmUnique: index("read_receipts_user_dm_thread_idx").on(
      table.userId,
      table.dmThreadId
    ),

    channelMessageIdx: index("read_receipts_channel_message_idx").on(
      table.channelId,
      table.lastReadMessageId
    ),

    dmThreadMessageIdx: index("read_receipts_dm_thread_message_idx").on(
      table.dmThreadId,
      table.lastReadMessageId
    ),

    userLastReadAtIdx: index("read_receipts_user_last_read_at_idx").on(
      table.userId,
      table.lastReadAt
    ),
  })
);

export type ReadReceipt = InferSelectModel<typeof readReceipts>;
export type NewReadReceipt = InferInsertModel<typeof readReceipts>;
export type ReadReceiptId = {
  userId: string;
  lastReadMessageId: string;
};